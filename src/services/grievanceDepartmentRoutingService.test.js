import { describe, it, expect } from 'vitest';
import { GRIEVANCE_CATEGORIES } from './grievanceClassificationService.js';
import {
  applyHumanRoutingOverride,
  classifyGrievanceDepartments,
  evaluatePerClassRoutingMetrics,
  migrateGrievanceRoutingState,
  verifyDepartmentRuleProvenance,
} from './grievanceDepartmentRoutingService.js';

describe('AI-Assisted Grievance Department Routing Classifier (#1445)', () => {
  it('returns ranked multi-department suggestions with evidence phrases and human confirmation flag', () => {
    const res = classifyGrievanceDepartments({
      description: 'Pipeline burst causing dirty water supply and broken road pothole near Ward 8.',
      jurisdiction: 'IN-UP',
    });

    expect(res.isMultiDepartment).toBe(true);
    expect(res.requiresHumanConfirmation).toBe(true);
    expect(res.rankedDepartments.length).toBeGreaterThanOrEqual(2);
    expect(res.rankedDepartments[0].evidencePhrases.length).toBeGreaterThanOrEqual(1);
    expect(res.rankedDepartments[0].officialRule.verified).toBe(true);
  });

  it('triggers deterministic fallback when confidence is zero or fallback is forced', () => {
    const noSignal = classifyGrievanceDepartments({
      description: 'General civic concern requiring manual review.',
    });
    expect(noSignal.usedDeterministicFallback).toBe(true);
    expect(noSignal.primaryCategory).toBe(GRIEVANCE_CATEGORIES.AMBIGUOUS_MULTI_DEPARTMENT);
    expect(noSignal.requiresHumanConfirmation).toBe(true);

    const forced = classifyGrievanceDepartments({
      description: 'Deep pothole on main road.',
      forceDeterministicFallback: true,
    });
    expect(forced.usedDeterministicFallback).toBe(true);
  });

  it('computes per-class precision, recall, F1, and support on reviewed de-identified examples', () => {
    const metrics = evaluatePerClassRoutingMetrics();
    expect(metrics.totalExamples).toBe(10);
    expect(metrics.accuracy).toBeGreaterThanOrEqual(0.8);
    expect(metrics.perClass[GRIEVANCE_CATEGORIES.ROADS_AND_INFRASTRUCTURE].support).toBe(2);
    expect(metrics.perClass[GRIEVANCE_CATEGORIES.WATER_AND_SEWERAGE].f1).toBeGreaterThanOrEqual(0.8);
  });

  it('rejects PII, marks unknown rules unverified, and applies human override', () => {
    expect(() =>
      classifyGrievanceDepartments({ description: 'My Aadhaar is 2345 6789 0123 and pothole outside.' })
    ).toThrow(/Privacy violation/);

    const unverified = verifyDepartmentRuleProvenance({ source: 'Draft' });
    expect(unverified.verified).toBe(false);
    expect(unverified.status).toBe('unverified');

    const base = classifyGrievanceDepartments({ description: 'Pothole on main street.' });
    const overridden = applyHumanRoutingOverride(base, {
      actorId: 'admin-1',
      role: 'admin',
      selectedCategories: [GRIEVANCE_CATEGORIES.ROADS_AND_INFRASTRUCTURE, GRIEVANCE_CATEGORIES.WATER_AND_SEWERAGE],
      rationale: 'Confirmed joint PWD + Jal Board inspection.',
    });
    expect(overridden.status).toBe('human_confirmed');
    expect(overridden.requiresHumanConfirmation).toBe(false);

    const migrated = migrateGrievanceRoutingState({});
    expect(migrated.schemaVersion).toBe('1.0.0');
  });
});
