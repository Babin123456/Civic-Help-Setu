import { describe, it, expect, beforeEach } from 'vitest';
import {
  _resetStorageForTesting,
  listHeatReliefFacilities,
  resolveFacilityDynamicStatus,
  submitCommunityObservation,
  updatePartnerFacilityStatus,
  getDistrictHeatAlert,
  calculateDistanceKm,
  enqueueOfflineDraft,
  getOfflineDraftQueue,
  removeOfflineDraft,
  syncOfflineDrafts,
} from './upHeatwaveReliefService';
import {
  RELIEF_FACILITY_TYPES,
  OPERATIONAL_STATUS,
  CAPACITY_STATUS,
  HEAT_ALERT_LEVELS,
} from '../data/upHeatwaveReliefContract';

describe('upHeatwaveReliefService', () => {
  const summerReferenceTime = new Date('2026-05-15T12:00:00.000Z');

  beforeEach(() => {
    _resetStorageForTesting();
  });

  describe('District & Ward Filtering (Acceptance Criteria #6)', () => {
    it('defaults to pilot district Lucknow and returns verified facilities', () => {
      const results = listHeatReliefFacilities({ district: 'Lucknow' }, summerReferenceTime);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((f) => f.district === 'Lucknow')).toBe(true);
    });

    it('filters facilities by selected district (e.g. Varanasi)', () => {
      const vnsResults = listHeatReliefFacilities({ district: 'Varanasi' }, summerReferenceTime);
      expect(vnsResults.length).toBe(1);
      expect(vnsResults[0].id).toBe('vns-relief-001');
      expect(vnsResults[0].district).toBe('Varanasi');
    });

    it('filters facilities by ward or village', () => {
      const charbaghResults = listHeatReliefFacilities(
        { district: 'Lucknow', wardOrVillage: 'Charbagh' },
        summerReferenceTime
      );
      expect(charbaghResults.length).toBe(1);
      expect(charbaghResults[0].wardOrVillage).toContain('Charbagh');
    });

    it('filters facilities by specific relief facility type (e.g. drinking_water_point)', () => {
      const waterPoints = listHeatReliefFacilities(
        { district: 'Lucknow', facilityType: RELIEF_FACILITY_TYPES.DRINKING_WATER_POINT },
        summerReferenceTime
      );
      expect(waterPoints.length).toBeGreaterThan(0);
      expect(waterPoints.every((f) => f.facilityType === RELIEF_FACILITY_TYPES.DRINKING_WATER_POINT)).toBe(true);
    });

    it('filters facilities by wheelchair accessibility and ORS availability', () => {
      const accessibleOrs = listHeatReliefFacilities(
        { district: 'Lucknow', onlyWheelchair: true, onlyOrsAvailable: true },
        summerReferenceTime
      );
      expect(accessibleOrs.length).toBeGreaterThan(0);
      expect(accessibleOrs.every((f) => f.accessibility.wheelchairAccessible && f.accessibility.orsAvailable)).toBe(true);
    });
  });

  describe('Stale Listings & Seasonal Expiry (Acceptance Criteria #3)', () => {
    it('automatically marks facility with verification older than threshold as stale for re-verification', () => {
      const results = listHeatReliefFacilities({ district: 'Lucknow' }, summerReferenceTime);
      const staleFacility = results.find((f) => f.id === 'lko-relief-007'); // Seeded with verifiedAt in March (> 50 days)

      expect(staleFacility).toBeDefined();
      expect(staleFacility.isStale).toBe(true);
      expect(staleFacility.freshness.statusBadge).toBe('stale_verification');
      expect(staleFacility.freshness.verificationNote).toContain('Marked for Re-verification');
    });

    it('marks facilities as seasonal_inactive outside heatwave season', () => {
      const winterTime = new Date('2026-12-15T12:00:00.000Z');
      const results = listHeatReliefFacilities({ district: 'Lucknow' }, winterTime);

      expect(results.every((f) => f.isSeasonActive === false)).toBe(true);
      expect(results.every((f) => f.freshness.statusBadge === 'seasonal_inactive')).toBe(true);
    });
  });

  describe('Temporary Availability vs Permanent Details & Partner Updates (Acceptance Criteria #2)', () => {
    it('preserves permanent facility details when authorized partner updates temporary status', () => {
      const updateRes = updatePartnerFacilityStatus(
        {
          facilityId: 'lko-relief-001',
          operationalStatus: OPERATIONAL_STATUS.TEMPORARILY_CLOSED,
          currentCapacityStatus: CAPACITY_STATUS.FULL,
          temporaryClosureReason: 'AC generator maintenance underway for 2 hours',
          partnerName: 'Lucknow Red Cross Society',
          partnerRole: 'Authorized Relief Partner',
        },
        summerReferenceTime
      );

      expect(updateRes.success).toBe(true);
      expect(updateRes.updatedFacility.operationalStatus).toBe(OPERATIONAL_STATUS.TEMPORARILY_CLOSED);
      expect(updateRes.updatedFacility.temporaryClosureReason).toContain('AC generator maintenance');
      // Permanent fields remain intact
      expect(updateRes.updatedFacility.responsibleAuthority).toBe('Lucknow Municipal Corporation (LMC)');
      expect(updateRes.updatedFacility.nominalCapacity).toBe(150);
    });
  });

  describe('Conflicting Reports Resolution (Acceptance Criteria #6)', () => {
    it('flags facility as disputed when multiple citizen reports contradict official open status', () => {
      // Submit 2 contradictory citizen reports claiming closed
      submitCommunityObservation(
        {
          facilityId: 'lko-relief-002',
          observedStatus: OPERATIONAL_STATUS.TEMPORARILY_CLOSED,
          feedbackNote: 'Water pipeline maintenance, tap dry',
          timestamp: '2026-05-15T11:30:00.000Z',
        },
        summerReferenceTime
      );

      submitCommunityObservation(
        {
          facilityId: 'lko-relief-002',
          observedStatus: OPERATIONAL_STATUS.TEMPORARILY_CLOSED,
          feedbackNote: 'No water flowing right now',
          timestamp: '2026-05-15T11:45:00.000Z',
        },
        summerReferenceTime
      );

      const results = listHeatReliefFacilities({ district: 'Lucknow' }, summerReferenceTime);
      const target = results.find((f) => f.id === 'lko-relief-002');

      expect(target).toBeDefined();
      expect(target.isDisputed).toBe(true);
      expect(target.disputeDetails.contradictoryCount).toBe(2);
      expect(target.disputeDetails.reportedStatus).toBe(OPERATIONAL_STATUS.TEMPORARILY_CLOSED);
    });
  });

  describe('Privacy & Precise User Location Consent (Acceptance Criteria #5)', () => {
    const mockUserCoords = { lat: 26.85, lng: 80.94 };

    it('does NOT calculate or attach distance if location consent is false', () => {
      const results = listHeatReliefFacilities(
        {
          district: 'Lucknow',
          userCoordinates: mockUserCoords,
          locationConsentGranted: false, // Consent NOT granted
        },
        summerReferenceTime
      );

      expect(results.every((f) => f.distanceKm === null)).toBe(true);
    });

    it('calculates distance accurately when explicit location consent is granted', () => {
      const results = listHeatReliefFacilities(
        {
          district: 'Lucknow',
          userCoordinates: mockUserCoords,
          locationConsentGranted: true, // Consent granted
        },
        summerReferenceTime
      );

      const nearest = results[0];
      expect(nearest.distanceKm).not.toBeNull();
      expect(typeof nearest.distanceKm).toBe('number');
      expect(nearest.distanceKm).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Offline Mode & Draft Sync Queue (Acceptance Criteria #4 & #6)', () => {
    it('enqueues citizen reports when offline and allows retrieval and removal', () => {
      const draft = enqueueOfflineDraft({
        facilityId: 'lko-relief-001',
        observedStatus: OPERATIONAL_STATUS.OPEN,
        currentCapacityStatus: CAPACITY_STATUS.AVAILABLE,
        feedbackNote: 'Queued while network offline in basement hall',
        timestamp: '2026-05-15T11:00:00.000Z',
      });

      expect(draft.draftId).toBeDefined();
      const queue = getOfflineDraftQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].draftId).toBe(draft.draftId);

      removeOfflineDraft(draft.draftId);
      expect(getOfflineDraftQueue().length).toBe(0);
    });

    it('syncs all queued drafts upon reconnection', () => {
      enqueueOfflineDraft({
        facilityId: 'lko-relief-001',
        observedStatus: OPERATIONAL_STATUS.OPEN,
        feedbackNote: 'Offline draft 1',
        timestamp: '2026-05-15T11:10:00.000Z',
      });
      enqueueOfflineDraft({
        facilityId: 'lko-relief-003',
        observedStatus: OPERATIONAL_STATUS.OPEN,
        feedbackNote: 'Offline draft 2',
        timestamp: '2026-05-15T11:15:00.000Z',
      });

      expect(getOfflineDraftQueue().length).toBe(2);

      const syncResult = syncOfflineDrafts(summerReferenceTime);
      expect(syncResult.synced).toBe(2);
      expect(syncResult.failed).toBe(0);
      expect(getOfflineDraftQueue().length).toBe(0);
    });
  });

  describe('District Heatwave Alert Context & Emergency Disclaimer', () => {
    it('provides official IMD / UPSDMA alert for Lucknow with emergency contacts', () => {
      const alert = getDistrictHeatAlert('Lucknow');
      expect(alert.district).toBe('Lucknow');
      expect(alert.alertLevel).toBe(HEAT_ALERT_LEVELS.HEAT_ALERT); // Orange
      expect(alert.emergencyContacts.ddmaEmergencyRoom).toContain('1077');
      expect(alert.emergencyContacts.medicalAmbulance).toContain('108');
      expect(alert.medicalDisclaimer).toContain('Not a medical diagnostic tool');
    });

    it('provides Red alert emergency context for Kanpur Nagar', () => {
      const alert = getDistrictHeatAlert('Kanpur Nagar');
      expect(alert.district).toBe('Kanpur Nagar');
      expect(alert.alertLevel).toBe(HEAT_ALERT_LEVELS.SEVERE_EMERGENCY);
    });
  });

  describe('calculateDistanceKm utility', () => {
    it('computes distance between known points (Lucknow GPO to Charbagh ~ 2-3 km)', () => {
      const dist = calculateDistanceKm(26.8467, 80.9461, 26.8322, 80.9221);
      expect(dist).toBeGreaterThan(1.5);
      expect(dist).toBeLessThan(4.0);
    });
  });
});
