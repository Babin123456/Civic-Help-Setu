import { describe, it, expect, beforeEach } from 'vitest';
import { CivicServiceUncertaintyNavigatorService } from './civicServiceUncertaintyNavigatorService.js';

describe('CivicServiceUncertaintyNavigatorService', () => {
  let navigator;

  beforeEach(() => {
    navigator = new CivicServiceUncertaintyNavigatorService();
  });

  it('routes ambiguous single-phrase requests to clarifying questions', () => {
    const result = navigator.navigate('apply certificate');
    expect(result.status).toBe('AMBIGUOUS_INPUT');
    expect(result.uncertainty.isUncertain).toBe(true);
    expect(result.clarificationNeeded.questions.length).toBeGreaterThan(0);
    expect(result.escalation.canEscalateToHuman).toBe(true);
  });

  it('produces confident guidance when jurisdiction and intent match authoritative records', () => {
    const result = navigator.navigate('how to apply for birth certificate in bangalore ejanma');
    expect(result.status).toBe('CONFIDENT_GUIDANCE');
    expect(result.uncertainty.isUncertain).toBe(false);
    expect(result.recommendedService.serviceId).toBe('srv_birth_cert_ka');
    expect(result.recommendedService.officialPortalUrl).toContain('ejanma');
  });

  it('explicitly returns UNCERTAIN_ROUTING for unknown or mismatched requests', () => {
    const result = navigator.navigate('register rare spaceship permit in antarctica');
    expect(result.status).toBe('UNCERTAIN_ROUTING');
    expect(result.uncertainty.isUncertain).toBe(true);
    expect(result.escalation.canEscalateToHuman).toBe(true);
  });
});
