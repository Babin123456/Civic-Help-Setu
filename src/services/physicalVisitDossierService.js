/**
 * Physical Office Visit Dossier & Checklist Service (#434)
 *
 * Provides a structured pre-departure checklist for citizens visiting government
 * facilitation centers, municipal desks, RTOs, PSKs, and Tehsildar offices.
 * Prevents multiple trips by validating physical originals, photocopies, photo
 * dimensions, cash/challan tender, stationary, and public dealing token windows.
 */

/**
 * Standard public office types recognized across India.
 */
export const OFFICE_TYPES = Object.freeze({
  RTO: 'rto',
  PASSPORT: 'passport',
  TEHSILDAR: 'tehsildar',
  MUNICIPAL: 'municipal',
  CSC_AADHAAR: 'csc_aadhaar',
  GENERAL: 'general',
});

/**
 * Infer office archetype from office name, channel, or service.
 * @param {Object} office
 * @param {Object} [service]
 * @returns {string} One of OFFICE_TYPES
 */
export function inferOfficeType(office, service) {
  const text = `${office?.name || ''} ${office?.channel || ''} ${office?.department || ''} ${service?.name || ''}`.toLowerCase();

  if (text.includes('rto') || text.includes('transport') || text.includes('driving license')) {
    return OFFICE_TYPES.RTO;
  }
  if (text.includes('passport') || text.includes('psk') || text.includes('post office passport')) {
    return OFFICE_TYPES.PASSPORT;
  }
  if (text.includes('tehsil') || text.includes('taluk') || text.includes('sdm') || text.includes('revenue') || text.includes('patwari')) {
    return OFFICE_TYPES.TEHSILDAR;
  }
  if (text.includes('municipal') || text.includes('ward') || text.includes('corporation') || text.includes('panchayat')) {
    return OFFICE_TYPES.MUNICIPAL;
  }
  if (text.includes('aadhaar') || text.includes('csc') || text.includes('seva kendra') || text.includes('bangalore one') || text.includes('meeseva')) {
    return OFFICE_TYPES.CSC_AADHAAR;
  }
  return OFFICE_TYPES.GENERAL;
}

/**
 * Generate comprehensive physical visit dossier tailored to office and service.
 * @param {Object} params
 * @param {Object} params.office Office location record
 * @param {Object} [params.service] Selected civic service record
 * @returns {Object} Complete visit dossier
 */
export function generatePhysicalVisitDossier({ office, service } = {}) {
  const officeType = inferOfficeType(office, service);
  const officeName = office?.name || 'Local Public Facilitation Center';
  const serviceName = service?.name || 'Civic Document Verification & Submission';

  // Base Document Checklist
  const documentChecklist = [
    {
      item: 'Original Proof of Identity (POI)',
      quantity: 1,
      originalRequired: true,
      note: 'Aadhaar Card, Voter ID, PAN Card, or Passport (officer will inspect and return immediately).',
    },
    {
      item: 'Self-Attested Photocopies of Identity Proof',
      quantity: 2,
      originalRequired: false,
      note: 'Sign across the lower half with current date in blue/black ink.',
    },
    {
      item: 'Original Proof of Address (POA)',
      quantity: 1,
      originalRequired: true,
      note: 'Utility bill, bank passbook, or domicile certificate matching application address.',
    },
    {
      item: 'Self-Attested Photocopies of Address Proof',
      quantity: 2,
      originalRequired: false,
      note: 'Ensure address line and PIN code are clearly legible.',
    },
  ];

  // Specific overrides based on office archetype
  let photoSpecifications = {
    required: true,
    count: 3,
    dimensions: '3.5 cm x 4.5 cm (Standard Passport Size)',
    background: 'Plain White or Off-White background',
    note: 'Recent photo (taken within last 6 months) with neutral facial expression.',
  };

  let paymentPreparation = {
    estimatedAmount: '₹50 – ₹100',
    modesAccepted: ['Exact Cash', 'UPI / Bharat QR (where network available)'],
    tenderAdvice: 'Carry small denomination notes (₹10, ₹20, ₹50). Counter operators often run out of change.',
  };

  let stationaryPack = [
    'Black or Blue ballpoint pen (gel/fountain pens are disallowed for official records)',
    'Glue stick (for fixing photos on physical application forms)',
    'Standard paper clips or clear folder (to avoid staples puncturing barcodes)',
  ];

  let counterTimings = {
    publicDealingHours: '10:00 AM – 1:30 PM',
    tokenCutoffTime: '12:30 PM (Tokens exhausted early during peak hours)',
    bestArrivalWindow: '9:30 AM – 10:15 AM (Lowest wait times)',
    lunchRecess: '1:30 PM – 2:00 PM (No public counter dealing)',
  };

  // Archetype customizations
  if (officeType === OFFICE_TYPES.PASSPORT) {
    photoSpecifications = {
      required: false,
      count: 0,
      dimensions: 'Biometric Live Capture at Counter',
      background: 'Official PSK photographic booth',
      note: 'No physical photographs required for adult citizens; biometric camera capture is conducted at Counter A.',
    };
    paymentPreparation = {
      estimatedAmount: 'Prepaid online / Optional ₹50 SMS alert cash',
      modesAccepted: ['Online Application Prepaid', 'Cash for Value-Added SMS'],
      tenderAdvice: 'Main statutory fee is collected during online slot booking; keep ₹50 cash for optional SMS update service.',
    };
    counterTimings = {
      publicDealingHours: '9:00 AM – 4:30 PM',
      tokenCutoffTime: 'Batch-specific strictly as printed on Appointment Receipt',
      bestArrivalWindow: 'Arrive strictly 15 minutes before batch reporting time',
      lunchRecess: 'Continuous staggered counter operations',
    };
    documentChecklist.push({
      item: 'Printed Application Receipt (ARN Sheet)',
      quantity: 1,
      originalRequired: true,
      note: 'Must display clear QR code and batch reporting sequence.',
    });
  } else if (officeType === OFFICE_TYPES.RTO) {
    documentChecklist.push({
      item: 'Medical Fitness Certificate (Form 1-A)',
      quantity: 1,
      originalRequired: true,
      note: 'Mandatory for commercial driving categories or applicants over 40 years of age.',
    });
    paymentPreparation.tenderAdvice =
      'Check if Parivahan online fee receipt is required or counter cash/challan is accepted.';
  } else if (officeType === OFFICE_TYPES.TEHSILDAR) {
    documentChecklist.push({
      item: 'Revenue Court Fee Stamp (Ticket)',
      quantity: 1,
      originalRequired: true,
      note: 'Purchase ₹5 or ₹10 physical court stamp from licensed stamp vendor outside the tehsil premises.',
    });
    photoSpecifications.count = 4;
  } else if (officeType === OFFICE_TYPES.CSC_AADHAAR) {
    documentChecklist.push({
      item: 'Registered Mobile Phone with Active SIM',
      quantity: 1,
      originalRequired: true,
      note: 'Crucial: Live OTP verification is required to authorize the biometric transaction.',
    });
    paymentPreparation.estimatedAmount = '₹50 (Demographic) / ₹100 (Biometric)';
    paymentPreparation.tenderAdvice = 'Government ceiling tariffs are fixed by UIDAI. Do not pay extra unauthorized charges.';
  }

  return {
    officeName,
    officeType,
    targetService: serviceName,
    documentChecklist,
    photoSpecifications,
    paymentPreparation,
    stationaryPack,
    counterTimings,
    totalItemsCount: documentChecklist.length + stationaryPack.length + (photoSpecifications.required ? 1 : 0),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Formats the entire dossier into a cleanly formatted plain-text document.
 * Suitable for copying to clipboard, messaging via SMS, or printing.
 * @param {Object} dossier
 * @returns {string} Plain text dossier
 */
export function formatDossierPrintableText(dossier) {
  if (!dossier) return '';

  const lines = [
    '============================================================',
    'CIVIC HELP SETU — PHYSICAL OFFICE VISIT DOSSIER & CHECKLIST',
    '============================================================',
    `Office: ${dossier.officeName}`,
    `Purpose: ${dossier.targetService}`,
    `Public Dealing Hours: ${dossier.counterTimings.publicDealingHours}`,
    `Best Arrival Window: ${dossier.counterTimings.bestArrivalWindow}`,
    `Token Cut-off: ${dossier.counterTimings.tokenCutoffTime}`,
    `Lunch Recess: ${dossier.counterTimings.lunchRecess}`,
    '------------------------------------------------------------',
    '1. DOCUMENT CHECKLIST & PHOTOCOPIES',
    '------------------------------------------------------------',
  ];

  dossier.documentChecklist.forEach((doc, idx) => {
    lines.push(`[ ] ${idx + 1}. ${doc.item} (Qty: ${doc.quantity})`);
    lines.push(`    Requirement: ${doc.originalRequired ? 'ORIGINAL + PHOTOCOPIES' : 'PHOTOCOPIES'}`);
    lines.push(`    Note: ${doc.note}`);
  });

  lines.push('------------------------------------------------------------');
  lines.push('2. PHOTOGRAPH SPECIFICATIONS');
  lines.push('------------------------------------------------------------');
  if (dossier.photoSpecifications.required) {
    lines.push(`[ ] Quantity: ${dossier.photoSpecifications.count} Passport Photos`);
    lines.push(`    Dimensions: ${dossier.photoSpecifications.dimensions}`);
    lines.push(`    Background: ${dossier.photoSpecifications.background}`);
    lines.push(`    Note: ${dossier.photoSpecifications.note}`);
  } else {
    lines.push(`[ ] Biometric Live Photo at Counter (No loose photos needed)`);
    lines.push(`    Note: ${dossier.photoSpecifications.note}`);
  }

  lines.push('------------------------------------------------------------');
  lines.push('3. PAYMENT & TENDER PREPARATION');
  lines.push('------------------------------------------------------------');
  lines.push(`[ ] Expected Fee: ${dossier.paymentPreparation.estimatedAmount}`);
  lines.push(`    Modes Accepted: ${dossier.paymentPreparation.modesAccepted.join(', ')}`);
  lines.push(`    Advice: ${dossier.paymentPreparation.tenderAdvice}`);

  lines.push('------------------------------------------------------------');
  lines.push('4. STATIONARY & FILING PACK');
  lines.push('------------------------------------------------------------');
  dossier.stationaryPack.forEach((item, idx) => {
    lines.push(`[ ] ${idx + 1}. ${item}`);
  });

  lines.push('------------------------------------------------------------');
  lines.push('CITIZEN SAFETY REMINDER:');
  lines.push('Never leave original certificates with agents or brokers.');
  lines.push('Only authorized counter staff should inspect original documents.');
  lines.push('============================================================');

  return lines.join('\n');
}

export default {
  OFFICE_TYPES,
  inferOfficeType,
  generatePhysicalVisitDossier,
  formatDossierPrintableText,
};
