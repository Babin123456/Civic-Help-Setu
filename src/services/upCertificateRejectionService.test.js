import { describe, it, expect } from 'vitest';
import {
  explainCertificateRejection,
  generateCertificateAppealDraft,
  getCertificateDocumentChecklist,
  UP_EDISTRICT_SERVICES,
  COMMON_REJECTION_REASONS
} from './upCertificateRejectionService';

describe('upCertificateRejectionService', () => {
  it('should list official UP e-District services and rejection rules', () => {
    expect(UP_EDISTRICT_SERVICES.CASTE_CERTIFICATE.code).toBe('CASTE_CERTIFICATE');
    expect(UP_EDISTRICT_SERVICES.INCOME_CERTIFICATE.statutoryDeliveryDays).toBe(15);
    expect(COMMON_REJECTION_REASONS.length).toBeGreaterThanOrEqual(5);
  });

  it('should diagnose paternal lineage proof missing in caste certificate applications', () => {
    const rawRemark = 'Lekhpal aakhiya: pita ke paksh ka praman nahi lagaya gaya hai. Aavedan asvikrit.';
    const diagnosis = explainCertificateRejection('CASTE_CERTIFICATE', rawRemark);

    expect(diagnosis.identifiedCode).toBe('PATERNAL_LINEAGE_PROOF_MISSING');
    expect(diagnosis.plainLanguageReason).toContain('paternal lineage');
    expect(diagnosis.remedySteps.length).toBeGreaterThan(0);
    expect(diagnosis.remedySteps[0]).toContain('paternal grandfather');
    expect(diagnosis.appealPathway.firstAppellateAuthority).toBe('Sub-Divisional Magistrate (SDM)');
  });

  it('should diagnose land revenue record (Khatauni) mismatches in income certificates', () => {
    const rawRemark = 'Khatauni mismatch found during inquiry. Land ownership details incorrect.';
    const diagnosis = explainCertificateRejection('INCOME_CERTIFICATE', rawRemark);

    expect(diagnosis.identifiedCode).toBe('LAND_REVENUE_RECORD_MISMATCH');
    expect(diagnosis.remedySteps.some(r => r.includes('Khatauni'))).toBe(true);
  });

  it('should diagnose absence during field inquiry for domicile certificates', () => {
    const rawRemark = 'Mauke par upastithi nahi payee gayi. Mool niwasi praman asambhav.';
    const diagnosis = explainCertificateRejection('DOMICILE_CERTIFICATE', rawRemark);

    expect(diagnosis.identifiedCode).toBe('NON_RESIDENCE_OR_TEMPORARY_STAY');
    expect(diagnosis.plainLanguageReason).toContain('physically residing');
    expect(diagnosis.appealPathway.statutoryDeliveryDays).toBe(20);
  });

  it('should provide sensible fallback for uncatalogued rejection text', () => {
    const rawRemark = 'Aavedan patra me truti hone ke karan nirasth.';
    const diagnosis = explainCertificateRejection('INCOME_CERTIFICATE', rawRemark);

    expect(diagnosis.identifiedCode).toBe('GENERAL_DOCUMENTARY_DEFICIENCY');
    expect(diagnosis.remedySteps[0]).toContain('Lekhpal Record Room');
  });

  it('should generate a formal statutory first appeal memorandum draft', () => {
    const details = {
      serviceName: 'Caste Certificate (Jati Praman Patra)',
      tehsil: 'Sadar',
      district: 'Gorakhpur',
      maskedApplicationNumber: 'EDIST-UP-****-4321',
      rawRemarkText: 'Pita ke paksh ka praman nahi',
      appellantClarification: 'Paternal uncle transfer certificate attached with pedigree affidavit.',
      remedySteps: ['Attached paternal lineage pedigree signed by Gram Pradhan.'],
      applicantName: 'Applicant S***'
    };

    const draft = generateCertificateAppealDraft(details);
    expect(draft).toContain('UP Janhit Guarantee Adhiniyam, 2011');
    expect(draft).toContain('Gorakhpur');
    expect(draft).toContain('EDIST-UP-****-4321');
    expect(draft).toContain('Paternal uncle transfer certificate attached');
    expect(draft).toContain('Sub-Divisional Magistrate (SDM)');
  });

  it('should retrieve standard document checklists for Caste, Income, and Domicile', () => {
    const casteDocs = getCertificateDocumentChecklist('CASTE');
    expect(casteDocs.length).toBeGreaterThanOrEqual(4);
    expect(casteDocs.some(d => d.includes('Paternal lineage proof'))).toBe(true);

    const incomeDocs = getCertificateDocumentChecklist('INCOME');
    expect(incomeDocs.some(d => d.includes('Khatauni'))).toBe(true);

    const domicileDocs = getCertificateDocumentChecklist('DOMICILE');
    expect(domicileDocs.some(d => d.includes('3+ years residence'))).toBe(true);
  });

  it('should return UP certificate FAQs', async () => {
    const { getCertificateFaqs } = await import('./upCertificateRejectionService');
    const faqs = getCertificateFaqs();
    expect(faqs.length).toBeGreaterThanOrEqual(4);
    expect(faqs[0].q).toContain('married woman');
    expect(faqs[1].a).toContain('3 years');
  });
});
