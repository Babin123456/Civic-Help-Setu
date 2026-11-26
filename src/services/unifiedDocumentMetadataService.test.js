import { describe, it, expect, beforeEach } from 'vitest';
import {
  UnifiedDocumentMetadataService,
  DocumentType,
  DocumentClassificationError
} from './unifiedDocumentMetadataService.js';

describe('UnifiedDocumentMetadataService', () => {
  let service;

  beforeEach(() => {
    service = new UnifiedDocumentMetadataService({ confidenceThreshold: 0.75 });
  });

  it('classifies clear Aadhaar identity documents with high confidence', () => {
    const result = service.classifyDocument({
      docId: 'doc_101',
      rawOcrText: 'Government of India Unique Identification Authority of India Aadhaar',
      fileName: 'aadhaar_card.pdf'
    });

    expect(result.documentType).toBe(DocumentType.IDENTITY_PROOF);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.isUncertain).toBe(false);
    expect(result.isOcrVerifiedAsFact).toBe(false); // Safety guarantee
    expect(result.status).toBe('PROVISIONALLY_CLASSIFIED');
  });

  it('routes ambiguous or low-confidence documents to human verification', () => {
    const result = service.classifyDocument({
      docId: 'doc_102',
      rawOcrText: 'Blurry municipal stamp and faded signature 1998',
      fileName: 'scan_001.jpg'
    });

    expect(result.documentType).toBe(DocumentType.UNKNOWN_UNRESOLVED);
    expect(result.isUncertain).toBe(true);
    expect(result.status).toBe('ROUTED_TO_HUMAN_VERIFICATION');
  });

  it('records versioned updates when reviewed by human verifiers', () => {
    service.classifyDocument({
      docId: 'doc_103',
      rawOcrText: 'Ambiguous paper',
      fileName: 'doc.pdf'
    });

    const updated = service.updateClassification(
      'doc_103',
      DocumentType.LAND_RECORD,
      { id: 'officer_sharma', role: 'verifier' },
      'Verified watermarked RTC deed'
    );

    expect(updated.version).toBe(2);
    expect(updated.documentType).toBe(DocumentType.LAND_RECORD);
    expect(updated.confidence).toBe(1.0);
    expect(updated.status).toBe('VERIFIED_BY_REVIEWER');
    expect(updated.versionHistory.length).toBe(2);
    expect(updated.versionHistory[1].reviewerId).toBe('officer_sharma');
  });
});
