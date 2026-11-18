import { describe, it, expect, beforeEach, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  CHECKS,
  MEASURED_BENCHMARKS,
  PRELIMINARY_SCREENING_DISCLAIMER,
  evaluateAudit,
  evaluateMeasurement,
  evaluateMeasuredAudit,
  generateRemediationPlan,
  addReassessmentRecord,
  generatePrintableRemediationReport,
  estimatePenalty,
  draftAccessibilityPetition,
} from './accessibilityAuditService.js';
import {
  minimizeAudit,
  sanitizeMeasurements,
  sanitizeRemediationPlan,
  saveAudit,
  verifyAudit,
  deleteAudit,
  listAudits,
} from './accessibilityAuditStorage.js';

describe('accessibility audit', () => {
  beforeEach(() => {
    const data = new Map();
    vi.stubGlobal('localStorage', {
      getItem: k => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, String(v)),
    });
    vi.stubGlobal('crypto', webcrypto);
  });

  it('excludes unknown and inapplicable checks and identifies priority hazards', () => {
    expect(evaluateAudit({}).score).toBeNull();
    const result = evaluateAudit({ ramp: 'no', door: 'yes', lift: 'na' });
    expect(result.score).toBe(50);
    expect(result.assessed).toBe(2);
    expect(result.hazards).toEqual([CHECKS[0].label]);
  });

  it('provides conditional penalty guidance and a petition', () => {
    expect(estimatePenalty('subsequent')).toContain('₹5,00,000');
    expect(estimatePenalty('unknown')).toContain('not automatic');
    expect(
      draftAccessibilityPetition({ authority: 'state', facility: '', district: '', facts: '', audit: evaluateAudit({}) })
    ).toContain('State Commissioner');
  });

  it('persists only checklist data and detects modifications', async () => {
    const data = { ramp: 'no', name: 'private person', location: 'private address' };
    expect(JSON.stringify(minimizeAudit(data))).not.toContain('private');
    const saved = await saveAudit(data);
    expect(await verifyAudit(saved)).toBe(true);
    expect(await verifyAudit({ ...saved, answers: { ...saved.answers, ramp: 'yes' } })).toBe(false);
    deleteAudit(saved.id);
    expect(listAudits()).toEqual([]);
  });

  describe('measured benchmarks evaluation (#948)', () => {
    const rampSlopeBenchmark = MEASURED_BENCHMARKS.find(b => b.key === 'ramp_slope');
    const doorWidthBenchmark = MEASURED_BENCHMARKS.find(b => b.key === 'door_clear_width');
    const handrailLowerBenchmark = MEASURED_BENCHMARKS.find(b => b.key === 'handrail_lower');
    const doorThresholdBenchmark = MEASURED_BENCHMARKS.find(b => b.key === 'door_threshold');

    it('evaluates directional measurement boundaries (>= and <=)', () => {
      // Ramp slope ratio: 1:12 or gentler (denominator >= 12)
      expect(evaluateMeasurement(rampSlopeBenchmark, 12).status).toBe('COMPLIANT');
      expect(evaluateMeasurement(rampSlopeBenchmark, 15).status).toBe('COMPLIANT');
      const steepRamp = evaluateMeasurement(rampSlopeBenchmark, 10);
      expect(steepRamp.status).toBe('NON_COMPLIANT');
      expect(steepRamp.gap).toBe(2);

      // Door width: >= 900 mm
      expect(evaluateMeasurement(doorWidthBenchmark, 900).status).toBe('COMPLIANT');
      expect(evaluateMeasurement(doorWidthBenchmark, 1000).status).toBe('COMPLIANT');
      const narrowDoor = evaluateMeasurement(doorWidthBenchmark, 850);
      expect(narrowDoor.status).toBe('NON_COMPLIANT');
      expect(narrowDoor.gap).toBe(50);

      // Door threshold: <= 12 mm
      expect(evaluateMeasurement(doorThresholdBenchmark, 12).status).toBe('COMPLIANT');
      expect(evaluateMeasurement(doorThresholdBenchmark, 5).status).toBe('COMPLIANT');
      const highStep = evaluateMeasurement(doorThresholdBenchmark, 18);
      expect(highStep.status).toBe('NON_COMPLIANT');
      expect(highStep.gap).toBe(6);
    });

    it('evaluates range benchmarks correctly', () => {
      // Lower handrail: 700 to 800 mm
      expect(evaluateMeasurement(handrailLowerBenchmark, 760).status).toBe('COMPLIANT');
      expect(evaluateMeasurement(handrailLowerBenchmark, 700).status).toBe('COMPLIANT');
      expect(evaluateMeasurement(handrailLowerBenchmark, 800).status).toBe('COMPLIANT');

      const tooLow = evaluateMeasurement(handrailLowerBenchmark, 650);
      expect(tooLow.status).toBe('NON_COMPLIANT');
      expect(tooLow.gap).toBe(50);

      const tooHigh = evaluateMeasurement(handrailLowerBenchmark, 850);
      expect(tooHigh.status).toBe('NON_COMPLIANT');
      expect(tooHigh.gap).toBe(50);
    });

    it('distinguishes unknown/blank inputs from non-compliant failures', () => {
      expect(evaluateMeasurement(doorWidthBenchmark, '').status).toBe('UNKNOWN');
      expect(evaluateMeasurement(doorWidthBenchmark, null).status).toBe('UNKNOWN');
      expect(evaluateMeasurement(doorWidthBenchmark, undefined).status).toBe('UNKNOWN');
      expect(evaluateMeasurement(doorWidthBenchmark, 'unknown').status).toBe('UNKNOWN');
      expect(evaluateMeasurement(doorWidthBenchmark, 'unknown').isCompliant).toBeNull();

      expect(evaluateMeasurement(doorWidthBenchmark, 'na').status).toBe('NOT_APPLICABLE');
      expect(evaluateMeasurement(doorWidthBenchmark, 'na').isCompliant).toBeNull();

      expect(evaluateMeasurement(doorWidthBenchmark, -5).status).toBe('INVALID');
    });

    it('computes overall measured audit metrics and detects critical hazards', () => {
      const measurements = {
        ramp_slope: 10, // non-compliant, critical
        ramp_width: 1300, // compliant, critical
        door_clear_width: 800, // non-compliant, critical
        washroom_width: 2100, // compliant, non-critical
        washroom_depth: 'unknown',
        lift_car_width: 'na',
      };

      const result = evaluateMeasuredAudit(measurements);
      expect(result.assessedCount).toBe(4);
      expect(result.compliantCount).toBe(2);
      expect(result.nonCompliantCount).toBe(2);
      expect(result.unknownCount).toBeGreaterThanOrEqual(1);
      expect(result.notApplicableCount).toBe(1);
      expect(result.score).toBe(50);

      expect(result.criticalHazards.length).toBe(2);
      expect(result.criticalHazards.map(h => h.key)).toContain('ramp_slope');
      expect(result.criticalHazards.map(h => h.key)).toContain('door_clear_width');
    });
  });

  describe('remediation planning & reassessments (#948)', () => {
    it('generates a prioritized remediation plan with target dates', () => {
      const measurements = {
        ramp_slope: 10, // critical
        door_clear_width: 780, // critical
        door_threshold: 20, // non-critical
      };

      const evaluated = evaluateMeasuredAudit(measurements);
      const plan = generateRemediationPlan(evaluated, { responsibleParty: 'PWD Works' });

      expect(plan.length).toBe(3);
      // Critical items must appear before non-critical items
      expect(plan[0].critical).toBe(true);
      expect(plan[0].priority).toBe('CRITICAL');
      expect(plan[0].targetDays).toBe(30);
      expect(plan[0].targetDate).toBeDefined();

      const nonCritical = plan.find(p => p.key === 'door_threshold');
      expect(nonCritical.critical).toBe(false);
      expect(nonCritical.priority).toBe('HIGH');
      expect(nonCritical.targetDays).toBe(60);
    });

    it('preserves reassessment history and tracks resolved barriers', () => {
      const initialRecord = {
        id: 'facility-101',
        facilityName: 'District Collectorate Ground Floor',
        district: 'Indore, MP',
        measurements: {
          ramp_slope: 10, // failed
          door_clear_width: 750, // failed
        },
      };

      // In Round 2: door widened to 920 mm (resolved!), ramp slope still 10 (unresolved)
      const reassessment1 = {
        reassessedMeasurements: {
          ramp_slope: 10,
          door_clear_width: 920,
        },
        assessorNotes: 'Doorway widened by civil contractor; ramp reconstruction underway.',
      };

      const updatedRecord = addReassessmentRecord(initialRecord, reassessment1);
      expect(updatedRecord.reassessments.length).toBe(1);
      expect(updatedRecord.reassessments[0].resolvedBarriers).toContain('Doorway Clear Opening Width');
      expect(updatedRecord.reassessments[0].unresolvedBarriers).toContain('Ramp Slope Gradient');
      expect(updatedRecord.reassessments[0].evaluation.score).toBe(50);

      // In Round 3: ramp slope now rebuilt to 1:14 (both resolved!)
      const reassessment2 = {
        reassessedMeasurements: {
          ramp_slope: 14,
          door_clear_width: 920,
        },
        assessorNotes: 'Ramp reconstructed with 1:14 slope and handrails fitted.',
      };

      const finalRecord = addReassessmentRecord(updatedRecord, reassessment2);
      expect(finalRecord.reassessments.length).toBe(2);
      expect(finalRecord.reassessments[1].resolvedBarriers).toContain('Ramp Slope Gradient');
      expect(finalRecord.reassessments[1].evaluation.score).toBe(100);
    });

    it('generates a comprehensive printable markdown report', () => {
      const auditRecord = {
        facilityName: 'Sub-Divisional Hospital OPD',
        district: 'Nashik, Maharashtra',
        createdAt: '2026-11-18T10:00:00Z',
        reassessments: [
          {
            reassessedAt: '2026-11-18T11:00:00Z',
            evaluation: { score: 75 },
            resolvedBarriers: ['Doorway Clear Opening Width'],
            unresolvedBarriers: ['Ramp Slope Gradient'],
            assessorNotes: 'Contractor installed wider swing door.',
          },
        ],
      };

      const evaluated = evaluateMeasuredAudit({
        ramp_slope: 10,
        door_clear_width: 920,
      });
      const plan = generateRemediationPlan(evaluated);

      const report = generatePrintableRemediationReport(auditRecord, evaluated, plan);
      expect(report).toContain('# Universal Accessibility Screening & Remediation Report');
      expect(report).toContain('Sub-Divisional Hospital OPD');
      expect(report).toContain('Nashik, Maharashtra');
      expect(report).toContain(PRELIMINARY_SCREENING_DISCLAIMER);
      expect(report).toContain('## 1. Measured Benchmarks Matrix');
      expect(report).toContain('## 2. Priority Remediation Action Plan');
      expect(report).toContain('## 3. Reassessment & Progress History');
      expect(report).toContain('Contractor installed wider swing door');
    });
  });

  describe('sanitization and storage of measured audits (#948)', () => {
    it('sanitizes measurements and strips unknown keys', () => {
      const raw = {
        ramp_slope: '14.5',
        door_clear_width: 950,
        unauthorized_key: 'hacker payload',
        washroom_width: -10,
      };

      const sanitized = sanitizeMeasurements(raw);
      expect(sanitized.ramp_slope).toBe(14.5);
      expect(sanitized.door_clear_width).toBe(950);
      expect(sanitized.unauthorized_key).toBeUndefined();
      expect(sanitized.washroom_width).toBe('unknown');
    });

    it('sanitizes remediation plan and prevents arbitrary field injection', () => {
      const rawPlan = [
        {
          id: 'door',
          label: 'Door Width',
          priority: 'INVALID_PRIORITY',
          secretToken: 'do_not_store',
        },
      ];

      const sanitized = sanitizeRemediationPlan(rawPlan);
      expect(sanitized[0].priority).toBe('HIGH');
      expect(sanitized[0].secretToken).toBeUndefined();
    });

    it('saves and verifies measured audit with cryptographic seal', async () => {
      const auditPayload = {
        facilityName: 'District Court Complex',
        district: 'Pune',
        measurements: {
          ramp_slope: 10,
          door_clear_width: 850,
        },
        remediationPlan: [
          {
            key: 'ramp_slope',
            label: 'Ramp slope',
            priority: 'CRITICAL',
          },
        ],
      };

      const saved = await saveAudit(auditPayload);
      expect(saved.id).toBeDefined();
      expect(saved.seal).toBeDefined();
      expect(saved.facilityName).toBe('District Court Complex');

      const isIntact = await verifyAudit(saved);
      expect(isIntact).toBe(true);

      // Tampering with measurement must invalidate seal
      const tampered = {
        ...saved,
        measurements: {
          ...saved.measurements,
          ramp_slope: 15,
        },
      };
      expect(await verifyAudit(tampered)).toBe(false);
    });
  });
});
