import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock3,
  Lock,
  RotateCcw,
  Eye,
  FileText,
  CalendarDays,
  Pencil,
  Send,
} from 'lucide-react';
import {
  SUBMISSION_STATUS,
  SUBMISSION_STATUS_LABELS,
  DATA_QUALITY,
  DATA_QUALITY_LABELS,
  EMISSION_CATEGORY_LABELS,
} from '../../services/ghgInventoryConstants.js';
import { GhgEmptyState, GhgStatusBadge } from './GhgInventoryStates.jsx';

const statusTone = {
  [SUBMISSION_STATUS.DRAFT]: 'neutral',
  [SUBMISSION_STATUS.SUBMITTED]: 'info',
  [SUBMISSION_STATUS.UNDER_REVIEW]: 'warning',
  [SUBMISSION_STATUS.CHANGES_REQUESTED]: 'warning',
  [SUBMISSION_STATUS.APPROVED]: 'success',
  [SUBMISSION_STATUS.REJECTED]: 'danger',
  [SUBMISSION_STATUS.LOCKED]: 'neutral',
};

const actionLabels = {
  start_review: { label: 'Start review', icon: Eye, tone: 'secondary' },
  approve: { label: 'Approve submission', icon: CheckCircle2, tone: 'primary' },
  request_changes: { label: 'Request changes', icon: AlertTriangle, tone: 'secondary' },
  reject: { label: 'Reject submission', icon: XCircle, tone: 'secondary' },
  lock: { label: 'Lock after publication', icon: Lock, tone: 'secondary' },
  reopen: { label: 'Reopen for correction', icon: RotateCcw, tone: 'secondary' },
};

const reasonActions = new Set(['request_changes', 'reject', 'reopen']);

const formatDate = (value) => (value ? new Date(value).toLocaleString() : '—');

export default function GhgSubmissionReview({
  submissions,
  detail,
  selectedId,
  onSelect,
  onAction,
  actionBusy,
  canReview,
  onEditSubmission,
  onSubmitSubmission,
  canOperate = false,
}) {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const handleAction = (action) => {
    if (reasonActions.has(action) && reason.trim().length < 10) {
      setReasonError('Explain the decision in at least 10 characters so the audit trail is useful.');
      return;
    }
    setReasonError('');
    onAction(action, reason.trim());
    setReason('');
  };

  if (!submissions.length) {
    return (
      <GhgEmptyState
        title="No department submissions"
        message="Submissions for this period will appear here. Operators and administrators can create the first one."
      />
    );
  }

  return (
    <section aria-labelledby="ghg-submissions-heading" style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <h2 id="ghg-submissions-heading" style={{ margin: 0, fontSize: '1.15rem' }}>
          Department submissions
        </h2>
        <p style={{ margin: '0.3rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Reviewers approve, return or reject submissions with a recorded reason. Operators can only
          edit drafts or returned records.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', alignItems: 'start' }}>
        <div>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>
            {submissions.length} submission(s)
          </h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.6rem' }}>
            {submissions.map((submission) => {
              const selected = selectedId === submission.id;
              return (
                <li key={submission.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(submission.id)}
                    aria-pressed={selected}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.75rem',
                      borderRadius: '0.6rem',
                      border: selected ? '2px solid var(--accent-main)' : '1px solid var(--border-main)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' }}>
                      <strong style={{ fontSize: '0.88rem' }}>{submission.title}</strong>
                      <GhgStatusBadge
                        label={SUBMISSION_STATUS_LABELS[submission.status] || submission.status}
                        tone={statusTone[submission.status] || 'neutral'}
                      />
                    </span>
                    <span style={{ display: 'block', marginTop: '0.3rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {submission.department} · {submission.recordCount} record(s) ·{' '}
                      {submission.measuredCount} measured, {submission.estimatedCount} estimated,{' '}
                      {submission.excludedCount} excluded
                    </span>
                    <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      <CalendarDays size={11} aria-hidden="true" /> Updated {formatDate(submission.updatedAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-main)',
            borderRadius: '0.75rem',
            padding: '1rem',
            minHeight: '220px',
          }}
        >
          {!detail ? (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Select a submission to inspect its activity records, corrections and review history.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{detail.title}</h3>
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {detail.department} · {detail.periodLabel} · {detail.recordCount} activity record(s)
                  </p>
                </div>
                <GhgStatusBadge
                  label={SUBMISSION_STATUS_LABELS[detail.status] || detail.status}
                  tone={statusTone[detail.status] || 'neutral'}
                />
              </div>

              <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem', margin: '0.9rem 0', fontSize: '0.78rem' }}>
                <div>
                  <dt style={{ fontWeight: 700 }}>Submitted</dt>
                  <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>{formatDate(detail.submittedAt)}</dd>
                </div>
                <div>
                  <dt style={{ fontWeight: 700 }}>Reviewed</dt>
                  <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>{formatDate(detail.reviewedAt)}</dd>
                </div>
                <div>
                  <dt style={{ fontWeight: 700 }}>Reviewer note</dt>
                  <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>{detail.reviewNotes || 'None recorded'}</dd>
                </div>
                <div>
                  <dt style={{ fontWeight: 700 }}>Correction note</dt>
                  <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>{detail.correctionNotes || 'None recorded'}</dd>
                </div>
              </dl>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <caption style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', paddingBottom: '0.35rem' }}>
                    Activity records use the factor version resolved at entry. A unit mismatch is refused before saving.
                  </caption>
                  <thead>
                    <tr>
                      {['Source', 'Activity', 'Quality', 'Factor', 'tCO2e', 'Formula'].map((label) => (
                        <th key={label} scope="col" style={{ textAlign: 'left', padding: '0.4rem', borderBottom: '1px solid var(--border-main)', whiteSpace: 'nowrap' }}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.records.map((record) => (
                      <tr key={record.id}>
                        <th scope="row" style={{ textAlign: 'left', padding: '0.4rem', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>
                          {record.sourceName}
                          <span style={{ display: 'block', fontWeight: 400, color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                            {EMISSION_CATEGORY_LABELS[record.category] || record.category}
                          </span>
                        </th>
                        <td style={{ padding: '0.4rem', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                          {Number(record.quantity).toLocaleString('en-IN')} {record.unit}
                        </td>
                        <td style={{ padding: '0.4rem', borderBottom: '1px solid var(--border-light)' }}>
                          <GhgStatusBadge
                            label={DATA_QUALITY_LABELS[record.dataQuality] || record.dataQuality}
                            tone={
                              record.dataQuality === DATA_QUALITY.MEASURED
                                ? 'success'
                                : record.dataQuality === DATA_QUALITY.ESTIMATED
                                  ? 'warning'
                                  : 'neutral'
                            }
                          />
                        </td>
                        <td style={{ padding: '0.4rem', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                          {record.factorVersionNumber ? `v${record.factorVersionNumber}` : 'Unavailable'}
                          {record.factorValue != null && (
                            <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                              {record.factorValue} / {record.factorUnit}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.4rem', borderBottom: '1px solid var(--border-light)', fontWeight: 700 }}>
                          {record.calculationError ? 'Error' : Number(record.tCO2e || 0).toFixed(3)}
                        </td>
                        <td style={{ padding: '0.4rem', borderBottom: '1px solid var(--border-light)', minWidth: '190px', fontSize: '0.72rem' }}>
                          {record.calculationError ? (
                            <span role="alert" style={{ color: '#b91c1c' }}>{record.calculationError.message}</span>
                          ) : (
                            record.formula
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {detail.allowedActions?.some((action) => ['edit', 'submit'].includes(action)) && canOperate && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-main)', paddingTop: '0.9rem' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    This submission is still editable. Correct the activity values, then submit it for
                    review. The reviewer can return it with a written reason if more work is needed.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {detail.allowedActions.includes('edit') && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={actionBusy}
                        onClick={() => onEditSubmission?.(detail)}
                      >
                        <Pencil size={14} aria-hidden="true" /> Edit draft rows
                      </button>
                    )}
                    {detail.allowedActions.includes('submit') && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={actionBusy}
                        onClick={() => onSubmitSubmission?.(detail)}
                      >
                        <Send size={14} aria-hidden="true" /> Submit for review
                      </button>
                    )}
                  </div>
                </div>
              )}

              {detail.allowedActions?.length > 0 && canReview && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-main)', paddingTop: '0.9rem' }}>
                  <label htmlFor="ghg-review-reason" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                    Review reason
                  </label>
                  <textarea
                    id="ghg-review-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={2}
                    maxLength={500}
                    aria-invalid={Boolean(reasonError)}
                    aria-describedby={reasonError ? 'ghg-review-reason-error' : 'ghg-review-reason-help'}
                    style={{ width: '100%', padding: '0.45rem 0.55rem', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)', resize: 'vertical' }}
                  />
                  <p id="ghg-review-reason-help" style={{ margin: '0.2rem 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    Required for return, rejection and reopening. Stored in the append-only audit trail.
                  </p>
                  {reasonError && (
                    <p id="ghg-review-reason-error" role="alert" style={{ margin: '0.25rem 0 0', color: '#b91c1c', fontSize: '0.78rem' }}>
                      {reasonError}
                    </p>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.6rem' }}>
                    {detail.allowedActions.map((action) => {
                      const config = actionLabels[action];
                      if (!config) return null;
                      const Icon = config.icon;
                      return (
                        <button
                          key={action}
                          type="button"
                          className={`btn btn-${config.tone}`}
                          disabled={actionBusy}
                          onClick={() => handleAction(action)}
                        >
                          <Icon size={14} aria-hidden="true" /> {config.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {detail.allowedActions?.length === 0 && (
                <p role="status" style={{ margin: '0.9rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <Clock3 size={13} aria-hidden="true" /> No transition is available for this status and
                  role. A locked submission is retained unchanged for audit.
                </p>
              )}

              {detail.auditEventId && (
                <p style={{ margin: '0.6rem 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  <FileText size={11} aria-hidden="true" /> Audit event {detail.auditEventId} recorded.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
