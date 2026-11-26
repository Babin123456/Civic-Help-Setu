import { Table2 } from 'lucide-react';

const severityText = {
  pass: 'Pass',
  error: 'Error',
  warning: 'Warning',
  review: 'Needs review',
};

/**
 * The accessible, non-visual alternative to the card preview grid. This table is
 * always in the DOM (not hover-only and not a tooltip) so keyboard and screen
 * reader users can inspect the same findings as the visual markers.
 */
export default function VisualQaResultsTable({ rows, caption }) {
  return (
    <section className="qa-table-section" aria-labelledby="qa-table-heading">
      <div className="qa-section-heading">
        <div>
          <h2 id="qa-table-heading">
            <Table2 size={18} aria-hidden="true" /> Accessible scan results
          </h2>
          <p>
            {caption || 'Every synthetic fixture and viewport pair, with its findings and measured limits.'}
          </p>
        </div>
        <span className="qa-row-count">{rows.length} rows</span>
      </div>

      <div
        className="qa-table-wrap"
        role="region"
        aria-label="Scrollable visual QA results table"
        tabIndex={0}
      >
        <table className="qa-results-table">
          <caption>
            Synthetic card layout findings. Columns describe the fixture, the named viewport, metadata gaps,
            overflow findings, review state and suggested reviewer action.
          </caption>
          <thead>
            <tr>
              <th scope="col">Fixture</th>
              <th scope="col">Viewport</th>
              <th scope="col">Category / language</th>
              <th scope="col">Department</th>
              <th scope="col">Docs</th>
              <th scope="col">Record status</th>
              <th scope="col">Severity</th>
              <th scope="col">Issue codes</th>
              <th scope="col">Fixture-text suggestion</th>
              <th scope="col">Reviewer action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10}>No fixture / viewport rows on this page.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row">
                    <span>{row.title}</span>
                    <code>{row.fixtureId}</code>
                  </th>
                  <td>
                    {row.viewportLabel} <small>({row.viewport})</small>
                  </td>
                  <td>
                    {row.category} / {row.language} / {row.contentLength}
                  </td>
                  <td>{row.department || 'Missing'}</td>
                  <td>{row.documentCount}</td>
                  <td>{row.status || 'Unknown'}</td>
                  <td>
                    <span className={`qa-severity qa-severity--${row.severity}`}>
                      {severityText[row.severity] || row.severity}
                    </span>
                  </td>
                  <td>
                    {row.issueCodes.length === 0 ? (
                      'None'
                    ) : (
                      <ul className="qa-table-issues">
                        {row.issues.map((issue) => (
                          <li key={`${issue.code}-${issue.field}`}>{issue.code}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td>{row.suggestionStatus === 'none' ? 'None' : row.suggestionStatus}</td>
                  <td>
                    {row.issues.length === 0
                      ? 'No action required for this viewport.'
                      : row.issues.map((issue) => issue.remediation).join(' ')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
