import { useState, useEffect } from 'react';
import { X, Wrench, AlertCircle } from 'lucide-react';
import { INTERVENTION_TYPES, INTERVENTION_TYPE_LABELS } from '../../data/roadSafetyContract';

export default function RoadSafetyInterventionModal({
  selectedCase,
  onClose,
  onSubmitIntervention,
}) {
  const [interventionType, setInterventionType] = useState('rumble_strips');
  const [description, setDescription] = useState('');
  const [targetCompletionDate, setTargetCompletionDate] = useState('');
  const [completedDate, setCompletedDate] = useState('');
  const [costEstimateInr, setCostEstimateInr] = useState('');
  const [contractor, setContractor] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!selectedCase) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!description.trim() || description.trim().length < 10) {
      setErrorMsg('Please enter at least 10 characters detailing the engineering countermeasure.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitIntervention(selectedCase.id, {
        interventionType,
        description: description.trim(),
        targetCompletionDate,
        completedDate: completedDate || null,
        costEstimateInr: costEstimateInr ? Number(costEstimateInr) : 0,
        contractor: contractor.trim(),
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to record intervention.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="intervention-modal-title"
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
          maxWidth: '650px',
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
            <Wrench size={20} color="#f59e0b" />
            <h2 id="intervention-modal-title" style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              Plan Engineering Countermeasure
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close intervention modal"
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
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
            Target Corridor: <strong style={{ color: 'var(--text-primary)' }}>{selectedCase.segment?.name}</strong>.
          </p>

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
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label htmlFor="int-type" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              Statutory Countermeasure Type *
            </label>
            <select
              id="int-type"
              required
              value={interventionType}
              onChange={(e) => setInterventionType(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: '0.45rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            >
              {Object.entries(INTERVENTION_TYPES).map(([k, v]) => (
                <option key={k} value={v}>
                  {INTERVENTION_TYPE_LABELS[v] || v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="int-desc" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              Detailed Engineering Scope of Works (Min 10 characters) *
            </label>
            <textarea
              id="int-desc"
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Specify technical specifications (e.g. 5mm thermoplastic bar markings, 15m high-mast pole, pedestrian refuge island geometry)..."
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label htmlFor="int-cost" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                Estimated Cost (INR ₹)
              </label>
              <input
                id="int-cost"
                type="number"
                min="0"
                step="1000"
                value={costEstimateInr}
                onChange={(e) => setCostEstimateInr(e.target.value)}
                placeholder="e.g. 350000"
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
              <label htmlFor="int-contractor" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                Executing Agency / Contractor
              </label>
              <input
                id="int-contractor"
                type="text"
                value={contractor}
                onChange={(e) => setContractor(e.target.value)}
                placeholder="e.g. State PWD / Municipal Engineering Division"
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label htmlFor="int-target-date" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                Target Completion Date
              </label>
              <input
                id="int-target-date"
                type="date"
                value={targetCompletionDate}
                onChange={(e) => setTargetCompletionDate(e.target.value)}
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
              <label htmlFor="int-completed-date" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                Actual Completed Date (If Done)
              </label>
              <input
                id="int-completed-date"
                type="date"
                value={completedDate}
                onChange={(e) => setCompletedDate(e.target.value)}
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
                background: '#f59e0b',
                border: 'none',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Recording...' : 'Record Countermeasure'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

