import { describe, it, expect } from 'vitest';
import {
  ESSENTIAL_CIVIC_CREDENTIALS,
  assessCivicReadiness,
} from './civicEntitlementReadinessService';

describe('civicEntitlementReadinessService', () => {
  it('defines 6 essential civic credentials with assigned weights', () => {
    expect(ESSENTIAL_CIVIC_CREDENTIALS.length).toBe(6);
    const sum = ESSENTIAL_CIVIC_CREDENTIALS.reduce((acc, c) => acc + c.weight, 0);
    expect(sum).toBe(100);
  });

  it('calculates initial score and missing items when vault is empty', () => {
    const result = assessCivicReadiness({}, []);
    expect(result.overallScore).toBe(0);
    expect(result.tier).toBe('INITIAL');
    expect(result.verifiedCount).toBe(0);
    expect(result.missingCount).toBe(6);
    expect(result.missingCredentials.length).toBe(6);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('calculates scheme-ready score when core documents are present', () => {
    const docs = [
      { name: 'My Aadhaar Card', type: 'Aadhaar' },
      { name: 'Income Certificate 2026', type: 'Revenue' },
      { name: 'PAN Card', type: 'PAN' },
      { name: 'Voter ID Card', type: 'EPIC' },
      { name: 'State Domicile Certificate', type: 'Domicile' },
    ];
    const profile = { state: 'Karnataka', city: 'Bengaluru' };
    const result = assessCivicReadiness(profile, docs);

    expect(result.overallScore).toBeGreaterThanOrEqual(80);
    expect(result.tier).toBe('SCHEME_READY');
    expect(result.verifiedCount).toBe(5);
    expect(result.missingCount).toBe(1);
    expect(result.missingCredentials[0].id).toBe('ration');
  });
});
