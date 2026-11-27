import { useState } from 'react';
import { ShieldCheck, Lock, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  buildGovernedToolProposals,
  executeGovernedToolProposal,
} from '../../services/toolRegistry/clientToolRegistryAdapter';

/**
 * Accessible Assistant panel exposing capability-governed tool actions (#1146).
 * Medium/High-risk actions require explicit citizen confirmation and provenance
 * before a short-lived single-use capability is minted and executed.
 */
export default function GovernedToolActionsPanel({
  serviceId,
  title,
  officialSources = [],
  sessionId = 'assistant-session',
}) {
  const proposals = buildGovernedToolProposals({ serviceId, title, officialSources });
  const [expanded, setExpanded] = useState(false);
  const [confirmedMap, setConfirmedMap] = useState({});
  const [statusMap, setStatusMap] = useState({});
  const [busyId, setBusyId] = useState(null);

  if (proposals.length === 0) return null;

  const handleRunProposal = async (proposal) => {
    const citizenConfirmed = Boolean(confirmedMap[proposal.id]);
    setBusyId(proposal.id);
    try {
      const result = await executeGovernedToolProposal({
        proposal,
        sessionId,
        citizenConfirmed,
      });
      setStatusMap((prev) => ({
        ...prev,
        [proposal.id]: result.ok
          ? {
              ok: true,
              message: result.output?.advisoryNotice || `Completed (${result.riskTier} risk, single-use capability verified).`,
              jti: result.jti,
            }
          : {
              ok: false,
              message: result.error || 'Action blocked by governed tool policy.',
              code: result.code,
            },
      }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      aria-label="Governed Assistant Tool Actions"
      style={{
        marginTop: '0.5rem',
        padding: '0.75rem 0.9rem',
        borderRadius: '0.65rem',
        background: 'var(--glass-bg, rgba(15, 23, 42, 0.45))',
        border: '1px solid var(--border-light, #334155)',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          fontSize: '0.84rem',
          fontWeight: '700',
          cursor: 'pointer',
          padding: 0,
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
          <Lock size={14} aria-hidden="true" />
          Scoped Tool Actions ({proposals.length}) — Capability-Governed
        </span>
        {expanded ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
      </button>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Tools execute only with short-lived, single-use scoped capabilities. No official application is filed autonomously.
          </p>

          {proposals.map((proposal) => {
            const status = statusMap[proposal.id];
            const needsConfirm = proposal.requiresCitizenConfirmation;
            const isConfirmed = Boolean(confirmedMap[proposal.id]);

            return (
              <div
                key={proposal.id}
                style={{
                  padding: '0.65rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-card, rgba(30, 41, 59, 0.7))',
                  border: '1px solid var(--border-light, #334155)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.83rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {proposal.label}
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: '700',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '99px',
                      background: proposal.riskTier === 'LOW' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: proposal.riskTier === 'LOW' ? '#34d399' : '#fbbf24',
                    }}
                  >
                    Risk: {proposal.riskTier}
                  </span>
                </div>

                {needsConfirm && (
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isConfirmed}
                      onChange={(e) =>
                        setConfirmedMap((prev) => ({ ...prev, [proposal.id]: e.target.checked }))
                      }
                    />
                    <span>I confirm staging this non-binding preparation draft locally.</span>
                  </label>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    disabled={busyId === proposal.id || (needsConfirm && !isConfirmed)}
                    onClick={() => handleRunProposal(proposal)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                  >
                    <ShieldCheck size={14} aria-hidden="true" />{' '}
                    {busyId === proposal.id ? 'Verifying capability...' : 'Run with Scoped Capability'}
                  </button>
                </div>

                {status && (
                  <div
                    role="status"
                    aria-live="polite"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.78rem',
                      color: status.ok ? '#34d399' : '#f87171',
                    }}
                  >
                    {status.ok ? (
                      <CheckCircle2 size={14} aria-hidden="true" />
                    ) : (
                      <AlertTriangle size={14} aria-hidden="true" />
                    )}
                    <span>
                      {status.message}
                      {status.jti ? ` (cap: ${status.jti})` : ''}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
