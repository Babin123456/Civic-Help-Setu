import StatusLegend from './StatusLegend';
import StatusLegendLink from './StatusLegendLink';

const InlineStatusLegend = ({
  categories,
  title = 'Status Legend',
  showFullLegendLink = true,
  fullLegendLabel = 'View full legend',
  className = '',
}) => {
  const allCategories = categories || Object.values({
    REQUIREMENT: 'requirement',
    INTAKE_WINDOW: 'intakeWindow',
    APPLICATION: 'application',
    FEE: 'fee',
    ELIGIBILITY: 'eligibility',
  });

  return (
    <section
      className={`inline-status-legend ${className}`}
      aria-labelledby="inline-status-legend-title"
      style={{
        marginTop: '1.5rem',
        padding: '1rem 1.25rem',
        background: 'var(--glass-bg-subtle)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <h3
          id="inline-status-legend-title"
          style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          {title}
        </h3>
        {showFullLegendLink && (
          <StatusLegendLink
            categories={allCategories}
            triggerLabel={fullLegendLabel}
            showIcon={true}
            modalTitle="Full Status & Terminology Legend"
          />
        )}
      </div>
      <StatusLegend categories={allCategories} showHeader={false} compact={true} />
    </section>
  );
};

export default InlineStatusLegend;