import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, X, ArrowRight } from 'lucide-react';
import { getAcronymByAcronym, resolveRelatedServices } from '../../utils/acronymSearch.js';

/**
 * CivicAcronymTooltip (#263)
 *
 * Contextual trigger for a civic acronym. Clicking it reveals the expanded
 * form, plain-language explanation, and links to related service catalogue
 * records without duplicating glossary text in the service page.
 */
const CivicAcronymTooltip = ({ acronym, label }) => {
  const displayText = label || acronym;
  const entry = getAcronymByAcronym(acronym);
  const [isOpen, setIsOpen] = useState(false);

  const relatedServices = entry ? resolveRelatedServices(entry) : [];

  if (!entry) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: '0.25rem',
          color: 'var(--text-tertiary)',
          fontSize: '0.85rem',
        }}
      >
        <HelpCircle size={13} />
        <span style={{ fontWeight: '600' }}>{displayText}</span>
      </span>
    );
  }

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '0.25rem',
      }}
      onClick={() => setIsOpen((prev) => !prev)}
    >
      <span
        style={{
          borderBottom: '1px dotted var(--accent-main)',
          color: 'var(--accent-main)',
          fontWeight: '600',
          cursor: 'pointer',
        }}
      >
        {displayText}
      </span>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1060,
            width: 'min(340px, 92vw)',
            background: 'var(--bg-card, #131b2e)',
            border: '1px solid var(--border-main)',
            borderRadius: '0.75rem',
            boxShadow: '0 20px 40px -12px rgba(0,0,0,0.6)',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <h4
              style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: '800',
                color: 'var(--text-primary)',
              }}
            >
              {entry.acronym}
            </h4>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close acronym explanation"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                padding: '0.2rem',
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--accent-main)', fontWeight: '700', marginBottom: '0.25rem' }}>
            <HelpCircle size={13} />
            <span>Expanded form:</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            {entry.expandedForm}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--accent-main)', fontWeight: '700', marginTop: '0.25rem', marginBottom: '0.25rem' }}>
            <HelpCircle size={13} />
            <span>Plain meaning:</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            {entry.plainLanguageExplanation}
          </p>

          {relatedServices.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                Related services
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {relatedServices.map((service) => (
                  <Link
                    key={service.id}
                    to={`/services/${service.id}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.82rem',
                      color: 'var(--accent-main)',
                      fontWeight: '600',
                      textDecoration: 'underline',
                      textDecorationStyle: 'dotted',
                      padding: '0.2rem 0',
                    }}
                  >
                    {service.name}
                    <ArrowRight size={12} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </span>
  );
};

export default CivicAcronymTooltip;
