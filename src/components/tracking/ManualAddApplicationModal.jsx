import { useState, useRef } from 'react';
import { X, PlusCircle, FileText, Calendar, Tag, AlertCircle } from 'lucide-react';
import { addManualApplication, DUPLICATE_APPLICATION } from '../../services/trackingService';
import { useToast } from '../../context/ToastContext';
import { logDiagnostic } from '../../utils/diagnostics';

const ManualAddApplicationModal = ({
  isOpen,
  onClose,
  onApplicationAdded = () => {},
}) => {
  const { toast } = useToast();
  const [referenceId, setReferenceId] = useState('');
  const [referenceError, setReferenceError] = useState('');
  const referenceInputRef = useRef(null);
  const [serviceName, setServiceName] = useState('');
  const [category, setCategory] = useState('Certificates');
  const [appliedDate, setAppliedDate] = useState(
    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  );
  const [estimatedCompletion, setEstimatedCompletion] = useState('');
  const [status, setStatus] = useState('submitted');
  const [initialNote, setInitialNote] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!referenceId.trim() || !serviceName.trim()) {
      toast.warning('Please enter both a reference ID and the service name.');
      return;
    }

    setReferenceError('');

    try {
      const created = addManualApplication({
        referenceId,
        serviceName,
        category,
        appliedDate,
        estimatedCompletion,
        status,
        initialNote,
      });

      toast.success(`Application ${created.id} registered for tracking!`);
      onApplicationAdded(created);
      onClose();
    } catch (err) {
      if (err?.code === DUPLICATE_APPLICATION) {
        setReferenceError(err.message);
        referenceInputRef.current?.focus();
        return;
      }
      logDiagnostic('Could not add the application', err);
      toast.error('Failed to register application.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        className="card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '540px',
          padding: '2rem',
          borderRadius: '1.25rem',
          background: 'var(--bg-card, #131b2e)',
          border: '1px solid var(--border-main)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <PlusCircle size={22} color="var(--accent-main)" />
            <h3 style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0 }}>
              Add Tracked Application
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Enter reference details from physical municipal offices, MeeSeva, MahaOnline, or state e-District portals.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem' }}>
              Reference ID / Acknowledgment Number *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. EDIST-2026-98124 or SRV-88219"
              value={referenceId}
              onChange={(e) => {
                setReferenceId(e.target.value);
                if (referenceError) setReferenceError('');
              }}
              ref={referenceInputRef}
              required
              aria-invalid={referenceError ? 'true' : undefined}
              aria-describedby={referenceError ? 'reference-id-error' : undefined}
              style={{ width: '100%' }}
            />
            {referenceError && (
              <p
                id="reference-id-error"
                role="alert"
                style={{ color: 'var(--danger, #ef4444)', fontSize: '0.8rem', margin: '0.4rem 0 0' }}
              >
                {referenceError}
              </p>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem' }}>
              Civic Service Name *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Domicile Certificate, Water Pipeline Connection"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem' }}>
                Category
              </label>
              <select
                className="input-field"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="Certificates">Certificates</option>
                <option value="Finance">Finance & Revenue</option>
                <option value="Transport">Transport / RTO</option>
                <option value="Identity">Identity / Citizen</option>
                <option value="Utilities">Utilities & Municipal</option>
                <option value="Welfare">Welfare & Schemes</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem' }}>
                Current Status
              </label>
              <select
                className="input-field"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="submitted">Submitted</option>
                <option value="in-progress">In-Progress / Under Review</option>
                <option value="action-required">Action Required</option>
                <option value="completed">Completed / Approved</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem' }}>
                Applied Date
              </label>
              <input
                type="text"
                className="input-field"
                value={appliedDate}
                onChange={(e) => setAppliedDate(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem' }}>
                Target Completion Date
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Nov 15, 2026"
                value={estimatedCompletion}
                onChange={(e) => setEstimatedCompletion(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem' }}>
              Personal Note / Officer Details
            </label>
            <textarea
              className="input-field"
              placeholder="e.g., Handed over form to counter #4; fee receipt token #42 attached."
              value={initialNote}
              onChange={(e) => setInitialNote(e.target.value)}
              rows={3}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ padding: '0.6rem 1.25rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '0.6rem 1.5rem' }}
            >
              Save Application
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualAddApplicationModal;
