/**
 * Data contract for the Uttar Pradesh Public Hearing and Jan Sunwai
 * preparation and follow-up workspace (#1002).
 *
 * The contract deliberately keeps three ideas separate:
 *   1. A hearing/attendance event (an opportunity to be heard)
 *   2. A registered grievance/complaint (a written acknowledgement exists)
 *   3. A confirmed resolution (a written closure or compliance confirmation exists)
 *
 * Nothing in this file may be used to infer one of those states from another.
 */

export const UP_JAN_SUNWAI_SCHEMA_VERSION = '1.0.0';

export const UP_HEARING_EVENT_TYPES = Object.freeze({
  JAN_SUNWAI: 'JAN_SUNWAI',
  TEHSIL_DIWAS: 'TEHSIL_DIWAS',
  MUNICIPAL_HEARING: 'MUNICIPAL_HEARING',
  PUBLIC_HEARING: 'PUBLIC_HEARING',
});

export const UP_HEARING_EVENT_TYPE_LABELS = Object.freeze({
  [UP_HEARING_EVENT_TYPES.JAN_SUNWAI]: 'Jan Sunwai (public grievance hearing)',
  [UP_HEARING_EVENT_TYPES.TEHSIL_DIWAS]: 'Tehsil Diwas / Tehsil public hearing',
  [UP_HEARING_EVENT_TYPES.MUNICIPAL_HEARING]: 'Municipal public hearing',
  [UP_HEARING_EVENT_TYPES.PUBLIC_HEARING]: 'Public hearing',
});

export const VERIFICATION_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  REJECTED: 'REJECTED',
  STALE: 'STALE',
});

export const HEARING_STATUS = Object.freeze({
  UPCOMING: 'UPCOMING',
  TODAY: 'TODAY',
  EXPIRED: 'EXPIRED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  CANCELLED: 'CANCELLED',
});

export const HEARING_STATUS_LABELS = Object.freeze({
  [HEARING_STATUS.UPCOMING]: 'Upcoming',
  [HEARING_STATUS.TODAY]: 'Held today',
  [HEARING_STATUS.EXPIRED]: 'Expired / archive',
  [HEARING_STATUS.PENDING_VERIFICATION]: 'Unconfirmed — not an official appointment',
  [HEARING_STATUS.CANCELLED]: 'Cancelled by authority',
});

export const ATTENDANCE_STATUS = Object.freeze({
  ATTENDED: 'ATTENDED',
  NOT_ATTENDED: 'NOT_ATTENDED',
  COULD_NOT_ATTEND: 'COULD_NOT_ATTEND',
});

export const ATTENDANCE_STATUS_LABELS = Object.freeze({
  [ATTENDANCE_STATUS.ATTENDED]: 'I attended',
  [ATTENDANCE_STATUS.NOT_ATTENDED]: 'I did not attend',
  [ATTENDANCE_STATUS.COULD_NOT_ATTEND]: 'I could not attend',
});

export const ACKNOWLEDGEMENT_TYPE = Object.freeze({
  NONE: 'NONE',
  HEARING_SLIP: 'HEARING_SLIP',
  COMPLAINT_ACKNOWLEDGEMENT: 'COMPLAINT_ACKNOWLEDGEMENT',
  COMPLAINT_NUMBER: 'COMPLAINT_NUMBER',
  RECEIPT: 'RECEIPT',
  OFFICER_DIARY_ENTRY: 'OFFICER_DIARY_ENTRY',
  OTHER: 'OTHER',
});

export const ACKNOWLEDGEMENT_TYPE_LABELS = Object.freeze({
  [ACKNOWLEDGEMENT_TYPE.NONE]: 'No acknowledgement received / not recorded',
  [ACKNOWLEDGEMENT_TYPE.HEARING_SLIP]: 'Hearing attendance slip',
  [ACKNOWLEDGEMENT_TYPE.COMPLAINT_ACKNOWLEDGEMENT]: 'Written complaint acknowledgement',
  [ACKNOWLEDGEMENT_TYPE.COMPLAINT_NUMBER]: 'Complaint / grievance number',
  [ACKNOWLEDGEMENT_TYPE.RECEIPT]: 'Receipt or receipt number',
  [ACKNOWLEDGEMENT_TYPE.OFFICER_DIARY_ENTRY]: 'Officer diary entry',
  [ACKNOWLEDGEMENT_TYPE.OTHER]: 'Other written reference',
});

export const COMPLAINT_REGISTRATION_STATUS = Object.freeze({
  NOT_RECORDED: 'NOT_RECORDED',
  RECORDED: 'RECORDED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

export const COMPLAINT_REGISTRATION_STATUS_LABELS = Object.freeze({
  [COMPLAINT_REGISTRATION_STATUS.NOT_RECORDED]: 'No complaint registration recorded',
  [COMPLAINT_REGISTRATION_STATUS.RECORDED]: 'Complaint registration recorded by the citizen',
  [COMPLAINT_REGISTRATION_STATUS.NOT_APPLICABLE]: 'Not applicable',
});

export const RESOLUTION_STATUS = Object.freeze({
  NOT_CONFIRMED: 'NOT_CONFIRMED',
  RESOLVED_CONFIRMED: 'RESOLVED_CONFIRMED',
});

export const FOLLOW_UP_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ATTENDED_AWAITING_ACKNOWLEDGEMENT: 'ATTENDED_AWAITING_ACKNOWLEDGEMENT',
  COMPLAINT_REGISTERED: 'COMPLAINT_REGISTERED',
  AWAITING_RESPONSE: 'AWAITING_RESPONSE',
  ESCALATED: 'ESCALATED',
  RESOLVED_CONFIRMED: 'RESOLVED_CONFIRMED',
  CLOSED_NO_ACTION: 'CLOSED_NO_ACTION',
  MISSED_HEARING: 'MISSED_HEARING',
});

export const FOLLOW_UP_STATUS_LABELS = Object.freeze({
  [FOLLOW_UP_STATUS.PENDING]: 'Follow-up pending',
  [FOLLOW_UP_STATUS.ATTENDED_AWAITING_ACKNOWLEDGEMENT]: 'Attended — acknowledgement pending',
  [FOLLOW_UP_STATUS.COMPLAINT_REGISTERED]: 'Complaint registration recorded',
  [FOLLOW_UP_STATUS.AWAITING_RESPONSE]: 'Awaiting official response',
  [FOLLOW_UP_STATUS.ESCALATED]: 'Escalated to the next official channel',
  [FOLLOW_UP_STATUS.RESOLVED_CONFIRMED]: 'Resolution confirmed in writing',
  [FOLLOW_UP_STATUS.CLOSED_NO_ACTION]: 'Closed by the citizen — no action requested',
  [FOLLOW_UP_STATUS.MISSED_HEARING]: 'Hearing missed — follow-up not started',
});

export const FOLLOW_UP_STATE = Object.freeze({
  NOT_RECORDED: 'NOT_RECORDED',
  NO_DATE: 'NO_DATE',
  OVERDUE: 'OVERDUE',
  DUE_TODAY: 'DUE_TODAY',
  DUE_SOON: 'DUE_SOON',
  UPCOMING: 'UPCOMING',
  COMPLETED: 'COMPLETED',
});

export const FOLLOW_UP_STATE_LABELS = Object.freeze({
  [FOLLOW_UP_STATE.NOT_RECORDED]: 'No follow-up recorded',
  [FOLLOW_UP_STATE.NO_DATE]: 'No follow-up date set',
  [FOLLOW_UP_STATE.OVERDUE]: 'Follow-up overdue',
  [FOLLOW_UP_STATE.DUE_TODAY]: 'Follow-up due today',
  [FOLLOW_UP_STATE.DUE_SOON]: 'Follow-up due soon',
  [FOLLOW_UP_STATE.UPCOMING]: 'Follow-up scheduled',
  [FOLLOW_UP_STATE.COMPLETED]: 'Follow-up completed',
});

/**
 * Issue categories used to assemble a preparation checklist. Documents are listed
 * as commonly relevant citizen records, not as universal statutory requirements.
 * The official event notice always takes precedence.
 */
export const ISSUE_CATEGORIES = Object.freeze({
  REVENUE_LAND: Object.freeze({
    id: 'revenue_land',
    label: 'Revenue & land records',
    commonDocuments: [
      'Copy of the relevant land record / khatauni extract, if the matter concerns land',
      'Copy of any mutation, demarcation, or revenue application already filed',
    ],
    guidance:
      'Bring the specific plot, khatauni, or application reference you already hold. Do not create a reference number that you cannot support with a document.',
  }),
  RATION_PDS: Object.freeze({
    id: 'ration_pds',
    label: 'Ration card & public distribution',
    commonDocuments: [
      'Copy of the ration card or Mera Ration reference (mask the card number on any public copy)',
      'Copy of the latest e-POS receipt or shop acknowledgement, if available',
    ],
    guidance:
      'Keep the original ration card for verification. Mask Aadhaar and ration-card numbers on copies you leave at a counter.',
  }),
  MUNICIPAL_SANITATION: Object.freeze({
    id: 'municipal_sanitation',
    label: 'Municipal sanitation, drainage & waste',
    commonDocuments: [
      'Dated photographs or a written description of the sanitation or drainage problem',
      'Copy of the earlier municipal complaint or work request, if any',
    ],
    guidance:
      'Record dates, locations, and observable facts. Avoid claiming a cause or an engineering estimate unless an official document supports it.',
  }),
  WATER_SUPPLY: Object.freeze({
    id: 'water_supply',
    label: 'Water supply & sewerage',
    commonDocuments: [
      'Copy of the water bill, tanker request, or previous water complaint, if any',
      'Dated record of the supply disruption or water-quality concern',
    ],
    guidance:
      'Describe the supply timing and affected area factually. Do not include a medical diagnosis or lab claim without a supporting report.',
  }),
  ROADS_TRANSPORT: Object.freeze({
    id: 'roads_transport',
    label: 'Roads, footpaths & local transport',
    commonDocuments: [
      'Dated photographs of the road, footpath, or transport obstruction',
      'Copy of an earlier road-safety or municipal complaint, if any',
    ],
    guidance:
      'Use the nearest landmark and the date of observation. Do not add a technical causation claim that you cannot support.',
  }),
  ELECTRICITY: Object.freeze({
    id: 'electricity',
    label: 'Electricity & street lighting',
    commonDocuments: [
      'Copy of the electricity bill or outage complaint reference, if any',
      'Dated record of the outage, billing, or street-light problem',
    ],
    guidance:
      'Bring the consumer or complaint reference you already hold. Do not guess a consumer number.',
  }),
  PENSION_WELFARE: Object.freeze({
    id: 'pension_welfare',
    label: 'Pension & welfare schemes',
    commonDocuments: [
      'Copy of the pension / welfare application and any acknowledgement',
      'Copy of the bank passbook page showing the relevant entry, if the matter concerns payment',
    ],
    guidance:
      'Mask bank account numbers and Aadhaar numbers on copies. State only the scheme and application facts you can support.',
  }),
  CERTIFICATES: Object.freeze({
    id: 'certificates',
    label: 'Certificates & civic documents',
    commonDocuments: [
      'Copy of the application or e-District acknowledgement',
      'Copy of the identity / residence document relevant to the request',
    ],
    guidance:
      'Bring the application reference and the exact certificate name. Do not assume that a certificate will be issued at the hearing itself.',
  }),
  POLICE_SAFETY: Object.freeze({
    id: 'police_safety',
    label: 'Police, safety & public order',
    commonDocuments: [
      'Copy of the police complaint / diary acknowledgement, if available',
      'Dated written chronology of the incident or safety concern',
    ],
    guidance:
      'For an emergency, contact the official emergency helpline instead of waiting for a hearing. This workspace does not replace emergency services.',
  }),
  OTHER: Object.freeze({
    id: 'other',
    label: 'Other civic matter',
    commonDocuments: ['Copies of the documents directly relevant to your written submission'],
    guidance:
      'Keep the submission concise and factual. Attach only documents that support what you have written.',
  }),
});

export const ISSUE_CATEGORY_OPTIONS = Object.freeze(
  Object.values(ISSUE_CATEGORIES).map((category) => ({
    id: category.id,
    label: category.label,
    guidance: category.guidance,
    commonDocuments: category.commonDocuments,
  })),
);

export const SOURCE_STALE_AFTER_DAYS = 30;
export const SOURCE_REVIEW_REQUIRED_AFTER_DAYS = 45;

export const EVENT_VERIFICATION_DISCLAIMER =
  'Only events with a dated notice from the responsible authority, a working official source URL, a venue or online link, eligibility information, and registration instructions are shown as official. A community message is never presented as an official appointment.';

export const PREPARATION_DISCLAIMER =
  'This preparation pack is a citizen worksheet. It does not add facts, legal provisions, or citations. Confirm the event date, venue, eligibility, and registration instructions with the official source before travelling.';

export const PRIVACY_NOTICE =
  'Your preparation notes, acknowledgement numbers, officer/desk details, next actions, and follow-up dates stay in this browser under your own account. They are not added to the public event listing and are excluded from the printable pack unless you explicitly include them.';

export const OUTCOME_DISTINCTIONS = Object.freeze([
  Object.freeze({
    key: 'attendance',
    title: 'Hearing attendance',
    summary:
      'Attending a Jan Sunwai or public hearing means you were present and, if permitted, made a submission. It does not by itself register a complaint or decide the matter.',
    notEquivalentTo: 'Complaint registration or resolution',
  }),
  Object.freeze({
    key: 'registration',
    title: 'Complaint registration',
    summary:
      'A complaint is registered only when the receiving office gives you a written acknowledgement, diary number, or complaint reference. Record the exact reference and the desk that issued it.',
    notEquivalentTo: 'Resolution',
  }),
  Object.freeze({
    key: 'resolution',
    title: 'Confirmed resolution',
    summary:
      'A matter is resolved only when you hold a written closure, compliance confirmation, or official order that addresses the requested remedy. An acknowledgement is not proof of resolution.',
    notEquivalentTo: 'Attendance or acknowledgement',
  }),
]);

export const OUTCOME_DISTINCTION_NOTICE =
  'Attendance, complaint registration, and resolution are separate states. Civic Help Setu never upgrades one into another automatically.';

export function isGovernmentSourceUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'gov.in' || host.endsWith('.gov.in') || host === 'nic.in' || host.endsWith('.nic.in');
  } catch {
    return false;
  }
}

export function isHttpsUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateKey(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function toDateKey(value) {
  if (!value) return null;
  if (typeof value === 'string' && isValidDateKey(value.slice(0, 10))) {
    return value.slice(0, 10);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function daysBetweenDateKeys(fromKey, toKey) {
  if (!isValidDateKey(fromKey) || !isValidDateKey(toKey)) return null;
  const from = Date.parse(`${fromKey}T00:00:00.000Z`);
  const to = Date.parse(`${toKey}T00:00:00.000Z`);
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

export function addDaysToDateKey(dateKey, days) {
  if (!isValidDateKey(dateKey)) return null;
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

export function getUserFacingOutcomeExplanation() {
  return {
    notice: OUTCOME_DISTINCTION_NOTICE,
    distinctions: OUTCOME_DISTINCTIONS,
  };
}
