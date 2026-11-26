import { AlertTriangle, History } from 'lucide-react';
import { MicroVolunteerEmptyState } from './MicroVolunteerStates.jsx';
import { formatDateTime } from './presentation.js';

export default function MicroVolunteerAuditPanel({ events, error }) {
  if (!events || events.items.length === 0) {
    return (
      <MicroVolunteerEmptyState
        title="No audit events yet"
        description="Claims, submissions, moderation decisions, suggestion decisions and retention runs are appended here with a reason."
      />
    );
  }

  return (
    <section aria-labelledby="mv-audit-heading">
      <h2 id="mv-audit-heading">
        <History size={20} aria-hidden="true" /> Append-only audit trail
      </h2>
      <p className="mv-muted">
        {events.pagination.total} event{events.pagination.total === 1 ? '' : 's'}. Account identifiers are
        replaced with a short contributor reference; private notes are visible only to reviewers and
        administrators.
      </p>
      {error && (
        <p className="mv-error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" /> {error}
        </p>
      )}
      <div className="mv-table-wrap">
        <table className="mv-table">
          <caption className="sr-only">Micro-volunteer audit events</caption>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Action</th>
              <th scope="col">Task</th>
              <th scope="col">Actor</th>
              <th scope="col">Reason</th>
            </tr>
          </thead>
          <tbody>
            {events.items.map((event) => (
              <tr key={event.eventRef}>
                <td>{formatDateTime(event.createdAt)}</td>
                <td>{event.action}</td>
                <td>{event.taskPublicRef || 'Board-wide'}</td>
                <td>
                  {event.actorRole} · {event.actorRef}
                </td>
                <td>{event.reason || 'No reason recorded'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
