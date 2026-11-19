import { useState } from 'react';
import { Sparkles, Check, X, Edit3 } from 'lucide-react';
import { recordRecommendationDecision } from '../../services/toiletDiagnosticsService';
import { useToast } from '../../context/ToastContext';

export default function ToiletRecommendationsCard({ recommendations = [], onDecisionRecorded }) {
  const { toast } = useToast();
  const [activeEditingId, setActiveEditingId] = useState(null);
  const [modifiedAction, setModifiedAction] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');

  if (!recommendations || recommendations.length === 0) return null;

  const handleDecision = (recId, decision) => {
    try {
      recordRecommendationDecision(
        recId,
        {
          decision,
          notes: decisionNotes,
          modifiedAction: decision === 'modified' ? modifiedAction : null,
        },
        { role: 'operator' }
      );

      toast?.success?.(`Recommendation ${decision}. Human decision logged in audit ledger.`);
      setActiveEditingId(null);
      setDecisionNotes('');
      setModifiedAction('');
      onDecisionRecorded?.();
    } catch {
      toast?.error?.('Failed to record recommendation decision.');
    }
  };

  return (
    <section
      aria-label="Automated Sanitation Recommendations"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-main)',
        borderRadius: '1rem',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <Sparkles size={18} style={{ color: 'var(--accent-main, #0284c7)' }} />
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          Bounded Sanitation Intelligence & Operational Insights ({recommendations.length})
        </h2>
      </div>
      <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Explainable, deterministic rulesets assist operators with sanitation scheduling and defect escalation. Human review is mandatory.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            style={{
              padding: '1rem',
              backgroundColor: 'var(--bg-main)',
              borderRadius: '0.75rem',
              border: `1px solid ${rec.severity === 'high' ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-subtle)'}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{rec.title}</strong>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.5rem',
                  borderRadius: '999px',
                  backgroundColor: rec.severity === 'high' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                  color: rec.severity === 'high' ? 'var(--danger-main)' : 'var(--warning-main)',
                }}
              >
                {rec.severity.toUpperCase()} PRIORITY
              </span>
            </div>

            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {rec.summary}
            </p>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '0.75rem' }}>
              Suggested Action: {rec.suggestedAction}
            </div>

            {/* Explainability Box */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '0.5rem',
                padding: '0.65rem',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginBottom: '0.75rem',
              }}
            >
              <div>Ruleset: <strong>{rec.rulesetVersion}</strong> | Timestamp: {new Date(rec.executionTimestamp).toLocaleTimeString()}</div>
              <div>Source Fields: <code>{rec.explainability?.influencingFields?.join(', ')}</code></div>
              <div>Observed Evidence: {rec.explainability?.observedValue}</div>
              <div>Threshold Rule: {rec.explainability?.thresholdRule}</div>
            </div>

            {/* Human Decision Display or Action Controls */}
            {rec.humanDecision ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--success-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Check size={14} /> Decision Recorded: <strong>{rec.humanDecision.decision.toUpperCase()}</strong> by {rec.humanDecision.decidedByRole}
                {rec.humanDecision.notes && <span>— {rec.humanDecision.notes}</span>}
              </div>
            ) : activeEditingId === rec.id ? (
              <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--bg-surface)', borderRadius: '0.5rem', border: '1px solid var(--border-main)' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  Custom Action / Modified Directive
                </label>
                <input
                  type="text"
                  value={modifiedAction}
                  onChange={(e) => setModifiedAction(e.target.value)}
                  placeholder="e.g. Dispatched evening shift instead of immediate sweep"
                  style={{ width: '100%', padding: '0.4rem', borderRadius: '0.25rem', border: '1px solid var(--border-main)', fontSize: '0.85rem', marginBottom: '0.5rem' }}
                />

                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  Reason / Supervisor Notes
                </label>
                <input
                  type="text"
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  placeholder="e.g. Rain slowed footfall"
                  style={{ width: '100%', padding: '0.4rem', borderRadius: '0.25rem', border: '1px solid var(--border-main)', fontSize: '0.85rem', marginBottom: '0.5rem' }}
                />

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleDecision(rec.id, 'modified')}
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                  >
                    Confirm Modified Action
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveEditingId(null)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleDecision(rec.id, 'accepted')}
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <Check size={13} /> Accept Recommendation
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveEditingId(rec.id);
                    setModifiedAction(rec.suggestedAction);
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <Edit3 size={13} /> Modify Action
                </button>
                <button
                  type="button"
                  onClick={() => handleDecision(rec.id, 'rejected')}
                  className="btn btn-outline"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <X size={13} /> Dismiss
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

