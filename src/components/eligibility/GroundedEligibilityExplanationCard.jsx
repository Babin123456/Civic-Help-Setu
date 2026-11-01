import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  FileCheck,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { explainEligibilityAssessment } from '../../services/groundedEligibilityExplainerService';

const STATUS_THEMES = {
  eligible: {
    bg: 'rgba(16, 185, 129, 0.08)',
    border: 'rgba(16, 185, 129, 0.3)',
    color: '#10b981',
    badgeBg: '#dcfce7',
    badgeColor: '#15803d',
    icon: CheckCircle2,
    title: 'Likely Eligible'
  },
  conditional: {
    bg: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.3)',
    color: '#f59e0b',
    badgeBg: '#fef3c7',
    badgeColor: '#b45309',
    icon: AlertTriangle,
    title: 'Conditionally Eligible'
  },
  ineligible: {
    bg: 'rgba(239, 68, 68, 0.08)',
    border: 'rgba(239, 68, 68, 0.3)',
    color: '#ef4444',
    badgeBg: '#fee2e2',
    badgeColor: '#b91c1c',
    icon: XCircle,
    title: 'Likely Ineligible'
  },
  unknown: {
    bg: 'rgba(99, 102, 241, 0.08)',
    border: 'rgba(99, 102, 241, 0.3)',
    color: '#6366f1',
    badgeBg: '#e0e7ff',
    badgeColor: '#3730a3',
    icon: HelpCircle,
    title: 'Status Inconclusive'
  }
};

export default function GroundedEligibilityExplanationCard({ assessment }) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (!assessment) return null;

  const exp = explainEligibilityAssessment(assessment);
  const theme = STATUS_THEMES[exp.status] || STATUS_THEMES.unknown;
  const StatusIcon = theme.icon;

  return (
    <article
      className="card"
      style={{
        padding: '1.25rem 1.5rem',
        borderRadius: '12px',
        backgroundColor: theme.bg,
        border: `1px solid ${theme.border}`,
        margin: '0.75rem 0',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <StatusIcon size={20} color={theme.color} />
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {exp.schemeName}: Grounded Eligibility Analysis
          </h4>
        </div>

        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            padding: '3px 10px',
            borderRadius: '99px',
            backgroundColor: theme.badgeBg,
            color: theme.badgeColor
          }}
        >
          {theme.title}
        </span>
      </div>

      {/* Narrative Explanation */}
      <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {exp.narrative}
      </p>

      {/* Key Takeaways */}
      {exp.keyTakeaways.length > 0 && (
        <div style={{ backgroundColor: 'var(--bg-main, #ffffff)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-main)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
            <FileCheck size={14} color="var(--accent-main)" /> Actionable Summary:
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {exp.keyTakeaways.map((takeaway, idx) => (
              <li key={idx} style={{ marginBottom: '0.2rem' }}>{takeaway}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Criteria Breakdown Toggle */}
      {(exp.breakdown.matchedCount > 0 || exp.breakdown.unmatchedCount > 0 || exp.breakdown.unassessedCount > 0) && (
        <div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowBreakdown((prev) => !prev)}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
            aria-expanded={showBreakdown}
          >
            {showBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>
              {showBreakdown ? 'Hide Detailed Criteria Breakdown' : `Inspect Evaluated Criteria (${exp.breakdown.matchedCount} matched, ${exp.breakdown.unmatchedCount} failed, ${exp.breakdown.unassessedCount} unassessed)`}
            </span>
          </button>

          {showBreakdown && (
            <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
              {/* Matched */}
              {exp.breakdown.matched.map((m) => (
                <div key={m.id || m.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', padding: '0.4rem 0.6rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '6px' }}>
                  <CheckCircle2 size={15} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ color: '#15803d' }}>{m.label}: </strong>
                    <span style={{ color: 'var(--text-secondary)' }}>{m.detail || 'Satisfied'}</span>
                  </div>
                </div>
              ))}

              {/* Unmatched / Mismatch */}
              {exp.breakdown.unmatched.map((u) => (
                <div key={u.id || u.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', padding: '0.4rem 0.6rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '6px' }}>
                  <XCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ color: '#b91c1c' }}>{u.label}: </strong>
                    <span style={{ color: 'var(--text-secondary)' }}>{u.detail || 'Did not meet published condition'}</span>
                  </div>
                </div>
              ))}

              {/* Unassessed / Missing answers */}
              {exp.breakdown.unassessed.map((un) => (
                <div key={un.id || un.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', padding: '0.4rem 0.6rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '6px' }}>
                  <HelpCircle size={15} color="#6366f1" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ color: '#3730a3' }}>{un.label}: </strong>
                    <span style={{ color: 'var(--text-secondary)' }}>{un.detail || 'Data not provided'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mandatory Official Verification Footer */}
      <footer style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--text-tertiary)', borderTop: `1px solid ${theme.border}`, paddingTop: '0.5rem' }}>
        <Building2 size={13} style={{ flexShrink: 0 }} />
        <span>{exp.verificationNotice}</span>
      </footer>
    </article>
  );
}
