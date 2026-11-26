import { describe, it, expect } from 'vitest';
import {
  INCIDENT_TYPES,
  DEPTH_CATEGORIES,
  SOURCE_TIERS,
  validateIncidentReport,
  sanitizeAndRedactLocation,
  isCoordinateWithinUP,
  snapCoordinates,
} from './upFloodIncidentContract';

describe('upFloodIncidentContract', () => {
  const validBasePayload = {
    district: 'Lucknow',
    locality: 'Hazratganj Main Crossing',
    incidentType: INCIDENT_TYPES.FLOODED_ROAD,
    depthCategory: DEPTH_CATEGORIES.KNEE_DEEP,
    sourceTier: SOURCE_TIERS.CITIZEN_REPORT,
    observedAt: '2026-11-19T22:30:00.000Z',
    coordinates: { lat: 26.85, lng: 80.94 },
    ward: 'Ward 12',
  };

  const currentReferenceTime = new Date('2026-11-19T23:00:00.000Z');

  describe('validateIncidentReport', () => {
    it('accepts a valid citizen flood report', () => {
      const res = validateIncidentReport(validBasePayload, currentReferenceTime);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('rejects an invalid district outside UP pilot list', () => {
      const res = validateIncidentReport(
        { ...validBasePayload, district: 'Mumbai' },
        currentReferenceTime
      );
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('District must be a valid UP pilot district');
    });

    it('rejects an invalid or too short locality', () => {
      const res = validateIncidentReport(
        { ...validBasePayload, locality: 'ab' },
        currentReferenceTime
      );
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('Locality / landmark must be at least 3 characters long');
    });

    it('rejects observedAt timestamps in the future (anti-spoofing)', () => {
      const futureTime = new Date('2026-11-20T05:00:00.000Z').toISOString();
      const res = validateIncidentReport(
        { ...validBasePayload, observedAt: futureTime },
        currentReferenceTime
      );
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('cannot be in the future'))).toBe(true);
    });

    it('rejects observedAt timestamps older than 72 hours', () => {
      const ancientTime = new Date('2026-11-10T00:00:00.000Z').toISOString();
      const res = validateIncidentReport(
        { ...validBasePayload, observedAt: ancientTime },
        currentReferenceTime
      );
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('older than 72 hours'))).toBe(true);
    });

    it('requires authenticated issuing authority and bulletin ref for official alerts', () => {
      const spoofedOfficial = {
        ...validBasePayload,
        sourceTier: SOURCE_TIERS.OFFICIAL_EMERGENCY_ALERT,
      };
      const res = validateIncidentReport(spoofedOfficial, currentReferenceTime);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('must provide an authenticated issuing authority'))).toBe(true);
      expect(res.errors.some((e) => e.includes('require an official reference or bulletin ID'))).toBe(true);
    });

    it('accepts legitimate official alert with authority and bulletin ref', () => {
      const legitimateOfficial = {
        ...validBasePayload,
        sourceTier: SOURCE_TIERS.OFFICIAL_EMERGENCY_ALERT,
        issuingAuthority: 'UP State Disaster Management Authority (UPSDMA)',
        officialBulletinRef: 'UPSDMA/MONSOON-BULLETIN/2026/089',
      };
      const res = validateIncidentReport(legitimateOfficial, currentReferenceTime);
      expect(res.isValid).toBe(true);
    });

    it('rejects coordinates outside Uttar Pradesh geo boundaries', () => {
      // Coords in New Delhi (Lat: 28.61, Lng: 77.20 is on border, but Bangalore 12.97, 77.59 is far outside)
      const res = validateIncidentReport(
        { ...validBasePayload, coordinates: { lat: 12.97, lng: 77.59 } },
        currentReferenceTime
      );
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('outside the administrative boundaries of Uttar Pradesh'))).toBe(true);
    });
  });

  describe('sanitizeAndRedactLocation & snapCoordinates', () => {
    it('redacts exact house/flat numbers from citizen location descriptions', () => {
      const raw = 'Severe waterlogging right in front of Flat 402, Royal Palms, Hazratganj';
      const result = sanitizeAndRedactLocation(raw);
      expect(result.wasRedacted).toBe(true);
      expect(result.sanitizedLocation).not.toContain('Flat 402');
      expect(result.sanitizedLocation).toContain('[REDACTED_LOCATION_DETAIL]');
    });

    it('redacts phone numbers from location descriptions', () => {
      const raw = 'Blocked drain near tea stall, call 9876543210 for info';
      const result = sanitizeAndRedactLocation(raw);
      expect(result.wasRedacted).toBe(true);
      expect(result.sanitizedLocation).not.toContain('9876543210');
      expect(result.sanitizedLocation).toContain('[REDACTED_LOCATION_DETAIL]');
    });

    it('snaps coordinates to 2 decimal places to prevent private residence identification', () => {
      const preciseCoords = { lat: 26.846719, lng: 80.946123 };
      const snapped = snapCoordinates(preciseCoords);
      expect(snapped.lat).toBe(26.85);
      expect(snapped.lng).toBe(80.95);
      expect(snapped.isJittered).toBe(true);
    });
  });

  describe('isCoordinateWithinUP', () => {
    it('returns true for authentic UP locations', () => {
      // Lucknow
      expect(isCoordinateWithinUP(26.85, 80.94)).toBe(true);
      // Varanasi
      expect(isCoordinateWithinUP(25.31, 82.97)).toBe(true);
      // Agra
      expect(isCoordinateWithinUP(27.18, 78.01)).toBe(true);
    });

    it('returns false for coordinates outside UP', () => {
      // London
      expect(isCoordinateWithinUP(51.5, -0.12)).toBe(false);
      // Chennai
      expect(isCoordinateWithinUP(13.08, 80.27)).toBe(false);
    });
  });
});
