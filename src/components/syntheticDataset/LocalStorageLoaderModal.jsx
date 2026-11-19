import { useState } from 'react';
import { Database, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { loadArtifactIntoLocalTestEnvironment } from '../../services/syntheticDatasetService';

export default function LocalStorageLoaderModal({ artifactId, bundle, isOpen, onClose, onSuccess }) {
  const [loadServices, setLoadServices] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const handleInject = () => {
    setIsSubmitting(true);
    try {
      const res = loadArtifactIntoLocalTestEnvironment(artifactId, { loadServices });
      setResult(res);
      if (onSuccess) onSuccess(res);
    } catch (err) {
      console.error('Failed to load into local environment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="loader-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--bg-card, #ffffff)',
          borderRadius: '0.85rem',
          border: '1px solid var(--border-light, #cbd5e1)',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={20} color="var(--primary, #2563eb)" aria-hidden="true" />
            <h2 id="loader-modal-title" style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
              Load into Local Dev Environment
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary, #94a3b8)' }}
          >
            <X size={18} />
          </button>
        </div>

        {result ? (
          <div>
            <div
              style={{
                padding: '1rem',
                borderRadius: '0.5rem',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <CheckCircle size={22} color="#059669" aria-hidden="true" />
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#065f46' }}>
                  Successfully Seeded Local Storage!
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#047857' }}>
                  Loaded <strong>{result.loadedServicesCount} synthetic services</strong> into your active service catalog.
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)' }}>
              You can now browse to <code>/services</code> to verify search ranking, checklist modals, and service guides with these generated records.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button type="button" onClick={onClose} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)', margin: '0 0 1rem', lineHeight: 1.45 }}>
              This action injects the generated synthetic entities into your browser’s local storage stores, letting you test real app views without manual data entry.
            </p>

            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                marginBottom: '1.25rem',
                fontSize: '0.8rem',
                color: '#92400e',
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
              <span>
                All injected records are watermarked with <code>isSynthetic: true</code> and will not affect any real citizen accounts or external APIs.
              </span>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                <input
                  type="checkbox"
                  checked={loadServices}
                  onChange={(e) => setLoadServices(e.target.checked)}
                />
                Load {bundle?.services?.length || 0} Synthetic Services into <code>civicbridge_custom_services</code>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInject}
                disabled={isSubmitting || !loadServices}
                className="btn btn-primary"
                style={{ fontSize: '0.85rem' }}
              >
                {isSubmitting ? 'Injecting...' : 'Confirm Injection'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
