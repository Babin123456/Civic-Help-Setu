import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Link2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import {
  CITIZEN_REPORT_CATEGORIES,
  CITIZEN_REPORT_CATEGORY_LABELS,
  CITIZEN_REPORT_STATES,
  CITIZEN_REPORT_STATE_LABELS,
} from '../../services/treeInventoryConstants';
import { TreeInventoryEmptyState, TreeStatusBadge } from './TreeInventoryStates';

const tableWrap = { overflowX: 'auto', border: '1px solid var(--border-main)', borderRadius: '0.7rem' };
const thStyle = { textAlign: 'left', padding: '0.55rem 0.7rem', fontSize: '0.78rem', whiteSpace: 'nowrap' };
const tdStyle = { padding: '0.55rem 0.7rem', fontSize: '0.82rem', verticalAlign: 'top' };
const fieldStyle = { display: 'grid', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 700 };
const errorStyle = { color: 'var(--error, #ef4444)', fontSize: '0.77rem', fontWeight: 500 };

const TONE_BY_STATE = {
  [CITIZEN_REPORT_STATES.SUBMITTED]: 'scheduled',
  [CITIZEN_REPORT_STATES.TRIAGED]: 'due_soon',
  [CITIZEN_REPORT_STATES.UNDER_REVIEW]: 'due_soon',
  [CITIZEN_REPORT_STATES.ACCEPTED]: 'success',
  [CITIZEN_REPORT_STATES.REJECTED]: 'unknown',
  [CITIZEN_REPORT_STATES.DUPLICATE]: 'unknown',
};

const formatDateTime = (value) => {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString('en-IN') : 'Unknown';
};

const emptyTriage = { decision: 'triaged', triageNotes: '', treeId: '', duplicateOfTracking: '' };
const emptyReview = { decision: 'accept', reason: '', treeId: '', createInspection: true, inspectionDate: '', assignedTo: '' };

/**
 * Triage and expert review of citizen observations. Triage links a report to a
 * real tree; expert review decides whether an inspection is created. Neither
 * step can declare a tree unsafe.
 */
export default function TreeCitizenReportQueue({
  reports,
  trees = [],
  filters = {},
  onFiltersChange,
  onTriage,
  onReview,
  onRefresh,
  canTriage = false,
  canReview = false,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [triage, setTriage] = useState(emptyTriage);
  const [review, setReview] = useState(emptyReview);
  const [errors, setErrors] = useState({});

  const items = reports?.items || [];
  const selected = items.find((report) => report.id === selectedId) || null;

  const selectReport = (report) => {
    setSelectedId(report.id);
    setTriage({
      decision: 'triaged',
      triageNotes: report.triageNotes || '',
      treeId: report.treeId || '',
      duplicateOfTracking: report.duplicateOfTracking || '',
    });
    setReview({
      decision: 'accept',
      reason: '',
      treeId: report.treeId || '',
      createInspection: true,
      inspectionDate: '',
      assignedTo: '',
    });
    setErrors({});
  };

  const handleTriage = (event) => {
    event.preventDefault();
    if (!selected) return;
    const nextErrors = {};
    if (triage.triageNotes.trim().length < 5) nextErrors.triageNotes = 'Write at least 5 characters explaining the triage decision.';
    if (triage.decision === 'duplicate' && triage.duplicateOfTracking.trim().length < 4) {
      nextErrors.duplicateOfTracking = 'Enter the existing tracking code.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onTriage?.(selected.id, {
      decision: triage.decision,
      triageNotes: triage.triageNotes.trim(),
      treeId: triage.treeId || undefined,
      duplicateOfTracking: triage.decision === 'duplicate' ? triage.duplicateOfTracking.trim() : undefined,
    });
  };

  const handleReview = (event) => {
    event.preventDefault();
    if (!selected) return;
    const nextErrors = {};
    if (review.reason.trim().length < 5) nextErrors.reason = 'Give a short reason for the review decision.';
    if (review.decision === 'accept' && !review.treeId) nextErrors.treeId = 'Link the report to a tree before accepting.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onReview?.(selected.id, {
      decision: review.decision,
      reason: review.reason.trim(),
      treeId: review.treeId || undefined,
      createInspection: review.decision === 'accept' ? review.createInspection : false,
      inspectionDate: review.inspectionDate || undefined,
      assignedTo: review.assignedTo || undefined,
    });
  };

  return (
    <section aria-labelledby="tree-citizen-reports-heading" style={{ display: 'grid', gap: '0.9rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'center' }}>
        <div>
          <h2 id="tree-citizen-reports-heading" style={{ margin: 0, fontSize: '1.1rem' }}>
            Citizen observation queue
          </h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            {reports?.pendingCount || 0} report{(reports?.pendingCount || 0) === 1 ? '' : 's'} awaiting triage or expert review.
            Citizen reports are unverified observations and are labelled as such.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onRefresh}>
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.7rem' }}>
        <label style={fieldStyle}>
          Report state
          <select
            className="form-input"
            value={filters.state || ''}
            onChange={(event) => onFiltersChange?.({ ...filters, state: event.target.value, page: 1 })}
          >
            <option value="">All report states</option>
            {Object.values(CITIZEN_REPORT_STATES).map((state) => (
              <option key={state} value={state}>{CITIZEN_REPORT_STATE_LABELS[state]}</option>
            ))}
          </select>
        </label>
        <label style={fieldStyle}>
          Observation type
          <select
            className="form-input"
            value={filters.category || ''}
            onChange={(event) => onFiltersChange?.({ ...filters, category: event.target.value, page: 1 })}
          >
            <option value="">All observation types</option>
            {Object.values(CITIZEN_REPORT_CATEGORIES).map((category) => (
              <option key={category} value={category}>{CITIZEN_REPORT_CATEGORY_LABELS[category]}</option>
            ))}
          </select>
        </label>
      </div>

      {items.length === 0 ? (
        <TreeInventoryEmptyState
          title="No citizen reports match this view"
          message="Reports arrive from the public observation form. Clear the filters or check the public register."
        />
      ) : (
        <div style={tableWrap} tabIndex={0} aria-label="Scrollable citizen report table">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '940px' }}>
            <caption style={{ textAlign: 'left', padding: '0.6rem 0.75rem', fontWeight: 800 }}>
              Citizen observations, privacy-safe summaries and review state
            </caption>
            <thead>
              <tr style={{ background: 'var(--glass-bg)' }}>
                {['Tracking code', 'Tree / ward', 'Observation', 'State', 'Submitted', 'Evidence', 'Actions'].map((header) => (
                  <th key={header} scope="col" style={thStyle}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((report) => (
                <tr key={report.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                  <th scope="row" style={{ ...tdStyle, fontWeight: 700 }}>{report.trackingCode}</th>
                  <td style={tdStyle}>
                    {report.publicId || 'No matched tree'}
                    <span style={{ display: 'block', color: 'var(--text-tertiary)' }}>{report.ward}</span>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: '30ch' }}>
                    {report.categoryLabel}
                    <span style={{ display: 'block', color: 'var(--text-tertiary)' }}>{report.description}</span>
                  </td>
                  <td style={tdStyle}>
                    <TreeStatusBadge tone={TONE_BY_STATE[report.state] || 'neutral'} label={report.stateLabel} prefix="Report state" />
                  </td>
                  <td style={tdStyle}>{formatDateTime(report.createdAt)}</td>
                  <td style={tdStyle}>{report.attachments?.length || 0} image(s)</td>
                  <td style={tdStyle}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.76rem' }}
                      onClick={() => selectReport(report)}
                      aria-expanded={selectedId === report.id}
                    >
                      {selectedId === report.id ? 'Hide details' : 'Open report'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div style={{ display: 'grid', gap: '0.8rem', border: '1px solid var(--border-main)', borderRadius: '0.85rem', padding: '0.9rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.98rem' }}>{selected.trackingCode}</h3>
            <TreeStatusBadge tone={TONE_BY_STATE[selected.state] || 'neutral'} label={selected.stateLabel} prefix="Report state" />
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{selected.description}</p>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
            Reporter: {selected.reporterLabel}. Internal device keys are never shown. Attachments: {selected.attachments?.length || 0}.
          </p>

          {canTriage && [CITIZEN_REPORT_STATES.SUBMITTED, CITIZEN_REPORT_STATES.TRIAGED].includes(selected.state) && (
            <form onSubmit={handleTriage} noValidate style={{ display: 'grid', gap: '0.6rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.92rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                <ClipboardCheck size={15} aria-hidden="true" /> Triage this observation
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.7rem' }}>
                <label style={fieldStyle}>
                  Triage decision
                  <select className="form-input" value={triage.decision} onChange={(event) => setTriage((previous) => ({ ...previous, decision: event.target.value }))}>
                    <option value="triaged">Triaged — send for expert review</option>
                    <option value="escalate">Escalate — urgent expert review</option>
                    <option value="duplicate">Duplicate of an existing report</option>
                  </select>
                </label>
                <label style={fieldStyle}>
                  Link to tree (optional)
                  <select className="form-input" value={triage.treeId} onChange={(event) => setTriage((previous) => ({ ...previous, treeId: event.target.value }))}>
                    <option value="">No tree link</option>
                    {trees.map((tree) => (
                      <option key={tree.id} value={tree.id}>{tree.publicId} — {tree.ward}</option>
                    ))}
                  </select>
                </label>
                {triage.decision === 'duplicate' && (
                  <label style={fieldStyle}>
                    Existing tracking code
                    <input className="form-input" maxLength={40} value={triage.duplicateOfTracking} onChange={(event) => setTriage((previous) => ({ ...previous, duplicateOfTracking: event.target.value }))} />
                    {errors.duplicateOfTracking && <span style={errorStyle}>{errors.duplicateOfTracking}</span>}
                  </label>
                )}
              </div>
              <label style={fieldStyle}>
                Triage notes (required)
                <textarea className="form-input" rows={2} maxLength={500} value={triage.triageNotes} onChange={(event) => setTriage((previous) => ({ ...previous, triageNotes: event.target.value }))} />
                {errors.triageNotes && <span style={errorStyle}>{errors.triageNotes}</span>}
              </label>
              <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }}>
                <Link2 size={14} aria-hidden="true" /> Save triage
              </button>
            </form>
          )}

          {canReview && [CITIZEN_REPORT_STATES.TRIAGED, CITIZEN_REPORT_STATES.UNDER_REVIEW].includes(selected.state) && (
            <form onSubmit={handleReview} noValidate style={{ display: 'grid', gap: '0.6rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.7rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.92rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                <ShieldCheck size={15} aria-hidden="true" /> Expert review
              </h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Accepting a report schedules a follow-up inspection. It does not approve pruning, removal or a risk level.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.7rem' }}>
                <label style={fieldStyle}>
                  Decision
                  <select className="form-input" value={review.decision} onChange={(event) => setReview((previous) => ({ ...previous, decision: event.target.value }))}>
                    <option value="accept">Accept and schedule inspection</option>
                    <option value="reject">Reject — no action required</option>
                    <option value="duplicate">Link as duplicate</option>
                  </select>
                </label>
                {review.decision === 'accept' && (
                  <label style={fieldStyle}>
                    Tree
                    <select className="form-input" value={review.treeId} onChange={(event) => setReview((previous) => ({ ...previous, treeId: event.target.value }))}>
                      <option value="">Choose the tree</option>
                      {trees.map((tree) => (
                        <option key={tree.id} value={tree.id}>{tree.publicId} — {tree.ward}</option>
                      ))}
                    </select>
                    {errors.treeId && <span style={errorStyle}>{errors.treeId}</span>}
                  </label>
                )}
                {review.decision === 'accept' && (
                  <>
                    <label style={fieldStyle}>
                      Inspection date (optional)
                      <input type="date" className="form-input" value={review.inspectionDate} onChange={(event) => setReview((previous) => ({ ...previous, inspectionDate: event.target.value }))} />
                    </label>
                    <label style={fieldStyle}>
                      Assign inspection to
                      <input className="form-input" maxLength={120} value={review.assignedTo} onChange={(event) => setReview((previous) => ({ ...previous, assignedTo: event.target.value }))} />
                    </label>
                    <label style={{ ...fieldStyle, alignSelf: 'end' }}>
                      <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={review.createInspection}
                          onChange={(event) => setReview((previous) => ({ ...previous, createInspection: event.target.checked }))}
                        />
                        Create a follow-up inspection
                      </span>
                    </label>
                  </>
                )}
              </div>
              <label style={fieldStyle}>
                Review reason (required)
                <textarea className="form-input" rows={2} maxLength={500} value={review.reason} onChange={(event) => setReview((previous) => ({ ...previous, reason: event.target.value }))} />
                {errors.reason && <span style={errorStyle}>{errors.reason}</span>}
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="submit" className="btn btn-primary">
                  {review.decision === 'accept' ? (
                    <><CheckCircle2 size={14} aria-hidden="true" /> Accept report</>
                  ) : review.decision === 'duplicate' ? (
                    <><ClipboardCheck size={14} aria-hidden="true" /> Mark duplicate</>
                  ) : (
                    <><XCircle size={14} aria-hidden="true" /> Reject report</>
                  )}
                </button>
              </div>
            </form>
          )}

          {!canTriage && !canReview && (
            <p style={{ margin: 0, display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
              <AlertTriangle size={14} aria-hidden="true" /> Your role can view this queue but cannot triage or review reports.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
