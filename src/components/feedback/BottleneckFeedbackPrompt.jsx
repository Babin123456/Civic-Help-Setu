import React, { useState } from 'react';
import {
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Send,
} from 'lucide-react';
import {
  FEEDBACK_CATEGORIES,
  PLATFORM_FEEDBACK_DISCLAIMER,
  submitBottleneckFeedback,
} from '../../services/bottleneckFeedbackService';

const BottleneckFeedbackPrompt = ({
  serviceId,
  serviceName,
  currentStepIndex = null,
  currentStepTitle = null,
  onDismiss = null,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState(FEEDBACK_CATEGORIES[0].id);
  const [rating, setRating] = useState(3);
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [piiWarning, setPiiWarning] = useState(false);

  const handleNotesChange = (e) => {
    const val = e.target.value;
    setNotes(val);
    // Simple client-side hint if user enters numbers that look like phone or Aadhaar
    const hasSuspectNumbers = /\b\d{10,12}\b/.test(val) || /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(val);
    setPiiWarning(hasSuspectNumbers);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    try {
      submitBottleneckFeedback({
        serviceId,
        serviceName,
        stepIndex: currentStepIndex,
        stepTitle: currentStepTitle,
        category,
        rating,
        notes,
      });

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setIsOpen(false);
        setNotes('');
        if (onDismiss) onDismiss();
      }, 2500);
    } catch (err) {
      setError(err.message || 'Could not save feedback.');
    }
  };

  return (
    <div
      className="bottleneck-feedback-container"
      style={{
        margin: '1.5rem 0',
        borderRadius: '1rem',
        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
        background: 'var(--glass-bg, rgba(255, 255, 255, 0.03))',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Non-intrusive Collapsible Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '0.85rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '0.9rem',
          fontWeight: '600',
        }}
        aria-expanded={isOpen}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-main)' }}>
          <HelpCircle size={18} />
          {currentStepTitle
            ? `Struggling with "${currentStepTitle}"? Share optional feedback`
            : 'Stuck or confused by this process? Help improve our guide'}
        </span>
        <span style={{ color: 'var(--text-tertiary)' }}>
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>

      {isOpen && (
        <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--border-light, rgba(255, 255, 255, 0.05))' }}>
          {/* Explicit Non-Government Grievance Disclaimer */}
          <div
            style={{
              margin: '1rem 0',
              padding: '0.75rem 1rem',
              borderRadius: '0.65rem',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              display: 'flex',
              gap: '0.65rem',
              alignItems: 'flex-start',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.45,
            }}
          >
            <ShieldCheck size={18} color="var(--accent-main)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: 'var(--accent-main)' }}>Platform Improvement Only: </strong>
              {PLATFORM_FEEDBACK_DISCLAIMER}
            </div>
          </div>

          {submitted ? (
            <div
              style={{
                padding: '1.5rem',
                textAlign: 'center',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid #10b981',
                borderRadius: '0.75rem',
                color: '#10b981',
              }}
            >
              <CheckCircle2 size={32} style={{ margin: '0 auto 0.5rem' }} />
              <div style={{ fontWeight: '700', fontSize: '1rem' }}>Thank You for Your Feedback!</div>
              <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Our community maintainers will review this step to make instructions clearer and more accessible.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {error && (
                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid #ef4444',
                    color: '#ef4444',
                    fontSize: '0.8rem',
                  }}
                >
                  {error}
                </div>
              )}

              {/* Friction Category Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '600', marginBottom: '0.45rem' }}>
                  What kind of issue or confusion did you experience?
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {FEEDBACK_CATEGORIES.map((cat) => {
                    const isSelected = category === cat.id;
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        style={{
                          padding: '0.4rem 0.85rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.8rem',
                          fontWeight: '500',
                          cursor: 'pointer',
                          border: '1px solid',
                          borderColor: isSelected ? 'var(--accent-main)' : 'rgba(255, 255, 255, 0.15)',
                          background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                          color: isSelected ? 'var(--accent-main)' : 'var(--text-secondary)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Friction Severity Scale */}
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                  Friction Level: {rating} / 5 (1 = Minor ambiguity, 5 = Completely blocked / halted progress)
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.72rem',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  <span>1: Minor typo / unclear word</span>
                  <span>3: Confusing requirement</span>
                  <span>5: Broken portal / impossible to proceed</span>
                </div>
              </div>

              {/* Optional Text Notes with PII warning */}
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                  Optional details (What specifically was missing or unclear?)
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={handleNotesChange}
                  placeholder="e.g. The document list did not mention whether notary attestation was required on the affidavit..."
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-main)',
                    background: 'rgba(0, 0, 0, 0.25)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    resize: 'vertical',
                  }}
                />

                {piiWarning && (
                  <div
                    style={{
                      marginTop: '0.35rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      color: '#f59e0b',
                      fontSize: '0.75rem',
                    }}
                  >
                    <AlertCircle size={14} />
                    <span>
                      Reminder: Please omit phone numbers, email addresses, or personal application IDs.
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    padding: '0.45rem 1.25rem',
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <Send size={14} /> Submit Feedback
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default BottleneckFeedbackPrompt;
