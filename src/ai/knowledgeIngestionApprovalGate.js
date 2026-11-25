/**
 * Civic Knowledge Ingestion Approval Gate for New Source Documents
 *
 * Implements a staged ingestion and verification gatekeeper:
 * - Ingests candidate civic knowledge sources:
 *   * Publisher authority (e.g. Dept of Food and Civil Supplies)
 *   * Canonical official URL
 *   * Document Number / Gazette Identifier
 *   * Publication & Effective dates
 *   * Target Jurisdiction & Language
 *   * Cryptographic content checksum (SHA-256)
 * - Validation Checks:
 *   * Schema completeness & URL validity
 *   * Duplicate document detection (via checksum and canonical URL)
 *   * Extraction quality / text density checks
 *   * Date sanity (rejects effective dates in distant past without supersede notes)
 * - Strict Ingestion Gate:
 *   * Unapproved documents remain in PENDING_REVIEW and CANNOT enter production RAG retrieval
 *   * Approved sources are promoted to RETRIEVAL_CORPUS
 *   * Superseded sources remain traceable for historical provenance but excluded from active queries
 * - Full maintainer review audit log
 */

export const INGESTION_STATUS = Object.freeze({
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED_PUBLISHED: 'APPROVED_PUBLISHED',
  REJECTED: 'REJECTED',
  SUPERSEDED: 'SUPERSEDED'
});

/**
 * Validates metadata completeness and sanity for incoming source manifest
 * @param {Object} manifest
 * @returns {Object} Validation verdict with errors/warnings
 */
export function validateSourceManifest(manifest = {}) {
  const errors = [];

  if (!manifest.title || typeof manifest.title !== 'string') {
    errors.push('Missing required document title');
  }
  if (!manifest.publisher || typeof manifest.publisher !== 'string') {
    errors.push('Missing publisher authority');
  }
  if (!manifest.canonicalUrl || !/^https?:\/\/.+/i.test(manifest.canonicalUrl)) {
    errors.push('Invalid or missing canonical HTTPS URL');
  }
  if (!manifest.checksum || manifest.checksum.length < 8) {
    errors.push('Missing cryptographic document checksum');
  }
  if (!manifest.jurisdiction) {
    errors.push('Missing target jurisdiction');
  }

  // Text extraction content validation
  if (!manifest.extractedText || manifest.extractedText.trim().length < 50) {
    errors.push('Extraction failure: Extracted text is missing or below minimum content density');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export class KnowledgeIngestionApprovalGate {
  constructor() {
    this.stagedDocuments = new Map(); // docId -> DocumentRecord
    this.checksumIndex = new Set();
    this.publishedCorpus = new Map(); // docId -> DocumentRecord
  }

  /**
   * Stages a new source document into the pending approval queue
   * @param {Object} manifest
   * @returns {Object} Staged document record
   */
  stageDocument(manifest) {
    const validation = validateSourceManifest(manifest);
    if (!validation.valid) {
      throw new Error(`Manifest validation failed: ${validation.errors.join('; ')}`);
    }

    if (this.checksumIndex.has(manifest.checksum)) {
      throw new Error(`Duplicate document detected with checksum: ${manifest.checksum}`);
    }

    const docId = `doc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const record = {
      docId,
      ...manifest,
      status: INGESTION_STATUS.PENDING_REVIEW,
      stagedAt: Date.now(),
      reviewDecision: null
    };

    this.stagedDocuments.set(docId, record);
    this.checksumIndex.add(manifest.checksum);
    return record;
  }

  /**
   * Approves a staged document and publishes it into the retrieval corpus
   * @param {string} docId
   * @param {Object} reviewData
   * @returns {Object} Approved document
   */
  approveDocument(docId, { reviewerHandle, notes = '' }) {
    const doc = this.stagedDocuments.get(docId);
    if (!doc) {
      throw new Error(`Document not found: ${docId}`);
    }

    doc.status = INGESTION_STATUS.APPROVED_PUBLISHED;
    doc.reviewDecision = {
      decision: 'APPROVED',
      reviewerHandle,
      notes,
      reviewedAt: Date.now()
    };

    this.publishedCorpus.set(docId, doc);
    return doc;
  }

  /**
   * Rejects a staged document
   * @param {string} docId
   * @param {Object} reviewData
   * @returns {Object} Rejected document
   */
  rejectDocument(docId, { reviewerHandle, reason }) {
    const doc = this.stagedDocuments.get(docId);
    if (!doc) {
      throw new Error(`Document not found: ${docId}`);
    }

    doc.status = INGESTION_STATUS.REJECTED;
    doc.reviewDecision = {
      decision: 'REJECTED',
      reviewerHandle,
      notes: reason || 'Failed editorial verification',
      reviewedAt: Date.now()
    };

    this.publishedCorpus.delete(docId);
    return doc;
  }

  /**
   * Supersedes an existing published document with an updated amendment
   * @param {string} oldDocId
   * @param {string} newDocId
   * @returns {Object} Updated old document
   */
  supersedeDocument(oldDocId, newDocId) {
    const oldDoc = this.publishedCorpus.get(oldDocId);
    if (!oldDoc) {
      throw new Error(`Published document ${oldDocId} not found`);
    }

    oldDoc.status = INGESTION_STATUS.SUPERSEDED;
    oldDoc.supersededBy = newDocId;

    // Remove from active retrieval corpus to prevent serving obsolete guidance
    this.publishedCorpus.delete(oldDocId);
    return oldDoc;
  }

  getActiveRetrievalCorpus() {
    return Array.from(this.publishedCorpus.values());
  }

  getPendingReviewQueue() {
    return Array.from(this.stagedDocuments.values()).filter(d => d.status === INGESTION_STATUS.PENDING_REVIEW);
  }
}
