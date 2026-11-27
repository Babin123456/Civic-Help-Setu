import { describe, it, expect } from 'vitest';
import {
  AMENITY_STATUS,
  getBuiltInParkSchedules,
  migrateParkMaintenanceState,
  moderatePhotoForPersonalData,
  publishMaintenanceWindow,
  submitResidentParkObservation,
  verifyParkSourceProvenance,
} from './parkMaintenanceScheduleService.js';

describe('Public Park Maintenance & Amenity Inspection Schedule (#1440)', () => {
  it('tracks amenities separately with source freshness and temporary closure alerts', () => {
    const [park] = getBuiltInParkSchedules();
    expect(park.amenities).toHaveLength(5);
    const lighting = park.amenities.find((a) => a.amenityType === 'lighting');
    expect(lighting.operationalStatus).toBe(AMENITY_STATUS.UNVERIFIED);
    expect(lighting.officialSource.status).toBe('unverified');

    const updated = publishMaintenanceWindow(park, {
      actorId: 'admin-1',
      role: 'admin',
      amenityType: 'play_area',
      startAt: '2026-11-27T08:00:00.000Z',
      endAt: '2026-11-28T18:00:00.000Z',
      reason: 'Swing chain replacement.',
      isTemporaryClosure: true,
      officialSource: {
        source: 'LMC Parks Engineering Order #55',
        jurisdiction: 'IN-UP',
        effectiveDate: '2026-11-27',
        lastVerifiedAt: new Date().toISOString(),
      },
    });

    const playArea = updated.amenities.find((a) => a.amenityType === 'play_area');
    expect(playArea.operationalStatus).toBe(AMENITY_STATUS.CLOSED_FOR_MAINTENANCE);
    expect(updated.closureAlerts.length).toBeGreaterThanOrEqual(2);
  });

  it('moderates photos for personal data (faces, plates, unstripped EXIF, PII)', () => {
    const faces = moderatePhotoForPersonalData({
      photoRef: 'photo-1',
      containsFacesOrPlates: true,
    });
    expect(faces.passed).toBe(false);

    const unstrippedExif = moderatePhotoForPersonalData({
      photoRef: 'photo-2',
      exifStripped: false,
    });
    expect(unstrippedExif.passed).toBe(false);

    const [park] = getBuiltInParkSchedules();
    expect(() =>
      submitResidentParkObservation(park, {
        amenityType: 'drinking_water',
        note: 'Water tap working.',
        photoRef: 'photo-3',
        containsFacesOrPlates: true,
      })
    ).toThrow(/Photo moderation blocked/);

    const valid = submitResidentParkObservation(park, {
      amenityType: 'walking_track',
      note: 'Track surface clean and dry.',
      photoRef: 'photo-clean-4',
      exifStripped: true,
    });
    expect(valid.residentObservations[0].photoModerationStatus).toBe('approved_no_personal_data');
  });

  it('computes stale vs fresh provenance and migrates legacy state', () => {
    const stale = verifyParkSourceProvenance(
      {
        source: 'Old Notice',
        jurisdiction: 'IN-UP',
        effectiveDate: '2026-01-01',
        lastVerifiedAt: '2026-01-01T00:00:00.000Z',
      },
      Date.parse('2026-11-27T00:00:00.000Z')
    );
    expect(stale.freshness).toBe('stale');

    const migrated = migrateParkMaintenanceState({});
    expect(migrated.schemaVersion).toBe('1.0.0');
  });
});
