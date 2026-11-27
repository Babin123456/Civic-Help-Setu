import { describe, it, expect } from 'vitest';
import {
  BARRIER_CATEGORIES,
  aggregateBarrierSlaMetrics,
  anonymizeBarrierReporter,
  createBarrierSlaReport,
  getBuiltInBarrierSlaReports,
  migrateBarrierSlaState,
  resolveBarrierSlaReport,
  verifySlaRuleProvenance,
} from './accessibilityBarrierSlaService.js';

describe('Accessibility Barrier Resolution SLA Dashboard (#1443)', () => {
  it('anonymizes reporters, computes resolution duration & repeat incidents, and suppresses small groups', () => {
    const reports = getBuiltInBarrierSlaReports();
    const summary = aggregateBarrierSlaMetrics(reports, { minGroupSize: 5 });

    expect(summary.totalReports).toBe(13);
    expect(summary.suppressedGroupCount).toBe(1); // 2 accessible_toilet_locked reports (< 5)
    expect(summary.repeatIncidentLocations).toBeGreaterThanOrEqual(2);

    const suppressedRow = summary.categoryBreakdown.find(
      (b) => b.category === BARRIER_CATEGORIES.ACCESSIBLE_TOILET_LOCKED
    );
    expect(suppressedRow.suppressed).toBe(true);
    expect(suppressedRow.metrics).toBeNull();

    const rampRow = summary.categoryBreakdown.find(
      (b) => b.category === BARRIER_CATEGORIES.RAMP_MISSING_OR_BLOCKED
    );
    expect(rampRow.suppressed).toBe(false);
    expect(rampRow.metrics.avgResolutionHours).toBe(30);
    expect(rampRow.metrics.slaComplianceRate).toBe(1);
  });

  it('filters by ward, facility, and verification state', () => {
    const reports = getBuiltInBarrierSlaReports();
    const ward14 = aggregateBarrierSlaMetrics(reports, { wardId: 'ward-14', minGroupSize: 3 });
    expect(ward14.totalReports).toBe(6);

    const unverified = aggregateBarrierSlaMetrics(reports, { verificationState: 'unverified', minGroupSize: 3 });
    expect(unverified.totalReports).toBe(3);
  });

  it('rejects PII, anonymizes reporterRef, marks incomplete rules unverified, and resolves reports', () => {
    const bad = createBarrierSlaReport(
      {
        category: BARRIER_CATEGORIES.ELEVATOR_OUTAGE,
        wardId: 'ward-1',
        facilityId: 'station-1',
        summary: 'Call 9876543210 or Aadhaar 2345 6789 0123.',
      },
      'user_secret_id'
    );
    expect(bad.valid).toBe(false);

    const { valid, report } = createBarrierSlaReport(
      {
        category: BARRIER_CATEGORIES.ELEVATOR_OUTAGE,
        wardId: 'ward-1',
        facilityId: 'station-1',
        summary: 'Elevator stuck on level 2.',
        reportedAt: '2026-11-20T08:00:00.000Z',
      },
      'user_secret_id'
    );
    expect(valid).toBe(true);
    expect(report.reporterRef).toBe(anonymizeBarrierReporter('user_secret_id'));
    expect(report.reporterRef).not.toContain('user_secret_id');

    const unverifiedRule = verifySlaRuleProvenance({ source: 'Draft' });
    expect(unverifiedRule.verified).toBe(false);
    expect(unverifiedRule.status).toBe('unverified');

    const resolved = resolveBarrierSlaReport(report, {
      actorId: 'admin-1',
      role: 'admin',
      officialRule: {
        source: 'Metro Accessibility Maintenance Charter',
        jurisdiction: 'IN-UP',
        effectiveDate: '2026-01-01',
        lastVerifiedAt: '2026-11-20T00:00:00.000Z',
      },
      resolvedAt: '2026-11-20T20:00:00.000Z',
    });
    expect(resolved.verificationState).toBe('verified');
    expect(resolved.resolutionHours).toBe(12);
    expect(resolved.slaMet).toBe(true);

    const migrated = migrateBarrierSlaState({});
    expect(migrated.schemaVersion).toBe('1.0.0');
  });
});
