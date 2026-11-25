/**
 * Public-Service Document OCR Correction Canvas Service
 *
 * Implements a privacy-preserving document OCR visualizer, field confidence overlay,
 * bounding-box inspection engine, and user-correction workflow:
 *
 * 1. Consent-Gated Document Ingestion & Bounding-Box Overlay:
 *    - Ingests scanned documents with explicit citizen consent.
 *    - Maps extracted civic fields to visual bounding boxes on canvas pages.
 *    - Categorizes confidence tiers (HIGH, MEDIUM, LOW) for intuitive visual scrutiny.
 *
 * 2. Interactive Canvas State Management:
 *    - Supports multi-page navigation, 90-degree stepped rotation, and bounded zoom (0.5x to 3.0x).
 *    - Provides a low-confidence filter to rapidly isolate dubious extractions.
 *
 * 3. Human-in-the-Loop Correction & Audit Trail:
 *    - Allows citizens to inspect, correct, confirm, or remove proposed values.
 *    - Prohibits automated submission of unconfirmed extractions to statutory portals.
 *
 * 4. Screen-Reader & Keyboard Accessible Alternative:
 *    - Provides a linearized WCAG-compliant table mapping each field to page coordinates and confidence ratings.
 *
 * 5. Irrevocable Purge & Export Sanitization:
 *    - Provides immediate deletion of documents and derived extractions upon citizen request.
 *    - Sanitizes audit logs by redacting sensitive values (Aadhaar, income numbers, consumer IDs).
 */

export const CONFIDENCE_TIER = {
  HIGH_CONFIDENCE: 'HIGH_CONFIDENCE',           // >= 0.85 (Green)
  MEDIUM_REVIEW_RECOMMENDED: 'MEDIUM_REVIEW_RECOMMENDED', // 0.60 - 0.84 (Amber)
  LOW_CORRECTION_REQUIRED: 'LOW_CORRECTION_REQUIRED',   // < 0.60 (Red)
};

export const FIELD_EXTRACTION_STATUS = {
  PROPOSED_BY_OCR: 'PROPOSED_BY_OCR',
  USER_CONFIRMED: 'USER_CONFIRMED',
  USER_CORRECTED: 'USER_CORRECTED',
  USER_REMOVED: 'USER_REMOVED',
};

export const CANVAS_VIEWER_STATE = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  EMPTY: 'EMPTY',
  ERROR: 'ERROR',
  STALE_DATA_WARNING: 'STALE_DATA_WARNING',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  READY: 'READY',
};

export const SUPPORTED_DOCUMENT_TYPE = {
  INCOME_SALARY_SLIP: 'INCOME_SALARY_SLIP',
  ELECTRICITY_BILL_ADDRESS_PROOF: 'ELECTRICITY_BILL_ADDRESS_PROOF',
  PROPERTY_TAX_RECEIPT: 'PROPERTY_TAX_RECEIPT',
  TRADE_LICENCE_CERTIFICATE: 'TRADE_LICENCE_CERTIFICATE',
};

export const STATUTORY_OCR_DISCLAIMER =
  'Statutory Notice: OCR extraction and bounding box overlays are advisory preparation aids to accelerate checklist verification. Confidence ratings are visual inspection tools, not official authenticity or entitlement verdicts. Extracted data will not be submitted to statutory portals without citizen confirmation.';

/**
 * Calculates confidence tier based on normalized score (0.0 to 1.0).
 *
 * @param {number} score
 * @returns {string} Confidence tier
 */
export function classifyConfidenceTier(score) {
  const numeric = Number(score);
  if (isNaN(numeric) || numeric < 0 || numeric > 1) {
    throw new Error(`Invalid confidence score '${score}': must be a number between 0.0 and 1.0`);
  }
  if (numeric >= 0.85) return CONFIDENCE_TIER.HIGH_CONFIDENCE;
  if (numeric >= 0.60) return CONFIDENCE_TIER.MEDIUM_REVIEW_RECOMMENDED;
  return CONFIDENCE_TIER.LOW_CORRECTION_REQUIRED;
}

// In-memory document session store
const documentOcrSessionStore = new Map();

/**
 * Creates a new document OCR correction canvas session.
 *
 * @param {Object} input
 * @returns {Object} Initialized session
 */
export function createDocumentOcrSession(input = {}) {
  const {
    ownerId,
    documentType,
    documentFileName,
    pageCount = 1,
    explicitConsentGiven = false,
    rawExtractions = [],
  } = input;

  if (!ownerId || typeof ownerId !== 'string') {
    throw new Error('Valid ownerId is required for document session');
  }

  if (!explicitConsentGiven) {
    throw new Error('Explicit citizen consent is strictly required before processing document scans');
  }

  if (!Object.values(SUPPORTED_DOCUMENT_TYPE).includes(documentType)) {
    throw new Error(`Unsupported documentType: '${documentType}'`);
  }

  const documentId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Process raw extractions with bounding boxes and confidence tiers
  const fields = rawExtractions.map((raw, index) => {
    const confidenceScore = Number(raw.confidenceScore || 0.5);
    const confidenceTier = classifyConfidenceTier(confidenceScore);

    return {
      fieldId: raw.fieldId || `fld_${index + 1}`,
      fieldKey: raw.fieldKey,
      label: raw.label || raw.fieldKey,
      extractedValue: String(raw.extractedValue || ''),
      confirmedValue: String(raw.extractedValue || ''),
      confidenceScore,
      confidenceTier,
      status: FIELD_EXTRACTION_STATUS.PROPOSED_BY_OCR,
      pageIndex: Number(raw.pageIndex || 0),
      boundingBox: {
        x: Number(raw.boundingBox?.x || 0),
        y: Number(raw.boundingBox?.y || 0),
        width: Number(raw.boundingBox?.width || 100),
        height: Number(raw.boundingBox?.height || 30),
      },
      modelEngine: raw.modelEngine || 'Tesseract-Civic-v2',
      modelVersion: raw.modelVersion || '2.1.0',
      lastModifiedAt: new Date().toISOString(),
    };
  });

  const session = {
    documentId,
    ownerId,
    documentType,
    documentFileName: documentFileName || 'scanned_civic_document.pdf',
    pageCount: Math.max(1, Number(pageCount)),
    currentPageIndex: 0,
    canvasTransform: {
      rotationDegrees: 0,
      zoomLevel: 1.0,
    },
    fields,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    statutoryDisclaimer: STATUTORY_OCR_DISCLAIMER,
  };

  documentOcrSessionStore.set(documentId, session);
  return session;
}

/**
 * Retrieves a document session ensuring citizen authorization.
 *
 * @param {string} documentId
 * @param {string} ownerId
 * @returns {Object|null}
 */
export function getDocumentOcrSession(documentId, ownerId) {
  if (!documentId || !ownerId) return null;
  const session = documentOcrSessionStore.get(documentId);
  if (!session) return null;

  if (session.ownerId !== ownerId) {
    throw new Error('Access Denied: You cannot view or correct another citizen document');
  }

  return session;
}

/**
 * Updates a proposed field value with a citizen correction.
 *
 * @param {string} documentId
 * @param {string} ownerId
 * @param {string} fieldId
 * @param {string} correctedValue
 * @returns {Object} Updated session
 */
export function correctExtractedField(documentId, ownerId, fieldId, correctedValue) {
  const session = getDocumentOcrSession(documentId, ownerId);
  if (!session) {
    throw new Error(`Session '${documentId}' not found`);
  }

  const field = session.fields.find((f) => f.fieldId === fieldId);
  if (!field) {
    throw new Error(`Field '${fieldId}' not found in document extractions`);
  }

  field.confirmedValue = String(correctedValue);
  field.status = FIELD_EXTRACTION_STATUS.USER_CORRECTED;
  field.lastModifiedAt = new Date().toISOString();
  session.updatedAt = new Date().toISOString();

  documentOcrSessionStore.set(documentId, session);
  return session;
}

/**
 * Confirms a proposed field value without modifications.
 *
 * @param {string} documentId
 * @param {string} ownerId
 * @param {string} fieldId
 * @returns {Object} Updated session
 */
export function confirmExtractedField(documentId, ownerId, fieldId) {
  const session = getDocumentOcrSession(documentId, ownerId);
  if (!session) {
    throw new Error(`Session '${documentId}' not found`);
  }

  const field = session.fields.find((f) => f.fieldId === fieldId);
  if (!field) {
    throw new Error(`Field '${fieldId}' not found in document extractions`);
  }

  field.status = FIELD_EXTRACTION_STATUS.USER_CONFIRMED;
  field.lastModifiedAt = new Date().toISOString();
  session.updatedAt = new Date().toISOString();

  documentOcrSessionStore.set(documentId, session);
  return session;
}

/**
 * Removes a field that was incorrectly detected by OCR.
 *
 * @param {string} documentId
 * @param {string} ownerId
 * @param {string} fieldId
 * @returns {Object} Updated session
 */
export function removeExtractedField(documentId, ownerId, fieldId) {
  const session = getDocumentOcrSession(documentId, ownerId);
  if (!session) {
    throw new Error(`Session '${documentId}' not found`);
  }

  const field = session.fields.find((f) => f.fieldId === fieldId);
  if (!field) {
    throw new Error(`Field '${fieldId}' not found in document extractions`);
  }

  field.status = FIELD_EXTRACTION_STATUS.USER_REMOVED;
  field.lastModifiedAt = new Date().toISOString();
  session.updatedAt = new Date().toISOString();

  documentOcrSessionStore.set(documentId, session);
  return session;
}

/**
 * Updates interactive canvas transform (rotation, zoom, page).
 *
 * @param {string} documentId
 * @param {string} ownerId
 * @param {Object} options
 * @returns {Object} Updated session
 */
export function updateCanvasTransform(documentId, ownerId, options = {}) {
  const session = getDocumentOcrSession(documentId, ownerId);
  if (!session) {
    throw new Error(`Session '${documentId}' not found`);
  }

  const { rotationDegrees, zoomLevel, pageIndex } = options;

  if (rotationDegrees !== undefined) {
    const validRotations = [0, 90, 180, 270];
    const normalizedRotation = ((rotationDegrees % 360) + 360) % 360;
    if (!validRotations.includes(normalizedRotation)) {
      throw new Error(`Rotation must be a multiple of 90 degrees (0, 90, 180, 270)`);
    }
    session.canvasTransform.rotationDegrees = normalizedRotation;
  }

  if (zoomLevel !== undefined) {
    const zoom = Number(zoomLevel);
    if (isNaN(zoom) || zoom < 0.5 || zoom > 3.0) {
      throw new Error('Zoom level must be between 0.5x and 3.0x');
    }
    session.canvasTransform.zoomLevel = zoom;
  }

  if (pageIndex !== undefined) {
    const page = Number(pageIndex);
    if (isNaN(page) || page < 0 || page >= session.pageCount) {
      throw new Error(`Page index must be between 0 and ${session.pageCount - 1}`);
    }
    session.currentPageIndex = page;
  }

  session.updatedAt = new Date().toISOString();
  documentOcrSessionStore.set(documentId, session);
  return session;
}

/**
 * Produces a screen-reader friendly accessible table of OCR fields.
 *
 * @param {Object} session Active document session
 * @param {Object} options Optional filter (e.g. lowConfidenceOnly)
 * @returns {Array<Object>} Accessible rows
 */
export function getAccessibleOcrFieldsTable(session, options = {}) {
  if (!session || !Array.isArray(session.fields)) {
    throw new Error('Valid session with fields array is required');
  }

  const { lowConfidenceOnly = false } = options;

  let activeFields = session.fields.filter((f) => f.status !== FIELD_EXTRACTION_STATUS.USER_REMOVED);

  if (lowConfidenceOnly) {
    activeFields = activeFields.filter((f) => f.confidenceTier === CONFIDENCE_TIER.LOW_CORRECTION_REQUIRED);
  }

  return activeFields.map((f) => ({
    fieldId: f.fieldId,
    label: f.label,
    extractedValue: f.extractedValue,
    confirmedValue: f.confirmedValue,
    confidenceTier: f.confidenceTier,
    confidencePercentage: `${Math.round(f.confidenceScore * 100)}%`,
    status: f.status,
    page: f.pageIndex + 1,
    coordinates: `X:${f.boundingBox.x}, Y:${f.boundingBox.y}, W:${f.boundingBox.width}, H:${f.boundingBox.height}`,
  }));
}

/**
 * Irrevocably purges the raw document and derived extractions upon citizen deletion request.
 *
 * @param {string} documentId
 * @param {string} ownerId
 * @returns {boolean} True if successfully deleted
 */
export function deleteDocumentAndExtractions(documentId, ownerId) {
  const session = getDocumentOcrSession(documentId, ownerId);
  if (!session) return false;

  // Clear fields and delete from store
  session.fields = [];
  return documentOcrSessionStore.delete(documentId);
}

/**
 * Sanitizes an OCR session for compliance export, masking sensitive values.
 *
 * @param {Object} session
 * @returns {Object} Sanitized object
 */
export function sanitizeOcrSessionForExport(session) {
  if (!session || typeof session !== 'object') return null;

  const sanitized = JSON.parse(JSON.stringify(session));
  sanitized.documentId = 'REDACTED_DOC_ID';
  sanitized.ownerId = 'REDACTED_CITIZEN_ID';
  sanitized.documentFileName = 'REDACTED_FILENAME.pdf';

  // Scrub extracted and confirmed text values
  (sanitized.fields || []).forEach((f) => {
    f.extractedValue = '[REDACTED_CONFIDENTIAL_INPUT]';
    f.confirmedValue = '[REDACTED_CONFIDENTIAL_INPUT]';
  });

  return sanitized;
}

/**
 * Clears in-memory document store (for testing).
 */
export function _resetDocumentOcrSessionStore() {
  documentOcrSessionStore.clear();
}
