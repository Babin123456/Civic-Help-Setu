import { describe, it, expect } from 'vitest';
import {
  WATERBODY_ORIGIN,
  addCommunityObservation,
  getBuiltInWaterbodyProjects,
  migrateWaterbodyStoreState,
  recordMilestoneCorrection,
  verifyWaterbodySourceProvenance,
} from './waterbodyRestorationService.js';

describe('Public Waterbody Restoration Milestone & Evidence Tracker (#1442)', () => {
  it('separates official milestones from community observations and marks incomplete sources unverified', () => {
    const [wb] = getBuiltInWaterbodyProjects();
    expect(wb.baselineSource.verified).toBe(true);

    const testingMilestone = wb.officialMilestones.find((m) => m.milestoneType === 'water_testing');
    expect(testingMilestone.officialSource.verified).toBe(false);
    expect(testingMilestone.officialSource.status).toBe('unverified');

    const updated = addCommunityObservation(
      wb,
      {
        milestoneType: 'inlet_cleanup',
        note: 'Inlet mesh cleared of floating plastic.',
        evidenceRef: 'photo-hash-1234',
      },
      'citizen-1'
    );
    expect(updated.communityObservations[0].origin).toBe(WATERBODY_ORIGIN.CITIZEN_OBSERVATION);
    expect(updated.officialMilestones).toHaveLength(4);
  });

  it('rejects unsupported environmental health claims and PII', () => {
    const [wb] = getBuiltInWaterbodyProjects();
    expect(() =>
      addCommunityObservation(wb, {
        milestoneType: 'water_testing',
        note: 'Water is 100% safe to drink now.',
      })
    ).toThrow(/Unsupported environmental health claim/);

    expect(() =>
      addCommunityObservation(wb, {
        milestoneType: 'desilting',
        note: 'Aadhaar 2345 6789 0123 observed.',
      })
    ).toThrow(/Privacy violation/);
  });

  it('preserves corrections append-only with official source provenance', () => {
    const [wb] = getBuiltInWaterbodyProjects();
    const corrected = recordMilestoneCorrection(wb, {
      actorId: 'admin-1',
      role: 'admin',
      milestoneType: 'water_testing',
      correctedStatus: 'verified_lab_complete',
      reason: 'UPPCB lab report #991 published.',
      officialSource: {
        source: 'UPPCB Water Lab Report #991',
        jurisdiction: 'IN-UP',
        effectiveDate: '2026-11-21',
        lastVerifiedAt: '2026-11-21T10:00:00.000Z',
      },
    });

    expect(corrected.corrections).toHaveLength(1);
    expect(corrected.corrections[0].previousStatus).toBe('pending_lab_report');
    expect(corrected.corrections[0].correctedStatus).toBe('verified_lab_complete');

    const unverified = verifyWaterbodySourceProvenance({ source: 'Draft' });
    expect(unverified.verified).toBe(false);

    const migrated = migrateWaterbodyStoreState({});
    expect(migrated.schemaVersion).toBe('1.0.0');
  });
});
