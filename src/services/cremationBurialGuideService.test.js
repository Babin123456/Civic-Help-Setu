import { describe, it, expect, beforeEach } from 'vitest';
import { CremationBurialGuideService } from './cremationBurialGuideService.js';

describe('CremationBurialGuideService', () => {
  let service;

  beforeEach(() => {
    service = new CremationBurialGuideService();
  });

  it('searches verified cremation facilities by jurisdiction and query', () => {
    const results = service.searchFacilities('IN-KA-BLR', 'Harishchandra');
    expect(results.length).toBe(1);
    expect(results[0].facilityName).toContain('Harishchandra Ghat');
    expect(results[0].publishedFeeINR).toBe(250);
    expect(results[0].accessibility.stepFreeHearseAccess).toBe(true);
  });

  it('generates a compassionate bereavement guide with official fees and death registration steps', () => {
    const guide = service.generateBereavementAssistanceGuide('fac_dl_nigambodh_ghat');
    expect(guide.facilityName).toContain('Nigambodh Ghat');
    expect(guide.publishedChargeINR).toBe(500);
    expect(guide.chargePolicy).toContain('BPL');
    expect(guide.subsequentDeathRegistrationSteps.length).toBe(3);
    expect(guide.subsequentDeathRegistrationSteps[1]).toContain('21 statutory days');
    expect(guide.respectfulNotice).toContain('deepest respect');
  });

  it('retrieves mandatory bereavement documentation requirements', () => {
    const docs = service.getMandatoryDocuments();
    expect(docs.length).toBe(3);
    const mccd = docs.find(d => d.documentName.includes('MCCD'));
    expect(mccd).toBeDefined();
    expect(mccd.importance).toContain('Mandatory before any crematorium');
  });
});
