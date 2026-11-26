import { describe, it, expect } from 'vitest';
import {
  evaluateAgriEvidenceReadiness,
  exportAgriAdulterationPetition,
  AGRI_INPUT_CATEGORIES,
  UP_AGRI_ESCALATION_OFFICERS,
  MANDATORY_EVIDENCE_ITEMS
} from './upAgriAdulterationService';

describe('upAgriAdulterationService', () => {
  it('should define statutory agri-input categories, officers, and evidence items', () => {
    expect(AGRI_INPUT_CATEGORIES.SEEDS.code).toBe('SEEDS');
    expect(AGRI_INPUT_CATEGORIES.FERTILIZERS.governingAct).toContain('Fertilizer (Inorganic, Organic or Mixed)');
    expect(UP_AGRI_ESCALATION_OFFICERS.length).toBe(4);
    expect(UP_AGRI_ESCALATION_OFFICERS[1].designation).toContain('District Agriculture Officer');
    expect(MANDATORY_EVIDENCE_ITEMS.length).toBe(5);
  });

  it('should assess strong evidence pack when cash memo and original packaging are present', () => {
    const evidenceData = {
      PURCHASE_CASH_MEMO: true,
      ORIGINAL_PACKAGING: true,
      LEFTOVER_SAMPLE: true,
      FIELD_PHOTOGRAPHS: true,
      REVENUE_LAND_HOLDING_RECORD: false
    };

    const res = evaluateAgriEvidenceReadiness(evidenceData);
    expect(res.isStatutorilyStrong).toBe(true);
    expect(res.completenessScore).toBe(80);
    expect(res.readinessStatus).toBe('READY_FOR_OFFICIAL_FILING');
    expect(res.missingEvidenceItems).toContain('Certified Khatauni extract proving land ownership and acreage sown');
    expect(res.criticalWarning).toContain('Evidence satisfies prima facie threshold');
  });

  it('should flag critical warning when cash memo is missing', () => {
    const evidenceData = {
      PURCHASE_CASH_MEMO: false,
      ORIGINAL_PACKAGING: true
    };

    const res = evaluateAgriEvidenceReadiness(evidenceData);
    expect(res.isStatutorilyStrong).toBe(false);
    expect(res.readinessStatus).toBe('INCOMPLETE_DOCUMENTARY_PROOF');
    expect(res.criticalWarning).toContain('Missing formal purchase invoice');
  });

  it('should flag critical warning when original packaging is missing', () => {
    const evidenceData = {
      PURCHASE_CASH_MEMO: true,
      ORIGINAL_PACKAGING: false
    };

    const res = evaluateAgriEvidenceReadiness(evidenceData);
    expect(res.isStatutorilyStrong).toBe(false);
    expect(res.criticalWarning).toContain('Batch and Lot number from the original container');
  });

  it('should export formatted legal petition for District Agriculture Officer', () => {
    const complaint = {
      categoryCode: 'FERTILIZERS',
      district: 'Bareilly',
      dealerName: 'Kisan Krishi Seva Kendra',
      dealerLocation: 'Nawabganj Mandi',
      dealerGstin: '09AAACK1234F1Z5',
      batchNumber: 'DAP-UP-2026-88',
      lotNumber: 'LOT-9921',
      acreageDamaged: '3.0',
      observedFailureDescription: 'Granules failed to dissolve in water and crop seedlings burnt upon application.',
      estimatedDamageINR: 45000
    };

    const evidenceEval = {
      completenessScore: 80,
      readinessStatus: 'READY_FOR_OFFICIAL_FILING',
      missingEvidenceItems: []
    };

    const petition = exportAgriAdulterationPetition(complaint, evidenceEval);
    expect(petition).toContain('# Statutory Complaint & Evidence Dossier: Spurious / Adulterated Agri-Input');
    expect(petition).toContain('Bareilly');
    expect(petition).toContain('Kisan Krishi Seva Kendra');
    expect(petition).toContain('GST-UP-****-F1Z5');
    expect(petition).toContain('DAP-UP-2026-88');
    expect(petition).toContain('Stop-Sale Order (Vikray Pratibandh)');
    expect(petition).toContain('District Consumer Disputes Redressal Commission');
  });

  it('should retrieve agri input FAQs and simple home testing methods', async () => {
    const { getAgriInputFaqs, getSimpleHomeTestingMethods } = await import('./upAgriAdulterationService');
    const faqs = getAgriInputFaqs();
    expect(faqs.length).toBeGreaterThanOrEqual(4);
    expect(faqs[0].a).toContain('mandatory for every transaction');
    expect(faqs[1].a).toContain('Genuine DAP swells');

    const tests = getSimpleHomeTestingMethods();
    expect(tests.length).toBeGreaterThanOrEqual(4);
    expect(tests.some(t => t.input === 'Urea')).toBe(true);
    expect(tests.some(t => t.input === 'DAP')).toBe(true);
  });

  it('should retrieve accredited testing laboratories and farmer support contacts', async () => {
    const { getAgriTestingLaboratories, getFarmerSupportContacts } = await import('./upAgriAdulterationService');
    const labs = getAgriTestingLaboratories();
    expect(labs.length).toBeGreaterThanOrEqual(4);
    expect(labs.some(l => l.name.includes('State Seed Testing Laboratory'))).toBe(true);

    const contacts = getFarmerSupportContacts();
    expect(contacts.length).toBeGreaterThanOrEqual(3);
    expect(contacts.some(c => c.number === '1800-180-1551')).toBe(true);
  });

  it('should validate dealer gstin masking', () => {
    const complaint = {
      dealerGstin: '09AAACK9876F1Z2'
    };
    const petition = exportAgriAdulterationPetition(complaint, { completenessScore: 100 });
    expect(petition).toContain('GST-UP-****-F1Z2');
  });

  it('should handle unlisted category fallback', () => {
    const petition = exportAgriAdulterationPetition({ categoryCode: 'UNKNOWN' }, {});
    expect(petition).toContain('Chemical & Bio Fertilizers');
  });
});
