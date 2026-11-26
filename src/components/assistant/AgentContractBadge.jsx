import { useState } from 'react';
import { ShieldCheck, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Accessible contract provenance & human-approval status indicator for Assistant responses.
 */
export default function AgentContractBadge({ contractMeta }) {
  const [expanded, setExpanded] = useState(false);

  if (!contractMeta) return null;

  const {
    correlationId,
    schemaVersion,
    hops = [],
    migratedCount = 0,
    requiresHumanApproval = false,
    degradedFromError = null,
    errorEnvelope = null,
  } = contractMeta;

  const isWarning = Boolean(requiresHumanApproval || degradedFromError || errorEnvelope);

  return (
    <div
      role="region"
      aria-label="Agent contract verification and provenance"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
        padding: '0.5rem 0.75rem',
        borderRadius: '0.5rem',
        background: isWarning ? 'rgba(245, 158, 11, 0.08)' : 'rgba(59, 130, 246, 0.08)',
        border: isWarning ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(59, 130, 246, 0.25)',
        fontSize: '0.78rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
          {isWarning ? (
            <AlertTriangle size={14} aria-hidden="true" style={{ color: '#fbbf24' }} />
          ) : (
            <ShieldCheck size={14} aria-hidden="true" style={{ color: '#60a5fa' }} />
          )}
          <span>
            Contract v{schemaVersion} • {hops.length} agent hop{hops.length === 1 ? '' : 's'}
            {requiresHumanApproval ? ' • Human review recommended' : ''}
          </span>
        </span>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide contract trace details' : 'Show contract trace details'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: '0.75rem',
            padding: '0.15rem 0.35rem',
            borderRadius: '0.25rem',
          }}
        >
          <span>{expanded ? 'Hide trace' : 'Trace'}</span>
          {expanded ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
        </button>
      </div>

      {requiresHumanApproval && (
        <p role="note" style={{ margin: 0, color: '#fbbf24', fontSize: '0.75rem' }}>
          Proposal requires human verification against official portal guidelines before taking action.
        </p>
      )}

      {expanded && (
        <div style={{ fontSize: '0.74rem', opacity: 0.9, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <div>Correlation ID: <code>{correlationId}</code></div>
          {migratedCount > 0 && <div>Schema migrations applied: {migratedCount}</div>}
          {degradedFromError && <div>Fallback activated ({degradedFromError})</div>}
          {errorEnvelope?.payload?.code && <div>Error code: <code>{errorEnvelope.payload.code}</code></div>}
          {hops.length > 0 && (
            <div>
              Hops: {hops.map((h) => `${h.agent}(${h.ok ? 'ok' : 'err'})`).join(' → ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
