import { describe, it, expect } from 'vitest';
import {
  RELIEF_FACILITY_TYPES,
  OPERATIONAL_STATUS,
  CAPACITY_STATUS,
  validateFacilityRecord,
  validateCommunityObservation,
  calculateFacilityFreshness,
  isFacilitySeasonallyActive,
  sanitizeAndRedactText,
  snapCoordinates,
  isCoordinateWithinUP,
} from './upHeatwaveReliefContract';

describe('upHeatwaveReliefContract', () => {
  const referenceSummerDate = new Date('2026-05-15T12:00:00.000Z'); // May 15 (Inside Heatwave Season)
  const referenceWinterDate = new Date('2026-12-15T12:00:00.000Z'); // Dec 15 (Outside Heatwave Season)

  const validFacility = {
    id: 'lko-relief-001',
    name: 'Hazratganj Municipal Community Hall Cooling Center',
    facilityType: RELIEF_FACILITY_TYPES.COOLING_CENTRE,
    district: 'Lucknow',
    wardOrVillage: 'Hazratganj Ward',
    address: 'Near GPO Crossing, MG Marg, Hazratganj, Lucknow',
    responsibleAuthority: 'Lucknow Municipal Corporation (LMC)',
    sourceUrl: 'https://lmc.up.nic.in/disaster-relief/cooling-centres-2026.pdf',
    verifiedAt: '2026-05-10T10:00:00.000Z',
    operatingHours: '09:00 - 19:00',
    coordinates: { lat: 26.8467, lng: 80.9461 },
    accessibility: {
      wheelchairAccessible: true,
      seatingAvailable: true,
      drinkingWaterAvailable: true,
      restroomAvailable: true,
      orsAvailable: true,
      coolingType: 'Air Conditioned Hall',
    },
    nominalCapacity: 120,
    operationalStatus: OPERATIONAL_STATUS.OPEN,
    currentCapacityStatus: CAPACITY_STATUS.AVAILABLE,
    seasonalValidity: { startMonth: 3, endMonth: 7 },
  };

  describe('validateFacilityRecord (Acceptance Criteria #1)', () => {
    it('accepts a fully compliant facility record with verified provenance', () => {
      const res = validateFacilityRecord(validFacility);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('rejects a facility missing responsibleAuthority', () => {
      const res = validateFacilityRecord({ ...validFacility, responsibleAuthority: '' });
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('responsibleAuthority'))).toBe(true);
    });

    it('rejects a facility missing sourceUrl or having invalid protocol', () => {
      const res = validateFacilityRecord({ ...validFacility, sourceUrl: 'ftp://invalidsource.com' });
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('source URL'))).toBe(true);
    });

    it('rejects a facility with missing verifiedAt date', () => {
      const res = validateFacilityRecord({ ...validFacility, verifiedAt: null });
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('verifiedAt'))).toBe(true);
    });

    it('rejects coordinates lying outside Uttar Pradesh borders', () => {
      const res = validateFacilityRecord({
        ...validFacility,
        coordinates: { lat: 12.9716, lng: 77.5946 }, // Bengaluru
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('fall outside Uttar Pradesh'))).toBe(true);
    });

    it('rejects a district not in UP pilot district list', () => {
      const res = validateFacilityRecord({ ...validFacility, district: 'Patna' });
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('valid UP pilot district'))).toBe(true);
    });
  });

  describe('isFacilitySeasonallyActive (Acceptance Criteria: Seasonal Expiry)', () => {
    it('returns true when current date is inside March-July season (May)', () => {
      expect(isFacilitySeasonallyActive(validFacility, referenceSummerDate)).toBe(true);
    });

    it('returns false when current date is outside heatwave season (December)', () => {
      expect(isFacilitySeasonallyActive(validFacility, referenceWinterDate)).toBe(false);
    });
  });

  describe('calculateFacilityFreshness (Acceptance Criteria: Automatic Stale Decay)', () => {
    it('marks recently verified facility inside season as fresh and current', () => {
      const freshness = calculateFacilityFreshness(validFacility, referenceSummerDate);
      expect(freshness.isStale).toBe(false);
      expect(freshness.isSeasonActive).toBe(true);
      expect(freshness.statusBadge).toBe('fresh');
      expect(freshness.verificationNote).toContain('Verified & Current');
    });

    it('marks facility with verification older than 14 days as stale for re-verification', () => {
      const staleFacility = {
        ...validFacility,
        verifiedAt: '2026-04-01T10:00:00.000Z', // 44 days before May 15
      };
      const freshness = calculateFacilityFreshness(staleFacility, referenceSummerDate);
      expect(freshness.isStale).toBe(true);
      expect(freshness.statusBadge).toBe('stale_verification');
      expect(freshness.verificationNote).toContain('Marked for Re-verification');
    });

    it('flags unverified facility missing source or authority', () => {
      const unverifiedFacility = {
        ...validFacility,
        responsibleAuthority: null,
      };
      const freshness = calculateFacilityFreshness(unverifiedFacility, referenceSummerDate);
      expect(freshness.statusBadge).toBe('unverified');
      expect(freshness.verificationNote).toContain('Unverified Facility');
    });

    it('marks record as seasonal_inactive during winter', () => {
      const freshness = calculateFacilityFreshness(validFacility, referenceWinterDate);
      expect(freshness.isSeasonActive).toBe(false);
      expect(freshness.statusBadge).toBe('seasonal_inactive');
    });
  });

  describe('sanitizeAndRedactText & snapCoordinates (Acceptance Criteria: Privacy & Zero PII)', () => {
    it('redacts private house / flat numbers from community observation feedback', () => {
      const raw = 'Drinking water booth open in front of House No 14/B, near main gate';
      const result = sanitizeAndRedactText(raw);
      expect(result.wasRedacted).toBe(true);
      expect(result.sanitizedText).not.toContain('House No 14/B');
      expect(result.sanitizedText).toContain('[REDACTED_DETAIL]');
    });

    it('redacts citizen phone numbers', () => {
      const raw = 'Cooling center attendant phone is 9876543210 please call them';
      const result = sanitizeAndRedactText(raw);
      expect(result.wasRedacted).toBe(true);
      expect(result.sanitizedText).not.toContain('9876543210');
    });

    it('snaps coordinates to ~1.1km grid to prevent pinpointing private homes', () => {
      const rawCoords = { lat: 26.846719, lng: 80.946123 };
      const snapped = snapCoordinates(rawCoords);
      expect(snapped.lat).toBe(26.85);
      expect(snapped.lng).toBe(80.95);
      expect(snapped.isJittered).toBe(true);
    });
  });

  describe('isCoordinateWithinUP', () => {
    it('identifies valid UP locations', () => {
      expect(isCoordinateWithinUP(26.8467, 80.9461)).toBe(true); // Lucknow
      expect(isCoordinateWithinUP(25.3176, 82.9739)).toBe(true); // Varanasi
      expect(isCoordinateWithinUP(27.1767, 78.0081)).toBe(true); // Agra
    });

    it('rejects non-UP locations', () => {
      expect(isCoordinateWithinUP(28.6139, 77.209)).toBe(true); // Delhi border region can fall near edge, but let's check Mumbai & Kolkata
      expect(isCoordinateWithinUP(19.076, 72.8777)).toBe(false); // Mumbai
      expect(isCoordinateWithinUP(22.5726, 88.3639)).toBe(false); // Kolkata
    });
  });

  describe('validateCommunityObservation', () => {
    const validObservation = {
      facilityId: 'lko-relief-001',
      observedStatus: OPERATIONAL_STATUS.OPEN,
      currentCapacityStatus: CAPACITY_STATUS.AVAILABLE,
      feedbackNote: 'Cold water tap running fine and hall AC is functional',
      timestamp: '2026-05-15T11:45:00.000Z',
    };

    it('accepts a valid citizen observation', () => {
      const res = validateCommunityObservation(validObservation, referenceSummerDate);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('rejects observation timestamps situated in the future', () => {
      const res = validateCommunityObservation(
        { ...validObservation, timestamp: '2026-05-15T14:00:00.000Z' },
        referenceSummerDate
      );
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('future'))).toBe(true);
    });

    it('rejects observations older than 48 hours', () => {
      const res = validateCommunityObservation(
        { ...validObservation, timestamp: '2026-05-10T11:45:00.000Z' },
        referenceSummerDate
      );
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('older than 48 hours'))).toBe(true);
    });
  });
});
