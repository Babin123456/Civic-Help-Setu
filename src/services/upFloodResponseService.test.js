import { describe, it, expect, beforeEach } from 'vitest';
import {
  _resetStorageForTesting,
  listIncidents,
  computeIncidentFreshness,
  submitCitizenReport,
  reconfirmIncident,
  checkRouteHazard,
  getWardDrainSummaries,
  generateMunicipalMaintenancePetition,
  enqueueOfflineDraft,
  getOfflineDraftQueue,
  removeOfflineDraft,
  syncOfflineDrafts,
} from './upFloodResponseService';
import {
  INCIDENT_TYPES,
  DEPTH_CATEGORIES,
  SOURCE_TIERS,
  REPORT_STATUS,
} from '../data/upFloodIncidentContract';

describe('upFloodResponseService', () => {
  let mockCurrentTime;

  beforeEach(() => {
    mockCurrentTime = new Date();
    _resetStorageForTesting();
  });

  describe('Freshness Decay & Stale Downgrade (Acceptance Criteria 1 & 2)', () => {
    it('marks recent observations as current and fresh', () => {
      const recentIncident = {
        id: 'test-1',
        incidentType: INCIDENT_TYPES.FLOODED_ROAD,
        observedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 mins ago
        status: REPORT_STATUS.CURRENT,
        reconfirmationsCount: 1,
      };

      const result = computeIncidentFreshness(recentIncident, mockCurrentTime);
      expect(result.isStale).toBe(false);
      expect(result.effectiveStatus).toBe(REPORT_STATUS.CURRENT);
      expect(result.freshnessLabel).toContain('Observed 15m ago (Current)');
    });

    it('automatically downgrades observations older than expiry policy (120m for flood) to stale', () => {
      const oldIncident = {
        id: 'test-2',
        incidentType: INCIDENT_TYPES.FLOODED_ROAD,
        observedAt: new Date(Date.now() - 150 * 60 * 1000).toISOString(), // 150 mins ago (> 120 mins)
        status: REPORT_STATUS.CURRENT,
        reconfirmationsCount: 2,
      };

      const result = computeIncidentFreshness(oldIncident, mockCurrentTime);
      expect(result.isStale).toBe(true);
      expect(result.effectiveStatus).toBe(REPORT_STATUS.STALE);
      expect(result.freshnessLabel).toContain('Stale - Needs Reconfirmation');
    });

    it('excludes stale reports from current hazard filter', () => {
      const res = listIncidents({ statusFilter: 'current_only' }, mockCurrentTime);
      res.incidents.forEach((inc) => {
        expect(inc.isStale).toBe(false);
      });
      // Munshi Pulia is 5h old in seed, should not be in current_only
      expect(res.incidents.some((i) => i.locality.includes('Munshi Pulia'))).toBe(false);
    });
  });

  describe('Citizen Reporting & Anti-Spoofing (Acceptance Criteria 3 & 4)', () => {
    it('redacts private residential details and snaps coordinates', () => {
      const payload = {
        district: 'Lucknow',
        locality: 'Near Flat 301, Tower B, Gomti Nagar extension, call 9876543210 for details',
        incidentType: INCIDENT_TYPES.FLOODED_ROAD,
        depthCategory: DEPTH_CATEGORIES.KNEE_DEEP,
        coordinates: { lat: 26.85123, lng: 80.98456 },
        ward: 'Ward 40',
      };

      const submitted = submitCitizenReport(payload, mockCurrentTime);
      expect(submitted.locality).not.toContain('Flat 301');
      expect(submitted.locality).not.toContain('9876543210');
      expect(submitted.locality).toContain('[REDACTED_LOCATION_DETAIL]');
      expect(submitted.coordinates.lat).toBe(26.85);
      expect(submitted.coordinates.lng).toBe(80.98);
      expect(submitted.coordinates.isJittered).toBe(true);
    });

    it('enforces that citizen reports cannot spoof official source tiers', () => {
      const spoofAttempt = {
        district: 'Lucknow',
        locality: 'Hazratganj crossing',
        incidentType: INCIDENT_TYPES.FLOODED_ROAD,
        sourceTier: 'citizen_attempting_to_claim_official',
      };

      const submitted = submitCitizenReport(spoofAttempt, mockCurrentTime);
      expect(submitted.sourceTier).toBe(SOURCE_TIERS.CITIZEN_REPORT);
    });
  });

  describe('Reconfirmation & Contradictory Reports Resolution', () => {
    it('refreshes stale observation to current when reconfirmed as still flooded', () => {
      // In seed, up-fl-004 is Munshi Pulia (stale)
      const freshResult = reconfirmIncident(
        'up-fl-004',
        { action: 'still_flooded', depthCategory: DEPTH_CATEGORIES.KNEE_DEEP },
        mockCurrentTime
      );

      expect(freshResult.isStale).toBe(false);
      expect(freshResult.effectiveStatus).toBe(REPORT_STATUS.CURRENT);
      expect(freshResult.reconfirmationsCount).toBe(1);
      expect(freshResult.depthCategory).toBe(DEPTH_CATEGORIES.KNEE_DEEP);
    });

    it('marks high-hazard report as DISPUTED when unverified receded report contradicts it', () => {
      // up-fl-001 is Begum Hazrat Mahal Park (waist deep official/severe report)
      const res = reconfirmIncident('up-fl-001', { action: 'water_receded' }, mockCurrentTime);
      expect(res.effectiveStatus).toBe(REPORT_STATUS.DISPUTED);
      expect(res.notes).toContain('Dispute Note');
    });

    it('marks report as CLEARED when ordinary report recedes without dispute', () => {
      // up-fl-003 is Ashok Marg (knee deep)
      const res = reconfirmIncident('up-fl-003', { action: 'water_receded' }, mockCurrentTime);
      expect(res.effectiveStatus).toBe(REPORT_STATUS.CLEARED);
      expect(res.depthCategory).toBe(DEPTH_CATEGORIES.CLEARED_PASSABLE);
    });
  });

  describe('Route Hazard Overlay & Navigation Safety (Acceptance Criterion 5)', () => {
    it('flags hazard when corridor intersects active flooded road and never routes through it', () => {
      const hazardCheck = checkRouteHazard('Parivartan Chowk to KD Singh Babu Stadium Link', 'Lucknow', mockCurrentTime);
      expect(hazardCheck.isSafe).toBe(false);
      expect(hazardCheck.hazardLevel).toBe('DANGEROUS');
      expect(hazardCheck.hazardsFound.length).toBeGreaterThan(0);
      expect(hazardCheck.safetyAdvisory).toContain('NEVER attempt to traverse submerged roadways');
    });

    it('excludes stale reports from blocking a route', () => {
      // Munshi Pulia is stale in seed data and has ankle-deep water
      const hazardCheck = checkRouteHazard('Munshi Pulia Intersection Service Lane', 'Lucknow', mockCurrentTime);
      expect(hazardCheck.isSafe).toBe(true);
      expect(hazardCheck.hazardLevel).toBe('SAFE');
    });

    it('confirms safe corridor when no hazards exist', () => {
      const hazardCheck = checkRouteHazard('Lohia Path Expressway bypass', 'Lucknow', mockCurrentTime);
      expect(hazardCheck.isSafe).toBe(true);
      expect(hazardCheck.hazardLevel).toBe('SAFE');
    });

    it('requires enough recent reports (corroboration) before applying route hazard overlay', () => {
      // Submit a single, uncorroborated citizen report with reconfirmationsCount = 1
      submitCitizenReport({
        district: 'Lucknow',
        locality: 'Single Isolated Gali Crossing',
        corridorName: 'Isolated Gali Bypass',
        incidentType: INCIDENT_TYPES.FLOODED_ROAD,
        depthCategory: DEPTH_CATEGORIES.KNEE_DEEP,
        observedAt: mockCurrentTime.toISOString(),
      }, mockCurrentTime);

      // Single report should trigger CAUTION, but not active blocking overlay
      const initialCheck = checkRouteHazard('Isolated Gali Bypass', 'Lucknow', mockCurrentTime);
      expect(initialCheck.isSafe).toBe(true);
      expect(initialCheck.hazardLevel).toBe('CAUTION');
      expect(initialCheck.overlayActive).toBe(false);

      // Once reconfirmed by community (>= 2 confirmations), hazard overlay activates
      const reportedItem = listIncidents({ searchQuery: 'Isolated Gali' }, mockCurrentTime).incidents[0];
      reconfirmIncident(reportedItem.id, { action: 'still_flooded' }, mockCurrentTime);

      const reconfirmedCheck = checkRouteHazard('Isolated Gali Bypass', 'Lucknow', mockCurrentTime);
      expect(reconfirmedCheck.isSafe).toBe(false);
      expect(reconfirmedCheck.hazardLevel).toBe('DANGEROUS');
      expect(reconfirmedCheck.overlayActive).toBe(true);
    });
  });

  describe('Ward-Wise Drain Blockage Summaries & Petition Export', () => {
    it('aggregates drain blockages by municipal ward with urgency levels', () => {
      const summaries = getWardDrainSummaries('Lucknow', mockCurrentTime);
      expect(summaries.length).toBeGreaterThan(0);
      const alambagh = summaries.find((s) => s.wardName.includes('Alambagh'));
      expect(alambagh).toBeDefined();
      expect(alambagh.totalBlockages).toBeGreaterThan(0);
      expect(alambagh.urgency).toBeDefined();
    });

    it('generates a statutory municipal maintenance petition', () => {
      const petition = generateMunicipalMaintenancePetition({
        district: 'Lucknow',
        ward: 'Ward 24 (Alambagh)',
        applicantName: 'Esha Jha',
      });

      expect(petition).toContain('STATUTORY CIVIC MAINTENANCE & URGENT DRAIN DESILTATION PETITION');
      expect(petition).toContain('Municipal Corporation / Nagar Nigam (Lucknow)');
      expect(petition).toContain('Ward 24 (Alambagh)');
      expect(petition).toContain('Esha Jha');
    });
  });

  describe('Offline Draft Queue (Acceptance Criterion 6)', () => {
    it('enqueues drafts when offline and retrieves them', () => {
      const draftPayload = {
        district: 'Lucknow',
        locality: 'Polytechnic crossing service road',
        incidentType: INCIDENT_TYPES.FLOODED_ROAD,
        depthCategory: DEPTH_CATEGORIES.ANKLE_DEEP,
      };

      const enqueued = enqueueOfflineDraft(draftPayload);
      expect(enqueued.id).toBeDefined();

      const queue = getOfflineDraftQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].payload.locality).toBe('Polytechnic crossing service road');
    });

    it('removes draft from queue', () => {
      const draft = enqueueOfflineDraft({ locality: 'Test Locality', district: 'Lucknow' });
      removeOfflineDraft(draft.id);
      expect(getOfflineDraftQueue().length).toBe(0);
    });

    it('synchronizes queued drafts when back online', () => {
      enqueueOfflineDraft({
        district: 'Lucknow',
        locality: 'Kapoorthala Chauraha',
        incidentType: INCIDENT_TYPES.FLOODED_ROAD,
        depthCategory: DEPTH_CATEGORIES.KNEE_DEEP,
        observedAt: mockCurrentTime.toISOString(),
      });

      const syncResult = syncOfflineDrafts(mockCurrentTime);
      expect(syncResult.syncedCount).toBe(1);
      expect(syncResult.failedCount).toBe(0);
      expect(getOfflineDraftQueue().length).toBe(0);

      // Verify incident is now on the live board
      const { incidents } = listIncidents({ searchQuery: 'Kapoorthala' }, mockCurrentTime);
      expect(incidents.length).toBe(1);
      expect(incidents[0].locality).toBe('Kapoorthala Chauraha');
    });
  });
});
