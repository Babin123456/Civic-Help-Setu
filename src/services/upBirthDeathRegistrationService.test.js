import { describe, it, expect } from 'vitest';
import {
  determineDelayedRegistrationTier,
  getCorrectionRequirements,
  exportDelayedRegistrationAffidavit,
  UP_REGISTRATION_AUTHORITIES,
  DELAYED_REGISTRATION_TIERS
} from './upBirthDeathRegistrationService';

describe('upBirthDeathRegistrationService', () => {
  it('should list official authorities and tiers in UP', () => {
    expect(UP_REGISTRATION_AUTHORITIES.RURAL.registrar).toContain('Gram Vikas Adhikari');
    expect(UP_REGISTRATION_AUTHORITIES.URBAN.higherAuthority).toContain('Municipal Commissioner');
    expect(DELAYED_REGISTRATION_TIERS.ON_TIME.statutoryFeeINR).toBe(0);
    expect(DELAYED_REGISTRATION_TIERS.DELAYED_OVER_1_YEAR.requiresMagistrateOrder).toBeUndefined(); // internal constant check
  });

  it('should identify on-time registration within 21 days', () => {
    const eventDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
    const res = determineDelayedRegistrationTier(eventDate);

    expect(res.isCalculable).toBe(true);
    expect(res.tier).toBe('ON_TIME');
    expect(res.statutoryFeeINR).toBe(0);
    expect(res.requiresMagistrateOrder).toBe(false);
    expect(res.requiresNonAvailabilityCertificate).toBe(false);
  });

  it('should identify tier 1 delay (21-30 days)', () => {
    const eventDate = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(); // 25 days ago
    const res = determineDelayedRegistrationTier(eventDate);

    expect(res.tier).toBe('DELAYED_21_TO_30_DAYS');
    expect(res.statutoryFeeINR).toBe(2);
    expect(res.requiresMagistrateOrder).toBe(false);
  });

  it('should identify tier 2 delay (30-365 days) requiring SDM permission and NAC', () => {
    const eventDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(); // 120 days ago
    const res = determineDelayedRegistrationTier(eventDate);

    expect(res.tier).toBe('DELAYED_30_TO_365_DAYS');
    expect(res.statutoryFeeINR).toBe(5);
    expect(res.authority).toContain('Sub-Divisional Magistrate');
    expect(res.requiresNonAvailabilityCertificate).toBe(true);
  });

  it('should identify tier 3 delay (>1 year) requiring Magistrate Court Order', () => {
    const eventDate = new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString(); // 500 days ago
    const res = determineDelayedRegistrationTier(eventDate);

    expect(res.tier).toBe('DELAYED_OVER_1_YEAR');
    expect(res.requiresMagistrateOrder).toBe(true);
    expect(res.requiresNonAvailabilityCertificate).toBe(true);
    expect(res.statutoryFeeINR).toBe(10);
  });

  it('should provide correction procedures for typographical errors under Section 15', () => {
    const corr = getCorrectionRequirements('CLERICAL_OR_TYPOGRAPHICAL');
    expect(corr.code).toBe('CLERICAL_OR_TYPOGRAPHICAL');
    expect(corr.rule).toContain('Section 15');
    expect(corr.approvingAuthority).toContain('Local Registrar');
    expect(corr.procedureNote).toContain('marginal entry');
  });

  it('should generate printable magistrate affidavit draft for delayed entry', () => {
    const details = {
      tehsil: 'Koil',
      district: 'Aligarh',
      deponentName: 'Rameshwar Dayal',
      deponentAge: 42,
      eventType: 'BIRTH',
      subjectName: 'Aarav Kumar',
      relationName: 'Suresh Kumar',
      eventDate: '15/04/2024',
      eventPlace: 'Village Jalali',
      delayReason: 'Lack of legal awareness and village distance'
    };

    const draft = exportDelayedRegistrationAffidavit(details);
    expect(draft).toContain('Section 13(3) of RBD Act, 1969');
    expect(draft).toContain('Aligarh');
    expect(draft).toContain('Rameshwar Dayal');
    expect(draft).toContain('Non-Availability Certificate (Form 10)');
    expect(draft).toContain('Aarav Kumar');
  });

  it('should retrieve RBD FAQs and evidence checklists for home events', async () => {
    const { getRbdFaqs, getRbdEvidenceChecklist } = await import('./upBirthDeathRegistrationService');
    const faqs = getRbdFaqs();
    expect(faqs.length).toBeGreaterThanOrEqual(4);
    expect(faqs[0].q).toContain('private nursing home');
    expect(faqs[2].a).toContain('30 working days');

    const birthChecklist = getRbdEvidenceChecklist('HOME_BIRTH');
    expect(birthChecklist.some(c => c.includes('Vaccination'))).toBe(true);

    const deathChecklist = getRbdEvidenceChecklist('HOME_DEATH');
    expect(deathChecklist.some(c => c.includes('Form 4A'))).toBe(true);
  });

  it('should return error when invalid date is provided', () => {
    const res = determineDelayedRegistrationTier('INVALID_DATE');
    expect(res.isCalculable).toBe(false);
    expect(res.error).toBeDefined();
  });
});
