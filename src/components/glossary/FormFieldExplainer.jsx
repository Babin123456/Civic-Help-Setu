import { useState, useEffect } from 'react';
import {
  HelpCircle,
  X,
  BookOpen,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Send,
  MessageSquarePlus,
  CheckCircle,
} from 'lucide-react';
import {
  explainFormField,
  submitGlossarySuggestion,
} from '../../services/civicGlossaryService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { safeHttpUrl } from '../../utils/safeContent';

/**
 * FormFieldExplainer Component (#142)
 *
 * Provides contextual "What does this mean?" plain-language assistance
 * for confusing civic terminology and form fields with verified source citations,
 * strict safe fallbacks (no AI-invented legal advice), and user correction suggestions.
 */
const FormFieldExplainer = ({
  term,
  label = 'What does this mean?',
  variant = 'button', // 'button' | 'inline' | 'icon'
  className = '',
}) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [showSuggestForm, setShowSuggestForm] = useState(false);
  const [suggestedDef, setSuggestedDef] = useState('');
  const [rationale, setRationale] = useState('');
  const [userContact, setUserContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState(null);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const explanation = explainFormField(term);

  const handleSubmitSuggestion = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const result = submitGlossarySuggestion({
      term: term || explanation?.entry?.term || 'Administrative Term',
      termId: explanation?.entry?.id || null,
      suggestedDefinition: suggestedDef,
      rationale,
      userContact,
    });

    setIsSubmitting(false);

    if (result.ok) {
      setSubmittedId(result.suggestionId);
      toast.success(result.message);
      setSuggestedDef('');
      setRationale('');
      setUserContact('');
    } else {
      toast.error(result.error || 'Failed to submit suggestion.');
    }
  };

  return (
    <>
      {/* Trigger element */}
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`form-field-explainer-trigger ${className}`}
          aria-label={`What does ${term} mean?`}
          title={`Explain term: ${term}`}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--accent-main)',
            cursor: 'pointer',
            padding: '2px',
            display: 'inline-flex',
            alignItems: 'center',
            verticalAlign: 'middle',
          }}
        >
          <HelpCircle size={15} />
        </button>
      ) : variant === 'inline' ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`form-field-explainer-trigger ${className}`}
          aria-label={`Explain "${term}"`}
          style={{
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '99px',
            color: 'var(--accent-main)',
            fontSize: '0.72rem',
            fontWeight: '600',
            padding: '0.15rem 0.55rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            marginLeft: '0.4rem',
            verticalAlign: 'middle',
          }}
        >
          <HelpCircle size={12} />
          <span>{label}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`btn btn-secondary form-field-explainer-trigger ${className}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.8rem',
            padding: '0.35rem 0.75rem',
          }}
        >
          <HelpCircle size={14} color="var(--accent-main)" />
          <span>{label}</span>
        </button>
      )}

      {/* Modal Dialog */}
      {isOpen && (
        <div
          className="journey-planner-overlay animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="explainer-dialog-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-card, #131b2e)',
              border: '1px solid var(--border-main)',
              borderRadius: '1.25rem',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '1.1rem 1.5rem',
                borderBottom: '1px solid var(--border-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--glass-bg)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <BookOpen size={20} color="var(--accent-main)" />
                <h3
                  id="explainer-dialog-title"
                  style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}
                >
                  Civic Plain-Language Explainer
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close explainer"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.3rem',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Body */}
            <div style={{ overflowY: 'auto', padding: '1.5rem', flex: 1 }}>
              {explanation.found && explanation.entry ? (
                /* Found in Curated Glossary */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Term Title & Abbreviations */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h4 style={{ fontSize: '1.3rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                        {explanation.entry.term}
                      </h4>
                      {Array.isArray(explanation.entry.abbreviations) &&
                        explanation.entry.abbreviations.map((abbr) => (
                          <span
                            key={abbr}
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              background: 'rgba(56, 189, 248, 0.15)',
                              color: 'var(--accent-main)',
                              fontWeight: '700',
                            }}
                          >
                            {abbr}
                          </span>
                        ))}
                    </div>
                    {explanation.entry.hiTerm && (
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {explanation.entry.hiTerm}
                      </p>
                    )}
                  </div>

                  {/* Plain Language Meaning */}
                  <div
                    style={{
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      borderRadius: '0.75rem',
                      padding: '1rem',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-main)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                      Plain-Language Meaning
                    </div>
                    <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                      {explanation.entry.simpleMeaning}
                    </p>
                  </div>

                  {/* Relevant Context */}
                  {explanation.entry.context && (
                    <div
                      style={{
                        background: 'var(--glass-bg)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '0.75rem',
                        padding: '1rem',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                        Where & When You Need This
                      </div>
                      <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                        {explanation.entry.context}
                      </p>
                    </div>
                  )}

                  {/* Reviewed Official Source Citation */}
                  {explanation.entry.reviewedSource && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        fontSize: '0.78rem',
                        padding: '0.65rem 0.85rem',
                        background: 'rgba(16, 185, 129, 0.08)',
                        borderRadius: '0.5rem',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <ShieldCheck size={16} color="var(--success)" />
                        <span style={{ color: 'var(--text-secondary)' }}>Reviewed Official Source:</span>
                      </div>
                      <a
                        href={safeHttpUrl(explanation.entry.reviewedSource.url) || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: 'var(--accent-main)',
                          fontWeight: '600',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          textDecoration: 'underline',
                        }}
                      >
                        {explanation.entry.reviewedSource.name}
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                /* Unknown Term Safe Fallback */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div
                    style={{
                      background: 'rgba(234, 179, 8, 0.1)',
                      border: '1px solid rgba(234, 179, 8, 0.3)',
                      borderRadius: '0.85rem',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#eab308' }}>
                      <ShieldAlert size={20} />
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800' }}>
                        {explanation.safeFallback?.title || 'Unknown Administrative Term'}
                      </h4>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                      {explanation.safeFallback?.definition}
                    </p>

                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      {explanation.safeFallback?.disclaimer}
                    </p>

                    {explanation.safeFallback?.officialPortal && (
                      <div style={{ marginTop: '0.35rem' }}>
                        <a
                          href={safeHttpUrl(explanation.safeFallback.officialPortal.url) || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.8rem',
                            padding: '0.35rem 0.75rem',
                          }}
                        >
                          <span>Search on National Services Portal</span>
                          <ExternalLink size={13} />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Suggest a Correction Section */}
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                {!showSuggestForm ? (
                  <button
                    type="button"
                    onClick={() => setShowSuggestForm(true)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: 0,
                    }}
                  >
                    <MessageSquarePlus size={15} color="var(--accent-main)" />
                    <span>Notice an ambiguity or outdated note? Suggest a clarification</span>
                  </button>
                ) : (
                  <form
                    onSubmit={handleSubmitSuggestion}
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '0.75rem',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        Suggest a Plain-Language Correction
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowSuggestForm(false)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-tertiary)',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                        }}
                      >
                        Cancel
                      </button>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Submissions are reviewed by community moderators before publication. Published definitions are never directly edited.
                    </p>

                    <div>
                      <label
                        htmlFor="suggest-definition"
                        style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', marginBottom: '0.25rem' }}
                      >
                        Proposed Meaning / Clarification:
                      </label>
                      <textarea
                        id="suggest-definition"
                        className="input-field"
                        rows="2"
                        placeholder="Explain this term in simple everyday words..."
                        value={suggestedDef}
                        onChange={(e) => setSuggestedDef(e.target.value)}
                        required
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="suggest-rationale"
                        style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', marginBottom: '0.25rem' }}
                      >
                        Official Source or Department Circular:
                      </label>
                      <input
                        id="suggest-rationale"
                        type="text"
                        className="input-field"
                        placeholder="e.g., UIDAI Notification circular 2026 / Section 4"
                        value={rationale}
                        onChange={(e) => setRationale(e.target.value)}
                        required
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="suggest-contact"
                        style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', marginBottom: '0.25rem' }}
                      >
                        Contact Email (Optional, for attribution):
                      </label>
                      <input
                        id="suggest-contact"
                        type="email"
                        className="input-field"
                        placeholder="you@example.com"
                        value={userContact}
                        onChange={(e) => setUserContact(e.target.value)}
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      />
                    </div>

                    {submittedId && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          color: 'var(--success)',
                          fontSize: '0.8rem',
                        }}
                      >
                        <CheckCircle size={15} />
                        <span>Submitted successfully (ID: {submittedId})</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn btn-primary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.82rem',
                          padding: '0.4rem 0.85rem',
                        }}
                      >
                        <Send size={13} />
                        <span>{isSubmitting ? 'Submitting...' : 'Submit Suggestion'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '0.85rem 1.5rem',
                borderTop: '1px solid var(--border-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                background: 'var(--glass-bg)',
              }}
            >
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FormFieldExplainer;
