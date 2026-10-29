import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Scale,
  ShieldAlert,
} from 'lucide-react';
import {
  getUnresolvedConflictsForService,
  CLAIM_FIELD_LABELS,
} from '../../services/sourceConflictService';
import { safeHttpUrl } from '../../utils/safeContent';

const SourceConflictCautionBanner = ({ serviceId }) => {
  const [conflicts, setConflicts] = useState([]);
  const [expandedConflictId, setExpandedConflictId] = useState(null);

  useEffect(() => {
    if (!serviceId) return;
    const list = getUnresolvedConflictsForService(serviceId);
    setConflicts(list);
  }, [serviceId]);

  if (!conflicts || conflicts.length === 0) return null;

  const toggleExpand = (id) => {
    setExpandedConflictId((prev) => (prev === id ? null : id));
  };

  return (
    <div
      className="source-conflict-caution-banner animate-fade-in"
      style={{
        marginTop: '1.5rem',
        borderRadius: '1rem',
        background: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        padding: '1.25rem 1.5rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      }}
      role="alert"
      aria-label="Official source discrepancy notice"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
        <AlertTriangle size={24} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '0.2rem 0.55rem',
                borderRadius: '999px',
                background: 'rgba(245, 158, 11, 0.2)',
                color: '#f59e0b',
                letterSpacing: '0.5px',
              }}
            >
              Manual Verification Pending
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
              {conflicts.length} Unresolved Source Discrepanc{conflicts.length === 1 ? 'y' : 'ies'}
            </span>
          </div>

          <h4 style={{ margin: '0.4rem 0 0.25rem 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Official Source Conflict Alert
          </h4>

          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            Different official government sources or notices specify conflicting details for this service.
            Our civic maintainers are manually verifying the authoritative circular with the departmental secretariat.
          </p>

          {/* List of active unresolved conflicts */}
          <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {conflicts.map((conflict) => {
              const isExpanded = expandedConflictId === conflict.id;
              const fieldLabel = CLAIM_FIELD_LABELS[conflict.claimField] || conflict.claimField;
              return (
                <div
                  key={conflict.id}
                  style={{
                    background: 'var(--bg-card, rgba(17, 24, 39, 0.7))',
                    borderRadius: '0.65rem',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    padding: '0.75rem 1rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                    onClick={() => toggleExpand(conflict.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Scale size={16} color="var(--accent-main)" />
                      <strong style={{ fontSize: '0.88rem' }}>{fieldLabel} Discrepancy</strong>
                    </div>

                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        fontSize: '0.75rem',
                      }}
                    >
                      <span>{isExpanded ? 'Hide Sources' : 'Compare Sources'}</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {conflict.description && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                      {conflict.description}
                    </div>
                  )}

                  {/* Expanded Comparative Claims */}
                  {isExpanded && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px dashed var(--border-light, rgba(255, 255, 255, 0.1))',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                        Conflicting Claims on Official Record:
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                          gap: '0.5rem',
                        }}
                      >
                        {conflict.sources.map((src, i) => (
                          <div
                            key={src.id || i}
                            style={{
                              padding: '0.6rem 0.8rem',
                              borderRadius: '0.5rem',
                              background: 'var(--bg-card-hover, rgba(255, 255, 255, 0.03))',
                              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
                              fontSize: '0.82rem',
                            }}
                          >
                            <div style={{ fontWeight: 700, color: 'var(--accent-main)' }}>
                              Source {i + 1}: {src.sourceName}
                            </div>
                            <div style={{ margin: '0.25rem 0', fontWeight: 600, color: 'var(--text-primary)' }}>
                              Claimed Value: <span style={{ color: '#f59e0b' }}>{src.claimedValue}</span>
                            </div>
                            {src.publicationDate && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                Dated: {src.publicationDate}
                              </div>
                            )}
                            {src.sourceUrl && (
                              <a
                                href={safeHttpUrl(src.sourceUrl) || undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: '0.72rem',
                                  color: 'var(--accent-main)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                  marginTop: '0.25rem',
                                  textDecoration: 'none',
                                }}
                              >
                                View Citation <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SourceConflictCautionBanner;
