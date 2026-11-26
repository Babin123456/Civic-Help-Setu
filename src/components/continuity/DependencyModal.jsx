import { useState } from 'react';
import { X } from 'lucide-react';
import { CRITICALITY_TIERS } from '../../services/continuityPlannerService';

export const DependencyModal = ({
  isOpen,
  onClose,
  onSave,
  planId,
  availableServices = [],
}) => {
  const [serviceName, setServiceName] = useState('');
  const [criticality, setCriticality] = useState(CRITICALITY_TIERS.TIER_2_ESSENTIAL);
  const [selectedUpstreams, setSelectedUpstreams] = useState([]);
  const [redundantAlternative, setRedundantAlternative] = useState('');
  const [manualFallbackProcedure, setManualFallbackProcedure] = useState('');
  const [estimatedRestorationHours, setEstimatedRestorationHours] = useState(2);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleToggleUpstream = (sId) => {
    setSelectedUpstreams((prev) =>
      prev.includes(sId) ? prev.filter((id) => id !== sId) : [...prev, sId]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!serviceName.trim()) {
      setError('Service name is required');
      return;
    }

    try {
      onSave({
        planId,
        serviceName: serviceName.trim(),
        criticality,
        upstreamDependencies: selectedUpstreams,
        redundantAlternative: redundantAlternative.trim() || null,
        manualFallbackProcedure: manualFallbackProcedure.trim(),
        estimatedRestorationHours: Number(estimatedRestorationHours) || 2,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save dependency mapping');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dep-modal-title"
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
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-main)',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 id="dep-modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800' }}>
            Map Municipal Service Dependency
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '0.6rem 0.85rem', borderRadius: '0.4rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <div>
          <label style={{ fontSize: '0.82rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>
            Service Name:
          </label>
          <input
            type="text"
            required
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            placeholder="e.g. Municipal Drinking Water Supply"
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '0.4rem',
              border: '1px solid var(--border-main)',
              background: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>
              Criticality Tier:
            </label>
            <select
              value={criticality}
              onChange={(e) => setCriticality(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem',
                borderRadius: '0.4rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            >
              <option value={CRITICALITY_TIERS.TIER_1_CRITICAL}>Tier 1 - Critical (≤4h)</option>
              <option value={CRITICALITY_TIERS.TIER_2_ESSENTIAL}>Tier 2 - Essential (≤24h)</option>
              <option value={CRITICALITY_TIERS.TIER_3_DEFERRED}>Tier 3 - Deferred (&gt;24h)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>
              Est. Restoration (Hours):
            </label>
            <input
              type="number"
              min="1"
              max="72"
              value={estimatedRestorationHours}
              onChange={(e) => setEstimatedRestorationHours(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '0.45rem',
                borderRadius: '0.4rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            />
          </div>
        </div>

        {/* UPSTREAM DEPENDENCIES SELECTOR */}
        {availableServices.length > 0 && (
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>
              Select Upstream Services This Service Depends On:
            </label>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.4rem',
                maxHeight: '120px',
                overflowY: 'auto',
                padding: '0.4rem',
                border: '1px solid var(--border-light)',
                borderRadius: '0.4rem',
                background: 'var(--bg-main)',
              }}
            >
              {availableServices.map((s) => {
                const isSelected = selectedUpstreams.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleToggleUpstream(s.id)}
                    style={{
                      padding: '0.25rem 0.55rem',
                      borderRadius: '99px',
                      fontSize: '0.78rem',
                      border: `1px solid ${isSelected ? 'var(--accent-main)' : 'var(--border-main)'}`,
                      background: isSelected ? 'var(--accent-main)' : 'var(--bg-card)',
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label style={{ fontSize: '0.82rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>
            Redundant Standby Alternative (Optional):
          </label>
          <input
            type="text"
            value={redundantAlternative}
            onChange={(e) => setRedundantAlternative(e.target.value)}
            placeholder="e.g. Auxiliary 500kVA Diesel Generator at Substation"
            style={{
              width: '100%',
              padding: '0.45rem',
              borderRadius: '0.4rem',
              border: '1px solid var(--border-main)',
              background: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: '0.82rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>
            Offline Manual Operating SOP:
          </label>
          <textarea
            rows="3"
            value={manualFallbackProcedure}
            onChange={(e) => setManualFallbackProcedure(e.target.value)}
            placeholder="Step-by-step physical manual procedure when cloud and network connections are down..."
            style={{
              width: '100%',
              padding: '0.45rem',
              borderRadius: '0.4rem',
              border: '1px solid var(--border-main)',
              background: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.85rem' }}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
            Save Dependency
          </button>
        </div>
      </form>
    </div>
  );
};
