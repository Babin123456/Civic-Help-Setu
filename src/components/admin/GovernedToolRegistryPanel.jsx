import { useState } from 'react';
import { Shield, Lock, Ban, RotateCcw, RefreshCw, Activity, CheckCircle2 } from 'lucide-react';
import { getLocalSandboxToolRegistry } from '../../services/toolRegistry/clientToolRegistryAdapter';

/**
 * Accessible Admin Governance Console for the Agent Tool Registry (#1146).
 * Allows admins to inspect tool JSON schemas, risk tiers, scopes, sanitized
 * invocation logs, and revoke/restore tools, capabilities, or user tokens.
 */
export default function GovernedToolRegistryPanel({ registry = getLocalSandboxToolRegistry() }) {
  const [tools, setTools] = useState(() => registry.listTools({ includeSchemas: true }));
  const [metrics, setMetrics] = useState(() => registry.getMetrics());
  const [events, setEvents] = useState(() => registry.getAuditEvents({ limit: 25 }));
  const [revocations, setRevocations] = useState(() => registry.getRevocationSnapshot());
  const [selectedToolSchema, setSelectedToolSchema] = useState(null);
  const [targetType, setTargetType] = useState('capability');
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('Manual security review revocation');
  const [notice, setNotice] = useState('');

  const refreshState = () => {
    setTools(registry.listTools({ includeSchemas: true }));
    setMetrics(registry.getMetrics());
    setEvents(registry.getAuditEvents({ limit: 25 }));
    setRevocations(registry.getRevocationSnapshot());
  };

  const handleToggleToolRevocation = (tool) => {
    if (tool.revoked) {
      registry.restoreTool(tool.name, { actorId: 'admin-console', reason: 'Admin verified tool health' });
      setNotice(`Restored tool "${tool.name}".`);
    } else {
      registry.revokeTool(tool.name, { actorId: 'admin-console', reason: 'Emergency admin revocation' });
      setNotice(`Revoked tool "${tool.name}". All pending capabilities for this tool are blocked.`);
    }
    refreshState();
  };

  const handleManualRevoke = (e) => {
    e.preventDefault();
    const trimmed = targetId.trim();
    if (!trimmed) {
      setNotice('Please provide a capability ID (jti) or user ID to revoke.');
      return;
    }
    if (targetType === 'capability') {
      registry.revokeCapability(trimmed, { actorId: 'admin-console', reason: reason.trim() });
      setNotice(`Capability "${trimmed}" revoked.`);
    } else {
      registry.revokeUser(trimmed, { actorId: 'admin-console', reason: reason.trim() });
      setNotice(`All capabilities for user "${trimmed}" revoked.`);
    }
    setTargetId('');
    refreshState();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={20} aria-hidden="true" />
            Governed Agent Tool Registry &amp; Capability Controls
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
            Default-deny tool catalog, JSON Schema enforcement, short-lived capability tokens, and PII-free invocation telemetry.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshState}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
        >
          <RefreshCw size={14} aria-hidden="true" />
          Refresh Registry
        </button>
      </div>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            background: 'rgba(16, 185, 129, 0.14)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#10b981',
            fontSize: '0.85rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}

      {/* Security Metrics Summary */}
      <section aria-label="Tool Registry Security Metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Capabilities Issued', value: metrics.issuedCapabilities },
          { label: 'Allowed Invocations', value: metrics.allowedInvocations },
          { label: 'Denied Invocations', value: metrics.deniedInvocations },
          { label: 'Replays Blocked', value: metrics.replayBlocked },
          { label: 'Cross-User Blocked', value: metrics.crossUserBlocked },
          { label: 'Schema Rejected', value: metrics.schemaRejected },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '0.65rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>{stat.label}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '0.25rem' }}>{stat.value}</div>
          </div>
        ))}
      </section>

      {/* Registered Tools Catalog */}
      <section
        aria-labelledby="registered-tools-heading"
        style={{
          padding: '1.25rem',
          borderRadius: '0.75rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.9rem',
        }}
      >
        <h3 id="registered-tools-heading" style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Shield size={16} aria-hidden="true" /> Registered Tool Contracts ({tools.length})
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                <th scope="col" style={{ padding: '0.5rem' }}>Tool</th>
                <th scope="col" style={{ padding: '0.5rem' }}>Risk</th>
                <th scope="col" style={{ padding: '0.5rem' }}>Scopes</th>
                <th scope="col" style={{ padding: '0.5rem' }}>Approval Gate</th>
                <th scope="col" style={{ padding: '0.5rem' }}>Status</th>
                <th scope="col" style={{ padding: '0.5rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => (
                <tr key={tool.name} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '0.6rem 0.5rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {tool.name}
                    <div style={{ fontSize: '0.74rem', fontWeight: '400', color: 'var(--text-secondary)' }}>v{tool.version} · {tool.owner}</div>
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>{tool.riskTier}</td>
                  <td style={{ padding: '0.6rem 0.5rem', fontFamily: 'monospace', fontSize: '0.76rem' }}>{tool.scopes.join(', ')}</td>
                  <td style={{ padding: '0.6rem 0.5rem', fontSize: '0.78rem' }}>{tool.approvalRequirement}</td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>
                    <span style={{ fontWeight: '700', color: tool.revoked ? '#ef4444' : '#10b981' }}>
                      {tool.revoked ? 'REVOKED' : 'ACTIVE'}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                      onClick={() => setSelectedToolSchema(selectedToolSchema?.name === tool.name ? null : tool)}
                    >
                      {selectedToolSchema?.name === tool.name ? 'Hide Schema' : 'Inspect Schema'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: tool.revoked ? '#10b981' : '#ef4444' }}
                      onClick={() => handleToggleToolRevocation(tool)}
                    >
                      {tool.revoked ? <RotateCcw size={13} aria-hidden="true" /> : <Ban size={13} aria-hidden="true" />}{' '}
                      {tool.revoked ? 'Restore Tool' : 'Revoke Tool'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedToolSchema && (
          <div
            role="region"
            aria-label={`JSON Schema for ${selectedToolSchema.name}`}
            style={{
              padding: '0.85rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-main, #0f172a)',
              border: '1px solid var(--border-light)',
            }}
          >
            <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
              JSON Schema — {selectedToolSchema.name}
            </strong>
            <pre style={{ margin: '0.5rem 0 0', fontSize: '0.76rem', overflowX: 'auto', color: 'var(--text-secondary)' }}>
              {JSON.stringify(selectedToolSchema.inputSchema, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* Capability / User Revocation Form */}
      <section
        aria-labelledby="capability-revoke-heading"
        style={{
          padding: '1.25rem',
          borderRadius: '0.75rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
        }}
      >
        <h3 id="capability-revoke-heading" style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
          Emergency Capability / User Revocation
        </h3>
        <form onSubmit={handleManualRevoke} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78rem' }}>
            <span>Target Type</span>
            <select
              aria-label="Revocation target type"
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              style={{ padding: '0.45rem 0.65rem', borderRadius: '0.4rem', border: '1px solid var(--border-light)' }}
            >
              <option value="capability">Capability ID (jti)</option>
              <option value="user">User ID (sub)</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78rem', flex: '1 1 200px' }}>
            <span>Identifier</span>
            <input
              type="text"
              aria-label="Revocation target identifier"
              placeholder={targetType === 'capability' ? 'cap_...' : 'user_...'}
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              style={{ padding: '0.45rem 0.65rem', borderRadius: '0.4rem', border: '1px solid var(--border-light)' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78rem', flex: '1 1 220px' }}>
            <span>Reason</span>
            <input
              type="text"
              aria-label="Revocation reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ padding: '0.45rem 0.65rem', borderRadius: '0.4rem', border: '1px solid var(--border-light)' }}
            />
          </label>
          <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 0.9rem', fontSize: '0.82rem' }}>
            Revoke Access
          </button>
        </form>
        <p style={{ margin: '0.65rem 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
          Active revocations: {revocations.revokedTools.length} tool(s), {revocations.revokedUsers.length} user(s), {revocations.revokedCapabilities.length} capability token(s).
        </p>
      </section>

      {/* Sanitized Audit Trail */}
      <section
        aria-labelledby="tool-audit-heading"
        style={{
          padding: '1.25rem',
          borderRadius: '0.75rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
        }}
      >
        <h3 id="tool-audit-heading" style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Activity size={16} aria-hidden="true" /> Sanitized Tool Invocation Audit Log ({events.length})
        </h3>
        {events.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            No tool invocations recorded in this session yet. Argument values and PII are never stored.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {events.map((evt) => (
              <li
                key={evt.eventId}
                style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0.45rem',
                  background: 'var(--bg-main, rgba(15, 23, 42, 0.35))',
                  border: '1px solid var(--border-light)',
                  fontSize: '0.78rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  <strong>{evt.toolName}</strong> · {evt.decision}
                  {evt.errorCode ? ` (${evt.errorCode})` : ''} · keys: [{evt.argKeys.join(', ')}]
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {evt.latencyMs}ms · {evt.timestamp}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
