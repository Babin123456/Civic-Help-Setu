import { describe, it, expect } from 'vitest';
import {
  isValidPortalUrl,
  validateServiceRecordDeterministic,
  detectStatisticalOutliers,
  auditCatalogueRecord,
  resolveAnomalyFlag,
  ANOMALY_TYPE,
  ANOMALY_SEVERITY,
  REVIEW_STATUS,
  QUALITY_DISCLAIMER,
} from './civicDataQualityAnomalyService.js';

describe('Civic Data Quality Anomaly Detector Service', () => {
  it('validates official portal URLs strictly requiring HTTPS', () => {
    expect(isValidPortalUrl('https://sarathi.parivahan.gov.in')).toBe(true);
    expect(isValidPortalUrl('http://insecure.parivahan.gov.in')).toBe(false); // Insecure HTTP
    expect(isValidPortalUrl('not-a-valid-url')).toBe(false);
  });

  it('detects missing required fields and impossible negative numeric values', () => {
    const badRecord = {
      id: 'srv-001',
      name: 'Birth Certificate Issuance',
      authority: '', // Missing mandatory field
      jurisdiction: 'MAHARASHTRA',
      fee: -50, // Impossible negative fee
      processingDays: 0, // Impossible 0 days
      portalUrl: 'ftp://ftp.edistrict.gov.in', // Insecure non-HTTPS URL
    };

    const anomalies = validateServiceRecordDeterministic(badRecord);
    expect(anomalies.length).toBe(4);

    const missingAuth = anomalies.find((a) => a.field === 'authority');
    expect(missingAuth.anomalyType).toBe(ANOMALY_TYPE.MISSING_MANDATORY_FIELD);
    expect(missingAuth.severity).toBe(ANOMALY_SEVERITY.CRITICAL);

    const negFee = anomalies.find((a) => a.field === 'fee');
    expect(negFee.anomalyType).toBe(ANOMALY_TYPE.NUMERIC_VALUE_IMPOSSIBLE);

    const badUrl = anomalies.find((a) => a.field === 'portalUrl');
    expect(badUrl.anomalyType).toBe(ANOMALY_TYPE.INVALID_URL_SCHEME);
  });

  it('flags statistical fee outliers deviating significantly from cohort benchmarks', () => {
    const anomalousService = {
      id: 'srv-pds-09',
      name: 'Ration Card Member Addition',
      fee: 5000, // Regular fee is ₹50
    };

    const cohortStats = {
      meanFee: 50,
      stdFee: 20,
    };

    const outliers = detectStatisticalOutliers(anomalousService, cohortStats);
    expect(outliers.length).toBe(1);
    expect(outliers[0].anomalyType).toBe(ANOMALY_TYPE.STATISTICAL_FEE_OUTLIER);
    expect(outliers[0].zScore).toBeGreaterThan(10);
    expect(outliers[0].message).toContain('deviates significantly');
  });

  it('runs complete audit without silent destructive mutations', () => {
    const cleanRecord = {
      id: 'srv-good-10',
      name: 'Income Certificate',
      authority: 'Revenue Department',
      jurisdiction: 'KARNATAKA',
      fee: 25,
      processingDays: 21,
      portalUrl: 'https://sevasindhu.karnataka.gov.in',
    };

    const report = auditCatalogueRecord(cleanRecord, { meanFee: 30, stdFee: 10 });
    expect(report.isClean).toBe(true);
    expect(report.totalAnomalies).toBe(0);
    expect(report.requiresAdminReview).toBe(false);
    expect(report.disclaimer).toBe(QUALITY_DISCLAIMER);
  });

  it('allows administrator to resolve or dismiss an anomaly flag with audit notes', () => {
    const flaggedRecord = {
      id: 'srv-flag-11',
      name: 'Passport Police Verification',
      authority: 'State Police',
      jurisdiction: 'ALL_INDIA',
      fee: 0,
      processingDays: 21,
      portalUrl: 'https://passportindia.gov.in',
    };

    const audit = auditCatalogueRecord(flaggedRecord);
    const flag = {
      flagId: 'flag-101',
      serviceId: 'srv-flag-11',
      status: REVIEW_STATUS.OPEN_FLAG,
    };

    const resolved = resolveAnomalyFlag(
      flag,
      'admin_officer_07',
      REVIEW_STATUS.DISMISSED_LEGITIMATE,
      'Zero fee confirmed as service is covered under central administrative grant.'
    );

    expect(resolved.status).toBe(REVIEW_STATUS.DISMISSED_LEGITIMATE);
    expect(resolved.resolvedBy).toBe('admin_officer_07');
    expect(resolved.resolutionNote).toContain('central administrative grant');
    expect(resolved.resolvedAt).toBeDefined();
  });
});
