import { useState } from 'react';
import {
  Scale,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  Copy,
  Check,
  FileText,
  Clock,
  Landmark,
  ExternalLink
} from 'lucide-react';
import {
  evaluateEscalationLadder,
  generateFirstAppealNotice,
} from '../../services/statutorySlaService';

export default function AppellateEscalationLadder({ application, citizenName = 'Concerned Citizen' }) {
  const [copied, setCopied] = useState(false);
  const [expandedTier, setExpandedTier] = useState(null);

  if (!application) return null;

  const evaluation = evaluateEscalationLadder(application);
  const { activeTier, tierStatus, ladder, overdueDays, status } = evaluation;

  const handleCopyPetition = async () => {
    try {
      const text = generateFirstAppealNotice(application, citizenName);
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // Fallback
    }
  };

  return (
    <div
      className="glass-panel"
      role="region"
      aria-label="Statutory Appellate Authority Hierarchy Ladder"
      style={{
        marginTop: '1.25rem',
        padding: '1.25rem',
        borderRadius: '0.875rem',
        border: '1px solid var(--border-light, #334155)',
        background: 'var(--bg-card, rgba(30, 41, 59, 0.7))',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              padding: '0.5rem',
              borderRadius: '0.5rem',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Scale size={20} aria-hidden="true" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              Statutory Redressal &amp; Appellate Hierarchy Ladder
            </h4>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Guaranteed under {evaluation.actName}
            </p>
          </div>
        </div>

        {/* Current status badge */}
        <div>
          {status === 'SLA_BREACHED' ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.3rem 0.65rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '700',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              <AlertTriangle size={13} aria-hidden="true" />
              Tier {activeTier} Active ({overdueDays}d Overdue)
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.3rem 0.65rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '600',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <ShieldCheck size={13} aria-hidden="true" />
              Tier 1 In Progress
            </span>
          )}
        </div>
      </div>

      {/* 3-Tier Ladder */}
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {ladder.map((tierItem) => {
          const isCurrent = tierItem.tier === activeTier;
          const isPassed = tierItem.tier < activeTier;
          const isFuture = tierItem.tier > activeTier;

          return (
            <div
              key={tierItem.tier}
              style={{
                padding: '0.85rem',
                borderRadius: '0.65rem',
                background: isCurrent
                  ? 'rgba(239, 68, 68, 0.08)'
                  : isPassed
                  ? 'rgba(15, 23, 42, 0.3)'
                  : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${
                  isCurrent ? 'rgba(239, 68, 68, 0.35)' : 'var(--border-light, #334155)'
                }`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: isCurrent ? '#ef4444' : isPassed ? '#10b981' : '#475569',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                    }}
                  >
                    {tierItem.tier}
                  </span>
                  <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {tierItem.title}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                    }}
                  >
                    Limit: {tierItem.windowDays} Days
                  </span>
                  {isCurrent && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        color: '#ef4444',
                      }}
                    >
                      ● Current Jurisdiction
                    </span>
                  )}
                </div>
              </div>

              <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', paddingLeft: '2rem' }}>
                <div>
                  <strong>Designated Authority:</strong> {tierItem.authority} ({tierItem.jurisdiction})
                </div>
                <div style={{ marginTop: '0.15rem' }}>
                  <strong>Legal Ground:</strong> {tierItem.legalBasis} | <strong>Filing Mode:</strong> {tierItem.appealMode}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actionable Appeal Generation */}
      {status === 'SLA_BREACHED' && (
        <div
          style={{
            marginTop: '1rem',
            paddingTop: '0.85rem',
            borderTop: '1px solid var(--border-light, #334155)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Statutory redressal penalty clause: <em>{evaluation.penaltyClause}</em>
          </div>

          <button
            type="button"
            onClick={handleCopyPetition}
            aria-label="Copy legal First Appeal petition"
            className="btn btn-secondary"
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'var(--glass-bg)',
            }}
          >
            {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            <span>{copied ? 'Petition Copied!' : 'Copy Appeal Petition Text'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

