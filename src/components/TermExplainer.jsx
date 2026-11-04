import { useState, useEffect, useCallback } from 'react';
import { HelpCircle, X, AlertCircle, Info } from 'lucide-react';
import { explainTerm } from '../services/termExplainerService';

/**
 * TermExplainer Component (#383)
 *
 * An "Explain this term" interaction for civic-service terminology in service
 * descriptions and document checklists. Opens a responsive dialog (works on
 * mobile and desktop) showing a short, accessible definition marked as
 * informational, with an optional illustrative example. Never sends profile or
 * vault data to the explanation layer. Falls back gracefully when the
 * explanation cannot be generated.
 */
const TermExplainer = ({
  term,
  label = 'Explain this term',
  serviceContext = {},
  variant = 'inline', // 'inline' | 'icon' | 'button'
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'
  const [explanation, setExplanation] = useState(null);

  const fetchExplanation = useCallback(async () => {
    if (!term || !term.trim()) {
      setExplanation({
        definition: 'No term was provided to explain.',
        example: undefined,
        source: 'fallback',
        informational: true,
        fallback: true,
        error: 'Empty term',
      });
      setStatus('ready');
      return;
    }

    setStatus('loading');
    try {
      const result = await explainTerm({ term, serviceContext });
      setExplanation(result);
      setStatus('ready');
    } catch (err) {
      setExplanation({
        definition: `No explanation is currently available for "${term}". Please consult the official department or portal linked on this service page.`,
        example: undefined,
        source: 'fallback',
        informational: true,
        fallback: true,
        error: err?.message || 'Explanation could not be generated.',
      });
      setStatus('ready');
    }
  }, [term, serviceContext]);

  const openDialog = useCallback(() => {
    setIsOpen(true);
    if (status === 'idle') {
      fetchExplanation();
    }
  }, [status, fetchExplanation]);

  // Close dialog on Escape key
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

  const closeDialog = () => {
    setIsOpen(false);
    setStatus('idle');
    setExplanation(null);
  };

  const trigger = () => {
    const baseStyle = {
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
    };

    if (variant === 'icon') {
      return (
        <button
          type="button"
          onClick={openDialog}
          className={`term-explainer-trigger ${className}`}
          aria-label={`Explain "${term || ''}"`}
          title={`Explain term: ${term || ''}`}
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
      );
    }

    if (variant === 'button') {
      return (
        <button
          type="button"
          onClick={openDialog}
          className={`btn btn-secondary term-explainer-trigger ${className}`}
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
      );
    }

    // default inline
    return (
      <button
        type="button"
        onClick={openDialog}
        className={`term-explainer-trigger ${className}`}
        aria-label={`Explain "${term || ''}"`}
        style={baseStyle}
      >
        <HelpCircle size={12} />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <>
      {trigger()}

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="term-explainer-title"
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
            touchAction: 'none',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '85vh',
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
                <Info size={20} color="var(--accent-main)" />
                <h3
                  id="term-explainer-title"
                  style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}
                >
                  Explain this term
                </h3>
              </div>
              <button
                type="button"
                onClick={closeDialog}
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
              {status === 'loading' ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.75rem',
                    paddingTop: '2rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <HelpCircle size={20} color="var(--accent-main)" />
                  <span style={{ fontSize: '0.9rem' }}>Looking up this term…</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {status === 'error' || (explanation && explanation.fallback) ? (
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
                        <AlertCircle size={20} />
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800' }}>
                          Explanation unavailable
                        </h4>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                        {explanation?.definition || 'No explanation is currently available for this term.'}
                      </p>
                      {explanation?.error && (
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                          {explanation.error}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      {/* Term Title */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <h4
                          style={{
                            fontSize: '1.3rem',
                            fontWeight: '800',
                            margin: 0,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {term}
                        </h4>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            color: 'var(--accent-main)',
                            textTransform: 'uppercase',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            background: 'rgba(56, 189, 248, 0.15)',
                          }}
                        >
                          Informational
                        </span>
                      </div>

                      {/* Definition */}
                      <div
                        style={{
                          background: 'rgba(56, 189, 248, 0.08)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          borderRadius: '0.75rem',
                          padding: '1rem',
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-main)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                          Short definition
                        </div>
                        <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                          {explanation?.definition}
                        </p>
                      </div>

                      {/* Example (illustrative, not official) */}
                      {explanation?.example && (
                        <div
                          style={{
                            background: 'rgba(16, 185, 129, 0.08)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            borderRadius: '0.75rem',
                            padding: '1rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: '700', color: '#10b981', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                            Example
                          </div>
                          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                            {explanation.example}
                          </p>
                          <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', fontStyle: 'italic', color: 'var(--text-tertiary)' }}>
                            This example is illustrative only and is not an official rule.
                          </p>
                        </div>
                      )}

                      {/* Source note */}
                      {explanation?.source === 'verified-glossary' && (
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                          From the verified civic glossary.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
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
                onClick={closeDialog}
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

export default TermExplainer;
