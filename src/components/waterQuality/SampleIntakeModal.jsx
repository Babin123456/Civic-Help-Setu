/**
 * src/components/waterQuality/SampleIntakeModal.jsx
 * Modal dialog for field samplers or officials to register a physical sampling event.
 */

import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { SAMPLE_TYPES } from '../../data/waterQualityContract.js';
import { detectProhibitedPII } from '../../services/waterQualityValidation.js';

export default function SampleIntakeModal({
  waterPoint,
  onClose,
  onSubmit,
}) {
  const [sampleType, setSampleType] = useState('routine_surveillance');
  const [collectionDate, setCollectionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sealedContainerCode, setSealedContainerCode] = useState('');
  const [preservationMethod, setPreservationMethod] = useState('Sterile borosilicate bottle on ice pack at 4°C');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!sealedContainerCode.trim()) {
      setError('Sealed container bar code / container identifier is required.');
      return;
    }

    const piiCheck = detectProhibitedPII(`${notes} ${sealedContainerCode}`);
    if (piiCheck) {
      setError(piiCheck);
      return;
    }

    try {
      onSubmit({
        waterPointId: waterPoint.id,
        sampleType,
        collectionDate: new Date(collectionDate).toISOString(),
        sealedContainerCode: sealedContainerCode.trim(),
        preservationMethod,
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record sampling event.');
    }
  };

  return (
    <div
      className="wq-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="intake-modal-title"
    >
      <div className="wq-modal-dialog" style={{ maxWidth: '540px' }}>
        <div className="wq-modal-header">
          <div>
            <h3 id="intake-modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Register Physical Water Sample
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Water Point: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{waterPoint.name}</span> ({waterPoint.id})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="wq-modal-close"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="wq-modal-body">
          {error && (
            <div className="wq-alert-danger">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="wq-form-stack">
            <div className="wq-field-group">
              <label className="wq-field-label">Sample Surveillance Type *</label>
              <select
                value={sampleType}
                onChange={(e) => setSampleType(e.target.value)}
                className="wq-select"
              >
                {Object.entries(SAMPLE_TYPES).map(([key, def]) => (
                  <option key={key} value={key}>
                    {def.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="wq-field-group">
              <label className="wq-field-label">Collection Date *</label>
              <input
                type="date"
                value={collectionDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setCollectionDate(e.target.value)}
                required
                className="wq-input"
              />
            </div>

            <div className="wq-field-group">
              <label className="wq-field-label">Sealed Container Barcode / Identification Number *</label>
              <input
                type="text"
                placeholder="e.g. SEAL-KA-10928"
                value={sealedContainerCode}
                onChange={(e) => setSealedContainerCode(e.target.value)}
                required
                className="wq-input"
                style={{ fontFamily: 'monospace' }}
              />
              <span className="wq-help-text">
                Must be unique for chain of custody verification.
              </span>
            </div>

            <div className="wq-field-group">
              <label className="wq-field-label">Preservation &amp; Chain of Custody Method</label>
              <input
                type="text"
                value={preservationMethod}
                onChange={(e) => setPreservationMethod(e.target.value)}
                className="wq-input"
              />
            </div>

            <div className="wq-field-group">
              <label className="wq-field-label">Field Observations &amp; Notes (Zero PII)</label>
              <textarea
                rows={2}
                placeholder="e.g. Odorless, tap flushed for 3 minutes before taking sample."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="wq-textarea"
              />
            </div>

            <div className="wq-modal-footer" style={{ padding: '0.75rem 0 0 0', background: 'transparent' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary text-xs"
                style={{ padding: '0.45rem 1rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary text-xs"
                style={{ padding: '0.45rem 1rem' }}
              >
                Record Sample Event
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
