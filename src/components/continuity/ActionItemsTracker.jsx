import { useState } from 'react';
import { CheckCircle2, Clock, AlertCircle, Check } from 'lucide-react';
import { ACTION_ITEM_STATES } from '../../services/continuityPlannerService';

export const ActionItemsTracker = ({
  actionItems = [],
  onTransitionState,
  isAdmin = false,
}) => {
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedItem, setSelectedItem] = useState(null);
  const [closureNotes, setClosureNotes] = useState('');
  const [targetNextState, setTargetNextState] = useState(null);

  const filtered = actionItems.filter((item) => {
    if (filterStatus === 'ALL') return true;
    return item.status === filterStatus;
  });

  const handleOpenTransition = (item, nextState) => {
    setSelectedItem(item);
    setTargetNextState(nextState);
    setClosureNotes(item.closureNotes || '');
  };

  const handleConfirmTransition = (e) => {
    e.preventDefault();
    if (!selectedItem || !targetNextState) return;

    onTransitionState(selectedItem.id, targetNextState, {
      closureNotes,
    });
    setSelectedItem(null);
    setTargetNextState(null);
    setClosureNotes('');
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'URGENT':
        return (
          <span style={{ color: '#ef4444', fontWeight: '700', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.12)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
            URGENT
          </span>
        );
      case 'HIGH':
        return (
          <span style={{ color: '#d97706', fontWeight: '700', fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.12)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
            HIGH
          </span>
        );
      default:
        return (
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', background: 'var(--glass-bg)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
            {priority || 'NORMAL'}
          </span>
        );
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case ACTION_ITEM_STATES.VERIFIED:
        return (
          <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontWeight: '700', fontSize: '0.75rem' }}>
            <CheckCircle2 size={13} aria-hidden="true" />
            <span>VERIFIED</span>
          </span>
        );
      case ACTION_ITEM_STATES.IMPLEMENTED:
        return (
          <span style={{ color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontWeight: '600', fontSize: '0.75rem' }}>
            <Check size={13} aria-hidden="true" />
            <span>IMPLEMENTED</span>
          </span>
        );
      case ACTION_ITEM_STATES.IN_PROGRESS:
        return (
          <span style={{ color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontWeight: '600', fontSize: '0.75rem' }}>
            <Clock size={13} aria-hidden="true" />
            <span>IN PROGRESS</span>
          </span>
        );
      default:
        return (
          <span style={{ color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem' }}>
            <AlertCircle size={13} aria-hidden="true" />
            <span>OPEN</span>
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {/* FILTER BUTTONS */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Filter by Status:</span>
        {['ALL', ACTION_ITEM_STATES.OPEN, ACTION_ITEM_STATES.IN_PROGRESS, ACTION_ITEM_STATES.IMPLEMENTED, ACTION_ITEM_STATES.VERIFIED].map(
          (status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: '99px',
                border: `1px solid ${filterStatus === status ? 'var(--accent-main)' : 'var(--border-main)'}`,
                background: filterStatus === status ? 'var(--accent-main)' : 'var(--bg-card)',
                color: filterStatus === status ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: filterStatus === status ? '700' : '500',
                cursor: 'pointer',
              }}
            >
              {status}
            </button>
          )
        )}
      </div>

      {/* ACTION ITEMS TABLE / LIST */}
      <div
        tabIndex="0"
        role="region"
        aria-label="Post-drill corrective action items"
        style={{
          width: '100%',
          overflowX: 'auto',
          borderRadius: '0.65rem',
          border: '1px solid var(--border-main)',
          background: 'var(--bg-card)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--glass-bg)', borderBottom: '1px solid var(--border-main)' }}>
              <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: '700' }}>Status</th>
              <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: '700' }}>Priority</th>
              <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: '700' }}>Action Title & Department</th>
              <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: '700' }}>Assignee</th>
              <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: '700' }}>Due Date</th>
              <th scope="col" style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700' }}>Advance State</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No corrective action items matching this filter.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>{getStatusBadge(item.status)}</td>
                  <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>{getPriorityBadge(item.priority)}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{item.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Dept: {item.ownerDepartment}</div>
                    {item.closureNotes && (
                      <div style={{ fontSize: '0.75rem', color: '#10b981', fontStyle: 'italic', marginTop: '0.2rem' }}>
                        Closure: {item.closureNotes}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{item.assignee}</td>
                  <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                    {item.dueDate}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {item.status === ACTION_ITEM_STATES.OPEN && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleOpenTransition(item, ACTION_ITEM_STATES.IN_PROGRESS)}
                        style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                      >
                        Start Work
                      </button>
                    )}

                    {item.status === ACTION_ITEM_STATES.IN_PROGRESS && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleOpenTransition(item, ACTION_ITEM_STATES.IMPLEMENTED)}
                        style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                      >
                        Mark Implemented
                      </button>
                    )}

                    {item.status === ACTION_ITEM_STATES.IMPLEMENTED && isAdmin && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleOpenTransition(item, ACTION_ITEM_STATES.VERIFIED)}
                        style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                      >
                        Verify & Close
                      </button>
                    )}

                    {item.status === ACTION_ITEM_STATES.VERIFIED && (
                      <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '700' }}>Closed</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* TRANSITION MODAL */}
      {selectedItem && targetNextState && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <form
            onSubmit={handleConfirmTransition}
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-main)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800' }}>
              Transition Action Item to {targetNextState}
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Target: <strong>{selectedItem.title}</strong>
            </p>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', display: 'block', marginBottom: '0.3rem' }}>
                Implementation Notes / Verification Audit:
              </label>
              <textarea
                rows="3"
                placeholder="Describe actions taken, verification results, or equipment serial numbers..."
                value={closureNotes}
                onChange={(e) => setClosureNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-main)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSelectedItem(null);
                  setTargetNextState(null);
                }}
                style={{ fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                Confirm Transition
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
