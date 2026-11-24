import { describe, it, expect, beforeEach } from 'vitest';
import { PropertyTaxDisputeGuideService } from './propertyTaxDisputeGuideService.js';

describe('PropertyTaxDisputeGuideService', () => {
  let service;

  beforeEach(() => {
    service = new PropertyTaxDisputeGuideService();
  });

  it('retrieves local body rules and early-bird rebates for BBMP Bengaluru', () => {
    const rules = service.getMunicipalTaxRules('IN-KA-BLR');
    expect(rules.isVerifiedLocalBodyFound).toBe(true);
    expect(rules.municipality).toContain('BBMP');
    expect(rules.rebates.length).toBeGreaterThanOrEqual(1);
    expect(rules.rebates[0].discountPercentage).toBe(5);
    expect(rules.exemptions.length).toBeGreaterThanOrEqual(2);
    expect(rules.portalUrl).toContain('bbmptax.karnataka.gov.in');
  });

  it('warns when local body is not indexed and falls back gracefully', () => {
    const fallback = service.getMunicipalTaxRules('IN-UNKNOWN-CORP');
    expect(fallback.isVerifiedLocalBodyFound).toBe(false);
    expect(fallback.message).toContain('No verified property tax rules indexed');
  });

  it('generates an assessment dispute checklist with prerequisite documents and retention advice', () => {
    const checklist = service.generateAssessmentDisputeChecklist('IN-DL-MCD');
    expect(checklist.title).toContain('MCD');
    expect(checklist.disputeFilingWindow).toContain('30 calendar days');
    expect(checklist.prerequisiteDocuments.length).toBeGreaterThanOrEqual(4);
    expect(checklist.escalationSteps.length).toBe(4);
    expect(checklist.receiptRetentionGuidance).toContain('Retain downloaded digitally signed payment receipts');
  });

  it('provides a plain-language property tax glossary', () => {
    const glossary = service.getGlossary();
    expect(glossary.length).toBeGreaterThanOrEqual(3);
    const sas = glossary.find(g => g.term.includes('SAS'));
    expect(sas).toBeDefined();
    expect(sas.term).toContain('SAS / Self-Assessment Scheme');
  });
});
