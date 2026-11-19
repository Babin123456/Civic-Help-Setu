import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  GitCompareArrows,
  Printer,
  Send,
  ShieldCheck,
  StickyNote,
  Table2,
} from 'lucide-react';
import {
  CATEGORY_META,
  EVENT_SOURCE,
  TIMELINE_STATE,
  createEventDiff,
  getApplicationTimeline,
  getCategoryMeta,
  getSourceMeta,
  reportTimelineInconsistency,
} from '../../services/applicationEventService';
import { summarizeApplicationEvents } from '../../services/timelineSummaryService';
import EventDiffViewer from './EventDiffViewer';
import TimelineReplayState from './TimelineReplayStates';
import { filterTimelineEvents, toggleSelectedEvent } from './timelineReplayModel';
import { safeHttpUrl } from '../../utils/safeContent';
import './ApplicationTimelineReplay.css';

const statusTransitionText = (event) => {
  if (event.sourceType === EVENT_SOURCE.CITIZEN_NOTE) {
    return 'No official status change — private citizen note';
  }
  if (event.statusTransition) {
    const from = event.statusTransition.from ?? 'none';
    const to = event.statusTransition.to ?? 'none';
    return `${from} → ${to}`;
  }
  return event.status === null || event.status === undefined
    ? 'No status recorded'
    : `Recorded status: ${event.status}`;
};

const eventHeadline = (event) =>
  event.payload?.title ||
  (event.sourceType === EVENT_SOURCE.CITIZEN_NOTE
    ? 'Citizen note'
    : getCategoryMeta(event.category).label);

const eventBody = (event) =>
  event.payload?.description ||
  event.payload?.text ||
  'No event description was recorded for this entry.';

const getEventAnomalies = (anomalies = [], eventId) =>
  anomalies.filter((anomaly) => anomaly.eventIds.includes(eventId));

const SourceBadge = ({ event }) => {
  const meta = getSourceMeta(event.sourceType);
  return (
    <span
      className={`timeline-source-badge ${
        meta.official ? 'is-official' : 'is-unofficial'
      } ${event.isPrivateGuidance ? 'is-citizen' : ''}`}
    >
      {event.isPrivateGuidance ? (
        <StickyNote size={13} aria-hidden="true" />
      ) : meta.official ? (
        <ShieldCheck size={13} aria-hidden="true" />
      ) : (
        <AlertTriangle size={13} aria-hidden="true" />
      )}
      {meta.label}
    </span>
  );
};

const categoryCounts = (events) => {
  const counts = {};
  for (const event of events) {
    counts[event.category] = (counts[event.category] || 0) + 1;
  }
  return counts;
};

export default function ApplicationTimelineReplay({
  application = null,
  timeline: suppliedTimeline = null,
  state = null,
  errorMessage = '',
  isStale = false,
  permissionDenied = false,
  officialSourceUrl = '',
  onRetry = null,
  onReportInconsistency = null,
}) {
  const resolved = useMemo(() => {
    if (suppliedTimeline) return suppliedTimeline;
    if (application) return getApplicationTimeline(application);
    return {
      applicationId: '',
      events: [],
      anomalies: [],
      dataVersion: '',
      state: TIMELINE_STATE.EMPTY,
    };
  }, [application, suppliedTimeline]);

  const events = useMemo(
    () => (Array.isArray(resolved.events) ? resolved.events : []),
    [resolved]
  );
  const anomalies = useMemo(
    () => (Array.isArray(resolved.anomalies) ? resolved.anomalies : []),
    [resolved]
  );
  const applicationId = useMemo(
    () => resolved.applicationId || application?.id || 'this application',
    [resolved, application]
  );

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [diff, setDiff] = useState(null);
  const [diffError, setDiffError] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportMessage, setReportMessage] = useState('');

  const visibleEvents = useMemo(
    () =>
      filterTimelineEvents(events, {
        category: categoryFilter,
        source: sourceFilter,
      }),
    [events, categoryFilter, sourceFilter]
  );

  const summary = useMemo(
    () => summarizeApplicationEvents(applicationId, events),
    [applicationId, events]
  );

  const counts = useMemo(() => categoryCounts(events), [events]);
  const effectiveState = permissionDenied
    ? TIMELINE_STATE.PERMISSION_DENIED
    : state || resolved.state || (events.length === 0 ? TIMELINE_STATE.EMPTY : TIMELINE_STATE.READY);

  const toggleSelection = (eventId) => {
    setDiffError('');
    setSelectedIds((current) => toggleSelectedEvent(current, eventId));
  };

  const handleCompare = () => {
    if (selectedIds.length !== 2) {
      setDiffError('Select exactly two recorded events to compare.');
      return;
    }
    try {
      const storedDiff = createEventDiff(events, selectedIds[0], selectedIds[1]);
      setDiff(storedDiff);
      setDiffError('');
    } catch (error) {
      setDiff(null);
      setDiffError(error.message);
    }
  };

  const handleReport = (submitEvent) => {
    submitEvent.preventDefault();
    setReportMessage('');
    try {
      const report = reportTimelineInconsistency({
        applicationId,
        eventIds: selectedIds,
        reason: reportReason,
      });
      setReportMessage(
        `Report ${report.reportId} saved for reviewer triage. No timeline event was changed.`
      );
      setReportReason('');
      onReportInconsistency?.(report);
    } catch (error) {
      setReportMessage(
        Array.isArray(error.details) ? error.details.join(' ') : error.message
      );
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print?.();
  };

  if (
    effectiveState === TIMELINE_STATE.LOADING ||
    effectiveState === TIMELINE_STATE.ERROR ||
    effectiveState === TIMELINE_STATE.PERMISSION_DENIED
  ) {
    return (
      <section className="timeline-replay" aria-labelledby="timeline-replay-title">
        <header className="timeline-replay-header">
          <div>
            <p className="timeline-replay-eyebrow">Event replay</p>
            <h2 id="timeline-replay-title">Application timeline replay</h2>
          </div>
        </header>
        <TimelineReplayState
          state={effectiveState}
          message={errorMessage || undefined}
          onRetry={onRetry}
        />
      </section>
    );
  }

  if (events.length === 0) {
    return (
      <section className="timeline-replay" aria-labelledby="timeline-replay-title">
        <header className="timeline-replay-header">
          <div>
            <p className="timeline-replay-eyebrow">Event replay</p>
            <h2 id="timeline-replay-title">Application timeline replay</h2>
          </div>
        </header>
        <TimelineReplayState state={TIMELINE_STATE.EMPTY} onRetry={onRetry} />
      </section>
    );
  }

  return (
    <section className="timeline-replay" aria-labelledby="timeline-replay-title">
      <header className="timeline-replay-header">
        <div>
          <p className="timeline-replay-eyebrow">Event replay</p>
          <h2 id="timeline-replay-title">Application timeline replay</h2>
          <p>
            Recorded events appear in source-timestamp order. Citizen notes are
            private guidance and never appear as an official government status.
          </p>
        </div>
        <div className="timeline-replay-header-actions">
          <span className="timeline-version" title="Deterministic data version for these records">
            Data version <code>{resolved.dataVersion || summary.dataVersion}</code>
          </span>
          <button type="button" className="btn btn-secondary" onClick={handlePrint}>
            <Printer size={15} aria-hidden="true" /> Print view
          </button>
        </div>
      </header>

      {isStale ? (
        <TimelineReplayState
          state={TIMELINE_STATE.STALE}
          onRetry={onRetry}
          actionLabel="Reload timeline"
        />
      ) : null}

      <div className="timeline-summary-panel">
        <div>
          <p className="timeline-summary-label">
            <CheckCircle2 size={14} aria-hidden="true" /> {summary.label}
          </p>
          <p>{summary.summary}</p>
          <p className="timeline-summary-version">
            Source references and data version:{' '}
            <code>{summary.dataVersion}</code>
          </p>
        </div>
        <ul className="timeline-citations" aria-label="Event citations used by the summary">
          {summary.citations.map((citation) => {
            const reference = summary.sourceReferences.find(
              (item) => item.eventId === citation.eventId
            );
            return (
              <li key={citation.eventId}>
                <code>{citation.eventId}</code>
                <span>{citation.sourceTimestamp}</span>
                {reference ? (
                  <span>
                    {getSourceMeta(reference.sourceType).label}
                    {reference.sourceRef ? ` — ${reference.sourceRef}` : ''}
                  </span>
                ) : null}
                {safeHttpUrl(reference?.sourceUrl) ? (
                  <a
                    href={safeHttpUrl(reference?.sourceUrl)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {reference.isOfficial ? 'Open official source' : 'Open recorded source'}
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
        {summary.requiresReview ? (
          <p className="timeline-review-note" role="alert">
            <AlertTriangle size={15} aria-hidden="true" />
            {summary.reviewReason} This summary is a suggestion awaiting citizen
            or authorised reviewer confirmation.
          </p>
        ) : null}
      </div>

      {anomalies.length > 0 ? (
        <div className="timeline-anomaly-panel" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>{anomalies.length} timeline inconsistency record(s) need review.</strong>
            <p>
              Duplicate, out-of-order, or conflicting official evidence is shown
              below and is never overwritten automatically.
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsReporting(true)}
            >
              Report an inconsistency
            </button>
          </div>
        </div>
      ) : null}

      <ul className="timeline-category-summary" aria-label="Event counts by category">
        {Object.entries(CATEGORY_META)
          .sort((left, right) => left[1].order - right[1].order)
          .map(([category, meta]) => (
            <li key={category}>
              {meta.label} <strong>{counts[category] || 0}</strong>
            </li>
          ))}
      </ul>

      <div className="timeline-replay-controls">
        <div className="timeline-filter">
          <label htmlFor="timeline-category-filter">Filter by category</label>
          <select
            id="timeline-category-filter"
            value={categoryFilter}
            onChange={(changeEvent) => setCategoryFilter(changeEvent.target.value)}
          >
            <option value="all">All categories</option>
            {Object.entries(CATEGORY_META).map(([category, meta]) => (
              <option key={category} value={category}>
                {meta.label}
              </option>
            ))}
          </select>
        </div>
        <div className="timeline-filter">
          <label htmlFor="timeline-source-filter">Filter by source</label>
          <select
            id="timeline-source-filter"
            value={sourceFilter}
            onChange={(changeEvent) => setSourceFilter(changeEvent.target.value)}
          >
            <option value="all">All sources</option>
            <option value={EVENT_SOURCE.OFFICIAL_PORTAL}>Official portal</option>
            <option value={EVENT_SOURCE.OFFICIAL_OFFICE}>Official office</option>
            <option value={EVENT_SOURCE.SYSTEM}>Tracked application record</option>
            <option value={EVENT_SOURCE.CITIZEN_NOTE}>Citizen notes</option>
          </select>
        </div>
        <div className="timeline-compare-controls">
          <p role="status" aria-live="polite">
            {selectedIds.length} of 2 events selected for comparison.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCompare}
            disabled={selectedIds.length !== 2}
          >
            <GitCompareArrows size={15} aria-hidden="true" /> Compare events
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsReporting((value) => !value)}
          >
            Report inconsistency
          </button>
        </div>
      </div>

      {diffError ? <p className="timeline-inline-error" role="alert">{diffError}</p> : null}

      {diff ? <EventDiffViewer diff={diff} onClose={() => setDiff(null)} /> : null}

      {isReporting ? (
        <form className="timeline-report-form" onSubmit={handleReport}>
          <label htmlFor="timeline-report-reason">
            Describe the inconsistency you found
          </label>
          <p id="timeline-report-help">
            Select at least one event above. Reports are saved for reviewer triage
            and never modify the recorded timeline.
          </p>
          <textarea
            id="timeline-report-reason"
            value={reportReason}
            onChange={(changeEvent) => setReportReason(changeEvent.target.value)}
            rows={3}
            aria-describedby="timeline-report-help"
          />
          <div className="timeline-report-actions">
            <button type="submit" className="btn btn-primary">
              <Send size={15} aria-hidden="true" /> Send for review
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsReporting(false)}
            >
              Cancel and resume later
            </button>
          </div>
          {reportMessage ? (
            <p role="status" className="timeline-report-message">
              {reportMessage}
            </p>
          ) : null}
        </form>
      ) : null}

      {visibleEvents.length === 0 ? (
        <p className="timeline-filter-empty" role="status">
          No recorded events match these filters. Choose another category or source.
        </p>
      ) : (
        <>
          <ol className="timeline-mobile-stepper" aria-label="Timeline steps for small screens">
            {visibleEvents.map((event, index) => (
              <li key={`stepper-${event.eventId}`}>
                <span>{index + 1}</span>
                <strong>{getCategoryMeta(event.category).label}</strong>
                <small>{event.sourceTimestamp}</small>
              </li>
            ))}
          </ol>

          <ol className="timeline-replay-list" aria-label="Recorded application events">
            {visibleEvents.map((event, index) => {
              const eventAnomalies = getEventAnomalies(anomalies, event.eventId);
              const isCitizenNote = event.sourceType === EVENT_SOURCE.CITIZEN_NOTE;
              const isSelected = selectedIds.includes(event.eventId);
              return (
                <li
                  key={event.eventId}
                  className={`timeline-replay-item ${isCitizenNote ? 'is-citizen-note' : ''}`}
                >
                  <div className="timeline-replay-marker" aria-hidden="true">
                    {index + 1}
                  </div>
                  <article className="timeline-replay-card">
                    <div className="timeline-card-badges">
                      <span className="timeline-category-badge">
                        {getCategoryMeta(event.category).label}
                      </span>
                      <SourceBadge event={event} />
                      {eventAnomalies.length > 0 ? (
                        <span className="timeline-anomaly-badge">
                          <AlertTriangle size={12} aria-hidden="true" /> Needs review
                        </span>
                      ) : null}
                    </div>

                    <h3>{eventHeadline(event)}</h3>
                    <p className="timeline-event-body">{eventBody(event)}</p>

                    {isCitizenNote ? (
                      <p className="timeline-private-note">
                        Private guidance only. This note is not an official
                        government status or decision.
                      </p>
                    ) : null}

                    <dl className="timeline-event-meta">
                      <div>
                        <dt>Source timestamp</dt>
                        <dd>{event.sourceTimestamp}</dd>
                      </div>
                      <div>
                        <dt>Ingested at</dt>
                        <dd>{event.ingestedAt}</dd>
                      </div>
                      <div>
                        <dt>Status transition</dt>
                        <dd>{statusTransitionText(event)}</dd>
                      </div>
                      {safeHttpUrl(event.sourceUrl) ? (
                        <div>
                          <dt>{event.isOfficial ? 'Official source' : 'Recorded source'}</dt>
                          <dd>
                            <a
                              href={safeHttpUrl(event.sourceUrl)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open recorded source
                            </a>
                          </dd>
                        </div>
                      ) : null}
                      <div>
                        <dt>Actor role</dt>
                        <dd>{event.actorRole}</dd>
                      </div>
                      <div>
                        <dt>Event ID</dt>
                        <dd><code>{event.eventId}</code></dd>
                      </div>
                      <div>
                        <dt>Payload version</dt>
                        <dd>{event.payloadVersion}</dd>
                      </div>
                    </dl>

                    <label className="timeline-select-event">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(event.eventId)}
                      />
                      Select event <code>{event.eventId}</code> for comparison
                    </label>

                    {eventAnomalies.length > 0 ? (
                      <ul className="timeline-event-anomalies">
                        {eventAnomalies.map((anomaly, anomalyIndex) => (
                          <li key={`${anomaly.type}-${anomalyIndex}`}>
                            {anomaly.message}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <details className="timeline-table-alternative">
        <summary>
          <Table2 size={16} aria-hidden="true" /> Read the timeline as a table
          (accessible alternative)
        </summary>
        <div className="timeline-table-wrap">
          <table>
            <caption>Recorded application events in chronological order</caption>
            <thead>
              <tr>
                <th scope="col">Source timestamp</th>
                <th scope="col">Category</th>
                <th scope="col">Source</th>
                <th scope="col">Status</th>
                <th scope="col">Event ID</th>
              </tr>
            </thead>
            <tbody>
              {visibleEvents.map((event) => (
                <tr key={`table-${event.eventId}`}>
                  <th scope="row">{event.sourceTimestamp}</th>
                  <td>{getCategoryMeta(event.category).label}</td>
                  <td>{getSourceMeta(event.sourceType).label}</td>
                  <td>{event.status ?? 'Not recorded'}</td>
                  <td><code>{event.eventId}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <footer className="timeline-replay-footer">
        <p>
          Information is illustrative and based on recorded events only. Verify
          official status with the issuing government department.
          {safeHttpUrl(officialSourceUrl) ? (
            <>
              {' '}
              <a
                href={safeHttpUrl(officialSourceUrl)}
                target="_blank"
                rel="noreferrer"
              >
                Open the official service source
              </a>
              .
            </>
          ) : null}
        </p>
        <p>
          Data version: <code>{resolved.dataVersion || summary.dataVersion}</code>
        </p>
      </footer>
    </section>
  );
}
