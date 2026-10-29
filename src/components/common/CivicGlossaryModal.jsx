import { useState, useEffect } from 'react';
import { X, Search, BookOpen, ExternalLink, ShieldCheck, ShieldAlert, MessageSquarePlus, Send, CheckCircle } from 'lucide-react';
import { searchGlossary } from '../../data/civicGlossary.js';
import { submitGlossarySuggestion } from '../../services/civicGlossaryService.js';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { safeHttpUrl } from '../../utils/safeContent';

const CivicGlossaryModal = ({
  isOpen,
  onClose,
}) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestTerm, setSuggestTerm] = useState('');
  const [suggestMeaning, setSuggestMeaning] = useState('');
  const [suggestRationale, setSuggestRationale] = useState('');
  const [suggestContact, setSuggestContact] = useState('');
  const [submittedId, setSubmittedId] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const results = searchGlossary(searchTerm);

  const handleSuggestionSubmit = (e) => {
    e.preventDefault();
    const result = submitGlossarySuggestion({
      term: suggestTerm || searchTerm,
      suggestedDefinition: suggestMeaning,
      rationale: suggestRationale,
      userContact: suggestContact,
    });

    if (result.ok) {
      setSubmittedId(result.suggestionId);
      toast.success(result.message);
      setSuggestTerm('');
      setSuggestMeaning('');
      setSuggestRationale('');
      setSuggestContact('');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="glossary-modal-heading"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.75rem',
          borderRadius: '1.25rem',
          background: 'var(--bg-card, #131b2e)',
          border: '1px solid var(--border-main)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <BookOpen size={22} color="var(--accent-main)" />
            <h3 id="glossary-modal-heading" style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0 }}>
              Civic Jargon & Plain Language Dictionary
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close glossary modal"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Confusing administrative terms, acronyms, and form labels explained in simple words with official references.
        </p>

        {/* Search Input supporting terms and common abbreviations */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.55rem 0.85rem',
            borderRadius: '0.6rem',
            background: 'var(--glass-bg)',
            border: '1px solid var(--border-light)',
            marginBottom: '1.25rem',
          }}
        >
          <Search size={18} color="var(--text-tertiary)" />
          <input
            type="text"
            className="input-field"
            placeholder="Search jargon or abbreviation (e.g., NOC, EWS, IFSC, MICR, affidavit, encumbrance)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', background: 'transparent', padding: '0.2rem', width: '100%', outline: 'none' }}
          />
        </div>

        {/* Suggestion Form Drawer */}
        {showSuggestModal && (
          <div
            style={{
              background: 'rgba(56, 189, 248, 0.05)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '0.75rem',
              padding: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                Suggest an Administrative Definition or Correction
              </span>
              <button
                type="button"
                onClick={() => setShowSuggestModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSuggestionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Term or Acronym (e.g., EWS, NOC)"
                  value={suggestTerm || searchTerm}
                  onChange={(e) => setSuggestTerm(e.target.value)}
                  required
                  style={{ width: '100%', fontSize: '0.82rem' }}
                />
              </div>
              <div>
                <textarea
                  className="input-field"
                  rows="2"
                  placeholder="Plain-language definition..."
                  value={suggestMeaning}
                  onChange={(e) => setSuggestMeaning(e.target.value)}
                  required
                  style={{ width: '100%', fontSize: '0.82rem' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Official Source Circular / URL"
                  value={suggestRationale}
                  onChange={(e) => setSuggestRationale(e.target.value)}
                  required
                  style={{ fontSize: '0.82rem' }}
                />
                <input
                  type="email"
                  className="input-field"
                  placeholder="Your Email (Optional)"
                  value={suggestContact}
                  onChange={(e) => setSuggestContact(e.target.value)}
                  style={{ fontSize: '0.82rem' }}
                />
              </div>
              {submittedId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--success)', fontSize: '0.8rem' }}>
                  <CheckCircle size={14} />
                  <span>Submitted (ID: {submittedId})</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowSuggestModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.3rem 0.85rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Send size={12} />
                  <span>Submit Suggestion</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Terms list */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.25rem' }}>
          {results.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2rem',
                color: 'var(--text-secondary)',
                background: 'rgba(234, 179, 8, 0.08)',
                border: '1px solid rgba(234, 179, 8, 0.25)',
                borderRadius: '0.75rem',
              }}
            >
              <ShieldAlert size={26} color="#eab308" style={{ margin: '0 auto 0.5rem' }} />
              <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                No verified definition found for "{searchTerm}".
              </div>
              <p style={{ margin: '0 auto 1rem', fontSize: '0.82rem', maxWidth: '480px', lineHeight: '1.5' }}>
                Civic Help Setu does not invent automated or AI legal advice. If you know what this term means in your local administration, you can suggest it for reviewed publication.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSuggestTerm(searchTerm);
                  setShowSuggestModal(true);
                }}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
              >
                <MessageSquarePlus size={14} color="var(--accent-main)" />
                <span>Suggest definition for "{searchTerm}"</span>
              </button>
            </div>
          ) : (
            results.map((item) => {
              let localizedMeaning = item.simpleMeaning;
              if (language === 'hi' && item.simpleMeaningHi) localizedMeaning = item.simpleMeaningHi;
              else if (language === 'bn' && item.simpleMeaningBn) localizedMeaning = item.simpleMeaningBn;
              else if (language === 'ta' && item.simpleMeaningTa) localizedMeaning = item.simpleMeaningTa;

              return (
                <div
                  key={item.id}
                  style={{
                    padding: '1.1rem',
                    borderRadius: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                        {item.term}
                      </h4>
                      {Array.isArray(item.abbreviations) &&
                        item.abbreviations.map((abbr) => (
                          <span
                            key={abbr}
                            style={{
                              fontSize: '0.68rem',
                              padding: '0.1rem 0.4rem',
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
                    <span style={{ fontSize: '0.78rem', color: 'var(--accent-main)', fontWeight: '600' }}>
                      {language === 'hi' ? item.hiTerm : language === 'bn' ? item.bnTerm : language === 'ta' ? item.taTerm : item.hiTerm}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: '0 0 0.5rem', lineHeight: '1.5' }}>
                    <strong>In Simple Terms:</strong> {localizedMeaning}
                  </p>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
                    <strong>When is it needed?</strong> {item.context}
                  </div>

                  {/* Reviewed Source & Related Services */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.4rem', borderTop: '1px dashed var(--border-light)' }}>
                    {item.reviewedSource && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem' }}>
                        <ShieldCheck size={13} color="var(--success)" />
                        <span style={{ color: 'var(--text-tertiary)' }}>Reviewed Source:</span>
                        <a
                          href={safeHttpUrl(item.reviewedSource.url) || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--accent-main)', display: 'inline-flex', alignItems: 'center', gap: '2px', textDecoration: 'underline' }}
                        >
                          {item.reviewedSource.name}
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    )}

                    {item.relatedServices && item.relatedServices.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Related:</span>
                        {item.relatedServices.map((srv, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '0.68rem',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                              background: 'rgba(56, 189, 248, 0.1)',
                              color: 'var(--accent-main)',
                            }}
                          >
                            {srv}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setShowSuggestModal(!showSuggestModal)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-main)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <MessageSquarePlus size={14} />
            <span>Suggest a Term or Correction</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CivicGlossaryModal;
