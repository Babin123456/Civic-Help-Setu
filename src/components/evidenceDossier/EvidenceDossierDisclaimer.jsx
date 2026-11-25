import { Shield, AlertCircle, Lock, HardDrive } from 'lucide-react';

export default function EvidenceDossierDisclaimer() {
  return (
    <div
      role="region"
      aria-label="Evidence dossier cryptographic and privacy notice"
      style={{
        background: 'var(--surface-color, #ffffff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '12px',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
        <Shield size={20} color="#0284c7" />
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
          Local Cryptographic Integrity &amp; Privacy Notice
        </h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1rem',
          fontSize: '0.85rem',
          color: 'var(--text-secondary, #475569)',
          lineHeight: '1.5',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <Lock size={16} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: 'var(--text-primary, #0f172a)' }}>Zero-Upload Client Processing:</strong>{' '}
            Evidence files are read strictly in your local browser using standard WebCrypto APIs. File bodies and binary contents
            are never transmitted over the internet or saved to remote cloud servers.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <AlertCircle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: 'var(--text-primary, #0f172a)' }}>Integrity vs. Authenticity:</strong>{' '}
            A SHA-256 hash confirms byte-level immutability (detects file edits or corruption since hash creation). It does{' '}
            <strong>not</strong> prove official government issuance, legal validity, or real-world capture time.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <HardDrive size={16} color="#6366f1" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: 'var(--text-primary, #0f172a)' }}>Limits &amp; Preservation:</strong>{' '}
            Supported formats: PDF, PNG, JPEG, JPG, and TXT. Max 20 files per manifest, up to 20 MiB per file. Always maintain
            untouched original files in a secure local backup.
          </div>
        </div>
      </div>
    </div>
  );
}
