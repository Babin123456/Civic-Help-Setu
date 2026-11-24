import { useState } from 'react';
import { CheckCircle, XCircle, Edit3, Sparkles } from 'lucide-react';

export const RecommendationCard = ({
  recommendation,
  onRecordDecision,
  isPrivileged = false,
}) => {
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [decisionType, setDecisionType] = useState('ACCEPTED');
  const [justification, setJustification] = useState('');
  const [modifiedSop, setModifiedSop] = useState(recommendation?.suggestedRemediation || '');

  if (!recommendation) return null;

  const isDecided = recommendation.status && recommendation.status !== 'PENDING';

  const handleOpenDecision = (type) => {
    setDecisionType(type);
    setShowOverrideModal(true);
  };

  const handleSubmitDecision = (e) => {
    e.preventDefault();
    onRecordDecision(recommendation.id, decisionType, {
      reason: justification,
      modifiedRemediation: decisionType === 'MODIFIED' ? modifiedSop : '',
    });
    setShowOverrideModal(false);
    setJustification('');
  };

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return { border: 'rgba(239, 68, 68, 0.4)', bg: 'rgba(239, 68, 68, 0.08)', text: '#ef4444' };
      case 'HIGH':
        return { border: 'rgba(245, 158, 11, 0.4)', bg: 'rgba(245, 158, 11, 0.08)', text: '#d97706' };
      default:
        return { border: 'rgba(2, 132, 199, 0.4)', bg: 'rgba(2, 132, 199, 0.08)', text: '#0284c7' };
    }
  };

  const style = getSeverityStyle(recommendation.severity);

  return (
    <div
      style={{
        padding: '1rem',
        borderRadius: '0.65rem',
        background: 'var(--bg-card)',
        border: `1px solid ${style.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      {/* HEADER & METADATA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span
            style={{
              padding: '0.15rem 0.5rem',
              borderRadius: '99px',
              fontSize: '0.72rem',
              fontWeight: '700',
              background: style.bg,
              color: style.text,
              border: `1px solid ${style.border}`,
            }}
          >
            {recommendation.severity} RISK
          </span>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem',
              padding: '0.15rem 0.5rem',
              borderRadius: '99px',
              fontSize: '0.72rem',
              background: 'var(--glass-bg)',
              color: 'var(--text-tertiary)',
            }}
          >
            <Sparkles size={11} aria-hidden="true" />
            <span>Ruleset v{recommendation.rulesetVersion}</span>
          </span>

          {isDecided && (
            <span
              style={{
                padding: '0.15rem 0.5rem',
                borderRadius: '99px',
                fontSize: '0.72rem',
                fontWeight: '700',
                background:
                  recommendation.status === 'ACCEPTED'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : recommendation.status === 'MODIFIED'
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                color:
                  recommendation.status === 'ACCEPTED'
                    ? '#10b981'
                    : recommendation.status === 'MODIFIED'
                    ? '#d97706'
                    : '#ef4444',
              }}
            >
              HUMAN SIGN-OFF: {recommendation.status}
            </span>
          )}
        </div>

        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
          {new Date(recommendation.executionTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* RATIONALE & CONTRIBUTING FIELDS */}
      <div>
        <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: '700' }}>
          {recommendation.targetServiceName}
        </h4>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          {recommendation.rationale}
        </p>

        {recommendation.contributingFields?.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Evaluated Parameters:</span>
            {recommendation.contributingFields.map((field, i) => (
              <code
                key={i}
                style={{
                  padding: '0.1rem 0.35rem',
                  borderRadius: '3px',
                  background: 'var(--glass-bg)',
                  fontSize: '0.72rem',
                  color: 'var(--text-secondary)',
                }}
              >
                {field}
              </code>
            ))}
          </div>
        )}
      </div>

      {/* SUGGESTED REMEDIATION */}
      <div
        style={{
          padding: '0.6rem 0.75rem',
          borderRadius: '0.4rem',
          background: 'var(--glass-bg)',
          border: '1px solid var(--border-light)',
          fontSize: '0.82rem',
        }}
      >
        <strong style={{ color: 'var(--text-primary)' }}>Suggested Continuity Action: </strong>
        <span style={{ color: 'var(--text-secondary)' }}>
          {recommendation.modifiedRemediation || recommendation.suggestedRemediation}
        </span>
      </div>

      {/* HUMAN DECISION JUSTIFICATION DISPLAY */}
      {isDecided && recommendation.reason && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          Officer Justification: "{recommendation.reason}" (by {recommendation.decidedBy})
        </div>
      )}

      {/* ACTION BUTTONS (Privileged Officers) */}
      {isPrivileged && !isDecided && (
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            justifyContent: 'flex-end',
            borderTop: '1px solid var(--border-light)',
            paddingTop: '0.65rem',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleOpenDecision('REJECTED')}
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <XCircle size={13} aria-hidden="true" />
            <span>Dismiss</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleOpenDecision('MODIFIED')}
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <Edit3 size={13} aria-hidden="true" />
            <span>Modify SOP</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleOpenDecision('ACCEPTED')}
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <CheckCircle size={13} aria-hidden="true" />
            <span>Accept Suggestion</span>
          </button>
        </div>
      )}

      {/* OVERRIDE & SIGN-OFF MODAL */}
      {showOverrideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="decision-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <form
            onSubmit={handleSubmitDecision}
            style={{
              width: '100%',
              maxWidth: '480px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-main)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <h3 id="decision-modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>
              Authorized Human Decision: {decisionType}
            </h3>

            {decisionType === 'MODIFIED' && (
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: '700', display: 'block', marginBottom: '0.3rem' }}>
                  Custom Remediation SOP:
                </label>
                <textarea
                  rows="3"
                  required
                  value={modifiedSop}
                  onChange={(e) => setModifiedSop(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-main)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                  }}
                />
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', display: 'block', marginBottom: '0.3rem' }}>
                Operational Reason & Audit Justification:
              </label>
              <textarea
                rows="3"
                required
                placeholder="State why this recommendation is accepted, modified, or rejected per departmental policy..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-main)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowOverrideModal(false)}
                style={{ fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ fontSize: '0.85rem' }}
              >
                Confirm Sign-off
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
