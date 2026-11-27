import { useState } from 'react';
import { AlertTriangle, Bot, CheckCircle2, Edit3, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import {
  TREE_CONDITIONS,
  TREE_CONDITION_LABELS,
  TRIAGE_DECISIONS,
  TRIAGE_DECISION_LABELS,
} from '../../services/treeInventoryConstants';
import { TreeInventoryEmptyState, TreeStatusBadge } from './TreeInventoryStates';

const tableWrap = { overflowX: 'auto', border: '1px solid var(--border-main)', borderRadius: '0.7rem' };
const thStyle = { textAlign: 'left', padding: '0.55rem 0.7rem', fontSize: '0.78rem', whiteSpace: 'nowrap' };
const tdStyle = { padding: '0.55rem 0.7rem', fontSize: '0.82rem', verticalAlign: 'top' };
const fieldStyle = { display: 'grid', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 700 };
const errorStyle = { color: 'var(--error, #ef4444)', fontSize: '0.77rem', fontWeight: 500 };

const TONE_BY_DECISION = {
  [TRIAGE_DECISIONS.PENDING]: 'due_soon',
  [TRIAGE_DECISIONS.ACCEPTED]: 'success',
  [TRIAGE_DECISIONS.EDITED]: 'success',
  [TRIAGE_DECISIONS.REJECTED]: 'unknown',
};

const formatDateTime = (value) => {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString('en-IN') : 'Unknown';
};

/**
 * Human-in-the-loop review of image-assisted triage. The suggestion is shown
 * with its ruleset/model versions, input window and explanations; nothing is
 * applied until a named arborist, reviewer or administrator decides.
 */
export default function TreeTriageReviewPanel({
  suggestions,
  filters = {},
  onFiltersChange,
  onReview,
  onRefresh,
  canReview = false,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [decision, setDecision] = useState(TRIAGE_DECISIONS.ACCEPTED);
  const [editedCondition, setEditedCondition] = useState(TREE_CONDITIONS.FAIR);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});

  const items = suggestions?.items || [];
  const selected = items.find((item) => item.id === selectedId) || null;

  const selectSuggestion = (item) => {
    setSelectedId(item.id);
    setDecision(TRIAGE_DECISIONS.ACCEPTED);
    setEditedCondition(item.suggestion?.suggestedCondition || TREE_CONDITIONS.FAIR);
    setReason('');
    setErrors({});
  };

  const handleReview = (event) => {
    event.preventDefault();
    if (!selected) return;
    const nextErrors = {};
    if (decision !== TRIAGE_DECISIONS.ACCEPTED && reason.trim().length < 5) {
      nextErrors.reason = 'A short reason is required when editing or rejecting.';
    }
    if (decision === TRIAGE_DECISIONS.EDITED && !Object.values(TREE_CONDITIONS).includes(editedCondition)) {
      nextErrors.editedCondition = 'Choose a valid condition.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onReview?.(selected.id, {
      decision,
      editedCondition: decision === TRIAGE_DECISIONS.EDITED ? editedCondition : undefined,
      reason: reason.trim() || undefined,
    });
  };

  return (
    <section aria-labelledby="tree-triage-heading" style={{ display: 'grid', gap: '0.9rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'center' }}>
        <div>
          <h2 id="tree-triage-heading" style={{ margin: 0, fontSize: '1.1rem' }}>
            Image-assisted triage review
          </h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            Suggestions are advisory only. A named expert must accept, edit or reject each one; no suggestion can prune,
            remove, redesignate risk or deny a service.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onRefresh}>
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.7rem' }}>
        <label style={fieldStyle}>
          Review decision
          <select
            className="form-input"
            value={filters.decision || ''}
            onChange={(event) => onFiltersChange?.({ ...filters, decision: event.target.value, page: 1 })}
          >
            <option value="">All suggestions</option>
            {Object.values(TRIAGE_DECISIONS).map((value) => (
              <option key={value} value={value}>{TRIAGE_DECISION_LABELS[value]}</option>
            ))}
          </select>
        </label>
      </div>

      {items.length === 0 ? (
        <TreeInventoryEmptyState
          title="No triage suggestions in this view"
          message="A suggestion is created when staff request optional triage from an inspection or report form."
        />
      ) : (
        <div style={tableWrap} tabIndex={0} aria-label="Scrollable triage suggestion table">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
            <caption style={{ textAlign: 'left', padding: '0.6rem 0.75rem', fontWeight: 800 }}>
              Automated suggestions and their human review decisions
            </caption>
            <thead>
              <tr style={{ background: 'var(--glass-bg)' }}>
                {['Tree', 'Suggestion', 'Confidence', 'Ruleset / model', 'Created', 'Decision', 'Actions'].map((header) => (
                  <th key={header} scope="col" style={thStyle}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                  <th scope="row" style={{ ...tdStyle, fontWeight: 700 }}>
                    {item.treePublicId || 'Tree record'}
                    <span style={{ display: 'block', fontWeight: 400, color: 'var(--text-tertiary)' }}>
                      {item.suggestion?.isFallback ? 'Deterministic fallback' : 'External model'}
                    </span>
                  </th>
                  <td style={tdStyle}>
                    {TREE_CONDITION_LABELS[item.suggestion?.suggestedCondition] || item.suggestion?.suggestedCondition}
                    <span style={{ display: 'block', color: 'var(--text-tertiary)' }}>Risk: {item.suggestion?.suggestedRisk}</span>
                  </td>
                  <td style={tdStyle}>{item.suggestion?.confidence || 'low'}</td>
                  <td style={{ ...tdStyle, maxWidth: '24ch' }}>
                    <span style={{ display: 'block' }}>{item.suggestion?.rulesetVersion}</span>
                    <span style={{ display: 'block', color: 'var(--text-tertiary)' }}>{item.suggestion?.modelVersion}</span>
                  </td>
                  <td style={tdStyle}>{formatDateTime(item.createdAt)}</td>
                  <td style={tdStyle}>
                    <TreeStatusBadge
                      tone={TONE_BY_DECISION[item.decision] || 'neutral'}
                      label={item.decisionLabel}
                      prefix="Review"
                    />
                  </td>
                  <td style={tdStyle}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.76rem' }}
                      onClick={() => selectSuggestion(item)}
                      aria-expanded={selectedId === item.id}
                    >
                      {selectedId === item.id ? 'Hide detail' : 'Open detail'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div style={{ display: 'grid', gap: '0.75rem', border: '1px solid var(--border-main)', borderRadius: '0.85rem', padding: '0.9rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '0.98rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <Bot size={16} aria-hidden="true" /> Suggestion for {selected.treePublicId}
            </h3>
            <TreeStatusBadge tone={TONE_BY_DECISION[selected.decision] || 'neutral'} label={selected.decisionLabel} prefix="Review" />
          </div>

          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem', margin: 0, fontSize: '0.82rem' }}>
            <div>
              <dt style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>Suggested condition</dt>
              <dd style={{ margin: 0 }}>
                {TREE_CONDITION_LABELS[selected.suggestion?.suggestedCondition] || selected.suggestion?.suggestedCondition}
              </dd>
            </div>
            <div>
              <dt style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>Suggested risk context</dt>
              <dd style={{ margin: 0 }}>{selected.suggestion?.suggestedRisk}</dd>
            </div>
            <div>
              <dt style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>Confidence</dt>
              <dd style={{ margin: 0 }}>{selected.suggestion?.confidence}</dd>
            </div>
            <div>
              <dt style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>Executed</dt>
              <dd style={{ margin: 0 }}>{formatDateTime(selected.suggestion?.executedAt)}</dd>
            </div>
            <div>
              <dt style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>Ruleset</dt>
              <dd style={{ margin: 0 }}>{selected.suggestion?.rulesetVersion}</dd>
            </div>
            <div>
              <dt style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>Model</dt>
              <dd style={{ margin: 0 }}>{selected.suggestion?.modelVersion}</dd>
            </div>
          </dl>

          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <p style={{ margin: '0 0 0.3rem' }}><strong>Rationale:</strong> {selected.suggestion?.rationale}</p>
            {selected.suggestion?.fallbackReason && (
              <p style={{ margin: '0 0 0.3rem' }}><strong>Fallback:</strong> {selected.suggestion.fallbackReason}</p>
            )}
            <p style={{ margin: '0 0 0.3rem' }}>
              <strong>Input window:</strong> fields used{' '}
              {(selected.suggestion?.inputWindow?.fieldsUsed || []).join(', ') || 'none'}. Image fingerprint{' '}
              {selected.suggestion?.inputWindow?.imageFingerprint || 'not recorded'}.
            </p>
            <div>
              <strong>Explanations</strong>
              <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem' }}>
                {(selected.explanation || []).map((item, index) => (
                  <li key={`${item.factor}-${index}`}>
                    <strong>{item.factor}</strong> ({item.influence}): {item.note}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div role="note" style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
            <AlertTriangle size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            Prohibited uses of this suggestion: {(selected.suggestion?.prohibitedUses || []).join(', ') || 'automatic decisions'}.
          </div>

          {canReview && selected.decision === TRIAGE_DECISIONS.PENDING && (
            <form onSubmit={handleReview} noValidate style={{ display: 'grid', gap: '0.6rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.7rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.92rem' }}>Record your expert decision</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.7rem' }}>
                <label style={fieldStyle}>
                  Decision
                  <select className="form-input" value={decision} onChange={(event) => setDecision(event.target.value)}>
                    <option value={TRIAGE_DECISIONS.ACCEPTED}>Accept the suggested condition</option>
                    <option value={TRIAGE_DECISIONS.EDITED}>Edit and accept a different condition</option>
                    <option value={TRIAGE_DECISIONS.REJECTED}>Reject the suggestion</option>
                  </select>
                </label>
                {decision === TRIAGE_DECISIONS.EDITED && (
                  <label style={fieldStyle}>
                    Corrected condition
                    <select className="form-input" value={editedCondition} onChange={(event) => setEditedCondition(event.target.value)}>
                      {Object.values(TREE_CONDITIONS).map((condition) => (
                        <option key={condition} value={condition}>{TREE_CONDITION_LABELS[condition]}</option>
                      ))}
                    </select>
                    {errors.editedCondition && <span style={errorStyle}>{errors.editedCondition}</span>}
                  </label>
                )}
              </div>
              <label style={fieldStyle}>
                Reason {decision === TRIAGE_DECISIONS.ACCEPTED ? '(optional)' : '(required)'}
                <textarea className="form-input" rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
                {errors.reason && <span style={errorStyle}>{errors.reason}</span>}
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="submit" className="btn btn-primary">
                  {decision === TRIAGE_DECISIONS.REJECTED ? (
                    <><XCircle size={14} aria-hidden="true" /> Reject suggestion</>
                  ) : decision === TRIAGE_DECISIONS.EDITED ? (
                    <><Edit3 size={14} aria-hidden="true" /> Save edited decision</>
                  ) : (
                    <><CheckCircle2 size={14} aria-hidden="true" /> Accept suggestion</>
                  )}
                </button>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', alignSelf: 'center' }}>
                  <ShieldCheck size={13} aria-hidden="true" /> This never changes risk or removal status.
                </span>
              </div>
            </form>
          )}

          {selected.decision !== TRIAGE_DECISIONS.PENDING && (
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Reviewed by {selected.reviewedBy} on {formatDateTime(selected.reviewedAt)}. Reason: {selected.reviewReason || 'none recorded'}.
              Applied condition: {selected.appliedCondition ? TREE_CONDITION_LABELS[selected.appliedCondition] : 'no change'}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
