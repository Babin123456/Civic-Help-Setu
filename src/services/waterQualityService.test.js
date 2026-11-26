/**
 * src/services/waterQualityService.test.js
 * Comprehensive integration tests for Water Quality Service layer (#754).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  listWaterPoints,
  getWaterPointDetails,
  createWaterPoint,
  recordSamplingEvent,
  recordLabResults,
  publishOfficialCorrection,
  recordCorrectiveAction,
  updateCorrectiveActionStatus,
  calculateSampleAge,
  generateWaterQualitySeal,
  getAuditTrail,
} from './waterQualityService.js';
import { resetWaterQualityStore } from './waterQualityStorage.js';
import { ROLES, RESULT_STATUSES } from '../data/waterQualityContract.js';

describe('Water Quality Service Layer (#754)', () => {
  beforeEach(() => {
    resetWaterQualityStore();
  });

  describe('Sample Age Calculation', () => {
    it('returns "Not yet sampled" for null or missing date', () => {
      const age = calculateSampleAge(null);
      expect(age.text).toBe('Not yet sampled');
      expect(age.isStale).toBe(true);
    });

    it('returns "Sampled today" for today timestamp', () => {
      const age = calculateSampleAge(new Date().toISOString());
      expect(age.text).toBe('Sampled today');
      expect(age.isStale).toBe(false);
    });

    it('flags samples older than 60 days as stale surveillance', () => {
      const oldDate = new Date(Date.now() - 100 * 86400000).toISOString();
      const age = calculateSampleAge(oldDate);
      expect(age.isStale).toBe(true);
      expect(age.text).toContain('days ago (Surveillance overdue)');
    });
  });

  describe('Cryptographic Seal Generation', () => {
    it('generates deterministic seal starting with SEAL-WQR', () => {
      const seal1 = generateWaterQualitySeal('SMP-01', 'LAB-01', '2026-11-16T10:00:00Z');
      const seal2 = generateWaterQualitySeal('SMP-01', 'LAB-01', '2026-11-16T10:00:00Z');
      expect(seal1).toMatch(/^SEAL-WQR-[0-9A-F]{4}-[0-9A-F]{4}$/);
      expect(seal1).toBe(seal2);
    });
  });

  describe('Water Point Querying & Retrieval', () => {
    it('lists initial seeded water points with computed sample age', () => {
      const points = listWaterPoints();
      expect(points.length).toBeGreaterThan(0);
      expect(points[0].sampleAge).toBeDefined();
    });

    it('filters water points by city and ward', () => {
      const blrPoints = listWaterPoints({ city: 'Bengaluru' });
      expect(blrPoints.every((p) => p.city === 'Bengaluru')).toBe(true);
    });

    it('filters water points by search query', () => {
      const results = listWaterPoints({ search: 'Bellandur' });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].ward).toContain('Bellandur');
    });

    it('returns complete chronology and parameters in getWaterPointDetails', () => {
      const details = getWaterPointDetails('WP-BLR-W150-01');
      expect(details).toBeDefined();
      expect(details.id).toBe('WP-BLR-W150-01');
      expect(Array.isArray(details.samplingHistory)).toBe(true);
      expect(details.samplingHistory.length).toBeGreaterThan(0);
      expect(details.samplingHistory[0].results.length).toBeGreaterThan(0);
    });
  });

  describe('Water Point Registration & Access Control', () => {
    it('blocks unauthenticated public users from creating water points', () => {
      expect(() => {
        createWaterPoint({ name: 'New Tap', pointType: 'public_standpost', ward: 'Ward 1', city: 'Bengaluru' }, { role: ROLES.PUBLIC });
      }).toThrow('Permission denied');
    });

    it('allows authorized admin or sampler to create water point and appends audit log', () => {
      const newPoint = createWaterPoint(
        {
          name: 'Shivajinagar Bus Station Public Tap',
          pointType: 'public_standpost',
          ward: 'Ward 92 - Shivajinagar',
          city: 'Bengaluru',
          landmark: 'Platform 3 drinking water bay',
          sourceType: 'Municipal Treated Piped',
        },
        { role: ROLES.ADMIN, id: 'ADMIN-TEST' }
      );

      expect(newPoint.id).toBeDefined();
      expect(newPoint.name).toBe('Shivajinagar Bus Station Public Tap');

      const audit = getAuditTrail(newPoint.id);
      expect(audit.length).toBeGreaterThan(0);
      expect(audit[0].action).toBe('create');
    });

    it('redacts internal createdBy identifiers for public role query projection', () => {
      const publicPoints = listWaterPoints({}, { role: ROLES.PUBLIC });
      expect(publicPoints.length).toBeGreaterThan(0);
      expect(publicPoints[0].createdBy).toBeUndefined();

      const adminPoints = listWaterPoints({}, { role: ROLES.ADMIN });
      expect(adminPoints.length).toBeGreaterThan(0);
    });
  });

  describe('Sampling Event Recording & Duplicate Prevention', () => {
    it('blocks citizen or public role from recording physical sampling event', () => {
      expect(() => {
        recordSamplingEvent(
          {
            waterPointId: 'WP-BLR-W150-01',
            sampleType: 'routine_surveillance',
            collectionDate: new Date().toISOString(),
            sealedContainerCode: 'SEAL-UNAUTH',
          },
          { role: ROLES.CITIZEN }
        );
      }).toThrow('Permission denied');
    });

    it('records sampling event with valid sealedContainerCode', () => {
      const event = recordSamplingEvent(
        {
          waterPointId: 'WP-BLR-W150-01',
          sampleType: 'routine_surveillance',
          collectionDate: new Date().toISOString(),
          sealedContainerCode: 'SEAL-KA-TEST-001',
          preservationMethod: 'Standard ice pack at 4°C',
        },
        { role: ROLES.SAMPLER, id: 'SAMPLER-TEST' }
      );

      expect(event.id).toBeDefined();
      expect(event.sealedContainerCode).toBe('SEAL-KA-TEST-001');
    });

    it('rejects duplicate sealedContainerCode to maintain chain of custody integrity', () => {
      recordSamplingEvent(
        {
          waterPointId: 'WP-BLR-W150-01',
          sampleType: 'routine_surveillance',
          collectionDate: new Date().toISOString(),
          sealedContainerCode: 'SEAL-KA-DUPLICATE-01',
        },
        { role: ROLES.SAMPLER, id: 'SAMPLER-TEST' }
      );

      expect(() => {
        recordSamplingEvent(
          {
            waterPointId: 'WP-BLR-W150-02',
            sampleType: 'routine_surveillance',
            collectionDate: new Date().toISOString(),
            sealedContainerCode: 'SEAL-KA-DUPLICATE-01',
          },
          { role: ROLES.SAMPLER, id: 'SAMPLER-TEST' }
        );
      }).toThrow('Duplicate container code');
    });
  });

  describe('Lab Results Recording & Cryptographic Sealing', () => {
    it('blocks field samplers from recording laboratory test measurements', () => {
      expect(() => {
        recordLabResults(
          'SMP-2026-BLR-001',
          { labId: 'LAB-01', results: [{ parameterCode: 'ph', testedValue: 7.0 }] },
          { role: ROLES.SAMPLER }
        );
      }).toThrow('Permission denied');
    });

    it('evaluates lab results, generates cryptographic seal, and updates water point status', () => {
      // First create a pending sampling event
      const event = recordSamplingEvent(
        {
          waterPointId: 'WP-BLR-W150-01',
          sampleType: 'routine_surveillance',
          collectionDate: new Date().toISOString(),
          sealedContainerCode: 'SEAL-KA-TEST-RESULTS',
        },
        { role: ROLES.SAMPLER, id: 'SAMPLER-TEST' }
      );

      const response = recordLabResults(
        event.id,
        {
          labId: 'LAB-NABL-KA-042',
          analystNotes: 'Calibrated tests complete',
          results: [
            { parameterCode: 'ph', testedValue: 7.2 },
            { parameterCode: 'tds', testedValue: 310 },
            { parameterCode: 'turbidity', testedValue: 0.8 },
            { parameterCode: 'e_coli', testedValue: 0 },
          ],
        },
        { role: ROLES.LAB_ANALYST, id: 'ANALYST-TEST' }
      );

      expect(response.cryptographicSeal).toBeDefined();
      expect(response.evaluation.isFullyCompliant).toBe(true);

      const updatedPoint = getWaterPointDetails('WP-BLR-W150-01');
      expect(updatedPoint.overallComplianceStatus).toBe('compliant');
    });
  });

  describe('Official Result Correction & Supersession (#754)', () => {
    it('blocks field samplers and lab analysts from publishing corrections', () => {
      expect(() => {
        publishOfficialCorrection(
          'SMP-2026-BLR-003',
          { correctionReason: 'Substantive justification for change', correctedResults: [{ parameterCode: 'ph', testedValue: 7.2 }] },
          { role: ROLES.LAB_ANALYST }
        );
      }).toThrow('Permission denied');
    });

    it('supersedes previous lab results and updates audit trail', () => {
      const eventId = 'SMP-2026-BLR-003'; // Seed event with out-of-range results

      const correction = publishOfficialCorrection(
        eventId,
        {
          correctionReason: 'Recalibrated spectrophotometer showed earlier iron reading was an instrument artifact.',
          labId: 'LAB-NABL-KA-042',
          correctedResults: [
            { parameterCode: 'ph', testedValue: 7.5 },
            { parameterCode: 'tds', testedValue: 410 },
            { parameterCode: 'total_hardness', testedValue: 190 },
            { parameterCode: 'iron', testedValue: 0.3 }, // Corrected to safe limit (< 1.0 mg/L)
            { parameterCode: 'e_coli', testedValue: 0 },
          ],
        },
        { role: ROLES.OFFICIAL_REVIEWER, id: 'REVIEWER-CHIEF' }
      );

      expect(correction.newSeal).toBeDefined();
      expect(correction.supersededCount).toBeGreaterThan(0);
      expect(correction.evaluation.isFullyCompliant).toBe(true);

      const details = getWaterPointDetails('WP-BLR-W174-03');
      const updatedEvent = details.samplingHistory.find((e) => e.id === eventId);
      expect(updatedEvent.status).toBe(RESULT_STATUSES.verified_compliant.id);

      // Check superseded results
      const superseded = updatedEvent.results.filter((r) => r.status === RESULT_STATUSES.superseded.id);
      expect(superseded.length).toBeGreaterThan(0);
    });
  });

  describe('Corrective Remedial Action Workflow', () => {
    it('sanctions and updates corrective action', () => {
      const action = recordCorrectiveAction(
        {
          waterPointId: 'WP-BLR-W150-01',
          actionType: 'chlorination_shock',
          description: 'Emergency super-chlorination of distribution pipe following sewer leak.',
        },
        { role: ROLES.OFFICIAL_REVIEWER, id: 'HEALTH-OFFICER-01' }
      );

      expect(action.id).toBeDefined();
      expect(action.status).toBe('initiated');

      const updated = updateCorrectiveActionStatus(action.id, 'field_verified', 'Zero bacteria confirmed on post-chlorination test.', {
        role: ROLES.OFFICIAL_REVIEWER,
        id: 'HEALTH-OFFICER-01',
      });

      expect(updated.status).toBe('field_verified');
      expect(updated.auditLog.length).toBeGreaterThanOrEqual(2);
    });
  });
});
