import { useState, useMemo } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Info, AlertCircle } from 'lucide-react';
import {
  STATUS_DEFINITIONS,
  STATUS_CATEGORIES,
  getAllStatusKeys,
} from '../../data/statusDefinitions';

const CATEGORY_LABELS = {
  [STATUS_CATEGORIES.REQUIREMENT]: 'Document Requirements',
  [STATUS_CATEGORIES.INTAKE_WINDOW]: 'Application Intake Windows',
  [STATUS_CATEGORIES.APPLICATION]: 'Application Tracking Status',
  [STATUS_CATEGORIES.FEE]: 'Fee Information Status',
  [STATUS_CATEGORIES.ELIGIBILITY]: 'Eligibility Assessment',
};

const CATEGORY_DESCRIPTIONS = {
  [STATUS_CATEGORIES.REQUIREMENT]: 'Labels shown next to required documents on service pages.',
  [STATUS_CATEGORIES.INTAKE_WINDOW]: 'States shown for application intake rounds on service pages.',
  [STATUS_CATEGORIES.APPLICATION]: 'Statuses shown when tracking your application in Civic Help Setu.',
  [STATUS_CATEGORIES.FEE]: 'Indicators shown for fee transparency information.',
  [STATUS_CATEGORIES.ELIGIBILITY]: 'Results shown by the eligibility checker tool.',
};

const StatusLegend = ({
  categories = Object.values(STATUS_CATEGORIES),
  showHeader = true,
  compact = false,
  className = '',
}) => {
  const [expandedCategories, setExpandedCategories] = useState(() =>
    compact ? [] : categories
  );

  const toggleCategory = (category) => {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const isExpanded = (category) => expandedCategories.includes(category);

  const renderCategory = (category) => {
    const statusKeys = getAllStatusKeys(category);
    if (statusKeys.length === 0) return null;

    return (
      <section
        key={category}
        className="status-legend__category"
        style={{
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--glass-bg-subtle)',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          className="status-legend__category-header"
          onClick={() => toggleCategory(category)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: compact ? '0.75rem 1rem' : '1rem 1.25rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: compact ? '0.9rem' : '1rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            gap: '0.75rem',
          }}
          aria-expanded={isExpanded(category)}
          aria-controls={`status-legend-${category}-content`}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={compact ? 16 : 18} aria-hidden="true" />
            {CATEGORY_LABELS[category] || category}
          </span>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.75rem',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              padding: '0.125rem 0.5rem',
              background: 'var(--glass-bg)',
              borderRadius: '99px',
            }}
          >
            {statusKeys.length} terms
          </span>
          {isExpanded(category) ? (
            <ChevronUp size={compact ? 14 : 16} aria-hidden="true" />
          ) : (
            <ChevronDown size={compact ? 14 : 16} aria-hidden="true" />
          )}
        </button>

        <div
          id={`status-legend-${category}-content`}
          role="region"
          aria-labelledby={`status-legend-${category}-header`}
          hidden={!isExpanded(category)}
          style={{
            padding: compact ? '0 1rem 0.75rem' : '0 1.25rem 1rem',
            borderTop: '1px solid var(--border-light)',
            display: isExpanded(category) ? 'block' : 'none',
          }}
        >
          <p
            style={{
              margin: compact ? '0.5rem 0' : '0.75rem 0',
              fontSize: compact ? '0.8rem' : '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.5',
            }}
          >
            {CATEGORY_DESCRIPTIONS[category]}
          </p>
          <dl style={{ margin: 0, display: 'grid', gap: compact ? '0.5rem' : '0.75rem' }}>
            {statusKeys.map((statusKey) => {
              const def = STATUS_DEFINITIONS[category][statusKey];
              if (!def) return null;

              return (
                <div
                  key={statusKey}
                  className="status-legend__item"
                  style={{
                    padding: compact ? '0.625rem' : '0.75rem',
                    background: 'var(--glass-bg)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      marginBottom: compact ? '0.375rem' : '0.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <dt
                      style={{
                        fontWeight: '700',
                        fontSize: compact ? '0.875rem' : '0.9375rem',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      {def.shortLabel || def.label}
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: '600',
                          padding: '0.0625rem 0.375rem',
                          background: def.platformStatus
                            ? 'rgba(56, 189, 248, 0.15)'
                            : 'rgba(148, 163, 184, 0.15)',
                          color: def.platformStatus ? 'var(--accent-main)' : 'var(--text-tertiary)',
                          borderRadius: '99px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {def.platformStatus ? 'Platform Status' : 'Official Status'}
                      </span>
                    </dt>
                  </div>
                  <dd style={{ margin: 0, color: 'var(--text-secondary)', fontSize: compact ? '0.8rem' : '0.875rem', lineHeight: '1.5' }}>
                    <p style={{ margin: '0 0 0.375rem' }}>{def.description}</p>
                    {def.whatItDoesNotMean && (
                      <p
                        style={{
                          margin: '0 0 0.375rem',
                          paddingLeft: '0.75rem',
                          borderLeft: '2px solid rgba(239, 68, 68, 0.3)',
                          color: 'rgba(239, 68, 68, 0.9)',
                          fontSize: compact ? '0.75rem' : '0.8125rem',
                          lineHeight: '1.5',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: '600' }}>
                          <AlertCircle size={10} aria-hidden="true" /> Does not mean:
                        </span>{' '}
                        {def.whatItDoesNotMean}
                      </p>
                    )}
                    {def.nextSteps && (
                      <p
                        style={{
                          margin: 0,
                          paddingLeft: '0.75rem',
                          borderLeft: '2px solid rgba(16, 185, 129, 0.3)',
                          color: 'rgba(16, 185, 129, 0.9)',
                          fontSize: compact ? '0.75rem' : '0.8125rem',
                          lineHeight: '1.5',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: '600' }}>
                          <Info size={10} aria-hidden="true" /> Next step:
                        </span>{' '}
                        {def.nextSteps}
                      </p>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </section>
    );
  };

  const categoriesToShow = useMemo(
    () => categories.filter((c) => getAllStatusKeys(c).length > 0),
    [categories]
  );

  if (categoriesToShow.length === 0) return null;

  return (
    <nav
      className={`status-legend ${className}`}
      aria-label="Status terminology legend"
      style={{
        display: 'grid',
        gap: '1rem',
        maxWidth: '100%',
      }}
    >
      {showHeader && (
        <header className="status-legend__header" style={{ marginBottom: compact ? '0.5rem' : '0.75rem' }}>
          <h2
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: compact ? '1.1rem' : '1.25rem',
              fontWeight: '700',
              margin: 0,
              color: 'var(--text-primary)',
            }}
          >
            <BookOpen size={compact ? 20 : 22} aria-hidden="true" />
            Status & Terminology Legend
          </h2>
          <p
            style={{
              margin: '0.375rem 0 0',
              fontSize: compact ? '0.8rem' : '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.5',
            }}
          >
            Plain-language explanations of the status labels used across Civic Help Setu. These are platform-generated descriptions based on available data, not official government decisions. Always confirm with the official source.
          </p>
        </header>
      )}

      {categoriesToShow.map(renderCategory)}

      <footer
        className="status-legend__footer"
        style={{
          marginTop: '0.75rem',
          padding: '0.75rem 1rem',
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8125rem',
          color: 'var(--accent-dark)',
          lineHeight: '1.5',
        }}
      >
        <p style={{ margin: 0, display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <Info size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: '0.125rem' }} />
          <strong>Important:</strong>{' '}
          Civic Help Setu is an independent civic information platform. Status labels here reflect our assessment of publicly available data. They are not official government determinations, approvals, or legal advice. For authoritative decisions, always refer to the official government department or portal.
        </p>
      </footer>
    </nav>
  );
};

export default StatusLegend;