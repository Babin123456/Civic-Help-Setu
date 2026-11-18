import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Pencil,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import {
  DATA_QUALITY,
  RECOMMENDATION_STATUS,
  RECOMMENDATION_STATUS_LABELS,
} from '../../services/ghgInventoryConstants.js';
import { GhgEmptyState, GhgStatusBadge } from './GhgInventoryStates.jsx';

const statusTone = {
  [RECOMMENDATION_STATUS.PENDING]: 'warning',
  [RECOMMENDATION_STATUS.EDITED]: 'info',
  [RECOMMENDATION_STATUS.ACCEPTED]: 'success',
  [RECOMMENDATION_STATUS.REJECTED]: 'neutral',
};

const number = (value, digits = 4) =>
  Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: digits });

export default function GhgRecommendationsPanel({
  recommendations,
  onDecide,
  busy = false,
  canDecide = false,
}) {
  const [drafts, setDrafts] = useState({});
  const [errors, setErrors] = useState({});

  const draftFor = (id) => drafts[id] || { reason: '', estimatedQuantity: '' };

  const updateDraft = (id, patch) => {
    setDrafts((current) => ({ ...current, [id]: { ...draftFor(id), ...patch } }));
    setErrors((current) => ({ ...current, [id]: null }));
  };

  const decide = (recommendation, action) => {
    const draft = draftFor(recommendation.id);
    if (draft.reason.trim().length < 10) {
      setErrors((current) => ({
        ...current,
        [recommendation.id]: 'Explain the decision in at least 10 characters so the estimate stays human-controlled and auditable.',
      }));
      return;
    }
    const payload = { reason: draft.reason.trim() };
    if (action === 'edit') {
      const quantity = Number(draft.estimatedQuantity || recommendation.estimatedQuantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setErrors((current) => ({
          ...current,
          [recommendation.id]: 'Enter a positive estimated activity quantity.',
        }));
        return;
      }
      payload.estimatedQuantity = quantity;
    }
    onDecide?.(recommendation.id, action, payload);
    setDrafts((current) => ({ ...current, [recommendation.id]: { reason: '', estimatedQuantity: '' } }));
  };

  if (!recommendations.length) {
    return (
      <GhgEmptyState
        title="No estimation recommendations"
        message="Generate estimates for sources that have no activity in the selected period. Every suggestion needs a reviewer decision before it can enter the totals."
      />
    );
  }

  return (
    <section aria-labelledby="ghg-recommendations-heading" style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <h2 id="ghg-recommendations-heading" style={{ margin: 0, fontSize: '1.15rem' }}>
          Estimated totals &amp; human decisions
        </h2>
        <p style={{ margin: '0.3rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          <AlertTriangle size={13} aria-hidden="true" /> A recommendation is not data. It is a
          deterministic suggestion built from prior approved periods, and it only becomes a labelled
          estimated record after a reviewer accepts it. Measured data is never replaced.
        </p>
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.9rem' }}>
        {recommendations.map((recommendation) => {
          const decisionOpen =
            canDecide &&
            [RECOMMENDATION_STATUS.PENDING, RECOMMENDATION_STATUS.EDITED].includes(
              recommendation.status
            );
          const draft = draftFor(recommendation.id);
          const error = errors[recommendation.id];
          return (
            <li
              key={recommendation.id}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-main)',
                borderRadius: '0.75rem',
                padding: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{recommendation.sourceName}</h3>
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {recommendation.department} · {recommendation.categoryLabel} · method{' '}
                    {recommendation.method} · ruleset {recommendation.rulesetVersion}
                  </p>
                </div>
                <GhgStatusBadge
                  label={RECOMMENDATION_STATUS_LABELS[recommendation.status] || recommendation.status}
                  tone={statusTone[recommendation.status] || 'neutral'}
                  icon={recommendation.status === RECOMMENDATION_STATUS.ACCEPTED ? CheckCircle2 : TrendingUp}
                />
              </div>

              <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem', margin: '0.8rem 0 0', fontSize: '0.82rem' }}>
                <div>
                  <dt style={{ fontWeight: 700 }}>Suggested activity</dt>
                  <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>
                    {number(recommendation.estimatedQuantity)} {recommendation.activityUnit}
                  </dd>
                </div>
                <div>
                  <dt style={{ fontWeight: 700 }}>Suggested emissions</dt>
                  <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>
                    {number(recommendation.estimateTCO2e)} tCO2e
                  </dd>
                </div>
                <div>
                  <dt style={{ fontWeight: 700 }}>Factor version</dt>
                  <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>{recommendation.factorVersionId}</dd>
                </div>
                <div>
                  <dt style={{ fontWeight: 700 }}>Uncertainty</dt>
                  <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>
                    {recommendation.uncertaintyPercent == null ? 'Not stated' : `±${recommendation.uncertaintyPercent}%`}
                  </dd>
                </div>
                <div>
                  <dt style={{ fontWeight: 700 }}>Feature window</dt>
                  <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>
                    {recommendation.featureWindow?.periodCount || 0} prior period(s)
                    {recommendation.featureWindow?.fromPeriodId
                      ? ` · ${recommendation.featureWindow.fromPeriodId} → ${recommendation.featureWindow.toPeriodId}`
                      : ''}
                  </dd>
                </div>
                <div>
                  <dt style={{ fontWeight: 700 }}>Quality label after acceptance</dt>
                  <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>
                    <GhgStatusBadge label="Estimated (not measured)" tone="warning" icon={AlertTriangle} />
                  </dd>
                </div>
              </dl>

              <p style={{ margin: '0.8rem 0 0', fontSize: '0.82rem', lineHeight: 1.55 }}>
                {recommendation.explanation}
              </p>

              <details style={{ marginTop: '0.55rem', fontSize: '0.78rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Source fields behind this estimate</summary>
                <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
                  {(recommendation.sourceFields || []).map((field) => (
                    <li key={field}><code>{field}</code></li>
                  ))}
                </ul>
                <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary)' }}>
                  Quality after acceptance: {DATA_QUALITY.ESTIMATED}. The original measured history is
                  unchanged and remains available for audit.
                </p>
              </details>

              {recommendation.decision && (
                <div style={{ marginTop: '0.75rem', padding: '0.65rem', borderRadius: '0.55rem', background: 'var(--bg-secondary)', fontSize: '0.8rem' }}>
                  <strong>Decision:</strong> {recommendation.decision.action} by{' '}
                  {recommendation.decision.actorRole} on{' '}
                  {new Date(recommendation.decision.decidedAt).toLocaleString()}.
                  <span style={{ display: 'block', color: 'var(--text-secondary)' }}>
                    Reason: {recommendation.decision.reason}
                  </span>
                </div>
              )}

              {decisionOpen && (
                <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    <label
                      htmlFor={`ghg-rec-reason-${recommendation.id}`}
                      style={{ fontSize: '0.8rem', fontWeight: 700 }}
                    >
                      Decision reason (required)
                    </label>
                    <textarea
                      id={`ghg-rec-reason-${recommendation.id}`}
                      value={draft.reason}
                      onChange={(event) => updateDraft(recommendation.id, { reason: event.target.value })}
                      rows={2}
                      placeholder="Explain why this estimate is acceptable or must be rejected."
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `ghg-rec-error-${recommendation.id}` : undefined}
                      style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                    />
                    {error && (
                      <p id={`ghg-rec-error-${recommendation.id}`} role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: '0.78rem' }}>
                        {error}
                      </p>
                    )}
                    <label
                      htmlFor={`ghg-rec-quantity-${recommendation.id}`}
                      style={{ fontSize: '0.8rem', fontWeight: 700 }}
                    >
                      Edited quantity ({recommendation.activityUnit}) — optional before accepting
                    </label>
                    <input
                      id={`ghg-rec-quantity-${recommendation.id}`}
                      type="number"
                      min="0"
                      step="any"
                      value={draft.estimatedQuantity}
                      onChange={(event) => updateDraft(recommendation.id, { estimatedQuantity: event.target.value })}
                      placeholder={String(recommendation.estimatedQuantity)}
                      style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.82rem', maxWidth: '220px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
                    <button type="button" className="btn btn-primary" onClick={() => decide(recommendation, 'accept')} disabled={busy} style={{ fontSize: '0.8rem' }}>
                      <CheckCircle2 size={14} aria-hidden="true" /> Accept as estimated
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => decide(recommendation, 'edit')} disabled={busy} style={{ fontSize: '0.8rem' }}>
                      <Pencil size={14} aria-hidden="true" /> Save edited estimate
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => decide(recommendation, 'reject')} disabled={busy} style={{ fontSize: '0.8rem' }}>
                      <XCircle size={14} aria-hidden="true" /> Reject estimate
                    </button>
                  </div>
                </div>
              )}

              {!canDecide && [RECOMMENDATION_STATUS.PENDING, RECOMMENDATION_STATUS.EDITED].includes(recommendation.status) && (
                <p style={{ margin: '0.7rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  A reviewer or administrator must decide this recommendation. Switch to that role
                  perspective to accept, edit or reject it.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
