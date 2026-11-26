import { describe, it, expect, beforeEach } from 'vitest';
import { GigWorkerWelfareService } from './gigWorkerWelfareService.js';

describe('GigWorkerWelfareService', () => {
  let service;

  beforeEach(() => {
    service = new GigWorkerWelfareService();
  });

  it('separates central and state-specific gig programmes', () => {
    const result = service.getProgrammesByState('IN-RJ');
    expect(result.stateHasOfficialBoard).toBe(true);
    expect(result.stateSchemes.length).toBeGreaterThanOrEqual(1);
    expect(result.stateSchemes[0].title).toContain('Rajasthan');
    expect(result.centralSchemes.length).toBeGreaterThanOrEqual(1);
    expect(result.centralSchemes[0].title).toContain('Code on Social Security');
  });

  it('flags warning when state has no officially notified board', () => {
    const result = service.getProgrammesByState('IN-GA');
    expect(result.stateHasOfficialBoard).toBe(false);
    expect(result.unavailabilityWarning).toContain('No officially notified state-specific gig welfare board');
    expect(result.centralSchemes.length).toBeGreaterThan(0);
  });

  it('clearly distinguishes government statutory schemes from private platform perks', () => {
    const diff = service.distinguishGovernmentVsPlatformBenefits();
    expect(diff.governmentWelfare.portability).toContain('switching between different platform aggregators');
    expect(diff.privatePlatformPerks.portability).toContain('terminates immediately upon account deactivation');
  });

  it('generates a verified application preparation checklist', () => {
    const checklist = service.generatePreparationChecklist('gig_prog_karnataka_free_insurance');
    expect(checklist.title).toContain('Karnataka Gig Worker');
    expect(checklist.requiredDocuments.length).toBeGreaterThanOrEqual(3);
    expect(checklist.portal.url).toContain('sevasindhu');
    expect(checklist.warning).toContain('Never pay unofficial intermediaries');
  });

  it('provides a plain-language glossary', () => {
    const glossary = service.getGlossary();
    expect(glossary.length).toBeGreaterThanOrEqual(3);
    const cess = glossary.find(g => g.term === 'Aggregator Cess');
    expect(cess).toBeDefined();
    expect(cess.definition).toContain('statutory contribution');
  });
});
