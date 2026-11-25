import { History, ShieldCheck } from 'lucide-react';
import { GhgEmptyState, GhgStatusBadge } from './GhgInventoryStates.jsx';

const formatDate = (value) => (value ? new Date(value).toLocaleString() : '—');

export default function GhgAuditPanel({ events = [], total = 0 }) {
  if (!events.length) {
    return (
      <GhgEmptyState
        title="No audit events yet"
        message="Sensitive actions such as approvals, factor publications and estimate decisions are written to an append-only audit trail."
      />
    );
  }

  return (
    <section aria-labelledby="ghg-audit-heading" style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <h2 id="ghg-audit-heading" style={{ margin: 0, fontSize: '1.15rem' }}>
          <History size={18} aria-hidden="true" /> Audit trail
        </h2>
        <p style={{ margin: '0.3rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Showing the {events.length} most recent of {total} recorded event(s). Entries are
          append-only and include the acting role, the decision reason and the affected entity.
        </p>
      </div>

      <div
        role="note"
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'flex-start',
          padding: '0.7rem 0.9rem',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-main)',
          borderRadius: '0.55rem',
          fontSize: '0.8rem',
        }}
      >
        <ShieldCheck size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        Reviewer and administrator roles only. Operators cannot read the audit trail.
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <caption style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.78rem', paddingBottom: '0.4rem' }}>
            Append-only inventory audit events, newest first.
          </caption>
          <thead>
            <tr>
              {['When', 'Action', 'Entity', 'Actor role', 'Reason', 'Details'].map((heading) => (
                <th key={heading} scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)', whiteSpace: 'nowrap' }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                  {formatDate(event.timestamp)}
                </td>
                <th scope="row" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-light)', fontWeight: 700 }}>
                  {event.action}
                </th>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                  {event.entityType}
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                    {event.entityId}
                  </span>
                </td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                  <GhgStatusBadge label={event.actorRole} tone={event.actorRole === 'admin' ? 'info' : 'neutral'} />
                </td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)', minWidth: '200px' }}>
                  {event.reason || '—'}
                </td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)', minWidth: '180px' }}>
                  <details>
                    <summary style={{ cursor: 'pointer', fontSize: '0.76rem' }}>View details</summary>
                    <pre style={{ margin: '0.4rem 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.72rem' }}>
                      {JSON.stringify(event.details || {}, null, 2)}
                    </pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
