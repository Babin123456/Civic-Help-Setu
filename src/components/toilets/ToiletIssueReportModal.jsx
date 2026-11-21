import { useState, useEffect, useRef } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { TICKET_CATEGORIES, TICKET_SEVERITY, containsPII } from '../../data/publicToiletContract';
import { reportMaintenanceIssue, submitFeedback } from '../../services/publicToiletService';
import { useToast } from '../../context/ToastContext';

const CATEGORY_DISPLAY_NAMES = {
  [TICKET_CATEGORIES.PLUMBING_LEAK]: 'Plumbing / Pipe Leak',
  [TICKET_CATEGORIES.CLOGGED_DRAIN]: 'Clogged Drain / Overflow',
  [TICKET_CATEGORIES.BROKEN_FIXTURE]: 'Broken Tap / Flush / Washbasin',
  [TICKET_CATEGORIES.LIGHTING_ELECTRICAL]: 'Lighting / Electrical Fault',
  [TICKET_CATEGORIES.DOOR_LOCK_BROKEN]: 'Broken Door Lock / Latch',
  [TICKET_CATEGORIES.WATER_OUTAGE]: 'No Running Water (Water Outage)',
  [TICKET_CATEGORIES.CONSUMABLES_EMPTY]: 'Soap / Sanitizer Empty',
  [TICKET_CATEGORIES.HYGIENE_CLEANLINESS]: 'Severe Hygiene / Cleanliness Defect',
  [TICKET_CATEGORIES.STRUCTURAL_DAMAGE]: 'Structural / Floor Damage',
};

export default function ToiletIssueReportModal({ facility, onClose, onSuccess }) {
  const { toast } = useToast();
  const [reportMode, setReportMode] = useState('ticket'); // 'ticket' or 'feedback'
  const [category, setCategory] = useState(TICKET_CATEGORIES.HYGIENE_CLEANLINESS);
  const [severity, setSeverity] = useState(TICKET_SEVERITY.MEDIUM);
  const [rating, setRating] = useState(3);
  const [cleanlinessLevel, setCleanlinessLevel] = useState('clean');
  const [description, setDescription] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [receiptResult, setReceiptResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const submission = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!facility) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (honeypot) {
      setErrorMessage('Automated submission rejected.');
      return;
    }

    if (description.trim().length < 5) {
      setErrorMessage('Please provide a brief description (at least 5 characters).');
      return;
    }

    if (containsPII(description)) {
      setErrorMessage('Please remove personal information (phone numbers, Aadhaar, PAN, email) from your report.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        facilityId: facility.id,
        reportType: reportMode === 'ticket' ? 'maintenance_issue' : 'citizen_feedback',
        category, description,
        ...(reportMode === 'feedback' ? { rating, cleanlinessLevel } : { severity }),
      };
      const fingerprint = JSON.stringify(payload);
      if (submission.current?.fingerprint !== fingerprint) {
        submission.current = { fingerprint, key: crypto.randomUUID() };
      }
      const response = await fetch('/api/public-toilets', {
        method: 'POST', headers: {
          'Content-Type': 'application/json', 'Idempotency-Key': submission.current.key,
        }, body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.receiptSeal || !result.submittedAt) {
        throw new Error('The report could not be saved. Please retry; your report has not been confirmed.');
      }
      // The server receipt is authoritative. Local directory state is a best-effort mirror.
      try {

      if (reportMode === 'ticket') {
        reportMaintenanceIssue(
          {
            facilityId: facility.id,
            category,
            severity,
            description,
          },
          { role: 'citizen' }
        );
      } else {
        submitFeedback({
          facilityId: facility.id,
          rating,
          cleanlinessLevel,
          comment: description,
          idempotencyKey: submission.current.key,
        });
      }

      } catch { /* A local mirror failure must not invalidate the durable receipt. */ }
      setReceiptResult({
        seal: result.receiptSeal,
        timestamp: result.submittedAt,
        mode: reportMode,
      });

      toast?.success?.('Report filed successfully.');
      onSuccess?.();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-main)',
          borderRadius: '1.25rem',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.75rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close report modal"
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: '0.35rem',
          }}
        >
          <X size={20} />
        </button>

        <h2 id="report-modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          Report Issue or Cleanliness Observation
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          Facility: <strong>{facility.name}</strong> ({facility.jurisdiction?.ward})
        </p>

        {receiptResult ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <CheckCircle2 size={48} style={{ color: 'var(--success-main, #22c55e)', margin: '0 auto 1rem auto' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Submission Recorded & Queued
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Your report has been saved for administrator review.
            </p>
            <div
              style={{
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-main)',
                borderRadius: '0.75rem',
                padding: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tracking Receipt
              </div>
              <code style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-main)', display: 'block', margin: '0.35rem 0' }}>
                {receiptResult.seal}
              </code>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Timestamp: {new Date(receiptResult.timestamp).toLocaleString()}
              </div>
            </div>
            <button type="button" onClick={onClose} className="btn btn-primary" style={{ width: '100%' }}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Mode Toggle */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setReportMode('ticket')}
                className={`btn ${reportMode === 'ticket' ? 'btn-primary' : 'btn-outline'}`}
                style={{ flex: 1, fontSize: '0.85rem' }}
              >
                Maintenance Issue
              </button>
              <button
                type="button"
                onClick={() => setReportMode('feedback')}
                className={`btn ${reportMode === 'feedback' ? 'btn-primary' : 'btn-outline'}`}
                style={{ flex: 1, fontSize: '0.85rem' }}
              >
                Citizen Rating & Review
              </button>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div
                role="alert"
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '0.5rem',
                  color: 'var(--danger-main, #ef4444)',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                }}
              >
                {errorMessage}
              </div>
            )}

            {/* Honeypot hidden input */}
            <input
              type="text"
              name="bot_trap_honey"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              style={{ display: 'none' }}
              tabIndex="-1"
              autoComplete="off"
            />

            {reportMode === 'ticket' ? (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="issue-category-select" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Issue Category
                  </label>
                  <select
                    id="issue-category-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-main)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                    }}
                  >
                    {Object.entries(CATEGORY_DISPLAY_NAMES).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="issue-severity-select" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Severity
                  </label>
                  <select
                    id="issue-severity-select"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-main)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                    }}
                  >
                    <option value="low">Low (Minor cosmetic / non-urgent)</option>
                    <option value="medium">Medium (Single stall defective)</option>
                    <option value="high">High (Multiple cabins unusable / foul odor)</option>
                    <option value="critical">Critical (Complete water outage / sewer backflow)</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="feedback-rating-select" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Cleanliness Rating (1 to 5 Stars)
                  </label>
                  <select
                    id="feedback-rating-select"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-main)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                    }}
                  >
                    <option value={5}>5 Stars - Spotless & Fully Stocked</option>
                    <option value={4}>4 Stars - Clean and Usable</option>
                    <option value={3}>3 Stars - Moderate / Needs Minor Cleaning</option>
                    <option value={2}>2 Stars - Dirty / Poor Upkeep</option>
                    <option value={1}>1 Star - Unusable / Filthy</option>
                  </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="feedback-cleanliness-select" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Cleanliness Observation
                  </label>
                  <select
                    id="feedback-cleanliness-select"
                    value={cleanlinessLevel}
                    onChange={(e) => setCleanlinessLevel(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-main)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                    }}
                  >
                    <option value="spotless">Spotless</option>
                    <option value="clean">Clean</option>
                    <option value="moderate">Moderate</option>
                    <option value="dirty">Dirty</option>
                    <option value="unusable">Unusable</option>
                  </select>
                </div>
              </>
            )}

            {/* Description / Comment */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="issue-description-input" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Description & Location within Complex
              </label>
              <textarea
                id="issue-description-input"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue (e.g. Flush button stuck in second stall from left)..."
                required
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-main)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                Zero-PII Notice: Do not include phone numbers, names, or private information.
              </span>
            </div>

            {/* Submit Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary" disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

