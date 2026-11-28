import { describe, it, expect } from 'vitest';
import {
  listVersionedMappings,
  diagnosePmKisanStatus,
  toggleHelpDeskChecklistItem,
  updateStatusMappingGovernance,
  getGovernanceAuditLog,
  hasForbiddenPII,
  PM_KISAN_MAPPING_VERSION,
} from './pmKisanExceptionGuideService.js';

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

describe('pmKisanExceptionGuideService', () => {
  it('maps versioned official statuses, handles unknown states safely, and builds printable checklist', () => {
    const storage = makeMemoryStorage();
    const mappings = listVersionedMappings(storage);
    expect(mappings.length).toBeGreaterThanOrEqual(4);
    expect(mappings[0].version).toBe(PM_KISAN_MAPPING_VERSION);

    const known = diagnosePmKisanStatus({
      actorId: 'farmer-1',
      statusCode: 'land_seeding_no',
      storage,
    });
    expect(known.ok).toBe(true);
    expect(known.session.diagnosis.verificationStatus).toBe('VERIFIED');
    expect(known.session.diagnosis.sourceUrl).toBe('https://pmkisan.gov.in/');
    expect(known.session.printableChecklistText).toContain('PM-KISAN Help-Desk Checklist');

    const tog = toggleHelpDeskChecklistItem({
      sessionId: known.session.sessionId,
      actorId: 'farmer-1',
      itemLabel: known.session.diagnosis.documentsToCarry[0],
      checked: true,
      storage,
    });
    expect(tog.ok).toBe(true);
    expect(tog.state.checked).toContain(known.session.diagnosis.documentsToCarry[0]);

    // Unknown status marked UNVERIFIED
    const unknown = diagnosePmKisanStatus({
      actorId: 'farmer-1',
      statusCode: 'unrecognized_code',
      customPortalMessage: 'State Nodal Pending',
      storage,
    });
    expect(unknown.ok).toBe(true);
    expect(unknown.session.diagnosis.unknownState).toBe(true);
    expect(unknown.session.diagnosis.verificationStatus).toBe('UNVERIFIED');
  });

  it('enforces role authorization on governance updates and rejects credentials/PII', () => {
    const storage = makeMemoryStorage();
    expect(hasForbiddenPII('1234 5678 9012')).toBe(true);
    expect(hasForbiddenPII({ otp: '123456' })).toBe(true);

    const citizenUpdate = updateStatusMappingGovernance({
      mappingCode: 'ekyc_pending',
      actorId: 'farmer-1',
      role: 'citizen',
      sourceUrl: 'https://pmkisan.gov.in/',
      storage,
    });
    expect(citizenUpdate.ok).toBe(false);
    expect(citizenUpdate.code).toBe(403);

    const reviewerUpdate = updateStatusMappingGovernance({
      mappingCode: 'ekyc_pending',
      actorId: 'reviewer-1',
      role: 'reviewer',
      sourceUrl: 'https://pmkisan.gov.in/',
      jurisdiction: 'India',
      effectiveDate: '2026-01-01',
      lastVerifiedAt: '2026-02-15',
      storage,
    });
    expect(reviewerUpdate.ok).toBe(true);

    const audit = getGovernanceAuditLog({ actorId: 'reviewer-1', role: 'reviewer', storage });
    expect(audit.ok).toBe(true);
    expect(audit.entries).toHaveLength(1);
  });
});
