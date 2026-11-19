import { describe, it, expect } from 'vitest';
import {
  createPRNG,
  executeSyntheticGeneration,
  exportBundleToJson,
  exportEntityToCsv,
  exportBundleToSql,
} from './syntheticGeneratorEngine';

describe('syntheticGeneratorEngine (#778)', () => {
  describe('Mulberry32 PRNG Determinism', () => {
    it('produces identical random sequences given the same seed', () => {
      const prng1 = createPRNG(4294967);
      const prng2 = createPRNG(4294967);

      const seq1 = [prng1(), prng1(), prng1(), prng1()];
      const seq2 = [prng2(), prng2(), prng2(), prng2()];

      expect(seq1).toEqual(seq2);
    });

    it('produces distinct sequences given different seeds', () => {
      const prngA = createPRNG(1001);
      const prngB = createPRNG(2002);

      expect(prngA()).not.toEqual(prngB());
    });
  });

  describe('executeSyntheticGeneration & Referential Integrity', () => {
    const testProfile = {
      profileId: 'test-profile-01',
      seed: 88776655,
      scaleConfig: {
        servicesCount: 4,
        officesCount: 3,
        applicationsCount: 20,
        grievancesCount: 10,
      },
      jurisdictionScope: {
        state: 'Maharashtra',
        district: 'Pune',
      },
      edgeCaseRates: {
        statutoryDeadlineOverduePct: 0.3,
        queryDeficiencyPct: 0.25,
      },
    };

    it('produces reproducible output for the same profile and seed', () => {
      const run1 = executeSyntheticGeneration(testProfile);
      const run2 = executeSyntheticGeneration(testProfile);

      expect(run1.checksum).toBe(run2.checksum);
      expect(run1.applications).toEqual(run2.applications);
      expect(run1.grievances).toEqual(run2.grievances);
    });

    it('enforces 100% referential integrity across the generated DAG', () => {
      const bundle = executeSyntheticGeneration(testProfile);

      const serviceIds = new Set(bundle.services.map((s) => s.id));
      const officeIds = new Set(bundle.offices.map((o) => o.id));
      const applicationIds = new Set(bundle.applications.map((a) => a.id));

      // 1. Applications must reference valid Services and Offices
      for (const app of bundle.applications) {
        expect(serviceIds.has(app.serviceId)).toBe(true);
        expect(officeIds.has(app.officeId)).toBe(true);
        expect(app.isSynthetic).toBe(true);
      }

      // 2. Grievances must reference valid Services and Applications (if present)
      for (const grv of bundle.grievances) {
        expect(serviceIds.has(grv.serviceId)).toBe(true);
        if (grv.applicationId) {
          expect(applicationIds.has(grv.applicationId)).toBe(true);
        }
        expect(grv.isSynthetic).toBe(true);
      }
    });

    it('generates strictly chronological status timelines', () => {
      const bundle = executeSyntheticGeneration(testProfile);

      for (const app of bundle.applications) {
        expect(app.timeline.length).toBeGreaterThanOrEqual(2);
        for (let i = 1; i < app.timeline.length; i += 1) {
          const prevDate = new Date(app.timeline[i - 1].date);
          const currDate = new Date(app.timeline[i].date);
          expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime());
        }
      }
    });
  });

  describe('Export Transformers', () => {
    const profile = {
      seed: 9999,
      scaleConfig: { servicesCount: 2, officesCount: 2, applicationsCount: 5, grievancesCount: 2 },
    };

    it('exports bundle to valid JSON', () => {
      const bundle = executeSyntheticGeneration(profile);
      const jsonStr = exportBundleToJson(bundle);
      const parsed = JSON.parse(jsonStr);
      expect(parsed.seed).toBe(9999);
      expect(parsed.applications).toHaveLength(5);
    });

    it('exports records to formatted CSV', () => {
      const bundle = executeSyntheticGeneration(profile);
      const csv = exportEntityToCsv(bundle.applications);
      expect(csv).toContain('id');
      expect(csv).toContain('applicantPseudonym');
      expect(csv.split('\n')).toHaveLength(6); // header + 5 rows
    });

    it('exports bundle to SQL statements', () => {
      const bundle = executeSyntheticGeneration(profile);
      const sql = exportBundleToSql(bundle);
      expect(sql).toContain('INSERT INTO synthetic_services');
      expect(sql).toContain('INSERT INTO synthetic_applications');
      expect(sql).toContain('SYNTH-CIVIC-SETU-v1');
    });
  });
});
