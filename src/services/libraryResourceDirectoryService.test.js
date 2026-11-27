import { describe, it, expect } from 'vitest';
import {
  addOpeningHourException,
  getBuiltInLearningFacilities,
  migrateLibraryDirectoryState,
  moderateCommunityLibraryUpdate,
  searchLearningFacilities,
  submitCommunityLibraryUpdate,
  verifyLibraryProvenance,
} from './libraryResourceDirectoryService.js';

describe('Public Library & Community Learning Resource Directory (#1439)', () => {
  it('filters facilities by accessibility, Braille, screen reader, and digital lab', () => {
    const facilities = getBuiltInLearningFacilities();
    expect(searchLearningFacilities(facilities, { brailleOnly: true })).toHaveLength(1);
    expect(searchLearningFacilities(facilities, { screenReaderOnly: true })).toHaveLength(1);
    expect(searchLearningFacilities(facilities, { digitalLabOnly: true })).toHaveLength(1);
    expect(searchLearningFacilities(facilities, { wheelchairOnly: true })).toHaveLength(2);
  });

  it('tracks official provenance, last-verified time, opening-hour exceptions, and unverified rules', () => {
    const [central, ward08] = getBuiltInLearningFacilities();
    expect(central.officialProvenance.verified).toBe(true);
    expect(ward08.officialProvenance.verified).toBe(false);
    expect(ward08.officialProvenance.status).toBe('unverified');

    const withExc = addOpeningHourException(central, {
      actorId: 'admin-1',
      role: 'admin',
      dateRange: '2026-12-01',
      adjustedHours: 'Closed',
      isClosed: true,
      reason: 'Electrical panel upgrade.',
      officialProvenance: {
        source: 'State Library Directorate',
        jurisdiction: 'IN-UP',
        effectiveDate: '2026-11-27',
        lastVerifiedAt: new Date().toISOString(),
      },
    });
    expect(withExc.openingHourExceptions).toHaveLength(2);

    const stale = verifyLibraryProvenance(
      {
        source: 'Old record',
        jurisdiction: 'IN-UP',
        effectiveDate: '2026-01-01',
        lastVerifiedAt: '2026-01-01T00:00:00.000Z',
      },
      Date.parse('2026-11-27T00:00:00.000Z')
    );
    expect(stale.freshness).toBe('stale');
  });

  it('moderates community updates and rejects PII', () => {
    const [central] = getBuiltInLearningFacilities();
    expect(() =>
      submitCommunityLibraryUpdate(central, { note: 'Call 9876543210 or Aadhaar 2345 6789 0123.' }, 'c-1')
    ).toThrow(/Privacy violation/);

    const submitted = submitCommunityLibraryUpdate(
      central,
      { field: 'wifiAccess', note: 'Public Wi-Fi router restarted and working.' },
      'c-1'
    );
    const updateId = submitted.communityUpdates[0].updateId;
    expect(submitted.communityUpdates[0].moderationStatus).toBe('pending_moderation');

    const approved = moderateCommunityLibraryUpdate(submitted, {
      updateId,
      decision: 'approve',
      actorId: 'admin-1',
      role: 'admin',
      officialProvenance: {
        source: 'Library Steward Check',
        jurisdiction: 'IN-UP',
        effectiveDate: '2026-11-27',
        lastVerifiedAt: new Date().toISOString(),
      },
    });
    expect(approved.communityUpdates[0].moderationStatus).toBe('approved');

    const migrated = migrateLibraryDirectoryState({});
    expect(migrated.schemaVersion).toBe('1.0.0');
  });
});
