import { useState, useEffect } from 'react';
import { X, Wrench } from 'lucide-react';
import { loadMaintenanceTickets } from '../../services/publicToiletStorage';
import { updateTicketProgress, setTemporaryClosure } from '../../services/publicToiletService';
import { useToast } from '../../context/ToastContext';

export default function ToiletMaintenanceModal({ facility, onClose, onSuccess }) {
  const { toast } = useToast();
  const [tickets, setTickets] = useState(() => (facility?.id ? loadMaintenanceTickets(facility.id) : []));
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [targetStatus, setTargetStatus] = useState('in_progress');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [closureReason, setClosureReason] = useState(facility?.temporaryClosure?.reason || '');
  const [reopenExpectedAt, setReopenExpectedAt] = useState(facility?.temporaryClosure?.reopenExpectedAt || '');
  const [isClosedToggle, setIsClosedToggle] = useState(Boolean(facility?.temporaryClosure?.isClosed));
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchTickets = () => {
    if (facility?.id) {
      setTickets(loadMaintenanceTickets(facility.id));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!facility) return null;

  const handleUpdateTicket = (e) => {
    e.preventDefault();
    if (!selectedTicketId) return;
    setErrorMessage('');
    setSubmitting(true);

    try {
      updateTicketProgress(selectedTicketId, targetStatus, resolutionNotes, { role: 'operator' });
      toast?.success?.(`Ticket transitioned to ${targetStatus}`);
      fetchTickets();
      setSelectedTicketId('');
      setResolutionNotes('');
      onSuccess?.();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleClosure = (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSubmitting(true);

    try {
      setTemporaryClosure(
        facility.id,
        isClosedToggle
          ? { isClosed: true, reason: closureReason, reopenExpectedAt: reopenExpectedAt || null }
          : { isClosed: false },
        { role: 'operator' }
      );

      toast?.success?.(isClosedToggle ? 'Temporary closure declared.' : 'Temporary closure lifted.');
      onSuccess?.();
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update closure status.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="maint-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-main)',
          borderRadius: '1.25rem',
          maxWidth: '620px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.75rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close maintenance modal"
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: '0.35rem',
          }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <Wrench size={20} style={{ color: 'var(--primary-main)' }} />
          <h2 id="maint-modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Operator Maintenance & Closure Controls
          </h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Facility: <strong>{facility.name}</strong> ({facility.jurisdiction?.ward})
        </p>

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '0.5rem',
              color: 'var(--danger-main, #ef4444)',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Temporary Closure Section */}
        <section style={{ border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem', backgroundColor: 'var(--bg-main)' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Temporary Emergency / Overhaul Closure
          </h3>

          <form onSubmit={handleToggleClosure}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isClosedToggle}
                onChange={(e) => setIsClosedToggle(e.target.checked)}
              />
              <strong>Mark facility as Temporarily Closed</strong>
            </label>

            {isClosedToggle && (
              <>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label htmlFor="closure-reason-input" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    Mandatory Closure Reason
                  </label>
                  <input
                    id="closure-reason-input"
                    type="text"
                    value={closureReason}
                    onChange={(e) => setClosureReason(e.target.value)}
                    required
                    placeholder="e.g. Broken sewer line overhaul"
                    style={{
                      width: '100%',
                      padding: '0.45rem',
                      borderRadius: '0.375rem',
                      border: '1px solid var(--border-main)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label htmlFor="closure-reopen-input" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    Expected Reopening Date/Time (Optional)
                  </label>
                  <input
                    id="closure-reopen-input"
                    type="datetime-local"
                    value={reopenExpectedAt ? reopenExpectedAt.slice(0, 16) : ''}
                    onChange={(e) => setReopenExpectedAt(e.target.value ? new Date(e.target.value).toISOString() : '')}
                    style={{
                      width: '100%',
                      padding: '0.45rem',
                      borderRadius: '0.375rem',
                      border: '1px solid var(--border-main)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              </>
            )}

            <button type="submit" className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }} disabled={submitting}>
              Save Closure State
            </button>
          </form>
        </section>

        {/* Maintenance Work Orders */}
        <section>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Maintenance Tickets ({tickets.length})
          </h3>

          {tickets.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No maintenance tickets logged for this facility.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {tickets.map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: 'var(--bg-main)',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <strong>{t.category.replace(/_/g, ' ').toUpperCase()}</strong>
                    <span
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: t.status === 'resolved' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                        color: t.status === 'resolved' ? 'var(--success-main)' : 'var(--warning-main)',
                      }}
                    >
                      {t.status.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 0.35rem 0', color: 'var(--text-secondary)' }}>{t.description}</p>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Severity: {t.severity.toUpperCase()} | Reported: {new Date(t.createdAt).toLocaleString()}
                  </div>
                  {t.resolutionNotes && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--success-main)', marginTop: '0.25rem' }}>
                      Resolution: {t.resolutionNotes}
                    </div>
                  )}

                  {['reported', 'acknowledged', 'in_progress'].includes(t.status) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTicketId(t.id);
                        setTargetStatus('in_progress');
                      }}
                      className="btn btn-outline"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', marginTop: '0.5rem' }}
                    >
                      Update Work Order Status
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {selectedTicketId && (
            <form onSubmit={handleUpdateTicket} style={{ padding: '0.75rem', border: '1px solid var(--primary-main)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-main)' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--primary-main)' }}>
                Updating Ticket: {selectedTicketId}
              </h4>

              <div style={{ marginBottom: '0.5rem' }}>
                <label htmlFor="ticket-target-status" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  New Status
                </label>
                <select
                  id="ticket-target-status"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem', borderRadius: '0.25rem', border: '1px solid var(--border-main)', fontSize: '0.85rem' }}
                >
                  <option value="acknowledged">Acknowledged</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label htmlFor="ticket-resolution-notes" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Resolution / Progress Notes
                </label>
                <input
                  id="ticket-resolution-notes"
                  type="text"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="e.g. Replaced washer, leak fixed"
                  style={{ width: '100%', padding: '0.4rem', borderRadius: '0.25rem', border: '1px solid var(--border-main)', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }} disabled={submitting}>
                  Save Progress
                </button>
                <button type="button" onClick={() => setSelectedTicketId('')} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

