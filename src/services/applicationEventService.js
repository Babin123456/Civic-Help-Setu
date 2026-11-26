import { logDiagnostic } from '../utils/diagnostics';
import { safeHttpUrl } from '../utils/safeContent';

export const EVENT_CATEGORY = Object.freeze({
  SUBMISSION: 'submission',
  ACKNOWLEDGEMENT: 'acknowledgement',
  REVIEW: 'review',
  QUERY: 'query',
  OUTCOME: 'outcome',
});

export const EVENT_SOURCE = Object.freeze({
  OFFICIAL_PORTAL: 'official_portal',
  OFFICIAL_OFFICE: 'official_office',
  SYSTEM: 'system',
  CITIZEN_NOTE: 'citizen_note',
});

export const TIMELINE_STATE = Object.freeze({
  LOADING: 'loading',
  EMPTY: 'empty',
  READY: 'ready',
  ERROR: 'error',
  STALE: 'stale',
  PERMISSION_DENIED: 'permission_denied',
});

export const EVENT_ERROR = Object.freeze({
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  DUPLICATE_EVENT: 'DUPLICATE_EVENT',
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
});

export const SOURCE_META = Object.freeze({
  [EVENT_SOURCE.OFFICIAL_PORTAL]: {
    label: 'Official portal',
    shortLabel: 'Official',
    official: true,
  },
  [EVENT_SOURCE.OFFICIAL_OFFICE]: {
    label: 'Official office record',
    shortLabel: 'Official',
    official: true,
  },
  [EVENT_SOURCE.SYSTEM]: {
    label: 'Tracked application record',
    shortLabel: 'App record',
    official: false,
  },
  [EVENT_SOURCE.CITIZEN_NOTE]: {
    label: 'Citizen note — private guidance',
    shortLabel: 'Citizen note',
    official: false,
  },
});

export const CATEGORY_META = Object.freeze({
  [EVENT_CATEGORY.SUBMISSION]: { label: 'Submission', order: 0 },
  [EVENT_CATEGORY.ACKNOWLEDGEMENT]: { label: 'Acknowledgement', order: 1 },
  [EVENT_CATEGORY.REVIEW]: { label: 'Review', order: 2 },
  [EVENT_CATEGORY.QUERY]: { label: 'Query', order: 3 },
  [EVENT_CATEGORY.OUTCOME]: { label: 'Outcome', order: 4 },
});

const CIVIC_STATUSES = new Set([
  'submitted',
  'in-progress',
  'action-required',
  'completed',
  'sla-breach',
]);

const PLACEHOLDER_TIMESTAMP = /^(?:pending|estimated|not recorded|timestamp not recorded|just now|recent|date pending|not available)\b/i;
const AADHAAR_REGEX = /\b[2-9]\d{3}\s?-?\d{4}\s?-?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}\d{4}[A-Z]\b/i;
const SENSITIVE_PAYLOAD_KEYS = new Set([
  'aadhaar',
  'pan',
  'otp',
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'privatekey',
  'base64',
  'filedata',
  'fileblob',
  'documentcontent',
  'documentdata',
  'attachment',
  'binary',
]);
const normalizedKey = (key) => String(key).replace(/[^a-z0-9]/gi, '').toLowerCase();
const PAYLOAD_MAX_LENGTH = 4000;
const CATEGORY_VALUES = new Set(Object.values(EVENT_CATEGORY));
const SOURCE_VALUES = new Set(Object.values(EVENT_SOURCE));
const STAGE_CATEGORY = [
  EVENT_CATEGORY.SUBMISSION,
  EVENT_CATEGORY.ACKNOWLEDGEMENT,
  EVENT_CATEGORY.REVIEW,
  EVENT_CATEGORY.OUTCOME,
];

export const EVENTS_STORAGE_KEY = 'civicbridge_application_events_v1';
export const REPORTS_STORAGE_KEY = 'civicbridge_event_inconsistency_reports_v1';

const memoryStore = new Map();

const getStorage = () => {
  try {
    if (typeof globalThis.localStorage !== 'undefined') return globalThis.localStorage;
  } catch {
    return null;
  }
  return null;
};

const readCollection = (key, fallback) => {
  const storage = getStorage();
  if (!storage) return memoryStore.has(key) ? memoryStore.get(key) : fallback;
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (err) {
    logDiagnostic(`Failed to read ${key}`, err);
    return fallback;
  }
};

const writeCollection = (key, value) => {
  const storage = getStorage();
  if (!storage) {
    memoryStore.set(key, value);
    return;
  }
  storage.setItem(key, JSON.stringify(value));
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const safeString = (value, max = 4000) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const canonicalStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  if (!isPlainObject(value)) return JSON.stringify(value);
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
    .join(',')}}`;
};

const fnv1a = (value) => {
  let hash = 0x811c9dc5;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const parseSourceTimestamp = (value) => {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') return null;
  const text = value.replace(/[•|]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text || PLACEHOLDER_TIMESTAMP.test(text)) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const timestampIsoOrNull = (value) => {
  const ms = parseSourceTimestamp(value);
  return ms === null ? null : new Date(ms).toISOString();
};

const derivedFingerprint = (event) =>
  fnv1a(
    canonicalStringify({
      applicationId: event.applicationId,
      category: event.category,
      sourceType: event.sourceType,
      sourceRef: event.sourceRef,
      sourceTimestamp: event.sourceTimestamp,
      status: event.status,
      actorRole: event.actorRole,
      payloadVersion: event.payloadVersion,
      payload: event.payload,
    })
  );

const makeEventId = () =>
  `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export class ApplicationEventError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'ApplicationEventError';
    this.code = code;
    this.details = details;
  }
}

export const validateApplicationEventInput = (input) => {
  const errors = [];
  if (!isPlainObject(input)) {
    return ['Event payload must be an object.'];
  }

  if (!safeString(input.applicationId, 120)) {
    errors.push('applicationId is required.');
  }

  const category = safeString(input.category, 40);
  if (!CATEGORY_VALUES.has(category)) {
    errors.push(`category must be one of: ${[...CATEGORY_VALUES].join(', ')}.`);
  }

  const sourceType = safeString(input.sourceType, 40);
  if (!SOURCE_VALUES.has(sourceType)) {
    errors.push(`sourceType must be one of: ${[...SOURCE_VALUES].join(', ')}.`);
  }

  if (!safeString(input.sourceTimestamp, 120)) {
    errors.push('sourceTimestamp is required.');
  }

  if (input.status !== null && input.status !== undefined) {
    const status = safeString(input.status, 40);
    if (!CIVIC_STATUSES.has(status)) {
      errors.push('status must be a recognised civic application status or null.');
    }
  }

  if (input.payloadVersion !== undefined) {
    const version = Number(input.payloadVersion);
    if (!Number.isInteger(version) || version < 1) {
      errors.push('payloadVersion must be a positive integer.');
    }
  }

  if (input.payload !== undefined && !isPlainObject(input.payload)) {
    errors.push('payload must be an object when provided.');
  }

  if (input.sourceUrl !== undefined && input.sourceUrl !== null && input.sourceUrl !== '') {
    if (!safeHttpUrl(input.sourceUrl)) {
      errors.push('sourceUrl must be a valid http(s) URL without embedded credentials.');
    }
  }

  if (isPlainObject(input.payload)) {
    const sensitiveKey = Object.keys(input.payload).find((key) =>
      SENSITIVE_PAYLOAD_KEYS.has(normalizedKey(key))
    );
    if (sensitiveKey) {
      errors.push(`payload must not contain sensitive field "${sensitiveKey}".`);
    }
    const serialized = JSON.stringify({
      payload: input.payload,
      sourceRef: safeString(input.sourceRef, 240),
    });
    if (serialized.length > PAYLOAD_MAX_LENGTH) {
      errors.push(
        `payload and sourceRef must be ${PAYLOAD_MAX_LENGTH} characters or fewer.`
      );
    }
    if (AADHAAR_REGEX.test(serialized)) {
      errors.push('Aadhaar numbers are not allowed in timeline event payloads.');
    }
    if (PAN_REGEX.test(serialized)) {
      errors.push('PAN identifiers are not allowed in timeline event payloads.');
    }
  }

  if (input.statusTransition !== undefined && input.statusTransition !== null) {
    if (!isPlainObject(input.statusTransition)) {
      errors.push('statusTransition must be an object or null.');
    } else {
      const from = input.statusTransition.from;
      const to = input.statusTransition.to;
      if (from !== null && from !== undefined && !CIVIC_STATUSES.has(String(from))) {
        errors.push('statusTransition.from must be a recognised status or null.');
      }
      if (to !== null && to !== undefined && !CIVIC_STATUSES.has(String(to))) {
        errors.push('statusTransition.to must be a recognised status or null.');
      }
    }
  }

  if (sourceType === EVENT_SOURCE.CITIZEN_NOTE && input.isOfficial === true) {
    errors.push('Citizen notes cannot be marked as official events.');
  }

  return errors;
};

export const normalizeApplicationEvent = (input = {}) => {
  const sourceType = safeString(input.sourceType, 40);
  const meta = SOURCE_META[sourceType] || SOURCE_META[EVENT_SOURCE.SYSTEM];
  const status = input.status === null || input.status === undefined
    ? null
    : safeString(input.status, 40);
  const sourceTimestamp = safeString(input.sourceTimestamp, 120);

  const event = {
    eventId: safeString(input.eventId, 160) || makeEventId(),
    applicationId: safeString(input.applicationId, 120).toUpperCase(),
    category: safeString(input.category, 40),
    sourceType,
    sourceRef: safeString(input.sourceRef, 240) || meta.label,
    sourceUrl: safeHttpUrl(input.sourceUrl),
    sourceTimestamp,
    sourceTimestampMs: parseSourceTimestamp(sourceTimestamp),
    ingestedAt: timestampIsoOrNull(input.ingestedAt) || new Date().toISOString(),
    status,
    statusTransition: isPlainObject(input.statusTransition)
      ? {
          from: input.statusTransition.from ?? null,
          to: input.statusTransition.to ?? null,
        }
      : null,
    actorRole: safeString(input.actorRole, 80) || 'system',
    payloadVersion: Number.isInteger(Number(input.payloadVersion))
      ? Number(input.payloadVersion)
      : 1,
    payload: isPlainObject(input.payload) ? JSON.parse(JSON.stringify(input.payload)) : {},
    idempotencyKey: safeString(input.idempotencyKey, 240) || null,
    isOfficial: meta.official,
    isPrivateGuidance: sourceType === EVENT_SOURCE.CITIZEN_NOTE,
  };

  event.contentFingerprint = derivedFingerprint(event);
  return event;
};

const eventMatchesIdentity = (candidate, existing) => {
  if (candidate.eventId && candidate.eventId === existing.eventId) return true;
  if (
    candidate.idempotencyKey &&
    existing.idempotencyKey &&
    candidate.idempotencyKey === existing.idempotencyKey
  ) {
    return true;
  }
  return Boolean(
    candidate.contentFingerprint &&
      existing.contentFingerprint &&
      candidate.contentFingerprint === existing.contentFingerprint
  );
};

export const getStoredApplicationEvents = () =>
  readCollection(EVENTS_STORAGE_KEY, []).filter(
    (event) =>
      isPlainObject(event) &&
      typeof event.eventId === 'string' &&
      typeof event.applicationId === 'string'
  );

export const appendApplicationEvent = (input) => {
  const errors = validateApplicationEventInput(input);
  if (errors.length > 0) {
    throw new ApplicationEventError(
      EVENT_ERROR.VALIDATION_FAILED,
      'The event record is not valid.',
      errors
    );
  }

  const candidate = normalizeApplicationEvent(input);
  const existing = getStoredApplicationEvents();
  const duplicate = existing.find((event) => eventMatchesIdentity(candidate, event));

  if (duplicate) {
    throw new ApplicationEventError(
      EVENT_ERROR.DUPLICATE_EVENT,
      'An identical event record already exists; existing events are never overwritten.',
      { eventId: duplicate.eventId }
    );
  }

  writeCollection(EVENTS_STORAGE_KEY, [...existing, candidate]);
  return candidate;
};

const projectLegacyStages = (application) => {
  const stages = Array.isArray(application?.stages) ? application.stages : [];
  const applicationId = safeString(application?.id, 120).toUpperCase();
  const appliedDate = safeString(application?.appliedDate, 120);

  return stages.map((stage, index) => {
    const safeStage = isPlainObject(stage) ? stage : {};
    const status = safeStage.completed
      ? 'completed'
      : safeStage.actionRequired
        ? 'action-required'
        : safeStage.inProgress
          ? 'in-progress'
          : 'submitted';

    const title = safeString(safeStage.title, 240) || `Stage ${index + 1}`;
    const description = safeString(safeStage.description, 2000);
    const sourceTimestamp =
      safeString(safeStage.timestamp, 120) || appliedDate || 'Timestamp not recorded';
    const stageState = safeStage.completed
      ? 'completed'
      : safeStage.actionRequired
        ? 'action-required'
        : safeStage.inProgress
          ? 'in-progress'
          : 'upcoming';
    const signature = fnv1a(
      canonicalStringify({ index, title, description, sourceTimestamp, stageState, status })
    );

    return {
      eventId: `legacy-${applicationId}-stage-${index}-${signature}`,
      applicationId,
      category: STAGE_CATEGORY[index] || EVENT_CATEGORY.REVIEW,
      sourceType: EVENT_SOURCE.SYSTEM,
      sourceRef: 'Tracked application milestone',
      sourceTimestamp,
      ingestedAt: new Date().toISOString(),
      status,
      statusTransition: index === 0 ? { from: null, to: status } : null,
      actorRole: 'system',
      payloadVersion: 1,
      payload: {
        title,
        description,
        stageState,
      },
      idempotencyKey: `legacy-stage-${applicationId}-${index}-${signature}`,
    };
  });
};

const projectLegacyNotes = (application) => {
  const notes = Array.isArray(application?.notes) ? application.notes : [];
  const applicationId = safeString(application?.id, 120).toUpperCase();

  return notes.map((note, index) => {
    const safeNote = isPlainObject(note) ? note : {};
    const noteId = safeString(safeNote.id, 120) || `note-${index}`;
    const text = safeString(safeNote.text, 2000);
    const sourceTimestamp =
      safeString(safeNote.date, 120) ||
      safeString(application?.appliedDate, 120) ||
      'Timestamp not recorded';
    const signature = fnv1a(
      canonicalStringify({ noteId, text, sourceTimestamp, index })
    );

    return {
      eventId: `legacy-${applicationId}-note-${noteId}-${signature}`,
      applicationId,
      category: EVENT_CATEGORY.QUERY,
      sourceType: EVENT_SOURCE.CITIZEN_NOTE,
      sourceRef: 'Citizen note',
      sourceTimestamp,
      ingestedAt: new Date().toISOString(),
      status: null,
      statusTransition: null,
      actorRole: 'citizen',
      payloadVersion: 1,
      payload: {
        text,
        privateGuidance: true,
      },
      idempotencyKey: `legacy-note-${applicationId}-${noteId}-${signature}`,
    };
  });
};

export const projectLegacyApplicationToEvents = (application) => {
  if (!isPlainObject(application) || !safeString(application.id, 120)) return [];
  return [
    ...projectLegacyStages(application),
    ...projectLegacyNotes(application),
  ];
};

export const ensureApplicationEvents = (application) => {
  if (!isPlainObject(application) || !safeString(application.id, 120)) {
    return { events: [], seededCount: 0 };
  }

  const applicationId = safeString(application.id, 120).toUpperCase();
  let existing = getStoredApplicationEvents();
  let seededCount = 0;

  for (const projected of projectLegacyApplicationToEvents(application)) {
    const candidate = normalizeApplicationEvent(projected);
    if (existing.some((event) => eventMatchesIdentity(candidate, event))) continue;
    writeCollection(EVENTS_STORAGE_KEY, [...existing, candidate]);
    existing = [...existing, candidate];
    seededCount += 1;
  }

  return {
    events: existing.filter((event) => event.applicationId === applicationId),
    seededCount,
  };
};

export const sortEventsChronologically = (events = []) =>
  [...events].sort((left, right) => {
    const leftSource = left.sourceTimestampMs ?? parseSourceTimestamp(left.sourceTimestamp);
    const rightSource = right.sourceTimestampMs ?? parseSourceTimestamp(right.sourceTimestamp);

    if (leftSource !== null && rightSource !== null && leftSource !== rightSource) {
      return leftSource - rightSource;
    }
    if (leftSource === null && rightSource !== null) return 1;
    if (leftSource !== null && rightSource === null) return -1;

    const leftIngested = parseSourceTimestamp(left.ingestedAt) ?? 0;
    const rightIngested = parseSourceTimestamp(right.ingestedAt) ?? 0;
    if (leftIngested !== rightIngested) return leftIngested - rightIngested;

    return String(left.eventId).localeCompare(String(right.eventId));
  });

export const detectTimelineAnomalies = (events = []) => {
  const anomalies = [];
  const seenEventIds = new Map();
  const seenIdempotencyKeys = new Map();
  const seenFingerprints = new Map();

  for (const event of events) {
    if (seenEventIds.has(event.eventId)) {
      anomalies.push({
        type: 'duplicate',
        severity: 'high',
        eventIds: [seenEventIds.get(event.eventId), event.eventId],
        message: 'Two records share the same event ID.',
      });
    } else {
      seenEventIds.set(event.eventId, event.eventId);
    }

    if (event.idempotencyKey) {
      if (seenIdempotencyKeys.has(event.idempotencyKey)) {
        anomalies.push({
          type: 'duplicate',
          severity: 'high',
          eventIds: [seenIdempotencyKeys.get(event.idempotencyKey), event.eventId],
          message: 'An idempotency key was recorded more than once.',
        });
      } else {
        seenIdempotencyKeys.set(event.idempotencyKey, event.eventId);
      }
    }

    if (event.contentFingerprint) {
      if (seenFingerprints.has(event.contentFingerprint)) {
        anomalies.push({
          type: 'duplicate',
          severity: 'medium',
          eventIds: [seenFingerprints.get(event.contentFingerprint), event.eventId],
          message: 'Two events contain the same recorded content.',
        });
      } else {
        seenFingerprints.set(event.contentFingerprint, event.eventId);
      }
    }

    if (event.sourceType === EVENT_SOURCE.CITIZEN_NOTE && event.isOfficial === true) {
      anomalies.push({
        type: 'source_masquerade',
        severity: 'high',
        eventIds: [event.eventId],
        message: 'A citizen note is marked as an official record.',
      });
    }
  }

  const byIngestion = [...events].sort(
    (left, right) =>
      (parseSourceTimestamp(left.ingestedAt) ?? 0) -
      (parseSourceTimestamp(right.ingestedAt) ?? 0)
  );
  let latestSource = null;
  for (const event of byIngestion) {
    const sourceMs = event.sourceTimestampMs ?? parseSourceTimestamp(event.sourceTimestamp);
    if (sourceMs === null) continue;
    if (latestSource !== null && sourceMs < latestSource) {
      anomalies.push({
        type: 'out_of_order',
        severity: 'medium',
        eventIds: [event.eventId],
        message: 'This event was ingested after a later-dated event.',
      });
    }
    latestSource = latestSource === null ? sourceMs : Math.max(latestSource, sourceMs);
  }

  const officialByTimestamp = new Map();
  for (const event of events) {
    if (!event.isOfficial) continue;
    const key = `${event.category}:${event.sourceTimestamp}`;
    const previous = officialByTimestamp.get(key);
    if (previous && previous.status !== event.status) {
      anomalies.push({
        type: 'conflicting_official_evidence',
        severity: 'high',
        eventIds: [previous.eventId, event.eventId],
        message: 'Official records disagree about the status at the same source timestamp.',
      });
    } else if (!previous) {
      officialByTimestamp.set(key, event);
    }
  }

  return anomalies;
};

export const computeTimelineDataVersion = (events = []) =>
  fnv1a(
    canonicalStringify(
      sortEventsChronologically(events).map((event) => ({
        eventId: event.eventId,
        status: event.status,
        sourceTimestamp: event.sourceTimestamp,
        payloadVersion: event.payloadVersion,
      }))
    )
  );

export const listApplicationEvents = (
  applicationId,
  { limit = 50, cursor = null } = {}
) => {
  const cleanId = safeString(applicationId, 120).toUpperCase();
  if (!cleanId) return { items: [], nextCursor: null, total: 0, dataVersion: '' };

  const matches = sortEventsChronologically(
    getStoredApplicationEvents().filter(
      (event) => String(event.applicationId).toUpperCase() === cleanId
    )
  );

  const start = Number.isInteger(Number(cursor)) && Number(cursor) >= 0 ? Number(cursor) : 0;
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const items = matches.slice(start, start + safeLimit);
  const nextIndex = start + items.length;

  return {
    items,
    nextCursor: nextIndex < matches.length ? String(nextIndex) : null,
    total: matches.length,
    dataVersion: computeTimelineDataVersion(matches),
  };
};

export const getApplicationTimeline = (application) => {
  const { events, seededCount } = ensureApplicationEvents(application);
  const sorted = sortEventsChronologically(events);
  return {
    applicationId: safeString(application?.id, 120).toUpperCase(),
    events: sorted,
    anomalies: detectTimelineAnomalies(sorted),
    seededCount,
    dataVersion: computeTimelineDataVersion(sorted),
    state: sorted.length === 0 ? TIMELINE_STATE.EMPTY : TIMELINE_STATE.READY,
  };
};

const diffValue = (value) => {
  if (value === undefined) return null;
  if (isPlainObject(value) || Array.isArray(value)) return canonicalStringify(value);
  return value;
};

export const createEventDiff = (events, leftEventId, rightEventId) => {
  const list = Array.isArray(events) ? events : [];
  const left = list.find((event) => event.eventId === leftEventId);
  const right = list.find((event) => event.eventId === rightEventId);

  if (!left || !right) {
    throw new ApplicationEventError(
      EVENT_ERROR.EVENT_NOT_FOUND,
      'Both events must exist in the stored timeline to compare them.'
    );
  }

  const fields = [
    'category',
    'sourceType',
    'sourceRef',
    'sourceUrl',
    'sourceTimestamp',
    'ingestedAt',
    'status',
    'statusTransition',
    'actorRole',
    'payloadVersion',
    'payload',
    'isOfficial',
    'isPrivateGuidance',
  ].map((field) => {
    const before = diffValue(left[field]);
    const after = diffValue(right[field]);
    return {
      field,
      before,
      after,
      changed: before !== after,
    };
  });

  return {
    left,
    right,
    fields,
    changedCount: fields.filter((field) => field.changed).length,
    unchangedCount: fields.filter((field) => !field.changed).length,
    dataVersion: computeTimelineDataVersion([left, right]),
  };
};

const createReportId = () =>
  `report-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const reportTimelineInconsistency = ({
  applicationId,
  eventIds = [],
  reason,
  reporterRole = 'citizen',
} = {}) => {
  const cleanId = safeString(applicationId, 120).toUpperCase();
  const cleanReason = safeString(reason, 1000);
  const cleanEventIds = Array.isArray(eventIds)
    ? [...new Set(eventIds.map((id) => safeString(id, 160)).filter(Boolean))]
    : [];

  const errors = [];
  if (!cleanId) errors.push('applicationId is required.');
  if (cleanReason.length < 8) errors.push('Describe the inconsistency in at least 8 characters.');
  if (cleanEventIds.length === 0) errors.push('Select at least one event record.');
  if (AADHAAR_REGEX.test(cleanReason)) {
    errors.push('Aadhaar numbers are not allowed in inconsistency reports.');
  }
  if (PAN_REGEX.test(cleanReason)) {
    errors.push('PAN identifiers are not allowed in inconsistency reports.');
  }

  if (errors.length > 0) {
    throw new ApplicationEventError(
      EVENT_ERROR.VALIDATION_FAILED,
      'The inconsistency report is not valid.',
      errors
    );
  }

  const report = {
    reportId: createReportId(),
    applicationId: cleanId,
    eventIds: cleanEventIds,
    reason: cleanReason,
    reporterRole: safeString(reporterRole, 80) || 'citizen',
    status: 'pending_review',
    reportedAt: new Date().toISOString(),
  };

  const existing = readCollection(REPORTS_STORAGE_KEY, []);
  writeCollection(REPORTS_STORAGE_KEY, [...existing, report]);
  return report;
};

export const getInconsistencyReports = (applicationId = null) => {
  const reports = readCollection(REPORTS_STORAGE_KEY, []);
  if (!applicationId) return reports;
  const cleanId = safeString(applicationId, 120).toUpperCase();
  return reports.filter((report) => report.applicationId === cleanId);
};

export const getSourceMeta = (sourceType) =>
  SOURCE_META[sourceType] || {
    label: 'Recorded event',
    shortLabel: 'Recorded',
    official: false,
  };

export const getCategoryMeta = (category) =>
  CATEGORY_META[category] || { label: 'Timeline event', order: 99 };

export const resetApplicationEventStoreForTests = () => {
  memoryStore.clear();
  const storage = getStorage();
  if (storage) {
    storage.removeItem(EVENTS_STORAGE_KEY);
    storage.removeItem(REPORTS_STORAGE_KEY);
  }
};
