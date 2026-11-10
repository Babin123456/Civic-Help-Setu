import { describe, it, expect } from 'vitest';
import {
  auditEventChronology,
  auditDuplicateFiles,
  auditEvidenceCompleteness,
  runGrievanceAudit,
  EVIDENCE_AUDIT_STATUS,
  GRIEVANCE_DISCLAIMER,
} from './grievanceEvidenceAuditorService.js';

describe('Grievance Evidence Completeness and Chronology Auditor Service', () => {
  it('detects chronological sequence inversion and invalid dates', () => {
    const events = [
      { id: 'ev-1', title: 'Filed Online Complaint', date: '2025-03-10' },
      { id: 'ev-2', title: 'Inspection by Junior Engineer', date: '2025-02-15' }, // Earlier than filing!
      { id: 'ev-3', title: 'Resolution Promised', date: 'not-a-valid-date' },
    ];

    const issues = auditEventChronology(events);
    expect(issues.length).toBe(2);

    const invalidDate = issues.find((i) => i.code === 'INVALID_DATE');
    expect(invalidDate.eventId).toBe('ev-3');

    const outOfOrder = issues.find((i) => i.code === 'CHRONOLOGY_OUT_OF_ORDER');
    expect(outOfOrder.eventId).toBe('ev-1');
  });

  it('detects duplicate file uploads by content hash or filename', () => {
    const files = [
      { id: 'f-1', name: 'receipt.pdf', size: 1024, hash: 'hash-abc-123' },
      { id: 'f-2', name: 'id_proof.jpg', size: 2048, hash: 'hash-def-456' },
      { id: 'f-3', name: 'copy_of_receipt.pdf', size: 1024, hash: 'hash-abc-123' },
    ];

    const duplicates = auditDuplicateFiles(files);
    expect(duplicates.length).toBe(1);
    expect(duplicates[0].fileId).toBe('f-3');
    expect(duplicates[0].duplicateOfId).toBe('f-1');
  });

  it('identifies statutory missing evidence vs general advice items', () => {
    const completeness = auditEvidenceCompleteness({
      grievanceCategory: 'MUNICIPAL_SERVICES',
      attachedDocuments: [
        { name: 'photo_proof_drainage.jpg', category: 'photo_proof' },
      ],
    });

    expect(completeness.checklist.length).toBe(2);

    const ackItem = completeness.checklist.find((c) => c.key === 'acknowledgement');
    expect(ackItem.status).toBe(EVIDENCE_AUDIT_STATUS.POSSIBLY_MISSING);
    expect(ackItem.isStatutory).toBe(true);
    expect(ackItem.citation).toContain('Citizen Charter');

    const photoItem = completeness.checklist.find((c) => c.key === 'photo_proof');
    expect(photoItem.status).toBe(EVIDENCE_AUDIT_STATUS.PRESENT);
    expect(photoItem.isStatutory).toBe(false);
  });

  it('runs complete audit and enforces non-training and disclaimer integrity', () => {
    const packet = {
      id: 'grv-789',
      category: 'PENSION',
      events: [
        { id: 'e1', title: 'Retirement Date', date: '2024-05-01' },
        { id: 'e2', title: 'Pension Disbursal Halted', date: '2024-08-01' },
      ],
      attachments: [
        { id: 'att-1', name: 'ppo_copy.pdf', category: 'ppo_copy' },
      ],
    };

    const audit = runGrievanceAudit(packet);

    expect(audit.canExport).toBe(true);
    expect(audit.trainingOptIn).toBe(false);
    expect(audit.disclaimer).toBe(GRIEVANCE_DISCLAIMER);
    expect(audit.chronologyIssues.length).toBe(0);
    expect(audit.duplicateFiles.length).toBe(0);

    const bankReq = audit.completeness.checklist.find((c) => c.key === 'bank_statement');
    expect(bankReq.status).toBe(EVIDENCE_AUDIT_STATUS.POSSIBLY_MISSING);
  });
});
