/**
 * Service for Uttar Pradesh Public Hearing and Jan Sunwai preparation and
 * follow-up workspace (#1002).
 */

import {
  ACKNOWLEDGEMENT_TYPE,
  ACKNOWLEDGEMENT_TYPE_LABELS,
  ATTENDANCE_STATUS,
  ATTENDANCE_STATUS_LABELS,
  COMPLAINT_REGISTRATION_STATUS,
  COMPLAINT_REGISTRATION_STATUS_LABELS,
  FOLLOW_UP_STATE,
  FOLLOW_UP_STATE_LABELS,
  FOLLOW_UP_STATUS,
  FOLLOW_UP_STATUS_LABELS,
  HEARING_STATUS,
  HEARING_STATUS_LABELS,
  ISSUE_CATEGORIES,
  ISSUE_CATEGORY_OPTIONS,
  OUTCOME_DISTINCTION_NOTICE,
  OUTCOME_DISTINCTIONS,
  PREPARATION_DISCLAIMER,
  PRIVACY_NOTICE,
  RESOLUTION_STATUS,
  SOURCE_REVIEW_REQUIRED_AFTER_DAYS,
  SOURCE_STALE_AFTER_DAYS,
  UP_HEARING_EVENT_TYPES,
  VERIFICATION_STATUS,
  addDaysToDateKey,
  daysBetweenDateKeys,
  getUserFacingOutcomeExplanation,
  isGovernmentSourceUrl,
  isHttpsUrl,
  isValidDateKey,
  toDateKey,
} from '../data/upJanSunwaiContract.js';
import {
  UP_JAN_SUNWAI_EVENTS,
  UP_UNVERIFIED_EVENT_SUBMISSIONS,
} from '../data/upJanSunwaiEvents.js';

export {
  ACKNOWLEDGEMENT_TYPE,
  ACKNOWLEDGEMENT_TYPE_LABELS,
  ATTENDANCE_STATUS,
  ATTENDANCE_STATUS_LABELS,
  COMPLAINT_REGISTRATION_STATUS,
  COMPLAINT_REGISTRATION_STATUS_LABELS,
  FOLLOW_UP_STATE,
  FOLLOW_UP_STATE_LABELS,
  FOLLOW_UP_STATUS,
  FOLLOW_UP_STATUS_LABELS,
  HEARING_STATUS,
  HEARING_STATUS_LABELS,
  ISSUE_CATEGORIES,
  ISSUE_CATEGORY_OPTIONS,
  OUTCOME_DISTINCTION_NOTICE,
  OUTCOME_DISTINCTIONS,
  PREPARATION_DISCLAIMER,
  PRIVACY_NOTICE,
  RESOLUTION_STATUS,
  UP_HEARING_EVENT_TYPES,
  VERIFICATION_STATUS,
  addDaysToDateKey,
  daysBetweenDateKeys,
  getUserFacingOutcomeExplanation,
  isGovernmentSourceUrl,
  isHttpsUrl,
  isValidDateKey,
  toDateKey,
};

const STORAGE_KEY = 'civicbridge_up_jansunwai_state_v1';
const MAX_SHORT_TEXT = 200;
const MAX_MEDIUM_TEXT = 1000;
const MAX_LONG_TEXT = 5000;
const PLACEHOLDER = '[Not provided]';

const ALLOWED_CORRECTION_FIELDS = new Set([
  'eventDate',
  'startTime',
  'endTime',
  'venueName',
  'venueAddress',
  'registrationInstructions',
  'officialSourceUrl',
  'eligibility',
]);

const DEFAULT_EVENT_TYPES = new Set(Object.values(UP_HEARING_EVENT_TYPES));

const getDefaultStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const clone = (value) => {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
};

const text = (value, maxLength = MAX_MEDIUM_TEXT) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\r\n/g, '\n').trim().slice(0, maxLength);
};

const clean = (value) => text(value, MAX_SHORT_TEXT).toLowerCase();

const asNonEmptyArray = (value) =>
  Array.isArray(value) ? value.map((item) => text(item, MAX_SHORT_TEXT)).filter(Boolean) : [];

const formatDate = (value) => {
  const key = toDateKey(value);
  if (!key) return 'Date not confirmed';
  const date = new Date(`${key}T00:00:00.000Z`);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const formatHearingDate = (value) => formatDate(value);

const makeId = (prefix) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const resolveReferenceDate = (referenceDate) => {
  const key = toDateKey(referenceDate || new Date());
  return key || toDateKey(new Date());
};

const categoryFor = (categoryId) => {
  if (!categoryId) return null;
  return (
    Object.values(ISSUE_CATEGORIES).find((category) => category.id === categoryId) ||
    ISSUE_CATEGORIES[String(categoryId).toUpperCase()] ||
    null
  );
};

const inferIssueCategory = (event, requestedCategory) => {
  const requested = categoryFor(requestedCategory);
  if (requested) return requested;

  const firstFromEvent = Array.isArray(event?.issueCategories)
    ? categoryFor(event.issueCategories[0])
    : null;
  return firstFromEvent || ISSUE_CATEGORIES.OTHER;
};

/**
 * Validates the official-source and completeness requirements for an event.
 * An event with any validation error can never be rendered as an official
 * appointment.
 */
export function validateOfficialEventSource(event, referenceDate = new Date()) {
  const errors = [];
  const warnings = [];

  if (!event || typeof event !== 'object') {
    return {
      isValid: false,
      isOfficial: false,
      errors: ['Event record must be an object.'],
      warnings,
      sourceHost: null,
      lastVerifiedDate: null,
      freshness: { tier: 'unverified', isStale: true, daysSinceVerified: null },
    };
  }

  if (!text(event.id)) errors.push('A stable event id is required.');
  if (!text(event.title)) errors.push('A published event title is required.');
  if (!text(event.authority)) errors.push('The responsible authority is required.');
  if (!DEFAULT_EVENT_TYPES.has(event.eventType)) errors.push('A supported event type is required.');
  if (!text(event.jurisdiction?.state)) errors.push('The state jurisdiction is required.');
  if (!text(event.jurisdiction?.district)) errors.push('The district jurisdiction is required.');
  if (!isValidDateKey(event.eventDate)) errors.push('A valid published event date is required.');
  if (!text(event.venue?.name)) errors.push('A published venue name is required.');
  if (event.venue?.mode !== 'ONLINE' && !text(event.venue?.address)) {
    errors.push('A published venue address is required for an in-person hearing.');
  }
  if (event.venue?.mode === 'ONLINE' && !isHttpsUrl(event.venue?.onlineUrl)) {
    errors.push('An online hearing requires a valid https:// joining link.');
  }
  if (!Array.isArray(event.eligibility) || asNonEmptyArray(event.eligibility).length === 0) {
    errors.push('Published eligibility information is required.');
  }
  if (!text(event.registration?.instructions)) {
    errors.push('Published registration instructions are required.');
  }
  if (!text(event.officialSource?.name)) errors.push('The official source name is required.');
  if (!isGovernmentSourceUrl(event.officialSource?.url)) {
    errors.push('The official source must be an https:// *.gov.in or *.nic.in URL.');
  }
  if (!isValidDateKey(event.lastVerifiedDate)) {
    errors.push('A valid last-verified date is required.');
  } else if (toDateKey(event.lastVerifiedDate) > resolveReferenceDate(referenceDate)) {
    errors.push('The last-verified date cannot be in the future.');
  }
  if (event.verificationStatus !== VERIFICATION_STATUS.VERIFIED) {
    errors.push('The event has not been marked as editor-verified.');
  }
  if (event.cancelled === true) {
    warnings.push('The authority has marked this event as cancelled.');
  }

  const sourceHost = (() => {
    try {
      return new URL(event.officialSource?.url).hostname.toLowerCase();
    } catch {
      return null;
    }
  })();

  const freshness = getEventFreshness(event, referenceDate);
  if (freshness.isStale) {
    warnings.push(
      `The official source was last checked ${freshness.daysSinceVerified} days ago. Re-check it before travelling.`,
    );
  }

  return {
    isValid: errors.length === 0,
    isOfficial: errors.length === 0,
    errors,
    warnings,
    sourceHost,
    lastVerifiedDate: toDateKey(event.lastVerifiedDate),
    freshness,
  };
}

/**
 * Freshness of the human verification of an official source.
 */
export function getEventFreshness(event, referenceDate = new Date()) {
  const refKey = resolveReferenceDate(referenceDate);
  const lastVerified = toDateKey(event?.lastVerifiedDate);

  if (!lastVerified) {
    return {
      tier: 'unverified',
      isStale: true,
      requiresReview: true,
      daysSinceVerified: null,
      label: 'Official source not verified',
    };
  }

  const daysSinceVerified = Math.max(
    0,
    daysBetweenDateKeys(lastVerified, refKey) ?? 0,
  );

  if (daysSinceVerified > SOURCE_REVIEW_REQUIRED_AFTER_DAYS) {
    return {
      tier: 'stale',
      isStale: true,
      requiresReview: true,
      daysSinceVerified,
      label: `Source stale — last checked ${daysSinceVerified} days ago`,
    };
  }

  if (daysSinceVerified > SOURCE_STALE_AFTER_DAYS) {
    return {
      tier: 'aging',
      isStale: false,
      requiresReview: true,
      daysSinceVerified,
      label: `Source needs a fresh check (${daysSinceVerified} days old)`,
    };
  }

  return {
    tier: 'fresh',
    isStale: false,
    requiresReview: false,
    daysSinceVerified,
    label: daysSinceVerified === 0 ? 'Verified today' : `Verified ${daysSinceVerified} days ago`,
  };
}

export function getEventDateStatus(event, referenceDate = new Date()) {
  const refKey = resolveReferenceDate(referenceDate);
  const eventKey = toDateKey(event?.eventDate);
  if (!eventKey) return HEARING_STATUS.PENDING_VERIFICATION;

  const difference = daysBetweenDateKeys(refKey, eventKey);
  if (difference === null) return HEARING_STATUS.PENDING_VERIFICATION;
  if (difference < 0) return HEARING_STATUS.EXPIRED;
  if (difference === 0) return HEARING_STATUS.TODAY;
  return HEARING_STATUS.UPCOMING;
}

export function getEventStatus(event, referenceDate = new Date()) {
  return decorateEvent(event, referenceDate).status;
}

export function isEventExpired(event, referenceDate = new Date()) {
  return getEventDateStatus(event, referenceDate) === HEARING_STATUS.EXPIRED;
}

/**
 * Adds computed verification, status, and freshness fields without mutating the
 * source record.
 */
export function decorateEvent(event, referenceDate = new Date()) {
  const verification = validateOfficialEventSource(event, referenceDate);
  const dateStatus = getEventDateStatus(event, referenceDate);
  const freshness = getEventFreshness(event, referenceDate);
  const cancelled =
    event?.cancelled === true || event?.statusOverride === HEARING_STATUS.CANCELLED;
  const status = cancelled
    ? HEARING_STATUS.CANCELLED
    : verification.isOfficial
      ? dateStatus
      : HEARING_STATUS.PENDING_VERIFICATION;

  return {
    ...event,
    status,
    dateStatus,
    statusLabel: HEARING_STATUS_LABELS[status] || status,
    isOfficial: verification.isOfficial,
    isExpired: dateStatus === HEARING_STATUS.EXPIRED,
    isCancelled: cancelled,
    verification,
    freshness,
    daysUntilEvent: daysBetweenDateKeys(
      resolveReferenceDate(referenceDate),
      toDateKey(event?.eventDate),
    ),
    sourceHost: verification.sourceHost,
    officialSourceUrl: event?.officialSource?.url || null,
    lastVerifiedDate: toDateKey(event?.lastVerifiedDate),
  };
}

/**
 * Pure query helper usable with seed records or a test fixture.
 */
export function queryEvents(events = [], filters = {}) {
  const referenceDate = filters.referenceDate || new Date();
  const {
    state = '',
    district = '',
    eventType = '',
    issueCategory = '',
    authority = '',
    searchQuery = '',
    status = '',
    includeExpired = false,
    includeUnverified = false,
    includeStale = true,
  } = filters;

  const targetState = clean(state);
  const targetDistrict = clean(district);
  const targetType = clean(eventType);
  const targetCategory = clean(issueCategory);
  const targetAuthority = clean(authority);
  const targetQuery = clean(searchQuery);

  const results = [];

  for (const event of events) {
    const decorated = decorateEvent(event, referenceDate);

    if (!includeUnverified && !decorated.isOfficial) continue;
    if (!includeExpired && decorated.isExpired) continue;
    if (!includeStale && decorated.freshness?.isStale) continue;
    if (status && decorated.status !== status) continue;
    if (targetState && clean(event.jurisdiction?.state) !== targetState) continue;
    if (targetDistrict && clean(event.jurisdiction?.district) !== targetDistrict) continue;
    if (targetType && clean(event.eventType) !== targetType) continue;
    if (targetAuthority && !clean(event.authority).includes(targetAuthority)) continue;

    if (targetCategory) {
      const categories = Array.isArray(event.issueCategories)
        ? event.issueCategories.map((item) => clean(item))
        : [];
      if (!categories.includes(targetCategory)) continue;
      const category = categoryFor(issueCategory);
      if (category && !categories.includes(clean(category.id))) continue;
    }

    if (targetQuery) {
      const searchable = [
        event.title,
        event.authority,
        event.department,
        event.jurisdiction?.district,
        event.jurisdiction?.tehsil,
        event.venue?.name,
        event.venue?.address,
        ...(Array.isArray(event.issueCategories) ? event.issueCategories : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(targetQuery)) continue;
    }

    results.push(decorated);
  }

  return results.sort((a, b) => {
    const aDate = toDateKey(a.eventDate) || '';
    const bDate = toDateKey(b.eventDate) || '';
    return aDate.localeCompare(bDate) || String(a.title).localeCompare(String(b.title));
  });
}

/**
 * Convenience helper for the official, non-expired listing.
 */
export function listUpcomingEvents(filters = {}, events = UP_JAN_SUNWAI_EVENTS) {
  return queryEvents(events, { ...filters, includeExpired: false });
}

export function getEventById(
  id,
  events = [...UP_JAN_SUNWAI_EVENTS, ...UP_UNVERIFIED_EVENT_SUBMISSIONS],
  referenceDate = new Date(),
) {
  const event = events.find((item) => item.id === id);
  return event ? decorateEvent(event, referenceDate) : null;
}

export function getDistricts(events = UP_JAN_SUNWAI_EVENTS) {
  return [...new Set(events.map((event) => event.jurisdiction?.district).filter(Boolean))].sort();
}

export function getIssueCategoryOptions() {
  return ISSUE_CATEGORY_OPTIONS.map((category) => ({ ...category }));
}

/**
 * Builds a preparation checklist for an event and issue category.
 */
export function buildPreparationChecklist(event, options = {}) {
  if (!event || typeof event !== 'object') {
    throw new Error('A valid event is required to build a preparation checklist.');
  }

  const category = inferIssueCategory(event, options.issueCategory);
  const priorComplaints = Array.isArray(options.priorComplaints)
    ? options.priorComplaints.filter(Boolean)
    : options.priorComplaints
      ? [options.priorComplaints]
      : [];
  const attachments = Array.isArray(options.attachments) ? options.attachments.filter(Boolean) : [];
  const eventRequirements = asNonEmptyArray(event.requiredDocuments);

  const groups = [];

  groups.push({
    id: 'event_notice',
    title: 'Official notice and registration',
    items: [
      {
        id: 'carry-notice-copy',
        label: 'Printed copy or screenshot of the official notice',
        description:
          'Keep the official source URL and last-verified date with the copy so the desk can match your submission to the correct notice.',
        required: true,
        source: 'OFFICIAL_EVENT_NOTICE',
      },
      {
        id: 'confirm-registration',
        label: 'Confirm registration instructions before travelling',
        description:
          text(event.registration?.instructions) ||
          'No registration instructions are available. Do not assume an appointment exists.',
        required: true,
        source: 'OFFICIAL_EVENT_NOTICE',
      },
    ],
  });

  if (eventRequirements.length > 0) {
    groups.push({
      id: 'event_requirements',
      title: 'Requirements published with this event',
      items: eventRequirements.map((requirement, index) => ({
        id: `event-requirement-${index + 1}`,
        label: requirement,
        description: 'Published with the event. Confirm the current requirement at the venue.',
        required: true,
        source: 'OFFICIAL_EVENT_NOTICE',
      })),
    });
  }

  groups.push({
    id: 'identity_and_copies',
    title: 'Identity, originals, and copies',
    items: [
      {
        id: 'photo-id',
        label: 'Government photo ID — original and two self-attested copies',
        description:
          'Bring the original for visual verification and keep at least two copies. Mask Aadhaar or other identity numbers on copies you leave behind unless the desk specifically requires them.',
        required: true,
        source: 'GENERAL_GUIDANCE',
      },
      {
        id: 'address-proof',
        label: 'Local address or eligibility proof, if the notice requires it',
        description:
          'Do not assume that an address proof is required if the published eligibility notice does not ask for it.',
        required: false,
        source: 'GENERAL_GUIDANCE',
      },
      {
        id: 'document-copies',
        label: 'Two sets of copies of the documents that support your submission',
        description:
          'Keep originals separate from the copies you submit. Number each attachment so it can be referenced in the hearing note.',
        required: true,
        source: 'GENERAL_GUIDANCE',
      },
    ],
  });

  groups.push({
    id: 'facts_and_chronology',
    title: 'Facts and chronology',
    items: [
      {
        id: 'chronology',
        label: 'Write a dated chronology, oldest event first',
        description:
          'Use only dates and facts you can support with your own records. Do not invent an incident, a date, or a legal provision.',
        required: true,
        source: 'CITIZEN_RECORD',
      },
      {
        id: 'issue_category_note',
        label: `Keep the submission focused on: ${category.label}`,
        description: category.guidance,
        required: true,
        source: 'GENERAL_GUIDANCE',
      },
    ],
  });

  groups.push({
    id: 'prior_references',
    title: 'Prior complaints and references',
    items:
      priorComplaints.length > 0
        ? priorComplaints.map((complaint, index) => {
            const reference =
              typeof complaint === 'string'
                ? complaint
                : complaint.reference || complaint.id || complaint.number || '';
            const date = typeof complaint === 'object' ? complaint.date : '';
            const office = typeof complaint === 'object' ? complaint.office : '';
            return {
              id: `prior-reference-${index + 1}`,
              label: `Prior complaint / application reference ${index + 1}: ${
                text(reference) || PLACEHOLDER
              }`,
              description: [date ? `Date: ${text(date)}` : '', office ? `Office: ${text(office)}` : '']
                .filter(Boolean)
                .join(' • ') || 'Keep the original acknowledgement with this reference.',
              required: true,
              source: 'CITIZEN_RECORD',
            };
          })
        : [
            {
              id: 'prior-reference-none',
              label: 'List any prior complaint / application reference, or write “None”',
              description:
                'If you do not have a reference, write “None”. Do not invent a reference number or assume that an earlier complaint was registered.',
              required: true,
              source: 'CITIZEN_RECORD',
            },
          ],
  });

  groups.push({
    id: 'requested_remedy',
    title: 'Requested remedy',
    items: [
      {
        id: 'specific-remedy',
        label: 'Write one or two specific outcomes you are asking for',
        description:
          'For example: “Issue a written status of application X” or “Inspect the drain at location Y”. Avoid vague demands or claims about compensation that you cannot support.',
        required: true,
        source: 'CITIZEN_RECORD',
      },
    ],
  });

  groups.push({
    id: 'category_documents',
    title: `Commonly relevant records for ${category.label}`,
    items: category.commonDocuments.map((document, index) => ({
      id: `category-document-${index + 1}`,
      label: document,
      description:
        'Commonly relevant record, not a universal requirement. The event notice takes precedence.',
      required: false,
      source: 'GENERAL_GUIDANCE',
    })),
  });

  groups.push({
    id: 'attachments_and_acknowledgement',
    title: 'Attachment index and acknowledgement',
    items: [
      {
        id: 'attachment-index',
        label: attachments.length
          ? `Number the ${attachments.length} attachment(s) as A1, A2, A3…`
          : 'Number every attachment as A1, A2, A3…',
        description:
          'Write the attachment number on the copy and repeat the same number in the hearing note so nothing is separated from your submission.',
        required: true,
        source: 'CITIZEN_RECORD',
      },
      {
        id: 'ask-for-acknowledgement',
        label: 'Ask for a written acknowledgement and record the exact reference',
        description:
          'If the desk registers your complaint, ask for the acknowledgement or diary number in writing. If no number is issued, record that fact instead of inventing one.',
        required: true,
        source: 'GENERAL_GUIDANCE',
      },
      {
        id: 'follow-up-date',
        label: 'Set a realistic follow-up date before leaving the venue',
        description:
          'Record the next action and a follow-up date in the private follow-up section. Attendance alone is not a resolution.',
        required: true,
        source: 'GENERAL_GUIDANCE',
      },
    ],
  });

  const items = groups.flatMap((group) => group.items);
  return {
    eventId: event.id,
    issueCategory: category.id,
    issueCategoryLabel: category.label,
    groups,
    items,
    requiredCount: items.filter((item) => item.required).length,
    sourceNotice: event.officialSource?.name || 'Official source not recorded',
    disclaimer: PREPARATION_DISCLAIMER,
  };
}

/**
 * Builds a numbered attachment index.
 */
export function buildAttachmentIndex(attachments = []) {
  const items = (Array.isArray(attachments) ? attachments : [])
    .map((attachment, index) => {
      if (typeof attachment === 'string') {
        return {
          id: `A${index + 1}`,
          label: text(attachment, 240),
          date: '',
          pages: null,
          description: '',
        };
      }
      if (!attachment || typeof attachment !== 'object') return null;
      const label = text(attachment.label || attachment.name, 240);
      if (!label) return null;
      return {
        id: `A${index + 1}`,
        label,
        date: isValidDateKey(attachment.date) ? attachment.date : '',
        pages:
          Number.isFinite(Number(attachment.pages)) && Number(attachment.pages) > 0
            ? Number(attachment.pages)
            : null,
        description: text(attachment.description, MAX_SHORT_TEXT),
      };
    })
    .filter(Boolean)
    .slice(0, 50);

  const totalPages = items.reduce((sum, item) => sum + (item.pages || 0), 0);
  return {
    items,
    totalPages,
    textLines: items.map((item) => {
      const meta = [
        item.date ? `dated ${item.date}` : '',
        item.pages ? `${item.pages} page(s)` : '',
      ]
        .filter(Boolean)
        .join(', ');
      return `${item.id} — ${item.label}${meta ? ` (${meta})` : ''}${
        item.description ? `: ${item.description}` : ''
      }`;
    }),
  };
}

const chronologyLines = (chronology) => {
  if (Array.isArray(chronology)) {
    return chronology
      .map((entry) => {
        if (typeof entry === 'string') return text(entry, MAX_SHORT_TEXT);
        if (!entry || typeof entry !== 'object') return '';
        const date = entry.date ? `${text(entry.date, 40)} — ` : '';
        return `${date}${text(entry.description || entry.event || entry.text, MAX_SHORT_TEXT)}`.trim();
      })
      .filter(Boolean);
  }
  return String(chronology || '')
    .split('\n')
    .map((line) => text(line, MAX_SHORT_TEXT))
    .filter(Boolean);
};

/**
 * Generates an editable hearing note with citizen-provided facts and placeholders.
 * Never invents facts or legal citations.
 */
export function generateHearingNote({
  event,
  issueCategory,
  citizenName = '',
  chronology = '',
  priorComplaints = [],
  requestedRemedy = '',
  additionalNotes = '',
  attachments = [],
  referenceDate = new Date(),
} = {}) {
  if (!event || typeof event !== 'object') {
    throw new Error('A valid event is required to generate a hearing note.');
  }

  const category = inferIssueCategory(event, issueCategory);
  const attachmentIndex = buildAttachmentIndex(attachments);
  const linesOfChronology = chronologyLines(chronology);

  const priorLines = Array.isArray(priorComplaints)
    ? priorComplaints
        .map((p) => {
          if (typeof p === 'string') return text(p);
          if (p && typeof p === 'object') {
            return [p.reference || p.number, p.date ? `Date: ${p.date}` : '', p.office ? `Office: ${p.office}` : '']
              .filter(Boolean)
              .join(' • ');
          }
          return '';
        })
        .filter(Boolean)
    : [text(priorComplaints)].filter(Boolean);

  const sections = [
    {
      title: 'Hearing Details',
      content: [
        `Event: ${event.title || PLACEHOLDER}`,
        `Authority: ${event.authority || PLACEHOLDER}`,
        `Date: ${formatDate(event.eventDate)}`,
        `Venue: ${event.venue?.name || ''} ${event.venue?.address || ''}`.trim(),
        `Official Source: ${event.officialSource?.name || ''} (${event.officialSource?.url || ''})`,
      ],
    },
    {
      title: 'Citizen Information',
      content: [
        `Name of Citizen: ${text(citizenName) || '[Name of Citizen / Applicant]'}`,
        `Issue Category: ${category.label}`,
      ],
    },
    {
      title: 'Brief Chronology of Facts',
      content:
        linesOfChronology.length > 0
          ? linesOfChronology
          : ['[Enter dated chronology: Year-Month-Date — Description of factual event]'],
    },
    {
      title: 'Prior Complaints / References',
      content:
        priorLines.length > 0
          ? priorLines
          : ['[Prior complaint / diary / IGRS number, or state "None"]'],
    },
    {
      title: 'Specific Remedy Requested',
      content: [
        text(requestedRemedy) ||
          '[Specify 1 or 2 concrete remedies requested from the presiding authority]',
      ],
    },
    {
      title: 'Index of Attached Documents',
      content:
        attachmentIndex.textLines.length > 0
          ? attachmentIndex.textLines
          : ['[List attachments as A1, A2... or state "No attachments"]'],
    },
  ];

  if (additionalNotes) {
    sections.push({
      title: 'Additional Notes',
      content: [text(additionalNotes)],
    });
  }

  const textSummary = sections
    .map((s) => `## ${s.title}\n` + s.content.map((c) => `- ${c}`).join('\n'))
    .join('\n\n');

  return {
    eventId: event.id,
    title: `Submission Note for ${event.title}`,
    issueCategory: category.id,
    issueCategoryLabel: category.label,
    citizenName: text(citizenName),
    referenceDate: resolveReferenceDate(referenceDate),
    sections,
    text: textSummary,
    attachmentIndex,
    disclaimer: PREPARATION_DISCLAIMER,
  };
}

/**
 * Derives the follow-up calendar state without changing any recorded outcome.
 */
export function getFollowUpState(record, referenceDate = new Date()) {
  if (!record) {
    return {
      state: FOLLOW_UP_STATE.NOT_RECORDED,
      label: FOLLOW_UP_STATE_LABELS[FOLLOW_UP_STATE.NOT_RECORDED],
      daysUntil: null,
      isClosed: false,
    };
  }

  const completed =
    record.followUpStatus === FOLLOW_UP_STATUS.RESOLVED_CONFIRMED ||
    record.followUpStatus === FOLLOW_UP_STATUS.CLOSED_NO_ACTION ||
    record.resolutionStatus === RESOLUTION_STATUS.RESOLVED_CONFIRMED;

  if (completed) {
    return {
      state: FOLLOW_UP_STATE.COMPLETED,
      label: FOLLOW_UP_STATE_LABELS[FOLLOW_UP_STATE.COMPLETED],
      daysUntil: null,
      isClosed: true,
    };
  }

  const followUpDate = toDateKey(record.followUpDate);
  if (!followUpDate) {
    return {
      state: FOLLOW_UP_STATE.NO_DATE,
      label: FOLLOW_UP_STATE_LABELS[FOLLOW_UP_STATE.NO_DATE],
      daysUntil: null,
      isClosed: false,
    };
  }

  const referenceKey = resolveReferenceDate(referenceDate);
  const daysUntil = daysBetweenDateKeys(referenceKey, followUpDate);

  if (daysUntil === null) {
    return {
      state: FOLLOW_UP_STATE.NO_DATE,
      label: FOLLOW_UP_STATE_LABELS[FOLLOW_UP_STATE.NO_DATE],
      daysUntil: null,
      isClosed: false,
    };
  }

  if (daysUntil < 0) {
    return {
      state: FOLLOW_UP_STATE.OVERDUE,
      label: FOLLOW_UP_STATE_LABELS[FOLLOW_UP_STATE.OVERDUE],
      daysUntil,
      isClosed: false,
    };
  }

  if (daysUntil === 0) {
    return {
      state: FOLLOW_UP_STATE.DUE_TODAY,
      label: FOLLOW_UP_STATE_LABELS[FOLLOW_UP_STATE.DUE_TODAY],
      daysUntil,
      isClosed: false,
    };
  }

  if (daysUntil <= 7) {
    return {
      state: FOLLOW_UP_STATE.DUE_SOON,
      label: FOLLOW_UP_STATE_LABELS[FOLLOW_UP_STATE.DUE_SOON],
      daysUntil,
      isClosed: false,
    };
  }

  return {
    state: FOLLOW_UP_STATE.UPCOMING,
    label: FOLLOW_UP_STATE_LABELS[FOLLOW_UP_STATE.UPCOMING],
    daysUntil,
    isClosed: false,
  };
}

const deriveComplaintRegistrationStatus = (attendanceStatus, acknowledgementType) => {
  if (
    acknowledgementType === ACKNOWLEDGEMENT_TYPE.COMPLAINT_ACKNOWLEDGEMENT ||
    acknowledgementType === ACKNOWLEDGEMENT_TYPE.COMPLAINT_NUMBER
  ) {
    return COMPLAINT_REGISTRATION_STATUS.RECORDED;
  }
  if (attendanceStatus === ATTENDANCE_STATUS.ATTENDED) {
    return COMPLAINT_REGISTRATION_STATUS.NOT_RECORDED;
  }
  return COMPLAINT_REGISTRATION_STATUS.NOT_APPLICABLE;
};

const deriveFollowUpStatus = ({
  attendanceStatus,
  complaintRegistrationStatus,
  resolutionStatus,
  requestedStatus,
}) => {
  if (requestedStatus) return requestedStatus;
  if (resolutionStatus === RESOLUTION_STATUS.RESOLVED_CONFIRMED) {
    return FOLLOW_UP_STATUS.RESOLVED_CONFIRMED;
  }
  if (attendanceStatus === ATTENDANCE_STATUS.NOT_ATTENDED) {
    return FOLLOW_UP_STATUS.MISSED_HEARING;
  }
  if (complaintRegistrationStatus === COMPLAINT_REGISTRATION_STATUS.RECORDED) {
    return FOLLOW_UP_STATUS.COMPLAINT_REGISTERED;
  }
  if (attendanceStatus === ATTENDANCE_STATUS.ATTENDED) {
    return FOLLOW_UP_STATUS.ATTENDED_AWAITING_ACKNOWLEDGEMENT;
  }
  return FOLLOW_UP_STATUS.PENDING;
};

const decorateFollowUpRecord = (record) => {
  const followUpState = getFollowUpState(record);
  return {
    ...record,
    followUpState,
    followUpStateLabel: followUpState.label,
    followUpStatusLabel:
      FOLLOW_UP_STATUS_LABELS[record.followUpStatus] || record.followUpStatus,
    attendanceStatusLabel:
      ATTENDANCE_STATUS_LABELS[record.attendanceStatus] || record.attendanceStatus,
    acknowledgementTypeLabel:
      ACKNOWLEDGEMENT_TYPE_LABELS[record.acknowledgementType] || record.acknowledgementType,
    complaintRegistrationStatusLabel:
      COMPLAINT_REGISTRATION_STATUS_LABELS[record.complaintRegistrationStatus] ||
      record.complaintRegistrationStatus,
    isResolved: record.resolutionStatus === RESOLUTION_STATUS.RESOLVED_CONFIRMED,
    outcomeNotice: OUTCOME_DISTINCTION_NOTICE,
  };
};

/**
 * Private, owner-scoped store. It persists only local browser state.
 */
export class UpJanSunwaiStore {
  constructor({ storage = getDefaultStorage(), persist = true } = {}) {
    this.storage = storage;
    this.persistEnabled = Boolean(persist && storage);
    this.events = new Map();
    this.unverifiedEvents = new Map();
    this.eventOverrides = new Map();
    this.preparations = new Map();
    this.followUps = new Map();
    this.corrections = new Map();
    this.expiryLog = [];
    this.expiredIds = new Set();
    this._hydrate();
  }

  reset() {
    this.events = new Map();
    this.unverifiedEvents = new Map();
    this.eventOverrides = new Map();
    this.preparations = new Map();
    this.followUps = new Map();
    this.corrections = new Map();
    this.expiryLog = [];
    this.expiredIds = new Set();
    this._loadSeed();
    this._persist();
  }

  _loadSeed() {
    UP_JAN_SUNWAI_EVENTS.forEach((event) => {
      this.events.set(event.id, clone(event));
    });
    UP_UNVERIFIED_EVENT_SUBMISSIONS.forEach((event) => {
      this.unverifiedEvents.set(event.id, clone(event));
    });
  }

  _hydrate() {
    this._loadSeed();

    if (!this.persistEnabled) return;

    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);

      if (parsed.preparations && typeof parsed.preparations === 'object') {
        Object.entries(parsed.preparations).forEach(([key, value]) => {
          this.preparations.set(key, value);
        });
      }
      if (parsed.followUps && typeof parsed.followUps === 'object') {
        Object.entries(parsed.followUps).forEach(([key, value]) => {
          this.followUps.set(key, value);
        });
      }
      if (parsed.corrections && typeof parsed.corrections === 'object') {
        Object.entries(parsed.corrections).forEach(([key, value]) => {
          this.corrections.set(key, value);
        });
      }
      if (Array.isArray(parsed.expiryLog)) {
        this.expiryLog = parsed.expiryLog;
      }
      if (Array.isArray(parsed.expiredIds)) {
        parsed.expiredIds.forEach((id) => this.expiredIds.add(id));
      }
      if (parsed.eventOverrides && typeof parsed.eventOverrides === 'object') {
        Object.entries(parsed.eventOverrides).forEach(([id, event]) => {
          this.eventOverrides.set(id, event);
          this.events.set(id, event);
        });
      }
    } catch {
      // A corrupt local store is treated as empty; the official calendar remains usable.
    }
  }

  _persist() {
    if (!this.persistEnabled) return;
    try {
      this.storage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          preparations: Object.fromEntries(this.preparations),
          followUps: Object.fromEntries(this.followUps),
          corrections: Object.fromEntries(this.corrections),
          expiryLog: this.expiryLog,
          expiredIds: [...this.expiredIds],
          eventOverrides: Object.fromEntries(this.eventOverrides),
        }),
      );
    } catch {
      // Private local persistence is best effort; never break the public calendar.
    }
  }

  listEvents(filters = {}) {
    const includeUnverified = Boolean(filters.includeUnverified);
    const events = [
      ...this.events.values(),
      ...(includeUnverified ? this.unverifiedEvents.values() : []),
    ];
    return queryEvents(events, filters);
  }

  getEvent(id, { referenceDate = new Date(), includeUnverified = true } = {}) {
    if (!id) return null;
    const verified = this.events.get(id);
    if (verified) return decorateEvent(verified, referenceDate);
    if (!includeUnverified) return null;
    const unverified = this.unverifiedEvents.get(id);
    return unverified ? decorateEvent(unverified, referenceDate) : null;
  }

  getOfficialEvent(id, options = {}) {
    return this.getEvent(id, { ...options, includeUnverified: false });
  }

  addEvent(event, actorRole = 'CITIZEN') {
    if (!['ADMIN', 'EDITOR', 'MODERATOR'].includes(String(actorRole).toUpperCase())) {
      throw new Error('Authorization Error: an editor role is required to add a hearing event.');
    }
    const referenceDate = new Date();
    const verification = validateOfficialEventSource(event, referenceDate);
    const isVerified =
      event.verificationStatus === VERIFICATION_STATUS.VERIFIED && verification.isValid;
    const target = isVerified ? this.events : this.unverifiedEvents;
    if (!event.id) throw new Error('A stable event id is required.');
    if (target.has(event.id) || this.events.has(event.id) || this.unverifiedEvents.has(event.id)) {
      throw new Error('An event with this id already exists.');
    }
    target.set(event.id, clone(event));
    this._persist();
    return decorateEvent(event, referenceDate);
  }

  /**
   * Expires past events and writes an audit entry.
   */
  expireStaleEvents(referenceDate = new Date()) {
    const referenceKey = resolveReferenceDate(referenceDate);
    const expired = this.listEvents({
      includeExpired: true,
      referenceDate: referenceKey,
    }).filter((event) => event.isExpired);

    const newlyExpired = expired.filter((event) => !this.expiredIds.has(event.id));
    newlyExpired.forEach((event) => {
      this.expiredIds.add(event.id);
      this.expiryLog.push({
        eventId: event.id,
        expiredAt: new Date().toISOString(),
        referenceDate: referenceKey,
        reason: 'EVENT_DATE_PASSED',
        previousStatus: event.dateStatus,
      });
    });
    if (newlyExpired.length > 0) this._persist();

    return {
      checkedAt: new Date().toISOString(),
      referenceDate: referenceKey,
      expiredCount: expired.length,
      newlyExpiredCount: newlyExpired.length,
      newlyExpired,
      expiredEvents: expired,
    };
  }

  savePreparationDraft(userId, eventId, data = {}) {
    if (!text(userId)) throw new Error('Authorization Error: an authenticated citizen is required.');
    if (!text(eventId)) throw new Error('A valid event id is required.');
    if (!this.getEvent(eventId)) throw new Error('Hearing event not found.');
    const category = inferIssueCategory(this.getEvent(eventId), data.issueCategory);

    const key = `${userId}::${eventId}`;
    const existing = this.preparations.get(key);
    const draft = {
      id: existing?.id || makeId('upjs_prep'),
      ownerId: userId,
      eventId,
      issueCategory: category.id,
      citizenName: text(data.citizenName, 160),
      chronology: text(data.chronology, MAX_LONG_TEXT),
      priorComplaints: Array.isArray(data.priorComplaints)
        ? clone(data.priorComplaints).slice(0, 20)
        : text(data.priorComplaints, MAX_MEDIUM_TEXT),
      requestedRemedy: text(data.requestedRemedy, MAX_MEDIUM_TEXT),
      additionalNotes: text(data.additionalNotes, MAX_MEDIUM_TEXT),
      hearingNote: text(data.hearingNote, MAX_LONG_TEXT),
      attachments: buildAttachmentIndex(data.attachments).items,
      checklistState:
        data.checklistState && typeof data.checklistState === 'object'
          ? clone(data.checklistState)
          : {},
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    this.preparations.set(key, draft);
    this._persist();
    return clone(draft);
  }

  getPreparationDraft(userId, eventId) {
    if (!text(userId) || !text(eventId)) return null;
    const draft = this.preparations.get(`${userId}::${eventId}`);
    return draft ? clone(draft) : null;
  }

  deletePreparationDraft(userId, eventId) {
    if (!text(userId) || !text(eventId)) return false;
    const deleted = this.preparations.delete(`${userId}::${eventId}`);
    if (deleted) this._persist();
    return deleted;
  }

  recordFollowUp(userId, eventIdOrPayload, maybePayload = {}) {
    if (!text(userId)) throw new Error('Authorization Error: an authenticated citizen is required.');
    const data =
      eventIdOrPayload && typeof eventIdOrPayload === 'object'
        ? { ...eventIdOrPayload }
        : { ...maybePayload, eventId: eventIdOrPayload };

    const eventId = text(data.eventId);
    if (!eventId) throw new Error('A valid event id is required.');
    const event = this.getEvent(eventId);
    if (!event) throw new Error('Hearing event not found.');

    const attendanceStatus = String(data.attendanceStatus || '').toUpperCase();
    if (!Object.values(ATTENDANCE_STATUS).includes(attendanceStatus)) {
      throw new Error('A valid attendance status is required.');
    }

    const acknowledgementType = String(
      data.acknowledgementType || ACKNOWLEDGEMENT_TYPE.NONE,
    ).toUpperCase();
    if (!Object.values(ACKNOWLEDGEMENT_TYPE).includes(acknowledgementType)) {
      throw new Error('A valid acknowledgement type is required.');
    }

    const followUpDate = data.followUpDate ? toDateKey(data.followUpDate) : '';
    if (data.followUpDate && !followUpDate) {
      throw new Error('Follow-up date must be a valid date.');
    }

    const explicitRegistration = data.complaintRegistrationStatus
      ? String(data.complaintRegistrationStatus).toUpperCase()
      : null;
    if (
      explicitRegistration &&
      !Object.values(COMPLAINT_REGISTRATION_STATUS).includes(explicitRegistration)
    ) {
      throw new Error('A valid complaint registration status is required.');
    }
    const derivedRegistration = deriveComplaintRegistrationStatus(
      attendanceStatus,
      acknowledgementType,
    );
    if (
      explicitRegistration === COMPLAINT_REGISTRATION_STATUS.RECORDED &&
      derivedRegistration !== COMPLAINT_REGISTRATION_STATUS.RECORDED
    ) {
      throw new Error(
        'A complaint cannot be marked registered without a complaint acknowledgement type or complaint number.',
      );
    }
    const complaintRegistrationStatus =
      explicitRegistration || derivedRegistration;

    const resolutionStatus = String(
      data.resolutionStatus || RESOLUTION_STATUS.NOT_CONFIRMED,
    ).toUpperCase();
    if (!Object.values(RESOLUTION_STATUS).includes(resolutionStatus)) {
      throw new Error('A valid resolution status is required.');
    }
    if (resolutionStatus === RESOLUTION_STATUS.RESOLVED_CONFIRMED) {
      if (!text(data.resolutionReference)) {
        throw new Error(
          'A written resolution reference is required before a matter can be marked resolved.',
        );
      }
      if (!isValidDateKey(data.resolvedDate)) {
        throw new Error('A valid resolution date is required before a matter can be marked resolved.');
      }
    }

    const requestedFollowUpStatus = data.followUpStatus
      ? String(data.followUpStatus).toUpperCase()
      : '';
    if (
      requestedFollowUpStatus &&
      !Object.values(FOLLOW_UP_STATUS).includes(requestedFollowUpStatus)
    ) {
      throw new Error('A valid follow-up status is required.');
    }
    if (
      requestedFollowUpStatus === FOLLOW_UP_STATUS.RESOLVED_CONFIRMED &&
      resolutionStatus !== RESOLUTION_STATUS.RESOLVED_CONFIRMED
    ) {
      throw new Error('A follow-up cannot be marked resolved without a written resolution reference.');
    }

    const followUpStatus = deriveFollowUpStatus({
      attendanceStatus,
      complaintRegistrationStatus,
      resolutionStatus,
      requestedStatus: requestedFollowUpStatus,
    });

    const record = {
      id: makeId('upjs_follow'),
      ownerId: userId,
      eventId,
      eventTitle: event.title,
      eventDate: event.eventDate,
      attendanceStatus,
      acknowledgementType,
      acknowledgementNumber: text(data.acknowledgementNumber, 120),
      officerOrDesk: text(data.officerOrDesk, 200),
      nextAction: text(data.nextAction, MAX_SHORT_TEXT),
      followUpDate,
      followUpStatus,
      complaintRegistrationStatus,
      resolutionStatus,
      resolutionReference: text(data.resolutionReference, 200),
      resolvedDate: isValidDateKey(data.resolvedDate) ? data.resolvedDate : '',
      notes: text(data.notes, MAX_MEDIUM_TEXT),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      outcomeNotice: OUTCOME_DISTINCTION_NOTICE,
    };

    this.followUps.set(record.id, record);
    this._persist();
    return decorateFollowUpRecord(clone(record));
  }

  getFollowUpRecord(recordId, userId) {
    if (!text(recordId) || !text(userId)) {
      throw new Error('A valid record and authenticated citizen are required.');
    }
    const record = this.followUps.get(recordId);
    if (!record) return null;
    if (record.ownerId !== userId) {
      throw new Error('Access Denied: this follow-up record belongs to another citizen.');
    }
    return decorateFollowUpRecord(clone(record));
  }

  listFollowUpRecords(userId, { referenceDate = new Date(), eventId = '' } = {}) {
    if (!text(userId)) return [];
    return [...this.followUps.values()]
      .filter((record) => record.ownerId === userId)
      .filter((record) => !eventId || record.eventId === eventId)
      .map((record) => {
        const decorated = decorateFollowUpRecord(clone(record));
        return {
          ...decorated,
          followUpState: getFollowUpState(record, referenceDate),
          followUpStateLabel: getFollowUpState(record, referenceDate).label,
        };
      })
      .sort((a, b) => {
        const dateCompare = String(a.followUpDate || '9999-99-99').localeCompare(
          String(b.followUpDate || '9999-99-99'),
        );
        return dateCompare || String(b.createdAt).localeCompare(String(a.createdAt));
      });
  }

  updateFollowUpRecord(recordId, userId, updates = {}) {
    if (!text(recordId) || !text(userId)) {
      throw new Error('A valid record and authenticated citizen are required.');
    }
    const existing = this.followUps.get(recordId);
    if (!existing) throw new Error('Follow-up record not found.');
    if (existing.ownerId !== userId) {
      throw new Error('Access Denied: this follow-up record belongs to another citizen.');
    }

    if (
      updates.resolutionStatus &&
      String(updates.resolutionStatus).toUpperCase() === RESOLUTION_STATUS.RESOLVED_CONFIRMED
    ) {
      return this.recordResolution(recordId, userId, {
        resolutionReference: updates.resolutionReference,
        resolvedDate: updates.resolvedDate,
        notes: updates.notes || existing.notes,
      });
    }

    const attendanceStatus = String(
      updates.attendanceStatus || existing.attendanceStatus,
    ).toUpperCase();
    if (!Object.values(ATTENDANCE_STATUS).includes(attendanceStatus)) {
      throw new Error('A valid attendance status is required.');
    }

    const acknowledgementType = String(
      updates.acknowledgementType || existing.acknowledgementType || ACKNOWLEDGEMENT_TYPE.NONE,
    ).toUpperCase();
    if (!Object.values(ACKNOWLEDGEMENT_TYPE).includes(acknowledgementType)) {
      throw new Error('A valid acknowledgement type is required.');
    }

    const followUpDate =
      updates.followUpDate === ''
        ? ''
        : updates.followUpDate
          ? toDateKey(updates.followUpDate)
          : existing.followUpDate;
    if (updates.followUpDate && !followUpDate) {
      throw new Error('Follow-up date must be a valid date.');
    }

    const complaintRegistrationStatus = deriveComplaintRegistrationStatus(
      attendanceStatus,
      acknowledgementType,
    );

    const requestedStatus = updates.followUpStatus
      ? String(updates.followUpStatus).toUpperCase()
      : existing.followUpStatus;
    if (!Object.values(FOLLOW_UP_STATUS).includes(requestedStatus)) {
      throw new Error('A valid follow-up status is required.');
    }
    if (requestedStatus === FOLLOW_UP_STATUS.RESOLVED_CONFIRMED) {
      throw new Error('Use the written-resolution recording action to mark a matter resolved.');
    }

    const updated = {
      ...existing,
      attendanceStatus,
      acknowledgementType,
      acknowledgementNumber:
        updates.acknowledgementNumber !== undefined
          ? text(updates.acknowledgementNumber, 120)
          : existing.acknowledgementNumber,
      officerOrDesk:
        updates.officerOrDesk !== undefined
          ? text(updates.officerOrDesk, 200)
          : existing.officerOrDesk,
      nextAction:
        updates.nextAction !== undefined
          ? text(updates.nextAction, MAX_SHORT_TEXT)
          : existing.nextAction,
      followUpDate,
      followUpStatus: requestedStatus,
      complaintRegistrationStatus,
      notes:
        updates.notes !== undefined ? text(updates.notes, MAX_MEDIUM_TEXT) : existing.notes,
      updatedAt: new Date().toISOString(),
      outcomeNotice: OUTCOME_DISTINCTION_NOTICE,
    };

    this.followUps.set(recordId, updated);
    this._persist();
    return decorateFollowUpRecord(clone(updated));
  }

  recordResolution(recordId, userId, { resolutionReference, resolvedDate, notes = '' } = {}) {
    if (!text(recordId) || !text(userId)) {
      throw new Error('A valid record and authenticated citizen are required.');
    }
    const existing = this.followUps.get(recordId);
    if (!existing) throw new Error('Follow-up record not found.');
    if (existing.ownerId !== userId) {
      throw new Error('Access Denied: this follow-up record belongs to another citizen.');
    }
    if (!text(resolutionReference)) {
      throw new Error('A written resolution reference is required before marking a matter resolved.');
    }
    if (!isValidDateKey(resolvedDate)) {
      throw new Error('A valid resolution date is required before marking a matter resolved.');
    }

    const updated = {
      ...existing,
      resolutionStatus: RESOLUTION_STATUS.RESOLVED_CONFIRMED,
      resolutionReference: text(resolutionReference, 200),
      resolvedDate,
      followUpStatus: FOLLOW_UP_STATUS.RESOLVED_CONFIRMED,
      notes: notes !== undefined ? text(notes, MAX_MEDIUM_TEXT) : existing.notes,
      updatedAt: new Date().toISOString(),
      outcomeNotice: OUTCOME_DISTINCTION_NOTICE,
    };

    this.followUps.set(recordId, updated);
    this._persist();
    return decorateFollowUpRecord(clone(updated));
  }

  deleteFollowUpRecord(recordId, userId) {
    if (!text(recordId) || !text(userId)) return false;
    const existing = this.followUps.get(recordId);
    if (!existing) return false;
    if (existing.ownerId !== userId) {
      throw new Error('Access Denied: this follow-up record belongs to another citizen.');
    }
    const deleted = this.followUps.delete(recordId);
    if (deleted) this._persist();
    return deleted;
  }

  getFollowUpSummary(userId, options = {}) {
    const records = this.listFollowUpRecords(userId, options);
    const counts = Object.fromEntries(
      Object.values(FOLLOW_UP_STATE).map((state) => [state, 0]),
    );
    records.forEach((record) => {
      counts[record.followUpState.state] = (counts[record.followUpState.state] || 0) + 1;
    });
    return {
      total: records.length,
      counts,
      records,
    };
  }

  submitSourceCorrection(userId, eventId, payload = {}) {
    if (!text(userId)) throw new Error('Authorization Error: an authenticated citizen is required.');
    const event = this.getEvent(eventId);
    if (!event) throw new Error('Hearing event not found.');

    const field = text(payload.field, 80);
    if (!ALLOWED_CORRECTION_FIELDS.has(field)) {
      throw new Error('Unsupported correction field.');
    }
    const proposedValue = Array.isArray(payload.proposedValue)
      ? asNonEmptyArray(payload.proposedValue)
      : text(payload.proposedValue, MAX_MEDIUM_TEXT);
    if (
      (Array.isArray(proposedValue) && proposedValue.length === 0) ||
      (!Array.isArray(proposedValue) && !proposedValue)
    ) {
      throw new Error('A proposed correction value is required.');
    }
    const reason = text(payload.reason, MAX_MEDIUM_TEXT);
    if (reason.length < 10) {
      throw new Error('Please explain the correction with at least 10 characters.');
    }
    if (field === 'officialSourceUrl' && !isGovernmentSourceUrl(proposedValue)) {
      throw new Error('A proposed official source must be an https:// *.gov.in or *.nic.in URL.');
    }
    if (field === 'eventDate' && !isValidDateKey(proposedValue)) {
      throw new Error('A proposed event date must be a valid YYYY-MM-DD date.');
    }
    if (payload.evidenceUrl && !isHttpsUrl(payload.evidenceUrl)) {
      throw new Error('Evidence URL must be a valid https:// URL.');
    }

    const correction = {
      id: makeId('upjs_correction'),
      eventId: event.id,
      eventTitle: event.title,
      submittedBy: userId,
      field,
      proposedValue: clone(proposedValue),
      reason,
      evidenceUrl: text(payload.evidenceUrl, 600),
      status: 'PENDING_REVIEW',
      submittedAt: new Date().toISOString(),
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: '',
    };

    this.corrections.set(correction.id, correction);
    this._persist();
    return clone(correction);
  }

  listSourceCorrections({ status = '', eventId = '' } = {}) {
    return [...this.corrections.values()]
      .filter((correction) => !status || correction.status === status)
      .filter((correction) => !eventId || correction.eventId === eventId)
      .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))
      .map((correction) => clone(correction));
  }

  reviewSourceCorrection(
    correctionId,
    { reviewerId = 'editor', reviewerRole = 'ADMIN', decision = 'REJECT', note = '' } = {},
  ) {
    const role = String(reviewerRole).toUpperCase();
    if (!['ADMIN', 'MODERATOR', 'EDITOR'].includes(role)) {
      throw new Error('Authorization Error: an editor role is required to review source corrections.');
    }

    const correction = this.corrections.get(correctionId);
    if (!correction) throw new Error('Source correction not found.');
    if (correction.status !== 'PENDING_REVIEW') {
      throw new Error('This source correction has already been reviewed.');
    }

    const normalizedDecision = String(decision).toUpperCase();
    if (!['ACCEPT', 'REJECT'].includes(normalizedDecision)) {
      throw new Error('Review decision must be ACCEPT or REJECT.');
    }

    const event = this.events.get(correction.eventId) || this.unverifiedEvents.get(correction.eventId);
    if (!event) throw new Error('The event for this correction no longer exists.');

    if (normalizedDecision === 'ACCEPT') {
      const previousValue = this._readCorrectionField(event, correction.field);
      this._applyCorrection(event, correction);

      if (correction.field === 'eligibility') {
        event.eligibility = clone(correction.proposedValue);
      }

      event.lastVerifiedDate = toDateKey(new Date());
      event.verificationStatus = VERIFICATION_STATUS.VERIFIED;
      event.verificationNote = `Source correction accepted by ${reviewerId}. Re-check the official notice before travel.`;
      event.revisions = [
        ...(Array.isArray(event.revisions) ? event.revisions : []),
        {
          changedAt: new Date().toISOString(),
          changedBy: reviewerId,
          field: correction.field,
          previousValue: clone(previousValue),
          newValue: clone(correction.proposedValue),
          correctionId: correction.id,
        },
      ];

      if (this.events.has(event.id)) {
        this.eventOverrides.set(event.id, clone(event));
        this.events.set(event.id, event);
      } else {
        this.unverifiedEvents.set(event.id, event);
      }
    }

    const reviewed = {
      ...correction,
      status: normalizedDecision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED',
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString(),
      reviewNote: text(note, MAX_MEDIUM_TEXT),
    };
    this.corrections.set(correctionId, reviewed);
    this._persist();

    return {
      correction: clone(reviewed),
      event: this.getEvent(correction.eventId),
    };
  }

  _readCorrectionField(event, field) {
    switch (field) {
      case 'eventDate':
        return event.eventDate;
      case 'startTime':
        return event.startTime;
      case 'endTime':
        return event.endTime;
      case 'venueName':
        return event.venue?.name;
      case 'venueAddress':
        return event.venue?.address;
      case 'registrationInstructions':
        return event.registration?.instructions;
      case 'officialSourceUrl':
        return event.officialSource?.url;
      case 'eligibility':
        return event.eligibility;
      default:
        return null;
    }
  }

  _applyCorrection(event, correction) {
    const value = correction.proposedValue;
    switch (correction.field) {
      case 'eventDate':
        event.eventDate = value;
        break;
      case 'startTime':
        event.startTime = text(value, 20);
        break;
      case 'endTime':
        event.endTime = text(value, 20);
        break;
      case 'venueName':
        event.venue = { ...(event.venue || {}), name: text(value, 240) };
        break;
      case 'venueAddress':
        event.venue = { ...(event.venue || {}), address: text(value, 400) };
        break;
      case 'registrationInstructions':
        event.registration = {
          ...(event.registration || {}),
          instructions: text(value, MAX_MEDIUM_TEXT),
        };
        break;
      case 'officialSourceUrl':
        event.officialSource = { ...(event.officialSource || {}), url: value };
        break;
      case 'eligibility':
        event.eligibility = clone(value);
        break;
      default:
        break;
    }
  }

  buildPackForUser(userId, eventId, options = {}) {
    const event = this.getEvent(eventId);
    if (!event) throw new Error('Hearing event not found.');
    const includePrivateDetails = Boolean(options.includePrivateDetails);
    const preparation = includePrivateDetails
      ? this.getPreparationDraft(userId, eventId)
      : null;
    const followUp = includePrivateDetails
      ? this.listFollowUpRecords(userId, { eventId })[0] || null
      : null;

    return buildPreparationPack({
      event,
      issueCategory: options.issueCategory || preparation?.issueCategory,
      citizenName: options.citizenName || preparation?.citizenName || '',
      chronology: options.chronology ?? preparation?.chronology ?? '',
      priorComplaints: options.priorComplaints ?? preparation?.priorComplaints ?? [],
      requestedRemedy: options.requestedRemedy ?? preparation?.requestedRemedy ?? '',
      additionalNotes: options.additionalNotes ?? preparation?.additionalNotes ?? '',
      attachments: options.attachments ?? preparation?.attachments ?? [],
      preparation,
      followUpRecord: followUp,
      includePrivateDetails,
      referenceDate: options.referenceDate || new Date(),
    });
  }
}

export const upJanSunwaiStore = new UpJanSunwaiStore();

/**
 * Compiles a printable preparation pack.
 */
export function buildPreparationPack({
  event,
  issueCategory,
  citizenName = '',
  chronology = '',
  priorComplaints = [],
  requestedRemedy = '',
  additionalNotes = '',
  attachments = [],
  preparation = null,
  followUpRecord = null,
  includePrivateDetails = false,
  referenceDate = new Date(),
}) {
  if (!event || typeof event !== 'object') {
    throw new Error('A valid event is required to build a preparation pack.');
  }

  const decorated = decorateEvent(event, referenceDate);
  const effectiveCategory = issueCategory || preparation?.issueCategory;
  const effectiveAttachments =
    (includePrivateDetails && preparation?.attachments?.length
      ? preparation.attachments
      : attachments) || [];
  const effectiveChronology =
    includePrivateDetails && preparation?.chronology
      ? preparation.chronology
      : chronology;
  const effectivePriorComplaints =
    includePrivateDetails && preparation?.priorComplaints
      ? preparation.priorComplaints
      : priorComplaints;
  const effectiveRemedy =
    includePrivateDetails && preparation?.requestedRemedy
      ? preparation.requestedRemedy
      : requestedRemedy;
  const effectiveNotes =
    includePrivateDetails && preparation?.additionalNotes
      ? preparation.additionalNotes
      : additionalNotes;
  const effectiveCitizenName =
    includePrivateDetails && preparation?.citizenName
      ? preparation.citizenName
      : citizenName;

  const checklist = buildPreparationChecklist(decorated, {
    issueCategory: effectiveCategory,
    priorComplaints: effectivePriorComplaints,
    attachments: effectiveAttachments,
  });

  const hearingNote = generateHearingNote({
    event: decorated,
    issueCategory: effectiveCategory,
    citizenName: effectiveCitizenName,
    chronology: effectiveChronology,
    priorComplaints: effectivePriorComplaints,
    requestedRemedy: effectiveRemedy,
    additionalNotes: effectiveNotes,
    attachments: effectiveAttachments,
    referenceDate,
  });

  const attachmentIndex = buildAttachmentIndex(effectiveAttachments);

  return {
    event: decorated,
    issueCategory: effectiveCategory,
    citizenName: effectiveCitizenName,
    checklist,
    hearingNote,
    attachmentIndex,
    followUpRecord: includePrivateDetails ? followUpRecord : null,
    includePrivateDetails: Boolean(includePrivateDetails),
    sourceNotice: decorated.officialSource?.name || 'Official source',
    sourceUrl: decorated.officialSource?.url || '',
    lastVerifiedDate: decorated.lastVerifiedDate,
    disclaimer: PREPARATION_DISCLAIMER,
    outcomeNotice: OUTCOME_DISTINCTION_NOTICE,
  };
}

export function buildPreparationPackHtml(pack) {
  if (!pack || typeof pack !== 'object') return '';

  const {
    event,
    hearingNote,
    attachmentIndex,
    followUpRecord,
    includePrivateDetails,
  } = pack;

  const sectionsHtml = (hearingNote?.sections || [])
    .map(
      (sec) => `
      <section style="margin-bottom: 1.5rem; page-break-inside: avoid;">
        <h3 style="font-size: 1.1rem; border-bottom: 1px solid #ccc; padding-bottom: 0.25rem; margin-bottom: 0.5rem; color: #1e293b;">
          ${escapeHtml(sec.title)}
        </h3>
        <ul style="padding-left: 1.25rem; margin: 0; line-height: 1.6;">
          ${(sec.content || [])
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join('')}
        </ul>
      </section>
    `,
    )
    .join('');

  const attachmentsHtml = (attachmentIndex?.textLines || [])
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join('');

  const followUpHtml =
    includePrivateDetails && followUpRecord
      ? `
    <section style="margin-top: 2rem; border-top: 2px dashed #94a3b8; padding-top: 1rem; page-break-inside: avoid;">
      <h3 style="font-size: 1.1rem; color: #0f172a; margin-bottom: 0.5rem;">Citizen Private Record &amp; Post-Hearing Follow-Up</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
        <tr><td style="padding: 4px; font-weight: bold; width: 35%;">Attendance Status:</td><td style="padding: 4px;">${escapeHtml(followUpRecord.attendanceStatusLabel || followUpRecord.attendanceStatus)}</td></tr>
        <tr><td style="padding: 4px; font-weight: bold;">Acknowledgement Type:</td><td style="padding: 4px;">${escapeHtml(followUpRecord.acknowledgementTypeLabel || followUpRecord.acknowledgementType)}</td></tr>
        <tr><td style="padding: 4px; font-weight: bold;">Acknowledgement Reference:</td><td style="padding: 4px;">${escapeHtml(followUpRecord.acknowledgementNumber || 'None recorded')}</td></tr>
        <tr><td style="padding: 4px; font-weight: bold;">Officer / Desk:</td><td style="padding: 4px;">${escapeHtml(followUpRecord.officerOrDesk || 'Not recorded')}</td></tr>
        <tr><td style="padding: 4px; font-weight: bold;">Next Action:</td><td style="padding: 4px;">${escapeHtml(followUpRecord.nextAction || 'None')}</td></tr>
        <tr><td style="padding: 4px; font-weight: bold;">Follow-Up Date:</td><td style="padding: 4px;">${escapeHtml(formatHearingDate(followUpRecord.followUpDate))}</td></tr>
      </table>
    </section>
    `
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Public Hearing Preparation Pack — ${escapeHtml(event?.title || 'UP Public Hearing')}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 2rem; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; color: #0f172a; }
    .badge { display: inline-block; padding: 0.2rem 0.5rem; background: #e2e8f0; border-radius: 4px; font-size: 0.85rem; margin-top: 0.25rem; }
    .meta-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 1rem; margin: 1rem 0 1.5rem 0; font-size: 0.95rem; }
    .disclaimer-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 0.75rem 1rem; margin-top: 2rem; font-size: 0.85rem; color: #92400e; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <header style="border-bottom: 2px solid #0284c7; padding-bottom: 1rem; margin-bottom: 1.5rem;">
    <h1>${escapeHtml(event?.title || 'Public Hearing Preparation Pack')}</h1>
    <div style="font-size: 1rem; color: #475569;">${escapeHtml(event?.authority || '')}</div>
    <div class="badge">Official Source: ${escapeHtml(pack.sourceNotice)} (${escapeHtml(pack.sourceUrl)})</div>
  </header>

  <div class="meta-box">
    <div><strong>Hearing Date:</strong> ${escapeHtml(formatHearingDate(event?.eventDate))} ${escapeHtml(event?.startTime || '')} - ${escapeHtml(event?.endTime || '')}</div>
    <div><strong>Venue:</strong> ${escapeHtml(event?.venue?.name || '')}, ${escapeHtml(event?.venue?.address || '')}</div>
    <div><strong>Last Verified:</strong> ${escapeHtml(formatHearingDate(pack.lastVerifiedDate))}</div>
  </div>

  ${sectionsHtml}

  ${attachmentsHtml ? `
    <section style="margin-bottom: 1.5rem; page-break-inside: avoid;">
      <h3 style="font-size: 1.1rem; border-bottom: 1px solid #ccc; padding-bottom: 0.25rem; margin-bottom: 0.5rem; color: #1e293b;">
        Attached Records Index
      </h3>
      <ul style="padding-left: 1.25rem; margin: 0; line-height: 1.6;">
        ${attachmentsHtml}
      </ul>
    </section>
  ` : ''}

  ${followUpHtml}

  <div class="disclaimer-box">
    <strong>Important Notice:</strong> ${escapeHtml(pack.disclaimer)}<br />
    <em>${escapeHtml(pack.outcomeNotice)}</em>
  </div>
</body>
</html>`;
}

export function buildPreparationPackText(pack) {
  if (!pack || typeof pack !== 'object') return '';

  const { event, hearingNote, attachmentIndex, followUpRecord, includePrivateDetails } = pack;

  const lines = [
    `============================================================`,
    `UP PUBLIC HEARING PREPARATION PACK`,
    `Event: ${event?.title || ''}`,
    `Authority: ${event?.authority || ''}`,
    `Date: ${formatHearingDate(event?.eventDate)} (${event?.startTime || ''} - ${event?.endTime || ''})`,
    `Venue: ${event?.venue?.name || ''}, ${event?.venue?.address || ''}`,
    `Official Source: ${pack.sourceNotice} (${pack.sourceUrl})`,
    `Last Verified: ${formatHearingDate(pack.lastVerifiedDate)}`,
    `============================================================`,
    ``,
  ];

  (hearingNote?.sections || []).forEach((sec) => {
    lines.push(`## ${sec.title}`);
    (sec.content || []).forEach((item) => {
      lines.push(`* ${item}`);
    });
    lines.push(``);
  });

  if (attachmentIndex?.textLines?.length) {
    lines.push(`## Attachments Index`);
    attachmentIndex.textLines.forEach((item) => {
      lines.push(`* ${item}`);
    });
    lines.push(``);
  }

  if (includePrivateDetails && followUpRecord) {
    lines.push(`## Private Post-Hearing Follow-Up`);
    lines.push(`* Attendance: ${followUpRecord.attendanceStatusLabel || followUpRecord.attendanceStatus}`);
    lines.push(`* Acknowledgement: ${followUpRecord.acknowledgementTypeLabel || followUpRecord.acknowledgementType} (${followUpRecord.acknowledgementNumber || 'None'})`);
    lines.push(`* Officer / Desk: ${followUpRecord.officerOrDesk || 'Not recorded'}`);
    lines.push(`* Next Action: ${followUpRecord.nextAction || 'None'}`);
    lines.push(`* Follow-Up Date: ${formatHearingDate(followUpRecord.followUpDate)}`);
    lines.push(``);
  }

  lines.push(`------------------------------------------------------------`);
  lines.push(`DISCLAIMER: ${pack.disclaimer}`);
  lines.push(`NOTICE: ${pack.outcomeNotice}`);
  lines.push(`============================================================`);

  return lines.join('\n');
}
