import { useEffect, useRef } from 'react';
import { X, ExternalLink, Hash, Calendar, CheckCircle } from 'lucide-react';

const LineageNodeDetailModal = ({ node, isOpen, onClose }) => {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      modalRef.current?.focus();
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !node) return null;

  const data = node.data || {};

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="node-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="card"
        style={{
          width: '100%',
          maxWidth: '650px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          padding: '1.5rem',
          position: 'relative',
          border: '1px solid var(--border-light)',
          outline: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--accent-main)',
                }}
              >
                {node.type}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>ID: {node.id}</span>
            </div>
            <h2 id="node-modal-title" style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-primary)' }}>
              {node.label || node.id}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details modal"
            className="btn btn-secondary"
            style={{ padding: '0.4rem', borderRadius: '50%' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Source specifics */}
        {node.type === 'source' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Authoritative Publisher:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{data.publisher}</div>
            </div>

            {data.sourceUrl && (
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Authoritative Statutory URL:</span>
                <div>
                  <a
                    href={data.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      color: 'var(--accent-main)',
                      wordBreak: 'break-all',
                      fontSize: '0.9rem',
                    }}
                  >
                    {data.sourceUrl}
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginTop: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Source Type:</span>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{data.sourceType}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Status:</span>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: data.status === 'active' ? '#10b981' : '#f59e0b' }}>
                  {data.status?.toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Snapshot specifics */}
        {node.type === 'snapshot' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={16} color="var(--accent-main)" />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                Effective Date: <strong>{data.effectiveDate || 'N/A'}</strong>
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Content Cryptographic Hash (SHA-256):</span>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  padding: '0.5rem',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '6px',
                  wordBreak: 'break-all',
                  marginTop: '0.2rem',
                }}
              >
                <Hash size={13} style={{ display: 'inline', marginRight: '4px' }} />
                {data.contentHash}
              </div>
            </div>

            {data.rawTextSnippet && (
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Statutory Excerpt / Raw Text:</span>
                <blockquote
                  style={{
                    margin: '0.4rem 0 0 0',
                    padding: '0.75rem',
                    background: 'var(--glass-bg)',
                    borderLeft: '3px solid var(--accent-main)',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    lineHeight: '1.5',
                  }}
                >
                  "{data.rawTextSnippet}"
                </blockquote>
              </div>
            )}
          </div>
        )}

        {/* Transformation specifics */}
        {node.type === 'transformation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Parser Version:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{data.parserVersion}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Ruleset Version:</span>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{data.rulesetVersion}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Input Feature Window:</span>
              <div style={{ fontSize: '0.85rem', padding: '0.4rem', background: 'var(--glass-bg)', borderRadius: '4px' }}>
                {data.inputFeatureWindow}
              </div>
            </div>
          </div>
        )}

        {/* Fact specifics */}
        {node.type === 'fact' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={18} color="#10b981" />
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Target Civic Knowledge Fact
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              This fact is exposed to citizens and public applications. Traced back through the DAG to legal gazettes.
            </p>
          </div>
        )}

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LineageNodeDetailModal;
