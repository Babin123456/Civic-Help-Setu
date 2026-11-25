import { useState, useEffect } from 'react';
import { X, AlertOctagon, Sliders, ShieldCheck } from 'lucide-react';
import { DEFAULT_RISK_WEIGHTS } from '../../data/roadSafetyContract';

export default function RoadSafetyRiskRunModal({
  onClose,
  onExecuteRun,
}) {
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');
  const [freqWeight, setFreqWeight] = useState(DEFAULT_RISK_WEIGHTS.crashFrequencyWeight);
  const [sevWeight, setSevWeight] = useState(DEFAULT_RISK_WEIGHTS.crashSeverityWeight);
  const [infraWeight, setInfraWeight] = useState(DEFAULT_RISK_WEIGHTS.infrastructureHazardWeight);
  const [expoWeight, setExpoWeight] = useState(DEFAULT_RISK_WEIGHTS.exposureDenominatorWeight);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const sum = freqWeight + sevWeight + infraWeight + expoWeight;
    if (Math.abs(sum - 1.0) > 0.05) {
      setErrorMsg(`Parameter weights must sum to approximately 1.0 (Current sum: ${sum.toFixed(2)})`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onExecuteRun({
        startDate,
        endDate,
        weights: {
          crashFrequencyWeight: freqWeight,
          crashSeverityWeight: sevWeight,
          infrastructureHazardWeight: infraWeight,
          exposureDenominatorWeight: expoWeight,
        },
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to execute risk analysis run.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="risk-run-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-main)',
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '580px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-main)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertOctagon size={20} color="var(--accent-main)" />
            <h2 id="risk-run-modal-title" style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              Execute Automated Blackspot Risk Assessment
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close risk run modal"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.35rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div
            role="note"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              padding: '0.65rem 0.85rem',
              borderRadius: '0.5rem',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
            }}
          >
            <ShieldCheck size={16} color="var(--accent-main)" style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>
              <strong>Deterministic MoRTH Evaluation: </strong>
              This run recalculates composite risk scores for all registered road corridors based on verified aggregates, geometry, and lighting audits.
            </span>
          </div>

          {errorMsg && (
            <div
              role="alert"
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '0.5rem',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.8rem',
              }}
            >
              {errorMsg}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label htmlFor="run-start-date" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                Evaluation Window Start *
              </label>
              <input
                id="run-start-date"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '0.45rem',
                  border: '1px solid var(--border-main)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                }}
              />
            </div>

            <div>
              <label htmlFor="run-end-date" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                Evaluation Window End *
              </label>
              <input
                id="run-end-date"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '0.45rem',
                  border: '1px solid var(--border-main)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              <Sliders size={14} color="var(--accent-main)" />
              Algorithm Factor Weights (Sum: {(freqWeight + sevWeight + infraWeight + expoWeight).toFixed(2)})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.78rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                  <span>Crash Frequency Weight</span>
                  <strong>{Math.round(freqWeight * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.6"
                  step="0.05"
                  value={freqWeight}
                  onChange={(e) => setFreqWeight(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                  <span>Crash Severity Weight (Fatal/Severe)</span>
                  <strong>{Math.round(sevWeight * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.6"
                  step="0.05"
                  value={sevWeight}
                  onChange={(e) => setSevWeight(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                  <span>Infrastructure Hazard Weight (Lighting, Crossings)</span>
                  <strong>{Math.round(infraWeight * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.4"
                  step="0.05"
                  value={infraWeight}
                  onChange={(e) => setInfraWeight(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                  <span>Traffic Exposure Denominator Weight</span>
                  <strong>{Math.round(expoWeight * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.3"
                  step="0.05"
                  value={expoWeight}
                  onChange={(e) => setExpoWeight(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '0.45rem',
                background: 'var(--bg-main)',
                border: '1px solid var(--border-main)',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '0.45rem',
                background: 'var(--accent-main)',
                border: 'none',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Evaluating...' : 'Start Assessment Run'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

