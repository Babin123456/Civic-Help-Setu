import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateVisitPack,
  VISIT_PACKS,
  getPrintableVisitPack,
  exportVisitPackOffline,
} from '../src/data/upVisitPlans.js';
import { UP_SERVICES, UP_SERVICE_CATEGORIES } from '../src/data/upServices.js';
import { UP_OFFICES } from '../src/data/upOffices.js';

describe('UP Visit Planner - Data Layer', () => {
  beforeEach(() => {
    // Reset any state
  });

  describe('generateVisitPack', () => {
    it('generates a visit pack for a valid service and office', () => {
      const pack = generateVisitPack('birth-certificate', 'lucknow-tehsil-sadar');
      expect(pack).toBeDefined();
      expect(pack.serviceId).toBe('birth-certificate');
      expect(pack.serviceName).toBe('Birth Certificate');
      expect(pack.officeId).toBe('lucknow-tehsil-sadar');
      expect(pack.officeName).toBe('Tehsil Sadar & e-District Facilitation Center - Lucknow');
    });

    it('generates a visit pack for income certificate', () => {
      const pack = generateVisitPack('income-certificate', 'lucknow-tehsil-sadar');
      expect(pack).toBeDefined();
      expect(pack.serviceName).toBe('Income Certificate');
      // Should have document requirements
      expect(Object.keys(pack.documentRequirements).length).toBeGreaterThan(0);
    });

    it('generates a visit pack for trade licence', () => {
      const pack = generateVisitPack('business-licence-checklist', 'lucknow-municipal-office');
      expect(pack).toBeDefined();
      expect(pack.serviceName).toBe('Trade Licence');
      expect(pack.officeName).toBe('Lucknow Municipal Corporation - Citizen Facilitation Desk');
    });

    it('generates a visit pack for caste certificate', () => {
      const pack = generateVisitPack('caste-certificate', 'lucknow-tehsil-sadar');
      expect(pack).toBeDefined();
      expect(pack.serviceName).toBe('Caste Certificate');
    });

    it('generates a visit pack for ration card', () => {
      const pack = generateVisitPack('ration-card', 'lucknow-tehsil-sadar');
      expect(pack).toBeDefined();
      expect(pack.serviceName).toBe('Ration Card');
    });

    it('includes uncertainty markers for counters with uncertainty notes', () => {
      const pack = generateVisitPack('birth-certificate', 'lucknow-tehsil-sadar');
      // The Tehsil Sadar office has counters with uncertaintyNotes
      expect(pack.uncertaintyMarkers).toBeDefined();
      // At least one counter should have uncertainty marked
      const uncertainCounters = pack.uncertaintyMarkers.filter((m) => m.markedUncertain);
      expect(uncertainCounters.length).toBeGreaterThan(0);
    });

    it('distinguishes official-instruction vs citizen-observation source types', () => {
      const pack = generateVisitPack('income-certificate', 'lucknow-tehsil-sadar');
      const reqKeys = Object.keys(pack.documentRequirements);
      expect(reqKeys.length).toBeGreaterThan(0);
      // Check that at least some requirements have sourceType distinguished
      const hasSourceTypes = reqKeys.some((key) => pack.documentRequirements[key].sourceType);
      expect(hasSourceTypes).toBe(true);
    });

    it('includes official sources', () => {
      const pack = generateVisitPack('birth-certificate', 'lucknowTehsilSadar');
      expect(pack.officialSources).toBeDefined();
      expect(Array.isArray(pack.officialSources)).toBe(true);
      expect(pack.officialSources.length).toBeGreaterThan(0);
    });

    it('includes counter guidance with opening hours from office data', () => {
      const pack = generateVisitPack('birth-certificate', 'lucknow-tehsil-sadar');
      expect(pack.counterGuidance).toBeDefined();
      if (pack.counterGuidance) {
        expect(pack.counterGuidance.officeOpeningHours).toBeDefined();
        expect(pack.counterGuidance.tokenDistributionStart).toBeDefined();
      }
    });

    it('privacy fields are correctly marked as private-only', () => {
      const pack = generateVisitPack('birth-certificate', 'lucknowTehsilSadar');
      expect(pack.privacy).toBeDefined();
      expect(pack.privacy.visitDate).toBe('User-recorded (private only)');
      expect(pack.privacy.tokenNumber).toBe('User-recorded (optional, private only)');
      expect(pack.privacy.counterVisited).toBe('User-recorded (private only)');
      expect(pack.privacy.outcome).toBe('User-recorded (private only)');
      expect(pack.privacy.deficiencyMemo).toBe('User-recorded (private only)');
      expect(pack.privacy.nextStep).toBe('User-recorded (private only)');
    });
  });

  describe('VISIT_PACKS predefined packs', () => {
    it('has birthCertificate visit pack', () => {
      expect(VISIT_PACKS.birthCertificate).toBeDefined();
      expect(VISIT_PACKS.birthCertificate.serviceName).toBe('Birth Certificate');
    });

    it('has incomeCertificate visit pack', () => {
      expect(VISIT_PACKS.incomeCertificate).toBeDefined();
      expect(VISIT_PACKS.incomeCertificate.serviceName).toBe('Income Certificate');
    });

    it('has casteCertificate visit pack', () => {
      expect(VISIT_PACKS.casteCertificate).toBeDefined();
      expect(VISIT_PACKS.casteCertificate.serviceName).toBe('Caste Certificate');
    });

    it('has tradeLicence visit pack', () => {
      expect(VISIT_PACKS.tradeLicence).toBeDefined();
      expect(VISIT_PACKS.tradeLicence.serviceName).toBe('Trade Licence');
    });

    it('has rationCard visit pack', () => {
      expect(VISIT_PACKS.rationCard).toBeDefined();
      expect(VISIT_PACKS.rationCard.serviceName).toBe('Ration Card');
    });
  });

  describe('getPrintableVisitPack', () => {
    it('generates printable content in English', () => {
      const pack = generateVisitPack('birth-certificate', 'lucknow-tehsil-sadar');
      const printable = getPrintableVisitPack(pack, 'en');
      expect(typeof printable).toBe('string');
      expect(printable.length).toBeGreaterThan(0);
      // Should contain key terms
      expect(printable).toContain('UP Government Office Visit Planner');
      expect(printable).toContain('Birth Certificate');
    });

    it('generates printable content in Hindi', () => {
      const pack = generateVisitPack('birth-certificate', 'lucknow-tehsil-sadar');
      const printable = getPrintableVisitPack(pack, 'hi');
      expect(typeof printable).toBe('string');
      expect(printable.length).toBeGreaterThan(0);
      // Hindi version should have Hindi terms
      expect(printable).toContain('UP सरकारी कार्यालय दौरा तैयारी योजनाकार');
    });

    it('generates printable content in Urdu', () => {
      const pack = generateVisitPack('birth-certificate', 'lucknow-tehsil-sadar');
      const printable = getPrintableVisitPack(pack, 'ur');
      expect(typeof printable).toBe('string');
      expect(printable.length).toBeGreaterThan(0);
    });

    it('defaults to English when language is not supported', () => {
      const pack = generateVisitPack('birth-certificate', 'lucknow-tehsil-sadar');
      const printable = getPrintableVisitPack(pack, 'fr'); // French not supported
      expect(typeof printable).toBe('string');
      // Should default to English content
      expect(printable).toContain('UP Government Office Visit Planner');
    });
  });

  describe('exportVisitPackOffline', () => {
    it('exports visit pack data excluding privacy fields', () => {
      const pack = generateVisitPack('birth-certificate', 'lucknow-tehsil-sadar');
      const exportable = exportVisitPackOffline(pack);
      // The exported object should NOT have the privacy property
      expect(exportable.privacy).toBeUndefined();
      // But should have other fields
      expect(exportable.serviceId).toBeDefined();
      expect(exportable.officeName).toBeDefined();
    });
  });

  describe('UP_SERVICES', () => {
    it('has all expected service categories', () => {
      const serviceIds = UP_SERVICES.map((s) => s.id);
      expect(serviceIds).toContain('birth-certificate');
      expect(serviceIds).toContain('income-certificate');
      expect(serviceIds).toContain('caste-certificate');
      expect(serviceIds).toContain('business-licence-checklist');
      expect(serviceIds).toContain('ration-card');
    });

    it('services have required fields', () => {
      UP_SERVICES.forEach((service) => {
        expect(service.id).toBeDefined();
        expect(service.name).toBeDefined();
        expect(service.category).toBeDefined();
        expect(service.type).toBeDefined();
        expect(service.feeType).toBeDefined();
        expect(service.officialSources).toBeDefined();
        expect(Array.isArray(service.officialSources)).toBe(true);
        expect(service.officialSources.length).toBeGreaterThan(0);
      });
    });
  });

  describe('UP_OFFICES', () => {
    it('has Lucknow tehsil office', () => {
      expect(UP_OFFICES['lucknowTehsilSadar']).toBeDefined();
      expect(UP_OFFICES['lucknowTehsilSadar'].name).toContain('Lucknow');
      expect(UP_OFFICES['lucknowTehsilSadar'].state).toBe('Uttar Pradesh');
      expect(UP_OFFICES['lucknowTehsilSadar'].district).toBe('Lucknow');
    });

    it('has Lucknow municipal office', () => {
      expect(UP_OFFICES['lucknowMunicipalOffice']).toBeDefined();
      expect(UP_OFFICES['lucknowMunicipalOffice'].name).toContain('Municipal');
      expect(UP_OFFICES['lucknowMunicipalOffice'].state).toBe('Uttar Pradesh');
      expect(UP_OFFICES['lucknowMunicipalOffice'].district).toBe('Lucknow');
    });

    it('has Bahraich tehsil office', () => {
      expect(UP_OFFICES['lucknowTehsilBahraich']).toBeDefined();
      expect(UP_OFFICES['lucknowTehsilBahraich'].name).toContain('Bahraich');
      expect(UP_OFFICES['lucknowTehsilBahraich'].state).toBe('Uttar Pradesh');
      expect(UP_OFFICES['lucknowTehsilBahraich'].district).toBe('Lucknow');
    });

    it('offices have audit metadata with verification dates', () => {
      Object.values(UP_OFFICES).forEach((office) => {
        expect(office.auditMetadata).toBeDefined();
        expect(office.auditMetadata.reviewDate).toBeDefined();
        expect(office.auditMetadata.lastVerified).toBeDefined();
      });
    });

    it('offices have language coverage', () => {
      Object.values(UP_OFFICES).forEach((office) => {
        expect(office.languageCoverage).toBeDefined();
        expect(office.languageCoverage.supportedLanguages).toBeDefined();
        expect(Array.isArray(office.languageCoverage.supportedLanguages)).toBe(true);
      });
    });
  });
});