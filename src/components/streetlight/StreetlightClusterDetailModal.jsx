import { useState } from 'react';
import {
  X,
  Wrench,
  ShieldCheck,
  Edit3,
} from 'lucide-react';
import {
  StreetlightPriorityBadge,
  StreetlightStatusBadge,
} from './StreetlightStates';
import {
  PRIORITY_TIERS,
  PRIORITY_TIER_LABELS,
  ASSET_STATUS_LABELS,
} from '../../services/streetlightConstants';
import { canStreetlight } from '../../services/streetlightAccessControl';

export default function StreetlightClusterDetailModal({
  cluster,
  onClose,
  onTriageOverride,
  onDispatchWorkOrder,
  activeActor,
}) {
  const [isEditingPriority, setIsEditingPriority] = useState(false);
  const [selectedTier, setSelectedTier] = useState(cluster?.priorityTier || 'high');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState('');

  if (!cluster) return null;

  const canOverride = canStreetlight('cluster.override', activeActor);
  const canDispatch = canStreetlight('workOrder.create', activeActor);
  const isResolved = cluster.status === 'resolved';

  const handleSaveOverride = (e) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      setOverrideError('Please provide an explicit operational reason for this priority override.');
      return;
    }
    setOverrideError('');
    onTriageOverride(cluster.id, {
      priorityTier: selectedTier,
      overrideReason,
    });
    setIsEditingPriority(false);
  };

  return (
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
      aria-labelledby="cluster-detail-title"
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '750px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-card, #121212)',
          color: 'var(--text-primary)',
          borderRadius: '0.85rem',
          border: '1px solid var(--border-main)',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
            borderBottom: '1px solid var(--border-main)',
            paddingBottom: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {cluster.id}
              </span>
              <StreetlightPriorityBadge tier={cluster.priorityTier} score={cluster.priorityScore} />
              <StreetlightStatusBadge status={cluster.status} type="cluster" />
            </div>
            <h2 id="cluster-detail-title" style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              {cluster.corridorName}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.4rem',
              borderRadius: '50%',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-main)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close details"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Corridor Meta */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-main)',
            borderRadius: '0.5rem',
            marginBottom: '1.25rem',
            fontSize: '0.85rem',
          }}
        >
          <div>
            <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Ward Jurisdiction</span>
            <strong>{cluster.jurisdictionId}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Poles in Corridor</span>
            <strong>{cluster.poleCount || cluster.assetIds?.length || 1} Streetlights</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Centroid Coordinates</span>
            <strong>{cluster.centroid ? `${cluster.centroid.lat}, ${cluster.centroid.lng}` : 'N/A'}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Active Work Order</span>
            <strong>{cluster.assignedWorkOrderId || 'None Assigned'}</strong>
          </div>
        </div>

        {/* Explainability Breakdown Section */}
        <section style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldCheck size={18} style={{ color: 'var(--accent-main)' }} aria-hidden="true" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Prioritization Scoring Explainability
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
              Ruleset: {cluster.explainability?.rulesetVersion || 'v1.0.0'}
            </span>
          </div>

          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem' }}>
            Deterministic ranking derived from outage persistence, streetlight density, and verified public safety contexts (hospitals, pedestrian crossings, transit stops).
          </p>

          <div style={{ border: '1px solid var(--border-main)', borderRadius: '0.5rem', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-main)', color: 'var(--text-primary)' }}>
                  <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Factor Category</th>
                  <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Observed Context & Field Impact</th>
                  <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, width: '90px' }}>Contribution</th>
                </tr>
              </thead>
              <tbody>
                {cluster.explainability?.factors?.map((f, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-main)' }}>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {f.field}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-secondary)' }}>
                      {f.impact}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--accent-main)' }}>
                      +{f.points} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Human-in-the-Loop Override Section */}
        {canOverride && !isResolved && (
          <section
            style={{
              padding: '1rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-main)',
              borderRadius: '0.6rem',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                <Edit3 size={16} aria-hidden="true" />
                Human Priority Review & Override
              </div>
              {!isEditingPriority && (
                <button
                  type="button"
                  onClick={() => setIsEditingPriority(true)}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.25rem 0.55rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-main)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  Edit Priority Tier
                </button>
              )}
            </div>

            {cluster.overrideLog && (
              <div style={{ fontSize: '0.8rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '0.4rem 0.6rem', borderRadius: '4px', marginBottom: '0.5rem' }}>
                <strong>Prior Override:</strong> {cluster.overrideLog.reason} (by {cluster.overrideLog.operatorId} at {new Date(cluster.overrideLog.overriddenAt).toLocaleString()})
              </div>
            )}

            {isEditingPriority && (
              <form onSubmit={handleSaveOverride} style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                      Target Priority Tier
                    </label>
                    <select
                      value={selectedTier}
                      onChange={(e) => setSelectedTier(e.target.value)}
                      style={{
                        padding: '0.4rem 0.6rem',
                        borderRadius: '4px',
                        border: '1px solid var(--border-main)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        width: '100%',
                        fontSize: '0.85rem',
                      }}
                    >
                      {Object.entries(PRIORITY_TIERS).map(([key, val]) => (
                        <option key={key} value={val} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                          {PRIORITY_TIER_LABELS[val]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                      Operational Reason for Override (Mandatory)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Near critical medical cold-storage or upcoming school exam center route"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      style={{
                        padding: '0.45rem 0.6rem',
                        borderRadius: '4px',
                        border: '1px solid var(--border-main)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        width: '100%',
                        fontSize: '0.85rem',
                      }}
                    />
                    {overrideError && <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.2rem', display: 'block' }}>{overrideError}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="submit"
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      padding: '0.35rem 0.8rem',
                      borderRadius: '4px',
                      background: 'var(--accent-main)',
                      border: '1px solid var(--accent-main)',
                      color: '#050505',
                      cursor: 'pointer',
                    }}
                  >
                    Save Override
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingPriority(false);
                      setOverrideError('');
                    }}
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '4px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-main)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        {/* Member Poles & Reports */}
        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
            Constituent Streetlight Poles & Reports
          </h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {cluster.assets?.map((asset) => (
              <div
                key={asset.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid var(--border-main)',
                  borderRadius: '0.4rem',
                  background: 'var(--bg-surface)',
                  fontSize: '0.825rem',
                }}
              >
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>{asset.id}</strong> — <span style={{ color: 'var(--text-secondary)' }}>{asset.street} ({asset.poleType})</span>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                    {asset.landmark || 'Near corridor marker'}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: asset.operationalStatus === 'dark' ? '#ef4444' : '#f59e0b',
                  }}
                >
                  {ASSET_STATUS_LABELS[asset.operationalStatus] || asset.operationalStatus}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-main)', paddingTop: '1rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--border-main)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
          {canDispatch && !isResolved && cluster.status !== 'work_order_created' && cluster.status !== 'in_progress' && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onDispatchWorkOrder(cluster);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: '#2563eb',
                border: '1px solid #3b82f6',
                color: '#ffffff',
                padding: '0.45rem 0.95rem',
                borderRadius: '0.375rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Wrench size={15} aria-hidden="true" />
              Dispatch Work Order
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
