import { useState, useMemo } from 'react';
import {
  Scale,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Filter,
  Sparkles,
  Info,
  ShieldCheck,
} from 'lucide-react';
import {
  explainEligibilityComparison,
  CRITERIA_STATUS,
  NOT_STATED_IN_CATALOGUE,
} from '../../services/eligibilityComparisonExplainerService';

export default function EligibilityComparisonExplainerSection({ comparedServices = [] }) {
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'DIFF_ONLY'

  const comparison = useMemo(
    () => explainEligibilityComparison(comparedServices),
    [comparedServices]
  );

  if (!comparedServices || comparedServices.length < 2) {
    return null;
  }

  const { dimensions, summary, keyDifferentiators, advisoryNotice, services } = comparison;

  const filteredDimensions = useMemo(() => {
    if (filterMode === 'DIFF_ONLY') {
      return dimensions.filter(
        (d) =>
          d.status === CRITERIA_STATUS.DIFFERING ||
          d.status === CRITERIA_STATUS.SERVICE_SPECIFIC
      );
    }
    return dimensions;
  }, [dimensions, filterMode]);

  const getStatusBadge = (status) => {
    switch (status) {
      case CRITERIA_STATUS.SHARED:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              backgroundColor: '#dcfce7',
              color: '#166534',
              padding: '0.15rem 0.45rem',
              borderRadius: '0.25rem',
              fontSize: '0.725rem',
              fontWeight: 700,
            }}
          >
            <CheckCircle2 style={{ width: '0.8rem', height: '0.8rem' }} />
            Shared Condition
          </span>
        );
      case CRITERIA_STATUS.DIFFERING:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              padding: '0.15rem 0.45rem',
              borderRadius: '0.25rem',
              fontSize: '0.725rem',
              fontWeight: 700,
            }}
          >
            <AlertCircle style={{ width: '0.8rem', height: '0.8rem' }} />
            Differing Rule
          </span>
        );
      case CRITERIA_STATUS.SERVICE_SPECIFIC:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              backgroundColor: '#eff6ff',
              color: '#1e40af',
              padding: '0.15rem 0.45rem',
              borderRadius: '0.25rem',
              fontSize: '0.725rem',
              fontWeight: 700,
            }}
          >
            <Scale style={{ width: '0.8rem', height: '0.8rem' }} />
            Scheme-Specific
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              backgroundColor: '#f1f5f9',
              color: '#64748b',
              padding: '0.15rem 0.45rem',
              borderRadius: '0.25rem',
              fontSize: '0.725rem',
              fontWeight: 600,
            }}
          >
            <HelpCircle style={{ width: '0.8rem', height: '0.8rem' }} />
            Not Stated
          </span>
        );
    }
  };

  return (
    <div
      style={{
        marginTop: '1.5rem',
        padding: '1.25rem',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* Header and Summary Counts */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles style={{ width: '1.35rem', height: '1.35rem', color: '#2563eb' }} />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
              Eligibility Criteria Comparison Explainer
            </h3>
          </div>

          {/* Filter Toggle */}
          <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              style={{
                border: 'none',
                background: filterMode === 'ALL' ? '#ffffff' : 'transparent',
                fontWeight: filterMode === 'ALL' ? 700 : 500,
                color: filterMode === 'ALL' ? '#0f172a' : '#64748b',
                padding: '0.3rem 0.65rem',
                borderRadius: '0.35rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
                boxShadow: filterMode === 'ALL' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              All Dimensions ({dimensions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('DIFF_ONLY')}
              style={{
                border: 'none',
                background: filterMode === 'DIFF_ONLY' ? '#ffffff' : 'transparent',
                fontWeight: filterMode === 'DIFF_ONLY' ? 700 : 500,
                color: filterMode === 'DIFF_ONLY' ? '#0f172a' : '#64748b',
                padding: '0.3rem 0.65rem',
                borderRadius: '0.35rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
                boxShadow: filterMode === 'DIFF_ONLY' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Differences Only ({summary.differingCount + summary.specificCount})
            </button>
          </div>
        </div>

        {/* Metric Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '0.25rem', fontWeight: 600 }}>
            {summary.sharedCount} Shared Conditions
          </span>
          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '0.25rem', fontWeight: 600 }}>
            {summary.differingCount} Differing Thresholds
          </span>
          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: '0.25rem', fontWeight: 600 }}>
            {summary.specificCount} Scheme-Specific Rules
          </span>
        </div>
      </div>

      {/* Grounding Safety Notice */}
      <div
        style={{
          display: 'flex',
          gap: '0.6rem',
          padding: '0.75rem 1rem',
          backgroundColor: '#f8fafc',
          borderLeft: '4px solid #3b82f6',
          borderRadius: '0.35rem',
          fontSize: '0.8125rem',
          color: '#334155',
          lineHeight: 1.45,
        }}
      >
        <ShieldCheck style={{ width: '1.2rem', height: '1.2rem', color: '#2563eb', flexShrink: 0, marginTop: '0.1rem' }} />
        <div>
          <strong>Grounding Disclosure:</strong> {advisoryNotice}
        </div>
      </div>

      {/* Key Differentiators Summary */}
      {keyDifferentiators.length > 0 && (
        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#92400e', marginBottom: '0.4rem' }}>
            Key Eligibility Differentiators:
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.785rem', color: '#78350f', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {keyDifferentiators.map((diff, idx) => (
              <li key={idx}>
                <strong>{diff.dimension}:</strong> {diff.explanation}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Side-by-Side Criteria Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '0.75rem', minWidth: '160px', color: '#475569', fontWeight: 700 }}>
                Eligibility Dimension
              </th>
              {services.map((s) => (
                <th key={s.id} style={{ padding: '0.75rem', minWidth: '220px', color: '#0f172a', fontWeight: 700 }}>
                  <div>{s.title}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 400 }}>{s.department}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredDimensions.map((dim, rowIdx) => (
              <tr
                key={dim.dimensionId}
                style={{
                  borderBottom: '1px solid #f1f5f9',
                  backgroundColor: rowIdx % 2 === 0 ? '#ffffff' : '#fcfcfd',
                }}
              >
                <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>
                    {dim.label}
                  </div>
                  <div>{getStatusBadge(dim.status)}</div>
                </td>

                {dim.serviceEntries.map((entry) => {
                  const isUnstated = entry.text === NOT_STATED_IN_CATALOGUE;
                  return (
                    <td
                      key={entry.serviceId}
                      style={{
                        padding: '0.75rem',
                        verticalAlign: 'top',
                        color: isUnstated ? '#94a3b8' : '#1e293b',
                        fontStyle: isUnstated ? 'italic' : 'normal',
                        lineHeight: 1.45,
                      }}
                    >
                      {entry.text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
