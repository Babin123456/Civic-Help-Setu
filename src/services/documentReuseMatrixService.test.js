import { describe, it, expect } from 'vitest';
import {
  buildDocumentReuseMatrix,
  buildEvidencePacketChecklist,
  exportDocumentMatrixSummary,
  calculateCitizenReuseSavings,
  PROOF_CATEGORIES,
  CANONICAL_DOCUMENTS,
  SERVICE_DOCUMENT_REGISTRY
} from './documentReuseMatrixService';

describe('documentReuseMatrixService', () => {
  it('should define proof categories and canonical proofs', () => {
    expect(PROOF_CATEGORIES.IDENTITY.code).toBe('IDENTITY');
    expect(CANONICAL_DOCUMENTS.AADHAAR_CARD.validityMonths).toBe(Infinity);
    expect(CANONICAL_DOCUMENTS.ELECTRICITY_BILL.validityMonths).toBe(3);
  });

  it('should build cross-service document reuse matrix and calculate reuse counts', () => {
    const selected = ['water-connection', 'property-tax-mutation', 'trade-licence'];
    const matrix = buildDocumentReuseMatrix(selected);

    expect(matrix.totalSelectedServices).toBe(3);
    expect(matrix.sharedCount).toBeGreaterThanOrEqual(2);
    expect(matrix.matrixRows.length).toBeGreaterThanOrEqual(4);

    // Aadhaar is shared across all 3
    const aadhaarRow = matrix.matrixRows.find(r => r.docCode === 'AADHAAR_CARD');
    expect(aadhaarRow).toBeDefined();
    expect(aadhaarRow.reuseCount).toBe(3);
    expect(aadhaarRow.isSharedAcrossServices).toBe(true);
  });

  it('should handle empty service selections gracefully', () => {
    const empty = buildDocumentReuseMatrix([]);
    expect(empty.totalSelectedServices).toBe(0);
    expect(empty.matrixRows).toHaveLength(0);
  });

  it('should build private evidence packet checklist with readiness percentages', () => {
    const selected = ['water-connection', 'trade-licence'];
    const readiness = {
      AADHAAR_CARD: 'READY',
      ELECTRICITY_BILL: 'NEEDS_RENEWAL'
    };

    const checklist = buildEvidencePacketChecklist(selected, readiness);
    expect(checklist.packetId).toBeDefined();
    expect(checklist.readyCount).toBe(1);
    expect(checklist.completionPercentage).toBeGreaterThan(0);
    expect(checklist.isOfficialApplicationSubmission).toBe(false);

    const electricityItem = checklist.items.find(i => i.docCode === 'ELECTRICITY_BILL');
    expect(electricityItem.readinessState).toBe('NEEDS_RENEWAL');
  });

  it('should calculate estimated citizen time and cost savings from reuse', () => {
    const savings = calculateCitizenReuseSavings(3);
    expect(savings.sharedDocumentsCount).toBe(3);
    expect(savings.hoursSaved).toBe(12);
    expect(savings.estimatedCostSavedINR).toBe(450);
  });

  it('should export formatted markdown summary', () => {
    const selected = ['water-connection', 'property-tax-mutation'];
    const checklist = {
      readyCount: 2,
      totalDocumentsRequired: 3,
      completionPercentage: 67
    };

    const doc = exportDocumentMatrixSummary(selected, checklist);
    expect(doc).toContain('# Cross-Service Document Reuse & Evidence Packet Dossier');
    expect(doc).toContain('Shared Reusable Proofs');
    expect(doc).toContain('Aadhaar Card');
    expect(doc).toContain('**Checklist Readiness:** 2 / 3 Ready (67%)');
  });
});
