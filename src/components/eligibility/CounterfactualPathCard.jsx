import { Check, Zap, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const DIFFICULTY_BADGES = {
  easy: { label: 'Direct / Document Action', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)' },
  moderate: { label: 'Moderate Effort', color: '#ca8a04', bg: 'rgba(202, 138, 4, 0.12)' },
  complex: { label: 'Multi-Condition Change', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.12)' },
};

export default function CounterfactualPathCard({ counterfactual, onApply }) {
  if (!counterfactual) return null;

  const diff = DIFFICULTY_BADGES[counterfactual.difficulty] || DIFFICULTY_BADGES.easy;

  return (
    <div
      role="article"
      aria-label="Actionable Counterfactual Scenario"
      style={{
        padding: '1.25rem',
        borderRadius: '0.75rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        transition: 'transform 0.2s ease, border-color 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Sparkles size={16} style={{ color: 'var(--accent-main)' }} aria-hidden="true" />
          <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            What-If Recourse Scenario
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: '700',
              padding: '0.2rem 0.6rem',
              borderRadius: '99px',
              color: diff.color,
              background: diff.bg,
            }}
          >
            {diff.label}
          </span>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: '700',
              padding: '0.2rem 0.6rem',
              borderRadius: '99px',
              color: '#16a34a',
              background: 'rgba(22, 163, 74, 0.12)',
            }}
          >
            Outcome: {counterfactual.targetStatus}
          </span>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
        {counterfactual.summary}
      </p>

      {/* List of changes */}
      <ul style={{ listStyle: 'none', padding: 0, margin: '0.25rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {counterfactual.changes.map((change, idx) => (
          <li
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              fontSize: '0.82rem',
              color: 'var(--text-primary)',
            }}
          >
            <Check size={14} style={{ color: '#16a34a', marginTop: '0.2rem', flexShrink: 0 }} aria-hidden="true" />
            <div style={{ flex: 1 }}>
              <span>{change.description}</span>
              {change.actionLink && (
                <div style={{ marginTop: '0.2rem' }}>
                  <Link
                    to={change.actionLink}
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: '600',
                      color: 'var(--accent-main)',
                      textDecoration: 'underline',
                    }}
                  >
                    View Official Procedure Guide & Checklist →
                  </Link>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Action button to load this scenario into simulator */}
      {onApply && (
        <button
          type="button"
          onClick={() => onApply(counterfactual)}
          style={{
            alignSelf: 'flex-start',
            marginTop: '0.5rem',
            padding: '0.45rem 0.9rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--accent-main)',
            background: 'rgba(var(--accent-rgb, 14, 165, 233), 0.08)',
            color: 'var(--accent-main)',
            fontWeight: '700',
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <Zap size={14} aria-hidden="true" />
          Apply Scenario to Live Simulator
        </button>
      )}
    </div>
  );
}
