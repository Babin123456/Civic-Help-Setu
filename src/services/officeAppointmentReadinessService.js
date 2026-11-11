/**
 * Government Office Appointment and Visit-Readiness Workspace Service
 *
 * Implements a personalized preparation workspace for in-person civic visits
 * (Sub-Registrar, Tahsildar, Passport Seva Kendra, RTO, Municipal Counters):
 *
 * 1. Appointment Lifecycle Management:
 *    - Track, edit, reschedule, and cancel booked facilitation appointments.
 *    - Strict owner-based data privacy (records accessible only by the authenticated owner).
 * 2. Personalized Physical Visit Packing Checklist:
 *    - Categorizes required items into:
 *      * ORIGINALS (identity, address, birth/property certificates)
 *      * PHOTOCOPIES (self-attested physical copies)
 *      * PHOTOGRAPHS (passport-size specifications)
 *      * PRINTED_FORMS (application printouts & declarations)
 *      * FEE_EVIDENCE (treasury challan, e-receipt, demand draft)
 * 3. RFC-Compliant iCalendar (.ics) Export:
 *    - Generates calendar files with proper UTC formatting, timezones, and SEQUENCE numbers.
 *    - Handles updates, reschedules, and CANCELLATION events per iCalendar RFC 5545.
 * 4. Ground Visit Outcome Tracking:
 *    - Tracks post-visit status: COMPLETED, RESCHEDULED, TOKEN_ISSUED, ADDITIONAL_DOCS_REQUESTED.
 * 5. Ethical Transparency:
 *    - Explicitly clarifies that tracking an appointment does not imply automated integration
 *      with official scheduling software unless externally confirmed.
 */

export const APPOINTMENT_STATUS = {
  CONFIRMED: 'CONFIRMED',
  RESCHEDULED: 'RESCHEDULED',
  CANCELLED: 'CANCELLED',
};

export const VISIT_OUTCOME = {
  PENDING_VISIT: 'PENDING_VISIT',
  COMPLETED: 'COMPLETED',
  RESCHEDULED: 'RESCHEDULED',
  TOKEN_ISSUED: 'TOKEN_ISSUED',
  ADDITIONAL_DOCS_REQUESTED: 'ADDITIONAL_DOCS_REQUESTED',
  CANCELLED: 'CANCELLED',
};

export const CHECKLIST_TYPE = {
  ORIGINAL: 'ORIGINAL',
  PHOTOCOPY: 'PHOTOCOPY',
  PHOTOGRAPH: 'PHOTOGRAPH',
  PRINTED_FORM: 'PRINTED_FORM',
  FEE_EVIDENCE: 'FEE_EVIDENCE',
};

export const APPOINTMENT_DISCLAIMER =
  'Notice: Civic-Help-Setu stores your visit readiness plan locally for your convenience. ' +
  'This tool is not directly connected to government appointment reservation servers unless ' +
  'expressly confirmed with your official appointment booking receipt.';

/**
 * Standard categorized packing checklist generator based on service and requirements.
 */
export function generateVisitPackingChecklist(requirements = {}) {
  const {
    documentNames = ['Identity Proof', 'Address Proof'],
    photocopyCount = 2,
    photoCount = 2,
    feeReceiptRequired = true,
    formTitle = 'Application Form',
  } = requirements;

  const items = [];

  // 1. Originals
  documentNames.forEach((doc, idx) => {
    items.push({
      id: `chk_orig_${idx + 1}`,
      type: CHECKLIST_TYPE.ORIGINAL,
      label: `Original: ${doc}`,
      description: 'Must carry original document for physical verification at counter.',
      isPacked: false,
    });
  });

  // 2. Photocopies
  documentNames.forEach((doc, idx) => {
    items.push({
      id: `chk_copy_${idx + 1}`,
      type: CHECKLIST_TYPE.PHOTOCOPY,
      label: `Self-Attested Copies (${photocopyCount}): ${doc}`,
      description: `Prepare ${photocopyCount} photocopies signed with your signature in blue ink.`,
      isPacked: false,
    });
  });

  // 3. Photographs
  if (photoCount > 0) {
    items.push({
      id: 'chk_photo_1',
      type: CHECKLIST_TYPE.PHOTOGRAPH,
      label: `Passport Photographs (${photoCount})`,
      description: 'Recent 35x45mm photographs with plain white background.',
      isPacked: false,
    });
  }

  // 4. Printed Form
  items.push({
    id: 'chk_form_1',
    type: CHECKLIST_TYPE.PRINTED_FORM,
    label: `Printed Form: ${formTitle}`,
    description: 'Ensure all pages are printed clearly with signed declaration.',
    isPacked: false,
  });

  // 5. Fee Evidence
  if (feeReceiptRequired) {
    items.push({
      id: 'chk_fee_1',
      type: CHECKLIST_TYPE.FEE_EVIDENCE,
      label: 'Payment Evidence / Treasury Challan Slip',
      description: 'Original e-payment transaction acknowledgment or bank challan counterfoil.',
      isPacked: false,
    });
  }

  return items;
}

/**
 * In-memory appointment store.
 */
class AppointmentStore {
  constructor() {
    this.appointments = new Map();
  }

  reset() {
    this.appointments.clear();
  }

  create(appointment, ownerId) {
    if (!ownerId) throw new Error('Authorization Error: Authenticated ownerId is required');
    if (!appointment.serviceName) throw new Error('Valid serviceName is required');
    if (!appointment.officeName) throw new Error('Valid officeName is required');
    if (!appointment.appointmentDateTime) throw new Error('Valid appointmentDateTime is required');

    const dt = new Date(appointment.appointmentDateTime);
    if (isNaN(dt.getTime())) throw new Error('Invalid appointmentDateTime format');

    const id = appointment.id || `apt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const checklist =
      appointment.checklist || generateVisitPackingChecklist(appointment.requirementsConfig || {});

    const record = {
      id,
      ownerId,
      serviceName: appointment.serviceName.trim(),
      officeName: appointment.officeName.trim(),
      officeAddress: appointment.officeAddress ? appointment.officeAddress.trim() : 'Facilitation Counter',
      counterNumber: appointment.counterNumber ? String(appointment.counterNumber).trim() : 'General Counter',
      appointmentDateTime: dt.toISOString(),
      referenceNumber: appointment.referenceNumber ? String(appointment.referenceNumber).trim() : 'N/A',
      officialSourceUrl: appointment.officialSourceUrl || null,
      userNotes: appointment.userNotes ? String(appointment.userNotes).trim() : '',
      checklist,
      status: APPOINTMENT_STATUS.CONFIRMED,
      outcome: VISIT_OUTCOME.PENDING_VISIT,
      outcomeNotes: '',
      sequence: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      disclaimer: APPOINTMENT_DISCLAIMER,
    };

    this.appointments.set(id, record);
    return record;
  }

  get(id, requesterId) {
    const record = this.appointments.get(id);
    if (!record) return null;
    if (record.ownerId !== requesterId) {
      throw new Error('Access Denied: You do not have permission to view this appointment');
    }
    return record;
  }

  update(id, updates = {}, requesterId) {
    const record = this.get(id, requesterId);
    if (!record) throw new Error('Appointment not found');

    const updated = {
      ...record,
      ...updates,
      id: record.id,
      ownerId: record.ownerId, // Immutable
      updatedAt: new Date().toISOString(),
    };

    this.appointments.set(id, updated);
    return updated;
  }

  reschedule(id, newDateTime, requesterId) {
    const record = this.get(id, requesterId);
    if (!record) throw new Error('Appointment not found');

    const dt = new Date(newDateTime);
    if (isNaN(dt.getTime())) throw new Error('Invalid newDateTime format');

    record.appointmentDateTime = dt.toISOString();
    record.status = APPOINTMENT_STATUS.RESCHEDULED;
    record.sequence += 1;
    record.updatedAt = new Date().toISOString();

    this.appointments.set(id, record);
    return record;
  }

  cancel(id, reason = '', requesterId) {
    const record = this.get(id, requesterId);
    if (!record) throw new Error('Appointment not found');

    record.status = APPOINTMENT_STATUS.CANCELLED;
    record.outcome = VISIT_OUTCOME.CANCELLED;
    record.outcomeNotes = reason || 'Cancelled by citizen';
    record.sequence += 1;
    record.updatedAt = new Date().toISOString();

    this.appointments.set(id, record);
    return record;
  }

  recordOutcome(id, outcome, outcomeNotes = '', requesterId) {
    const record = this.get(id, requesterId);
    if (!record) throw new Error('Appointment not found');

    if (!Object.values(VISIT_OUTCOME).includes(outcome)) {
      throw new Error(`Invalid visit outcome: ${outcome}`);
    }

    record.outcome = outcome;
    record.outcomeNotes = String(outcomeNotes).trim();
    record.updatedAt = new Date().toISOString();

    this.appointments.set(id, record);
    return record;
  }
}

export const appointmentStore = new AppointmentStore();

/**
 * Formats a Date object into iCalendar UTC format (YYYYMMDDTHHMMSSZ).
 */
export function formatIcsDate(dateObj) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = dateObj.getUTCFullYear();
  const m = pad(dateObj.getUTCMonth() + 1);
  const d = pad(dateObj.getUTCDate());
  const h = pad(dateObj.getUTCHours());
  const min = pad(dateObj.getUTCMinutes());
  const s = pad(dateObj.getUTCSeconds());
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

/**
 * Generates an RFC 5545 compliant iCalendar (.ics) string.
 *
 * @param {Object} appointment
 * @returns {string} ICS calendar file payload
 */
export function generateAppointmentIcs(appointment) {
  if (!appointment || !appointment.appointmentDateTime) {
    throw new Error('Valid appointment with appointmentDateTime is required for ICS generation');
  }

  const startDate = new Date(appointment.appointmentDateTime);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1-hour appointment window

  const dtStamp = formatIcsDate(new Date());
  const dtStart = formatIcsDate(startDate);
  const dtEnd = formatIcsDate(endDate);

  const uid = `apt_${appointment.id}@civic-help-setu.org`;
  const summary = `Appointment: ${appointment.serviceName} at ${appointment.officeName}`;
  const location = `${appointment.officeName}, Counter: ${appointment.counterNumber}, ${appointment.officeAddress}`;
  const status = appointment.status === APPOINTMENT_STATUS.CANCELLED ? 'CANCELLED' : 'CONFIRMED';
  const sequence = appointment.sequence || 0;

  const description =
    `Civic Appointment Readiness Visit Sheet\\n` +
    `Service: ${appointment.serviceName}\\n` +
    `Reference Number: ${appointment.referenceNumber}\\n` +
    `Office: ${appointment.officeName} (Counter: ${appointment.counterNumber})\\n` +
    `Packing Checklist Items: ${appointment.checklist ? appointment.checklist.length : 0}\\n` +
    `Note: Bring required original documents and self-attested photocopies.`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Civic-Help-Setu//Appointment Readiness Workspace//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `STATUS:${status}`,
    `SEQUENCE:${sequence}`,
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
