import { describe, it, expect } from 'vitest';
import {
  REPORT_REASON_CODES,
  REPORT_STATUS,
  RISK_LEVEL,
  anonymizeReporterId,
  createHallucinationReport,
  evaluateOfficialSourceSnapshot,
  migrateHallucinationStoreState,
  resolveHallucinationReport,
  withdrawHallucinationReport,
} from './aiHallucinationReportService.js';

describe('Civic AI Hallucination & Unsupported-Claim Reporting (#1448)', () => {
  it('creates minimal-telemetry report with anonymized reporterRef and high-risk routing', () => {
    const res = createHallucinationReport(
      {
        responseId: 'resp-101',
        claimId: 'claim-fee',
        serviceId: 'passport',
        modelVersion: 'civic-rag-v2.4',
        rulesetVersion: 'rules-2026.11',
        reasonCode: REPORT_REASON_CODES.MISSTATED_REQUIREMENT,
        claimText: 'Tatkal passport fee is zero for all applicants.',
        citizenCorrectionNote: 'Tatkal fee applies.',
      },
      'user_real_clerk_id_123'
    );

    expect(res.valid).toBe(true);
    expect(res.report.reporterRef).toBe(anonymizeReporterId('user_real_clerk_id_123'));
    expect(res.report.reporterRef).not.toContain('user_real_clerk_id_123');
    expect(res.report.riskLevel).toBe(RISK_LEVEL.HIGH);
    expect(res.report.routedTo).toBe('priority_reviewer_queue');
    expect(res.report.status).toBe(REPORT_STATUS.UNDER_REVIEW);
    expect(res.report.sourceSnapshot.verified).toBe(false);
    expect(res.report.sourceSnapshot.status).toBe('unverified');
  });

  it('rejects Aadhaar, PAN, OTP, password, and mobile numbers in reports', () => {
    const withAadhaar = createHallucinationReport(
      {
        responseId: 'resp-102',
        claimId: 'claim-2',
        reasonCode: REPORT_REASON_CODES.NO_SOURCE_CITED,
        claimText: 'My Aadhaar 2345 6789 0123 was rejected.',
      },
      'user-1'
    );
    expect(withAadhaar.valid).toBe(false);

    const withSensitiveKey = createHallucinationReport(
      {
        responseId: 'resp-103',
        claimId: 'claim-3',
        reasonCode: REPORT_REASON_CODES.NO_SOURCE_CITED,
        claimText: 'Missing source citation for pension claim.',
        otp: '123456',
      },
      'user-1'
    );
    expect(withSensitiveKey.valid).toBe(false);
  });

  it('allows owner withdrawal and blocks non-owner withdrawal', () => {
    const { report } = createHallucinationReport(
      {
        responseId: 'resp-104',
        claimId: 'claim-4',
        reasonCode: REPORT_REASON_CODES.OUTDATED_RULE,
        claimText: 'Old fee schedule cited.',
      },
      'citizen-a'
    );

    expect(() =>
      withdrawHallucinationReport(report, { actorId: 'citizen-b', role: 'citizen' })
    ).toThrow(/Forbidden/);

    const withdrawn = withdrawHallucinationReport(report, {
      actorId: 'citizen-a',
      role: 'citizen',
      reason: 'Misread the response',
    });
    expect(withdrawn.status).toBe(REPORT_STATUS.WITHDRAWN_BY_REPORTER);
  });

  it('issues official correction and exports redacted regression fixture', () => {
    const { report } = createHallucinationReport(
      {
        responseId: 'resp-105',
        claimId: 'claim-5',
        serviceId: 'ration-card',
        reasonCode: REPORT_REASON_CODES.FABRICATED_PORTAL_OR_URL,
        claimText: 'Apply at fake-ration-portal.example.com.',
      },
      'citizen-c'
    );

    const { report: resolved, fixture } = resolveHallucinationReport(report, {
      actorId: 'admin-1',
      outcome: REPORT_STATUS.CORRECTION_ISSUED,
      correctionNote: 'Official UP ration card portal is fcs.up.gov.in.',
      officialSource: {
        source: 'https://fcs.up.gov.in',
        jurisdiction: 'IN-UP',
        effectiveDate: '2026-01-01',
        lastVerifiedAt: '2026-11-20T00:00:00.000Z',
      },
      exportFixture: true,
    });

    expect(resolved.status).toBe(REPORT_STATUS.CORRECTION_ISSUED);
    expect(resolved.resolution.officialSource.verified).toBe(true);
    expect(fixture).toBeDefined();
    expect(fixture.sourceReportId).toBe(report.reportId);
    expect(fixture.expectedCitations).toContain('https://fcs.up.gov.in');
  });

  it('marks incomplete official source snapshots as unverified and migrates legacy state', () => {
    const snap = evaluateOfficialSourceSnapshot({ source: 'Draft memo' });
    expect(snap.verified).toBe(false);
    expect(snap.status).toBe('unverified');

    const migrated = migrateHallucinationStoreState({});
    expect(migrated.schemaVersion).toBe('1.0.0');
    expect(migrated.reports.length).toBeGreaterThanOrEqual(2);
  });
});
