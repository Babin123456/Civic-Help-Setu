import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';

/**
 * Accessible Prompt-Injection Firewall Inspection Panel (#1151)
 * Displays provenance, quarantine status, and human-approval requirements
 * for any retrieved external documents or web content.
 */
export default function FirewallInspectionPanel({ firewall }) {
  if (!firewall) return null;

  const isBlocked = firewall.decision === 'block';
  const isPartial = firewall.decision === 'partial_quarantine';
  const counts = firewall.counts || { clean: 0, suspicious: 0, quarantined: 0, total: 0 };

  const statusLabel = isBlocked
    ? 'Untrusted Document Quarantined'
    : isPartial
      ? 'Partial Quarantine Applied'
      : 'Untrusted Evidence Isolated';

  const Icon = isBlocked ? ShieldAlert : isPartial ? AlertTriangle : ShieldCheck;
  const roleAttr = isBlocked ? 'alert' : 'status';

  return (
    <section
      role={roleAttr}
      aria-live="polite"
      aria-label="Prompt-Injection Firewall Inspection"
      style={{
        padding: '0.75rem 0.9rem',
        borderRadius: '0.6rem',
        border: isBlocked
          ? '1px solid rgba(239, 68, 68, 0.45)'
          : isPartial
            ? '1px solid rgba(245, 158, 11, 0.45)'
            : '1px solid rgba(16, 185, 129, 0.35)',
        background: isBlocked
          ? 'rgba(239, 68, 68, 0.08)'
          : isPartial
            ? 'rgba(245, 158, 11, 0.08)'
            : 'rgba(16, 185, 129, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
        fontSize: '0.84rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
        <Icon size={16} aria-hidden="true" />
        <span>Firewall ({firewall.contractVersion || '1.0.0'}): {statusLabel}</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', opacity: 0.9 }}>
        <span>Clean passages: {counts.clean}</span>
        <span>Quarantined: {counts.quarantined}</span>
        {counts.suspicious > 0 && <span>Suspicious: {counts.suspicious}</span>}
        {firewall.sourceType && <span>Source tier: {firewall.sourceType}</span>}
      </div>

      {Array.isArray(firewall.threatClasses) && firewall.threatClasses.length > 0 && (
        <div>
          <strong>Detected threat classes:</strong> {firewall.threatClasses.join(', ')}
        </div>
      )}

      {firewall.proposalCheck?.requiresHumanApproval && (
        <div role="note" style={{ fontWeight: 500 }}>
          Human review required before acting on any external or high-impact proposal.
        </div>
      )}
    </section>
  );
}
