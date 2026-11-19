import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle,
  FileSearch,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { SEVERITY_LEVELS, REVIEW_STATUSES } from '../../data/openContractingContract.js';

export default function RedFlagEvidenceCard({
  flag,
  onInspectLifecycle,
  onReviewClick,
  userRole = 'citizen',
}) {
  const severityInfo = SEVERITY_LEVELS[flag.severity] || {
    label: flag.severity,
    badgeClass: 'badge-medium',
  };

  const statusInfo = REVIEW_STATUSES[flag.status] || {
    label: flag.status || 'Pending Review',
    badgeClass: 'badge-warning',
  };

  const isCritical = flag.severity === 'critical';
  const isHigh = flag.severity === 'high';
  const isReviewed = flag.status && flag.status !== 'pending_review';

  const borderColor = isCritical
    ? '#ef4444'
    : isHigh
      ? '#f97316'
      : 'var(--border-light, rgba(255, 255, 255, 0.15))';

  return (
    <article
      tabIndex="0"
      className="card red-flag-card"
      aria-labelledby={`flag-title-${flag.id}`}
      style={{
        padding: '1.25rem',
        borderRadius: '0.75rem',
        border: `1px solid ${borderColor}`,
        background: 'var(--bg-card, #1e293b)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        position: 'relative',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
      }}
    >
      {/* Header with Indicator Code & Status Badges */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.2rem 0.5rem',
              borderRadius: '0.25rem',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              letterSpacing: '0.5px',
            }}
          >
            {flag.indicatorCode || 'OCDS-RF'}
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.2rem 0.55rem',
              borderRadius: '0.25rem',
              background: isCritical
                ? 'rgba(239, 68, 68, 0.2)'
                : isHigh
                  ? 'rgba(249, 115, 22, 0.2)'
                  : 'rgba(245, 158, 11, 0.2)',
              color: isCritical ? '#f87171' : isHigh ? '#fb923c' : '#fbbf24',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <ShieldAlert size={12} aria-hidden="true" />
            {severityInfo.label} Severity
          </span>
        </div>

        {/* Human Review Status Badge */}
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: '0.2rem 0.55rem',
            borderRadius: '0.25rem',
            background: isReviewed ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: isReviewed ? '#4ade80' : '#fbbf24',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          {isReviewed ? <CheckCircle size={12} aria-hidden="true" /> : <AlertTriangle size={12} aria-hidden="true" />}
          {statusInfo.label}
        </span>
      </div>

      {/* Title & Anomaly Explanation */}
      <div>
        <h3
          id={`flag-title-${flag.id}`}
          style={{
            fontSize: '1.05rem',
            fontWeight: 600,
            margin: '0 0 0.35rem 0',
            color: 'var(--text-primary)',
          }}
        >
          {flag.title}
        </h3>
        {flag.tenderRefNumber && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
            Ref: <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{flag.tenderRefNumber}</span>{' '}
            {flag.jurisdiction && `• ${flag.jurisdiction}`}
          </div>
        )}
        <p style={{ fontSize: '0.875rem', lineHeight: 1.5, margin: 0, color: '#cbd5e1' }}>
          {flag.explanation}
        </p>
      </div>

      {/* Influencing Input Fields */}
      {flag.influencingFields && flag.influencingFields.length > 0 && (
        <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.65rem 0.85rem', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            Influencing Fields &amp; Evidence:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {flag.influencingFields.map((field, idx) => (
              <code
                key={idx}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '0.25rem',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#93c5fd',
                }}
              >
                {field}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Comparison Cohort Baseline Table */}
      {flag.cohortBenchmark && (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>
              Comparison Cohort: {flag.cohortBenchmark.cohortName} (n={flag.cohortBenchmark.cohortSize})
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem',
              fontSize: '0.8rem',
            }}
          >
            <div>
              <span style={{ color: '#94a3b8' }}>Cohort Baseline: </span>
              <strong style={{ color: '#f8fafc' }}>{flag.cohortBenchmark.benchmarkValue}</strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>This Notice: </span>
              <strong style={{ color: isCritical ? '#f87171' : '#fbbf24' }}>
                {flag.cohortBenchmark.recordValue}
              </strong>
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '0.35rem' }}>
            Variance: {flag.cohortBenchmark.variance}
          </div>
        </div>
      )}

      {/* Recommended Auditor Question */}
      {flag.recommendedAuditorAction && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            background: 'rgba(56, 189, 248, 0.08)',
            padding: '0.65rem 0.75rem',
            borderRadius: '0.375rem',
            fontSize: '0.8rem',
            color: '#bae6fd',
          }}
        >
          <HelpCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
          <span>
            <strong>Auditor Inquest Guidance:</strong> {flag.recommendedAuditorAction}
          </span>
        </div>
      )}

      {/* Footer Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Ruleset {flag.rulesetVersion}
        </span>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {flag.noticeId && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onInspectLifecycle(flag.noticeId)}
              style={{
                fontSize: '0.8rem',
                padding: '0.35rem 0.65rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <FileSearch size={14} aria-hidden="true" />
              Inspect Lifecycle
            </button>
          )}

          {userRole !== 'citizen' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onReviewClick(flag)}
              style={{
                fontSize: '0.8rem',
                padding: '0.35rem 0.65rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              Record Review
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
