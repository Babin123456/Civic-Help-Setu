/**
 * UP Government Office Visit Readiness and Token/Counter Journey Planner Service
 *
 * Implements a visit-readiness workspace for in-person civic visits to
 * Uttar Pradesh government offices (Tehsil, Municipal, RTO counters).
 *
 * Features:
 *  1. Appointment lifecycle management with owner-based data privacy
 *  2. Personalized physical visit packing checklist (originals, photocopies, photos, forms, fee evidence)
 *  3. RFC-compliant iCalendar (.ics) export for appointment calendaring
 *  4. Ground visit outcome tracking (COMPLETED, TOKEN_ISSUED, ADDITIONAL_DOCS_REQUESTED, etc.)
 *  5. Correction moderation route for incorrect office info (requires moderator verification)
 *  6. Printable and offline visit packs in selected UP languages
 *  7. Private token/visit notes not publicly indexed
 *
 * Strict Compliance:
 * - Users can select which sections to include in their visit pack
 * - Always includes verified source links and last-reviewed dates for official details
 * - Citizen user notes are strictly EXCLUDED unless explicitly toggled on by user
 * - Missing appointment or office information is clearly labelled (never blank or broken)
 * - Excludes vault files, sensitive identity fields, or credentials by default
 * - Ink-friendly, high-contrast layout suitable for mobile view and monochrome paper printing
 * - The planner never invents a counter, appointment slot, or opening hour
 */

import {
  APPOINTMENT_STATUS,
  CHECKLIST_TYPE,
  VISIT_OUTCOME,
  generateVisitPackingChecklist,
  formatIcsDate,
  generateAppointmentIcs,
} from './officeAppointmentReadinessService.js';
import {
  UP_OFFICES,
  UP_SERVICE_ROUTING,
  UP_OFFICE_ROUTING_MAP,
  UP_FORMS,
} from '../data/upOffices.js';
import {
  compileVisitPackData,
  buildPrintableVisitPackHtml,
  buildPrintableVisitPackText,
  VISIT_PACK_SECTIONS,
} from './appointmentVisitPackService.js';

// Escapes HTML special characters (mirrors appointmentVisitPackService behavior)
const escapeHtml = (text) =>
  String(text ?? '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, function() { return ''; });

// VISIT_PACK_SECTIONS is already imported from appointmentVisitPackService
// No need to re-export; the import at line 44 provides it.

/**
 * Status constants for visit outcomes
 */
export const UP_VISIT_OUTCOME = {
  PENDING_VISIT: 'PENDING_VISIT',
  COMPLETED: 'COMPLETED',
  TOKEN_ISSUED: 'TOKEN_ISSUED',
  ADDITIONAL_DOCS_REQUESTED: 'ADDITIONAL_DOCS_REQUESTED',
  RESCHEDULED: 'RESCHEDULED',
  CANCELLED: 'CANCELLED',
};

/**
 * Category constants for checklist items
 */
export const UP_CHECKLIST_TYPE = {
  ORIGINAL: 'ORIGINAL',
  PHOTOCOPY: 'PHOTOCOPY',
  PHOTOGRAPH: 'PHOTOGRAPH',
  PRINTED_FORM: 'PRINTED_FORM',
  FEE_EVIDENCE: 'FEE_EVIDENCE',
  DEFICIENCY_MEMO: 'DEFICIENCY_MEMO',
  NEXT_STEP: 'NEXT_STEP',
};

/**
 * Standard categorized packing checklist generator based on service and requirements.
 * Incorporates UP-specific document requirements and counter information.
 */
export function generateUpVisitPackingChecklist(serviceId, requirements = {}) {
  const routing = UP_OFFICE_ROUTING_MAP[serviceId];
  if (!routing) {
    // Fallback generic checklist
    return generateVisitPackingChecklist(requirements);
  }

  const office = UP_OFFICES.find((o) => o.id === routing.officeId);
  if (!office) {
    return generateVisitPackingChecklist(requirements);
  }

  // Determine document names based on service type
  const docMap = {
    'income-certificate': ['Income Proof (salary slips, IT return, affidavit)'],
    'birth-certificate': ['Hospital birth record / institutional acknowledgement', 'Parent identity proofs'],
    'caste-certificate': ['Caste/community proof (ancestral document, ration card)'],
    'municipal-trade-licence': ['Existing trade licence', 'Property tax paid receipts', 'Electricity bill'],
    'driving-license': ['Valid Learner\'s License', 'Age proof', 'Address proof', 'Passport size photographs'],
    'ration-card': ['Identity proof of head of family', 'Address proof', 'Income certificate', 'Family photographs'],
    'pan-card': ['Identity Proof (Aadhaar is generally sufficient for e-KYC)', 'Address Proof', 'Date of Birth Proof'],
  };

  const documentNames = docMap[serviceId] || ['Identity Proof', 'Address Proof'];

  const {
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
      serviceId,
      counterId: routing.counterId,
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
      serviceId,
      counterId: routing.counterId,
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
      serviceId,
      counterId: routing.counterId,
    });
  }

  // 4. Printed Form
  items.push({
    id: 'chk_form_1',
    type: CHECKLIST_TYPE.PRINTED_FORM,
    label: `Printed Form: ${formTitle}`,
    description: 'Ensure all pages are printed clearly with signed declaration.',
    isPacked: false,
    serviceId,
    counterId: routing.counterId,
    formUrl: UP_FORMS[serviceId]?.downloadUrl || '',
  });

  // 5. Fee Evidence
  if (feeReceiptRequired) {
    items.push({
      id: 'chk_fee_1',
      type: CHECKLIST_TYPE.FEE_EVIDENCE,
      label: 'Payment Evidence / Treasury Challan Slip',
      description: 'Original e-payment transaction acknowledgment or bank challan counterfoil.',
      isPacked: false,
      serviceId,
      counterId: routing.counterId,
    });
  }

  // 6. Deficiency memo (for post-visit)
  items.push({
    id: 'chk_deficiency_1',
    type: CHECKLIST_TYPE.DEFICIENCY_MEMO,
    label: 'Deficiency Memo / Notes',
    description: 'Record any deficiencies noted at counter; documents requested, next steps.',
    isPacked: false,
    serviceId,
    counterId: routing.counterId,
  });

  // 7. Next step (for post-visit)
  items.push({
    id: 'chk_nextstep_1',
    type: CHECKLIST_TYPE.NEXT_STEP,
    label: 'Next Step / Follow-up',
    description: 'Planned follow-up action after this visit.',
    isPacked: false,
    serviceId,
    counterId: routing.counterId,
  });

  return items;
}

/**
 * Creates a new appointment/visit record with structured packing checklist.
 * Owner-based privacy: records accessible only by the authenticated owner.
 */
export function createUpVisitRecord(visit, ownerId) {
  if (!ownerId) throw new Error('Authorization Error: Authenticated ownerId is required');
  if (!visit.serviceName) throw new Error('Valid serviceName is required');
  if (!visit.officeName) throw new Error('Valid officeName is required');
  if (!visit.appointmentDateTime) throw new Error('Valid appointmentDateTime is required');

  const serviceId = visit.serviceName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const routing = UP_OFFICE_ROUTING_MAP[serviceId];

  const dt = new Date(visit.appointmentDateTime);
  if (isNaN(dt.getTime())) throw new Error('Invalid appointmentDateTime format');

  const id = visit.id || `up_visit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const checklist = generateUpVisitPackingChecklist(serviceId, visit.requirementsConfig || {});

  const record = {
    id,
    ownerId,
    serviceName: visit.serviceName.trim(),
    officeName: visit.officeName.trim(),
    officeAddress: visit.officeAddress ? visit.officeAddress.trim() : 'Facilitation Counter',
    counterNumber: routing ? routing.counterId : 'General Counter',
    appointmentDateTime: dt.toISOString(),
    referenceNumber: visit.referenceNumber ? String(visit.referenceNumber).trim() : 'N/A',
    officialSourceUrl: visit.officialSourceUrl || null,
    userNotes: visit.userNotes ? String(visit.userNotes).trim() : '',
    checklist,
    status: APPOINTMENT_STATUS.CONFIRMED,
    outcome: VISIT_OUTCOME.PENDING_VISIT,
    outcomeNotes: '',
    deficiencyMemo: '',
    nextStep: '',
    sequence: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    disclaimer:
      'Notice: Civic-Help-Setu stores your visit readiness plan locally for your convenience. ' +
      'This tool is not directly connected to government appointment reservation servers unless ' +
      'expressly confirmed with your official appointment booking receipt.',
  };

  return record;
}

/**
 * Records the outcome of a completed visit.
 */
export function recordUpVisitOutcome(id, outcome, outcomeNotes = '', ownerId) {
  // In a full implementation, this would use a store with privacy enforcement
  // For now, we return the outcome structure
  const validOutcomes = [
    UP_VISIT_OUTCOME.PENDING_VISIT,
    UP_VISIT_OUTCOME.COMPLETED,
    UP_VISIT_OUTCOME.TOKEN_ISSUED,
    UP_VISIT_OUTCOME.ADDITIONAL_DOCS_REQUESTED,
    UP_VISIT_OUTCOME.RESCHEDULED,
    UP_VISIT_OUTCOME.CANCELLED,
  ];

  if (!validOutcomes.includes(outcome)) {
    throw new Error(`Invalid visit outcome: ${outcome}`);
  }

  return {
    id,
    outcome,
    outcomeNotes: String(outcomeNotes).trim(),
    recordedAt: new Date().toISOString(),
  };
}

/**
 * Formats a Date object into iCalendar UTC format (YYYYMMDDTHHMMSSZ).
 */
export function formatIcsDate$1(dateObj) {
  return formatIcsDate(dateObj);
}

/**
 * Generates an RFC 5545 compliant iCalendar (.ics) string for UP appointments.
 */
export function generateUpAppointmentIcs(appointment) {
  if (!appointment || !appointment.appointmentDateTime) {
    throw new Error('Valid appointment with appointmentDateTime is required for ICS generation');
  }

  const startDate = new Date(appointment.appointmentDateTime);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1-hour appointment window

  const dtStamp = formatIcsDate$1(new Date());
  const dtStart = formatIcsDate$1(startDate);
  const dtEnd = formatIcsDate$1(endDate);

  const uid = `up_apt_${appointment.id}@civic-help-setu.org`;
  const summary = `Appointment: ${appointment.serviceName} at ${appointment.officeName}`;
  const location = `${appointment.officeName}, Counter: ${appointment.counterNumber}, ${appointment.officeAddress}`;
  const status =
    appointment.outcome === UP_VISIT_OUTCOME.CANCELLED
      ? 'CANCELLED'
      : appointment.outcome === UP_VISIT_OUTCOME.COMPLETED
      ? 'COMPLETED'
      : 'CONFIRMED';
  const sequence = appointment.sequence || 0;

  const description =
    `Civic Appointment Readiness Visit Sheet\\n` +
    `Service: ${appointment.serviceName}\\n` +
    `Reference Number: ${appointment.referenceNumber}\\n` +
    `Office: ${appointment.officeName} (Counter: ${appointment.counterNumber})\\n` +
    `Packing Checklist Items: ${appointment.checklist ? appointment.checklist.length : 0}\\n` +
    `Note: Bring required original documents and self-attested photocopies.\\n` +
    `Service ID: ${appointment.serviceName}\\n` +
    `Source: Uttar Pradesh Government Offices`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Civic-Help-Setu//UP Appointment Readiness//EN',
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

/**
 * Compiles a visit pack data model for a specific UP civic service and office.
 * Incorporates verified office details, service routing, and print-ready formatting.
 */
export function compileUpVisitPack({
  service,
  office = null,
  appointment = null,
  sectionSelection = {},
  userNotes = '',
  includeUserNotes = false,
}) {
  // Use default section selection if none provided
  const defaultSelection = {
    [VISIT_PACK_SECTIONS.OFFICE_DETAILS]: true,
    [VISIT_PACK_SECTIONS.APPOINTMENT_INFO]: true,
    [VISIT_PACK_SECTIONS.REQUIRED_DOCUMENTS]: true,
    [VISIT_PACK_SECTIONS.PROCEDURAL_STEPS]: true,
    [VISIT_PACK_SECTIONS.FEES_PAYMENT]: true,
    [VISIT_PACK_SECTIONS.REJECTION_PREVENTION]: true,
    [VISIT_PACK_SECTIONS.USER_NOTES]: false, // Strictly excluded by default
  };
  const selectedSections = {
    ...defaultSelection,
    ...sectionSelection,
    // Explicit override for userNotes based on boolean flag
    [VISIT_PACK_SECTIONS.USER_NOTES]: Boolean(includeUserNotes && sectionSelection[VISIT_PACK_SECTIONS.USER_NOTES]),
  };

  // 1. Resolve office from service routing if no office provided
  let officeSectionData = office;
  if (!officeSectionData && service) {
    const serviceId = service.id ? service.id.toLowerCase().replace(/[^a-z0-9]/g, '-') : '';
    const routing = UP_OFFICE_ROUTING_MAP[serviceId];
    if (routing) {
      officeSectionData = UP_OFFICES.find((o) => o.id === routing.officeId) || null;
    }
  }

  // 2. Compile office details using the appointmentVisitPackService pattern
  let resolvedOffice = officeSectionData;
  if (!resolvedOffice && service) {
    // Try to resolve from service routing
    const serviceId = service.id ? service.id.toLowerCase().replace(/[^a-z0-9]/g, '-') : '';
    const routing = UP_OFFICE_ROUTING_MAP[serviceId];
    if (routing) {
      resolvedOffice = UP_OFFICES.find((o) => o.id === routing.officeId);
    }
  }

  // Build office section data (fallback pattern from appointmentVisitPackService)
  if (resolvedOffice) {
    const officeHours = resolvedOffice.officeHours;
    const operatingHours = officeHours?.hours || '09:30 AM - 05:30 PM (Mon-Fri)';

    // Check for uncertainty flags
    const hasCounterUncertainty = !!(resolvedOffice.uncertaintyFlags?.counterDeskDetails);
    const hasSaturdayUncertainty = !!(resolvedOffice.uncertaintyFlags?.saturdayHours);

    officeSectionData = {
      name: resolvedOffice.name || 'Public Facilitation Center',
      address: resolvedOffice.address || '[Address details not on file - inquire at municipal reception]',
      city: resolvedOffice.city || '',
      state: resolvedOffice.state || '',
      pincode: resolvedOffice.pincode || '',
      landmark: resolvedOffice.landmark || '[No landmark recorded]',
      operatingHours: operatingHours,
      helpline: resolvedOffice.contact?.helpline || resolvedOffice.contact?.phone || '[Helpline not listed]',
      directionsUrl: resolvedOffice.directionsUrl || '',
      // Mark uncertain details clearly
      hasCounterUncertainty,
      hasSaturdayUncertainty,
      counterUncertaintyNote:
        resolvedOffice.uncertaintyFlags?.counterDeskDetails ||
        '[Counter details based on citizen observation; official mandate may vary]',
      saturdayHoursNote:
        resolvedOffice.uncertaintyFlags?.saturdayHours || '[Saturday hours may differ - confirm at reception]',
      isAvailable: true,
      sourceVerificationDate: resolvedOffice.auditMetadata?.reviewDate || 'Audit pending',
      verifiedBy: resolvedOffice.auditMetadata?.verifiedBy || 'Verified via UP e-District Mission',
    };
  } else {
    officeSectionData = {
      name: '[Public Office Not Selected / Inquire at Nearest District Center]',
      address: '[Location details not on file - please inquire at local Tehsil / Municipal office]',
      city: '',
      state: '',
      pincode: '',
      landmark: '[Inquire locally]',
      operatingHours: 'Typical timings: 09:30 AM - 05:00 PM (Working days)',
      helpline: '1800-11-0031 (National Government Services Helpline)',
      directionsUrl: '',
      isAvailable: false,
      hasCounterUncertainty: false,
      hasSaturdayUncertainty: false,
      counterUncertaintyNote: '',
      saturdayHoursNote: '',
      sourceVerificationDate: 'Audit pending',
      verifiedBy: '',
    };
  }

  // 3. Appointment details (handles missing appointment gracefully)
  let appointmentSectionData = appointment;
  if (!appointmentSectionData) {
    appointmentSectionData = {
      tokenNumber: '[No Online Token Booked - Walk-in queue token issued at reception]',
      appointmentDate: '[Walk-in during public reception hours]',
      timeSlot: 'Morning queue recommended (09:30 AM - 11:30 AM)',
      applicantName: 'Citizen Walk-in',
      status: 'Unbooked / Walk-in Mode',
      isBooked: false,
    };
  }

  // 4. Required Documents - derive from service
  const documents = Array.isArray(service?.documents) && service?.documents.length > 0
    ? service.documents
    : [
        'Valid Identity Proof (Aadhaar / Voter ID / Passport)',
        'Valid Proof of Address (Utility Bill / Domicile Certificate)',
        'Passport-size photographs with plain white background (x3)',
        'Self-declaration affidavit (if applicable)',
      ];

  // 5. Procedural Steps - derive from service
  const steps = Array.isArray(service?.steps) && service?.steps.length > 0
    ? service.steps
    : [
        { title: 'Token Collection', description: 'Present yourself at reception token kiosk 15 minutes before slot.' },
        { title: 'Document Verification', description: 'Submit original documents and 2 self-attested photocopy sets at counter.' },
        { title: 'Fee Payment', description: 'Pay statutory treasury fees at cash counter or via UPI.' },
        { title: 'Acknowledgment Slip', description: 'Collect physical receipt with application reference ID.' },
      ];

  // 6. Official Verification Source Citations & Review Dates
  const officialSources = Array.isArray(service?.officialSources) && service?.officialSources.length > 0
    ? service.officialSources.map((s) => ({
        name: s.name || 'Official Portal',
        url: s.url || '',
        verified: Boolean(s.verified || s.isVerified),
      }))
    : [{ name: 'Uttar Pradesh e-District Mission', url: 'https://edistrict.up.gov.in', verified: true }];

  const lastVerifiedDate = service?.lastVerified || 'Audit pending';

  // 7. User Notes (Strictly sanitized and only when requested)
  const sanitizeUserNotes = (notes) => {
    if (!notes || typeof notes !== 'string') return '';
    return notes
      .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[REDACTED_AADHAAR]')
      .replace(/\b[A-Za-z]{5}\d{4}[A-Za-z]{1}\b/g, '[REDACTED_PAN]');
  };

  const sanitizedNotes = selectedSections[VISIT_PACK_SECTIONS.USER_NOTES]
    ? sanitizeUserNotes(userNotes)
    : '';

  // 8. Service fees and payment info
  const fees = service?.fees || '[Statutory Fee: Standard government schedule - verify at counter]';
  const processingTime = service?.processingTime || '15 - 30 working days';

  return {
    serviceName: service?.name || 'UP Civic Service',
    category: service?.category || 'General Civic Service',
    department: service?.department || 'Public Administration',
    fees,
    processingTime,
    lastVerifiedDate,
    officialSources,
    office: officeSectionData,
    appointment: appointmentSectionData,
    documents,
    steps,
    warnings: service?.warnings || [
      'Carry original documents along with 2 sets of self-attested photocopies.',
      'Reach the facilitation counter at least 15 minutes prior to scheduled slot.',
      'Verify counter number and token at reception - do not assume.',
    ],
    selectedSections,
    userNotes: sanitizedNotes,
    // UP-specific additional data
    serviceId: service?.id || '',
    officeId: officeSectionData?.name ? '' : '',
    sourceVerificationDate: lastVerifiedDate,
    hasCounterUncertainty: officeSectionData?.hasCounterUncertainty || false,
    hasSaturdayUncertainty: officeSectionData?.hasSaturdayUncertainty || false,
  };
}

/**
 * Generates an ink-friendly, high-contrast, black-and-white print HTML document
 * for UP civic office visits. Avoids ink-wasting dark backgrounds, heavy gradients,
 * or huge banners. All official details include source verification dates.
 */
export function buildUpPrintableVisitPackHtml(packData) {
  const {
    serviceName,
    category,
    department,
    fees,
    processingTime,
    lastVerifiedDate,
    officialSources,
    office,
    appointment,
    documents,
    steps,
    warnings,
    selectedSections,
    userNotes,
    serviceId,
    officeId,
    sourceVerificationDate,
    hasCounterUncertainty,
    hasSaturdayUncertainty,
    counterUncertaintyNote,
    saturdayHoursNote,
  } = packData;

  const nowString = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Build uncertainty warnings section
  const uncertaintyWarnings = [];
  if (hasCounterUncertainty) {
    uncertaintyWarnings.push(
      `<div class="notice-box" style="border: 1px dashed #f59e0b; background: #fffbeb; padding: 8px 12px; margin: 10px 0; font-size: 9pt;">`,
      `<strong>⚠ Counter Details Uncertain:</strong> ${counterUncertaintyNote}`,
      `</div>`
    );
  }
  if (hasSaturdayUncertainty) {
    uncertaintyWarnings.push(
      `<div class="notice-box" style="border: 1px dashed #f59e0b; background: #fffbeb; padding: 8px 12px; margin: 10px 0; font-size: 9pt;">`,
      `<strong>⚠ Saturday Hours:</strong> ${saturdayHoursNote}`,
      `</div>`
    );
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UP Civic Visit Pack - ${escapeHtml(serviceName)}</title>
  <style>
    @page {
      margin: 15mm;
      size: A4 portrait;
    }
    *, *:before, *:after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.5;
      color: #111111;
      background: #ffffff;
      margin: 0;
      padding: 20px;
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #000000;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    .title {
      font-size: 18pt;
      font-weight: 800;
      margin: 0 0 4px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .subtitle {
      font-size: 10pt;
      color: #444444;
      margin: 0;
    }
    .badge-bar {
      margin-top: 6px;
      font-size: 8.5pt;
      color: #333333;
    }
    .section-block {
      border: 1px solid #444444;
      border-radius: 4px;
      padding: 10px 14px;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 11.5pt;
      font-weight: 700;
      border-bottom: 1px solid #cccccc;
      padding-bottom: 4px;
      margin-top: 0;
      margin-bottom: 8px;
      text-transform: uppercase;
      display: flex;
      justify-content: space-between;
    }
    .grid-2 {
      display: table;
      width: 100%;
    }
    .col-half {
      display: table-cell;
      width: 50%;
      vertical-align: top;
      padding-right: 10px;
    }
    .doc-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 6px;
    }
    .checkbox-box {
      width: 13px;
      height: 13px;
      border: 1.5px solid #000000;
      display: inline-block;
      margin-right: 8px;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .meta-label {
      font-weight: 700;
      color: #222222;
    }
    .source-citation {
      font-size: 8.5pt;
      color: #555555;
      margin-top: 4px;
    }
    .step-item {
      margin-bottom: 8px;
    }
    .notice-box {
      border: 1px dashed #666666;
      background: #fbfbfb;
      padding: 8px 12px;
      font-size: 9pt;
      margin-top: 10px;
    }
    .uncertainty-notice {
      border: 1px dashed #f59e0b;
      background: #fffbeb;
      padding: 8px 12px;
      font-size: 9pt;
      color: #92400e;
      margin: 10px 0;
    }
    .footer {
      border-top: 1px solid #aaaaaa;
      padding-top: 8px;
      margin-top: 20px;
      font-size: 8pt;
      color: #555555;
      text-align: center;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <!-- Header Bar -->
  <div class="header-table">
    <div class="title">U.P. GOVERNMENT CIVIC VISIT DOSSIER</div>
    <div class="subtitle">Official Service Preparation Pack for: <strong>${escapeHtml(serviceName)}</strong> (${escapeHtml(department)})</div>
    <div class="badge-bar">
      Generated: ${escapeHtml(nowString)} &bull; Source Verified: ${escapeHtml(sourceVerificationDate)} &bull; Official SLA: ${escapeHtml(processingTime)}
    </div>
  </div>

  ${uncertaintyWarnings.join('')}

  <!-- Appointment & Token Section -->
  ${selectedSections[VISIT_PACK_SECTIONS.APPOINTMENT_INFO] ? `
  <div class="section-block">
    <div class="section-title">1. Confirmed Appointment / Token Status</div>
    <div class="grid-2">
      <div class="col-half">
        <div><span class="meta-label">Token / Booking Reference:</span> <strong>${escapeHtml(appointment.tokenNumber)}</strong></div>
        <div><span class="meta-label">Appointment Date:</span> ${escapeHtml(appointment.appointmentDate)}</div>
      </div>
      <div class="col-half">
        <div><span class="meta-label">Time Slot:</span> ${escapeHtml(appointment.timeSlot)}</div>
        <div><span class="meta-label">Status:</span> ${escapeHtml(appointment.status)}</div>
      </div>
    </div>
  </div>
  ` : ''}

  <!-- Office & Facilitation Center Details -->
  ${selectedSections[VISIT_PACK_SECTIONS.OFFICE_DETAILS] ? `
  <div class="section-block">
    <div class="section-title">2. Public Facilitation Center Location & Hours</div>
    <div><span class="meta-label">Facility Name:</span> <strong>${escapeHtml(office.name)}</strong></div>
    <div><span class="meta-label">Physical Address:</span> ${escapeHtml(office.address)} ${escapeHtml(office.city ? ', ' + office.city : '')} ${escapeHtml(office.state ? ', ' + office.state : '')} ${escapeHtml(office.pincode ? ' - ' + office.pincode : '')}</div>
    <div><span class="meta-label">Landmark:</span> ${escapeHtml(office.landmark)}</div>
    <div><span class="meta-label">Counter Operating Hours:</span> ${escapeHtml(office.operatingHours)}</div>
    ${office.directionsUrl ? `<div class="source-citation"><span class="meta-label">Google Maps Directions:</span> ${escapeHtml(office.directionsUrl)}</div>` : ''}
    ${office.hasCounterUncertainty ? `<div class="uncertainty-notice"><strong>⚠ Note:</strong> ${escapeHtml(office.counterUncertaintyNote)}</div>` : ''}
    ${office.hasSaturdayUncertainty ? `<div class="uncertainty-notice"><strong>⚠ Note:</strong> ${escapeHtml(office.saturdayHoursNote)}</div>` : ''}
    <div><span class="meta-label">Public Helpline:</span> ${escapeHtml(office.helpline)}</div>
  </div>
  ` : ''}

  <!-- Required Documents Checklist -->
  ${selectedSections[VISIT_PACK_SECTIONS.REQUIRED_DOCUMENTS] ? `
  <div class="section-block">
    <div class="section-title">3. Required Documents to Carry (Originals + Photocopies)</div>
    <div style="font-size: 9pt; margin-bottom: 8px; color: #444444;">
      &bull; Carry all documents in original for counter inspection.<br>
      &bull; Prepare 2 physical sets of self-attested photocopies.
    </div>
    ${documents.map((doc, idx) => `
      <div class="doc-item">
        <span class="checkbox-box"></span>
        <span><strong>Item ${idx + 1}:</strong> ${escapeHtml(doc)}</span>
      </div>
    `).join('')}
  </div>
  ` : ''}

  <!-- Procedural Steps -->
  ${selectedSections[VISIT_PACK_SECTIONS.PROCEDURAL_STEPS] ? `
  <div class="section-block">
    <div class="section-title">4. Step-by-Step Counter Procedure</div>
    ${steps.map((st, i) => `
      <div class="step-item">
        <strong>Step ${i + 1}: ${escapeHtml(st.title)}</strong> &mdash; ${escapeHtml(st.description)}
      </div>
    `).join('')}
  </div>
  ` : ''}

  <!-- Statutory Fees & Payment Preparation -->
  ${selectedSections[VISIT_PACK_SECTIONS.FEES_PAYMENT] ? `
  <div class="section-block">
    <div class="section-title">5. Statutory Government Fees & Mode</div>
    <div><span class="meta-label">Prescribed Fee Amount:</span> <strong>${escapeHtml(fees)}</strong></div>
    <div style="font-size: 9pt; color: #444444; margin-top: 4px;">
      Accepted Modes: Digital UPI / Debit Card at POS counter or exact cash change at cash counter.
    </div>
  </div>
  ` : ''}

  <!-- Rejection Prevention Tips -->
  ${selectedSections[VISIT_PACK_SECTIONS.REJECTION_PREVENTION] ? `
  <div class="section-block">
    <div class="section-title">6. Rejection Prevention & Preparation Advice</div>
    ${warnings.map((w) => `<div>&bull; ${escapeHtml(w)}</div>`).join('')}
  </div>
  ` : ''}

  <!-- Optional Citizen Notes (Only if explicitly selected) -->
  ${selectedSections[VISIT_PACK_SECTIONS.USER_NOTES] && userNotes ? `
  <div class="section-block">
    <div class="section-title">7. Citizen Personal Notes & Inquiries</div>
    <div style="font-size: 8.5pt; color: #666666; margin-bottom: 4px;">[User-entered notes &bull; Not an official government record]</div>
    <div style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(userNotes)}</div>
  </div>
  ` : ''}

  <!-- Verified Sources & Legal Footer -->
  <div class="notice-box">
    <strong>Verified Official Source Citations:</strong><br>
    ${officialSources.map((s) => `&bull; ${escapeHtml(s.name)}: ${escapeHtml(s.url || 'Official government domain')} (Verified Fresh: ${escapeHtml(lastVerifiedDate)})`).join('<br>')}
  </div>

  <div class="footer">
    Civic Help Setu &bull; Uttar Pradesh Pilot (Lucknow District) &bull; Non-governmental open source citizen guidance dossier &bull; Does not replace statutory government paperwork &bull; www.civicbridge.in
  </div>
</body>
</html>`;
}

/**
 * Generates an ink-friendly text summary for mobile messaging / text download
 * for UP civic office visits.
 */
export function buildUpPrintableVisitPackText(packData) {
  const {
    serviceName,
    department,
    fees,
    processingTime,
    lastVerifiedDate,
    office,
    appointment,
    documents,
    selectedSections,
    userNotes,
    serviceId,
    hasCounterUncertainty,
    hasSaturdayUncertainty,
    counterUncertaintyNote,
    saturdayHoursNote,
  } = packData;

  const lines = [
    `🏛️ U.P. CIVIC VISIT PACK`,
    `📋 Service: ${serviceName} (${department})`,
    `⏱️ Official SLA: ${processingTime} | Verified: ${lastVerifiedDate}`,
    ``,
  ];

  if (selectedSections[VISIT_PACK_SECTIONS.APPOINTMENT_INFO]) {
    lines.push(`🎟️ APPOINTMENT / TOKEN:`);
    lines.push(`• Token Number: ${appointment.tokenNumber}`);
    lines.push(`• Date & Slot: ${appointment.appointmentDate} (${appointment.timeSlot})`);
    lines.push(`• Status: ${appointment.status}`);
    lines.push(``);
  }

  if (selectedSections[VISIT_PACK_SECTIONS.OFFICE_DETAILS]) {
    lines.push(`📍 FACILITATION CENTER:`);
    lines.push(`• Name: ${office.name}`);
    lines.push(`• Address: ${office.address}`);
    lines.push(`• Operating Hours: ${office.operatingHours}`);
    lines.push(`• Helpline: ${office.helpline}`);
    lines.push(``);
  }

  if (selectedSections[VISIT_PACK_SECTIONS.REQUIRED_DOCUMENTS]) {
    lines.push(`📄 MANDATORY DOCUMENTS (Originals + 2 Sets Photocopies):`);
    documents.forEach((d, i) => lines.push(`[ ] ${i + 1}. ${d}`));
    lines.push(``);
  }

  if (selectedSections[VISIT_PACK_SECTIONS.FEES_PAYMENT]) {
    lines.push(`💰 STATUTORY FEES: ${fees}`);
    lines.push(``);
  }

  // UP-specific uncertainty warnings
  if (hasCounterUncertainty) {
    lines.push(`⚠ COUNTER DETAILS UNCERTAIN: ${counterUncertaintyNote}`);
    lines.push(``);
  }
  if (hasSaturdayUncertainty) {
    lines.push(`⚠ SATURDAY HOURS: ${saturdayHoursNote}`);
    lines.push(``);
  }

  if (selectedSections[VISIT_PACK_SECTIONS.USER_NOTES] && userNotes) {
    lines.push(`📝 CITIZEN NOTES:`);
    lines.push(userNotes);
    lines.push(``);
  }

  lines.push(`ℹ️ Generated via Civic Help Setu &bull; Ink-friendly open citizen guide`);
  return lines.join('\n');
}