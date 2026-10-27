import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  ShieldAlert,
  Send,
  CheckCircle2,
  Lock,
  Info,
} from 'lucide-react';
import {
  BARRIER_CATEGORIES,
  BARRIER_CATEGORY_LABELS,
  BARRIER_SEVERITY,
  NON_ESCALATION_DISCLAIMER,
  redactSensitiveData,
  submitBarrierReport,
} from '../../services/barrierReportService';
import { useToast } from '../../context/ToastContext';

const BarrierReportModal = ({ isOpen, onClose, service }) => {
  const { toast } = useToast();

  const [category, setCategory] = useState(BARRIER_CATEGORIES.INACCESSIBLE_FACILITY);
  const [severity, setSeverity] = useState(BARRIER_SEVERITY.MEDIUM);
  const [description, setDescription] = useState('');
  const [officeLocation, setOfficeLocation] = useState('');
  const [submittedResult, setSubmittedResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !service) return null;

  const detectedPII =
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(description) ||
    /\b[A-Za-z]{5}\d{4}[A-Za-z]{1}\b/.test(description) ||
    /\b(?:\+91[\s-]?)?[6789]\d{9}\b/.test(description);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = submitBarrierReport({
        serviceId: service.id,
        serviceName: service.name,
        department: service.department || 'Public Administration',
        barrierCategory: category,
        description,
        severity,
        officeLocation,
      });

      setSubmittedResult(result);
      toast?.success?.('Barrier report submitted for community moderation.');
    } catch (err) {
      toast?.error?.(err.message || 'Failed to submit barrier report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setSubmittedResult(null);
    setDescription('');
    setOfficeLocation('');
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="barrier-modal-title"
    >
      <div
        className="card-glass animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '620px',
          borderRadius: '1.25rem',
          background: 'var(--bg-card, #111827)',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--glass-bg)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#f59e0b' }}>
              Citizen Obstacle Feedback
            </div>
            <h3 id="barrier-modal-title" style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
              Report Service Barrier: {service.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.4rem',
            }}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1 }}>
          {submittedResult ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem auto',
                }}
              >
                <CheckCircle2 size={32} />
              </div>

              <h4 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Barrier Report Queued
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                Your report has been entered into the moderation queue. Tracking Reference:{' '}
                <strong style={{ color: 'var(--accent-main)' }}>{submittedResult.trackingCode}</strong>
              </p>

              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  textAlign: 'left',
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Info size={16} color="var(--accent-main)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Civic Transparency Notice: </strong>
                    {submittedResult.disclaimer}
                  </div>
                </div>
              </div>

              <button type="button" className="btn btn-primary" onClick={handleResetAndClose}>
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Mandatory Acceptance Criteria: Strict PII Warning Banner */}
              <div
                className="pii-warning-banner"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '0.75rem',
                  padding: '0.85rem 1rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)',
                  lineHeight: '1.45',
                }}
              >
                <ShieldAlert size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
                <div>
                  <strong style={{ color: '#ef4444' }}>Privacy Safeguard (Mandatory): </strong>
                  Do NOT enter your Aadhaar number, PAN card, bank details, phone numbers, or passwords.
                  All submissions are public systemic feedback and undergo automated redaction.
                </div>
              </div>

              {/* Barrier Category Selection */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Select Barrier Category:
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.5rem',
                    background: 'var(--bg-input, #1e293b)',
                    border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                >
                  {Object.entries(BARRIER_CATEGORIES).map(([k, catVal]) => (
                    <option key={catVal} value={catVal}>
                      {BARRIER_CATEGORY_LABELS[catVal]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Severity Selection */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Impact / Severity:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  {Object.entries(BARRIER_SEVERITY).map(([k, sevVal]) => (
                    <button
                      key={sevVal}
                      type="button"
                      onClick={() => setSeverity(sevVal)}
                      style={{
                        padding: '0.4rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        cursor: 'pointer',
                        border:
                          severity === sevVal
                            ? '1px solid var(--accent-main)'
                            : '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                        background:
                          severity === sevVal
                            ? 'rgba(56, 189, 248, 0.15)'
                            : 'var(--bg-card-hover, rgba(255, 255, 255, 0.03))',
                        color: severity === sevVal ? 'var(--accent-main)' : 'var(--text-secondary)',
                      }}
                    >
                      {sevVal}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Office Location / Counter */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Specific Office or Portal URL (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Saket SDM Center, Counter 4 or state portal"
                  value={officeLocation}
                  onChange={(e) => setOfficeLocation(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.5rem',
                    background: 'var(--bg-input, #1e293b)',
                    border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              {/* Description Textarea */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Description of the Barrier (Optional):
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    {description.length}/1000 characters
                  </span>
                </div>
                <textarea
                  rows={4}
                  maxLength={1000}
                  placeholder="Explain what obstacle occurred (e.g. lift out of order, portal payment gateway returning 500 error, official requested unlisted affidavit)."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.5rem',
                    background: 'var(--bg-input, #1e293b)',
                    border: detectedPII
                      ? '1px solid #ef4444'
                      : '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
                {detectedPII && (
                  <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>
                    ⚠️ Potential personal ID or phone number detected. It will be automatically redacted to protect your privacy.
                  </div>
                )}
              </div>

              {/* Disclaimer */}
              <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem' }}>
                {NON_ESCALATION_DISCLAIMER}
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={handleResetAndClose}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Send size={15} />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit to Moderation Queue'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarrierReportModal;
