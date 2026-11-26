import { Check, MessageSquareText, ShieldQuestion, X } from 'lucide-react';

const statusLabel = {
  suggested: 'Suggested (not applied)',
  needs_review: 'Needs review (not applied)',
  confirmed: 'Confirmed by reviewer',
  rejected: 'Rejected by reviewer',
};

/**
 * Fixture-text suggestions are synthetic long-title / multilingual stress strings.
 * They are shown as suggestions, never as official text, and only an explicit
 * reviewer decision changes their status. The scan re-measures a confirmed string.
 */
export default function SuggestionReviewPanel({ cards = [], decisions = {}, onDecide, disabled = false }) {
  const seen = new Set();
  const suggestions = cards
    .filter((card) => {
      if (seen.has(card.fixtureId)) return false;
      seen.add(card.fixtureId);
      return Boolean(card.service?.suggestion);
    })
    .map((card) => ({
      fixtureId: card.fixtureId,
      status: card.suggestionStatus,
      suggestion: card.service.suggestion,
      language: card.service.qa?.language || 'en',
    }));

  return (
    <section className="qa-suggestions" aria-labelledby="qa-suggestions-heading">
      <div className="qa-section-heading">
        <div>
          <h2 id="qa-suggestions-heading">
            <MessageSquareText size={18} aria-hidden="true" /> Fixture-text suggestions
          </h2>
          <p>
            Synthetic long-title and multilingual stress text is labelled as a suggestion until you confirm or
            reject it. No production catalogue content is changed. Low-confidence text is routed to review
            instead of being applied.
          </p>
        </div>
        <span className="qa-row-count">{suggestions.length} suggestions</span>
      </div>

      {suggestions.length === 0 ? (
        <p className="qa-no-issues">No fixture-text suggestions on this page.</p>
      ) : (
        <ul className="qa-suggestion-list">
          {suggestions.map(({ fixtureId, status, suggestion, language }) => (
            <li key={suggestion.id} className={`qa-suggestion qa-suggestion--${status}`}>
              <div className="qa-suggestion-head">
                <span className="qa-suggestion-badge">{statusLabel[status] || status}</span>
                <code>{fixtureId}</code>
                <span>
                  Confidence {Math.round((suggestion.confidence || 0) * 100)}% · {language} ·{' '}
                  {suggestion.dataVersion}
                </span>
              </div>
              <p className="qa-suggestion-text">{suggestion.text}</p>
              <p>
                <strong>Why this is synthetic:</strong> {suggestion.rationale}
              </p>
              <p className="qa-issue-source">
                Source: {suggestion.sourceRefs.join(', ')} · generator {suggestion.generatedBy}
              </p>
              <div className="qa-control-actions">
                <button
                  type="button"
                  className="qa-button qa-button--primary"
                  disabled={disabled || status === 'confirmed'}
                  onClick={() => onDecide(suggestion.id, 'confirmed', fixtureId)}
                  aria-label={`Confirm synthetic fixture text for ${fixtureId}`}
                >
                  <Check size={15} aria-hidden="true" /> Confirm suggestion
                </button>
                <button
                  type="button"
                  className="qa-button"
                  disabled={disabled || status === 'rejected'}
                  onClick={() => onDecide(suggestion.id, 'rejected', fixtureId)}
                  aria-label={`Reject synthetic fixture text for ${fixtureId}`}
                >
                  <X size={15} aria-hidden="true" /> Reject suggestion
                </button>
                {status === 'needs_review' && (
                  <span className="qa-review-flag">
                    <ShieldQuestion size={15} aria-hidden="true" /> Routed to review, not applied
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="qa-suggestion-count">
        Confirmed: {Object.values(decisions).filter((value) => value === 'confirmed').length} · Rejected:{' '}
        {Object.values(decisions).filter((value) => value === 'rejected').length}
      </p>
    </section>
  );
}
