/**
 * Privacy-Preserving Document OCR and Field-Extraction Assistant Service
 *
 * Implements client-side / local privacy-first document processing:
 * 1. Categorizes Indian identity and civic documents (Aadhaar, PAN, Voter ID, Driving Licence, Income Certificate).
 * 2. Extracts critical verification fields with bounding box metadata and confidence ratings.
 * 3. Enforces client-side masking of high-sensitivity identifiers (Aadhaar, PAN) in preview logs.
 * 4. Compares extracted attributes against service prerequisites without deciding legal eligibility.
 * 5. Provides explicit non-retention assurances and user disclaimer.
 */

export const SUPPORTED_DOC_TYPES = {
  AADHAAR: 'AADHAAR',
  PAN: 'PAN',
  VOTER_ID: 'VOTER_ID',
  DRIVING_LICENCE: 'DRIVING_LICENCE',
  INCOME_CERTIFICATE: 'INCOME_CERTIFICATE',
  UNKNOWN: 'UNKNOWN',
};

export const LEGAL_DISCLAIMER =
  'This assistant helps review document fields against checklist requirements but does not declare legal eligibility or guarantee official acceptance. Final verification is performed by competent government authorities.';

/**
 * Redacts sensitive identification numbers in text or display records.
 * @param {string} text
 * @returns {string} Redacted text
 */
export function maskSensitiveField(value = '', docType = '') {
  if (!value || typeof value !== 'string') return '';

  const clean = value.replace(/[\s-]/g, '');

  // 12 digit Aadhaar
  if (docType === SUPPORTED_DOC_TYPES.AADHAAR || /^\d{12}$/.test(clean)) {
    return `XXXX-XXXX-${clean.slice(-4)}`;
  }

  // 10 alphanumeric PAN
  if (docType === SUPPORTED_DOC_TYPES.PAN || /^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(clean)) {
    return `${clean.slice(0, 2)}XXXXXX${clean.slice(-2)}`.toUpperCase();
  }

  // General masking for long numbers
  if (clean.length > 6) {
    return `${clean.slice(0, 2)}***${clean.slice(-3)}`;
  }

  return value;
}

/**
 * Classifies document type from OCR extracted raw text.
 * @param {string} ocrText
 * @returns {{ docType: string, confidence: number }}
 */
export function classifyDocumentType(ocrText = '') {
  if (!ocrText || typeof ocrText !== 'string') {
    return { docType: SUPPORTED_DOC_TYPES.UNKNOWN, confidence: 0 };
  }

  const textLower = ocrText.toLowerCase();

  if (/aadhaar|uidai|unique identification authority|mera aadhaar|vid\s*:/i.test(textLower)) {
    return { docType: SUPPORTED_DOC_TYPES.AADHAAR, confidence: 0.95 };
  }
  if (/income tax department|permanent account number|govt of india\s+pan/i.test(textLower) || /[a-z]{5}[0-9]{4}[a-z]/i.test(textLower)) {
    return { docType: SUPPORTED_DOC_TYPES.PAN, confidence: 0.92 };
  }
  if (/election commission of india|epic\b|elector photo identity/i.test(textLower)) {
    return { docType: SUPPORTED_DOC_TYPES.VOTER_ID, confidence: 0.9 };
  }
  if (/driving licen[cs]e|transport department|union of india driving/i.test(textLower) || /\bdl\s*no\b/i.test(textLower)) {
    return { docType: SUPPORTED_DOC_TYPES.DRIVING_LICENCE, confidence: 0.88 };
  }
  if (/income certificate|tahsildar|revenue department|annual income\s*:/i.test(textLower)) {
    return { docType: SUPPORTED_DOC_TYPES.INCOME_CERTIFICATE, confidence: 0.85 };
  }

  return { docType: SUPPORTED_DOC_TYPES.UNKNOWN, confidence: 0.2 };
}

/**
 * Extracts structured fields from OCR text based on document type.
 *
 * @param {string} ocrText
 * @param {string} docType
 * @returns {Array<{
 *   fieldKey: string,
 *   label: string,
 *   rawValue: string,
 *   maskedValue: string,
 *   confidence: number,
 *   boundingBox: { x: number, y: number, width: number, height: number }
 * }>}
 */
export function extractDocumentFields(ocrText = '', docType = SUPPORTED_DOC_TYPES.UNKNOWN) {
  if (!ocrText || typeof ocrText !== 'string') return [];

  const fields = [];

  // 1. Name extraction
  const nameMatch = ocrText.match(/(?:Name|Full Name|Holder)[\s:]+([A-Za-z\s]{3,35})(?:\r?\n|$)/i);
  if (nameMatch) {
    fields.push({
      fieldKey: 'fullName',
      label: 'Full Name',
      rawValue: nameMatch[1].trim(),
      maskedValue: nameMatch[1].trim(),
      confidence: 0.88,
      boundingBox: { x: 40, y: 120, width: 220, height: 25 },
    });
  }

  // 2. Date of Birth extraction
  const dobMatch = ocrText.match(/(?:DOB|Date of Birth|Birth)[\s:]+([0-9]{2}[/-][0-9]{2}[/-][0-9]{4})/i);
  if (dobMatch) {
    fields.push({
      fieldKey: 'dateOfBirth',
      label: 'Date of Birth',
      rawValue: dobMatch[1].trim(),
      maskedValue: dobMatch[1].trim(),
      confidence: 0.92,
      boundingBox: { x: 40, y: 160, width: 140, height: 25 },
    });
  }

  // 3. Document Identifier extraction
  if (docType === SUPPORTED_DOC_TYPES.AADHAAR) {
    const aadhaarMatch = ocrText.match(/\b([2-9][0-9]{3}\s*[0-9]{4}\s*[0-9]{4})\b/);
    if (aadhaarMatch) {
      const raw = aadhaarMatch[1].trim();
      fields.push({
        fieldKey: 'aadhaarNumber',
        label: 'Aadhaar Number',
        rawValue: raw,
        maskedValue: maskSensitiveField(raw, SUPPORTED_DOC_TYPES.AADHAAR),
        confidence: 0.94,
        boundingBox: { x: 50, y: 220, width: 200, height: 30 },
      });
    }
  } else if (docType === SUPPORTED_DOC_TYPES.PAN) {
    const panMatch = ocrText.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/i);
    if (panMatch) {
      const raw = panMatch[1].trim().toUpperCase();
      fields.push({
        fieldKey: 'panNumber',
        label: 'PAN Number',
        rawValue: raw,
        maskedValue: maskSensitiveField(raw, SUPPORTED_DOC_TYPES.PAN),
        confidence: 0.96,
        boundingBox: { x: 50, y: 210, width: 180, height: 28 },
      });
    }
  }

  // 4. Validity/Expiry or Issue Date
  const validMatch = ocrText.match(/(?:Valid Till|Expiry|Valid Upto)[\s:]+([0-9]{2}[/-][0-9]{2}[/-][0-9]{4})/i);
  if (validMatch) {
    fields.push({
      fieldKey: 'validUntil',
      label: 'Valid Until',
      rawValue: validMatch[1].trim(),
      maskedValue: validMatch[1].trim(),
      confidence: 0.85,
      boundingBox: { x: 40, y: 260, width: 140, height: 25 },
    });
  }

  return fields;
}

/**
 * Checks extracted document fields against checklist requirements of a civic service.
 *
 * @param {Array<object>} extractedFields
 * @param {Array<{ key: string, label: string, required: boolean }>} requirements
 * @returns {{
 *   satisfied: boolean,
 *   matches: Array<object>,
 *   missingRequirements: Array<object>,
 *   disclaimer: string
 * }}
 */
export function checkServiceRequirements(extractedFields = [], requirements = []) {
  const fieldKeySet = new Set(extractedFields.map((f) => f.fieldKey));

  const matches = [];
  const missingRequirements = [];

  for (const req of requirements) {
    if (fieldKeySet.has(req.key)) {
      const found = extractedFields.find((f) => f.fieldKey === req.key);
      matches.push({
        ...req,
        status: 'PRESENT',
        detectedValue: found ? found.maskedValue : '',
        confidence: found ? found.confidence : 1.0,
      });
    } else {
      if (req.required) {
        missingRequirements.push({
          ...req,
          status: 'MISSING',
        });
      }
    }
  }

  return {
    satisfied: missingRequirements.length === 0,
    matches,
    missingRequirements,
    disclaimer: LEGAL_DISCLAIMER,
  };
}

/**
 * High-level assistant runner: classifies, extracts, masks, and evaluates without persisting images.
 *
 * @param {string} ocrText
 * @param {Array<object>} [serviceRequirements]
 * @returns {object} Processed document review
 */
export function processDocumentLocally(ocrText = '', serviceRequirements = []) {
  const classification = classifyDocumentType(ocrText);
  const extractedFields = extractDocumentFields(ocrText, classification.docType);
  const checklist = checkServiceRequirements(extractedFields, serviceRequirements);

  return {
    docType: classification.docType,
    classificationConfidence: classification.confidence,
    extractedFields,
    checklist,
    retentionPolicy: 'ZERO_RETENTION_CLIENT_ONLY',
    disclaimer: LEGAL_DISCLAIMER,
  };
}
