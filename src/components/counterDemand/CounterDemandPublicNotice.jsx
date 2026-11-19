import { Info, ShieldCheck, Users } from 'lucide-react';

export const CounterDemandPublicNotice = ({ aggregateTrafficRating = 'Moderate' }) => {
  return (
    <div
      className="public-counter-notice"
      style={{
        padding: '1.25rem',
        borderRadius: '12px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        marginBottom: '1.5rem',
      }}
      role="region"
      aria-label="Public Queue Guidance Notice"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ padding: '0.4rem', borderRadius: '6px', background: 'var(--accent-subtle, #eff6ff)', color: 'var(--accent-main, #2563eb)' }}>
          <Info size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
              Citizen Advisory: Estimated Footfall & Counter Planning
            </h4>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                background: aggregateTrafficRating === 'High' ? 'var(--warning-bg, #fef3c7)' : 'var(--success-bg, #dcfce7)',
                color: aggregateTrafficRating === 'High' ? 'var(--warning-text, #92400e)' : 'var(--success-text, #166534)',
                border: '1px solid currentColor',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <Users size={12} />
              Typical Traffic: {aggregateTrafficRating}
            </span>
          </div>

          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            This forecasting workspace is an internal administrative planning tool built for civic service centres to allocate staff counters
            based on anonymized historical aggregate visits.
          </p>

          <div
            style={{
              padding: '0.6rem 0.8rem',
              borderRadius: '8px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <ShieldCheck size={16} color="var(--success-main, #16a34a)" />
            <span>
              <strong>Zero-Guarantee Principle:</strong> Footfall estimates reflect general time-of-day trends.
              Civic Help Setu does <em>not</em> guarantee specific token call times or fixed counter queue waiting intervals.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CounterDemandPublicNotice;

