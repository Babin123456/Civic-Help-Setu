import { ArrowLeftRight, Info } from 'lucide-react';
import {
  getCategoryMeta,
  getSourceMeta,
} from '../../services/applicationEventService';
import { safeHttpUrl } from '../../utils/safeContent';

const displayValue = (value) => {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

const SourceLine = ({ event, side }) => {
  const source = getSourceMeta(event.sourceType);
  return (
    <div className="event-diff-header">
      <p className="event-diff-side">{side}</p>
      <h4>{getCategoryMeta(event.category).label}</h4>
      <p>
        <strong>{source.label}</strong>
        {event.isPrivateGuidance ? ' — private guidance, not an official status' : null}
      </p>
      {safeHttpUrl(event.sourceUrl) ? (
        <p>
          <a href={safeHttpUrl(event.sourceUrl)} target="_blank" rel="noreferrer">
            Open recorded source
          </a>
        </p>
      ) : null}
      <dl>
        <div>
          <dt>Source timestamp</dt>
          <dd>{displayValue(event.sourceTimestamp)}</dd>
        </div>
        <div>
          <dt>Ingested at</dt>
          <dd>{displayValue(event.ingestedAt)}</dd>
        </div>
        <div>
          <dt>Event ID</dt>
          <dd><code>{event.eventId}</code></dd>
        </div>
        <div>
          <dt>Payload version</dt>
          <dd>{displayValue(event.payloadVersion)}</dd>
        </div>
      </dl>
    </div>
  );
};

export default function EventDiffViewer({ diff, onClose = null }) {
  if (!diff || !diff.left || !diff.right) {
    return (
      <div className="event-diff-viewer event-diff-empty" role="status">
        <Info size={20} aria-hidden="true" />
        <p>Select exactly two recorded events to compare their stored fields.</p>
      </div>
    );
  }

  return (
    <section className="event-diff-viewer" aria-labelledby="event-diff-title">
      <div className="event-diff-toolbar">
        <div>
          <p className="event-diff-eyebrow">Stored record comparison</p>
          <h3 id="event-diff-title">
            <ArrowLeftRight size={18} aria-hidden="true" /> Event difference viewer
          </h3>
          <p>
            {diff.changedCount} changed field{diff.changedCount === 1 ? '' : 's'}.
            Comparison uses only the stored records, not a recomputed official status.
          </p>
        </div>
        {onClose ? (
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close comparison
          </button>
        ) : null}
      </div>

      <div className="event-diff-columns">
        <SourceLine event={diff.left} side="Earlier event" />
        <SourceLine event={diff.right} side="Later event" />
      </div>

      <div className="event-diff-table-wrap">
        <table>
          <caption>Field-by-field comparison of two stored application events</caption>
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Earlier event</th>
              <th scope="col">Later event</th>
              <th scope="col">Changed</th>
            </tr>
          </thead>
          <tbody>
            {diff.fields.map((field) => (
              <tr key={field.field} className={field.changed ? 'is-changed' : ''}>
                <th scope="row">{field.field}</th>
                <td><pre>{displayValue(field.before)}</pre></td>
                <td><pre>{displayValue(field.after)}</pre></td>
                <td>{field.changed ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="event-diff-version">
        Data version used for this comparison: <code>{diff.dataVersion}</code>
      </p>
    </section>
  );
}
