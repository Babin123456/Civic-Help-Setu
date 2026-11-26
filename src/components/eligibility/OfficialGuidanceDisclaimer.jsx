import { ShieldAlert } from 'lucide-react';
import { OFFICIAL_DETERMINATION_DISCLAIMER } from '../../services/eligibilitySimulationService.js';

export default function OfficialGuidanceDisclaimer({ compact = false }) {
  return (
    <aside
      role="note"
      aria-label="Statutory Non-Determination Notice"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: compact ? '0.75rem 1rem' : '1rem 1.25rem',
        borderRadius: '0.75rem',
        background: 'rgba(234, 179, 8, 0.08)',
        border: '1px solid rgba(234, 179, 8, 0.3)',
        color: 'var(--text-primary)',
        fontSize: '0.85rem',
        lineHeight: 1.5,
        marginBottom: '1.5rem',
      }}
    >
      <ShieldAlert
        size={20}
        style={{ color: '#eab308', flexShrink: 0, marginTop: '0.15rem' }}
        aria-hidden="true"
      />
      <div>
        <strong style={{ display: 'block', color: '#ca8a04', marginBottom: '0.25rem', fontSize: '0.88rem' }}>
          Informational Simulation Guidance — Not an Official Legal Determination
        </strong>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          {OFFICIAL_DETERMINATION_DISCLAIMER}
        </p>
      </div>
    </aside>
  );
}
