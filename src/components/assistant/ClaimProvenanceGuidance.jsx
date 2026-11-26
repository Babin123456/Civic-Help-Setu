import { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Info,
} from 'lucide-react';
import { safeHttpUrl } from '../../utils/safeContent';

/**
 * ClaimProvenanceGuidance Component (#1154)
 *
 * Renders retrieval-augmented guidance with claim-level provenance badges,
 * passage citations, and explicit isolation of unsupported / unknown claims.
 * Fully WCAG 2.1 AA accessible with keyboard navigation and ARIA attributes.
 */
export default function ClaimProvenanceGuidance({
  provenance = null,
  claims = [],
  unsupportedClaims = [],
  failClosedNotice = null,
  disclaimer = null,
}) {
  const [expandedCitationId, setExpandedCitationId] = useState(null);

  const activeClaims = claims.length > 0 ? claims : provenance?.claims || [];
  const activeUnsupported =
    unsupportedClaims.length > 0
      ? unsupportedClaims
      : provenance?.unsupportedClaims || [];
  const activeNotice = failClosedNotice || provenance?.failClosedNotice || null;
  const jurisdictionInfo = provenance?.jurisdiction || null;

  if (activeClaims.length === 0 && activeUnsupported.length === 0) {
    return null;
  }

  const toggleCitation = (id) => {
    setExpandedCitationId((prev) => (prev === id ? null : id));
  };

  const handleKeyDown = (e, id) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleCitation(id);
    }
  };

  const getStatusBadge = (status, riskCategory) => {
    const isHighRisk = riskCategory && riskCategory !== 'GENERAL_FACT';

    switch (status) {
      case 'SUPPORTED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.15rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 700,
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              color: '#22c55e',
              border: '1px solid rgba(34, 197, 94, 0.3)',
            }}
          >
            <ShieldCheck size={12} aria-hidden="true" />
            Verified Claim
          </span>
        );
      case 'CONTRADICTED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.15rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 700,
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <ShieldAlert size={12} aria-hidden="true" />
            Contradicted Claim
          </span>
        );
      default:
        // UNKNOWN / INSUFFICIENT_EVIDENCE
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.15rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 700,
              backgroundColor: isHighRisk
                ? 'rgba(239, 68, 68, 0.15)'
                : 'rgba(234, 179, 8, 0.15)',
              color: isHighRisk ? '#f87171' : '#facc15',
              border: isHighRisk
                ? '1px solid rgba(239, 68, 68, 0.3)'
                : '1px solid rgba(234, 179, 8, 0.3)',
            }}
          >
            <HelpCircle size={12} aria-hidden="true" />
            {isHighRisk ? 'Unverified High-Risk Claim' : 'Unknown / Unverified Claim'}
          </span>
        );
    }
  };

  return (
    <section
      className="claim-provenance-guidance"
      aria-label="Claim-Level Provenance and Verifiable Citations"
      style={{
        marginTop: '1rem',
        padding: '1rem',
        borderRadius: '0.75rem',
        background: 'var(--glass-bg, rgba(255, 255, 255, 0.03))',
        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '0.85rem',
          paddingBottom: '0.65rem',
          borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BookOpen size={18} color="var(--accent-main, #38bdf8)" aria-hidden="true" />
          <h4
            style={{
              margin: 0,
              fontSize: '0.95rem',
              fontWeight: 700,
              color: 'var(--text-primary, #ffffff)',
            }}
          >
            Claim-Level Source Provenance
          </h4>
        </div>
        {provenance?.indexVersion && (
          <span
            style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted, #94a3b8)',
              fontFamily: 'monospace',
            }}
          >
            Index: {provenance.indexVersion}
          </span>
        )}
      </div>

      {/* Jurisdiction Notice if applicable */}
      {jurisdictionInfo?.ambiguityNotice && (
        <div
          role="note"
          style={{
            marginBottom: '0.85rem',
            padding: '0.65rem 0.85rem',
            borderRadius: '0.5rem',
            background: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            color: '#fde047',
            fontSize: '0.825rem',
            lineHeight: 1.4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            <span>{jurisdictionInfo.ambiguityNotice}</span>
          </div>
        </div>
      )}

      {/* Fail-Closed Notice for High-Risk or Contradicted Assertions */}
      {activeNotice && (
        <div
          role="alert"
          style={{
            marginBottom: '0.85rem',
            padding: '0.65rem 0.85rem',
            borderRadius: '0.5rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: '0.825rem',
            lineHeight: 1.4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
            <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            <span>{activeNotice}</span>
          </div>
        </div>
      )}

      {/* Claims List with Passage Citations */}
      <ol
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        {activeClaims.map((claim, idx) => {
          const isExpanded = expandedCitationId === claim.claimId;
          const hasCitations = claim.citations && claim.citations.length > 0;

          return (
            <li
              key={claim.claimId || idx}
              style={{
                padding: '0.75rem',
                borderRadius: '0.5rem',
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.06))',
              }}
            >
              {/* Claim Statement & Status */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: '1 1 300px' }}>
                  <p
                    style={{
                      margin: '0 0 0.35rem 0',
                      fontSize: '0.875rem',
                      color: 'var(--text-primary, #ffffff)',
                      lineHeight: 1.45,
                    }}
                  >
                    {claim.text}
                  </p>
                </div>
                <div>{getStatusBadge(claim.status, claim.riskCategory)}</div>
              </div>

              {/* Citation Trigger Button if Citations Exist */}
              {hasCitations && (
                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => toggleCitation(claim.claimId)}
                    onKeyDown={(e) => handleKeyDown(e, claim.claimId)}
                    aria-expanded={isExpanded}
                    aria-controls={`citation-body-${claim.claimId}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.25rem 0.55rem',
                      borderRadius: '0.35rem',
                      background: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      color: 'var(--accent-main, #38bdf8)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <span>
                      Passage Citations ({claim.citations.length} source
                      {claim.citations.length === 1 ? '' : 's'})
                    </span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {/* Expandable Passage Excerpt Box */}
                  {isExpanded && (
                    <div
                      id={`citation-body-${claim.claimId}`}
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '0.4rem',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                        fontSize: '0.8rem',
                      }}
                    >
                      {claim.citations.map((cite, cIdx) => {
                        const safeUrl = cite.url ? safeHttpUrl(cite.url) : '';
                        return (
                          <div
                            key={cite.chunkId || cIdx}
                            style={{
                              marginTop: cIdx > 0 ? '0.5rem' : 0,
                              paddingTop: cIdx > 0 ? '0.5rem' : 0,
                              borderTop:
                                cIdx > 0 ? '1px dashed rgba(255, 255, 255, 0.1)' : 'none',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.5rem',
                                marginBottom: '0.25rem',
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 700,
                                  color: 'var(--accent-main, #38bdf8)',
                                }}
                              >
                                {cite.serviceName} ({cite.title})
                              </span>
                              {cite.lastVerified && (
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    color: 'var(--text-muted, #94a3b8)',
                                  }}
                                >
                                  Verified: {cite.lastVerified}
                                </span>
                              )}
                            </div>

                            <p
                              style={{
                                margin: '0 0 0.35rem 0',
                                color: 'var(--text-secondary, #cbd5e1)',
                                fontStyle: 'italic',
                                lineHeight: 1.4,
                              }}
                            >
                              &ldquo;{cite.passageExcerpt}&rdquo;
                            </p>

                            {safeUrl && (
                              <a
                                href={safeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  color: 'var(--accent-main, #38bdf8)',
                                  textDecoration: 'none',
                                  fontWeight: 600,
                                  fontSize: '0.75rem',
                                }}
                              >
                                <span>Official Department Portal</span>
                                <ExternalLink size={12} aria-hidden="true" />
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Status explanation for unknown/unsupported claims */}
              {claim.status === 'UNKNOWN' && (
                <div
                  style={{
                    marginTop: '0.45rem',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted, #94a3b8)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Info size={13} aria-hidden="true" />
                  <span>
                    No official government passage corroborated this assertion. Always verify before
                    taking action.
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Unsupported Claims Summary Panel if Any Exist */}
      {activeUnsupported.length > 0 && (
        <div
          role="region"
          aria-label="Unsupported or unverified claims"
          style={{
            marginTop: '0.85rem',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            background: 'rgba(234, 179, 8, 0.08)',
            border: '1px solid rgba(234, 179, 8, 0.25)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: '#facc15',
              fontWeight: 700,
              fontSize: '0.8rem',
              marginBottom: '0.35rem',
            }}
          >
            <AlertTriangle size={14} aria-hidden="true" />
            <span>Uncorroborated Claims Flagged ({activeUnsupported.length})</span>
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: '1.2rem',
              fontSize: '0.775rem',
              color: 'var(--text-secondary, #cbd5e1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}
          >
            {activeUnsupported.map((u, i) => (
              <li key={u.claimId || i}>
                <strong>&ldquo;{u.text}&rdquo;</strong>: {u.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mandatory Legal Disclaimer */}
      {disclaimer && (
        <p
          style={{
            marginTop: '0.75rem',
            marginBottom: 0,
            fontSize: '0.7rem',
            color: 'var(--text-muted, #94a3b8)',
            fontStyle: 'italic',
            lineHeight: 1.35,
          }}
        >
          {disclaimer}
        </p>
      )}
    </section>
  );
}
