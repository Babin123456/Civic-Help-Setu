import { CalendarClock, CheckCircle2, ClipboardCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  INSPECTION_STATES,
  INSPECTION_STATE_LABELS,
} from '../../services/treeInventoryConstants';
import { TreeInventoryEmptyState, TreeStatusBadge } from './TreeInventoryStates';

const tableWrap = { overflowX: 'auto', border: '1px solid var(--border-main)', borderRadius: '0.7rem' };
const thStyle = { textAlign: 'left', padding: '0.55rem 0.7rem', fontSize: '0.78rem', whiteSpace: 'nowrap' };
const tdStyle = { padding: '0.55rem 0.7rem', fontSize: '0.82rem', verticalAlign: 'top' };

const TONE_BY_STATE = {
  [INSPECTION_STATES.SCHEDULED]: 'scheduled',
  [INSPECTION_STATES.IN_PROGRESS]: 'due_soon',
  [INSPECTION_STATES.COMPLETED]: 'due_soon',
  [INSPECTION_STATES.VERIFIED]: 'success',
  [INSPECTION_STATES.MISSED]: 'overdue',
  [INSPECTION_STATES.CANCELLED]: 'unknown',
};

const formatDateTime = (value) => {
  if (!value) return 'Not recorded';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString('en-IN') : 'Not recorded';
};

/**
 * Staff inspection queue. The component never changes data itself; every
 * button calls a service handler supplied by the page.
 */
export default function TreeInspectionPanel({
  inspections,
  trees = [],
  filters = {},
  onFiltersChange,
  onSchedule,
  onComplete,
  onVerify,
  onRefresh,
  canSchedule = false,
  canComplete = false,
  canVerify = false,
}) {
  const treeOptions = trees || [];
  const items = inspections?.items || [];

  return (
    <section aria-labelledby="tree-inspections-heading" style={{ display: 'grid', gap: '0.9rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'center' }}>
        <div>
          <h2 id="tree-inspections-heading" style={{ margin: 0, fontSize: '1.1rem' }}>
            Preventive inspection queue
          </h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            A completed inspection records a condition and sets the next due date. It does not approve pruning, removal or a
            risk designation.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={onRefresh}>
            <RefreshCw size={14} aria-hidden="true" /> Refresh
          </button>
          {canSchedule && treeOptions.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={() => onSchedule?.(treeOptions[0])}>
              <CalendarClock size={14} aria-hidden="true" /> Schedule inspection
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.7rem' }}>
        <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 700 }}>
          Inspection state
          <select
            className="form-input"
            value={filters.state || ''}
            onChange={(event) => onFiltersChange?.({ ...filters, state: event.target.value, page: 1 })}
          >
            <option value="">All inspection states</option>
            {Object.values(INSPECTION_STATES).map((state) => (
              <option key={state} value={state}>{INSPECTION_STATE_LABELS[state]}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 700 }}>
          Tree
          <select
            className="form-input"
            value={filters.treeId || ''}
            onChange={(event) => onFiltersChange?.({ ...filters, treeId: event.target.value, page: 1 })}
          >
            <option value="">All trees in scope</option>
            {treeOptions.map((tree) => (
              <option key={tree.id} value={tree.id}>{tree.publicId} — {tree.ward}</option>
            ))}
          </select>
        </label>
      </div>

      {items.length === 0 ? (
        <TreeInventoryEmptyState
          title="No inspections match this view"
          message="Schedule a preventive inspection from a tree row, or clear the inspection filters."
        />
      ) : (
        <div style={tableWrap} tabIndex={0} aria-label="Scrollable inspection table">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
            <caption style={{ textAlign: 'left', padding: '0.6rem 0.75rem', fontWeight: 800 }}>
              Scheduled, completed and verified tree inspections
            </caption>
            <thead>
              <tr style={{ background: 'var(--glass-bg)' }}>
                {['Inspection', 'Tree', 'Type', 'State', 'Scheduled / performed', 'Assigned', 'Actions'].map((header) => (
                  <th key={header} scope="col" style={thStyle}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((inspection) => (
                <tr key={inspection.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                  <th scope="row" style={{ ...tdStyle, fontWeight: 700 }}>{inspection.publicId}</th>
                  <td style={tdStyle}>
                    {inspection.treePublicId || 'Tree removed'}
                    <span style={{ display: 'block', color: 'var(--text-tertiary)' }}>{inspection.ward || 'No ward'}</span>
                  </td>
                  <td style={tdStyle}>{inspection.typeLabel}</td>
                  <td style={tdStyle}>
                    <TreeStatusBadge
                      tone={TONE_BY_STATE[inspection.state] || 'neutral'}
                      label={inspection.stateLabel}
                      prefix="Inspection state"
                    />
                  </td>
                  <td style={tdStyle}>
                    <span style={{ display: 'block' }}>Scheduled: {formatDateTime(inspection.scheduledFor)}</span>
                    <span style={{ display: 'block', color: 'var(--text-tertiary)' }}>
                      Performed: {formatDateTime(inspection.performedAt)}
                    </span>
                  </td>
                  <td style={tdStyle}>{inspection.assignedTo || 'Unassigned'}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', minWidth: '150px' }}>
                      {canComplete && [INSPECTION_STATES.SCHEDULED, INSPECTION_STATES.IN_PROGRESS].includes(inspection.state) && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.76rem' }}
                          onClick={() => onComplete?.(inspection)}
                        >
                          <CheckCircle2 size={13} aria-hidden="true" /> Record findings
                        </button>
                      )}
                      {canVerify && inspection.state === INSPECTION_STATES.COMPLETED && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.76rem' }}
                          onClick={() => onVerify?.(inspection)}
                        >
                          <ShieldCheck size={13} aria-hidden="true" /> Verify findings
                        </button>
                      )}
                      {!canComplete && inspection.state === INSPECTION_STATES.COMPLETED && (
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>Awaiting a reviewer</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ margin: 0, display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
        <ClipboardCheck size={14} aria-hidden="true" /> {inspections?.total || 0} inspection
        {inspections?.total === 1 ? '' : 's'} in this view. Verification is separate from completion so one person cannot
        silently approve their own findings.
      </p>
    </section>
  );
}
