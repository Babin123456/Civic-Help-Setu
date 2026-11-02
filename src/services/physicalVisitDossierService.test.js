import { describe, it, expect } from 'vitest';
import {
  OFFICE_TYPES,
  inferOfficeType,
  generatePhysicalVisitDossier,
  formatDossierPrintableText,
} from './physicalVisitDossierService.js';

describe('physicalVisitDossierService (#434)', () => {
  describe('inferOfficeType', () => {
    it('infers RTO for transport and license offices', () => {
      expect(inferOfficeType({ name: 'RTO Office Indiranagar' })).toBe(OFFICE_TYPES.RTO);
      expect(inferOfficeType({ name: 'Regional Transport Authority' })).toBe(OFFICE_TYPES.RTO);
    });

    it('infers PASSPORT for PSK centers', () => {
      expect(inferOfficeType({ name: 'Passport Seva Kendra Marathahalli' })).toBe(OFFICE_TYPES.PASSPORT);
    });

    it('infers TEHSILDAR for revenue and taluk offices', () => {
      expect(inferOfficeType({ name: 'Taluk Office South Bengaluru' })).toBe(OFFICE_TYPES.TEHSILDAR);
      expect(inferOfficeType({ name: 'Tehsildar & Sub-Divisional Magistrate' })).toBe(OFFICE_TYPES.TEHSILDAR);
    });

    it('infers CSC_AADHAAR for facilitation and Aadhaar centers', () => {
      expect(inferOfficeType({ name: 'Aadhaar Seva Kendra Jayanagar' })).toBe(OFFICE_TYPES.CSC_AADHAAR);
      expect(inferOfficeType({ name: 'Bangalore One Civic Centre' })).toBe(OFFICE_TYPES.CSC_AADHAAR);
    });
  });

  describe('generatePhysicalVisitDossier', () => {
    it('generates customized dossier for PSK with biometric photo note and ARN requirement', () => {
      const office = { id: 'psk-1', name: 'Passport Seva Kendra' };
      const service = { id: 'passport', name: 'Passport Renewal' };
      const dossier = generatePhysicalVisitDossier({ office, service });

      expect(dossier.officeType).toBe(OFFICE_TYPES.PASSPORT);
      expect(dossier.photoSpecifications.required).toBe(false);
      expect(dossier.photoSpecifications.dimensions).toContain('Biometric Live Capture');
      expect(dossier.documentChecklist.some((d) => d.item.includes('ARN Sheet'))).toBe(true);
      expect(dossier.counterTimings.tokenCutoffTime).toContain('Batch-specific');
    });

    it('generates customized dossier for Tehsildar with court fee stamp advice', () => {
      const office = { id: 'teh-1', name: 'Tehsildar Office' };
      const service = { id: 'income-cert', name: 'Income Certificate' };
      const dossier = generatePhysicalVisitDossier({ office, service });

      expect(dossier.officeType).toBe(OFFICE_TYPES.TEHSILDAR);
      expect(dossier.documentChecklist.some((d) => d.item.includes('Court Fee Stamp'))).toBe(true);
      expect(dossier.photoSpecifications.count).toBe(4);
    });

    it('generates customized dossier for Aadhaar Kendra requiring active SIM phone for OTP', () => {
      const office = { id: 'aadhaar-1', name: 'Aadhaar Seva Kendra' };
      const dossier = generatePhysicalVisitDossier({ office });

      expect(dossier.officeType).toBe(OFFICE_TYPES.CSC_AADHAAR);
      expect(dossier.documentChecklist.some((d) => d.item.includes('Active SIM'))).toBe(true);
      expect(dossier.paymentPreparation.tenderAdvice).toContain('UIDAI');
    });

    it('includes stationary essentials like pen, glue stick, and clips', () => {
      const dossier = generatePhysicalVisitDossier({ office: { name: 'General Center' } });
      expect(dossier.stationaryPack.length).toBeGreaterThanOrEqual(3);
      expect(dossier.stationaryPack.some((s) => s.includes('ballpoint pen'))).toBe(true);
    });
  });

  describe('formatDossierPrintableText', () => {
    it('formats a complete plain-text printable checklist', () => {
      const dossier = generatePhysicalVisitDossier({
        office: { name: 'RTO East Bangalore' },
        service: { name: 'Driving Licence Renewal' },
      });
      const text = formatDossierPrintableText(dossier);

      expect(text).toContain('CIVIC HELP SETU — PHYSICAL OFFICE VISIT DOSSIER & CHECKLIST');
      expect(text).toContain('Office: RTO East Bangalore');
      expect(text).toContain('1. DOCUMENT CHECKLIST & PHOTOCOPIES');
      expect(text).toContain('2. PHOTOGRAPH SPECIFICATIONS');
      expect(text).toContain('3. PAYMENT & TENDER PREPARATION');
      expect(text).toContain('4. STATIONARY & FILING PACK');
      expect(text).toContain('CITIZEN SAFETY REMINDER:');
    });

    it('handles null dossier gracefully', () => {
      expect(formatDossierPrintableText(null)).toBe('');
    });
  });
});
