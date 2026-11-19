import { useState, useMemo } from 'react';
import {
  MapPinOff,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  auditRelocationCompliance,
} from '../../services/streetVendorService.js';

export default function RelocationNoticeCard({ onRelocationAuditChange }) {
  const [noticeDaysGiven, setNoticeDaysGiven] = useState(7);
  const [alternativeSiteAllocated, setAlternativeSiteAllocated] = useState(false);
  const [tvcConsulted, setTvcConsulted] = useState(false);

  const relocationAnalysis = useMemo(() => {
    return auditRelocationCompliance({
      noticeDaysGiven: Number(noticeDaysGiven) || 0,
      alternativeSiteAllocated,
      tvcConsulted,
    });
  }, [noticeDaysGiven, alternativeSiteAllocated, tvcConsulted]);

  useMemo(() => {
    if (onRelocationAuditChange) {
      onRelocationAuditChange(relocationAnalysis);
    }
  }, [relocationAnalysis, onRelocationAuditChange]);

  return (
    <div
      style={{
        background: 'var(--bg-card, #1e293b)',
        borderRadius: '1rem',
        padding: '1.5rem',
        border: '1px solid var(--border-light, #334155)',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <MapPinOff style={{ width: 28, height: 28, color: '#facc15' }} />
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
            Section 18 Relocation Notice &amp; Alternative Pitch Auditor
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Evaluates statutory 30-day notice, alternative natural market allocation &amp; TVC consultation
          </span>
        </div>
      </div>

      {/* Grid Inputs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Notice Period Days Given (Section 18(1))
          </label>
          <input
            type="number"
            min="0"
            max="90"
            value={noticeDaysGiven}
            onChange={(e) => setNoticeDaysGiven(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
          <span style={{ fontSize: '0.72rem', color: noticeDaysGiven >= 30 ? '#4ade80' : '#f87171' }}>
            {noticeDaysGiven >= 30 ? 'Meets statutory 30-day notice rule' : 'Deficient notice (< 30 days mandatory minimum)'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={alternativeSiteAllocated}
              onChange={(e) => setAlternativeSiteAllocated(e.target.checked)}
            />
            Viable alternative vending site allocated in nearby natural market (Section 18(1))
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={tvcConsulted}
              onChange={(e) => setTvcConsulted(e.target.checked)}
            />
            Relocation formally approved through Town Vending Committee (Section 18(3))
          </label>
        </div>
      </div>

      {/* Outcome Banner */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '1.25rem',
          borderRadius: '0.75rem',
          background: relocationAnalysis.isIllegalRelocation ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)',
          border: `1px solid ${relocationAnalysis.isIllegalRelocation ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {relocationAnalysis.isIllegalRelocation ? (
            <AlertTriangle style={{ width: 32, height: 32, color: '#f87171' }} />
          ) : (
            <CheckCircle2 style={{ width: 32, height: 32, color: '#4ade80' }} />
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: relocationAnalysis.isIllegalRelocation ? '#f87171' : '#4ade80' }}>
              {relocationAnalysis.isIllegalRelocation ? 'UNLAWFUL RELOCATION ORDER / DEFICIENT DUE PROCESS' : 'PROCEDURALLY COMPLIANT RELOCATION'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
              {relocationAnalysis.isIllegalRelocation
                ? 'Relocation order is liable to be stayed immediately under Section 20 appeal.'
                : 'Meets Section 18 advance notice and rehabilitation requirements.'}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>Compliance Status</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: relocationAnalysis.isIllegalRelocation ? '#f87171' : '#4ade80' }}>
            {relocationAnalysis.status}
          </div>
        </div>
      </div>

      {relocationAnalysis.violations.length > 0 && (
        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f87171', marginBottom: '0.4rem', display: 'block' }}>
            Statutory Non-Compliance Details:
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {relocationAnalysis.violations.map((v, i) => (
              <div
                key={i}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.4rem',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-light, #334155)',
                  fontSize: '0.8rem',
                }}
              >
                <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>{v.section}:</strong> {v.issue}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
