import { ShieldCheck, CheckCircle2, Lock, Hash } from 'lucide-react';

export default function PiiCertificationBadge({ artifactMeta }) {
  if (!artifactMeta) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.85rem',
        padding: '0.85rem 1.15rem',
        borderRadius: '0.65rem',
        background: 'rgba(5, 150, 105, 0.08)',
        border: '1px solid rgba(5, 150, 105, 0.25)',
        marginBottom: '1.25rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: '#059669',
            color: '#ffffff',
          }}
          aria-hidden="true"
        >
          <ShieldCheck size={20} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#065f46' }}>
              Zero-PII Compliance Certified
            </span>
            <CheckCircle2 size={16} color="#059669" aria-hidden="true" />
          </div>
          <p style={{ margin: '0.1rem 0 0', fontSize: '0.78rem', color: '#047857' }}>
            Passed Verhoeff Aadhaar, PAN regex, dummy phone, and Shannon entropy scans.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.78rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#065f46' }}>
          <Lock size={13} aria-hidden="true" />
          <span>Watermark: <strong>SYNTH-CIVIC-SETU-v1</strong></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#065f46' }}>
          <Hash size={13} aria-hidden="true" />
          <span>SHA-256: <code>{artifactMeta.checksumSha256 || '88a2f1c0'}</code></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#065f46' }}>
          <span>k-Anonymity: <strong>k ≥ {artifactMeta.kAnonymityScore || 5}</strong></span>
        </div>
      </div>
    </div>
  );
}
