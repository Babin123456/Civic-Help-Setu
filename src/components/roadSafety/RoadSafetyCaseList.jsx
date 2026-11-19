import { AlertTriangle, MapPin, Eye, ClipboardCheck, Wrench, ShieldAlert } from 'lucide-react';
import { CASE_STATES, CASE_STATE_LABELS } from '../../data/roadSafetyContract';
import { can } from '../../services/accessControl';

const STATUS_BADGE_STYLES = {
  [CASE_STATES.CANDIDATE]: { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', label: 'Candidate' },
  [CASE_STATES.INSPECTION_SCHEDULED]: { bg: 'rgba(245, 158, 11, 0.14)', color: '#f59e0b', label: 'Scheduled' },
  [CASE_STATES.INSPECTED]: { bg: 'rgba(56, 189, 248, 0.14)', color: 'var(--accent-main)', label: 'Inspected' },
  [CASE_STATES.INTERVENTION_PLANNED]: { bg: 'rgba(168, 85, 247, 0.14)', color: '#a855f7', label: 'Intervention Planned' },
  [CASE_STATES.IN_PROGRESS]: { bg: 'rgba(245, 158, 11, 0.14)', color: '#d97706', label: 'In Progress' },
  [CASE_STATES.MONITORING]: { bg: 'rgba(14, 165, 233, 0.14)', color: '#0284c7', label: 'Monitoring' },
  [CASE_STATES.RESOLVED]: { bg: 'rgba(16, 185, 129, 0.14)', color: '#10b981', label: 'Resolved' },
  [CASE_STATES.DISMISSED_FALSE_POSITIVE]: { bg: 'rgba(148, 163, 184, 0.16)', color: 'var(--text-secondary)', label: 'Dismissed' },
  [CASE_STATES.DEFERRED]: { bg: 'rgba(148, 163, 184, 0.16)', color: 'var(--text-secondary)', label: 'Deferred' },
};

function getRiskTier(score) {
  if (score >= 75) return { label: 'Priority 1 (Critical)', color: '#ef4444', icon: ShieldAlert };
  if (score >= 50) return { label: 'Priority 2 (High)', color: '#f59e0b', icon: AlertTriangle };
  return { label: 'Priority 3 (Moderate)', color: '#10b981', icon: ShieldAlert };
}

export default function RoadSafetyCaseList({
  cases = [],
  onSelectCase,
  onScheduleInspection,
  onPlanIntervention,
}) {
  const canReview = can('roadSafety.review');

  if (cases.length === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          padding: '3rem 1.5rem',
          textAlign: 'center',
          background: 'var(--bg-surface)',
          borderRadius: '0.75rem',
          border: '1px dashed var(--border-main)',
        }}
      >
        <AlertTriangle size={32} color="var(--text-tertiary)" style={{ margin: '0 auto 0.75rem' }} />
        <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
          No Road Corridors Matched
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto' }}>
          No road segments or review cases match your current search and filter parameters. Try clearing filters or lowering the minimum risk score threshold.
        </p>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Identified road safety blackspot candidate list"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-main)',
        borderRadius: '0.75rem',
        overflow: 'hidden',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '0.82rem',
          }}
        >
          <thead>
            <tr
              style={{
                background: 'var(--bg-main)',
                borderBottom: '1px solid var(--border-main)',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <th scope="col" style={{ padding: '0.75rem 1rem' }}>Rank & Corridor</th>
              <th scope="col" style={{ padding: '0.75rem 1rem' }}>Jurisdiction</th>
              <th scope="col" style={{ padding: '0.75rem 1rem' }}>Risk Score</th>
              <th scope="col" style={{ padding: '0.75rem 1rem' }}>Weighted Severity</th>
              <th scope="col" style={{ padding: '0.75rem 1rem' }}>Exposure Rate</th>
              <th scope="col" style={{ padding: '0.75rem 1rem' }}>Status</th>
              <th scope="col" style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c, index) => {
              const tier = getRiskTier(c.compositeRiskScore);
              const statusBadge = STATUS_BADGE_STYLES[c.status] || {
                bg: 'rgba(148, 163, 184, 0.16)',
                color: 'var(--text-secondary)',
                label: c.status,
              };

              return (
                <tr
                  key={c.id}
                  style={{
                    borderBottom: '1px solid var(--border-main)',
                    transition: 'background 0.15s ease',
                  }}
                >
                  {/* Rank & Corridor */}
                  <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '1.6rem',
                          height: '1.6rem',
                          borderRadius: '0.4rem',
                          background: 'var(--bg-main)',
                          border: '1px solid var(--border-main)',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          color: 'var(--text-primary)',
                        }}
                      >
                        #{index + 1}
                      </span>
                      <div>
                        <button
                          type="button"
                          onClick={() => onSelectCase(c)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            textAlign: 'left',
                            fontWeight: '700',
                            color: 'var(--text-primary)',
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                          }}
                        >
                          {c.segment?.name || 'Road Corridor'}
                        </button>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                          Code: {c.segment?.code} • {c.segment?.roadType?.replace('_', ' ').toUpperCase()}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Jurisdiction */}
                  <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)' }}>
                      <MapPin size={13} style={{ flexShrink: 0 }} />
                      <span>
                        {c.segment?.jurisdiction?.district}, {c.segment?.jurisdiction?.state}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>
                      {c.segment?.jurisdiction?.ward}
                    </div>
                  </td>

                  {/* Risk Score */}
                  <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <tier.icon size={14} color={tier.color} />
                      <span style={{ fontWeight: '800', color: tier.color, fontSize: '0.95rem' }}>
                        {c.compositeRiskScore}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>/100</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: tier.color, fontWeight: '600' }}>
                      {tier.label}
                    </div>
                  </td>

                  {/* Weighted Severity */}
                  <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top' }}>
                    <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                      {c.severityWeightedFrequency}
                    </span>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                      MoRTH Weighted Points
                    </div>
                  </td>

                  {/* Exposure Rate */}
                  <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top' }}>
                    {c.exposureRatePerMillionVkm !== null ? (
                      <div>
                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                          {c.exposureRatePerMillionVkm}
                        </span>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                          per Million V-KM
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: '600' }}>
                          Uncertain
                        </span>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                          Baseline Estimated
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.55rem',
                        borderRadius: '999px',
                        background: statusBadge.bg,
                        color: statusBadge.color,
                        fontWeight: '700',
                        fontSize: '0.72rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {CASE_STATE_LABELS[c.status] || c.status}
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => onSelectCase(c)}
                        title="Review complete evidence, geometry, and timeline"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.45rem',
                          background: 'var(--bg-main)',
                          border: '1px solid var(--border-main)',
                          color: 'var(--text-primary)',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        <Eye size={13} color="var(--accent-main)" />
                        Review
                      </button>

                      {canReview && (
                        <>
                          <button
                            type="button"
                            onClick={() => onScheduleInspection(c)}
                            title="Schedule or document site inspection"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.35rem 0.65rem',
                              borderRadius: '0.45rem',
                              background: 'var(--bg-main)',
                              border: '1px solid var(--border-main)',
                              color: 'var(--text-primary)',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            <ClipboardCheck size={13} color="#10b981" />
                            Inspect
                          </button>

                          <button
                            type="button"
                            onClick={() => onPlanIntervention(c)}
                            title="Plan or track physical engineering countermeasure"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.35rem 0.65rem',
                              borderRadius: '0.45rem',
                              background: 'var(--bg-main)',
                              border: '1px solid var(--border-main)',
                              color: 'var(--text-primary)',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            <Wrench size={13} color="#f59e0b" />
                            Intervene
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

