import { useState } from 'react';
import { ExternalLink, BookOpen, ChevronDown, ChevronUp, CheckCircle, Info } from 'lucide-react';
import { safeHttpUrl } from '../../utils/safeContent';

/**
 * SourceCitationCard Component (#77)
 * Displays detailed citations for each chunk used to ground the assistant's response.
 * Follows safe external navigation practices.
 */
const SourceCitationCard = ({ chunks = [], sources = [], disclaimer }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!chunks || chunks.length === 0) return null;

  return (
    <div
      className="source-citations-container"
      style={{
        marginTop: '1rem',
        border: '1px solid var(--border-main, rgba(255, 255, 255, 0.12))',
        borderRadius: '0.75rem',
        background: 'var(--glass-bg, rgba(255, 255, 255, 0.03))',
        overflow: 'hidden',
        fontSize: '0.85rem',
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: 'none',
          border: 'none',
          color: 'var(--text-primary, #ffffff)',
          cursor: 'pointer',
          fontWeight: '600',
          textAlign: 'left',
        }}
        aria-expanded={isOpen}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BookOpen size={16} color="var(--accent-main, #38bdf8)" aria-hidden="true" />
          <span>Grounded Source Citations ({chunks.length} sections retrieved)</span>
        </span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isOpen && (
        <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
            {chunks.map((chunk, idx) => (
              <div
                key={chunk.chunkId || idx}
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    marginBottom: '0.35rem',
                  }}
                >
                  <span style={{ fontWeight: '700', color: 'var(--accent-main, #38bdf8)', fontSize: '0.8rem' }}>
                    [{chunk.sectionTitle || chunk.sectionType}]
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>
                    Relevance: {Math.round(chunk.relevanceScore * 10)} / 100
                  </span>
                </div>

                <p
                  style={{
                    margin: 0,
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary, #cbd5e1)',
                    lineHeight: '1.4',
                  }}
                >
                  &ldquo;{chunk.excerpt}&rdquo;
                </p>

                {chunk.sourceUrl && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <a
                      href={safeHttpUrl(chunk.sourceUrl) || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.75rem',
                        color: 'var(--accent-hover, #7dd3fc)',
                        textDecoration: 'none',
                        fontWeight: '600',
                      }}
                    >
                      <CheckCircle size={12} color="#4ade80" />
                      <span>{chunk.sourceName || 'Official Source Portal'}</span>
                      <ExternalLink size={11} aria-hidden="true" />
                    </a>
                    {chunk.lastVerified && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>
                        &bull; Verified: {chunk.lastVerified}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {disclaimer && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                marginTop: '1rem',
                padding: '0.625rem',
                borderRadius: '0.5rem',
                background: 'rgba(234, 179, 8, 0.08)',
                border: '1px solid rgba(234, 179, 8, 0.2)',
                fontSize: '0.75rem',
                color: '#facc15',
                lineHeight: '1.4',
              }}
            >
              <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
              <span>{disclaimer}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SourceCitationCard;
