import { AlertTriangle, CheckCircle2, FileSearch, GitCompareArrows, ShieldCheck, Sparkles } from 'lucide-react';

const metricCards = [
  { key: 'cardScans', label: 'Card / viewport scans', tone: 'neutral' },
  { key: 'warned', label: 'With layout warning', tone: 'warning' },
  { key: 'failed', label: 'Missing metadata error', tone: 'error' },
  { key: 'overflow', label: 'Overflow findings', tone: 'warning' },
  { key: 'missingMetadata', label: 'Missing-metadata findings', tone: 'error' },
  { key: 'needsReview', label: 'Suggestions needing review', tone: 'review' },
];

export default function VisualQaSummary({ report, comparison }) {
  if (!report) return null;
  const { totals } = report;

  return (
    <section className="qa-summary" aria-labelledby="qa-summary-heading">
      <div className="qa-section-heading">
        <div>
          <h2 id="qa-summary-heading">
            <FileSearch size={18} aria-hidden="true" /> Scan summary
          </h2>
          <p>
            <strong>{totals.fixtures}</strong> synthetic fixtures in this filter, <strong>{totals.visibleFixtures}</strong>{' '}
            visible on page {report.pagination.page} of {report.pagination.totalPages}. Scan run{' '}
            <code>{report.scanRunId}</code>.
          </p>
        </div>
        <div className="qa-version-badges">
          <span title="Component version used for measurements">{report.componentVersion}</span>
          <span title="Data contract version used by the fixture generator">{report.dataVersion}</span>
        </div>
      </div>

      <div className="qa-metric-grid">
        {metricCards.map((metric) => (
          <div key={metric.key} className={`qa-metric qa-metric--${metric.tone}`}>
            <span>{metric.label}</span>
            <strong>{totals[metric.key] ?? 0}</strong>
          </div>
        ))}
      </div>

      <div className="qa-two-column">
        <div>
          <h3>
            <AlertTriangle size={16} aria-hidden="true" /> Findings by issue code
          </h3>
          {report.issueSummary.length === 0 ? (
            <p className="qa-no-issues">
              <CheckCircle2 size={16} aria-hidden="true" /> No findings for this page and viewport selection.
            </p>
          ) : (
            <ul className="qa-issue-summary-list">
              {report.issueSummary.map((issue) => (
                <li key={issue.code} className={`qa-issue-summary qa-issue-summary--${issue.severity}`}>
                  <div>
                    <code>{issue.code}</code>
                    <span>{issue.label}</span>
                  </div>
                  <p>
                    <strong>{issue.count}</strong> finding{issue.count === 1 ? '' : 's'} at{' '}
                    {issue.viewports.join(', ')}. {issue.remediation}
                  </p>
                  <p className="qa-issue-source">Source: {issue.source}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3>
            <Sparkles size={16} aria-hidden="true" /> AI and data guardrails
          </h3>
          <div className="qa-guardrail">
            <p>
              No AI provider is called by this workspace. The long-title and multilingual fixture strings are
              generated locally and labelled as <strong>suggestions</strong> until a reviewer confirms them.
            </p>
            <p>
              Deterministic code performs measurements, sorting, filtering, permissions and export shaping. A
              low-confidence suggestion is routed to review rather than applied.
            </p>
            <p>
              Sources and the data version used for every generated explanation are shown below. This workspace
              never presents a fixture as an official rule or government decision.
            </p>
          </div>

          <h3>
            <GitCompareArrows size={16} aria-hidden="true" /> Screenshot baseline comparison
          </h3>
          {!comparison ? (
            <p className="qa-no-issues">
              No saved baseline. Set the current deterministic snapshot as a baseline, then rerun a scan to compare
              changed titles, metadata and issue codes.
            </p>
          ) : !comparison.ok ? (
            <p className="qa-no-issues">The saved baseline could not be read: {comparison.errors[0]?.reason}</p>
          ) : (
            <div className="qa-comparison">
              <p>
                {comparison.identical
                  ? 'Current scan is identical to the saved baseline.'
                  : `${comparison.summary.added} added, ${comparison.summary.removed} removed, ${comparison.summary.changed} changed, ${comparison.summary.unchanged} unchanged.`}
              </p>
              {comparison.changed.length > 0 && (
                <ul>
                  {comparison.changed.slice(0, 6).map((row) => (
                    <li key={row.key}>
                      <code>{row.key}</code>: baseline [{row.baseline.issues.join(', ')}] → current [
                      {row.current.issues.join(', ')}]
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <h3>
            <ShieldCheck size={16} aria-hidden="true" /> Source references
          </h3>
          <ul className="qa-source-list">
            {report.sources.map((source) => (
              <li key={source.id}>
                <strong>{source.label}</strong>
                <span>
                  <code>{source.path}</code> · {source.version}
                </span>
                <p>{source.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="qa-private-progress">
        <ShieldCheck size={15} aria-hidden="true" /> {report.privateProgressNote}
      </p>
    </section>
  );
}
