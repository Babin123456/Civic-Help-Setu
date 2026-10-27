/**
 * Civic Appointment Preparation and Visit Pack Service (#150)
 *
 * Generates structured, ink-friendly, print-ready and downloadable citizen visit packs
 * for public service facilitation counters and appointments.
 *
 * Strict Compliance:
 * - Users can select which sections to include.
 * - Always includes verified source links and last-reviewed dates for official details.
 * - Citizen user notes are strictly EXCLUDED unless explicitly toggled on by user.
 * - Missing appointment or office information is clearly labelled (never blank or broken).
 * - Excludes vault files, sensitive identity fields, or credentials by default.
 * - Ink-friendly, high-contrast layout suitable for mobile view and monochrome paper printing.
 */

export const VISIT_PACK_SECTIONS = {
  OFFICE_DETAILS: 'office_details',
  APPOINTMENT_INFO: 'appointment_info',
  REQUIRED_DOCUMENTS: 'required_documents',
  PROCEDURAL_STEPS: 'procedural_steps',
  FEES_PAYMENT: 'fees_payment',
  REJECTION_PREVENTION: 'rejection_prevention',
  USER_NOTES: 'user_notes',
};

export const SECTION_LABELS = {
  [VISIT_PACK_SECTIONS.OFFICE_DETAILS]: 'Public Office Details, Address & Operating Hours',
  [VISIT_PACK_SECTIONS.APPOINTMENT_INFO]: 'Appointment / Token Slip Information',
  [VISIT_PACK_SECTIONS.REQUIRED_DOCUMENTS]: 'Mandatory Document Checklist & Attestation Rules',
  [VISIT_PACK_SECTIONS.PROCEDURAL_STEPS]: 'Step-by-Step Counter Submission Steps',
  [VISIT_PACK_SECTIONS.FEES_PAYMENT]: 'Government Fees & Accepted Payment Modes',
  [VISIT_PACK_SECTIONS.REJECTION_PREVENTION]: 'Common Pitfalls & Rejection Prevention Tips',
  [VISIT_PACK_SECTIONS.USER_NOTES]: 'Personal Notes & Questions to Ask (Excluded by default)',
};

/**
 * Default section configuration. Notice USER_NOTES is false by default.
 */
export const DEFAULT_SECTION_SELECTION = {
  [VISIT_PACK_SECTIONS.OFFICE_DETAILS]: true,
  [VISIT_PACK_SECTIONS.APPOINTMENT_INFO]: true,
  [VISIT_PACK_SECTIONS.REQUIRED_DOCUMENTS]: true,
  [VISIT_PACK_SECTIONS.PROCEDURAL_STEPS]: true,
  [VISIT_PACK_SECTIONS.FEES_PAYMENT]: true,
  [VISIT_PACK_SECTIONS.REJECTION_PREVENTION]: true,
  [VISIT_PACK_SECTIONS.USER_NOTES]: false, // Strictly excluded by default
};

const escapeHtml = (text) =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Sanitizes any sensitive numbers (e.g. Aadhaar, PAN) from user notes
 */
const sanitizeUserNotes = (notes) => {
  if (!notes || typeof notes !== 'string') return '';
  return notes
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[REDACTED_AADHAAR]')
    .replace(/\b[A-Za-z]{5}\d{4}[A-Za-z]{1}\b/g, '[REDACTED_PAN]');
};

/**
 * Compiles a structured visit pack data model from service, office, and appointment inputs.
 */
export const compileVisitPackData = ({
  service,
  office = null,
  appointment = null,
  sectionSelection = DEFAULT_SECTION_SELECTION,
  userNotes = '',
  includeUserNotes = false,
}) => {
  if (!service) {
    throw new Error('A valid service object is required to compile a visit pack.');
  }

  const selectedSections = {
    ...DEFAULT_SECTION_SELECTION,
    ...sectionSelection,
    // Explicit override for userNotes based on boolean flag
    [VISIT_PACK_SECTIONS.USER_NOTES]: Boolean(includeUserNotes && sectionSelection[VISIT_PACK_SECTIONS.USER_NOTES]),
  };

  // 1. Office Details (Handles missing office gracefully)
  const officeSectionData = office
    ? {
        name: office.name || 'Public Facilitation Center',
        address: office.address || '[Address details not on file - inquire at municipal reception]',
        city: office.city || '',
        state: office.state || '',
        pincode: office.pincode || '',
        landmark: office.landmark || '[No landmark recorded]',
        operatingHours: office.officeHours?.hours || '09:30 AM - 05:30 PM (Mon-Fri)',
        helpline: office.contact?.helpline || office.contact?.phone || '[Helpline not listed]',
        directionsUrl: office.directionsUrl || '',
        isAvailable: true,
      }
    : {
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
      };

  // 2. Appointment Details (Handles missing appointment gracefully)
  const appointmentSectionData = appointment
    ? {
        tokenNumber: appointment.tokenNumber || 'WALK-IN',
        appointmentDate: appointment.appointmentDate || '[Date pending confirmation]',
        timeSlot: appointment.timeSlot || '[General queue time]',
        applicantName: appointment.applicantName || 'Applicant',
        status: appointment.status || 'Confirmed',
        isBooked: true,
      }
    : {
        tokenNumber: '[No Online Token Booked - Walk-in queue token issued at reception]',
        appointmentDate: '[Walk-in during public reception hours]',
        timeSlot: 'Morning queue recommended (09:30 AM - 11:30 AM)',
        applicantName: 'Citizen Walk-in',
        status: 'Unbooked / Walk-in Mode',
        isBooked: false,
      };

  // 3. Required Documents
  const documents = Array.isArray(service.documents) && service.documents.length > 0
    ? service.documents
    : [
        'Valid Identity Proof (Aadhaar / Voter ID / Passport)',
        'Valid Proof of Address (Utility Bill / Domicile Certificate)',
        'Passport-size photographs with plain white background (x3)',
        'Self-declaration affidavit (if applicable)',
      ];

  // 4. Procedural Steps
  const steps = Array.isArray(service.steps) && service.steps.length > 0
    ? service.steps
    : [
        { title: 'Token Collection', description: 'Present yourself at reception token kiosk 15 minutes before slot.' },
        { title: 'Document Verification', description: 'Submit original documents and 2 self-attested photocopy sets at counter.' },
        { title: 'Biometrics & Fee Payment', description: 'Provide biometric capture and pay statutory treasury fees.' },
        { title: 'Acknowledgment Slip', description: 'Collect physical receipt with application reference ID.' },
      ];

  // 5. Official Verification Source Citations & Review Dates
  const officialSources = Array.isArray(service.officialSources) && service.officialSources.length > 0
    ? service.officialSources.map((s) => ({
        name: s.name || 'Official Portal',
        url: s.url || '',
        verified: Boolean(s.verified || s.isVerified),
      }))
    : [{ name: 'National Government Services Portal', url: 'https://services.india.gov.in', verified: true }];

  const lastVerifiedDate = service.lastVerified || 'Audit pending';

  // 6. User Notes (Strictly sanitized and only when requested)
  const sanitizedNotes = selectedSections[VISIT_PACK_SECTIONS.USER_NOTES]
    ? sanitizeUserNotes(userNotes)
    : '';

  return {
    serviceName: service.name,
    category: service.category || 'General Civic Service',
    department: service.department || 'Public Administration',
    fees: service.fees || '[Statutory Fee: Standard government schedule - verify at counter]',
    processingTime: service.processingTime || '15 - 30 working days',
    lastVerifiedDate,
    officialSources,
    office: officeSectionData,
    appointment: appointmentSectionData,
    documents,
    steps,
    warnings: service.warnings || [
      'Carry original documents along with 2 sets of self-attested photocopies.',
      'Reach the facilitation counter at least 15 minutes prior to scheduled slot.',
    ],
    selectedSections,
    userNotes: sanitizedNotes,
  };
};

/**
 * Generates an ink-friendly, high-contrast, black-and-white print HTML document.
 * Avoids ink-wasting dark backgrounds, heavy gradients, or huge banners.
 */
export const buildPrintableVisitPackHtml = (packData) => {
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
  } = packData;

  const nowString = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Civic Visit Pack - ${escapeHtml(serviceName)}</title>
  <style>
    @page {
      margin: 15mm;
      size: A4 portrait;
    }
    *, *:before, *:after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
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
    <div class="title">CIVIC APPOINTMENT &amp; VISIT DOSSIER</div>
    <div class="subtitle">Official Service Preparation Pack for: <strong>${escapeHtml(serviceName)}</strong> (${escapeHtml(department)})</div>
    <div class="badge-bar">
      Generated: ${escapeHtml(nowString)} &bull; Source Verified: ${escapeHtml(lastVerifiedDate)} &bull; Official SLA: ${escapeHtml(processingTime)}
    </div>
  </div>

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
    <div class="section-title">2. Public Facilitation Center Location &amp; Hours</div>
    <div><span class="meta-label">Facility Name:</span> <strong>${escapeHtml(office.name)}</strong></div>
    <div><span class="meta-label">Physical Address:</span> ${escapeHtml(office.address)} ${escapeHtml(office.city ? ', ' + office.city : '')} ${escapeHtml(office.state ? ', ' + office.state : '')} ${escapeHtml(office.pincode ? ' - ' + office.pincode : '')}</div>
    <div><span class="meta-label">Landmark:</span> ${escapeHtml(office.landmark)}</div>
    <div><span class="meta-label">Counter Operating Hours:</span> ${escapeHtml(office.operatingHours)}</div>
    <div><span class="meta-label">Public Helpline:</span> ${escapeHtml(office.helpline)}</div>
    ${office.directionsUrl ? `<div class="source-citation"><span class="meta-label">Google Maps Directions:</span> ${escapeHtml(office.directionsUrl)}</div>` : ''}
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
    <div class="section-title">5. Statutory Government Fees &amp; Mode</div>
    <div><span class="meta-label">Prescribed Fee Amount:</span> <strong>${escapeHtml(fees)}</strong></div>
    <div style="font-size: 9pt; color: #444444; margin-top: 4px;">
      Accepted Modes: Digital UPI / Debit Card at POS counter or exact cash change at cash counter.
    </div>
  </div>
  ` : ''}

  <!-- Rejection Prevention Tips -->
  ${selectedSections[VISIT_PACK_SECTIONS.REJECTION_PREVENTION] ? `
  <div class="section-block">
    <div class="section-title">6. Rejection Prevention &amp; Preparation Advice</div>
    ${warnings.map((w) => `<div>&bull; ${escapeHtml(w)}</div>`).join('')}
  </div>
  ` : ''}

  <!-- Optional Citizen Notes (Only if explicitly selected) -->
  ${selectedSections[VISIT_PACK_SECTIONS.USER_NOTES] && userNotes ? `
  <div class="section-block">
    <div class="section-title">7. Citizen Personal Notes &amp; Inquiries</div>
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
    Civic Help Setu &bull; Non-governmental open source citizen guidance dossier &bull; Does not replace statutory government paperwork &bull; www.civicbridge.in
  </div>
</body>
</html>`;
};

/**
 * Generates an ink-friendly text summary for mobile messaging / text download
 */
export const buildPrintableVisitPackText = (packData) => {
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
  } = packData;

  const lines = [
    `🏛️ CIVIC APPOINTMENT & VISIT PACK`,
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

  if (selectedSections[VISIT_PACK_SECTIONS.USER_NOTES] && userNotes) {
    lines.push(`📝 CITIZEN NOTES:`);
    lines.push(userNotes);
    lines.push(``);
  }

  lines.push(`ℹ️ Generated via Civic Help Setu &bull; Ink-friendly open citizen guide`);
  return lines.join('\n');
};
