import { describe, it, expect } from 'vitest';
import {
  resolveTransgenderAuthority,
  evaluateApplicationApplicability,
  getApplicationStageChecklist,
  getCorrectionRoutes,
  getAppealRoutes,
  filterSupportResources,
  isDataStale
} from './transgenderCertificateWelfareService';
import {
  NATIONAL_PORTAL_INFO,
  getAllSupportedStates,
  getAllWelfareSchemes
} from '../data/transgenderCertificateWelfareData';

describe('transgenderCertificateWelfareService (#1104)', () => {
  it('resolves competent authority correctly for central/national framework', () => {
    const auth = resolveTransgenderAuthority('national');
    expect(auth.authorityName).toContain('District Magistrate / Collector');
    expect(auth.turnaroundDays).toBe(30);
    expect(auth.inspectionProhibited).toBe(true);
    expect(auth.portalUrl).toBe(NATIONAL_PORTAL_INFO.portalUrl);
    expect(auth.fee).toContain('Nil');
  });

  it('resolves state-specific competent authorities', () => {
    const tnAuth = resolveTransgenderAuthority('tamil_nadu');
    expect(tnAuth.competentOfficer).toContain('Tamil Nadu');
    expect(tnAuth.turnaroundDays).toBe(30);

    const mhAuth = resolveTransgenderAuthority('maharashtra');
    expect(mhAuth.competentOfficer).toContain('Maharashtra');
  });

  it('evaluates application applicability as a voluntary statutory right', () => {
    const app = evaluateApplicationApplicability('national');
    expect(app.isVoluntaryRight).toBe(true);
    expect(app.legalReference).toContain('Section 4 & 5');
    expect(app.ruleSummary).toContain('self-perceived gender identity');
  });

  it('returns stage checklist with step-by-step statutory details', () => {
    const checklist = getApplicationStageChecklist('national');
    expect(checklist.items.length).toBeGreaterThanOrEqual(4);
    expect(checklist.estimatedTimeline).toContain('30 statutory days');
    expect(checklist.items[0].title).toContain('Register on the National Portal');
    expect(checklist.items[1].mandatory).toBe(true);
  });

  it('resolves Section 6 & 7 correction and affirmation routes', () => {
    const corr = getCorrectionRoutes('national');
    expect(corr.title).toContain('Sections 6 & 7');
    expect(corr.steps.length).toBeGreaterThanOrEqual(3);

    const postMedicalStep = corr.steps.find((s) => s.id === 'corr-nat-2');
    expect(postMedicalStep).toBeDefined();
    expect(postMedicalStep.documents).toContain('Certificate in Form 3 from the Medical Superintendent or Chief Medical Officer of the medical institution');
  });

  it('resolves Rule 11 statutory appeal routes', () => {
    const appeals = getAppealRoutes('national');
    expect(appeals.steps.length).toBeGreaterThanOrEqual(3);
    expect(appeals.steps[1].title).toContain('Statutory First Appeal');
  });

  it('filters support resources by state and category', () => {
    const allNational = filterSupportResources('national', 'all');
    expect(allNational.length).toBeGreaterThan(0);

    const helplines = filterSupportResources('national', 'Helpline');
    expect(helplines.length).toBeGreaterThan(0);
    expect(helplines.every((h) => h.type.includes('Helpline'))).toBe(true);

    const tnResources = filterSupportResources('tamil_nadu', 'all');
    expect(tnResources.some((r) => r.name.includes('Sahodari Foundation'))).toBe(true);
  });

  it('checks data staleness properly', () => {
    expect(isDataStale(null)).toBe(false);
    expect(isDataStale('2026-11-20', 180)).toBe(false);
    expect(isDataStale('2020-01-01', 180)).toBe(true);
  });

  it('loads all supported states and welfare schemes without undefined records', () => {
    const states = getAllSupportedStates();
    expect(states).toContain('national');
    expect(states).toContain('delhi');
    expect(states).toContain('maharashtra');
    expect(states).toContain('tamil_nadu');
    expect(states).toContain('karnataka');
    expect(states).toContain('kerala');
    expect(states).toContain('west_bengal');

    const schemes = getAllWelfareSchemes();
    expect(schemes.length).toBeGreaterThanOrEqual(4);
    const smile = schemes.find((s) => s.id === 'central-smile');
    expect(smile).toBeDefined();
    expect(smile.benefits.length).toBeGreaterThan(0);
  });
});
