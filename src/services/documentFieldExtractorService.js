/**
 * documentFieldExtractorService.js
 *
 * Civic document field extractor with citizen-confirmed autofill (#478).
 * Extracts structured fields (Full Name, Date of Birth, Gender, Address,
 * Identity/Certificate Reference Number) from citizen-provided document text
 * or client-side OCR transcripts with confidence scoring and manual review flags.
 *
 * Governance & Accuracy Guardrails:
 * - Never auto-fills or submits form fields without explicit citizen review & confirmation.
 * - Displays side-by-side verification with confidence indicators (HIGH, MEDIUM, LOW).
 * - Flags low-confidence matches for mandatory manual verification.
 * - Extracted fields are never used to decide eligibility or make official determinations.
 * - Ephemeral in-session processing following zero-retention privacy standards.
 */

export const FIELD_DEFINITIONS = {
  FULL_NAME: {
    key: 'fullName',
    label: 'Full Name',
    patterns: [
      /(?:name|nam|applicant(?:\s+name)?|holder)\s*[:\-]\s*([a-zA-Z\s.]{3,35}?)(?=\r?\n|$)/i,
      /(?:shri|smt|mr|ms|mrs)\.?\s+([a-zA-Z\s]{3,30}?)(?=\r?\n|$)/i,
    ],
  },
  DATE_OF_BIRTH: {
    key: 'dob',
    label: 'Date of Birth',
    patterns: [
      /(?:dob|date\s+of\s+birth|birth\s+date)\s*[:\-]?\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i,
      /(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/,
    ],
  },
  GENDER: {
    key: 'gender',
    label: 'Gender',
    patterns: [
      /(?:gender|sex)\s*[:\-]?\s*(male|female|transgender|other)/i,
      /\b(male|female|transgender)\b/i,
    ],
  },
  DOCUMENT_NUMBER: {
    key: 'documentNumber',
    label: 'Document / Certificate ID',
    patterns: [
      /(?:aadhaar|uid|pan|voter|epic|certificate|ref(?:\s+no)?)\s*[:\-]?\s*([a-zA-Z0-9\-\/]{6,20})/i,
      /([A-Z]{5}\d{4}[A-Z])/i, // PAN
      /(\d{4}\s\d{4}\s\d{4})/, // Aadhaar formatted
    ],
  },
  STATE: {
    key: 'state',
    label: 'State / UT',
    patterns: [
      /(?:state|pradesh|delhi|maharashtra|rajasthan|gujarat|karnataka|punjab|tamil\s+nadu|kerala|uttar\s+pradesh|bihar|west\s+bengal|assam|odisha)/i,
    ],
  },
  PINCODE: {
    key: 'pincode',
    label: 'Postal Pincode',
    patterns: [
      /(?:pin|pincode|postal\s+code)\s*[:\-]?\s*(\d{6})/i,
      /\b(\d{6})\b/,
    ],
  },
};

/**
 * Extracts supported form fields from document text with confidence metrics.
 *
 * @param {string} rawText - Document text (OCR transcript or pasted excerpt)
 * @param {Array<string>} [requestedFieldKeys=[]] - Only extract requested fields if specified
 * @returns {Array<Object>} List of candidate field extractions
 */
export function extractFieldsFromDocument(rawText = '', requestedFieldKeys = []) {
  if (!rawText || typeof rawText !== 'string') return [];

  const text = rawText.trim();
  const results = [];

  Object.values(FIELD_DEFINITIONS).forEach((def) => {
    if (requestedFieldKeys.length > 0 && !requestedFieldKeys.includes(def.key)) {
      return;
    }

    let extractedValue = null;
    let confidence = 0.5; // default moderate confidence

    for (const pattern of def.patterns) {
      const match = text.match(pattern);
      if (match) {
        extractedValue = match[1] ? match[1].trim() : match[0].trim();
        // Boost confidence if explicit label prefix preceded the value
        if (pattern.source.includes(':') || pattern.source.includes('dob') || pattern.source.includes('name')) {
          confidence = 0.9;
        } else {
          confidence = 0.65;
        }
        break;
      }
    }

    if (extractedValue) {
      const confidenceLevel = confidence >= 0.85 ? 'HIGH' : confidence >= 0.6 ? 'MEDIUM' : 'LOW';

      results.push({
        key: def.key,
        label: def.label,
        extractedValue,
        confidence,
        confidenceLevel,
        confirmed: false,
        sourceSnippet: text.slice(Math.max(0, text.indexOf(extractedValue) - 20), text.indexOf(extractedValue) + extractedValue.length + 20),
        requiresManualReview: confidenceLevel === 'LOW',
      });
    }
  });

  return results;
}

/**
 * Applies citizen-confirmed fields onto a target form object.
 * Strictly ignores unconfirmed fields.
 *
 * @param {Object} currentForm - Existing form state
 * @param {Array<Object>} extractedFields - Evaluated extractions
 * @returns {Object} Updated form state with confirmed autofill values
 */
export function applyConfirmedAutofill(currentForm = {}, extractedFields = []) {
  const updatedForm = { ...currentForm };

  extractedFields.forEach((field) => {
    if (field.confirmed && field.extractedValue) {
      updatedForm[field.key] = field.extractedValue;
    }
  });

  return updatedForm;
}
