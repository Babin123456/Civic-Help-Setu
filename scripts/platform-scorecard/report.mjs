const unknown = (reason, action) => ({ status: 'unavailable', reason, action, passed: false })

export function buildScorecard({ commit, policyDigest, evidence, now = new Date() }) {
  const quality = evidence.find((e) => e.producer === 'quality')
  const lighthouse = evidence.find((e) => e.producer === 'lighthouse')
  const dimensions = {
    throughput: unknown('No trusted application load-test producer configured.', 'Add an approved synthetic application load-test collector; do not infer throughput from CI duration.'),
    latency: unknown('No verified preview measurements.', 'Restore the pinned Lighthouse producer and its complete route reports.'),
    availability: unknown('No deployed availability collector.', 'Configure an authenticated uptime collector and an explicit observation window.'),
    privacy: unknown('CI quality checks do not establish a production privacy assessment.', 'Add an independently reviewed privacy evidence producer; preserve the existing diagnostics allowlist.'),
    accessibility: unknown('No verified accessibility measurements.', 'Restore the pinned Lighthouse producer and its complete route reports.'),
    cost: unknown('No deployed usage/billing collector.', 'Configure a trusted cost source; do not interpret missing billing as zero cost.'),
    operationalReadiness: unknown('No verified quality artifact.', 'Run the pinned main-branch quality workflow, including contract, lint, test and build checks.'),
  }
  if (quality?.status === 'verified') {
    const checks = quality.reports[0].checks
    const passed = ['install', 'contracts', 'lint', 'test', 'build'].every((key) => checks[key] === 'success') && quality.producerConclusion === 'success'
    dimensions.operationalReadiness = { status: 'verified', scope: 'CI checks only; not production readiness certification', passed, checks, sourceId: quality.artifactId, action: passed ? 'Keep the existing quality gates enabled.' : 'Repair failing canonical quality checks; do not weaken them.' }
  } else if (quality?.status === 'invalid') {
    dimensions.operationalReadiness = { ...dimensions.operationalReadiness, status: 'invalid', reason: quality.reason }
  }
  if (lighthouse?.status === 'verified') {
    try {
      const policy = lighthouse.measurementPolicy
      if (!Array.isArray(policy.routes) || !policy.routes.length || policy.routes.length > 10 || new Set(policy.routes).size !== policy.routes.length || policy.routes.some((path) => typeof path !== 'string' || !/^\/[\w/-]*$/.test(path)) || !Number.isSafeInteger(policy.runsPerRoute) || policy.runsPerRoute < 1 || policy.runsPerRoute > 5 || !Number.isFinite(policy.minAccessibility) || policy.minAccessibility < 0.9 || policy.minAccessibility > 1 || !Number.isFinite(policy.maxFcpMs) || policy.maxFcpMs <= 0 || policy.maxFcpMs > 3000) throw new Error('Invalid measurement policy')
      const routes = new Map(policy.routes.map((path) => [path, []]))
      for (const report of lighthouse.reports) {
        const url = new URL(report.requestedUrl)
        const final = new URL(report.finalUrl || report.requestedUrl)
        const a11y = report.categories?.accessibility?.score
        const fcp = report.audits?.['first-contentful-paint']
        const measuredAt = Date.parse(report.fetchTime)
        if (url.origin !== policy.previewOrigin || final.origin !== url.origin || final.pathname !== url.pathname || !routes.has(url.pathname) || url.search || url.hash || final.search || final.hash || !Number.isFinite(a11y) || a11y < 0 || a11y > 1 || fcp?.numericUnit !== 'millisecond' || !Number.isFinite(fcp.numericValue) || fcp.numericValue < 0 || !Number.isFinite(measuredAt) || measuredAt > now.getTime() + 60000 || measuredAt > Date.parse(lighthouse.createdAt) + 60000 || measuredAt < Date.parse(lighthouse.createdAt) - 3600000) throw new Error('Invalid or missing measurement')
        routes.get(url.pathname).push({ accessibility: a11y, firstContentfulPaintMs: fcp.numericValue })
      }
      const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
      const measurements = [...routes].map(([route, runs]) => {
        if (runs.length !== policy.runsPerRoute) throw new Error('Incomplete route coverage')
        return { route, runs: runs.length, accessibility: median(runs.map((r) => r.accessibility)), firstContentfulPaintMs: median(runs.map((r) => r.firstContentfulPaintMs)) }
      })
      dimensions.latency = { status: 'verified', scope: 'Public-route synthetic preview FCP; not production API latency', passed: measurements.every((r) => r.firstContentfulPaintMs <= policy.maxFcpMs), thresholdMs: policy.maxFcpMs, measurements, sourceId: lighthouse.artifactId, action: 'Investigate routes exceeding the existing Lighthouse FCP warning budget.' }
      dimensions.accessibility = { status: 'verified', scope: 'Automated public-route Lighthouse audit; manual accessibility is not measured', passed: measurements.every((r) => r.accessibility >= policy.minAccessibility), threshold: policy.minAccessibility, measurements, sourceId: lighthouse.artifactId, action: 'Fix failing public-route accessibility audits; retain manual keyboard/screen-reader review.' }
    } catch {
      for (const name of ['latency', 'accessibility']) dimensions[name] = { ...dimensions[name], status: 'invalid', reason: 'incomplete_or_invalid_route_measurements' }
    }
  } else if (lighthouse?.status === 'invalid') {
    for (const name of ['latency', 'accessibility']) dimensions[name] = { ...dimensions[name], status: 'invalid', reason: lighthouse.reason }
  }
  const values = Object.values(dimensions)
  const passed = values.filter((d) => d.status === 'verified' && d.passed).length
  const alerts = Object.entries(dimensions).filter(([, d]) => d.status === 'invalid' || (d.status === 'verified' && !d.passed)).map(([dimension, d]) => ({ dimension, severity: 'error', reason: d.reason || 'measurement_budget_failed', action: d.action }))
  const sources = evidence.map((source) => { const trace = { ...source }; delete trace.reports; delete trace.measurementPolicy; return trace })
  return { schemaVersion: 1, commit, policyDigest, collectedAt: now.toISOString(), dimensions, alerts, score: { passedDimensions: passed, totalDimensions: 7, percent: Math.round(passed / 7 * 1000) / 10, scope: 'Evidence coverage score, not a production health score; unavailable/invalid dimensions earn no points.' }, sources }
}

export function renderMarkdown(report) {
  const lines = ['# Civic platform capacity and architecture scorecard', '', `Commit: \`${report.commit}\` · Collected: ${report.collectedAt}`, '', `Evidence score: **${report.score.percent}% (${report.score.passedDimensions}/7 dimensions)**. Unknown/invalid evidence earns no points. This is not production health certification.`, '', '| Dimension | Evidence | Result | Scope / gap | Next action |', '| --- | --- | --- | --- | --- |']
  for (const [name, d] of Object.entries(report.dimensions)) lines.push(`| ${name} | ${d.status} | ${d.status === 'verified' ? d.passed ? 'Pass' : 'Fail' : 'Unknown'} | ${d.scope || d.reason} | ${d.action} |`)
  lines.push('', '## Evidence trace', '')
  for (const source of report.sources) lines.push(`- ${source.producer}: ${source.status}; reason=${source.reason || 'none'}; workflow=${source.workflowId}; run=${source.runId || 'unavailable'}; artifact=${source.artifactId || 'unavailable'}; digest=${source.digest || 'unavailable'}; collected=${source.collectedAt}.`)
  return lines.join('\n') + '\n'
}
