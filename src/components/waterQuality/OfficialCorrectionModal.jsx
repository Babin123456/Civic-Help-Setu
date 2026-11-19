/**
 * src/components/waterQuality/OfficialCorrectionModal.jsx
 * Modal dialog for municipal officials to publish a formal correction,
 * superseding previous lab findings with immutable audit trail.
 */

import { useState } from 'react';
import { X, AlertCircle, RefreshCw } from 'lucide-react';
import { IS_10500_STANDARDS } from '../../data/waterQualityContract.js';
import { detectProhibitedPII } from '../../services/waterQualityValidation.js';

export default function OfficialCorrectionModal({
  sampleEventId,
  onClose,
  onSubmit,
}) {
  const [correctionReason, setCorrectionReason] = useState('');
  const [error, setError] = useState('');

  // Corrected parameter values
  const [correctedValues, setCorrectedValues] = useState({
    ph: '7.3',
    tds: '260',
    turbidity: '0.7',
    total_hardness: '160',
    e_coli: '0',
  });

  const handleValueChange = (code, val) => {
    setCorrectedValues((prev) => ({ ...prev, [code]: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!correctionReason.trim() || correctionReason.trim().length < 15) {
      setError('A substantive statutory reason for correction (at least 15 characters) is required.');
      return;
    }

    const piiCheck = detectProhibitedPII(correctionReason);
    if (piiCheck) {
      setError(`Correction reason: ${piiCheck}`);
      return;
    }

    const correctedResults = [];
    for (const [code, val] of Object.entries(correctedValues)) {
      if (val !== '' && !isNaN(Number(val))) {
        correctedResults.push({
          parameterCode: code,
          testedValue: Number(val),
        });
      }
    }

    if (correctedResults.length === 0) {
      setError('Please provide at least one corrected parameter measurement.');
      return;
    }

    try {
      onSubmit(sampleEventId, {
        correctionReason: correctionReason.trim(),
        correctedResults,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to publish correction.');
    }
  };

  return (
    <div
      className="wq-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="correction-modal-title"
    >
      <div className="wq-modal-dialog" style={{ maxWidth: '580px' }}>
        <div className="wq-modal-header">
          <div>
            <h3 id="correction-modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <RefreshCw size={18} style={{ color: '#f59e0b' }} />
              <span>Publish Official Result Correction</span>
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Target Event: <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>{sampleEventId}</span>
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
            <div className="wq-alert-warning">
              <div>
                <strong>Statutory Audit Requirement:</strong> Publishing a correction supersedes previously published lab readings, marks them as superseded in public records, and stamps an immutable audit entry with your rationale.
              </div>
            </div>

            <div className="wq-field-group">
              <label className="wq-field-label">Official Reason for Correction &amp; Audit Rationale *</label>
              <textarea
                rows={3}
                placeholder="e.g. Recalibration of laboratory nephelometer conducted. Confirmatory re-test performed by Chief Analyst."
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                required
                className="wq-textarea"
              />
            </div>

            <div className="wq-sub-card">
              <h4 className="wq-sub-card-title">
                Corrected Parameter Values (IS 10500:2012)
              </h4>

              <div className="wq-grid-2">
                {Object.keys(correctedValues).map((code) => {
                  const param = IS_10500_STANDARDS.parameters[code];
                  return (
                    <div key={code} className="wq-field-group">
                      <label className="wq-field-label" style={{ color: 'var(--text-primary)' }}>
                        {param.name} ({param.unit})
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={correctedValues[code]}
                        onChange={(e) => handleValueChange(code, e.target.value)}
                        className="wq-input"
                      />
                    </div>
                  );
                })}
              </div>
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
                style={{ padding: '0.45rem 1rem', background: '#d97706', borderColor: '#d97706' }}
              >
                Publish Correction
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
