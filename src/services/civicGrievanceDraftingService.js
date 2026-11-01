/**
 * Civic Grievance Drafting Assistant Service (#404)
 * 
 * Generates structured, professional civic grievance petitions and formal complaints
 * based exclusively on facts entered directly by the citizen.
 * 
 * Safety & Integrity Rules:
 * 1. Zero Invention: Never invents events, official names, circular numbers, reference IDs, or evidence.
 * 2. Transparent Placeholders: Missing facts become explicit bracketed placeholders [LIKE THIS], not AI guesses.
 * 3. Drafting Only: Explicitly states that this tool prepares text drafts and does NOT submit complaints to portals.
 * 4. User Privacy: Allows omitting personal contact details; operates entirely on the client side.
 */

export const GRIEVANCE_STORAGE_KEY = 'civic_grievance_drafts_v1';

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

export const RESOLUTION_TYPES = [
  'Urgent repair / maintenance on-site',
  'Immediate disbursement of delayed statutory dues / pension',
  'Official inspection and written status report',
  'Rectification of clerical or record error',
  'Disciplinary enquiry into administrative delay / harassment',
  'Other remedial action',
];

let inMemoryDrafts = [];

const getStorage = () => {
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
};

/**
 * Clean text strings safely
 */
const clean = (val) => (typeof val === 'string' ? val.trim() : '');

/**
 * Generate a formal grievance petition based strictly on user facts
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
    lines.push('Supporting Evidence: [No documents listed by user - attach photographs, receipts, or copies if available]');
    placeholdersCount++;
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
    subjectLine,
    draftText,
    placeholdersCount,
    hasUnstatedFacts: placeholdersCount > 0,
    generatedAt: new Date().toISOString(),
    facts: {
      category,
      issueDescription,
      departmentName,
      location,
      incidentDate,
      previousRefNumber,
      requestedResolution,
      evidenceList,
    },
    disclaimer:
      'Drafting Tool Notice: This text is a formal petition draft synthesized strictly from facts you provided. Civic Help Setu does NOT submit grievances to government portals. Please copy this text and submit it via your state CM Helpline, CPGRAMS (pgportal.gov.in), or designated municipal portal.',
  };
};

/**
 * Retrieve saved grievance drafts
 */
export const getStoredGrievanceDrafts = () => {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(GRIEVANCE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : inMemoryDrafts;
    } catch {
      return inMemoryDrafts;
    }
  }
  return inMemoryDrafts;
};

/**
 * Save a grievance draft to storage
 */
export const saveGrievanceDraft = (draft) => {
  if (!draft || !draft.id) return false;
  const current = getStoredGrievanceDrafts().filter((d) => d.id !== draft.id);
  const updated = [draft, ...current];
  inMemoryDrafts = updated;

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(GRIEVANCE_STORAGE_KEY, JSON.stringify(updated));
      return true;
    } catch {
      return false;
    }
  }
  return true;
};

/**
 * Delete a grievance draft from storage
 */
export const deleteGrievanceDraft = (draftId) => {
  const updated = getStoredGrievanceDrafts().filter((d) => d.id !== draftId);
  inMemoryDrafts = updated;

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(GRIEVANCE_STORAGE_KEY, JSON.stringify(updated));
      return true;
    } catch {
      return false;
    }
  }
  return true;
};
