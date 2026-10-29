/**
 * Document Pre-Flight Readiness Inspection Service
 * Generates verified statutory document inspection checklists, attestation guidelines,
 * and rejection-prevention advisories for Indian civic applications.
 */

export const STATUTORY_PREFLIGHT_CRITERIA = [
  {
    id: 'name_exact_match',
    category: 'IDENTITY',
    title: 'Character-by-Character Name Spelling Check',
    guideline: 'Verify that your first name, middle name, and surname match identically across Aadhaar, PAN, and school marksheets. Expand single initials if required by the departmental portal.',
    validityNote: 'Discrepancies require a Gazetted Officer affidavit or gazette notification copy.',
    criticality: 'MANDATORY',
  },
  {
    id: 'self_attestation_signature',
    category: 'VERIFICATION',
    title: 'Self-Attestation with Current Date',
    guideline: 'All xerox/photocopies submitted to Indian government counters must carry your original handwritten signature across the bottom with "Self-Attested" and current date.',
    validityNote: 'Unattested photocopies are the #1 reason for counter-level document returns.',
    criticality: 'MANDATORY',
  },
  {
    id: 'address_freshness_90days',
    category: 'ADDRESS',
    title: 'Proof of Address Freshness Buffer (<90 Days)',
    guideline: 'If submitting electricity, water, gas bills or bank passbooks as POA, ensure the statement billing cycle is within the last 3 months.',
    validityNote: 'Older utility bills are automatically rejected by municipal and RTO inspection officers.',
    criticality: 'MANDATORY',
  },
  {
    id: 'passport_photo_spec',
    category: 'BIOMETRICS',
    title: 'Standard Passport Photo Specifications',
    guideline: 'Provide recent color photographs (under 6 months old) with clean white background, 80% face coverage, neutral expression, and both ears clearly visible.',
    validityNote: 'Selfies, casual smartphone photos, or patterned backgrounds are invalid.',
    criticality: 'RECOMMENDED',
  },
  {
    id: 'dob_original_cross_verification',
    category: 'AGE',
    title: 'Date of Birth (DOB) Document Alignment',
    guideline: 'Confirm that DD/MM/YYYY on birth certificate or class 10 admit card aligns with the Aadhaar record. If Aadhaar only shows birth year (YYYY), update it first at an Aadhaar Seva Kendra.',
    validityNote: 'Aadhaar cards with only birth year are rejected for passport and driving licenses.',
    criticality: 'MANDATORY',
  },
  {
    id: 'original_documents_carried',
    category: 'LOGISTICS',
    title: 'Originals for Physical Spot Verification',
    guideline: 'Carry original physical documents alongside two sets of photocopies. Counter verification officers must physically inspect originals before certifying copies.',
    validityNote: 'Digital phone screenshots or laminated non-removable certificates are discouraged.',
    criticality: 'MANDATORY',
  },
];

/**
 * Returns tailored pre-flight inspection checklist items for a given service
 *
 * @param {string} serviceId
 * @param {string[]} documentsList
 * @returns {Object[]}
 */
export function getDocumentPreflightRules(serviceId = '', documentsList = []) {
  // Always include core statutory criteria
  const items = [...STATUTORY_PREFLIGHT_CRITERIA];

  const docsText = (Array.isArray(documentsList) ? documentsList.join(' ') : '').toLowerCase();
  const sId = String(serviceId || '').toLowerCase();

  // Income / EWS specific rules
  if (sId.includes('income') || docsText.includes('income') || docsText.includes('salary') || docsText.includes('patwari')) {
    items.push({
      id: 'income_patwari_report',
      category: 'REVENUE',
      title: 'Patwari / Village Accountant Inquiry Endorsement',
      guideline: 'Ensure the local revenue inspector or Patwari inquiry report is signed and stamped with official dispatch reference number.',
      validityNote: 'Valid for current financial year only.',
      criticality: 'MANDATORY',
    });
  }

  // Caste certificate specific rules
  if (sId.includes('caste') || docsText.includes('caste') || docsText.includes('community')) {
    items.push({
      id: 'caste_ancestry_proof',
      category: 'REVENUE',
      title: 'Paternal Bloodline Caste Linkage Proof',
      guideline: 'Submit caste certificate of father, paternal grandfather, or paternal uncle to substantiate lineage claims.',
      validityNote: 'Maternal caste certificates are legally insufficient in Indian revenue jurisprudence.',
      criticality: 'MANDATORY',
    });
  }

  // Driving license specific rules
  if (sId.includes('driving') || docsText.includes('medical') || sId.includes('license')) {
    items.push({
      id: 'medical_form_1a',
      category: 'MEDICAL',
      title: 'Medical Fitness Certificate (Form 1-A)',
      guideline: 'Applicants over 40 years or applying for transport endorsement must obtain Form 1-A signed by a registered MBBS medical practitioner.',
      validityNote: 'Must carry registered practitioner seal with state medical council registration number.',
      criticality: 'MANDATORY',
    });
  }

  return items;
}

/**
 * Calculates readiness percentage and identifies missing mandatory items
 *
 * @param {string[]} checkedItemIds
 * @param {Object[]} allItems
 * @returns {Object}
 */
export function calculatePreflightReadiness(checkedItemIds = [], allItems = []) {
  const checkedSet = new Set(checkedItemIds || []);
  const total = allItems.length || 1;
  const completedCount = allItems.filter(item => checkedSet.has(item.id)).length;
  const percentage = Math.round((completedCount / total) * 100);

  const missingMandatory = allItems.filter(
    item => item.criticality === 'MANDATORY' && !checkedSet.has(item.id)
  );

  let readinessLevel = 'INCOMPLETE';
  if (percentage === 100) {
    readinessLevel = 'FULLY_READY';
  } else if (percentage >= 70 && missingMandatory.length === 0) {
    readinessLevel = 'READY_WITH_RECOMMENDATIONS';
  } else if (percentage >= 50) {
    readinessLevel = 'PARTIALLY_READY';
  }

  return {
    totalItems: total,
    completedCount,
    percentage,
    readinessLevel,
    isReadyForVisit: missingMandatory.length === 0,
    missingMandatoryCount: missingMandatory.length,
    missingMandatory,
  };
}

/**
 * Formats a copyable pre-flight inspection report
 */
export function generatePreflightInspectionText(serviceName = 'Civic Service', readinessData = {}, allItems = [], checkedItemIds = []) {
  const checkedSet = new Set(checkedItemIds || []);
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  let text = `========================================================\n`;
  text += `CIVIC APPLICATION DOCUMENT PRE-FLIGHT READINESS REPORT\n`;
  text += `Service: ${serviceName}\n`;
  text += `Date of Inspection: ${today}\n`;
  text += `Readiness Score: ${readinessData.percentage}%\n`;
  text += `Counter Clearance Status: ${readinessData.isReadyForVisit ? 'CLEARED FOR PHYSICAL VISIT' : 'ACTION REQUIRED (MISSING MANDATORY ITEMS)'}\n`;
  text += `========================================================\n\n`;

  text += `INSPECTION CHECKLIST BREAKDOWN:\n`;
  allItems.forEach((item, index) => {
    const isDone = checkedSet.has(item.id);
    text += `${index + 1}. [${isDone ? 'COMPLETED' : 'PENDING'}] (${item.criticality}) ${item.title}\n`;
    text += `   - Guideline: ${item.guideline}\n`;
    text += `   - Requirement: ${item.validityNote}\n\n`;
  });

  text += `\nCITIZEN NOTE: Always carry all original certificates along with two sets of self-attested photocopies.\n`;
  return text;
}
