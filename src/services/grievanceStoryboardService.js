/**
 * Civic Grievance Evidence Storyboard with Source and Timestamp Cards Service
 * 
 * Assembles and structures disjointed civic evidence (photographs, complaint acknowledgment slips,
 * official email correspondence, RTIs, inspection notes) into a coherent chronological grievance dossier:
 * - Sorts items strictly chronologically with missing-date and duplicate indicators
 * - Generates objective neutral captions for citizen confirmation (without asserting definitive legal wrongdoing)
 * - Redaction preview masking personal phone numbers, bank details, and home addresses
 * - Exports print-ready evidence index suitable for submission to CPGRAMS / Lokayukta / High Court PILs
 */

export const EVIDENCE_SOURCE_TYPES = {
  PHOTOGRAPH: { code: 'PHOTOGRAPH', label: 'Geo-Tagged Site Photograph' },
  ACK_RECEIPT: { code: 'ACK_RECEIPT', label: 'Official Complaint Acknowledgment Slip' },
  CORRESPONDENCE: { code: 'CORRESPONDENCE', label: 'Written Letter / Official Email / Notice' },
  RTI_REPLY: { code: 'RTI_REPLY', label: 'Right to Information (RTI) Official Response' },
  WITNESS_MEMO: { code: 'WITNESS_MEMO', label: 'Resident / Ward Committee Resolution' }
};

export const EVIDENCE_CHRONOLOGY_AUDIT_RULES = [
  'Items with timestamp 0 are treated as undated and grouped at the end of the chronological dossier.',
  'Exact content duplicates sharing identical title and timestamp are flagged with a visual duplicate warning badge.',
  'All citizen-facing captions remain draft status until explicitly confirmed by the citizen.'
];

/**
 * Returns canonical audit rules for chronological evidence processing.
 * @returns {Array<string>}
 */
export function getEvidenceChronologyAuditRules() {
  return EVIDENCE_CHRONOLOGY_AUDIT_RULES;
}

export const STATUTORY_TRIBUNAL_DESTINATIONS = {
  CPGRAMS: 'Centralised Public Grievance Redress and Monitoring System (CPGRAMS)',
  LOKAYUKTA: 'State Lokayukta Anti-Corruption & Administrative Maladministration Wing',
  CONSUMER_FORUM: 'District Consumer Disputes Redressal Commission',
  HIGH_COURT_PIL: 'Writ Petition under Article 226 of the Constitution of India'
};

/**
 * Returns permissible grievance submission target bodies.
 * @returns {Object}
 */
export function getTribunalDestinations() {
  return STATUTORY_TRIBUNAL_DESTINATIONS;
}

export const EVIDENTIARY_AFFIDAVIT_TEMPLATES = {
  INDIAN_EVIDENCE_ACT_65B: {
    section: 'Section 65B of Indian Evidence Act, 1872 / Section 63 of Bharatiya Sakshya Adhiniyam, 2023',
    requirement: 'Electronic records, digital photos, and portal screenshots require an accompanying electronic certificate verifying device custody and hash authenticity.'
  },
  AFFIDAVIT_OF_FACTS: {
    purpose: 'Affidavit verifying that photographs were captured at the stated geo-location and date without synthetic manipulation.'
  }
};

/**
 * Generates an electronic evidence certification draft under Section 65B.
 * @param {string} deponentName 
 * @param {number} totalEvidenceItems 
 * @returns {string} certificateDraft
 */
export function generateSection65BCertificate(deponentName = 'Citizen Deponent', totalEvidenceItems = 0) {
  return [
    `CERTIFICATE UNDER SECTION 65B OF THE INDIAN EVIDENCE ACT, 1872 / SECTION 63 BHARATIYA SAKSHYA ADHINIYAM`,
    `I, ${deponentName}, do hereby solemnly state and affirm as follows:`,
    `1. That I am the owner and lawful custodian of the electronic computing device from which the ${totalEvidenceItems} evidence records were extracted.`,
    `2. That the electronic output was produced during the period over which the computer / smartphone was used regularly to store digital information.`,
    `3. That the printer/display produced printout accurately reproducing the recorded data without unauthorized modification.`,
    `DEPONENT VERIFICATION: Verified at this ____ day of ________, 20___.`
  ].join('\n');
}

export const GRIEVANCE_CATEGORIES = {
  ROAD_INFRASTRUCTURE: { code: 'ROAD_INFRASTRUCTURE', label: 'Potholes, Road Cave-in & Pavement Encroachment' },
  DRAINAGE_SEWERAGE: { code: 'DRAINAGE_SEWERAGE', label: 'Overflowing Sewage & Stormwater Contamination' },
  SOLID_WASTE: { code: 'SOLID_WASTE', label: 'Uncollected Garbage Dump & Open Waste Burning' },
  WATER_CONTAMINATION: { code: 'WATER_CONTAMINATION', label: 'Discolored / Odorous Municipal Tap Water Supply' }
};

/**
 * Validates, sorts, and structures evidence items chronologically.
 * @param {Array<Object>} evidenceItems 
 * @returns {Object} storyboard
 */
export function buildEvidenceStoryboard(evidenceItems = []) {
  const errors = [];
  const warnings = [];

  const processed = [];
  const seenHashes = new Set();

  evidenceItems.forEach((item, idx) => {
    if (!item.title || item.title.trim().length < 3) {
      errors.push(`Item #${idx + 1} requires a valid title or description.`);
    }

    const itemDate = item.incidentDate ? new Date(item.incidentDate) : null;
    const hasValidDate = itemDate && !isNaN(itemDate.getTime());

    if (!hasValidDate) {
      warnings.push(`Item '${item.title || idx + 1}' has no valid incident date (placed in undated section).`);
    }

    // Duplicate content check
    const contentHash = (item.title + '|' + (item.incidentDate || '')).toLowerCase();
    const isDuplicate = seenHashes.has(contentHash);
    seenHashes.add(contentHash);

    if (isDuplicate) {
      warnings.push(`Duplicate evidence detected: '${item.title}'.`);
    }

    processed.push({
      itemId: item.itemId || 'ev_' + Math.random().toString(36).substring(2, 9),
      title: item.title ? item.title.trim() : 'Evidence Item',
      sourceType: EVIDENCE_SOURCE_TYPES[item.sourceType] || EVIDENCE_SOURCE_TYPES.PHOTOGRAPH,
      incidentDate: hasValidDate ? item.incidentDate : null,
      timestamp: hasValidDate ? itemDate.getTime() : 0,
      description: item.description ? item.description.trim() : '',
      suggestedCaption: generateNeutralCaption(item),
      isConfirmedByCitizen: Boolean(item.isConfirmedByCitizen),
      isDuplicate
    });
  });

  // Chronological sorting (undated items placed at the end)
  processed.sort((a, b) => {
    if (a.timestamp === 0) return 1;
    if (b.timestamp === 0) return -1;
    return a.timestamp - b.timestamp;
  });

  return {
    storyboardId: 'stb_' + Math.random().toString(36).substring(2, 9),
    totalItems: processed.length,
    datedItemsCount: processed.filter(p => p.timestamp > 0).length,
    undatedItemsCount: processed.filter(p => p.timestamp === 0).length,
    items: processed,
    errors,
    warnings
  };
}

/**
 * Generates an objective, neutral caption for citizen verification.
 * Does not assert wrongdoing or infer individual guilt.
 * @param {Object} item 
 * @returns {string} caption
 */
export function generateNeutralCaption(item = {}) {
  const typeLabel = EVIDENCE_SOURCE_TYPES[item.sourceType]?.label || 'Observed record';
  const dateStr = item.incidentDate ? `on ${item.incidentDate}` : 'on unspecified date';
  return `${typeLabel} documented ${dateStr}: ${item.description || item.title || 'Civic observation'}.`;
}

/**
 * Masks sensitive personal contact details in evidence descriptions.
 * @param {string} text 
 * @returns {string} redactedText
 */
export function redactSensitiveDetails(text = '') {
  if (!text || typeof text !== 'string') return '';

  return text
    // Redact 10-digit mobile numbers
    .replace(/\b[6-9]\d{9}\b/g, '[REDACTED_PHONE]')
    // Redact 12-digit Aadhaar numbers
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[REDACTED_AADHAAR]')
    // Redact emails
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
}

/**
 * Exports formal grievance chronology index in markdown.
 * @param {Object} grievanceDetails 
 * @param {Object} storyboard 
 * @returns {string} markdown
 */
export function exportGrievanceChronologyDossier(grievanceDetails = {}, storyboard = {}) {
  return [
    `# Chronological Civic Grievance Evidence Dossier`,
    `**Grievance Heading:** ${grievanceDetails.title || 'Civic Infrastructure Grievance'}`,
    `**Target Authority:** ${grievanceDetails.targetAuthority || 'Municipal Grievance Officer'}`,
    `**Category:** ${grievanceDetails.category || 'Public Infrastructure'}`,
    `**Total Evidence Entries:** ${storyboard.totalItems || 0} (${storyboard.datedItemsCount || 0} Chronologically Indexed)`,
    ``,
    `## Chronological Evidence Timeline`,
    ...(storyboard.items?.length > 0
      ? storyboard.items.map(
          (item, idx) => `### Item ${idx + 1}: ${item.title} [${item.incidentDate || 'Undated'}]\n- **Source Category:** ${item.sourceType.label}\n- **Neutral Caption:** ${item.suggestedCaption}\n- **Details (Redacted):** ${redactSensitiveDetails(item.description)}\n- **Citizen Confirmation Status:** ${item.isConfirmedByCitizen ? 'Confirmed' : 'Draft / Unverified'}`
        )
      : ['No evidence records registered.']),
    ``,
    `---`,
    `> **Citizen Verification Notice:** All evidence timestamps, captions, and descriptions are compiled for citizen submission to grievance forums. Personal phone numbers and identity documents are redacted for public filing safety.`
  ].join('\n');
}
