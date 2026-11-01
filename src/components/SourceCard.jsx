import React from 'react';
import { ExternalLink, CheckCircle2, ShieldCheck, Lock } from 'lucide-react';
import { inspectOfficialSource } from '../services/sourceVerificationService';
import { safeHttpUrl } from '../utils/safeContent';

const SourceCard = ({ source }) => {
  const inspected = inspectOfficialSource(source);

  if (!inspected.isValid) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem',
          borderRadius: '1rem',
          background: 'var(--glass-bg-subtle)',
          border: '1px dashed var(--border-main)',
          color: 'var(--text-tertiary)',
          fontSize: '0.9rem',
        }}
      >
        <span>{inspected.name || 'Resource Link Unavailable'}</span>
      </div>
    );
  }

  return (
    <a
      href={safeHttpUrl(inspected.cleanUrl) || undefined}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Official resource: ${inspected.name} (opens in new tab)`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.25rem',
        borderRadius: '1rem',
        textDecoration: 'none',
        transition: 'all 0.3s ease',
        background: 'var(--glass-bg-subtle)',
        border: '1px solid var(--border-main)',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = 'var(--glass-bg)';
        e.currentTarget.style.borderColor = 'var(--accent-main, var(--border-light))';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = 'var(--glass-bg-subtle)';
        e.currentTarget.style.borderColor = 'var(--border-main)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        {inspected.isGovDomain ? (
          <ShieldCheck size={20} color="#10b981" />
        ) : inspected.verified ? (
          <CheckCircle2 size={20} color="var(--success, #10b981)" />
        ) : (
          <ExternalLink size={20} color="var(--text-tertiary)" />
        )}
        <div>
          <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.95rem', display: 'block' }}>
            {inspected.name}
          </span>
          {inspected.domain && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
              {inspected.domain}
            </span>
          )}
        </div>
      </div>
      <ExternalLink size={16} color="var(--text-tertiary)" />
    </a>
  );
};

export default SourceCard;
