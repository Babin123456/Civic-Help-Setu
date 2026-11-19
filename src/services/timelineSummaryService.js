import {
  EVENT_SOURCE,
  computeTimelineDataVersion,
  detectTimelineAnomalies,
  getCategoryMeta,
  getSourceMeta,
  sortEventsChronologically,
} from './applicationEventService';

export const SUMMARY_LABEL = 'Suggestion — verify against official sources';

const uniqueEventIds = (events) => [...new Set(events.map((event) => event.eventId))];

const buildSourceReferences = (events) =>
  events.map((event) => ({
    eventId: event.eventId,
    sourceType: event.sourceType,
    sourceRef: event.sourceRef,
    sourceUrl: event.sourceUrl || '',
    sourceTimestamp: event.sourceTimestamp,
    isOfficial: Boolean(event.isOfficial),
    isPrivateGuidance: Boolean(event.isPrivateGuidance),
  }));

export const summarizeApplicationEvents = (applicationId, events = []) => {
  const safeEvents = Array.isArray(events) ? events : [];
  const sorted = sortEventsChronologically(safeEvents);
  const dataVersion = computeTimelineDataVersion(sorted);
  const anomalies = detectTimelineAnomalies(sorted);

  if (sorted.length === 0) {
    return {
      label: SUMMARY_LABEL,
      summary:
        'No recorded events are available for this application. No status is inferred from an empty timeline.',
      citations: [],
      sourceReferences: [],
      eventIds: [],
      dataVersion,
      confidence: 'low',
      requiresReview: false,
      reviewReason: null,
      isSuggestion: true,
    };
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const citizenNotes = sorted.filter(
    (event) => event.sourceType === EVENT_SOURCE.CITIZEN_NOTE
  );
  const officialEvents = sorted.filter((event) => event.isOfficial === true);
  const highSeverity = anomalies.filter(
    (anomaly) => anomaly.severity === 'high'
  );
  const unparseable = sorted.filter(
    (event) => event.sourceTimestampMs === null
  );

  const sentences = [
    `Recorded timeline for application ${applicationId}: ${sorted.length} event${
      sorted.length === 1 ? '' : 's'
    } between ${first.sourceTimestamp} and ${last.sourceTimestamp}.`,
    `First recorded event: ${getCategoryMeta(first.category).label} on ${
      first.sourceTimestamp
    } [${first.eventId}] from ${getSourceMeta(first.sourceType).label}.`,
    `Most recent recorded event: ${getCategoryMeta(last.category).label} on ${
      last.sourceTimestamp
    } [${last.eventId}] from ${getSourceMeta(last.sourceType).label}.`,
    `Recorded status field on the most recent event: ${
      last.status === null || last.status === undefined ? 'not recorded' : last.status
    }.`,
    `Official-source events: ${officialEvents.length}. Citizen notes kept separate as private guidance: ${citizenNotes.length}.`,
  ];

  const requiresReview = highSeverity.length > 0 || unparseable.length > 0;
  let reviewReason = null;

  if (highSeverity.length > 0) {
    reviewReason =
      'Conflicting or duplicate official evidence was found in the stored timeline.';
  } else if (unparseable.length > 0) {
    reviewReason =
      'One or more recorded events have timestamps that cannot be ordered deterministically.';
  }

  if (requiresReview) {
    sentences.push(
      'This summary is routed for human review because the stored records contain conflicting or low-confidence evidence.'
    );
  }

  sentences.push(
    'This suggestion only describes recorded events. It does not decide or predict an official government status, outcome, or deadline.'
  );

  return {
    label: SUMMARY_LABEL,
    summary: sentences.join(' '),
    citations: uniqueEventIds(sorted).map((eventId) => {
      const event = sorted.find((item) => item.eventId === eventId);
      return {
        eventId,
        sourceTimestamp: event.sourceTimestamp,
        sourceType: event.sourceType,
      };
    }),
    sourceReferences: buildSourceReferences(sorted),
    eventIds: uniqueEventIds(sorted),
    dataVersion,
    confidence: requiresReview ? 'low' : officialEvents.length > 0 ? 'medium' : 'low',
    requiresReview,
    reviewReason,
    isSuggestion: true,
  };
};
