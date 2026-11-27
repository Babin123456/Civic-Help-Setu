import { ShieldCheck } from 'lucide-react';

export default function AddressChangeStaleNotice({ lastVerifiedDate, referenceDate = '2026-09-01' }) {
  const isStale = (() => {
    if (!lastVerifiedDate) return false;
    const verified = new Date(lastVerifiedDate).getTime();
    const ref = new Date(referenceDate).getTime();
    const diffDays = (ref - verified) / (1000 * 60 * 60 * 24);
    return diffDays > 90;
  })();

  return (
    <div
      role="note"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
        padding: '0.65rem 0.85rem',
        backgroundColor: isStale ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-surface)',
        border: isStale ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-main)',
        borderRadius: '0.5rem',
        fontSize: '0.75rem',
        color: isStale ? 'var(--warning, #f59e0b)' : 'var(--text-secondary)',
        marginBottom: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <ShieldCheck size={14} color={isStale ? '#f59e0b' : '#10b981'} />
        <span>
          <strong>Data Provenance:</strong> Grounded in dated official gazette rules (UIDAI 2016, RPA 1950, MVA 1988, NFSA 2013).
        </span>
      </div>

      <div>
        Last Verified: <strong>{lastVerifiedDate || '2026-03-01'}</strong>
        {isStale && <span style={{ marginLeft: '0.4rem', color: 'var(--warning, #f59e0b)' }}>• Periodic re-audit recommended</span>}
      </div>
    </div>
  );
}

