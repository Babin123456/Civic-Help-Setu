/**
 * src/components/wardHeatmap/PrivacyTransparencyPanel.jsx
 * Privacy and k-anonymity transparency panel explaining small-cell suppression,
 * coordinate perturbation, and zero-PII guarantees (#763).
 */
import { useState } from 'react';
import { ShieldCheck, EyeOff, MapPin, Database, ChevronDown, ChevronUp, Lock } from 'lucide-react';

export default function PrivacyTransparencyPanel({ privacyRules, meta }) {
  const [isOpen, setIsOpen] = useState(false);
  const minK = privacyRules?.minCohortThreshold || 5;

  return (
    <section
      aria-labelledby="privacy-guarantees-heading"
      className="glass-panel"
      style={{
        borderRadius: '1rem',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.5rem',
        border: '1px solid var(--accent-light, #bae6fd)',
        background: 'rgba(56, 189, 248, 0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(14, 165, 233, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-main, #0284c7)',
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 id="privacy-guarantees-heading" style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
              Anonymization Safeguards &amp; Privacy Thresholds
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              Active Policy: <strong>k-Anonymity (k &ge; {minK})</strong> &bull; Sparse cohorts suppressed &bull; Ruleset {privacyRules?.rulesetVersion || 'v1.0.0-k5'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="btn btn-secondary"
          style={{
            fontSize: '0.8rem',
            padding: '0.4rem 0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
          aria-expanded={isOpen}
          aria-controls="privacy-details-content"
        >
          <span>{isOpen ? 'Hide Privacy Architecture' : 'Inspect Privacy Architecture'}</span>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {isOpen && (
        <div
          id="privacy-details-content"
          style={{
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-light)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1rem',
          }}
        >
          <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', color: 'var(--accent-main)' }}>
              <EyeOff size={16} />
              <strong style={{ fontSize: '0.85rem' }}>Small-Cell Suppression (k &ge; {minK})</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Any ward/category cohort with fewer than {minK} reports is suppressed from public display to prevent deduplication or deanonymization of individual complainants.
            </p>
          </div>

          <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', color: '#16a34a' }}>
              <MapPin size={16} />
              <strong style={{ fontSize: '0.85rem' }}>Coordinate Perturbation</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Exact GPS coordinates, street addresses, and house numbers are strictly stripped. All civic events are spatially mapped to ward centroids only.
            </p>
          </div>

          <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', color: '#8b5cf6' }}>
              <Lock size={16} />
              <strong style={{ fontSize: '0.85rem' }}>Zero Citizen PII Stored</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Submissions containing personal identifiers (Aadhaar, PAN, phone numbers, names) are rejected at the service boundary. Anonymous cryptographic seals are used for receipting.
            </p>
          </div>

          <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', color: '#f59e0b' }}>
              <Database size={16} />
              <strong style={{ fontSize: '0.85rem' }}>Aggregation Audit Summary</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Current View: <strong>{meta?.totalCohorts || 80}</strong> total cohorts evaluated, with <strong>{meta?.suppressedCohortsCount || 0}</strong> cohorts actively suppressed under privacy rules.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
