import React from 'react';
import { ExternalLink, ShieldCheck, CheckCircle2, AlertCircle, Building2, Calendar, Lock } from 'lucide-react';
import { getServiceSourceMetadata } from '../../services/sourceVerificationService';
import { safeHttpUrl } from '../../utils/safeContent';

const OfficialSourcesList = ({ service, onReportMissingSource }) => {
  const { sources, formattedLastVerified, freshness, hasSources } = getServiceSourceMetadata(service);

  return (
    <div
      className="card"
      style={{
        border: '1px solid var(--border-main)',
        background: 'var(--bg-surface, var(--bg-main))',
        borderRadius: '1rem',
        padding: '1.75rem',
        marginBottom: '2rem',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
          borderBottom: '1px solid var(--border-main)',
          paddingBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: '0.625rem',
              background: 'rgba(59, 130, 246, 0.12)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
              Official Sources & Verified Portals
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Cross-reference guidance directly against statutory government channels
            </p>
          </div>
        </div>

        {/* Verification Status Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: freshness.badgeBg,
            border: `1px solid ${freshness.color}33`,
            padding: '0.35rem 0.85rem',
            borderRadius: '2rem',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: freshness.color,
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: freshness.color }}>
            {freshness.label}
          </span>
          {formattedLastVerified && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.25rem' }}>
              • {formattedLastVerified}
            </span>
          )}
        </div>
      </div>

      {/* Sources Grid or Empty Fallback */}
      {hasSources ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          {sources.map((src, idx) => (
            <a
              key={idx}
              href={safeHttpUrl(src.cleanUrl) || undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visit official source: ${src.name} on ${src.domain} (opens in new tab)`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '1.25rem',
                borderRadius: '0.75rem',
                textDecoration: 'none',
                background: 'var(--glass-bg)',
                border: '1px solid var(--border-main)',
                transition: 'all 0.25s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = 'var(--accent-main, #3b82f6)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--border-main)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div>
                {/* Source Top Badges */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                  {src.isGovDomain ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        color: '#10b981',
                        background: 'rgba(16, 185, 129, 0.12)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        padding: '0.15rem 0.55rem',
                        borderRadius: '0.35rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      <Lock size={10} /> Official Govt Domain
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.7rem',
                        fontWeight: '600',
                        color: 'var(--text-tertiary)',
                        background: 'var(--glass-bg-subtle)',
                        border: '1px solid var(--border-main)',
                        padding: '0.15rem 0.55rem',
                        borderRadius: '0.35rem',
                      }}
                    >
                      <Building2 size={10} /> Authorized Agency
                    </span>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-main)' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>Visit Portal</span>
                    <ExternalLink size={13} />
                  </div>
                </div>

                {/* Source Name */}
                <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                  {src.name}
                </h4>

                {/* Domain & Path info */}
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {src.domain}
                </p>
              </div>

              {/* Source bottom footer */}
              {src.lastVerified && (
                <div style={{ marginTop: '0.85rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-main)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  <Calendar size={12} /> Verified: {src.lastVerified}
                </div>
              )}
            </a>
          ))}
        </div>
      ) : (
        /* Missing Metadata Graceful Fallback */
        <div
          style={{
            padding: '1.75rem',
            textAlign: 'center',
            background: 'var(--glass-bg-subtle)',
            borderRadius: '0.75rem',
            border: '1px dashed var(--border-main)',
            marginBottom: '1.25rem',
          }}
        >
          <AlertCircle size={28} color="var(--text-tertiary)" style={{ margin: '0 auto 0.75rem auto' }} />
          <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            No Official External Portals Linked Yet
          </h4>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '480px', marginInline: 'auto' }}>
            This service guidance is compiled from administrative reference standards. We avoid inventing or unverified links.
          </p>
          {onReportMissingSource && (
            <button
              type="button"
              onClick={onReportMissingSource}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
            >
              Submit Official Department Link
            </button>
          )}
        </div>
      )}

      {/* Safety Navigation Disclaimer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.75rem 1rem',
          background: 'rgba(59, 130, 246, 0.05)',
          border: '1px solid rgba(59, 130, 246, 0.15)',
          borderRadius: '0.5rem',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)',
        }}
      >
        <Lock size={14} color="#3b82f6" style={{ flexShrink: 0 }} />
        <span>
          <strong>Safe Navigation Notice:</strong> External links redirect to authorized government portals in a new tab. Always verify the address bar displays an authentic <code>.gov.in</code> or <code>.nic.in</code> domain before providing biometric, identity, or payment credentials.
        </span>
      </div>
    </div>
  );
};

export default OfficialSourcesList;
