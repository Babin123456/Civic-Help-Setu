import { describe, it, expect, beforeEach } from 'vitest';
import {
  isTemporaryFacilityExpired,
  isVerifiedMunicipalOrDisasterSource,
  calculateFacilityFreshness,
  RELIEF_FACILITY_TYPES,
  OPERATIONAL_STATUS,
} from '../data/upHeatwaveReliefContract';
import {
  _resetStorageForTesting,
  listHeatReliefFacilities,
  registerVerifiedCoolingFacility,
} from './upHeatwaveReliefService';

describe('Heatwave Cooling-Centre & Water-Point Directory (#1436)', () => {
  beforeEach(() => {
    _resetStorageForTesting();
  });

  it('enforces verified municipal or disaster-management sources only', () => {
    expect(
      isVerifiedMunicipalOrDisasterSource({
        responsibleAuthority: 'Lucknow Municipal Corporation (LMC)',
        sourceUrl: 'https://lmc.up.nic.in/heatwave.pdf',
        verifiedAt: '2026-05-15T08:00:00.000Z',
        sourceCategory: 'municipal_corporation',
      })
    ).toBe(true);

    expect(
      isVerifiedMunicipalOrDisasterSource({
        responsibleAuthority: 'Citizen Group',
        sourceUrl: 'https://example.com',
        verifiedAt: '2026-05-15T08:00:00.000Z',
        sourceCategory: 'unverified_blog',
      })
    ).toBe(false);

    expect(
      isVerifiedMunicipalOrDisasterSource({
        responsibleAuthority: 'Anonymous',
        sourceUrl: 'https://example.com',
        verifiedAt: '2026-05-15T08:00:00.000Z',
        sourceTier: 'citizen_observation',
      })
    ).toBe(false);
  });

  it('automatically expires temporary facilities past expiresAt and excludes them by default', () => {
    const now = new Date('2026-06-15T12:00:00.000Z');
    const expiredTemp = {
      id: 'temp-expired-001',
      name: 'Temporary Mobile Piyau',
      facilityType: RELIEF_FACILITY_TYPES.DRINKING_WATER_POINT,
      district: 'Lucknow',
      wardOrVillage: 'Alambagh',
      address: 'Alambagh Crossing',
      responsibleAuthority: 'Lucknow Municipal Corporation',
      sourceUrl: 'https://lmc.up.nic.in/temp-piyau.pdf',
      verifiedAt: '2026-05-20T09:00:00.000Z',
      operatingHours: '09:00 - 18:00',
      coordinates: { lat: 26.81, lng: 80.9 },
      operationalStatus: OPERATIONAL_STATUS.OPEN,
      isTemporary: true,
      expiresAt: '2026-06-10T23:59:59.000Z',
    };

    expect(isTemporaryFacilityExpired(expiredTemp, now)).toBe(true);
    const freshness = calculateFacilityFreshness(expiredTemp, now);
    expect(freshness.isExpired).toBe(true);
    expect(freshness.statusBadge).toBe('expired_temporary');

    _resetStorageForTesting([expiredTemp]);
    expect(listHeatReliefFacilities({ district: 'Lucknow' }, now)).toHaveLength(0);

    const withExpired = listHeatReliefFacilities({ district: 'Lucknow', includeExpired: true }, now);
    expect(withExpired).toHaveLength(1);
    expect(withExpired[0].isExpired).toBe(true);
    expect(withExpired[0].effectiveOperationalStatus).toBe(OPERATIONAL_STATUS.TEMPORARILY_CLOSED);
  });

  it('rejects PII / Aadhaar / OTP and accepts valid verified temporary facilities', () => {
    const now = new Date('2026-05-15T10:00:00.000Z');

    const badPii = registerVerifiedCoolingFacility(
      {
        id: 'lko-bad-001',
        name: 'Test Centre',
        facilityType: RELIEF_FACILITY_TYPES.COOLING_CENTRE,
        district: 'Lucknow',
        wardOrVillage: 'Gomti Nagar',
        responsibleAuthority: 'DDMA Lucknow',
        sourceUrl: 'https://ddma.up.gov.in/test.pdf',
        verifiedAt: '2026-05-15T08:00:00.000Z',
        operatingHours: '09:00 - 18:00',
        coordinates: { lat: 26.85, lng: 81.0 },
        otp: '123456',
      },
      now
    );
    expect(badPii.success).toBe(false);

    const validRes = registerVerifiedCoolingFacility(
      {
        id: 'lko-temp-valid-001',
        name: 'Gomti Nagar Temporary Cooling Tent',
        facilityType: RELIEF_FACILITY_TYPES.COOLING_CENTRE,
        district: 'Lucknow',
        wardOrVillage: 'Gomti Nagar',
        address: 'Near Patrakarpuram Crossing',
        responsibleAuthority: 'DDMA Lucknow',
        sourceCategory: 'ddma',
        sourceUrl: 'https://ddma.up.gov.in/cooling-tents-2026.pdf',
        verifiedAt: '2026-05-15T08:00:00.000Z',
        effectiveDate: '2026-05-15T08:00:00.000Z',
        jurisdiction: 'Lucknow',
        operatingHours: '10:00 - 19:00',
        coordinates: { lat: 26.85, lng: 81.0 },
        isTemporary: true,
        expiresAt: '2026-06-30T23:59:59.000Z',
      },
      now
    );
    expect(validRes.success).toBe(true);
    expect(validRes.facility.originClassification).toBe('official_record');
  });
});
