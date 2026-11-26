import { ShieldCheck, CheckCircle2, AlertOctagon } from 'lucide-react';

export default function CleanRoomAuditLogModal({ auditLogs = [] }) {
  return (
    <div
      className="card"
      style={{
        padding: '1.25rem',
        borderRadius: '0.75rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={18} color="#10b981" />
          Tamper-Evident Clean Room Audit Trail ({auditLogs.length} Events)
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Immutable SHA-256 Digest Verification
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '0.5rem 0.6rem' }}>TIMESTAMP</th>
              <th style={{ padding: '0.5rem 0.6rem' }}>WORKSPACE</th>
              <th style={{ padding: '0.5rem 0.6rem' }}>ACTION</th>
              <th style={{ padding: '0.5rem 0.6rem' }}>STATUS</th>
              <th style={{ padding: '0.5rem 0.6rem' }}>EPSILON (ε)</th>
              <th style={{ padding: '0.5rem 0.6rem' }}>DIGEST</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log) => {
              const isBlocked = log.action.startsWith('QUERY_BLOCKED');
              const isSuccess = log.status === 'SUCCESS';

              return (
                <tr key={log.auditId} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '0.5rem 0.6rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '0.5rem 0.6rem', fontWeight: 500 }}>
                    {log.partnerName || log.workspaceId}
                  </td>
                  <td style={{ padding: '0.5rem 0.6rem' }}>
                    <code style={{ fontSize: '0.75rem', color: isBlocked ? '#ef4444' : 'var(--text-primary)' }}>
                      {log.action}
                    </code>
                  </td>
                  <td style={{ padding: '0.5rem 0.6rem' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: isBlocked ? '#ef4444' : isSuccess ? '#10b981' : '#f59e0b',
                      }}
                    >
                      {isBlocked ? <AlertOctagon size={12} /> : <CheckCircle2 size={12} />}
                      {log.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem 0.6rem', fontFamily: 'monospace' }}>
                    {log.epsilonCost > 0 ? `-${log.epsilonCost.toFixed(2)}` : '0.00'}
                  </td>
                  <td style={{ padding: '0.5rem 0.6rem' }}>
                    <code style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {log.resultDigest || log.parameterDigest || '—'}
                    </code>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
