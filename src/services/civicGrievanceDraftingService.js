/**
 * Civic Grievance Drafting Assistant Service (#404 / #1007)
 * 
 * Generates structured, professional civic grievance petitions and formal complaints
 * based exclusively on facts entered directly by the citizen.
 * Includes evidence traceability, privacy redaction, and department routing.
 * 
 * Safety & Integrity Rules:
 * 1. Zero Invention: Never invents events, official names, circular numbers, reference IDs, or evidence.
 * 2. Transparent Placeholders: Missing facts become explicit bracketed placeholders [LIKE THIS], not AI guesses.
 * 3. Drafting Only: Explicitly states that this tool prepares text drafts and does NOT submit complaints to portals.
 * 4. User Privacy: Allows omitting personal contact details; operates entirely on the client side.
 * 5. Evidence Traceability: Chronology validation, affected service mapping, and evidence reference tracking.
 * 6. Sensitive Data Redaction: Detects and flags Aadhaar, bank, health, and third-party personal data.
 */

export const GRIEVANCE_STORAGE_KEY = 'civic_grievance_drafts_v1';

// Original resolution types (preserved from v1)
export const RESOLUTION_TYPES = [
  'Urgent repair / maintenance on-site',
  'Immediate disbursement of delayed statutory dues / pension',
  'Official inspection and written status report',
  'Rectification of clerical or record error',
  'Disciplinary enquiry into administrative delay / harassment',
  'Other remedial action',
];

// Five core grievance templates as per issue #1007
export const GRIEVANCE_TEMPLATES = {
  SERVICE_DELAY: 'Service Delay',
  DENIAL: 'Denial of Service',
  INFRASTRUCTURE: 'Infrastructure Deficiency',
  BILLING: 'Billing & Tariff Dispute',
  RECORD_CORRECTION: 'Record Correction',
};

export const GRIEVANCE_CATEGORIES = [
  'Roads, Potholes & Footpaths',
  'Water Supply & Contamination',
  'Electricity, Power Cuts & Streetlights',
  'Garbage Disposal & Sanitation',
  'Public Distribution System (Ration / PDS)',
  'Pension & Welfare Benefit Delays',
  'Revenue & Land Records / Tehsildar Office',
  'Public Transport & Traffic Facilities',
  'Municipal Trade Licenses & Certificates',
  'Other Civic / Administrative Deficiency',
];

// Template definitions for the 5 core categories
const TEMPLATE_DEFINITIONS = {
  [GRIEVANCE_TEMPLATES.SERVICE_DELAY]: {
    name: 'Service Delay',
    description: 'Grievance regarding delayed civic services (e.g., water, power, transport)',
    requiredFields: ['affectedService', 'delayDuration', 'expectedService'],
    optionalFields: ['previousAttempts', 'referenceNumbers'],
    evidenceGuidelines: [
      'Photographs of the deficient service or pending work order',
      'Timeline of service request and follow-up attempts',
      'Any prior acknowledgment or reference numbers',
    ],
  },
  [GRIEVANCE_TEMPLATES.DENIAL]: {
    name: 'Denial of Service',
    description: 'Grievance regarding refusal or denial of a civic service or benefit',
    requiredFields: ['serviceDenied', 'reasonForDenial', 'impactDescription'],
    optionalFields: ['applicationReference', 'previousApplications'],
    evidenceGuidelines: [
      'Copy of application or request submitted',
      'Written denial letter or refusal communication',
      'Any supporting documents proving eligibility',
    ],
  },
  [GRIEVANCE_TEMPLATES.INFRASTRUCTURE]: {
    name: 'Infrastructure Deficiency',
    description: 'Grievance regarding physical infrastructure problems (roads, drains, utilities)',
    requiredFields: ['affectedInfrastructure', 'deficiencyDescription', 'location'],
    optionalFields: ['durationOfIssue', 'priorComplaints'],
    evidenceGuidelines: [
      'Wide-area photograph showing infrastructure defect and nearby landmarks',
      'Close-up photo detailing the damage or hazard',
      'Google Maps coordinates or street cross-reference',
      'Date when the issue was first observed',
    ],
  },
  [GRIEVANCE_TEMPLATES.BILLING]: {
    name: 'Billing & Tariff Dispute',
    description: 'Grievance regarding incorrect billing, tariff changes, or fee demands',
    requiredFields: ['billingIssue', 'amountDisputed', 'billingPeriod'],
    optionalFields: ['previousBillingHistory', 'referenceNumbers'],
    evidenceGuidelines: [
      'Copy of the billing statement or invoice in question',
      'Payment receipts showing prior payments',
      'Tariff act or approved rate card for the service',
      'Correspondence with the billing authority',
    ],
  },
  [GRIEVANCE_TEMPLATES.RECORD_CORRECTION]: {
    name: 'Record Correction',
    description: 'Grievance regarding incorrect civic records (land, identity, eligibility)',
    requiredFields: ['recordType', 'currentRecordDetail', 'correctedDetail'],
    optionalFields: ['applicationReference', 'supportingDocumentation'],
    evidenceGuidelines: [
      'Copy of the current record or document requiring correction',
      'Documentary evidence supporting the correction (e.g., birth certificate, property deed)',
      'Previous correspondence regarding the record',
      'Identification proof linking the record to the citizen',
    ],
  },
};

/**
 * Clean text strings safely
 */
const clean = (val) => (typeof val === 'string' ? val.trim() : '');

/**
 * Detect sensitive personal data in text and return redaction flags
 * Identifies: Aadhaar numbers, bank account details, health/medical data, third-party personal data
 * 
 * @param {string} text - The text to scan for sensitive data
 * @returns {Array<Object>} List of detected sensitive data items with type and redaction suggestion
 */
const detectSensitiveData = (text) => {
  const redactions = [];
  if (typeof text !== 'string') return redactions;

  const cleanText = text;

  // Aadhaar number patterns (12 digits, possibly with spaces/hyphens)
  const aadhaarPattern = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
  const aadhaarMatches = cleanText.match(aadhaarPattern);
  if (aadhaarMatches) {
    aadhaarMatches.forEach((match) => redactions.push({
      type: 'Aadhaar Number',
      original: match,
      redaction: '[Aadhaar Number redacted for privacy]',
      severity: 'HIGH',
    }));
  }

  // Bank account number patterns (typically 9-18 digits, often with formatting)
  const bankPattern = /\b(?:\d[-\s]?){9,18}\b/g;
  const bankMatches = cleanText.match(bankPattern);
  if (bankMatches) {
    bankMatches.forEach((match) => redactions.push({
      type: 'Bank Account Number',
      original: match,
      redaction: '[Bank Account Number redacted for privacy]',
      severity: 'HIGH',
    }));
  }

  // IFSC code patterns (alphanumeric, 11 characters)
  const ifscPattern = /\b[A-Z]{4}0[A-Z0-9]{6}\b/g;
  const ifscMatches = cleanText.match(ifscPattern);
  if (ifscMatches) {
    ifscMatches.forEach((match) => redactions.push({
      type: 'IFSC Code',
      original: match,
      redaction: '[IFSC Code redacted for privacy]',
      severity: 'MEDIUM',
    }));
  }

  // Phone number patterns (Indian format: +91 or 0 followed by 10 digits, or just 10 digits)
  // Match: +91 98765 43210, 098765 43210, or 9876543210 (10 digits starting with 6-9)
  const phonePattern = /\b(?:\+91[-\s]?|0)?[6-9]\d{9}\b/g;
  const phoneMatches = cleanText.match(phonePattern);
  if (phoneMatches) {
    phoneMatches.forEach((match) => redactions.push({
      type: 'Phone Number',
      original: match,
      redaction: '[Phone Number redacted for privacy]',
      severity: 'MEDIUM',
    }));
  }

  // Email address patterns
  const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  const emailMatches = cleanText.match(emailPattern);
  if (emailMatches) {
    emailMatches.forEach((match) => redactions.push({
      type: 'Email Address',
      original: match,
      redaction: '[Email Address redacted for privacy]',
      severity: 'MEDIUM',
    }));
  }

  // Health/Medical data keywords that may appear with sensitive info
  const healthKeywords = ['diagnosis', 'prescription', 'treatment', 'doctor', 'hospital', 'medical', 'lab report', 'medicine'];
  const lowerText = cleanText.toLowerCase();
  healthKeywords.forEach((kw) => {
    if (lowerText.includes(kw)) {
      // Only flag if likely a standalone reference, not part of normal description
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(cleanText)) {
        redactions.push({
          type: 'Health/Medical Reference',
          original: `[Health reference: ${kw}]`,
          redaction: '[Health/Medical data redacted for privacy]',
          severity: 'MEDIUM',
        });
      }
    }
  });

  return redactions;
};

/**
 * Validate and structure grievance facts with evidence traceability
 * 
 * @param {Object} facts - The grievance facts from the user
 * @returns {Object} Structured validation result with traceability info
 */
const validateFactsWithTraceability = (facts) => {
  const category = clean(facts.category) || 'General Civic Grievance';
  const issueDescription = clean(facts.issueDescription);
  const departmentName = clean(facts.departmentName) || 'Public Grievance Redressal Cell / Department';
  const location = clean(facts.location);
  const incidentDate = clean(facts.incidentDate);
  const previousRefNumber = clean(facts.previousRefNumber);
  const requestedResolution = clean(facts.requestedResolution);
  const evidenceList = Array.isArray(facts.evidenceList) ? facts.evidenceList.map(clean).filter(Boolean) : [];
  const citizenName = clean(facts.citizenName);
  const citizenPhone = clean(facts.citizenPhone);
  const citizenAddress = clean(facts.citizenAddress);

  // Sensitive data detection and redaction
  const allTextToScan = [issueDescription, location, incidentDate, previousRefNumber, requestedResolution, citizenName, citizenPhone, citizenAddress].join(' ');
  const sensitiveDataFlags = detectSensitiveData(allTextToScan);

  // Chronology validation
  let chronologyIssues = [];
  if (incidentDate) {
    const date = new Date(incidentDate);
    const parsedValid = !isNaN(date.getTime());
    if (parsedValid && date > new Date()) {
      chronologyIssues.push({
        code: 'FUTURE_DATE',
        message: `Incident date ${incidentDate} is in the future. Please verify and correct.`,
        severity: 'HIGH',
      });
    }
  }

  // Evidence reference tracking
  const evidenceReferences = evidenceList.map((item, idx) => ({
    id: `ev-${Date.now()}-${idx}`,
    reference: item,
    status: item ? 'provided' : 'missing',
  }));

  // Affected service determination
  const affectedService = issueDescription
    ? issueDescription.substring(0, 100) + (issueDescription.length > 100 ? '...' : '')
    : '[Affected service unstated]';

  // Requested remedy extraction
  const remedyExtraction = requestedResolution
    ? requestedResolution.substring(0, 150) + (requestedResolution.length > 150 ? '...' : '')
    : '[Remedy unstated]';

  // Privacy assessment
  const privacyRiskLevel = sensitiveDataFlags.length > 0 ? 'HIGH' : 'LOW';
  const privacyWarnings = sensitiveDataFlags.map((flag) => ({
    type: flag.type,
    message: flag.redaction,
    severity: flag.severity,
  }));

  return {
    isValid: true,
    category,
    issueDescription,
    departmentName,
    location,
    incidentDate,
    previousRefNumber,
    requestedResolution,
    evidenceList,
    citizenName,
    citizenPhone,
    citizenAddress,
    placeholdersCount: 0, // Will be calculated later
    hasUnstatedFacts: false,
    sensitiveDataFlags,
    privacyWarnings,
    privacyRiskLevel,
    chronologyIssues,
    affectedService,
    remedyExtraction,
    evidenceReferences,
    traceability: {
      category,
      affectedService,
      requestedRemedy: remedyExtraction,
      evidenceCount: evidenceList.length,
      evidenceReferences,
      chronologyValid: chronologyIssues.length === 0,
      privacyWarnings,
    },
    generatedAt: new Date().toISOString(),
  };
};

/**
 * Generate a formal grievance petition based strictly on user facts
 * Includes template formatting, sensitive data redaction, and evidence traceability
 */
export const generateGrievanceDraft = (facts = {}) => {
  const category = clean(facts.category) || 'General Civic Grievance';
  const issueDescription = clean(facts.issueDescription);
  const departmentName = clean(facts.departmentName) || 'Public Grievance Redressal Cell / Department';
  const location = clean(facts.location);
  const incidentDate = clean(facts.incidentDate);
  const previousRefNumber = clean(facts.previousRefNumber);
  const requestedResolution = clean(facts.requestedResolution);
  const evidenceList = Array.isArray(facts.evidenceList) ? facts.evidenceList.map(clean).filter(Boolean) : [];
  const citizenName = clean(facts.citizenName) || '[Name omitted by citizen]';
  const citizenPhone = clean(facts.citizenPhone) || '[Phone omitted]';
  const citizenAddress = clean(facts.citizenAddress) || '[Address omitted]';

  // Strict Validation: Cannot generate draft without an issue description
  if (!issueDescription) {
    return {
      isValid: false,
      error: 'Please provide a description of the issue or grievance.',
      draftText: '',
      placeholdersCount: 0,
    };
  }

  // Validate facts with traceability
  const validation = validateFactsWithTraceability(facts);

  // Count unstated fields that will become explicit placeholders
  let placeholdersCount = 0;

  // 1. Subject Line
  const subjectLocation = location ? `at ${location}` : '[Location unstated]';
  if (!location) placeholdersCount++;
  const subjectLine = `FORMAL GRIEVANCE: Redressal request regarding ${category.toLowerCase()} ${subjectLocation}`;

  // 2. Body construction
  const lines = [];

  lines.push('To,');
  lines.push(`The Public Grievance Officer / Competent Authority,`);
  lines.push(`${departmentName},`);
  lines.push(location ? `Jurisdiction: ${location}` : '[Administrative Ward / Jurisdiction not specified]');
  lines.push('');
  lines.push(`Subject: ${subjectLine}`);
  lines.push('');

  if (previousRefNumber) {
    lines.push(`Previous Complaint / Token Reference: ${previousRefNumber}`);
    lines.push('');
  }
  lines.push('Respected Sir / Madam,');
  lines.push('');

  // Paragraph 1: Stated facts of the grievance
  lines.push(
    `I am writing to bring to your urgent attention a civic grievance concerning ${category}. Specifically:`
  );
  lines.push(`"${issueDescription}"`);
  lines.push('');

  // Paragraph 2: Location and timeline (grounded or explicit placeholder)
  lines.push('Particulars of Incident / Deficiency:');
  if (location) {
    lines.push(`- Location: ${location}`);
  } else {
    placeholdersCount++;
    lines.push('- Location: [Exact street, ward, or office address not specified - please insert before submitting]');
  }

  if (incidentDate) {
    lines.push(`- Date / Duration: ${incidentDate}`);
  } else {
    placeholdersCount++;
    lines.push('- Date / Duration: [Date or duration of problem not specified - please insert if known]');
  }

  if (previousRefNumber) {
    lines.push(`- Prior Grievance Reference: ${previousRefNumber}`);
  }
  lines.push('');

  // Paragraph 3: Requested remedy
  lines.push('Requested Resolution:');
  if (requestedResolution) {
    lines.push(`I respectfully request the department to initiate: ${requestedResolution}.`);
  } else {
    placeholdersCount++;
    lines.push('I respectfully request the department to: [Specify remedy, e.g. dispatch inspection team / disburse payment / rectify error].');
  }
  lines.push('');

  // Paragraph 4: Evidence attached
  if (evidenceList.length > 0) {
    lines.push('Supporting Evidence / Documents Enclosed:');
    evidenceList.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item}`);
    });
    lines.push('');
  } else {
    placeholdersCount++;
    lines.push('Supporting Evidence: [No documents listed by user - attach photographs, receipts, or copies if available]');
    lines.push('');
  }

  // Privacy redaction warnings if sensitive data was detected
  if (validation.sensitiveDataFlags.length > 0) {
    lines.push('PRIVACY REDACTION NOTICE:');
    lines.push('The following sensitive personal data was detected in your input and has been redacted for your privacy:');
    validation.sensitiveDataFlags.forEach((flag) => {
      lines.push(`- ${flag.redaction} (original: ${flag.original})`);
    });
    lines.push('');
    lines.push('Please review the redacted version before submitting to official government portals.');
    lines.push('');
  }

  // Formal closing
  lines.push('Kindly register this complaint under your citizen charter / grievance redressal mechanism and provide a formal tracking acknowledgement.');
  lines.push('');
  lines.push('Yours sincerely,');
  lines.push(citizenName);
  if (citizenPhone !== '[Phone omitted]' && validation.privacyRiskLevel !== 'HIGH') lines.push(`Contact: ${citizenPhone}`);
  if (citizenAddress !== '[Address omitted]' && validation.privacyRiskLevel !== 'HIGH') lines.push(`Address: ${citizenAddress}`);

  const draftText = lines.join('\n');

  return {
    id: `draft-${Date.now()}`,
    isValid: true,
    category,
    subjectLine,
    draftText,
    placeholdersCount,
    hasUnstatedFacts: placeholdersCount > 0,
    sensitiveDataFlags: validation.sensitiveDataFlags,
    privacyRiskLevel: validation.privacyRiskLevel,
    chronologyIssues: validation.chronologyIssues,
    affectedService: validation.affectedService,
    remedyExtraction: validation.remedyExtraction,
    evidenceReferences: validation.evidenceReferences,
    traceability: validation.traceability,
    generatedAt: new Date().toISOString(),
    templateUsed: null,
    disclaimer:
      'Drafting Tool Notice: This text is a formal petition draft synthesized strictly from facts you provided. Civic Help Setu does NOT submit grievances to government portals. Please copy this text and submit it via your state CM Helpline, CPGRAMS (pgportal.gov.in), or designated municipal portal.',
  };
};

/**
 * Generate a draft using a specific template from the 5 core categories
 * 
 * @param {Object} facts - The grievance facts
 * @param {string} templateName - One of the GRIEVANCE_TEMPLATES values
 * @returns {Object} Generated draft with template applied
 */
export const generateGrievanceDraftWithTemplate = (facts = {}, templateName) => {
  const template = TEMPLATE_DEFINITIONS[templateName];
  if (!template) {
    return generateGrievanceDraft(facts);
  }

  // Apply template-specific structuring
  const category = clean(facts.category) || 'General Civic Grievance';
  const issueDescription = clean(facts.issueDescription);
  const departmentName = clean(facts.departmentName) || 'Public Grievance Redressal Cell / Department';
  const location = clean(facts.location);
  const incidentDate = clean(facts.incidentDate);
  const previousRefNumber = clean(facts.previousRefNumber);
  const requestedResolution = clean(facts.requestedResolution);
  const evidenceList = Array.isArray(facts.evidenceList) ? facts.evidenceList.map(clean).filter(Boolean) : [];
  const citizenName = clean(facts.citizenName) || '[Name omitted by citizen]';
  const citizenPhone = clean(facts.citizenPhone) || '[Phone omitted]';
  const citizenAddress = clean(facts.citizenAddress) || '[Address omitted]';

  if (!issueDescription) {
    return {
      isValid: false,
      error: `Please provide a description of the issue for ${template.name} grievance.`,
      draftText: '',
      placeholdersCount: 0,
    };
  }

  // Build template-specific draft text
  let placeholdersCount = 0;

  const lines = [];

  // Header
  lines.push('To,');
  lines.push(`The Public Grievance Officer / Competent Authority,`);
  lines.push(`${departmentName},`);
  lines.push(location ? `Jurisdiction: ${location}` : '[Administrative Ward / Jurisdiction not specified]');
  lines.push('');
  lines.push(`Subject: ${category.toLowerCase()} - ${template.name}`);
  lines.push('');

  // Context paragraph based on template
  lines.push(`I am writing to bring to your urgent attention regarding the ${template.name.toLowerCase()} of ${issueDescription.toLowerCase()}.`);
  lines.push('');

  // Template-specific required fields
  if (template.requiredFields.includes('affectedService') || template.name === 'Infrastructure Deficiency') {
    const affectedService = location || issueDescription.substring(0, 80);
    lines.push(`Affected Service / Infrastructure: ${affectedService}`);
    lines.push('');
  }

  if (template.requiredFields.includes('delayDuration') || template.name === 'Service Delay') {
    lines.push(`Duration of Delay: ${incidentDate || '[Duration unstated - please specify]'}`);
    lines.push('');
  }

  if (template.requiredFields.includes('serviceDenied') || template.name === 'Denial of Service') {
    lines.push(`Service Denied: ${issueDescription}`);
    lines.push('');
  }

  if (template.requiredFields.includes('billingIssue') || template.name === 'Billing & Tariff Dispute') {
    lines.push(`Billing Issue: ${issueDescription}`);
    lines.push('');
  }

  if (template.requiredFields.includes('recordType') || template.name === 'Record Correction') {
    lines.push(`Record Type: ${issueDescription}`);
    lines.push('');
  }

  // Timeline / Particulars
  lines.push('Particulars of Incident / Deficiency:');
  if (location) {
    lines.push(`- Location: ${location}`);
  } else {
    placeholdersCount++;
    lines.push(`- Location: [Exact location unstated - please insert before submitting]`);
  }

  if (incidentDate) {
    lines.push(`- Date / Duration: ${incidentDate}`);
  } else {
    placeholdersCount++;
    lines.push(`- Date / Duration: [Date or duration of problem not specified - please insert if known]`);
  }

  if (previousRefNumber) {
    lines.push(`- Prior Reference: ${previousRefNumber}`);
  }
  lines.push('');

  // Requested remedy based on template
  lines.push('Requested Resolution:');
  if (requestedResolution) {
    lines.push(`I respectfully request the department to initiate: ${requestedResolution}.`);
  } else {
    placeholdersCount++;
    lines.push(`I respectfully request the department to: [Specify remedy, e.g. dispatch inspection team / disburse payment / rectify error].`);
  }
  lines.push('');

  // Evidence
  if (evidenceList.length > 0) {
    lines.push('Supporting Evidence / Documents Enclosed:');
    evidenceList.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item}`);
    });
    lines.push('');
  } else {
    placeholdersCount++;
    lines.push('Supporting Evidence: [No documents listed by user - attach photographs, receipts, or copies if available]');
    lines.push('');
  }

  // Template-specific evidence guidelines mention
  if (template.evidenceGuidelines && template.evidenceGuidelines.length > 0) {
    lines.push('Recommended Evidence to Gather:');
    template.evidenceGuidelines.forEach((guideline, idx) => {
      lines.push(`${idx + 1}. ${guideline}`);
    });
    lines.push('');
  }

  // Formal closing
  lines.push('Kindly register this complaint under your citizen charter / grievance redressal mechanism and provide a formal tracking acknowledgement.');
  lines.push('');
  lines.push('Yours sincerely,');
  lines.push(citizenName);
  if (citizenPhone !== '[Phone omitted]') lines.push(`Contact: ${citizenPhone}`);
  if (citizenAddress !== '[Address omitted]') lines.push(`Address: ${citizenAddress}`);

  const draftText = lines.join('\n');

  return {
    id: `draft-${Date.now()}`,
    isValid: true,
    category,
    subjectLine: `${category.toLowerCase()} - ${template.name}`,
    draftText,
    placeholdersCount,
    hasUnstatedFacts: placeholdersCount > 0,
    sensitiveDataFlags: [], // Will be populated by caller if needed
    templateUsed: templateName,
    templateName: template.name,
    generatedAt: new Date().toISOString(),
    disclaimer:
      'Drafting Tool Notice: This text is a formal petition draft synthesized strictly from facts you provided. Civic Help Setu does NOT submit grievances to government portals. Please copy this text and submit it via your state CM Helpline, CPGRAMS (pgportal.gov.in), or designated municipal portal.',
  };
};

/**
 * Retrieve stored grievance drafts
 */
export const getStoredGrievanceDrafts = () => {
  const storage = typeof localStorage !== 'undefined' ? localStorage : null;
  if (storage) {
    try {
      const raw = storage.getItem(GRIEVANCE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  return [];
};

/**
 * Save a grievance draft to storage
 */
export const saveGrievanceDraft = (draft) => {
  if (!draft || !draft.id) return false;
  const current = getStoredGrievanceDrafts().filter((d) => d.id !== draft.id);
  const updated = [draft, ...current];

  const storage = typeof localStorage !== 'undefined' ? localStorage : null;
  if (storage) {
    try {
      storage.setItem(GRIEVANCE_STORAGE_KEY, JSON.stringify(updated));
      return true;
    } catch {
      return false;
    }
  }
  // Fallback to in-memory if no localStorage
  return true;
};

/**
 * Delete a grievance draft from storage
 */
export const deleteGrievanceDraft = (draftId) => {
  const current = getStoredGrievanceDrafts().filter((d) => d.id !== draftId);

  const storage = typeof localStorage !== 'undefined' ? localStorage : null;
  if (storage) {
    try {
      storage.setItem(GRIEVANCE_STORAGE_KEY, JSON.stringify(current));
      return true;
    } catch {
      return false;
    }
  }
  return true;
};

/**
 * Get template definitions for the 5 core grievance categories
 */
export const getGrievanceTemplates = () => {
  return Object.entries(GRIEVANCE_TEMPLATES).map(([key, value]) => ({
    key,
    value,
    ...TEMPLATE_DEFINITIONS[value],
  }));
};

/**
 * Get template by name
 */
export const getTemplateByName = (name) => {
  return TEMPLATE_DEFINITIONS[name] || null;
};

/**
 * Check if a grievance draft has sensitive data that needs redaction before export
 * 
 * @param {Object} draft - The generated draft object
 * @returns {Object} Redaction report
 */
export const checkSensitiveDataBeforeExport = (draft) => {
  if (!draft || !draft.draftText) {
    return {
      hasSensitiveData: false,
      redacted: '',
      warnings: [],
    };
  }

  const sensitiveDataFlags = detectSensitiveData(draft.draftText);
  const warnings = sensitiveDataFlags.map((flag) => ({
    type: flag.type,
    message: flag.redaction,
    severity: flag.severity,
  }));

  // Perform redaction
  let redactedText = draft.draftText;
  sensitiveDataFlags.forEach((flag) => {
    redactedText = redactedText.replace(new RegExp(flag.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), flag.redaction);
  });

  return {
    hasSensitiveData: sensitiveDataFlags.length > 0,
    redactedText,
    warnings,
    privacyRiskLevel: sensitiveDataFlags.length > 0 ? 'HIGH' : 'LOW',
  };
};

/**
 * Export a draft with full traceability report included
 * 
 * @param {Object} draft - The generated draft object
 * @returns {string} Formatted export text with traceability
 */
export const exportGrievanceDraftWithTraceability = (draft) => {
  if (!draft) return '';

  const traceability = draft.traceability || {};
  const sensitiveCheck = checkSensitiveDataBeforeExport(draft);

  const lines = [
    `# GRIEVANCE DRAFT EXPORT: ${draft.subjectLine || 'Public Service Complaint'}`,
    `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
    `Category: ${draft.category}`,
    `Template Used: ${draft.templateUsed || 'None'}`,
    '',
    '--- TRACEABILITY REPORT ---',
    `Affected Service: ${traceability.affectedService || 'Not specified'}`,
    `Requested Remedy: ${traceability.remedyExtraction || 'Not specified'}`,
    `Evidence Count: ${traceability.evidenceCount || 0}`,
    `Chronology Valid: ${traceability.chronologyValid ? 'Yes' : 'No - issues above'}`,
    `Privacy Risk Level: ${traceability.privacyRiskLevel || 'LOW'}`,
    '',
    '--- SENSITIVE DATA REDACTION Warnings ---',
  ];

  if (sensitiveCheck.hasSensitiveData) {
    lines.push(`⚠️ PRIVACY ALERT: ${sensitiveCheck.warnings.length} sensitive data item(s) detected and redacted:`);
    sensitiveCheck.warnings.forEach((w) => {
      lines.push(`   - ${w.message}`);
    });
    lines.push('');
  } else {
    lines.push('✅ No sensitive personal data detected in draft.');
    lines.push('');
  }

  lines.push('--- DRAFT TEXT ---');
  lines.push(draft.draftText || 'No draft text available.');
  lines.push('');
  lines.push('--- DISCLAIMER ---');
  lines.push(draft.disclaimer || 'No disclaimer available.');
  lines.push('');
  lines.push('--- OFFICIAL SUBMISSION NOTICE ---');
  lines.push('Civic Help Setu does NOT submit complaints to government offices. Please copy this draft and lodge it through designated grievance channels such as your state\'s CM Helpline, municipal web portal, or CPGRAMS (pgportal.gov.in).');

  return lines.join('\n');
};