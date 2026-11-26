/**
 * @file unifiedDocumentMetadataService.js
 * @description Centralized document classification and metadata management service.
 * Classifies uploaded citizen documents and public gazettes into typed categories (IDENTITY, ADDRESS, INCOME, CASTE, LAND_RECORD).
 * Explicitly flags classification uncertainty, routes ambiguous scans to human verifiers, versions metadata modifications,
 * and ensures raw OCR text is never treated as verified factual truth.
 */

export class DocumentClassificationError extends Error {
  constructor(message, code = 'DOCUMENT_CLASSIFICATION_ERROR') {
    super(message);
    this.name = 'DocumentClassificationError';
    this.code = code;
  }
}

export const DocumentType = Object.freeze({
  IDENTITY_PROOF: 'IDENTITY_PROOF',
  ADDRESS_PROOF: 'ADDRESS_PROOF',
  INCOME_CERTIFICATE: 'INCOME_CERTIFICATE',
  CASTE_CERTIFICATE: 'CASTE_CERTIFICATE',
  LAND_RECORD: 'LAND_RECORD',
  PUBLIC_GAZETTE: 'PUBLIC_GAZETTE',
  UNKNOWN_UNRESOLVED: 'UNKNOWN_UNRESOLVED'
});

export class UnifiedDocumentMetadataService {
  constructor(options = {}) {
    this.confidenceThreshold = options.confidenceThreshold || 0.75;
    this.metadataStore = new Map(); // docId -> metadata record
  }

  /**
   * Classifies a document based on raw OCR candidates and structural hints.
   * Never assumes raw OCR text is absolute truth.
   */
  classifyDocument({ docId, rawOcrText = '', fileName = '', userHint = null }) {
    if (!docId) {
      throw new DocumentClassificationError('docId is required', 'INVALID_ARGUMENT');
    }

    const text = rawOcrText.toLowerCase();
    const name = fileName.toLowerCase();

    let bestType = DocumentType.UNKNOWN_UNRESOLVED;
    let confidence = 0.0;
    let matchedKeywords = [];

    // Rule: Identity proof (Aadhaar / Voter ID / Passport)
    if (text.includes('unique identification authority') || text.includes('aadhaar') || name.includes('aadhaar') || text.includes('election commission of india')) {
      bestType = DocumentType.IDENTITY_PROOF;
      confidence = 0.92;
      matchedKeywords.push('Aadhaar / Election Commission markers');
    }
    // Rule: Income certificate
    else if (text.includes('income certificate') || text.includes('annual income') || text.includes('revenue department') && text.includes('tahsildar')) {
      bestType = DocumentType.INCOME_CERTIFICATE;
      confidence = 0.88;
      matchedKeywords.push('Income / Tahsildar stamp');
    }
    // Rule: Caste certificate
    else if (text.includes('caste certificate') || text.includes('scheduled caste') || text.includes('backward class')) {
      bestType = DocumentType.CASTE_CERTIFICATE;
      confidence = 0.90;
      matchedKeywords.push('Caste certificate notification');
    }
    // Rule: Land record (Khata / RTC / Patta)
    else if (text.includes('record of rights') || text.includes('rtc') || text.includes('khata certificate') || text.includes('survey number')) {
      bestType = DocumentType.LAND_RECORD;
      confidence = 0.85;
      matchedKeywords.push('RTC / Land Record survey cues');
    } else if (userHint && Object.values(DocumentType).includes(userHint)) {
      bestType = userHint;
      confidence = 0.60; // User hint alone has moderate confidence
      matchedKeywords.push('User declaration hint');
    }

    const isUncertain = confidence < this.confidenceThreshold;
    const initialStatus = isUncertain ? 'ROUTED_TO_HUMAN_VERIFICATION' : 'PROVISIONALLY_CLASSIFIED';

    const timestamp = new Date().toISOString();
    const metadataRecord = {
      docId,
      version: 1,
      documentType: isUncertain ? DocumentType.UNKNOWN_UNRESOLVED : bestType,
      provisionalType: bestType,
      confidence: Number(confidence.toFixed(2)),
      isUncertain,
      rawOcrTextCaptured: Boolean(rawOcrText),
      isOcrVerifiedAsFact: false, // Strict safety guarantee
      status: initialStatus,
      matchedKeywords,
      versionHistory: [
        { version: 1, type: bestType, confidence, status: initialStatus, timestamp }
      ],
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.metadataStore.set(docId, metadataRecord);
    return metadataRecord;
  }

  /**
   * Human operator or verified official updates/confirms the document classification.
   */
  updateClassification(docId, verifiedType, reviewerPrincipal, reason = 'HUMAN_EXPERT_REVIEW') {
    const record = this.metadataStore.get(docId);
    if (!record) {
      throw new DocumentClassificationError(`Document ${docId} not found`, 'NOT_FOUND');
    }

    record.version += 1;
    record.documentType = verifiedType;
    record.confidence = 1.0;
    record.isUncertain = false;
    record.status = 'VERIFIED_BY_REVIEWER';
    const timestamp = new Date().toISOString();
    record.updatedAt = timestamp;

    record.versionHistory.push({
      version: record.version,
      type: verifiedType,
      confidence: 1.0,
      reviewerId: reviewerPrincipal?.id || 'reviewer_agent',
      status: record.status,
      reason,
      timestamp
    });

    return record;
  }

  getMetadata(docId) {
    return this.metadataStore.get(docId) || null;
  }
}

export const defaultDocumentMetadataService = new UnifiedDocumentMetadataService();
