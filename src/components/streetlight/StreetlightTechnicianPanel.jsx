import { useState } from 'react';
import {
  Wrench,
  CheckCircle2,
  Trash2,
  Camera,
} from 'lucide-react';
import {
  RESOLUTION_ACTIONS,
  RESOLUTION_ACTION_LABELS,
  WORK_ORDER_STATUS,
} from '../../services/streetlightConstants';
import { PARTS_CATALOG } from '../../data/streetlightSeedData';
import { StreetlightStatusBadge } from './StreetlightStates';

export default function StreetlightTechnicianPanel({
  workOrders = [],
  onUpdateStatus,
  onRecordRepair,
}) {
  const [activeWorkOrder, setActiveWorkOrder] = useState(null);
  const [resolutionAction, setResolutionAction] = useState(RESOLUTION_ACTIONS.BULB_DRIVER_REPLACED);
  const [selectedParts, setSelectedParts] = useState([]);
  const [technicianNotes, setTechnicianNotes] = useState('');
  const photoMockName = 'repair_proof_onsite.jpg';
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddPart = (partNumber) => {
    const existingIndex = selectedParts.findIndex((p) => p.partNumber === partNumber);
    if (existingIndex >= 0) {
      const updated = [...selectedParts];
      updated[existingIndex].quantity += 1;
      setSelectedParts(updated);
    } else {
      const catalogItem = PARTS_CATALOG.find((p) => p.partNumber === partNumber);
      if (catalogItem) {
        setSelectedParts([
          ...selectedParts,
          { partNumber: catalogItem.partNumber, description: catalogItem.description, quantity: 1 },
        ]);
      }
    }
  };

  const handleRemovePart = (partNumber) => {
    setSelectedParts(selectedParts.filter((p) => p.partNumber !== partNumber));
  };

  const handleQuantityChange = (partNumber, qty) => {
    const num = Math.max(1, Number(qty) || 1);
    setSelectedParts(
      selectedParts.map((p) => (p.partNumber === partNumber ? { ...p, quantity: num } : p))
    );
  };

  const handleRepairSubmit = (e) => {
    e.preventDefault();
    if (!activeWorkOrder) return;
    setError('');

    setIsSubmitting(true);
    try {
      onRecordRepair({
        workOrderId: activeWorkOrder.id,
        resolutionAction,
        partsReplaced: selectedParts,
        technicianNotes,
        photoChecksum: `sha256_${Date.now().toString(16)}`,
      });
      setActiveWorkOrder(null);
      setSelectedParts([]);
      setTechnicianNotes('');
    } catch (err) {
      setError(err?.message || 'Failed to record repair outcome.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="streetlight-technician-panel" style={{ display: 'grid', gap: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <Wrench size={20} style={{ color: 'var(--accent-main)' }} aria-hidden="true" />
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
          Technician Field Work Orders & Repair Outcome Logging
        </h2>
      </div>

      {workOrders.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: '0.5rem', border: '1px solid var(--border-main)', color: 'var(--text-secondary)' }}>
          No active work orders currently assigned to your crew.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {workOrders.map((wo) => {
            const isCompleted = wo.status === WORK_ORDER_STATUS.RESOLVED || wo.status === WORK_ORDER_STATUS.CLOSED;

            return (
              <article
                key={wo.id}
                className="card"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  borderLeft: `4px solid ${isCompleted ? '#16a34a' : 'var(--accent-main)'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      {wo.id}
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{wo.jurisdictionId}</span>
                  </div>
                  <StreetlightStatusBadge status={wo.status} type="workOrder" />
                </div>

                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    Assigned Crew: {wo.assignedTechnicianName || wo.assignedTechnicianId}
                  </div>
                  {wo.dispatchNotes && (
                    <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.25rem', background: 'var(--bg-surface)', border: '1px solid var(--border-main)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Dispatch Instruction:</strong> {wo.dispatchNotes}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.775rem', color: 'var(--text-tertiary)', marginTop: '0.4rem' }}>
                    <span>Target SLA: {wo.targetSlaHours}h</span>
                    <span>• Scheduled: {wo.scheduledDate}</span>
                  </div>
                </div>

                {/* Workflow Transitions */}
                {!isCompleted && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', borderTop: '1px solid var(--border-main)', paddingTop: '0.75rem' }}>
                    {wo.status === WORK_ORDER_STATUS.DISPATCHED && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(wo.id, WORK_ORDER_STATUS.ACKNOWLEDGED, 'Crew acknowledged assignment')}
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          padding: '0.4rem 0.75rem',
                          borderRadius: '0.375rem',
                          border: '1px solid var(--border-main)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        Acknowledge Order
                      </button>
                    )}

                    {(wo.status === WORK_ORDER_STATUS.ACKNOWLEDGED || wo.status === WORK_ORDER_STATUS.PARTS_PENDING) && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(wo.id, WORK_ORDER_STATUS.ON_SITE, 'Crew arrived at corridor')}
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          padding: '0.4rem 0.75rem',
                          borderRadius: '0.375rem',
                          border: '1px solid var(--border-main)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        Mark On-Site
                      </button>
                    )}

                    {wo.status === WORK_ORDER_STATUS.ON_SITE && (
                      <>
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(wo.id, WORK_ORDER_STATUS.PARTS_PENDING, 'Awaiting driver replacement module')}
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            padding: '0.4rem 0.75rem',
                            borderRadius: '0.375rem',
                            border: '1px solid var(--border-main)',
                            background: 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                          }}
                        >
                          Request Parts
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveWorkOrder(wo)}
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            padding: '0.4rem 0.85rem',
                            borderRadius: '0.375rem',
                            background: '#16a34a',
                            border: '1px solid #22c55e',
                            color: '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <CheckCircle2 size={14} aria-hidden="true" style={{ marginRight: '0.3rem' }} />
                          Log Repair & Complete Order
                        </button>
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Repair Outcome Modal */}
      {activeWorkOrder && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="repair-modal-title"
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '560px',
              background: 'var(--bg-card, #121212)',
              color: 'var(--text-primary)',
              borderRadius: '0.85rem',
              border: '1px solid var(--border-main)',
              padding: '1.5rem',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-main)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={20} style={{ color: '#16a34a' }} aria-hidden="true" />
                <h3 id="repair-modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Record Repair Outcome & Material Consumed
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveWorkOrder(null)}
                style={{
                  padding: '0.35rem',
                  borderRadius: '50%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-main)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {error && (
              <div style={{ padding: '0.6rem 0.8rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '0.4rem', fontSize: '0.825rem', marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleRepairSubmit}>
              <div style={{ display: 'grid', gap: '0.85rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                    Primary Resolution Action *
                  </label>
                  <select
                    value={resolutionAction}
                    onChange={(e) => setResolutionAction(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.65rem',
                      borderRadius: '0.4rem',
                      border: '1px solid var(--border-main)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  >
                    {Object.entries(RESOLUTION_ACTIONS).map(([key, val]) => (
                      <option key={key} value={val} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                        {RESOLUTION_ACTION_LABELS[val]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Parts Consumed Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                    Parts & Materials Consumed
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <select
                      id="parts-catalog-select"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddPart(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '0.5rem 0.65rem',
                        borderRadius: '0.4rem',
                        border: '1px solid var(--border-main)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                      }}
                    >
                      <option value="" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>-- Add part from municipal catalog --</option>
                      {PARTS_CATALOG.map((p) => (
                        <option key={p.partNumber} value={p.partNumber} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                          {p.partNumber} - {p.description} (₹{p.unitCost})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedParts.length > 0 && (
                    <div style={{ border: '1px solid var(--border-main)', background: 'var(--bg-surface)', borderRadius: '0.4rem', padding: '0.5rem', display: 'grid', gap: '0.4rem' }}>
                      {selectedParts.map((part) => (
                        <div key={part.partNumber} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                          <span style={{ flex: 1, color: 'var(--text-primary)' }}>{part.description}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <input
                              type="number"
                              min="1"
                              value={part.quantity}
                              onChange={(e) => handleQuantityChange(part.partNumber, e.target.value)}
                              style={{
                                width: '55px',
                                padding: '0.25rem 0.45rem',
                                borderRadius: '4px',
                                border: '1px solid var(--border-main)',
                                background: 'var(--bg-card)',
                                color: 'var(--text-primary)',
                                fontSize: '0.8rem',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemovePart(part.partNumber)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Technician Notes */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                    Repair Notes & Verification Details
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Cleared moisture in base junction box, tested illumination for 15 mins..."
                    value={technicianNotes}
                    onChange={(e) => setTechnicianNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.65rem',
                      borderRadius: '0.4rem',
                      border: '1px solid var(--border-main)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>

                {/* Simulated Photo Evidence */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                    On-Site Photographic Evidence (Simulated)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem', background: 'var(--bg-surface)', border: '1px dashed var(--border-main)', borderRadius: '0.4rem' }}>
                    <Camera size={18} style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{photoMockName}</span>
                    <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, marginLeft: 'auto' }}>
                      Verified Checksum
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid var(--border-main)', paddingTop: '0.85rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveWorkOrder(null)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-main)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    background: '#16a34a',
                    border: '1px solid #22c55e',
                    color: '#ffffff',
                    padding: '0.45rem 1rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {isSubmitting ? 'Recording...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
