/**
 * src/services/jurisdictionBoundaryConflictService.test.js
 *
 * Unit & border-area ambiguity tests for Jurisdiction Boundary Conflict Resolver (#1434).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BOUNDARY_DATASET_VERSIONS,
  RESOLUTION_STATUS,
  PROVENANCE_KIND,
  resolveBoundaryConflict,
  applyManualJurisdictionOverride,
  listProvenanceLogs,
  getBoundaryDatasetVersion,
} from './jurisdictionBoundaryConflictService.js';

const createMockStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
};

describe('jurisdictionBoundaryConflictService (#1434)', () => {
  let storage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('provides versioned boundary datasets with source, jurisdiction, effectiveDate, and lastVerifiedAt', () => {
    expect(BOUNDARY_DATASET_VERSIONS.length).toBeGreaterThanOrEqual(2);
    const latest = getBoundaryDatasetVersion();
    expect(latest.version).toBe('2026.2');
    expect(latest.source).toBeTruthy();
    expect(latest.jurisdiction).toBeTruthy();
    expect(latest.effectiveDate).toBeTruthy();
    expect(latest.lastVerifiedAt).toBeTruthy();
    expect(latest.verificationStatus).toBe('VERIFIED');
  });

  it('detects border-area ambiguity for Wakad / PIN 411057 with confidence scores and alternatives', () => {
    const res = resolveBoundaryConflict({
      locality: 'Wakad 411057',
      boundaryVersion: '2026.2',
      actorId: 'citizen-1',
      customStorage: storage,
    });

    expect(res.status).toBe(RESOLUTION_STATUS.AMBIGUOUS_BORDER);
    expect(res.requiresUserConfirmation).toBe(true);
    expect(res.primaryCandidate.authorityId).toBe('pcmc-ward-wakad');
    expect(res.primaryCandidate.confidence).toBeGreaterThan(0.5);
    expect(res.alternatives).toHaveLength(1);
    expect(res.alternatives[0].authorityId).toBe('pmrda-hinjawadi-gp');
    expect(res.provenanceKind).toBe(PROVENANCE_KIND.OFFICIAL_DATASET);
  });

  it('detects border-area ambiguity for Delhi NDMC/MCD (110001) and Bengaluru Anekal (560100)', () => {
    const delhi = resolveBoundaryConflict({ locality: 'Connaught Place 110001', customStorage: storage });
    expect(delhi.status).toBe(RESOLUTION_STATUS.AMBIGUOUS_BORDER);
    expect(delhi.alternatives.length).toBeGreaterThan(0);

    const blr = resolveBoundaryConflict({ locality: 'Electronic City 560100', customStorage: storage });
    expect(blr.status).toBe(RESOLUTION_STATUS.AMBIGUOUS_BORDER);
    expect(blr.alternatives.length).toBeGreaterThan(0);
  });

  it('marks unknown rules / missing state inputs as UNVERIFIED rather than guessing', () => {
    const res = resolveBoundaryConflict({
      locality: 'Unknown Hamlet',
      stateCode: '',
      customStorage: storage,
    });

    expect(res.status).toBe(RESOLUTION_STATUS.UNVERIFIED);
    expect(res.verificationStatus).toBe('UNVERIFIED');
    expect(res.provenanceKind).toBe(PROVENANCE_KIND.UNVERIFIED);
    expect(res.primaryCandidate).toBeNull();
  });

  it('supports manual override and records auditable non-PII provenance log', () => {
    const initial = resolveBoundaryConflict({
      locality: 'Wakad 411057',
      actorId: 'citizen-2',
      customStorage: storage,
    });

    const overridden = applyManualJurisdictionOverride({
      resolution: initial,
      selectedAuthorityId: 'pmrda-hinjawadi-gp',
      reason: 'Property tax receipt shows Hinjawadi Gram Panchayat',
      actorId: 'citizen-2',
      customStorage: storage,
    });

    expect(overridden.status).toBe(RESOLUTION_STATUS.MANUAL_OVERRIDE);
    expect(overridden.provenanceKind).toBe(PROVENANCE_KIND.CITIZEN_CONFIRMED);
    expect(overridden.primaryCandidate.authorityId).toBe('pmrda-hinjawadi-gp');
    expect(overridden.previousAuthorityId).toBe('pcmc-ward-wakad');

    const logs = listProvenanceLogs(storage);
    expect(logs).toHaveLength(2);
    expect(logs[0].action).toBe('MANUAL_OVERRIDE_APPLIED');
    expect(logs[0].provenanceKind).toBe(PROVENANCE_KIND.CITIZEN_CONFIRMED);
  });

  it('rejects Aadhaar/PAN/phone PII in locality and override reason', () => {
    expect(() =>
      resolveBoundaryConflict({ locality: 'Aadhaar 1234 5678 9012', customStorage: storage })
    ).toThrow(/forbidden personal data/i);

    const initial = resolveBoundaryConflict({ locality: 'Wakad 411057', customStorage: storage });
    expect(() =>
      applyManualJurisdictionOverride({
        resolution: initial,
        selectedAuthorityId: 'pmrda-hinjawadi-gp',
        reason: 'Call 9876543210 for office',
        customStorage: storage,
      })
    ).toThrow(/must not contain/i);
  });
});

