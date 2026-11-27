import { useState } from 'react';
import { Shield, HardDrive, Globe, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { RESIDENCY_TIER, ADAPTER_TYPE } from '../../services/gateway/gatewayTypes';

/**
 * ModelGatewayBadge
 * Displays transparent, accessible status of data residency and model gateway routing.
 *
 * @param {Object} props
 * @param {Object} props.meta - Gateway metadata envelope
 */
export default function ModelGatewayBadge({ meta }) {
  const [expanded, setExpanded] = useState(false);

  if (!meta) return null;

  const {
    residencyTier = RESIDENCY_TIER.LOCAL_ONLY,
    adapterType = ADAPTER_TYPE.LOCAL_BROWSER,
    modelName = 'Local Catalog Engine',
    fallbackTriggered = false,
    fallbackReason = null,
    latencyMs = 0,
    tokenUsage = { totalTokens: 0 },
    estimatedCostINR = 0,
  } = meta;

  let tierLabel = 'Local In-Browser (Zero Data Egress)';
  let TierIcon = HardDrive;
  let tierBg = 'rgba(16, 185, 129, 0.12)';
  let tierBorder = 'rgba(16, 185, 129, 0.35)';
  let tierColor = '#10b981';

  if (fallbackTriggered) {
    tierLabel = 'Deterministic Fallback Active';
    TierIcon = AlertTriangle;
    tierBg = 'rgba(245, 158, 11, 0.12)';
    tierBorder = 'rgba(245, 158, 11, 0.35)';
    tierColor = '#f59e0b';
  } else if (residencyTier === RESIDENCY_TIER.SOVEREIGN_DOMESTIC) {
    tierLabel = 'Sovereign Domestic Region (India Cloud)';
    TierIcon = Shield;
    tierBg = 'rgba(59, 130, 246, 0.12)';
    tierBorder = 'rgba(59, 130, 246, 0.35)';
    tierColor = '#3b82f6';
  } else if (residencyTier === RESIDENCY_TIER.CROSS_BORDER_SCRUBBED) {
    tierLabel = 'External Model (Scrubbed PII)';
    TierIcon = Globe;
    tierBg = 'rgba(139, 92, 246, 0.12)';
    tierBorder = 'rgba(139, 92, 246, 0.35)';
    tierColor = '#8b5cf6';
  }

  return (
    <div
      role="status"
      aria-label={`Model Gateway Residency: ${tierLabel}`}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: '0.35rem',
        alignSelf: 'flex-start',
        maxWidth: '100%',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.35rem 0.65rem',
          borderRadius: '0.5rem',
          background: tierBg,
          border: `1px solid ${tierBorder}`,
          color: tierColor,
          fontSize: '0.78rem',
          fontWeight: '600',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <TierIcon size={14} aria-hidden="true" />
        <span>{tierLabel}</span>
        <span style={{ opacity: 0.75, fontSize: '0.72rem', marginLeft: '0.2rem' }}>
          ({latencyMs}ms)
        </span>
        {expanded ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
      </button>

      {expanded && (
        <div
          style={{
            padding: '0.65rem 0.85rem',
            borderRadius: '0.5rem',
            background: 'var(--bg-card, #1e293b)',
            border: '1px solid var(--border-light, #334155)',
            fontSize: '0.76rem',
            color: 'var(--text-secondary, #94a3b8)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          }}
        >
          <div>
            <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>Model: </strong>
            <span>{modelName}</span>
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>Adapter: </strong>
            <span>{adapterType}</span>
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>Tokens: </strong>
            <span>{tokenUsage.totalTokens || 0}</span>
            <span style={{ marginLeft: '0.5rem' }}>
              <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>Est. Cost: </strong>
              ₹{estimatedCostINR}
            </span>
          </div>
          {fallbackTriggered && fallbackReason && (
            <div style={{ color: '#f59e0b', marginTop: '0.2rem' }}>
              <strong>Fallback Reason: </strong>
              <span>{fallbackReason}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
