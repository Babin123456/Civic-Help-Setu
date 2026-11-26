import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const integer = (value) => Number.isSafeInteger(value) && value > 0

export class EvidenceError extends Error {
  constructor(code, status = 'invalid') {
    super(code)
    this.status = status
  }
}

// Stream selected JSON entries only. Never extract archive paths to disk or run them.
export async function readArchive(bytes, kind) {
  const dir = await mkdtemp(join(tmpdir(), 'civic-scorecard-'))
  const file = join(dir, 'artifact.zip')
  try {
    await writeFile(file, bytes, { mode: 0o600 })
    const { stdout } = await exec('unzip', ['-Z1', file], { timeout: 5000, maxBuffer: 64 * 1024 })
    const names = stdout.trim().split('\n')
    if (names.length > 200 || new Set(names).size !== names.length || names.some((name) => !name || name.startsWith('/') || name.includes('\\') || name.split('/').includes('..') || [...name].some((character) => character.charCodeAt(0) < 32))) {
      throw new EvidenceError('unsafe_archive_entries')
    }
    const selected = names.filter((name) => kind === 'quality' ? name === 'quality.json' : /^lhr-[\w-]+\.json$/.test(name))
    if (!selected.length || selected.length > 40 || (kind === 'quality' && selected.length !== 1)) throw new EvidenceError('missing_or_excessive_reports')
    let total = 0
    const reports = []
    for (const name of selected) {
      const { stdout: text } = await exec('unzip', ['-p', file, name], { timeout: 5000, maxBuffer: 2 * 1024 * 1024 })
      total += Buffer.byteLength(text)
      if (total > 32 * 1024 * 1024) throw new EvidenceError('expanded_artifact_limit')
      reports.push(JSON.parse(text))
    }
    return reports
  } catch (error) {
    if (error instanceof EvidenceError) throw error
    throw new EvidenceError('unreadable_or_oversized_archive')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function boundedBytes(response, limit) {
  if (Number(response.headers.get('content-length')) > limit) throw new EvidenceError('response_size_limit')
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) throw new EvidenceError('response_size_limit')
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  return Buffer.concat(chunks)
}

export function createGitHubSource({ policy, token, fetchImpl = fetch, now = () => new Date(), sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), archiveReader = readArchive }) {
  const repository = policy.repository
  if (!/^[\w-]+\/[\w.-]+$/.test(repository) || !integer(policy.repositoryId) || policy.branch !== 'main' || !Array.isArray(policy.producers) || !Number.isFinite(policy.maxAgeHours) || policy.maxAgeHours < 1 || policy.maxAgeHours > 168) throw new EvidenceError('invalid_trust_policy')
  const prefix = `/repos/${repository}`

  async function request(path, { binary = false } = {}) {
    if (!path.startsWith(prefix + '/')) throw new EvidenceError('non_allowlisted_api_path')
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let response
      try {
        response = await fetchImpl('https://api.github.com' + path, {
          headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          redirect: 'manual', signal: AbortSignal.timeout(10000),
        })
      } catch {
        if (attempt < 2) { await sleep(250 * 2 ** attempt); continue }
        throw new EvidenceError('github_transport_unavailable', 'unavailable')
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await response.body?.cancel()
        await sleep(Math.min(2000, Math.max(250, Number(response.headers.get('retry-after')) * 1000 || 250 * 2 ** attempt)))
        continue
      }
      if (binary && response.status === 302) {
        const location = response.headers.get('location')
        await response.body?.cancel()
        let url
        try { url = new URL(location) } catch { throw new EvidenceError('invalid_download_redirect') }
        if (url.protocol !== 'https:' || url.username || url.password) throw new EvidenceError('invalid_download_redirect')
        // GitHub supplies this short-lived storage URL. Never forward the API token.
        try { response = await fetchImpl(url.href, { redirect: 'error', signal: AbortSignal.timeout(10000) }) }
        catch { throw new EvidenceError('artifact_download_unavailable', 'unavailable') }
      }
      if (!response.ok) {
        await response.body?.cancel()
        throw new EvidenceError([401, 403].includes(response.status) ? 'github_authorization_required' : response.status === 404 || response.status === 410 ? 'evidence_unavailable' : 'github_api_unavailable', 'unavailable')
      }
      let bytes
      try { bytes = await boundedBytes(response, binary ? 25 * 1024 * 1024 : 2 * 1024 * 1024) }
      catch (error) { if (error instanceof EvidenceError) throw error; throw new EvidenceError('evidence_body_unavailable', 'unavailable') }
      if (binary) return bytes
      try { return JSON.parse(bytes.toString('utf8')) } catch { throw new EvidenceError('invalid_github_metadata') }
    }
  }

  async function collect(producer, commit) {
    const trace = { source: 'github-actions', repository, commit, producer: producer.kind, workflowId: producer.workflowId, workflowPath: producer.workflowPath, collectedAt: now().toISOString(), verifiedConfigurationBlobs: {} }
    try {
      if (!/^[a-f0-9]{40}$/.test(commit) || !integer(producer.workflowId) || !['quality', 'lighthouse'].includes(producer.kind) || !/^\.github\/workflows\/[\w-]+\.yml$/.test(producer.workflowPath) || !producer.configurationBlobs?.[producer.workflowPath]) throw new EvidenceError('invalid_evidence_selector')
      const definition = await request(`${prefix}/actions/workflows/${producer.workflowId}`)
      if (definition.id !== producer.workflowId || definition.path !== producer.workflowPath) throw new EvidenceError('workflow_identity_mismatch')
      const listed = await request(`${prefix}/actions/workflows/${producer.workflowId}/runs?branch=main&head_sha=${commit}&per_page=100`)
      const candidates = listed.workflow_runs
      if (!Array.isArray(candidates) || listed.total_count > 100) throw new EvidenceError('invalid_or_excessive_run_metadata')
      const run = candidates.filter((r) => r.head_sha === commit).sort((a, b) => b.id - a.id || b.run_attempt - a.run_attempt)[0]
      if (!run) throw new EvidenceError(candidates.length ? 'run_commit_mismatch' : 'no_run_for_commit', candidates.length ? 'invalid' : 'unavailable')
      Object.assign(trace, { runId: run.id, runAttempt: run.run_attempt, runUrl: `https://github.com/${repository}/actions/runs/${run.id}` })
      if (!integer(run.id) || !integer(run.run_attempt) || run.repository?.id !== policy.repositoryId || run.head_repository?.id !== policy.repositoryId || run.head_repository?.full_name !== repository || run.workflow_id !== producer.workflowId || run.path?.split('@')[0] !== producer.workflowPath || !['push', 'workflow_dispatch'].includes(run.event) || run.head_branch !== 'main') throw new EvidenceError('run_provenance_mismatch')
      if (run.status !== 'completed') throw new EvidenceError('producer_not_completed', 'unavailable')
      for (const [path, expected] of Object.entries(producer.configurationBlobs)) {
        if (!/^[\w./-]+$/.test(path) || path.split('/').includes('..') || !/^[a-f0-9]{40}$/.test(expected)) throw new EvidenceError('invalid_configuration_pin')
        const file = await request(`${prefix}/contents/${path}?ref=${commit}`)
        if (file.type !== 'file' || file.sha !== expected) { trace.rejectedConfigurationPath = path; throw new EvidenceError('producer_configuration_mismatch') }
        trace.verifiedConfigurationBlobs[path] = expected
      }
      const listing = await request(`${prefix}/actions/runs/${run.id}/artifacts?per_page=100`)
      if (listing.total_count > 100 || !Array.isArray(listing.artifacts)) throw new EvidenceError('artifact_listing_limit')
      const artifact = listing.artifacts.filter((a) => a.name === producer.artifactName).sort((a, b) => b.id - a.id)[0]
      if (!artifact) throw new EvidenceError('artifact_missing', 'unavailable')
      Object.assign(trace, { artifactId: artifact.id, digest: artifact.digest, createdAt: artifact.created_at, expiresAt: artifact.expires_at })
      const times = [artifact.created_at, artifact.expires_at, run.run_started_at].map((t) => Date.parse(t))
      if (times.some((t) => !Number.isFinite(t)) || times[0] > now().getTime() + 60000 || times[0] < times[2]) throw new EvidenceError('artifact_time_mismatch')
      if (artifact.expired || times[1] <= now().getTime() || now().getTime() - times[0] > policy.maxAgeHours * 3600000) throw new EvidenceError('artifact_expired', 'unavailable')
      const origin = artifact.workflow_run
      if (!integer(artifact.id) || !integer(artifact.size_in_bytes) || artifact.size_in_bytes > 25 * 1024 * 1024 || origin?.id !== run.id || origin.repository_id !== policy.repositoryId || origin.head_repository_id !== policy.repositoryId || origin.head_branch !== 'main' || origin.head_sha !== commit) throw new EvidenceError('artifact_provenance_mismatch')
      if (!/^sha256:[a-f0-9]{64}$/.test(artifact.digest)) throw new EvidenceError('trusted_digest_missing')
      const archive = await request(`${prefix}/actions/artifacts/${artifact.id}/zip`, { binary: true })
      if (`sha256:${sha256(archive)}` !== artifact.digest) throw new EvidenceError('artifact_digest_mismatch')
      const reports = await archiveReader(archive, producer.kind)
      if (producer.kind === 'quality') {
        const jobs = await request(`${prefix}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`)
        if (jobs.total_count > 100) throw new EvidenceError('job_listing_limit')
        const report = reports[0]
        if (reports.length !== 1 || report.schemaVersion !== 1 || report.repository !== repository || report.commit !== commit || report.ref !== 'refs/heads/main' || String(report.runId) !== String(run.id) || report.runAttempt !== run.run_attempt) throw new EvidenceError('quality_payload_provenance_mismatch')
        const job = jobs.jobs.find((j) => j.name === 'Lint, tests and build')
        for (const [key, name] of Object.entries(producer.checkSteps)) {
          const step = job?.steps?.find((s) => s.name === name)
          if (!step || report.checks?.[key] !== step.conclusion) throw new EvidenceError('quality_check_metadata_mismatch')
        }
      }
      return { ...trace, status: 'verified', reason: null, producerConclusion: run.conclusion, reports }
    } catch (error) {
      return { ...trace, status: error instanceof EvidenceError ? error.status : 'invalid', reason: error instanceof EvidenceError ? error.message : 'malformed_evidence', reports: [] }
    }
  }

  async function recentCommits(limit = 5) {
    if (!integer(limit) || limit > 5) throw new EvidenceError('invalid_history_limit')
    const quality = policy.producers.find((p) => p.kind === 'quality')
    const listed = await request(`${prefix}/actions/workflows/${quality.workflowId}/runs?branch=main&per_page=100`)
    return [...new Set(listed.workflow_runs.filter((r) => ['push', 'workflow_dispatch'].includes(r.event) && r.head_branch === 'main' && r.repository?.id === policy.repositoryId && r.head_repository?.id === policy.repositoryId && /^[a-f0-9]{40}$/.test(r.head_sha)).sort((a, b) => b.id - a.id).map((r) => r.head_sha))].slice(0, limit)
  }

  return { collect, recentCommits }
}
