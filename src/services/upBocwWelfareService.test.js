import { describe, it, expect } from 'vitest';
import {
  assessBocwEligibility,
  calculateBocwRenewalTimeline,
  matchBocwSchemes,
  exportBocwDossier,
  UP_BOCW_OCCUPATIONS,
  UP_BOCW_BENEFIT_SCHEMES,
  UP_LABOUR_OFFICE_ESCALATION
} from './upBocwWelfareService';

describe('upBocwWelfareService', () => {
  it('should define core occupations, benefit schemes, and escalation hierarchy', () => {
    expect(UP_BOCW_OCCUPATIONS.length).toBeGreaterThan(5);
    expect(UP_BOCW_OCCUPATIONS).toContain('Mason (Rajmistri)');
    expect(UP_BOCW_BENEFIT_SCHEMES.SANT_RAVIDAS_SHIKSHA.code).toBe('SANT_RAVIDAS_SHIKSHA');
    expect(UP_LABOUR_OFFICE_ESCALATION.length).toBe(3);
    expect(UP_LABOUR_OFFICE_ESCALATION[1].officer).toContain('ALC');
  });

  it('should reject worker ineligible under 90-day minimum rule', () => {
    const profile = {
      age: 28,
      daysWorkedLast12Months: 65,
      occupation: 'Mason (Rajmistri)',
      hasEmployerCertificate: true
    };

    const res = assessBocwEligibility(profile);
    expect(res.isEligible).toBe(false);
    expect(res.errors.some(e => e.includes('90 days'))).toBe(true);
  });

  it('should reject worker missing valid 90-day certification proof', () => {
    const profile = {
      age: 35,
      daysWorkedLast12Months: 110,
      occupation: 'Plumber / Pipe Fitter',
      hasEmployerCertificate: false,
      hasTradeUnionCertificate: false,
      hasGramPradhanCertificate: false
    };

    const res = assessBocwEligibility(profile);
    expect(res.isEligible).toBe(false);
    expect(res.errors.some(e => e.includes('90-day work certificate required'))).toBe(true);
  });

  it('should accept eligible worker with Gram Pradhan certification and 120 days', () => {
    const profile = {
      age: 40,
      daysWorkedLast12Months: 120,
      occupation: 'Mason (Rajmistri)',
      hasGramPradhanCertificate: true
    };

    const res = assessBocwEligibility(profile);
    expect(res.isEligible).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it('should calculate renewal timeline for active, grace period, and lapsed cards', () => {
    // 1. Active
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 45);
    const active = calculateBocwRenewalTimeline({
      registrationNumber: '998877661234',
      validUptoDate: futureDate.toISOString()
    });
    expect(active.status).toBe('ACTIVE');
    expect(active.registrationNumber).toContain('****-1234');
    expect(active.annualRenewalFeeINR).toBe(20);

    // 2. Grace period (30 days expired)
    const graceDate = new Date();
    graceDate.setDate(graceDate.getDate() - 30);
    const grace = calculateBocwRenewalTimeline({
      registrationNumber: '112233445566',
      validUptoDate: graceDate.toISOString()
    });
    expect(grace.status).toBe('GRACE_PERIOD');
    expect(grace.canRenewOnline).toBe(true);

    // 3. Lapsed (120 days expired)
    const lapsedDate = new Date();
    lapsedDate.setDate(lapsedDate.getDate() - 120);
    const lapsed = calculateBocwRenewalTimeline({
      registrationNumber: '445566778899',
      validUptoDate: lapsedDate.toISOString()
    });
    expect(lapsed.status).toBe('LAPSED');
    expect(lapsed.canRenewOnline).toBe(false);
  });

  it('should match welfare schemes according to active card duration', () => {
    const newWorker = { activeMembershipYears: 0 };
    const matchesNew = matchBocwSchemes(newWorker);
    expect(matchesNew.every(m => !m.isQualifying)).toBe(true);

    const seniorWorker = { activeMembershipYears: 2 };
    const matchesSenior = matchBocwSchemes(seniorWorker);
    expect(matchesSenior.every(m => m.isQualifying)).toBe(true);
  });

  it('should export formatted representation dossier for Labour Enforcement Officer', () => {
    const worker = { occupation: 'Carpenter (Badhai)', district: 'Varanasi' };
    const eligibility = { isEligible: true, daysRecorded: 105, errors: [] };
    const renewal = { status: 'ACTIVE', registrationNumber: 'UPBOCW-****-7890' };

    const doc = exportBocwDossier(worker, eligibility, renewal);
    expect(doc).toContain('# UPBOCW Labour Welfare & Registration Representation');
    expect(doc).toContain('Carpenter (Badhai)');
    expect(doc).toContain('Varanasi');
    expect(doc).toContain('Labour Enforcement Officer (LEO / Shram Pravartan Adhikari)');
    expect(doc).toContain('Privacy Commitment');
  });
});
