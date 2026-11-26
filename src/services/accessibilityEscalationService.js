/**
 * accessibilityEscalationService.js
 *
 * Core domain service for managing citizen-recorded accessibility complaint timelines,
 * chronological event sequencing, follow-up milestone reminders, and automated
 * generation of editable authority follow-up letters and Commissioner escalation petitions.
 *
 * Legal Alignment:
 * - Rights of Persons with Disabilities (RPwD) Act, 2016 (Sections 40, 44, 45, 75, 80, 89)
 * - Harmonised Guidelines and Space Standards for Barrier Free Built Environment (2021)
 * - Supreme Court Precedent: Rajive Raturi v. Union of India (2018) 2 SCC 413
 */

import {
  getAccessibilityCaseById,
  saveAccessibilityCase,
  OFFICIAL_STATUS_DISCLAIMER,
} from './accessibilityEscalationStorage.js';

export const EVENT_TYPES = {
  COMPLAINT_FILED: 'COMPLAINT_FILED',
  ACKNOWLEDGMENT_RECEIVED: 'ACKNOWLEDGMENT_RECEIVED',
  INSPECTION_REQUESTED: 'INSPECTION_REQUESTED',
  INSPECTION_CONDUCTED: 'INSPECTION_CONDUCTED',
  INTERIM_REPLY: 'INTERIM_REPLY',
  REMINDER_SENT: 'REMINDER_SENT',
  HEARING_SCHEDULED: 'HEARING_SCHEDULED',
  BARRIER_RECTIFIED: 'BARRIER_RECTIFIED',
  NOTE_LOGGED: 'NOTE_LOGGED',
};

export const EVENT_TYPE_LABELS = {
  [EVENT_TYPES.COMPLAINT_FILED]: 'Formal Complaint Lodged',
  [EVENT_TYPES.ACKNOWLEDGMENT_RECEIVED]: 'Official Docket Acknowledgment',
  [EVENT_TYPES.INSPECTION_REQUESTED]: 'Joint Site Inspection Requested',
  [EVENT_TYPES.INSPECTION_CONDUCTED]: 'Field Site Inspection Conducted',
  [EVENT_TYPES.INTERIM_REPLY]: 'Departmental Interim Reply / ATR',
  [EVENT_TYPES.REMINDER_SENT]: 'Follow-Up / Reminder Dispatched',
  [EVENT_TYPES.HEARING_SCHEDULED]: 'Hearing Scheduled before Commissioner',
  [EVENT_TYPES.BARRIER_RECTIFIED]: 'Accessibility Works Completed',
  [EVENT_TYPES.NOTE_LOGGED]: 'Citizen Note / Phone Call Logged',
};

export const CASE_STAGES = {
  REPORT_FILED: 'REPORT_FILED',
  INSPECTION_REQUESTED: 'INSPECTION_REQUESTED',
  INTERIM_REPLY_RECEIVED: 'INTERIM_REPLY_RECEIVED',
  FOLLOW_UP_DUE: 'FOLLOW_UP_DUE',
  ESCALATION_PREPARED: 'ESCALATION_PREPARED',
  ESCALATED: 'ESCALATED',
  RESOLVED: 'RESOLVED',
  CLOSED_UNRESOLVED: 'CLOSED_UNRESOLVED',
};

export const CASE_STAGE_LABELS = {
  [CASE_STAGES.REPORT_FILED]: 'Initial Complaint Filed',
  [CASE_STAGES.INSPECTION_REQUESTED]: 'Site Inspection Requested',
  [CASE_STAGES.INTERIM_REPLY_RECEIVED]: 'Interim Reply Received',
  [CASE_STAGES.FOLLOW_UP_DUE]: 'Follow-Up Due',
  [CASE_STAGES.ESCALATION_PREPARED]: 'Escalation Petition Prepared',
  [CASE_STAGES.ESCALATED]: 'Escalated to Disabilities Commissioner',
  [CASE_STAGES.RESOLVED]: 'Barrier Rectified & Resolved',
  [CASE_STAGES.CLOSED_UNRESOLVED]: 'Closed (Unresolved)',
};

export const FACILITY_TYPES = {
  healthcare: 'Hospital / Primary Health Center',
  transit: 'Bus Terminal / Railway Station / Metro',
  municipal_office: 'Municipal Corporation / Ward Office',
  school_university: 'School / College / University',
  bank_post_office: 'Bank Branch / Post Office',
  public_park: 'Public Park / Recreation Center',
  commercial_building: 'Commercial Market / Shopping Complex',
  other: 'Other Public Infrastructure',
};

export const AUTHORITY_TYPES = {
  MUNICIPAL_CORPORATION: 'Municipal Corporation / Council',
  PWD_HIGHWAYS: 'Public Works Department (PWD Civil Wing)',
  STATE_COMMISSIONER_PWD: 'State Commissioner for Persons with Disabilities',
  CHIEF_COMMISSIONER_PWD: 'Chief Commissioner for Persons with Disabilities (MoSJE)',
  TRANSPORT_AUTHORITY: 'Transport Department / Transit Undertaking',
  HEALTH_DEPARTMENT: 'Health & Family Welfare Department',
  OTHER: 'Other Competent Public Authority',
};

export const REMINDER_LEGAL_DISCLAIMER =
  'Notice: Target follow-up dates are citizen-managed organizational milestones. A missed response date by a public authority does not automatically constitute court contempt or statutory default unless established through a formal Commissioner directive.';

/**
 * Sorts case timeline events chronologically.
 * Primary: eventDate ascending (YYYY-MM-DD). Secondary: createdAt ascending.
 *
 * @param {Array<Object>} events
 * @returns {Array<Object>} Sorted events
 */
export function sortEventsChronologically(events = []) {
  return [...events].sort((a, b) => {
    const dateA = new Date(a.eventDate || a.createdAt || 0).getTime();
    const dateB = new Date(b.eventDate || b.createdAt || 0).getTime();
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    const createdA = new Date(a.createdAt || 0).getTime();
    const createdB = new Date(b.createdAt || 0).getTime();
    return createdA - createdB;
  });
}

/**
 * Adds an event to a case timeline, maintaining chronological ordering.
 *
 * @param {string} caseId
 * @param {Object} eventData
 * @param {Storage} [customStorage]
 * @returns {Promise<Object>} Updated case
 */
export async function addCaseEvent(caseId, eventData, customStorage) {
  const caseRecord = getAccessibilityCaseById(caseId, customStorage);
  if (!caseRecord) {
    throw new Error(`Accessibility case '${caseId}' not found.`);
  }

  if (!eventData || typeof eventData !== 'object') {
    throw new Error('Event data object required.');
  }

  const {
    eventType = EVENT_TYPES.NOTE_LOGGED,
    eventDate = new Date().toISOString().slice(0, 10),
    summary,
    details = '',
    evidenceRefs = [],
    followUpDate = null,
  } = eventData;

  if (!summary || !summary.trim()) {
    throw new Error('Event summary is mandatory.');
  }

  const now = new Date().toISOString();
  const newEvent = {
    id: `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    eventType,
    eventDate: eventDate.slice(0, 10),
    summary: summary.trim(),
    details: details.trim(),
    evidenceRefs: Array.isArray(evidenceRefs)
      ? evidenceRefs
      : typeof evidenceRefs === 'string'
      ? evidenceRefs.split('\n').filter(Boolean)
      : [],
    followUpDate: followUpDate ? followUpDate.slice(0, 10) : null,
    isReminderDismissed: false,
    createdAt: now,
    updatedAt: now,
  };

  const currentEvents = caseRecord.events || [];
  const updatedEvents = sortEventsChronologically([...currentEvents, newEvent]);

  // Update case status if relevant
  let nextStatus = caseRecord.status;
  if (eventType === EVENT_TYPES.INSPECTION_REQUESTED && nextStatus === CASE_STAGES.REPORT_FILED) {
    nextStatus = CASE_STAGES.INSPECTION_REQUESTED;
  } else if (eventType === EVENT_TYPES.INTERIM_REPLY) {
    nextStatus = CASE_STAGES.INTERIM_REPLY_RECEIVED;
  } else if (eventType === EVENT_TYPES.BARRIER_RECTIFIED) {
    nextStatus = CASE_STAGES.RESOLVED;
  } else if (eventType === EVENT_TYPES.HEARING_SCHEDULED) {
    nextStatus = CASE_STAGES.ESCALATED;
  }

  return saveAccessibilityCase(
    {
      ...caseRecord,
      status: nextStatus,
      events: updatedEvents,
    },
    customStorage
  );
}

/**
 * Updates an existing event within a case timeline.
 *
 * @param {string} caseId
 * @param {string} eventId
 * @param {Object} updates
 * @param {Storage} [customStorage]
 * @returns {Promise<Object>} Updated case
 */
export async function updateCaseEvent(caseId, eventId, updates, customStorage) {
  const caseRecord = getAccessibilityCaseById(caseId, customStorage);
  if (!caseRecord) {
    throw new Error(`Accessibility case '${caseId}' not found.`);
  }

  const events = caseRecord.events || [];
  const idx = events.findIndex((e) => e.id === eventId);
  if (idx === -1) {
    throw new Error(`Event '${eventId}' not found in case '${caseId}'.`);
  }

  const existing = events[idx];
  const updatedEvent = {
    ...existing,
    ...updates,
    id: existing.id, // Immutable ID
    evidenceRefs: Array.isArray(updates.evidenceRefs)
      ? updates.evidenceRefs
      : updates.evidenceRefs !== undefined
      ? String(updates.evidenceRefs).split('\n').filter(Boolean)
      : existing.evidenceRefs,
    updatedAt: new Date().toISOString(),
  };

  events[idx] = updatedEvent;
  const sorted = sortEventsChronologically(events);

  return saveAccessibilityCase(
    {
      ...caseRecord,
      events: sorted,
    },
    customStorage
  );
}

/**
 * Deletes an event from a case timeline.
 *
 * @param {string} caseId
 * @param {string} eventId
 * @param {Storage} [customStorage]
 * @returns {Promise<Object>} Updated case
 */
export async function deleteCaseEvent(caseId, eventId, customStorage) {
  const caseRecord = getAccessibilityCaseById(caseId, customStorage);
  if (!caseRecord) {
    throw new Error(`Accessibility case '${caseId}' not found.`);
  }

  const filtered = (caseRecord.events || []).filter((e) => e.id !== eventId);

  return saveAccessibilityCase(
    {
      ...caseRecord,
      events: filtered,
    },
    customStorage
  );
}

function parseDateDays(dateInput) {
  if (!dateInput) return null;
  const d = typeof dateInput === 'string' ? dateInput.slice(0, 10) : new Date(dateInput).toISOString().slice(0, 10);
  const parts = d.split('-').map(Number);
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  return Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2]) / (1000 * 60 * 60 * 24));
}

/**
 * Computes overdue and upcoming follow-up reminders based on citizen-recorded dates.
 *
 * @param {Object} caseData
 * @param {Date|string} [referenceDate=new Date()]
 * @returns {Object} Reminder analysis
 */
export function computeFollowUpReminders(caseData, referenceDate = new Date()) {
  const refDays = parseDateDays(referenceDate);
  const events = caseData?.events || [];

  const overdueEvents = [];
  const upcomingEvents = [];

  events.forEach((evt) => {
    if (!evt.followUpDate || evt.isReminderDismissed) return;
    const targetDays = parseDateDays(evt.followUpDate);
    if (targetDays === null || refDays === null) return;
    const diffDays = targetDays - refDays;

    if (diffDays < 0) {
      overdueEvents.push({
        eventId: evt.id,
        summary: evt.summary,
        followUpDate: evt.followUpDate,
        overdueDays: Math.abs(diffDays),
      });
    } else if (diffDays <= 7) {
      upcomingEvents.push({
        eventId: evt.id,
        summary: evt.summary,
        followUpDate: evt.followUpDate,
        daysRemaining: diffDays,
      });
    }
  });

  // Calculate days since latest event
  let daysSinceLastActivity = null;
  if (events.length > 0 && refDays !== null) {
    const latestEvent = events[events.length - 1];
    const latestEventDays = parseDateDays(latestEvent.eventDate);
    if (latestEventDays !== null) {
      daysSinceLastActivity = Math.max(0, refDays - latestEventDays);
    }
  }

  // Determine intelligent suggestion
  let suggestedNextAction = 'Log all official responses, speed post receipts, and inspection dates.';
  if (overdueEvents.length > 0) {
    suggestedNextAction = `Target follow-up date has passed by ${overdueEvents[0].overdueDays} days. Consider dispatching a formal reminder letter or preparing an escalation petition to the Disabilities Commissioner.`;
  } else if (daysSinceLastActivity !== null && daysSinceLastActivity > 30 && caseData?.status !== CASE_STAGES.RESOLVED) {
    suggestedNextAction = 'Over 30 days have elapsed without recorded departmental activity. Under Section 75 of RPwD Act 2016, lack of response qualifies for grievance escalation to the State Commissioner.';
  }

  return {
    overdueEvents,
    upcomingEvents,
    hasOverdue: overdueEvents.length > 0,
    hasUpcoming: upcomingEvents.length > 0,
    daysSinceLastActivity,
    suggestedNextAction,
    disclaimer: REMINDER_LEGAL_DISCLAIMER,
  };
}

/**
 * Generates an editable follow-up representation addressed to the initial public authority.
 *
 * @param {Object} caseData
 * @param {Object} [options]
 * @returns {string} Formatted draft text
 */
export function generateFollowUpDraft(caseData, options = {}) {
  const citizenName = options.citizenName || '[Citizen Name]';
  const citizenAddress = options.citizenAddress || '[Address / Phone / Email]';
  const authorityContact = caseData.authorityContact || '[Designation of Grievance Nodal Officer]';
  const officialDocket = caseData.officialComplaintNumber
    ? `Reference Grievance Docket Number: ${caseData.officialComplaintNumber}`
    : 'Reference: Initial Accessibility Complaint submitted previously';

  const eventsList = (caseData.events || []).map((e, idx) => {
    const evidenceStr = e.evidenceRefs && e.evidenceRefs.length > 0 ? ` (Evidence: ${e.evidenceRefs.join(', ')})` : '';
    return `   ${idx + 1}. ${e.eventDate}: ${e.summary}${evidenceStr}`;
  });

  return [
    `FORMAL FOLLOW-UP REPRESENTATION UNDER SECTION 45, RPwD ACT 2016`,
    `================================================================`,
    `Date: ${new Date().toLocaleDateString('en-IN')}`,
    ``,
    `To,`,
    `${authorityContact}`,
    `${caseData.authorityType}`,
    `${caseData.location || '[Office Address]'}`,
    ``,
    `From:`,
    `${citizenName}`,
    `${citizenAddress}`,
    ``,
    `Subject: Urgent Follow-up Regarding Removal of Accessibility Barriers at ${caseData.facilityName}`,
    `${officialDocket}`,
    ``,
    `Respected Sir/Madam,`,
    ``,
    `1. I am writing to invite your immediate attention to the formal accessibility complaint lodged regarding built environment barriers at ${caseData.facilityName} (${caseData.facilityType}) located at ${caseData.location}.`,
    ``,
    `2. Under Section 45(1) of the Rights of Persons with Disabilities Act, 2016, and Rule 15 of the RPwD Rules, 2017, all existing public buildings, healthcare centers, transport hubs, and government establishments are statutorily mandated to comply with the Harmonised Guidelines and Space Standards for Barrier Free Built Environment (2021).`,
    ``,
    `3. CHRONOLOGICAL RECORD OF PRIOR CORRESPONDENCE & EVENTS:`,
    eventsList.length > 0 ? eventsList.join('\n') : '   - (No prior events recorded in case timeline)',
    ``,
    `4. PRAYER & ACTION REQUESTED:`,
    `   (a) Immediate joint site inspection by a designated Executive / Assistant Engineer along with representative persons with disabilities;`,
    `   (b) Formulation of a time-bound Barrier Rectification Plan (including compliant ramp gradient 1:12, tactile paving, accessible restrooms, and functional elevators);`,
    `   (c) Communication of the Action Taken Report (ATR) within fourteen (14) days from the receipt of this representation.`,
    ``,
    `5. Please note that continued inaction or failure to provide equal access constitutes an offense under Section 89 of the RPwD Act, 2016, and will constrain me to escalate this matter to the State / Chief Commissioner for Persons with Disabilities.`,
    ``,
    `Yours faithfully,`,
    ``,
    `${citizenName}`,
    `Enclosures: Copies of prior acknowledgments, speed post receipts, and photographic evidence.`,
    ``,
    `----------------------------------------------------------------`,
    `[DISCLAIMER: This is an editable citizen draft prepared locally via CivicBridge. It is NOT automatically submitted. Please review, attach your contact details, and deliver via Speed Post, email, or government grievance portal.]`,
  ].join('\n');
}

/**
 * Generates an editable formal petition to the State/Chief Commissioner for Persons with Disabilities.
 *
 * @param {Object} caseData
 * @param {Object} [options]
 * @returns {string} Formatted escalation petition text
 */
export function generateEscalationPetitionDraft(caseData, options = {}) {
  const petitionerName = options.citizenName || '[Petitioner / Citizen Name]';
  const petitionerAddress = options.citizenAddress || '[Petitioner Address & Contact]';
  const commissionerTitle =
    caseData.authorityType === 'CHIEF_COMMISSIONER_PWD'
      ? 'Court of the Chief Commissioner for Persons with Disabilities, Government of India'
      : 'Office of the State Commissioner for Persons with Disabilities';

  const eventsList = (caseData.events || []).map((e, idx) => {
    const evidenceStr = e.evidenceRefs && e.evidenceRefs.length > 0 ? ` [Proof: ${e.evidenceRefs.join(', ')}]` : '';
    return `   ${idx + 1}. ${e.eventDate}: ${e.summary}${evidenceStr}\n      Details: ${e.details || 'N/A'}`;
  });

  return [
    `BEFORE THE ${commissionerTitle.toUpperCase()}`,
    `================================================================`,
    `PETITION UNDER SECTION 75 / 80 OF THE RIGHTS OF PERSONS WITH DISABILITIES ACT, 2016`,
    ``,
    `IN THE MATTER OF:`,
    `${petitionerName}`,
    `Resident of: ${petitionerAddress}`,
    `... PETITIONER / COMPLAINANT`,
    ``,
    `VERSUS`,
    ``,
    `1. ${caseData.authorityType}`,
    `   Through its Principal Officer / Commissioner`,
    `2. Administrator / Management, ${caseData.facilityName}`,
    `   Address: ${caseData.location}`,
    `... RESPONDENTS`,
    ``,
    `SUBMISSION OF FACTUAL TIMELINE & COMPLAINT OF SYSTEMIC NON-COMPLIANCE:`,
    ``,
    `1. The Petitioner brings to the notice of this Hon'ble Court the chronic accessibility barrier existing at ${caseData.facilityName} (${caseData.facilityType}), which deprives persons with disabilities of their fundamental right to dignity and non-discrimination guaranteed under Article 21 of the Constitution and Section 3 of the RPwD Act, 2016.`,
    ``,
    `2. Despite repeated representations and requests for inspection, the Respondents have failed to rectify the barrier in accordance with the mandatory Harmonised Guidelines and Space Standards (2021) and the doctrine laid down by the Hon'ble Supreme Court in Rajive Raturi v. Union of India (2018) 2 SCC 413.`,
    ``,
    `3. CHRONOLOGICAL CITIZEN LOG OF COMMUNICATIONS & ATTEMPTS AT RESOLUTION:`,
    eventsList.length > 0 ? eventsList.join('\n') : '   - (No prior communications recorded)',
    ``,
    `4. PRAYER:`,
    `   The Petitioner respectfully prays that this Hon'ble Court may be pleased to:`,
    `   (a) Exercise powers under Section 75(1)(b) / 80(b) to look into the non-compliance of Section 44 and 45 at ${caseData.facilityName};`,
    `   (b) Issue summons and direct the Respondents to produce the accessibility audit report and sanctioned retrofitting budget;`,
    `   (c) Direct immediate execution of accessible infrastructure (gradient ramp, tactile paths, lift access, signage) within a strict 60-day deadline;`,
    `   (d) Recommend initiation of proceedings under Section 89 for persistent contravention of statutory accessibility standards.`,
    ``,
    `VERIFICATION:`,
    `I, ${petitionerName}, do hereby verify that the contents of the above petition and chronological event timeline are true and correct based on my personal records and correspondence receipts.`,
    ``,
    `Verified at [City/Place] on ${new Date().toLocaleDateString('en-IN')}.`,
    ``,
    `__________________________`,
    `Signature of Petitioner`,
    ``,
    `----------------------------------------------------------------`,
    `[DISCLAIMER: This is an editable citizen escalation draft prepared locally via CivicBridge. It is NOT automatically filed. Please print, sign, attach proof of speed post receipts and photographs, and submit to the State / Chief Commissioner's registry.]`,
  ].join('\n');
}

/**
 * Sanitizes a case record for privacy-preserving export under DPDP Act 2023.
 *
 * @param {Object} caseData
 * @returns {Object} Sanitized case
 */
export function sanitizeCaseForExport(caseData) {
  if (!caseData) return null;

  const phoneRegex = /\b(?:\+91|0)?[6-9]\d{9}\b/g;
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const aadhaarRegex = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;

  const redact = (str) => {
    if (!str || typeof str !== 'string') return str;
    return str
      .replace(aadhaarRegex, 'XXXX-XXXX-XXXX')
      .replace(phoneRegex, 'XXXXX-XXXXX')
      .replace(emailRegex, '[REDACTED_EMAIL]');
  };

  return {
    ...caseData,
    title: redact(caseData.title),
    location: redact(caseData.location),
    authorityContact: redact(caseData.authorityContact),
    officialStatusDisclaimer: OFFICIAL_STATUS_DISCLAIMER,
    events: (caseData.events || []).map((e) => ({
      ...e,
      summary: redact(e.summary),
      details: redact(e.details),
      evidenceRefs: (e.evidenceRefs || []).map((r) => redact(r)),
    })),
  };
}
