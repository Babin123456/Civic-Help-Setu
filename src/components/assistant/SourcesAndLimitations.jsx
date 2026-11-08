import { useId, useState } from 'react';
import { ExternalLink, ChevronDown, Info, ShieldCheck, BookOpen, AlertCircle } from 'lucide-react';
import { buildSourcePanelModel } from './sourcePanelModel';
import { safeHttpUrl } from '../../utils/safeContent';

/**
 * Expandable "Sources and limitations" disclosure for an assistant message (#585).
 * Renders verified official citations, document excerpts, and clear generated guidance labels.
 * Designed with responsive line lengths and word wrapping to avoid horizontal overflow on mobile screens.
 */
const SourcesAndLimitations = ({ message, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const model = buildSourcePanelModel(message);

  if (!model.hasContent) return null;

  const count = model.sources.length + model.excerpts.length;

  return (
    <section
      className="sources-panel"
      aria-label="Official sources, citations and limitations"
      style={{
        marginTop: '1.25rem',
        padding: '0.85rem 1rem',
        borderRadius: '0.85rem',
        background: 'var(--glass-bg, rgba(255, 255, 255, 0.02))',
        border: '1px solid var(--border-light)',
      }}
    >
      <button
        type="button"
        className="sources-panel__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'none',
          border: 'none',
          padding: '0.25rem 0',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          fontSize: '0.9rem',
          fontWeight: '700',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={16} color="var(--accent-main)" aria-hidden="true" />
          <span>Sources and limitations ({count})</span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={open ? 'sources-panel__chevron is-open' : 'sources-panel__chevron'}
          style={{
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      <div
        id={panelId}
        className="sources-panel__body"
        hidden={!open}
        style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-light)' }}
      >
        {/* Distinct Non-Conflated Notice for AI Generation */}
        <div
          className="sources-panel__note sources-panel__note--generated"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.65rem',
            padding: '0.65rem 0.85rem',
            borderRadius: '0.5rem',
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            lineHeight: '1.5',
            marginBottom: '1rem',
          }}
        >
          <Info size={16} color="var(--accent-main)" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
          <div>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>
              Generated guidance.
            </strong>
            <span>{model.limitation}</span>
          </div>
        </div>

        {/* Official Source Links */}
        {model.sources.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <h4
              className="sources-panel__heading"
              style={{
                fontSize: '0.8rem',
                fontWeight: '700',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '0.65rem',
              }}
            >
              Source links
            </h4>
            <ul
              className="sources-panel__list"
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              {model.sources.map((src, i) => (
                <li
                  key={`${src.url || src.name}-${i}`}
                  className="sources-panel__item"
                  style={{
                    padding: '0.65rem 0.85rem',
                    background: 'var(--bg-main)',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    minWidth: 0,
                  }}
                >
                  {src.url ? (
                    <a
                      href={safeHttpUrl(src.url) || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sources-panel__link"
                      style={{
                        color: 'var(--accent-main)',
                        fontWeight: '700',
                        fontSize: '0.88rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        wordBreak: 'break-word',
                      }}
                    >
                      <span>{src.name}</span>
                      <span className="sr-only"> (opens in a new tab)</span>
                      <ExternalLink size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
                    </a>
                  ) : (
                    <span className="sources-panel__name" style={{ fontWeight: '700', fontSize: '0.88rem' }}>
                      {src.name}
                    </span>
                  )}

                  {src.url ? (
                    <span
                      className="sources-panel__url"
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-tertiary)',
                        wordBreak: 'break-all',
                        lineHeight: '1.4',
                      }}
                    >
                      {src.url}
                    </span>
                  ) : (
                    <span className="sources-panel__missing" style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                      Link unavailable
                    </span>
                  )}

                  <span
                    className={src.lastVerified ? 'sources-panel__meta' : 'sources-panel__missing'}
                    style={{
                      fontSize: '0.75rem',
                      color: src.lastVerified ? 'var(--text-secondary)' : '#f59e0b',
                      marginTop: '2px',
                    }}
                  >
                    {src.lastVerified ? `Last verified: ${src.lastVerified}` : 'Review date unavailable'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Official Statutory Excerpts */}
        {model.excerpts.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <h4
              className="sources-panel__heading"
              style={{
                fontSize: '0.8rem',
                fontWeight: '700',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '0.65rem',
              }}
            >
              Official source excerpts
            </h4>
            <ul
              className="sources-panel__list"
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              {model.excerpts.map((ex, i) => (
                <li
                  key={i}
                  className="sources-panel__item sources-panel__item--official"
                  style={{
                    padding: '0.75rem 0.85rem',
                    background: 'var(--bg-main)',
                    borderRadius: '0.5rem',
                    borderLeft: '3px solid var(--accent-main)',
                    borderTop: '1px solid var(--border-light)',
                    borderRight: '1px solid var(--border-light)',
                    borderBottom: '1px solid var(--border-light)',
                  }}
                >
                  <span
                    className="sources-panel__name"
                    style={{
                      fontWeight: '700',
                      fontSize: '0.88rem',
                      display: 'block',
                      marginBottom: '0.35rem',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {ex.title}
                  </span>
                  <blockquote
                    className="sources-panel__quote"
                    style={{
                      margin: '0 0 0.5rem 0',
                      fontSize: '0.85rem',
                      lineHeight: '1.5',
                      color: 'var(--text-secondary)',
                      fontStyle: 'italic',
                      wordBreak: 'break-word',
                    }}
                  >
                    "{ex.excerpt}"
                  </blockquote>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      fontSize: '0.75rem',
                    }}
                  >
                    <span className="sources-panel__meta" style={{ color: 'var(--text-tertiary)' }}>
                      {`From: ${ex.sourceName || 'source name unavailable'}`}
                    </span>
                    <span
                      className={ex.lastVerified ? 'sources-panel__meta' : 'sources-panel__missing'}
                      style={{ color: ex.lastVerified ? 'var(--text-secondary)' : '#f59e0b' }}
                    >
                      {ex.lastVerified ? `Last verified: ${ex.lastVerified}` : 'Review date unavailable'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Global Statutory Disclaimer */}
        {model.disclaimer && (
          <p
            className="sources-panel__note"
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-tertiary)',
              lineHeight: '1.5',
              margin: '0.75rem 0 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Info size={14} aria-hidden="true" />
            <span>{model.disclaimer}</span>
          </p>
        )}
      </div>
    </section>
  );
};

export default SourcesAndLimitations;
