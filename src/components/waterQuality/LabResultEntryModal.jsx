/**
 * src/components/waterQuality/LabResultEntryModal.jsx
 * Modal dialog for authorized laboratory analysts to enter verified test results.
 */

import { useState } from 'react';
import { X, AlertCircle, Shield } from 'lucide-react';
import { IS_10500_STANDARDS } from '../../data/waterQualityContract.js';
import { SEED_LAB_CERTIFICATIONS } from '../../data/waterQualitySeed.js';

export default function LabResultEntryModal({
  sampleEventId,
  onClose,
  onSubmit,
}) {
  const [labId, setLabId] = useState(SEED_LAB_CERTIFICATIONS[0]?.labId || '');
  const [analystNotes, setAnalystNotes] = useState('');
  const [error, setError] = useState('');

  // Default values for common parameters to make input rapid
  const [values, setValues] = useState({
    ph: '7.2',
    tds: '280',
    turbidity: '0.8',
    total_hardness: '180',
    e_coli: '0',
    fluoride: '0.6',
    nitrate: '18',
  });

  const handleValueChange = (code, val) => {
    setValues((prev) => ({ ...prev, [code]: val }));
  };

  const defaultParams = [
    'ph',
    'turbidity',
    'tds',
    'total_hardness',
    'chlorides',
    'fluoride',
    'nitrate',
    'e_coli',
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const results = [];
    for (const [code, val] of Object.entries(values)) {
      if (val !== '' && !isNaN(Number(val))) {
        results.push({
          parameterCode: code,
          testedValue: Number(val),
        });
      }
    }

    if (results.length === 0) {
      setError('Please provide at least one valid parameter measurement.');
      return;
    }

    try {
      onSubmit(sampleEventId, {
        labId,
        analystNotes: analystNotes.trim(),
        results,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit lab results.');
    }
  };

  return (
    <div
      className="wq-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lab-entry-modal-title"
    >
      <div className="wq-modal-dialog" style={{ maxWidth: '640px' }}>
        <div className="wq-modal-header">
          <div>
            <h3 id="lab-entry-modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Record Laboratory Test Results
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Sampling Event ID: <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>{sampleEventId}</span>
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
              <label className="wq-field-label">Accredited Laboratory *</label>
              <select
                value={labId}
                onChange={(e) => setLabId(e.target.value)}
                className="wq-select"
              >
                {SEED_LAB_CERTIFICATIONS.map((lab) => (
                  <option key={lab.labId} value={lab.labId}>
                    {lab.name} ({lab.nablAccreditationNo})
                  </option>
                ))}
              </select>
            </div>

            <div className="wq-sub-card">
              <h4 className="wq-sub-card-title">
                <Shield size={16} style={{ color: '#10b981' }} />
                <span>IS 10500:2012 Standard Parameter Measurements</span>
              </h4>

              <div className="wq-grid-2">
                {defaultParams.map((paramCode) => {
                  const param = IS_10500_STANDARDS.parameters[paramCode];
                  return (
                    <div key={paramCode} className="wq-field-group">
                      <label className="wq-field-label" style={{ color: 'var(--text-primary)' }}>
                        {param.name} ({param.unit})
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={values[paramCode] ?? ''}
                        onChange={(e) => handleValueChange(paramCode, e.target.value)}
                        placeholder={`Limit: ${param.acceptableMin}-${param.acceptableMax}`}
                        className="wq-input"
                      />
                      <span className="wq-help-text">
                        Acceptable: {param.acceptableMin} - {param.acceptableMax} {param.unit}
                        {param.relaxationAllowed ? ` (Permissible: ${param.permissibleMax})` : ' (No relaxation)'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="wq-field-group">
              <label className="wq-field-label">Analyst Notes &amp; Certification Rationale</label>
              <textarea
                rows={2}
                placeholder="e.g. Test carried out under calibrated spectrophotometer and incubators."
                value={analystNotes}
                onChange={(e) => setAnalystNotes(e.target.value)}
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
                Verify &amp; Sign Results
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
