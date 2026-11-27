import { useState } from 'react';
import { AlertTriangle, CheckCircle2, MessageSquareWarning, RotateCcw, XCircle } from 'lucide-react';
import {
  MICRO_VOLUNTEER_LIMITS,
  MODERATION_ACTIONS,
  MODERATION_ACTION_LABELS,
} from '../../data/microVolunteerContract.js';
import {
  MicroVolunteerEmptyState,
  MicroVolunteerLoadingButton,
  MicroVolunteerStatusBadge,
} from './MicroVolunteerStates.jsx';
import { COMPLETION_STATUS_TONE, formatDateTime } from './presentation.js';

const DECISION_META = {
  [MODERATION_ACTIONS.APPROVE]: { label: 'Approve', tone: 'mv-button', icon: CheckCircle2 },
  [MODERATION_ACTIONS.REQUEST_CHANGES]: {
    label: 'Request changes',
    tone: 'mv-button mv-button-secondary',
    icon: MessageSquareWarning,
  },
  [MODERATION_ACTIONS.REJECT]: { label: 'Reject', tone: 'mv-button mv-button-danger', icon: XCircle },
  [MODERATION_ACTIONS.REOPEN]: { label: 'Reopen', tone: 'mv-button mv-button-secondary', icon: RotateCcw },
};

function ModerationItem({ item, busy, onDecide }) {
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [publicOutcomeNote, setPublicOutcomeNote] = useState('');
  const [localError, setLocalError] = useState('');

  const submit = () => {
    setLocalError('');
    if (decision !== MODERATION_ACTIONS.APPROVE && reason.trim().length < MICRO_VOLUNTEER_LIMITS.MIN_MODERATION_REASON_LENGTH) {
      setLocalError('Explain the decision in at least 5 characters so the contributor can act on it.');
      return;
    }
    if (decision === MODERATION_ACTIONS.APPROVE && publicOutcomeNote.trim().length === 0) {
      setLocalError('Add a short public outcome so the board can show what was achieved.');
      return;
    }
    onDecide(item.submissionPublicRef, { decision, reason, publicOutcomeNote });
    setDecision(null);
    setReason('');
    setPublicOutcomeNote('');
  };

  return (
    <article className="mv-card" aria-labelledby={`mv-mod-${item.submissionPublicRef}`}>
      <div className="mv-inline-actions" style={{ justifyContent: 'space-between' }}>
        <MicroVolunteerStatusBadge
          status={item.status}
          label={item.statusLabel}
          tone={COMPLETION_STATUS_TONE[item.status] || 'neutral'}
        />
        <span className="mv-small mv-muted">{formatDateTime(item.submittedAt)}</span>
      </div>
      <h3 id={`mv-mod-${item.submissionPublicRef}`}>{item.taskTitle}</h3>
      <p className="mv-small mv-muted">
        {item.categoryLabel} · {item.jurisdictionId} · {item.contributorRef} ·{' '}
        {item.submissionPublicRef}
      </p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{item.note}</p>
      {item.link && (
        <p>
          <a href={item.link} target="_blank" rel="noreferrer noopener">
            Open submitted public link
          </a>
        </p>
      )}
      {item.files?.length > 0 && (
        <p className="mv-small mv-muted">
          {item.files.length} file metadata record(s):{' '}
          {item.files.map((file) => `${file.name} (${file.type || file.mimeType})`).join(', ')}
        </p>
      )}

      {localError && (
        <p className="mv-error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" /> {localError}
        </p>
      )}

      {!decision && (
        <div className="mv-inline-actions">
          {[MODERATION_ACTIONS.APPROVE, MODERATION_ACTIONS.REQUEST_CHANGES, MODERATION_ACTIONS.REJECT].map(
            (action) => {
              const meta = DECISION_META[action];
              const Icon = meta.icon;
              return (
                <button
                  key={action}
                  type="button"
                  className={meta.tone}
                  onClick={() => setDecision(action)}
                >
                  <Icon size={16} aria-hidden="true" /> {meta.label}
                </button>
              );
            }
          )}
        </div>
      )}

      {decision && (
        <div style={{ marginTop: '0.75rem' }}>
          <h4 style={{ margin: '0 0 0.5rem' }}>{MODERATION_ACTION_LABELS[decision]}</h4>
          <div className="mv-field">
            <label htmlFor={`mv-reason-${item.submissionPublicRef}`}>
              Reason {decision === MODERATION_ACTIONS.APPROVE ? '(optional)' : '(required)'}
            </label>
            <textarea
              id={`mv-reason-${item.submissionPublicRef}`}
              className="mv-textarea"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={MICRO_VOLUNTEER_LIMITS.MAX_MODERATION_REASON_LENGTH}
            />
            <span className="mv-help">
              This reason is kept in the internal audit trail. Do not include personal data.
            </span>
          </div>
          {decision === MODERATION_ACTIONS.APPROVE && (
            <div className="mv-field">
              <label htmlFor={`mv-outcome-${item.submissionPublicRef}`}>Public outcome note (required)</label>
              <textarea
                id={`mv-outcome-${item.submissionPublicRef}`}
                className="mv-textarea"
                value={publicOutcomeNote}
                onChange={(event) => setPublicOutcomeNote(event.target.value)}
                maxLength={MICRO_VOLUNTEER_LIMITS.MAX_PUBLIC_OUTCOME_LENGTH}
              />
              <span className="mv-help">
                Shown on the public task page after approval. Keep it factual and free of personal data.
              </span>
            </div>
          )}
          <div className="mv-inline-actions">
            <MicroVolunteerLoadingButton className="mv-button" loading={busy} onClick={submit}>
              Confirm {MODERATION_ACTION_LABELS[decision].toLowerCase()}
            </MicroVolunteerLoadingButton>
            <button type="button" className="mv-button mv-button-secondary" onClick={() => setDecision(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default function MicroVolunteerModerationPanel({ queue, busy, error, onDecide }) {
  if (!queue || queue.items.length === 0) {
    return (
      <MicroVolunteerEmptyState
        title="No completions are waiting for moderation"
        description="When a contributor submits evidence, it appears here for a human reviewer to approve, reject or send back with a reason."
      />
    );
  }

  return (
    <section aria-labelledby="mv-moderation-heading">
      <h2 id="mv-moderation-heading">Moderation queue</h2>
      <p className="mv-muted">
        {queue.pagination.total} submission{queue.pagination.total === 1 ? '' : 's'} in your jurisdiction.
        Decisions are recorded in the append-only audit trail with the reason you enter.
      </p>
      {error && (
        <p className="mv-error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" /> {error}
        </p>
      )}
      <div className="mv-list">
        {queue.items.map((item) => (
          <ModerationItem key={item.submissionPublicRef} item={item} busy={busy} onDecide={onDecide} />
        ))}
      </div>
    </section>
  );
}
