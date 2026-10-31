import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, AlertCircle, CheckCircle2, ChevronRight, FileBadge, ArrowUpRight, Sparkles } from 'lucide-react';
import { getDocuments } from '../../services/vaultStorage';
import { assessCivicReadiness } from '../../services/civicEntitlementReadinessService';

export default function CivicEntitlementReadinessCard({ profile = {} }) {
  const [vaultDocs, setVaultDocs] = useState([]);

  useEffect(() => {
    try {
      setVaultDocs(getDocuments());
    } catch {
      setVaultDocs([]);
    }
  }, []);

  const readiness = assessCivicReadiness(profile, vaultDocs);

  return (
    <div
      className="card animate-fade-in"
      style={{
        padding: '1.5rem',
        borderRadius: '1rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        marginBottom: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              width: '2.4rem',
              height: '2.4rem',
              borderRadius: '0.6rem',
              background: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-main)',
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              Civic Profile &amp; Entitlement Readiness
            </h3>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Assesses whether your vault documentation meets central and state scheme thresholds.
            </p>
          </div>
        </div>

        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 800,
            padding: '0.25rem 0.75rem',
            borderRadius: '99px',
            background: `${readiness.tierColor}1a`,
            color: readiness.tierColor,
            border: `1px solid ${readiness.tierColor}40`,
          }}
        >
          {readiness.tierLabel}
        </span>
      </div>

      {/* Progress Bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.82rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
            Document Completeness Score
          </span>
          <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
            {readiness.overallScore}% ({readiness.verifiedCount} of {readiness.totalCount} Verified)
          </span>
        </div>
        <div
          style={{
            height: '0.65rem',
            borderRadius: '99px',
            background: 'var(--glass-bg)',
            overflow: 'hidden',
            border: '1px solid var(--border-light)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${readiness.overallScore}%`,
              background: readiness.tierColor,
              borderRadius: '99px',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      {/* Verified vs Missing Credentials Badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {readiness.verifiedCredentials.map((c) => (
          <span
            key={c.id}
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10b981',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <CheckCircle2 size={13} /> {c.label}
          </span>
        ))}

        {readiness.missingCredentials.map((c) => (
          <span
            key={c.id}
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <AlertCircle size={13} /> Missing: {c.label}
          </span>
        ))}
      </div>

      {/* Recommendations & Quick Actions */}
      {readiness.recommendations.length > 0 && (
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '0.6rem',
            background: 'var(--glass-bg)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
          }}
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
            Next Recommended Actions
          </span>
          {readiness.recommendations.map((rec, i) => (
            <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles size={13} color="var(--accent-main)" /> {rec}
            </div>
          ))}
        </div>
      )}

      {/* Quick Links */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link
          to="/vault"
          className="btn btn-secondary"
          style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <FileBadge size={14} /> Open Digital Vault
        </Link>
        <Link
          to="/eligibility"
          className="btn btn-primary"
          style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
        >
          Check Scheme Eligibility <ArrowUpRight size={14} />
        </Link>
      </div>
    </div>
  );
}
