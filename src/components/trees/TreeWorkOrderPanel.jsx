import { useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  RefreshCw,
  Save,
  ShieldCheck,
  Wrench,
  XCircle,
} from 'lucide-react';
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_PRIORITY_LABELS,
  WORK_ORDER_STATES,
  WORK_ORDER_STATE_LABELS,
  WORK_ORDER_TYPES,
  WORK_ORDER_TYPE_LABELS,
  allowedNextStates,
} from '../../services/treeInventoryConstants';
import { TreeInventoryEmptyState, TreeStatusBadge } from './TreeInventoryStates';

const tableWrap = { overflowX: 'auto', border: '1px solid var(--border-main)', borderRadius: '0.7rem' };
const thStyle = { textAlign: 'left', padding: '0.55rem 0.7rem', fontSize: '0.78rem', whiteSpace: 'nowrap' };
const tdStyle = { padding: '0.55rem 0.7rem', fontSize: '0.82rem', verticalAlign: 'top' };
const fieldStyle = { display: 'grid', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 700 };
const errorStyle = { color: 'var(--error, #ef4444)', fontSize: '0.77rem', fontWeight: 500 };

const TONE_BY_STATE = {
  [WORK_ORDER_STATES.DRAFT]: 'unknown',
  [WORK_ORDER_STATES.ASSIGNED]: 'scheduled',
  [WORK_ORDER_STATES.IN_PROGRESS]: 'due_soon',
  [WORK_ORDER_STATES.BLOCKED]: 'overdue',
  [WORK_ORDER_STATES.COMPLETED]: 'due_soon',
  [WORK_ORDER_STATES.VERIFIED]: 'success',
  [WORK_ORDER_STATES.CANCELLED]: 'unknown',
};

const formatDate = (value) => {
  if (!value) return 'No due date';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleDateString('en-IN') : 'No due date';
};

const emptyCreate = (treeId = '') => ({
  treeId,
  type: WORK_ORDER_TYPES.PRUNE,
  priority: WORK_ORDER_PRIORITIES.MEDIUM,
  assignedTo: '',
  dueAt: '',
  instructions: '',
  reason: 'Preventive maintenance order created',
});

const emptyDetails = (order) => ({
  assignedTo: order?.assignedTo || '',
  priority: order?.priority || WORK_ORDER_PRIORITIES.MEDIUM,
  dueAt: order?.dueAt ? order.dueAt.slice(0, 10) : '',
  instructions: order?.instructions || '',
  closureNotes: order?.closureNotes || '',
  evidenceUrl: '',
  reason: '',
});

const toDateIso = (value) => (value ? new Date(`${value}T09:00:00`).toISOString() : null);

/**
 * Maintenance order board with explicit creation, assignment, completion and
 * closure evidence. Closure always requires a written note and a photo link;
 * pruning only becomes a pruning event after a reviewer verifies the order.
 */
export default function TreeWorkOrderPanel({
  orders,
  trees = [],
  filters = {},
  onFiltersChange,
  onCreate,
  onUpdate,
  onTransition,
  onRefresh,
  canManage = false,
  canClose = false,
  defaultTreeId = '',
}) {
  const [showCreate, setShowCreate] = useState(Boolean(defaultTreeId));
  const [createValues, setCreateValues] = useState(() => emptyCreate(defaultTreeId || trees[0]?.id || ''));
  const [createErrors, setCreateErrors] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [details, setDetails] = useState(emptyDetails(null));
  const [detailsErrors, setDetailsErrors] = useState({});

  const items = orders?.items || [];
  const selected = items.find((order) => order.id === selectedId) || null;

  const selectOrder = (order) => {
    setSelectedId(order.id);
    setDetails(emptyDetails(order));
    setDetailsErrors({});
  };

  const handleCreate = (event) => {
    event.preventDefault();
    const errors = {};
    if (!createValues.treeId) errors.treeId = 'Choose the tree this order belongs to.';
    if (!Object.values(WORK_ORDER_TYPES).includes(createValues.type)) errors.type = 'Choose a work type.';
    if (createValues.assignedTo && createValues.assignedTo.trim().length < 2) {
      errors.assignedTo = 'Enter at least two characters, or leave unassigned.';
    }
    setCreateErrors(errors);
    if (Object.keys(errors).length > 0) return;
    onCreate?.({
      treeId: createValues.treeId,
      type: createValues.type,
      priority: createValues.priority,
      assignedTo: createValues.assignedTo.trim() || null,
      dueAt: toDateIso(createValues.dueAt),
      instructions: createValues.instructions.trim(),
      reason: createValues.reason,
    });
    setShowCreate(false);
    setCreateValues(emptyCreate(trees[0]?.id || ''));
  };

  const handleSaveDetails = (event) => {
    event.preventDefault();
    if (!selected) return;
    const errors = {};
    if (details.dueAt && Number.isNaN(Date.parse(`${details.dueAt}T09:00:00`))) errors.dueAt = 'Choose a valid due date.';
    setDetailsErrors(errors);
    if (Object.keys(errors).length > 0) return;
    onUpdate?.(selected.id, {
      assignedTo: details.assignedTo.trim() || null,
      priority: details.priority,
      dueAt: toDateIso(details.dueAt),
      instructions: details.instructions.trim(),
      reason: details.reason.trim() || 'Maintenance order assignment updated',
    });
  };

  const handleTransition = (nextState) => {
    if (!selected) return;
    const errors = {};
    const needsEvidence = [WORK_ORDER_STATES.COMPLETED, WORK_ORDER_STATES.VERIFIED].includes(nextState);
    const closureNotes = details.closureNotes.trim();
    if (needsEvidence && closureNotes.length < 10) {
      errors.closureNotes = 'Write at least 10 characters describing the completed work.';
    }
    if (needsEvidence && !details.evidenceUrl.trim()) {
      errors.evidenceUrl = 'Attach an HTTPS photo link as completion evidence.';
    }
    if (needsEvidence && !/^https:\/\//i.test(details.evidenceUrl.trim())) {
      errors.evidenceUrl = 'Evidence links must begin with https://.';
    }
    if (nextState === WORK_ORDER_STATES.CANCELLED && details.reason.trim().length < 5) {
      errors.reason = 'Give a short reason for cancelling the order.';
    }
    if (nextState === WORK_ORDER_STATES.ASSIGNED && details.assignedTo.trim().length < 2) {
      errors.assignedTo = 'Choose who will carry out the work.';
    }
    setDetailsErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onTransition?.(selected.id, nextState, {
      assignedTo: details.assignedTo.trim() || undefined,
      closureNotes: needsEvidence ? closureNotes : undefined,
      evidence:
        needsEvidence && details.evidenceUrl.trim()
          ? [
              {
                mimeType: 'image/jpeg',
                sizeBytes: 0,
                url: details.evidenceUrl.trim(),
                caption: `Completion evidence for ${selected.publicId}`,
              },
            ]
          : [],
      reason:
        details.reason.trim() ||
        (needsEvidence ? 'Work completed and evidence attached' : `Order moved to ${WORK_ORDER_STATE_LABELS[nextState]}`),
    });
  };

  const nextStates = selected ? allowedNextStates('workOrder', selected.state) : [];

  return (
    <section aria-labelledby="tree-work-orders-heading" style={{ display: 'grid', gap: '0.9rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'center' }}>
        <div>
          <h2 id="tree-work-orders-heading" style={{ margin: 0, fontSize: '1.1rem' }}>
            Maintenance orders
          </h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            Orders assign and record work. Closing an order needs written notes and photo evidence; pruning is logged only
            after a reviewer verifies the closure.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={onRefresh}>
            <RefreshCw size={14} aria-hidden="true" /> Refresh
          </button>
          {canManage && (
            <button type="button" className="btn btn-primary" onClick={() => setShowCreate((value) => !value)}>
              <FilePlus2 size={14} aria-hidden="true" /> {showCreate ? 'Close form' : 'New order'}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.7rem' }}>
        <label style={fieldStyle}>
          Order state
          <select
            className="form-input"
            value={filters.state || ''}
            onChange={(event) => onFiltersChange?.({ ...filters, state: event.target.value, page: 1 })}
          >
            <option value="">All order states</option>
            {Object.values(WORK_ORDER_STATES).map((state) => (
              <option key={state} value={state}>{WORK_ORDER_STATE_LABELS[state]}</option>
            ))}
          </select>
        </label>
        <label style={fieldStyle}>
          Work type
          <select
            className="form-input"
            value={filters.type || ''}
            onChange={(event) => onFiltersChange?.({ ...filters, type: event.target.value, page: 1 })}
          >
            <option value="">All work types</option>
            {Object.values(WORK_ORDER_TYPES).map((type) => (
              <option key={type} value={type}>{WORK_ORDER_TYPE_LABELS[type]}</option>
            ))}
          </select>
        </label>
      </div>

      {showCreate && canManage && (
        <form onSubmit={handleCreate} noValidate style={{ border: '1px solid var(--border-main)', borderRadius: '0.85rem', padding: '0.9rem', display: 'grid', gap: '0.7rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.98rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <Wrench size={16} aria-hidden="true" /> Create a maintenance order
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.7rem' }}>
            <label style={fieldStyle}>
              Tree
              <select className="form-input" value={createValues.treeId} onChange={(event) => setCreateValues((previous) => ({ ...previous, treeId: event.target.value }))}>
                <option value="">Choose a tree</option>
                {trees.map((tree) => (
                  <option key={tree.id} value={tree.id}>{tree.publicId} — {tree.ward}</option>
                ))}
              </select>
              {createErrors.treeId && <span style={errorStyle}>{createErrors.treeId}</span>}
            </label>
            <label style={fieldStyle}>
              Work type
              <select className="form-input" value={createValues.type} onChange={(event) => setCreateValues((previous) => ({ ...previous, type: event.target.value }))}>
                {Object.values(WORK_ORDER_TYPES).map((type) => (
                  <option key={type} value={type}>{WORK_ORDER_TYPE_LABELS[type]}</option>
                ))}
              </select>
              {createErrors.type && <span style={errorStyle}>{createErrors.type}</span>}
            </label>
            <label style={fieldStyle}>
              Priority
              <select className="form-input" value={createValues.priority} onChange={(event) => setCreateValues((previous) => ({ ...previous, priority: event.target.value }))}>
                {Object.values(WORK_ORDER_PRIORITIES).map((priority) => (
                  <option key={priority} value={priority}>{WORK_ORDER_PRIORITY_LABELS[priority]}</option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              Assign to crew or officer
              <input className="form-input" maxLength={120} value={createValues.assignedTo} onChange={(event) => setCreateValues((previous) => ({ ...previous, assignedTo: event.target.value }))} />
              {createErrors.assignedTo && <span style={errorStyle}>{createErrors.assignedTo}</span>}
            </label>
            <label style={fieldStyle}>
              Due date
              <input type="date" className="form-input" value={createValues.dueAt} onChange={(event) => setCreateValues((previous) => ({ ...previous, dueAt: event.target.value }))} />
            </label>
          </div>
          <label style={fieldStyle}>
            Instructions
            <textarea className="form-input" rows={2} maxLength={2000} value={createValues.instructions} onChange={(event) => setCreateValues((previous) => ({ ...previous, instructions: event.target.value }))} />
          </label>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button type="submit" className="btn btn-primary">
              <ClipboardList size={14} aria-hidden="true" /> Create order
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <TreeInventoryEmptyState
          title="No maintenance orders match this view"
          message="Create a preventive order from a tree row, or clear the order filters."
        />
      ) : (
        <div style={tableWrap} tabIndex={0} aria-label="Scrollable maintenance order table">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '960px' }}>
            <caption style={{ textAlign: 'left', padding: '0.6rem 0.75rem', fontWeight: 800 }}>
              Maintenance orders, assignments and closure evidence
            </caption>
            <thead>
              <tr style={{ background: 'var(--glass-bg)' }}>
                {['Order', 'Tree', 'Work', 'Priority', 'State', 'Assigned', 'Due', 'Actions'].map((header) => (
                  <th key={header} scope="col" style={thStyle}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((order) => (
                <tr key={order.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                  <th scope="row" style={{ ...tdStyle, fontWeight: 700 }}>{order.publicId}</th>
                  <td style={tdStyle}>
                    {order.treePublicId || 'Unlinked'}
                    <span style={{ display: 'block', color: 'var(--text-tertiary)' }}>{order.ward || 'No ward'}</span>
                  </td>
                  <td style={tdStyle}>{order.typeLabel}</td>
                  <td style={tdStyle}>{order.priorityLabel}</td>
                  <td style={tdStyle}>
                    <TreeStatusBadge tone={TONE_BY_STATE[order.state] || 'neutral'} label={order.stateLabel} prefix="Order state" />
                    {order.isOverdue && (
                      <span style={{ display: 'block', marginTop: '0.2rem', color: 'var(--error, #ef4444)', fontSize: '0.76rem', fontWeight: 700 }}>
                        Past due date
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>{order.assignedTo || 'Unassigned'}</td>
                  <td style={tdStyle}>{formatDate(order.dueAt)}</td>
                  <td style={tdStyle}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.76rem' }}
                      onClick={() => selectOrder(order)}
                      aria-expanded={selectedId === order.id}
                    >
                      {selectedId === order.id ? 'Hide details' : 'Open order'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <form onSubmit={handleSaveDetails} noValidate style={{ border: '1px solid var(--border-main)', borderRadius: '0.85rem', padding: '0.9rem', display: 'grid', gap: '0.7rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.98rem' }}>{selected.publicId} — {selected.typeLabel}</h3>
            <TreeStatusBadge tone={TONE_BY_STATE[selected.state] || 'neutral'} label={selected.stateLabel} prefix="Order state" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.7rem' }}>
            <label style={fieldStyle}>
              Assigned to
              <input className="form-input" maxLength={120} value={details.assignedTo} onChange={(event) => setDetails((previous) => ({ ...previous, assignedTo: event.target.value }))} />
              {detailsErrors.assignedTo && <span style={errorStyle}>{detailsErrors.assignedTo}</span>}
            </label>
            <label style={fieldStyle}>
              Priority
              <select className="form-input" value={details.priority} onChange={(event) => setDetails((previous) => ({ ...previous, priority: event.target.value }))}>
                {Object.values(WORK_ORDER_PRIORITIES).map((priority) => (
                  <option key={priority} value={priority}>{WORK_ORDER_PRIORITY_LABELS[priority]}</option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              Due date
              <input type="date" className="form-input" value={details.dueAt} onChange={(event) => setDetails((previous) => ({ ...previous, dueAt: event.target.value }))} />
              {detailsErrors.dueAt && <span style={errorStyle}>{detailsErrors.dueAt}</span>}
            </label>
          </div>

          <label style={fieldStyle}>
            Instructions
            <textarea className="form-input" rows={2} maxLength={2000} value={details.instructions} onChange={(event) => setDetails((previous) => ({ ...previous, instructions: event.target.value }))} />
          </label>

          <label style={fieldStyle}>
            Change reason (recorded in the audit trail)
            <input className="form-input" maxLength={500} value={details.reason} onChange={(event) => setDetails((previous) => ({ ...previous, reason: event.target.value }))} />
            {detailsErrors.reason && <span style={errorStyle}>{detailsErrors.reason}</span>}
          </label>

          {[WORK_ORDER_STATES.COMPLETED, WORK_ORDER_STATES.VERIFIED].includes(selected.state) && (
            <div role="note" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Closure notes: {selected.closureNotes || 'Not recorded'}. Evidence: {selected.evidence?.length || 0} image link(s).
            </div>
          )}

          {nextStates.length > 0 && (canManage || canClose) && (
            <fieldset style={{ border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '0.8rem' }}>
              <legend style={{ padding: '0 0.35rem', fontWeight: 800 }}>Complete or move this order</legend>
              {nextStates.includes(WORK_ORDER_STATES.VERIFIED) && (
                <div style={{ display: 'grid', gap: '0.7rem' }}>
                  <label style={fieldStyle}>
                    Closure notes (required)
                    <textarea className="form-input" rows={2} maxLength={2000} value={details.closureNotes} onChange={(event) => setDetails((previous) => ({ ...previous, closureNotes: event.target.value }))} />
                    {detailsErrors.closureNotes && <span style={errorStyle}>{detailsErrors.closureNotes}</span>}
                  </label>
                  <label style={fieldStyle}>
                    Completion photo link (HTTPS, required)
                    <input type="url" className="form-input" placeholder="https://" value={details.evidenceUrl} onChange={(event) => setDetails((previous) => ({ ...previous, evidenceUrl: event.target.value }))} />
                    {detailsErrors.evidenceUrl && <span style={errorStyle}>{detailsErrors.evidenceUrl}</span>}
                  </label>
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.6rem' }}>
                {nextStates
                  .filter((state) => state !== WORK_ORDER_STATES.CANCELLED)
                  .map((state) => (
                    <button
                      key={state}
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleTransition(state)}
                      disabled={state === WORK_ORDER_STATES.VERIFIED && !canClose}
                    >
                      {state === WORK_ORDER_STATES.VERIFIED ? (
                        <><ShieldCheck size={14} aria-hidden="true" /> Verify and close</>
                      ) : state === WORK_ORDER_STATES.COMPLETED ? (
                        <><CheckCircle2 size={14} aria-hidden="true" /> Mark completed</>
                      ) : (
                        <><ClipboardList size={14} aria-hidden="true" /> Move to {WORK_ORDER_STATE_LABELS[state]}</>
                      )}
                    </button>
                  ))}
                {nextStates.includes(WORK_ORDER_STATES.CANCELLED) && (
                  <button type="button" className="btn btn-secondary" onClick={() => handleTransition(WORK_ORDER_STATES.CANCELLED)}>
                    <XCircle size={14} aria-hidden="true" /> Cancel order
                  </button>
                )}
              </div>
              {!canManage && (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                  Only an arborist, reviewer or administrator can close an order.
                </p>
              )}
            </fieldset>
          )}

          {canManage && (
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button type="submit" className="btn btn-primary">
                <Save size={14} aria-hidden="true" /> Save assignment and details
              </button>
            </div>
          )}
        </form>
      )}
    </section>
  );
}
