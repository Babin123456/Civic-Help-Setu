// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { createGitHubSource, readArchive } from './github.mjs'
import { buildScorecard, renderMarkdown } from './report.mjs'
import { collectReport } from './collect.mjs'
import { qualityEvidence } from '../platform-quality-evidence.mjs'

const exec = promisify(execFile)
const SHA = 'a'.repeat(40)
const NOW = new Date('2026-11-25T10:20:00Z')
const CREATED = '2026-11-25T10:10:00Z'
const checks = { install: 'success', contracts: 'success', lint: 'success', test: 'success', build: 'success' }
const steps = { install: 'Install locked dependencies', contracts: 'Civic contract compatibility and change audit', lint: 'Lint', test: 'Test', build: 'Build' }
const measurementPolicy = { routes: ['/'], previewOrigin: 'http://localhost:4173', runsPerRoute: 3, minAccessibility: 0.9, maxFcpMs: 3000 }

function fixture() {
  const producer = { kind: 'quality', workflowId: 11, workflowPath: '.github/workflows/pr-quality.yml', artifactName: 'civic-quality-evidence', configurationBlobs: { '.github/workflows/pr-quality.yml': SHA }, checkSteps: steps }
  const policy = { repository: 'civic/test', repositoryId: 7, branch: 'main', maxAgeHours: 24, producers: [producer], lighthouse: measurementPolicy }
  const run = { id: 123, run_attempt: 1, head_sha: SHA, repository: { id: 7 }, head_repository: { id: 7, full_name: 'civic/test' }, workflow_id: 11, path: producer.workflowPath, event: 'push', head_branch: 'main', status: 'completed', conclusion: 'success', run_started_at: '2026-11-25T10:00:00Z' }
  const archive = Buffer.from('synthetic archive bytes; no production evidence')
  const artifact = { id: 456, name: producer.artifactName, size_in_bytes: archive.length, digest: 'sha256:' + createHash('sha256').update(archive).digest('hex'), created_at: CREATED, expires_at: '2026-12-01T00:00:00Z', expired: false, workflow_run: { id: 123, repository_id: 7, head_repository_id: 7, head_branch: 'main', head_sha: SHA } }
  const report = { schemaVersion: 1, repository: 'civic/test', commit: SHA, ref: 'refs/heads/main', runId: '123', runAttempt: 1, checks: { ...checks } }
  const jobs = { total_count: 1, jobs: [{ name: 'Lint, tests and build', steps: Object.entries(steps).map(([key, name]) => ({ name, conclusion: checks[key] })) }] }
  const state = { definition: { id: 11, path: producer.workflowPath }, runs: [run], runCount: 1, config: { type: 'file', sha: SHA }, artifacts: [artifact], jobs, archive, report }
  const fetchImpl = vi.fn(async (input) => {
    const path = new URL(input).pathname
    const json = (value) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })
    if (path.endsWith('/workflows/11')) return json(state.definition)
    if (path.endsWith('/workflows/11/runs')) return json({ workflow_runs: state.runs, total_count: state.runCount })
    if (path.includes('/contents/')) return json(state.config)
    if (path.endsWith('/runs/123/artifacts')) return json({ total_count: state.artifacts.length, artifacts: state.artifacts })
    if (path.endsWith('/artifacts/456/zip')) return new Response(state.archive)
    if (path.endsWith('/runs/123/jobs')) return json(state.jobs)
    throw new Error('Unexpected test API path: ' + path)
  })
  const archiveReader = vi.fn(async () => [state.report])
  const options = { policy, token: 'synthetic-test-token', fetchImpl, now: () => NOW, sleep: vi.fn(async () => {}), archiveReader }
  return { policy, producer, state, options, fetchImpl, archiveReader, collect: () => createGitHubSource(options).collect(producer, SHA) }
}

describe('GitHub artifact trust boundary', () => {
  it('verifies repository/workflow/configuration/commit/digest and native step metadata', async () => {
    const f = fixture()
    expect(await f.collect()).toMatchObject({ status: 'verified', repository: 'civic/test', commit: SHA, runId: 123, artifactId: 456, reports: [f.state.report] })
    expect(f.archiveReader).toHaveBeenCalledExactlyOnceWith(f.state.archive, 'quality')
  })

  const invalidCases = [
    ['foreign repository', (f) => { f.state.runs[0].repository.id = 8 }],
    ['fork head repository', (f) => { f.state.runs[0].head_repository.id = 8 }],
    ['foreign head name', (f) => { f.state.runs[0].head_repository.full_name = 'attacker/test' }],
    ['wrong workflow ID', (f) => { f.state.runs[0].workflow_id = 12 }],
    ['wrong workflow path', (f) => { f.state.runs[0].path = '.github/workflows/other.yml' }],
    ['untrusted event', (f) => { f.state.runs[0].event = 'pull_request' }],
    ['untrusted branch', (f) => { f.state.runs[0].head_branch = 'feature' }],
    ['wrong commit', (f) => { f.state.runs[0].head_sha = 'b'.repeat(40) }],
    ['wrong workflow definition', (f) => { f.state.definition.path = '.github/workflows/other.yml' }],
    ['changed producer configuration', (f) => { f.state.config.sha = 'b'.repeat(40) }],
    ['unbounded run response', (f) => { f.state.runCount = 101 }],
    ['artifact from another run', (f) => { f.state.artifacts[0].workflow_run.id = 124 }],
    ['artifact from another repository', (f) => { f.state.artifacts[0].workflow_run.repository_id = 8 }],
    ['artifact fork', (f) => { f.state.artifacts[0].workflow_run.head_repository_id = 8 }],
    ['artifact branch', (f) => { f.state.artifacts[0].workflow_run.head_branch = 'feature' }],
    ['artifact commit mismatch', (f) => { f.state.artifacts[0].workflow_run.head_sha = 'b'.repeat(40) }],
    ['missing trusted digest', (f) => { delete f.state.artifacts[0].digest }],
    ['tampered archive', (f) => { f.state.archive = Buffer.from('tampered') }],
    ['future artifact', (f) => { f.state.artifacts[0].created_at = '2027-01-01T00:00:00Z' }],
    ['artifact predating current attempt', (f) => { f.state.artifacts[0].created_at = '2026-11-24T23:00:00Z' }],
    ['artifact from a just-previous attempt', (f) => { f.state.artifacts[0].created_at = '2026-11-25T09:59:59Z' }],
    ['oversized artifact metadata', (f) => { f.state.artifacts[0].size_in_bytes = 30 * 1024 * 1024 }],
    ['negative artifact size', (f) => { f.state.artifacts[0].size_in_bytes = -1 }],
    ['self-reported passing test', (f) => { f.state.jobs.jobs[0].steps.find((s) => s.name === 'Test').conclusion = 'failure' }],
    ['old run attempt payload', (f) => { f.state.report.runAttempt = 0 }],
    ['payload commit mismatch', (f) => { f.state.report.commit = 'b'.repeat(40) }],
    ['payload foreign repository', (f) => { f.state.report.repository = 'attacker/test' }],
    ['payload ref mismatch', (f) => { f.state.report.ref = 'refs/heads/feature' }],
  ]
  it.each(invalidCases)('rejects %s without awarding quality credit', async (_name, mutate) => {
    const f = fixture()
    mutate(f)
    const record = await f.collect()
    expect(record.status).toBe('invalid')
    expect(record.reports).toEqual([])
    expect(JSON.stringify(record)).not.toContain('synthetic-test-token')
    expect(buildScorecard({ commit: SHA, policyDigest: 'test', evidence: [record], now: NOW }).score.percent).toBe(0)
  })

  it.each([
    ['expired', (f) => { f.state.artifacts[0].expired = true }],
    ['expiry time elapsed', (f) => { f.state.artifacts[0].expires_at = '2026-11-25T10:00:00Z' }],
    ['producer pending', (f) => { f.state.runs[0].status = 'in_progress' }],
    ['artifact absent', (f) => { f.state.artifacts = [] }],
    ['no matching run', (f) => { f.state.runs = [] }],
  ])('distinguishes unavailable %s from successful health', async (_name, mutate) => {
    const f = fixture(); mutate(f)
    const record = await f.collect()
    expect(record.status).toBe('unavailable')
    expect(record.reports).toEqual([])
  })

  it('never falls back to an older passing run while the latest attempt is pending', async () => {
    const f = fixture(); f.state.runs.push({ ...structuredClone(f.state.runs[0]), id: 124, status: 'in_progress' }); f.state.runCount = 2
    expect(await f.collect()).toMatchObject({ status: 'unavailable', runId: 124, reason: 'producer_not_completed' })
  })
  it('accepts an owner-dispatched run only on the pinned main repository/ref', async () => {
    const f = fixture(); f.state.runs[0].event = 'workflow_dispatch'
    expect((await f.collect()).status).toBe('verified')
    f.state.runs[0].head_branch = 'unreviewed-branch'
    expect((await f.collect()).status).toBe('invalid')
  })
  it('rejects a missing workflow configuration pin before network access', async () => {
    const f = fixture(); f.producer.configurationBlobs = {}
    expect(await f.collect()).toMatchObject({ status: 'invalid', reason: 'invalid_evidence_selector' })
    expect(f.fetchImpl).not.toHaveBeenCalled()
  })
  it('does not turn a verified failing quality run into passing readiness', async () => {
    const f = fixture(); f.state.report.checks.test = 'failure'; f.state.runs[0].conclusion = 'failure'; f.state.jobs.jobs[0].steps.find((s) => s.name === 'Test').conclusion = 'failure'
    const record = await f.collect(); expect(record.status).toBe('verified')
    const score = buildScorecard({ commit: SHA, policyDigest: 'test', evidence: [record], now: NOW })
    expect(score.dimensions.operationalReadiness).toMatchObject({ status: 'verified', passed: false })
    expect(score.alerts).toContainEqual(expect.objectContaining({ dimension: 'operationalReadiness', severity: 'error' }))
  })
  it('retries rate limits and bounded transient dependency failures', async () => {
    const f = fixture(); const good = f.options.fetchImpl; let count = 0
    f.options.fetchImpl = async (...args) => ++count < 3 ? new Response('', { status: 429, headers: { 'Retry-After': '999' } }) : good(...args)
    expect((await f.collect()).status).toBe('verified')
    expect(f.options.sleep.mock.calls.map(([ms]) => ms)).toEqual([2000, 2000])
  })
  it('exhausts a failing dependency without leaking authorization', async () => {
    const f = fixture(); f.options.fetchImpl = vi.fn(async () => { throw new Error('synthetic-test-token') })
    expect(await f.collect()).toMatchObject({ status: 'unavailable', reason: 'github_transport_unavailable' })
    expect(f.options.fetchImpl).toHaveBeenCalledTimes(3)
  })
  it.each([401, 403, 404, 410])('records API %i as unavailable without fabricated measurements', async (status) => {
    const f = fixture(); f.options.fetchImpl = async () => new Response('', { status })
    expect((await f.collect()).status).toBe('unavailable')
  })
  it('does not forward the bearer token to a GitHub-provided storage redirect', async () => {
    const f = fixture(); const good = f.options.fetchImpl
    f.options.fetchImpl = vi.fn(async (url, options) => {
      if (String(url).includes('/artifacts/456/zip')) return new Response(null, { status: 302, headers: { Location: 'https://storage.example.test/archive' } })
      if (String(url).startsWith('https://storage.example.test/')) { expect(options.headers).toBeUndefined(); return new Response(f.state.archive) }
      return good(url, options)
    })
    expect((await f.collect()).status).toBe('verified')
  })
  it.each(['http://localhost:1234/archive', 'https://user:secret@example.test/archive', 'not-a-url'])('rejects unsafe redirect %s', async (location) => {
    const f = fixture(); const good = f.options.fetchImpl
    f.options.fetchImpl = (url, options) => String(url).includes('/artifacts/456/zip') ? new Response(null, { status: 302, headers: { Location: location } }) : good(url, options)
    expect(await f.collect()).toMatchObject({ status: 'invalid', reason: 'invalid_download_redirect' })
  })
  it('rejects oversized API bodies before parsing', async () => {
    const f = fixture(); f.options.fetchImpl = async () => new Response('{}', { headers: { 'Content-Length': String(3 * 1024 * 1024) } })
    expect(await f.collect()).toMatchObject({ status: 'invalid', reason: 'response_size_limit' })
  })
  it('distinguishes an interrupted response body from invalid evidence', async () => {
    const f = fixture(); f.options.fetchImpl = async () => new Response(new ReadableStream({ start(controller) { controller.error(new Error('connection reset')) } }))
    expect(await f.collect()).toMatchObject({ status: 'unavailable', reason: 'evidence_body_unavailable' })
  })
  it('keeps concurrent collection deterministic and bounded under synthetic load', async () => {
    const f = fixture(); const source = createGitHubSource(f.options); const records = []
    for (let offset = 0; offset < 40; offset += 4) records.push(...await Promise.all(Array.from({ length: 4 }, () => source.collect(f.producer, SHA))))
    expect(records).toHaveLength(40); expect(records.every((r) => r.status === 'verified')).toBe(true)
    expect(new Set(records.map((r) => r.digest)).size).toBe(1)
    // Collector pressure only; this is deliberately not a platform throughput claim.
  })
  it('bounds trend history and does not accept a caller-provided history document', async () => {
    const f = fixture(); f.state.runs = Array.from({ length: 8 }, (_, i) => ({ ...f.state.runs[0], head_sha: String(i + 1).repeat(40), id: 123 + i })); f.state.runCount = 8
    const source = createGitHubSource(f.options)
    expect(await source.recentCommits(5)).toHaveLength(5)
    await expect(source.recentCommits(-1)).rejects.toThrow('invalid_history_limit')
  })
  it('requires configuration and age bounds in the trust policy', () => {
    const f = fixture(); delete f.policy.maxAgeHours
    expect(() => createGitHubSource(f.options)).toThrow('invalid_trust_policy')
  })
})

function lighthouse(replace = {}) {
  const report = { requestedUrl: 'http://localhost:4173/', finalUrl: 'http://localhost:4173/', fetchTime: '2026-11-25T10:05:00Z', categories: { accessibility: { score: 0.95 } }, audits: { 'first-contentful-paint': { numericUnit: 'millisecond', numericValue: 2000 } } }
  return { producer: 'lighthouse', status: 'verified', artifactId: 456, createdAt: CREATED, reports: Array.from({ length: 3 }, () => structuredClone(report)), measurementPolicy, ...replace }
}

describe('honest capacity scorecard and actionable gaps', () => {
  it('keeps all production-only dimensions unknown even when synthetic preview checks pass', () => {
    const score = buildScorecard({ commit: SHA, policyDigest: 'test', evidence: [lighthouse()], now: NOW })
    for (const name of ['throughput', 'availability', 'privacy', 'cost']) expect(score.dimensions[name]).toMatchObject({ status: 'unavailable', passed: false })
    expect(score.score).toMatchObject({ passedDimensions: 2, totalDimensions: 7, percent: 28.6 })
    expect(score.sources[0]).not.toHaveProperty('reports')
    expect(renderMarkdown(score)).toContain('not production API latency')
  })
  it.each([
    ['missing score', (x) => { delete x.reports[0].categories.accessibility.score }],
    ['null score', (x) => { x.reports[0].categories.accessibility.score = null }],
    ['invented zero-latency default', (x) => { delete x.reports[0].audits['first-contentful-paint'] }],
    ['wrong units', (x) => { x.reports[0].audits['first-contentful-paint'].numericUnit = 'second' }],
    ['missing route runs', (x) => { x.reports.pop() }],
    ['duplicate extra runs', (x) => { x.reports.push(x.reports[0]) }],
    ['unexpected origin', (x) => { x.reports[0].requestedUrl = 'https://attacker.test/' }],
    ['redirected route', (x) => { x.reports[0].finalUrl = 'http://localhost:4173/login' }],
    ['stale report in a fresh archive', (x) => { x.reports[0].fetchTime = '2026-01-01T00:00:00Z' }],
    ['empty configured routes', (x) => { x.measurementPolicy = { ...measurementPolicy, routes: [] } }],
    ['weakened accessibility budget', (x) => { x.measurementPolicy = { ...measurementPolicy, minAccessibility: 0 } }],
  ])('invalidates %s instead of raising a score', (_name, mutate) => {
    const record = lighthouse(); mutate(record)
    const result = buildScorecard({ commit: SHA, policyDigest: 'test', evidence: [record], now: NOW })
    expect(result.score.percent).toBe(0); expect(result.dimensions.latency.status).toBe('invalid')
  })
  it('uses medians per actual route, preserving failing measurements', () => {
    const record = lighthouse(); for (const r of record.reports) r.audits['first-contentful-paint'].numericValue = 4000
    const result = buildScorecard({ commit: SHA, policyDigest: 'test', evidence: [record], now: NOW })
    expect(result.dimensions.latency).toMatchObject({ status: 'verified', passed: false })
    expect(result.dimensions.accessibility.passed).toBe(true)
  })
  it('keeps unavailable and invalid evidence distinct and actionable', () => {
    const result = buildScorecard({ commit: SHA, policyDigest: 'test', evidence: [{ producer: 'quality', status: 'invalid', reason: 'artifact_digest_mismatch' }, { producer: 'lighthouse', status: 'unavailable', reason: 'artifact_expired' }], now: NOW })
    expect(result.dimensions.operationalReadiness).toMatchObject({ status: 'invalid', reason: 'artifact_digest_mismatch' })
    expect(result.dimensions.accessibility.status).toBe('unavailable'); expect(result.score.percent).toBe(0)
  })
  it('collects through the source interface instead of accepting self-reported scores', async () => {
    const f = fixture(); const report = await collectReport(createGitHubSource(f.options), f.policy, SHA, 'policy-digest', NOW)
    expect(report.score.passedDimensions).toBe(1); expect(report.commit).toBe(SHA)
  })
})

describe('native archive parser and producer envelope', () => {
  it('keeps the checked-in producer/configuration pins consistent with actual source bytes', async () => {
    const policy = JSON.parse(await readFile(new URL('./policy.json', import.meta.url), 'utf8'))
    for (const producer of policy.producers) {
      for (const [path, expected] of Object.entries(producer.configurationBlobs)) {
        const bytes = await readFile(new URL('../../' + path, import.meta.url))
        const actual = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
        expect(actual, path).toBe(expected)
      }
    }
  })
  async function zip(files) {
    const dir = await mkdtemp(join(tmpdir(), 'civic-fixture-'))
    try {
      await mkdir(join(dir, 'inner'))
      for (const [name, body] of Object.entries(files)) await writeFile(join(dir, 'inner', name), body)
      await exec('zip', ['-q', join(dir, 'artifact.zip'), ...Object.keys(files)], { cwd: join(dir, 'inner') })
      return await readFile(join(dir, 'artifact.zip'))
    } finally { await rm(dir, { recursive: true, force: true }) }
  }
  it('reads real quality ZIP bytes without extracting files', async () => {
    expect(await readArchive(await zip({ 'quality.json': '{"schemaVersion":1}' }), 'quality')).toEqual([{ schemaVersion: 1 }])
  })
  it('reads real Lighthouse ZIP reports and ignores HTML', async () => {
    expect(await readArchive(await zip({ 'lhr-1.json': '{"measurement":1}', 'lhr-1.html': '<html></html>' }), 'lighthouse')).toEqual([{ measurement: 1 }])
  })
  it('rejects traversal entries even though they are never extracted', async () => {
    await expect(readArchive(await zip({ '../escape.json': '{}', 'quality.json': '{}' }), 'quality')).rejects.toThrow('unsafe_archive_entries')
  })
  it('bounds expanded reports and rejects corrupt archives', async () => {
    await expect(readArchive(await zip({ 'quality.json': JSON.stringify({ huge: 'x'.repeat(2 * 1024 * 1024) }) }), 'quality')).rejects.toThrow('unreadable_or_oversized_archive')
    await expect(readArchive(Buffer.from('not a ZIP'), 'quality')).rejects.toThrow('unreadable_or_oversized_archive')
  })
  it('requires producer context and does not fabricate successful outcomes', () => {
    expect(() => qualityEvidence({})).toThrow('Missing authoritative workflow context')
    const env = { GITHUB_REPOSITORY: 'civic/test', GITHUB_SHA: SHA, GITHUB_REF: 'refs/heads/main', GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', ...Object.fromEntries(Object.keys(checks).map((key) => ['QUALITY_' + key.toUpperCase(), key === 'test' ? 'failure' : 'success'])) }
    expect(qualityEvidence(env)).toMatchObject({ runId: '123', checks: { test: 'failure' } })
  })
})
