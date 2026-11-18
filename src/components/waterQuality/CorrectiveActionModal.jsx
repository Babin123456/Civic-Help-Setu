/**
 * src/components/waterQuality/CorrectiveActionModal.jsx
 * Modal dialog for officials to log and sanction remedial corrective actions.
 */

import { useState } from 'react';
import { X, AlertCircle, Wrench } from 'lucide-react';
import { CORRECTIVE_ACTION_TYPES } from '../../data/waterQualityContract.js';
import { detectProhibitedPII } from '../../services/waterQualityValidation.js';

export default function CorrectiveActionModal({
  waterPoint,
  onClose,
  onSubmit,
}) {
  const [actionType, setActionType] = useState('chlorination_shock');
  const [targetCompletionDate, setTargetCompletionDate] = useState(() =>
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );
  const [assignedDepartment, setAssignedDepartment] = useState('Municipal Water Supply & Public Health Division');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!description.trim() || description.trim().length < 15) {
      setError('A substantive description of the corrective action (at least 15 characters) is required.');
      return;
    }

    const piiCheck = detectProhibitedPII(description);
    if (piiCheck) {
      setError(piiCheck);
      return;
    }

    try {
      onSubmit({
        waterPointId: waterPoint.id,
        actionType,
        targetCompletionDate,
        assignedDepartment: assignedDepartment.trim(),
        description: description.trim(),
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to sanction corrective action.');
    }
  };

  return (
    <div
      className="wq-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="corrective-modal-title"
    >
      <div className="wq-modal-dialog" style={{ maxWidth: '540px' }}>
        <div className="wq-modal-header">
          <div>
            <h3 id="corrective-modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Wrench size={18} style={{ color: '#f59e0b' }} />
              <span>Sanction Remedial Corrective Action</span>
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
              <label className="wq-field-label">Remediation Action Type *</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="wq-select"
              >
                {Object.entries(CORRECTIVE_ACTION_TYPES).map(([key, def]) => (
                  <option key={key} value={key}>
                    {def.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="wq-field-group">
              <label className="wq-field-label">Target Completion Date *</label>
              <input
                type="date"
                value={targetCompletionDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setTargetCompletionDate(e.target.value)}
                required
                className="wq-input"
              />
            </div>

            <div className="wq-field-group">
              <label className="wq-field-label">Assigned Municipal Department *</label>
              <input
                type="text"
                value={assignedDepartment}
                onChange={(e) => setAssignedDepartment(e.target.value)}
                required
                className="wq-input"
              />
            </div>

            <div className="wq-field-group">
              <label className="wq-field-label">Action Description &amp; Scope of Work *</label>
              <textarea
                rows={3}
                placeholder="e.g. Flush distribution line with 50 mg/L chlorine solution. Verify zero coliform count before reopening."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
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
                style={{ padding: '0.45rem 1rem', background: '#d97706', borderColor: '#d97706' }}
              >
                Sanction Action
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
