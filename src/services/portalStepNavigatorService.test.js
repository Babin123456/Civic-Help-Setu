import { describe, it, expect } from 'vitest';
import {
  verifyOfficialDomain,
  getPortalStepGuidance,
  reportPortalIssue,
  exportPortalNavigationGuide,
  getPortalTroubleshootingTips,
  getRegisteredOfficialPortals,
  ALLOWLISTED_GOVT_DOMAINS,
  SAMPLE_PORTAL_GUIDES,
  PORTAL_MAINTENANCE_WINDOWS
} from './portalStepNavigatorService';

describe('portalStepNavigatorService', () => {
  it('should define allowlisted domains and guides', () => {
    expect(ALLOWLISTED_GOVT_DOMAINS).toContain('gov.in');
    expect(ALLOWLISTED_GOVT_DOMAINS).toContain('nic.in');
    expect(SAMPLE_PORTAL_GUIDES.PARIVAHAN_DRIVING_LICENCE.domain).toContain('parivahan.gov.in');
  });

  it('should accurately verify official government domains and flag phishing urls', () => {
    const verified = verifyOfficialDomain('https://sarathi.parivahan.gov.in/sarathiservice/');
    expect(verified.isOfficialGovDomain).toBe(true);
    expect(verified.hostname).toBe('sarathi.parivahan.gov.in');
    expect(verified.warning).toBeNull();

    // Fake domain
    const fake = verifyOfficialDomain('https://parivahan-fake-services.com/login');
    expect(fake.isOfficialGovDomain).toBe(false);
    expect(fake.warning).toContain('Unrecognized or non-government');

    // Insecure HTTP
    const insecure = verifyOfficialDomain('http://uidai.gov.in');
    expect(insecure.isOfficialGovDomain).toBe(false);
    expect(insecure.error).toContain('HTTPS protocol');
  });

  it('should retrieve step-specific guidance and common errors', () => {
    const step2 = getPortalStepGuidance('PARIVAHAN_DRIVING_LICENCE', 2);
    expect(step2.currentStepNumber).toBe(2);
    expect(step2.stepDetails.pageTitle).toContain('Learners Licence');
    expect(step2.stepDetails.commonErrors.length).toBeGreaterThan(0);
    expect(step2.credentialSafetyNotice).toContain('NEVER request your portal password');
  });

  it('should process portal discrepancy reports from citizens', () => {
    const report = reportPortalIssue('PARIVAHAN_DRIVING_LICENCE', {
      issueType: 'LAYOUT_ALTERED',
      description: 'Button position moved to footer in new portal UI update'
    });

    expect(report.success).toBe(true);
    expect(report.status).toBe('QUEUED_FOR_ADMIN_AUDIT');
  });

  it('should provide portal troubleshooting tips and maintenance windows', () => {
    const tips = getPortalTroubleshootingTips();
    expect(tips.length).toBeGreaterThanOrEqual(4);
    expect(PORTAL_MAINTENANCE_WINDOWS.DAILY_SYNC).toContain('IST');
  });

  it('should list registered official portals for quick verification', () => {
    const portals = getRegisteredOfficialPortals();
    expect(portals.PASSPORT_SEVA.officialUrl).toContain('passportindia.gov.in');
    expect(portals.INCOME_TAX_E_FILING.jurisdiction).toBe('Central Board of Direct Taxes');
  });

  it('should export formatted markdown portal navigation dossier', () => {
    const doc = exportPortalNavigationGuide(SAMPLE_PORTAL_GUIDES.PARIVAHAN_DRIVING_LICENCE);
    expect(doc).toContain('# Civic Portal Step Navigator: Parivahan Sarathi Driving Licence Portal Guide');
    expect(doc).toContain('VERIFIED GOV.IN DESTINATION');
    expect(doc).toContain('Zero Credential Collection Safety Principle');
    expect(doc).toContain('Learners Licence');
  });
});
