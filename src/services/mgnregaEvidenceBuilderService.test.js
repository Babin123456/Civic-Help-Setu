import { describe, it, expect } from 'vitest';
import {
  createEvidenceCase,
  recordWorkAllocation,
  addMusterRollAndWageEvidence,
  exportPrivacySafeComplaintDossier,
  getEvidenceCase,
  hasForbiddenPII,
} from './mgnregaEvidenceBuilderService.js';

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

describe('mgnregaEvidenceBuilderService', () => {
  it('builds a factual timeline, detects muster-roll discrepancies, and never fabricates entitlements', () => {
    const storage = makeMemoryStorage();
    const created = createEvidenceCase({
      workerId: 'worker-1',
      jobCardRef: 'UP-01-002-003-0456',
      panchayat: 'Rampur GP',
      jurisdiction: 'Uttar Pradesh',
      demandReceiptRef: 'DR-2026-11',
      demandDate: '2026-10-01',
      daysDemanded: 14,
      storage,
    });
    expect(created.ok).toBe(true);
    expect(created.evidenceCase.officialRuleMetadata.localRule.verificationStatus).toBe('UNVERIFIED');

    const caseId = created.evidenceCase.caseId;
    const alloc = recordWorkAllocation({
      caseId,
      actorId: 'worker-1',
      allocationStatus: 'allocated',
      workAllocationDate: '2026-10-20',
      worksiteName: 'Pond Desilting Worksite',
      storage,
    });
    expect(alloc.ok).toBe(true);
    expect(alloc.evidenceCase.workAllocation.exceeded15DayWindow).toBe(true);

    const muster = addMusterRollAndWageEvidence({
      caseId,
      actorId: 'worker-1',
      musterRollRef: 'MR-9901',
      workedPeriodStart: '2026-10-21',
      workedPeriodEnd: '2026-11-03',
      daysWorkedClaimed: 14,
      daysRecordedOnMusterRoll: 10,
      wageCreditStatus: 'unpaid',
      unpaidPeriodNote: 'Wages not credited after closure',
      storage,
    });
    expect(muster.ok).toBe(true);
    expect(muster.entry.hasMusterRollDiscrepancy).toBe(true);

    const exp = exportPrivacySafeComplaintDossier({
      caseId,
      actorId: 'worker-1',
      saveToGrievanceDrafts: true,
      storage,
    });
    expect(exp.ok).toBe(true);
    expect(exp.dossier.fabricatedEntitlementCalculations).toBe(false);
    expect(exp.dossier.jobCardRef).toBe('***0456');
  });

  it('enforces worker ownership and rejects forbidden PII', () => {
    const storage = makeMemoryStorage();
    expect(hasForbiddenPII('1234 5678 9012')).toBe(true);
    expect(hasForbiddenPII({ bankAccount: '1234567890' })).toBe(true);

    const created = createEvidenceCase({
      workerId: 'worker-1',
      demandReceiptRef: 'DR-1',
      demandDate: '2026-10-01',
      storage,
    });
    const crossRead = getEvidenceCase({
      caseId: created.evidenceCase.caseId,
      actorId: 'worker-other',
      storage,
    });
    expect(crossRead.ok).toBe(false);
    expect(crossRead.code).toBe(403);
  });
});
