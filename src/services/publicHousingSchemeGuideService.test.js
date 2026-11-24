import { describe, it, expect, beforeEach } from 'vitest';
import { PublicHousingSchemeGuideService } from './publicHousingSchemeGuideService.js';

describe('PublicHousingSchemeGuideService', () => {
  let service;

  beforeEach(() => {
    service = new PublicHousingSchemeGuideService();
  });

  it('separates rural (PMAY-G) and urban (PMAY-U 2.0) programmes', () => {
    const rural = service.getSchemeByDomain('RURAL');
    expect(rural.id).toBe('pmay_gramin');
    expect(rural.financialAssistanceINR.plainAreasINR).toBe(120000);

    const urban = service.getSchemeByDomain('URBAN');
    expect(urban.id).toBe('pmay_urban_2');
    expect(urban.verticals.length).toBeGreaterThanOrEqual(3);
  });

  it('provides lifecycle stages and anti-fraud advisory for rural housing', () => {
    const overview = service.getLifecycleOverview('RURAL');
    expect(overview.stages.length).toBe(5);
    expect(overview.stages[0].name).toContain('Gram Sabha');
    expect(overview.antiFraudAdvisory).toContain('NEVER pay money to middlemen');
    expect(overview.verificationPortal.url).toContain('awaassoft.nic.in');
    expect(overview.requiredDocumentChecklist.length).toBeGreaterThanOrEqual(4);
  });

  it('provides plain-language housing status vocabulary', () => {
    const vocab = service.getStatusVocabulary();
    expect(vocab.length).toBeGreaterThanOrEqual(3);
    const fto = vocab.find(v => v.term.includes('FTO'));
    expect(fto).toBeDefined();
    expect(fto.term).toContain('FTO (Financial Transfer Order)');
  });
});
