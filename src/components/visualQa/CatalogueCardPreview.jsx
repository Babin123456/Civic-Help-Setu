import ServiceCard from '../ServiceCard';

const severityLabel = {
  error: 'Error',
  warning: 'Warning',
  review: 'Needs review',
  info: 'Information',
};

const statusLabel = {
  suggested: 'Suggested',
  needs_review: 'Needs review',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
  none: 'None',
};

const describeMeasured = (issue) => {
  const measured = issue.measured || {};
  if (measured.value === null || measured.value === undefined) return 'Not present';
  if (typeof measured.value === 'number' && measured.limit !== undefined) {
    return `${measured.value} ${measured.unit || ''} (limit ${measured.limit} ${measured.unit || ''})`.trim();
  }
  return `${measured.value} ${measured.unit || ''}`.trim();
};

/**
 * One synthetic card at one named viewport. The real ServiceCard markup is used
 * so a regression in the production card is visible here. The dashed boxes and
 * markers are decorative: every finding is repeated as text in the issue list and
 * in the page-level accessible table, so nothing depends on hover or colour.
 */
export default function CatalogueCardPreview({ card, viewport, showBoxes = true }) {
  if (!card || !viewport) return null;
  const service = card.service;
  const measurements = card.measurements;
  const titleTop = measurements.cardPadding + 58;
  const titleHeight = Math.max(1, measurements.title.estimatedLines) * 28;
  const descriptionTop = titleTop + titleHeight + 12;
  const suggestionStatus = card.suggestionStatus || 'none';

  return (
    <article
      className="qa-card-shell"
      aria-label={`${service.name || 'Untitled synthetic fixture'} at ${viewport.label}`}
      data-fixture-id={card.fixtureId}
    >
      <div className="qa-card-shell-heading">
        <span className="qa-card-shell-label">Synthetic card fixture</span>
        <span className="qa-fixture-code">{card.fixtureId}</span>
      </div>

      <div
        className="qa-card-frame"
        style={{ width: `${measurements.cardWidth}px`, maxWidth: '100%' }}
        data-viewport={viewport.id}
      >
        <ServiceCard service={service} previewMode />
        {showBoxes && (
          <div aria-hidden="true" className="qa-overlay">
            <span className="qa-box qa-box--card" />
            <span
              className="qa-box qa-box--content"
              style={{ inset: `${measurements.cardPadding}px` }}
            />
            <span
              className="qa-box qa-box--title"
              style={{
                left: `${measurements.cardPadding}px`,
                right: `${measurements.cardPadding}px`,
                top: `${titleTop}px`,
                height: `${Math.min(titleHeight, measurements.cardWidth)}px`,
              }}
            />
            <span
              className="qa-box qa-box--description"
              style={{
                left: `${measurements.cardPadding}px`,
                right: `${measurements.cardPadding}px`,
                top: `${descriptionTop}px`,
                height: `${Math.max(20, Math.min(measurements.description.estimatedLines, 3) * 23)}px`,
              }}
            />
            <span
              className="qa-box qa-box--department"
              style={{
                left: `${measurements.cardPadding}px`,
                right: `${measurements.cardPadding}px`,
                top: `${measurements.cardPadding + 32}px`,
                height: '20px',
              }}
            />
            <div className="qa-markers">
              {card.issues.slice(0, 4).map((issue, index) => (
                <span
                  key={`${issue.code}-${index}`}
                  className={`qa-marker qa-marker--${issue.severity}`}
                  title={`${issue.code}: ${issue.label}`}
                >
                  {issue.code}
                </span>
              ))}
              {card.issues.length > 4 && (
                <span className="qa-marker qa-marker--more">+{card.issues.length - 4}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="qa-card-meta" aria-label="Synthetic fixture metadata">
        <span>
          <strong>Viewport:</strong> {viewport.label} ({viewport.width}px, {viewport.columns} column
          {viewport.columns === 1 ? '' : 's'})
        </span>
        <span>
          <strong>Docs:</strong> {service.qa?.documentCount ?? 0}
          {service.qa?.documentLabel ? ` · ${service.qa.documentLabel}` : ''}
        </span>
        <span>
          <strong>Record status:</strong> {service.qa?.statusLabel || service.publicationState || 'unknown'}
        </span>
        <span>
          <strong>Content:</strong> {service.qa?.contentLength || 'short'} · {service.qa?.language || 'en'}
        </span>
        <span className={`qa-suggestion-status qa-suggestion-status--${suggestionStatus}`}>
          <strong>Fixture text:</strong> {statusLabel[suggestionStatus] || suggestionStatus}
        </span>
      </div>

      <div className="qa-card-issues">
        <h5>Detected layout findings at {viewport.label}</h5>
        {card.issues.length === 0 ? (
          <p className="qa-no-issues">No overflow or missing-metadata warning at this viewport.</p>
        ) : (
          <ul>
            {card.issues.map((issue) => (
              <li key={`${issue.code}-${issue.field}`} className={`qa-issue qa-issue--${issue.severity}`}>
                <div className="qa-issue-heading">
                  <span className="qa-severity">{severityLabel[issue.severity] || issue.severity}</span>
                  <code>{issue.code}</code>
                  <span>{issue.label}</span>
                </div>
                <p>{issue.message}</p>
                <p className="qa-issue-measure">
                  Measured: {describeMeasured(issue)} · confidence {Math.round((issue.confidence || 0) * 100)}%
                </p>
                <p className="qa-issue-remediation">
                  <strong>Suggested action:</strong> {issue.remediation}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
