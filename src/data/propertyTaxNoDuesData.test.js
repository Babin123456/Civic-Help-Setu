import { describe, it, expect } from 'vitest';
import {
  JURISDICTION_PROPERTY_TAX_DATA,
  JURISDICTION_HIERARCHY,
  PROPERTY_TAX_CORE_DEFINITIONS,
  WHY_CITIZENS_NEED_CERTIFICATE,
  ORDERED_JOURNEY_STAGES,
  INFORMATIONAL_TRACKING_FIELDS,
  PROPERTY_TAX_FAQS,
  STATUTORY_CAVEATS_AND_WARNINGS,
  getJurisdictionById,
  getAvailableDistrictsForState,
  getAvailableUlbsForDistrict
} from './propertyTaxNoDuesData';

describe('propertyTaxNoDuesData dataset and helper functions (#531)', () => {
  describe('Jurisdiction Hierarchy and Retrieval', () => {
    it('retrieves valid jurisdiction record by id', () => {
      const delhi = getJurisdictionById('delhi-mcd');
      expect(delhi).toBeDefined();
      expect(delhi.state).toBe('Delhi');
      expect(delhi.ulb).toContain('Municipal Corporation of Delhi');
      expect(delhi.verificationStatus).toBe('verified');
      expect(delhi.officialPortal.url).toBe('https://mcdonline.nic.in');
    });

    it('retrieves Bengaluru BBMP jurisdiction record', () => {
      const bbmp = getJurisdictionById('bengaluru-bbmp');
      expect(bbmp).toBeDefined();
      expect(bbmp.state).toBe('Karnataka');
      expect(bbmp.ulb).toContain('Bruhat Bengaluru Mahanagara Palike');
      expect(bbmp.verificationStatus).toBe('verified');
    });

    it('retrieves Mumbai BMC jurisdiction record', () => {
      const bmc = getJurisdictionById('mumbai-bmc');
      expect(bmc).toBeDefined();
      expect(bmc.state).toBe('Maharashtra');
      expect(bmc.ulb).toContain('Brihanmumbai Municipal Corporation');
      expect(bmc.verificationStatus).toBe('verified');
    });

    it('falls back gracefully to unverified fallback for unknown jurisdiction id or empty string', () => {
      const fallback = getJurisdictionById('unknown-random-id');
      expect(fallback).toBeDefined();
      expect(fallback.id).toBe('unverified-fallback');
      expect(fallback.verificationStatus).toBe('unavailable');
      expect(fallback.officialPortal.url).toBeNull();
      expect(fallback.eligibility[0]).toBe('Official information for this jurisdiction has not yet been verified.');
      expect(fallback.paymentInformation.officialFee).toBe('Not specified by the linked official source.');

      const nullFallback = getJurisdictionById(null);
      expect(nullFallback.id).toBe('unverified-fallback');
    });

    it('returns districts for known states and empty array for unknown states', () => {
      expect(JURISDICTION_HIERARCHY.Delhi).toBeDefined();
      const maharashtraDistricts = getAvailableDistrictsForState('Maharashtra');
      expect(maharashtraDistricts).toContain('Mumbai City & Mumbai Suburban');
      expect(maharashtraDistricts).toContain('Pune');

      const unknownDistricts = getAvailableDistrictsForState('Atlantis');
      expect(unknownDistricts).toEqual([]);

      const nullDistricts = getAvailableDistrictsForState(null);
      expect(nullDistricts).toEqual([]);
    });

    it('returns ULBs for known district and empty array for unknown district', () => {
      const bengaluruUlbs = getAvailableUlbsForDistrict('Karnataka', 'Bengaluru Urban');
      expect(bengaluruUlbs.length).toBeGreaterThan(0);
      expect(bengaluruUlbs[0].id).toBe('bengaluru-bbmp');

      const emptyUlbs = getAvailableUlbsForDistrict('Karnataka', 'Unknown District');
      expect(emptyUlbs).toEqual([]);

      const nullUlbs = getAvailableUlbsForDistrict(null, null);
      expect(nullUlbs).toEqual([]);
    });
  });

  describe('Official Sources and Verification Metadata', () => {
    it('ensures every verified ULB has valid official sources and metadata', () => {
      const verifiedUlbs = JURISDICTION_PROPERTY_TAX_DATA.filter((j) => j.verificationStatus === 'verified');
      expect(verifiedUlbs.length).toBeGreaterThanOrEqual(7);

      verifiedUlbs.forEach((ulb) => {
        expect(ulb.sources.length).toBeGreaterThan(0);
        ulb.sources.forEach((src) => {
          expect(src.title).toBeTruthy();
          expect(src.department).toBeTruthy();
          expect(src.url).toMatch(/^https:\/\//);
          expect(src.lastVerified).toBeTruthy();
        });
        expect(ulb.officialPortal.url).toMatch(/^https:\/\//);
        expect(ulb.officialPortal.label).toBeTruthy();
      });
    });

    it('verifies that unverified fallback has unavailable status and does not invent URLs', () => {
      const fallback = JURISDICTION_PROPERTY_TAX_DATA.find((j) => j.id === 'unverified-fallback');
      expect(fallback.verificationStatus).toBe('unavailable');
      expect(fallback.officialPortal.url).toBeNull();
      expect(fallback.sources).toHaveLength(0);
      expect(fallback.certificateInformation.validity).toBe('Not specified by the linked official source.');
    });
  });

  describe('Document Distinction: Receipt vs No-Dues Certificate', () => {
    it('defines clear distinction between receipt and No-Dues Certificate', () => {
      const receiptDef = PROPERTY_TAX_CORE_DEFINITIONS.find((d) => d.id === 'def-payment-receipt');
      const noDuesDef = PROPERTY_TAX_CORE_DEFINITIONS.find((d) => d.id === 'def-no-dues-cert');
      const vsDef = PROPERTY_TAX_CORE_DEFINITIONS.find((d) => d.id === 'def-receipt-vs-nodues');
      const titleDef = PROPERTY_TAX_CORE_DEFINITIONS.find((d) => d.id === 'def-title-disclaimer');

      expect(receiptDef).toBeDefined();
      expect(noDuesDef).toBeDefined();
      expect(vsDef).toBeDefined();
      expect(titleDef).toBeDefined();

      expect(vsDef.title).toContain('NOT Interchangeable');
      expect(titleDef.title).toContain('Ownership & Legal Title');
    });

    it('reiterates in statutory caveats that receipt does not prove legal title', () => {
      expect(WHY_CITIZENS_NEED_CERTIFICATE.length).toBeGreaterThanOrEqual(5);
      const titleCaveat = STATUTORY_CAVEATS_AND_WARNINGS.find((c) => c.id === 'warn-no-title');
      expect(titleCaveat).toBeDefined();
      expect(titleCaveat.description).toContain('NOT confer legal ownership, title, or proprietary right');
    });
  });

  describe('Document Checklist and Journey Stages', () => {
    it('contains structured 10-step application journey', () => {
      expect(ORDERED_JOURNEY_STAGES).toHaveLength(10);
      expect(ORDERED_JOURNEY_STAGES[0].step).toBe(1);
      expect(ORDERED_JOURNEY_STAGES[9].step).toBe(10);
    });

    it('has mandatory and conditional documents in verified jurisdictions', () => {
      const delhi = getJurisdictionById('delhi-mcd');
      expect(delhi.requiredDocuments.length).toBeGreaterThan(0);
      expect(delhi.optionalDocuments.length).toBeGreaterThan(0);

      delhi.requiredDocuments.forEach((doc) => {
        expect(doc.category).toBe('required');
        expect(doc.whyNeeded).toBeTruthy();
        expect(doc.officialSource).toBeTruthy();
      });

      delhi.optionalDocuments.forEach((doc) => {
        expect(doc.category).toBe('conditional');
        expect(doc.whyNeeded).toBeTruthy();
        expect(doc.officialSource).toBeTruthy();
      });
    });
  });

  describe('Informational Tracking and Privacy', () => {
    it('separates payment date, receipt date, application date, and certificate issue date', () => {
      const keys = INFORMATIONAL_TRACKING_FIELDS.map((f) => f.key);
      expect(keys).toContain('propertyId');
      expect(keys).toContain('assessmentYear');
      expect(keys).toContain('taxDueDate');
      expect(keys).toContain('outstandingPrincipal');
      expect(keys).toContain('arrears');
      expect(keys).toContain('penaltyInterest');
      expect(keys).toContain('paymentDate');
      expect(keys).toContain('paymentReference');
      expect(keys).toContain('paymentReceiptDate');
      expect(keys).toContain('submissionDate');
      expect(keys).toContain('acknowledgementDate');
      expect(keys).toContain('appointmentDate');
      expect(keys).toContain('verificationDate');
      expect(keys).toContain('certificateIssueDate');
      expect(keys).toContain('certificateValidityDate');
    });

    it('has informative FAQs covering receipt delays and ownership myths', () => {
      expect(PROPERTY_TAX_FAQS.length).toBeGreaterThanOrEqual(5);
      const debitedFaq = PROPERTY_TAX_FAQS.find((f) => f.question.includes('bank account was debited'));
      expect(debitedFaq).toBeDefined();
      expect(debitedFaq.answer).toContain('24 to 48 hours');
    });
  });
});
