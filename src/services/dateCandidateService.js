/**
 * Civic Public Notice Deadline Calendar service.
 *
 * Turns a curated public notice into per-action deadline candidates, lets a
 * citizen confirm, edit or dismiss each candidate, and never treats an
 * unconfirmed AI extraction as a deadline.
 *
 * Design notes:
 *  - The official notice record is never mutated. Extracted candidates are
 *    derived deterministically from the notice, and the citizen's
 *    confirmation/edit/dismiss state is stored separately, per browser.
 *  - Date arithmetic is done on calendar dates in UTC, so a notice published on
 *    2026-02-15 through `T00:00:00.000Z` yields 2026-03-17 for a 30-day window
 *    regardless of the browser's timezone.
 *  - Low-confidence extractions are flagged for review instead of being
 *    presented as certain deadlines.
 */

import { getNotices, NOTICE_STATUSES } from './noticeDigestService';

export const ACTION_TYPES = {
  PUBLICATION: 'publication',
  OBJECTION: 'objection',
  HEARING: 'hearing',
  SUBMISSION: 'submission',
  PAYMENT: 'payment',
  APPEAL: 'appeal',
};

export const ACTION_LABELS = {
  [ACTION_TYPES.PUBLICATION]: 'Gazette publication',
  [ACTION_TYPES.OBJECTION]: 'Objection deadline',
  [ACTION_TYPES.HEARING]: 'Hearing date',
  [ACTION_TYPES.SUBMISSION]: 'Submission deadline',
  [ACTION_TYPES.PAYMENT]: 'Payment due',
  [ACTION_TYPES.APPEAL]: 'Appeal deadline',
};

/**
 * Lane groupings for the visualizer.
 */
export const ACTION_LANE_MAP = {
  [ACTION_TYPES.PUBLICATION]: 'response',
  [ACTION_TYPES.OBJECTION]: 'response',
  [ACTION_TYPES.SUBMISSION]: 'response',
  [ACTION_TYPES.HEARING]: 'hearing',
  [ACTION_TYPES.PAYMENT]: 'payment',
  [ACTION_TYPES.APPEAL]: 'appeal',
};

export const LANE_ORDER = ['response', 'hearing', 'payment', 'appeal'];

export const LANE_LABELS = {
  response: 'Response & Submission',
  hearing: 'Hearing',
  payment: 'Payment',
  appeal: 'Appeal',
};

export const CONFIRMATION_STATES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
};

/** Candidates below this confidence are routed to review, not presented as facts. */
export const REVIEW_CONFIDENCE_THRESHOLD = 0.6;

/** Per-browser confirmation state. Namespaced so it never mixes with notice data. */
export const DEADLINE_STORAGE_KEY = 'civicbridge_notice_deadline_state_v1';

const IST_TIME_ZONE = 'Asia/Kolkata';

const BASE_DATE_RULES = [
  {
    actionType: ACTION_TYPES.OBJECTION,
    days: 30,
    confidence: 0.7,
    description: 'Objection window: 30 days after gazette publication',
  },
  {
    actionType: ACTION_TYPES.SUBMISSION,
    days: 15,
    confidence: 0.75,
    description: 'Submission window: 15 days after gazette publication',
  },
  {
    actionType: ACTION_TYPES.APPEAL,
    days: 60,
    confidence: 0.55,
    description: 'Appeal window: 60 days after gazette publication',
  },
];

const CATEGORY_DATE_RULES = {
  rule_amendment: [
    {
      actionType: ACTION_TYPES.HEARING,
      days: 45,
      confidence: 0.65,
      description: 'Hearing window: 45 days after gazette publication for rule amendments',
    },
  ],
  gazette_order: [
    {
      actionType: ACTION_TYPES.HEARING,
      days: 45,
      confidence: 0.6,
      description: 'Hearing window: 45 days after gazette publication for gazette orders',
    },
  ],
  fee_revision: [
    {
      actionType: ACTION_TYPES.PAYMENT,
      days: 30,
      confidence: 0.7,
      description: 'Revised fee payment window: 30 days after gazette publication',
    },
  ],
  deadline_extension: [
    {
      actionType: ACTION_TYPES.PAYMENT,
      days: 30,
      confidence: 0.65,
      description: 'Compliance payment window: 30 days after gazette publication',
    },
  ],
};

/**
 * Deterministic relative-date rules for a notice category. Category-specific
 * rules override the base rule for the same action type.
 */
export const getDateRulesForCategory = (category) => {
  const categoryRules = CATEGORY_DATE_RULES[category] || [];
  const overridden = new Set(categoryRules.map((rule) => rule.actionType));
  return [...BASE_DATE_RULES.filter((rule) => !overridden.has(rule.actionType)), ...categoryRules];
};

/**
 * Storage resolver that works in the browser and in tests.
 */
const getStorage = (customStorage) => {
  if (customStorage) return customStorage;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  return null;
};

const pad = (value) => String(value).padStart(2, '0');

/**
 * Normalizes any supported date input to a UTC midnight Date for calendar-date
 * arithmetic. Returns null when the input cannot be understood.
 */
export const parseDateOnly = (value) => {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return date;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
};

/** Formats a Date or date input as `YYYY-MM-DD` (UTC). */
export const toDateOnly = (value) => {
  const date = parseDateOnly(value);
  if (!date) return null;
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

/** Adds whole days to a calendar date, returning `YYYY-MM-DD`. */
export const addDaysToDate = (value, days) => {
  const date = parseDateOnly(value);
  if (!date || !Number.isFinite(days)) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return toDateOnly(date);
};

/** Human-readable date, rendered in UTC so it never shifts by a day. */
export const formatDisplayDate = (value) => {
  const date = parseDateOnly(value);
  if (!date) return '';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

/** Today's calendar date in the civic timezone (IST by default). */
export const getTodayInTimeZone = (now = new Date(), timeZone = IST_TIME_ZONE) => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return toDateOnly(now);
  }
};

/** True when `date` is before today in the civic timezone. */
export const isDateExpired = (date, now = new Date()) => {
  const normalized = toDateOnly(date);
  if (!normalized) return false;
  return normalized < getTodayInTimeZone(now);
};

const buildCandidateId = (noticeId, actionType) => `deadline_${noticeId}_${actionType}`;

/**
 * Extracts deadline candidates from a notice. Every candidate carries its own
 * source reference so the UI can open the passage it came from.
 */
export const extractDateCandidates = (notice) => {
  if (!notice || !notice.id) return [];

  const publicationDate = toDateOnly(notice.gazettePublicationDate);
  if (!publicationDate) return [];

  const candidates = [
    {
      id: buildCandidateId(notice.id, ACTION_TYPES.PUBLICATION),
      noticeId: notice.id,
      noticeTitle: notice.title,
      actionType: ACTION_TYPES.PUBLICATION,
      lane: ACTION_LANE_MAP[ACTION_TYPES.PUBLICATION],
      normalizedDate: publicationDate,
      rawText: `Gazette publication date: ${formatDisplayDate(publicationDate)}`,
      sourceAnchor: {
        url: notice.sourceUrl || '',
        passage: notice.title || '',
      },
      calculationRule: 'gazettePublicationDate field',
      confidence: 0.95,
      requiresReview: false,
      isOfficialField: true,
    },
  ];

  getDateRulesForCategory(notice.category).forEach((rule) => {
    const normalizedDate = addDaysToDate(publicationDate, rule.days);
    if (!normalizedDate) return;

    candidates.push({
      id: buildCandidateId(notice.id, rule.actionType),
      noticeId: notice.id,
      noticeTitle: notice.title,
      actionType: rule.actionType,
      lane: ACTION_LANE_MAP[rule.actionType] || 'response',
      normalizedDate,
      rawText: `${rule.description} (${formatDisplayDate(normalizedDate)})`,
      sourceAnchor: {
        url: notice.sourceUrl || '',
        passage: notice.summary || notice.title || '',
      },
      calculationRule: rule.description,
      confidence: rule.confidence,
      requiresReview: rule.confidence < REVIEW_CONFIDENCE_THRESHOLD,
      isOfficialField: false,
    });
  });

  return candidates;
};

const readDeadlineState = (customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return {};
  try {
    const raw = storage.getItem(DEADLINE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const writeDeadlineState = (state, customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return false;
  try {
    storage.setItem(DEADLINE_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
};

export const getDeadlineStateMap = (customStorage) => readDeadlineState(customStorage);

/**
 * Merges a derived candidate with the citizen's stored state and computed flags.
 */
const mergeCandidate = (candidate, stateEntry, now) => {
  const normalizedDate = stateEntry.overrideDate || candidate.normalizedDate;
  const confirmationState = stateEntry.state || CONFIRMATION_STATES.PENDING;

  return {
    ...candidate,
    normalizedDate,
    confirmationState,
    note: stateEntry.note || '',
    updatedAt: stateEntry.updatedAt || null,
    isExpired: isDateExpired(normalizedDate, now),
    isConfirmed: confirmationState === CONFIRMATION_STATES.CONFIRMED,
    isDismissed: confirmationState === CONFIRMATION_STATES.REJECTED,
  };
};

/**
 * Returns the merged deadlines for a notice. Expired deadlines are kept so the
 * historical record stays available; they are only flagged.
 */
export const getNoticeDeadlines = (notice, options = {}) => {
  const { storage, now = new Date() } = options;
  if (!notice) return [];
  const state = readDeadlineState(storage);
  return extractDateCandidates(notice).map((candidate) =>
    mergeCandidate(candidate, state[candidate.id] || {}, now)
  );
};

/** Returns merged deadlines for a notice id. */
export const getDeadlinesForNoticeId = (noticeId, options = {}) => {
  if (!noticeId) return [];
  const notice = getNotices(options.storage).find((entry) => entry.id === noticeId);
  return notice ? getNoticeDeadlines(notice, options) : [];
};

/** Returns all merged deadlines for notices linked to a service. */
export const getDeadlinesForService = (serviceId, options = {}) => {
  if (!serviceId) return [];
  return getNotices(options.storage)
    .filter(
      (notice) =>
        notice.status === NOTICE_STATUSES.APPROVED &&
        Array.isArray(notice.affectedServiceIds) &&
        notice.affectedServiceIds.includes(serviceId)
    )
    .flatMap((notice) => getNoticeDeadlines(notice, options));
};

const updateDeadlineEntry = (candidateId, patch, customStorage) => {
  if (!candidateId) throw new Error('A deadline candidate id is required.');
  const state = readDeadlineState(customStorage);
  const previous = state[candidateId] || {};
  const next = {
    ...previous,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  state[candidateId] = next;
  writeDeadlineState(state, customStorage);
  return { id: candidateId, ...next };
};

/** Marks a candidate as confirmed by the citizen. */
export const confirmDateCandidate = (candidateId, customStorage) =>
  updateDeadlineEntry(candidateId, { state: CONFIRMATION_STATES.CONFIRMED }, customStorage);

/** Dismisses a candidate (kept for history, excluded from exports). */
export const rejectDateCandidate = (candidateId, customStorage) =>
  updateDeadlineEntry(candidateId, { state: CONFIRMATION_STATES.REJECTED }, customStorage);

/** Removes any stored decision, returning the candidate to its derived value. */
export const resetDateCandidate = (candidateId, customStorage) => {
  if (!candidateId) throw new Error('A deadline candidate id is required.');
  const state = readDeadlineState(customStorage);
  delete state[candidateId];
  writeDeadlineState(state, customStorage);
  return { id: candidateId, state: CONFIRMATION_STATES.PENDING };
};

/** Validates a citizen-supplied edit to a deadline. */
export const validateDeadlineEdit = ({ normalizedDate, note } = {}) => {
  const errors = [];

  if (normalizedDate !== undefined && normalizedDate !== null && normalizedDate !== '') {
    if (!parseDateOnly(normalizedDate)) {
      errors.push('Enter a valid date (YYYY-MM-DD).');
    }
  }

  if (note !== undefined && typeof note !== 'string') {
    errors.push('Note must be text.');
  }

  if (typeof note === 'string' && note.length > 500) {
    errors.push('Note must be 500 characters or fewer.');
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * Edits a deadline date and/or note. Editing a date confirms the citizen's
 * intent, so the candidate becomes confirmed unless a state is supplied.
 */
export const updateDateCandidate = (candidateId, changes = {}, customStorage) => {
  if (!candidateId) throw new Error('A deadline candidate id is required.');
  const validation = validateDeadlineEdit(changes);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(' '));
  }

  const patch = {};
  if (
    changes.normalizedDate !== undefined &&
    changes.normalizedDate !== null &&
    changes.normalizedDate !== ''
  ) {
    patch.overrideDate = toDateOnly(changes.normalizedDate);
  }
  if (changes.note !== undefined) {
    patch.note = changes.note;
  }
  if (changes.state !== undefined) {
    patch.state = changes.state;
  } else {
    patch.state = CONFIRMATION_STATES.CONFIRMED;
  }

  return updateDeadlineEntry(candidateId, patch, customStorage);
};

/** Returns merged deadlines grouped by confirmation state. */
export const getDateCandidatesByState = (noticeId, customStorage) => {
  const deadlines = getDeadlinesForNoticeId(noticeId, { storage: customStorage });
  return {
    pending: deadlines.filter((item) => item.confirmationState === CONFIRMATION_STATES.PENDING),
    confirmed: deadlines.filter((item) => item.confirmationState === CONFIRMATION_STATES.CONFIRMED),
    rejected: deadlines.filter((item) => item.confirmationState === CONFIRMATION_STATES.REJECTED),
  };
};

/** Returns merged deadlines grouped by lane, sorted by date within each lane. */
export const getDateCandidatesByLane = (noticeId, customStorage) => {
  const deadlines = getDeadlinesForNoticeId(noticeId, { storage: customStorage });
  const laneMap = { response: [], hearing: [], payment: [], appeal: [] };

  deadlines.forEach((candidate) => {
    const lane = ACTION_LANE_MAP[candidate.actionType] || 'response';
    laneMap[lane].push(candidate);
  });

  Object.keys(laneMap).forEach((lane) => {
    laneMap[lane].sort((a, b) => a.normalizedDate.localeCompare(b.normalizedDate));
  });

  return laneMap;
};

/**
 * Explicit prerequisite rules between action types. Used for the dependency
 * view; deterministic (no date ordering heuristics).
 */
export const DEPENDENCY_RULES = {
  [ACTION_TYPES.OBJECTION]: [ACTION_TYPES.PUBLICATION],
  [ACTION_TYPES.SUBMISSION]: [ACTION_TYPES.PUBLICATION],
  [ACTION_TYPES.HEARING]: [ACTION_TYPES.PUBLICATION, ACTION_TYPES.OBJECTION],
  [ACTION_TYPES.PAYMENT]: [ACTION_TYPES.PUBLICATION, ACTION_TYPES.SUBMISSION],
  [ACTION_TYPES.APPEAL]: [ACTION_TYPES.PUBLICATION, ACTION_TYPES.HEARING],
};

/**
 * Builds the dependency graph: for each candidate, which earlier actions it
 * depends on. Only candidates present in the list are linked.
 */
export const calculateDateDependencies = (candidates = []) => {
  const byAction = {};
  candidates.forEach((candidate) => {
    if (candidate && candidate.actionType) {
      byAction[candidate.actionType] = candidate;
    }
  });

  const graph = {};
  candidates.forEach((candidate) => {
    if (!candidate || !candidate.id) return;
    const prerequisites = DEPENDENCY_RULES[candidate.actionType] || [];
    graph[candidate.id] = prerequisites
      .map((actionType) => byAction[actionType])
      .filter((prerequisite) => prerequisite && prerequisite.id !== candidate.id)
      .map((prerequisite) => ({
        dependsOn: prerequisite.id,
        dependsOnActionType: prerequisite.actionType,
        dependencyType:
          prerequisite.actionType === ACTION_TYPES.PUBLICATION ? 'prerequisite' : 'procedural',
      }));
  });

  return graph;
};

const escapeICalText = (value) =>
  String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');

/** Folds long iCalendar lines to 75 octets-ish characters. */
const foldICalLine = (line) => line.replace(/(.{73})/g, '$1\r\n ');

/**
 * Exports the citizen's confirmed deadlines as an iCalendar document. Returns
 * null when nothing has been confirmed.
 *
 * Accepts either a notice object or a notice id.
 */
export const exportICal = (noticeOrId, customStorage, now = new Date()) => {
  let notice = noticeOrId;
  if (typeof noticeOrId === 'string') {
    notice = getNotices(customStorage).find((entry) => entry.id === noticeOrId);
  }
  if (!notice) return null;

  const confirmed = getNoticeDeadlines(notice, { storage: customStorage, now }).filter(
    (candidate) => candidate.confirmationState === CONFIRMATION_STATES.CONFIRMED
  );

  if (confirmed.length === 0) return null;

  const stamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Civic Help Setu//Deadline Calendar//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeICalText(notice.title || 'Civic deadlines')}`,
  ];

  const usedUids = new Set();
  confirmed.forEach((candidate) => {
    const start = candidate.normalizedDate.replace(/-/g, '');
    const end = addDaysToDate(candidate.normalizedDate, 1).replace(/-/g, '');
    let uid = `${candidate.id}-${stamp}@civic-helpsetu`;
    while (usedUids.has(uid)) uid = `${uid}x`;
    usedUids.add(uid);

    const description = [
      candidate.calculationRule,
      candidate.note ? `Note: ${candidate.note}` : null,
      candidate.sourceAnchor?.url ? `Source: ${candidate.sourceAnchor.url}` : null,
      'Confirmed by citizen in Civic Help Setu.',
    ]
      .filter(Boolean)
      .join(' | ');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeICalText(uid)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      foldICalLine(`SUMMARY:${escapeICalText(`${ACTION_LABELS[candidate.actionType] || candidate.actionType}: ${notice.title}`)}`),
      foldICalLine(`DESCRIPTION:${escapeICalText(description)}`),
      'STATUS:CONFIRMED',
      candidate.sourceAnchor?.url ? foldICalLine(`URL:${escapeICalText(candidate.sourceAnchor.url)}`) : null,
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).join('\r\n');
};

/** Validates a derived or edited candidate before it is used as a deadline. */
export const validateDateCandidate = (candidate) => {
  const errors = [];

  if (!candidate || typeof candidate !== 'object') {
    return { isValid: false, errors: ['Deadline candidate is required.'] };
  }

  if (!Object.values(ACTION_TYPES).includes(candidate.actionType)) {
    errors.push('A supported action type is required.');
  }

  if (!candidate.normalizedDate) {
    errors.push('Normalized date is required.');
  } else if (!parseDateOnly(candidate.normalizedDate)) {
    errors.push('Normalized date must be a valid calendar date.');
  }

  if (!candidate.rawText && !candidate.sourceAnchor) {
    errors.push('A source passage reference is required.');
  }

  if (
    candidate.confidence !== undefined &&
    (typeof candidate.confidence !== 'number' ||
      candidate.confidence < 0 ||
      candidate.confidence > 1)
  ) {
    errors.push('Confidence must be between 0 and 1.');
  }

  if (
    candidate.confirmationState !== undefined &&
    !Object.values(CONFIRMATION_STATES).includes(candidate.confirmationState)
  ) {
    errors.push('Invalid confirmation state.');
  }

  return { isValid: errors.length === 0, errors };
};

/** Clears all stored decisions for a notice (or every notice when omitted). */
export const resetDateCandidates = (noticeId, customStorage) => {
  const state = readDeadlineState(customStorage);
  const prefix = noticeId ? `deadline_${noticeId}_` : 'deadline_';

  Object.keys(state).forEach((candidateId) => {
    if (candidateId.startsWith(prefix)) delete state[candidateId];
  });

  writeDeadlineState(state, customStorage);
  return noticeId ? getDeadlinesForNoticeId(noticeId, { storage: customStorage }) : [];
};

export default {
  ACTION_TYPES,
  ACTION_LABELS,
  ACTION_LANE_MAP,
  LANE_ORDER,
  LANE_LABELS,
  CONFIRMATION_STATES,
  REVIEW_CONFIDENCE_THRESHOLD,
  DEADLINE_STORAGE_KEY,
  getDateRulesForCategory,
  parseDateOnly,
  toDateOnly,
  addDaysToDate,
  formatDisplayDate,
  getTodayInTimeZone,
  isDateExpired,
  extractDateCandidates,
  getDeadlineStateMap,
  getNoticeDeadlines,
  getDeadlinesForNoticeId,
  getDeadlinesForService,
  confirmDateCandidate,
  rejectDateCandidate,
  resetDateCandidate,
  updateDateCandidate,
  validateDeadlineEdit,
  getDateCandidatesByState,
  getDateCandidatesByLane,
  DEPENDENCY_RULES,
  calculateDateDependencies,
  exportICal,
  validateDateCandidate,
  resetDateCandidates,
};
