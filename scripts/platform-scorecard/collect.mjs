import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile, appendFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createGitHubSource } from './github.mjs'
import { buildScorecard, renderMarkdown } from './report.mjs'

export async function collectReport(source, policy, commit, policyDigest, now = new Date()) {
  const evidence = []
  // Bound requests and peak archive expansion; no concurrently written history file.
  for (const producer of policy.producers) {
    const record = await source.collect(producer, commit)
    if (producer.kind === 'lighthouse') record.measurementPolicy = policy.lighthouse
    evidence.push(record)
  }
  return buildScorecard({ commit, policyDigest, evidence, now })
}

export async function main(args = process.argv.slice(2)) {
  if (args.length !== 2 || args[0] !== '--sha' || !/^[a-f0-9]{40}$/.test(args[1])) throw new Error('Usage: npm run scorecard -- --sha <exact 40-character main commit>')
  const text = await readFile(new URL('./policy.json', import.meta.url), 'utf8')
  const policy = JSON.parse(text)
  const policyDigest = createHash('sha256').update(text).digest('hex')
  const source = createGitHubSource({ policy, token: process.env.GITHUB_TOKEN })
  const report = await collectReport(source, policy, args[1], policyDigest)
  const history = []
  let historyStatus = 'verified'
  try {
    for (const commit of await source.recentCommits(5)) history.push(commit === report.commit ? report : await collectReport(source, policy, commit, policyDigest))
  } catch {
    historyStatus = 'unavailable'
  }
  const document = { ...report, historyStatus, history: history.map(({ commit, collectedAt, score, dimensions, sources }) => ({ commit, collectedAt, score, dimensions, sources })) }
  let markdown = renderMarkdown(report)
  markdown += '\n## Bounded trend history\n\nRecomputed from trusted producers for up to five recent main commits; never imported from caller JSON. Invalid or unavailable history remains unknown.\n\n| Commit | Evidence score |\n| --- | --- |\n'
  for (const entry of history) markdown += `| \`${entry.commit}\` | ${entry.score.percent}% (${entry.score.passedDimensions}/7) |\n`
  markdown += `\nHistory discovery: ${historyStatus}. See scorecard.json for each observation\u2019s complete source IDs, timestamps and rejection reasons.\n`
  await mkdir('.platform-scorecard', { recursive: true })
  await writeFile('.platform-scorecard/scorecard.json', JSON.stringify(document, null, 2) + '\n')
  await writeFile('.platform-scorecard/scorecard.md', markdown)
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown)
  console.log(`Evidence score ${report.score.percent}% (${report.score.passedDimensions}/7). Production availability, throughput, privacy and cost remain unavailable.`)
  if (report.alerts.length) process.exitCode = 2
  return document
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Scorecard collection could not complete; no health claim was published. Check configuration, GitHub authorization and evidence availability.'); process.exitCode = 1 })
}
