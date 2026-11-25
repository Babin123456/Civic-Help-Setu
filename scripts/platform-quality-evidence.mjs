import { mkdir, writeFile } from 'node:fs/promises'

export function qualityEvidence(env) {
  const checks = Object.fromEntries(['install', 'contracts', 'lint', 'test', 'build'].map((key) => [key, env[`QUALITY_${key.toUpperCase()}`]]))
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY || '') || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || '') || !/^\d+$/.test(env.GITHUB_RUN_ID || '') || !/^\d+$/.test(env.GITHUB_RUN_ATTEMPT || '') || Object.values(checks).some((v) => !['success', 'failure', 'cancelled', 'skipped'].includes(v))) throw new Error('Missing authoritative workflow context or step outcomes')
  return { schemaVersion: 1, repository: env.GITHUB_REPOSITORY, commit: env.GITHUB_SHA, ref: env.GITHUB_REF, runId: env.GITHUB_RUN_ID, runAttempt: Number(env.GITHUB_RUN_ATTEMPT), checks }
}

if (process.argv[1]?.endsWith('/platform-quality-evidence.mjs')) {
  const evidence = qualityEvidence(process.env)
  await mkdir('.platform-evidence', { recursive: true })
  await writeFile('.platform-evidence/quality.json', JSON.stringify(evidence, null, 2) + '\n')
}
