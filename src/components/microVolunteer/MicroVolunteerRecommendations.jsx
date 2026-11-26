import { useState } from 'react';
import { AlertTriangle, Check, Pencil, Sparkles, X } from 'lucide-react';
import {
  MICRO_VOLUNTEER_LIMITS,
  RECOMMENDATION_STATUS,
} from '../../data/microVolunteerContract.js';
import {
  MicroVolunteerEmptyState,
  MicroVolunteerLoadingButton,
  MicroVolunteerStatusBadge,
} from './MicroVolunteerStates.jsx';
import { formatDate, formatDateTime, formatMinutes } from './presentation.js';

export default function MicroVolunteerRecommendations({
  categories,
  jurisdictions,
  run,
  busy,
  error,
  onGenerate,
  onDecide,
}) {
  const [categoryIds, setCategoryIds] = useState([]);
  const [jurisdictionId, setJurisdictionId] = useState('');
  const [availableMinutes, setAvailableMinutes] = useState('');
  const [editingRef, setEditingRef] = useState(null);
  const [editedCategoryId, setEditedCategoryId] = useState('');
  const [rejectingRef, setRejectingRef] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const toggleCategory = (id) => {
    setCategoryIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const generate = (event) => {
    event.preventDefault();
    onGenerate({
      categoryIds,
      jurisdictionId: jurisdictionId || null,
      availableMinutes: availableMinutes ? Number(availableMinutes) : null,
    });
  };

  const submitEdit = (taskPublicRef) => {
    if (!editedCategoryId) return;
    onDecide(run.runPublicRef, taskPublicRef, {
      decision: 'edit',
      editedCategoryId,
      reason: 'Contributor changed the suggested category.',
    });
    setEditingRef(null);
    setEditedCategoryId('');
  };

  const submitReject = (taskPublicRef) => {
    onDecide(run.runPublicRef, taskPublicRef, {
      decision: 'reject',
      reason: rejectReason || 'Not suitable for me right now.',
    });
    setRejectingRef(null);
    setRejectReason('');
  };

  return (
    <section aria-labelledby="mv-recommendations-heading">
      <h2 id="mv-recommendations-heading">Explainable suggestions</h2>
      <p className="mv-muted">
        Suggestions use a published, deterministic ruleset. There is no opaque volunteer score and no
        public ranking. You can accept, edit or reject every suggestion; nothing is assigned
        automatically.
      </p>

      <form className="mv-card" onSubmit={generate} style={{ marginBottom: '1rem' }}>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 700, marginBottom: '0.5rem' }}>What would you like to do?</legend>
          <div className="mv-inline-actions" style={{ marginBottom: '0.75rem' }}>
            {categories.map((category) => (
              <label key={category.id} className="mv-small" style={{ display: 'inline-flex', gap: '0.35rem' }}>
                <input
                  type="checkbox"
                  checked={categoryIds.includes(category.id)}
                  onChange={() => toggleCategory(category.id)}
                />
                {category.shortLabel || category.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mv-filters">
          <div className="mv-field">
            <label htmlFor="mv-rec-jurisdiction">Ward or locality</label>
            <select
              id="mv-rec-jurisdiction"
              className="mv-select"
              value={jurisdictionId}
              onChange={(event) => setJurisdictionId(event.target.value)}
            >
              <option value="">Any jurisdiction</option>
              {jurisdictions.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
          <div className="mv-field">
            <label htmlFor="mv-rec-minutes">Time available (minutes)</label>
            <input
              id="mv-rec-minutes"
              className="mv-input"
              type="number"
              min="5"
              max="480"
              step="5"
              value={availableMinutes}
              onChange={(event) => setAvailableMinutes(event.target.value)}
            />
          </div>
        </div>

        <MicroVolunteerLoadingButton className="mv-button" loading={busy} type="submit">
          <Sparkles size={16} aria-hidden="true" /> Generate suggestions
        </MicroVolunteerLoadingButton>
      </form>

      {error && (
        <p className="mv-error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" /> {error}
        </p>
      )}

      {!run ? (
        <MicroVolunteerEmptyState
          title="No suggestions generated yet"
          description="Choose your interests and available time, then generate a fresh, explainable set."
        />
      ) : run.recommendations.length === 0 ? (
        <MicroVolunteerEmptyState
          title="No matching tasks right now"
          description="Every open task was outside your selected categories, ward or time window. Try widening the filters."
        />
      ) : (
        <div className="mv-list">
          <div className="mv-card">
            <p className="mv-small mv-muted" style={{ margin: 0 }}>
              Ruleset {run.rulesetVersion} · generated {formatDateTime(run.generatedAt)} · evaluated{' '}
              {run.inputWindow?.dueOnOrAfter ? `from ${formatDate(run.inputWindow.dueOnOrAfter)}` : 'now'}
            </p>
            <p className="mv-small mv-muted" style={{ margin: '0.35rem 0 0' }}>
              Source fields: {run.sourceFields.join(', ')}
            </p>
          </div>
          {run.recommendations.map((item) => (
            <article className="mv-card" key={item.taskPublicRef}>
              <div className="mv-inline-actions" style={{ justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>{item.title}</h3>
                <MicroVolunteerStatusBadge
                  status={item.status}
                  label={item.statusLabel}
                  tone={
                    item.status === RECOMMENDATION_STATUS.PENDING
                      ? 'accent'
                      : item.status === RECOMMENDATION_STATUS.REJECTED
                        ? 'danger'
                        : 'success'
                  }
                />
              </div>
              <p className="mv-small mv-muted">
                {item.taskPublicRef} · {item.categoryLabel} · {item.jurisdictionId} ·{' '}
                {formatMinutes(item.timeEstimateMinutes)} · due {formatDate(item.dueDate)} · match score{' '}
                {item.score}
              </p>
              <h4 style={{ marginBottom: '0.25rem' }}>Why this was suggested</h4>
              <ul>
                {item.reasons.map((reason) => (
                  <li key={`${item.taskPublicRef}-${reason.code}`}>
                    {reason.label} <span className="mv-small mv-muted">(+{reason.points})</span>
                  </li>
                ))}
              </ul>

              {item.status === RECOMMENDATION_STATUS.PENDING && (
                <div className="mv-inline-actions">
                  <button
                    type="button"
                    className="mv-button"
                    onClick={() =>
                      onDecide(run.runPublicRef, item.taskPublicRef, {
                        decision: 'accept',
                        reason: 'Contributor accepted the suggestion.',
                      })
                    }
                    disabled={busy}
                  >
                    <Check size={16} aria-hidden="true" /> Accept
                  </button>
                  <button
                    type="button"
                    className="mv-button mv-button-secondary"
                    onClick={() => {
                      setEditingRef(item.taskPublicRef);
                      setEditedCategoryId(item.categoryId);
                    }}
                    disabled={busy}
                  >
                    <Pencil size={16} aria-hidden="true" /> Edit category
                  </button>
                  <button
                    type="button"
                    className="mv-button mv-button-secondary"
                    onClick={() => setRejectingRef(item.taskPublicRef)}
                    disabled={busy}
                  >
                    <X size={16} aria-hidden="true" /> Reject
                  </button>
                </div>
              )}

              {editingRef === item.taskPublicRef && (
                <div style={{ marginTop: '0.6rem' }}>
                  <div className="mv-field">
                    <label htmlFor={`mv-edit-${item.taskPublicRef}`}>Preferred category</label>
                    <select
                      id={`mv-edit-${item.taskPublicRef}`}
                      className="mv-select"
                      value={editedCategoryId}
                      onChange={(event) => setEditedCategoryId(event.target.value)}
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mv-inline-actions">
                    <button type="button" className="mv-button" onClick={() => submitEdit(item.taskPublicRef)}>
                      Save edit
                    </button>
                    <button
                      type="button"
                      className="mv-button mv-button-secondary"
                      onClick={() => setEditingRef(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {rejectingRef === item.taskPublicRef && (
                <div style={{ marginTop: '0.6rem' }}>
                  <div className="mv-field">
                    <label htmlFor={`mv-reject-${item.taskPublicRef}`}>Why are you rejecting this?</label>
                    <input
                      id={`mv-reject-${item.taskPublicRef}`}
                      className="mv-input"
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      maxLength={MICRO_VOLUNTEER_LIMITS.MAX_MODERATION_REASON_LENGTH}
                    />
                  </div>
                  <div className="mv-inline-actions">
                    <button
                      type="button"
                      className="mv-button mv-button-danger"
                      onClick={() => submitReject(item.taskPublicRef)}
                    >
                      Confirm rejection
                    </button>
                    <button
                      type="button"
                      className="mv-button mv-button-secondary"
                      onClick={() => setRejectingRef(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {item.decision && (
                <p className="mv-small mv-muted">
                  Your decision: {item.decision.decision}
                  {item.decision.editedCategoryId ? ` → ${item.decision.editedCategoryId}` : ''} on{' '}
                  {formatDateTime(item.decision.decidedAt)}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
