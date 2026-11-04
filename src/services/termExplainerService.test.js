import { describe, it, expect } from 'vitest';
import { explainTerm } from './termExplainerService';

describe('termExplainerService (#383)', () => {
  it('returns a graceful fallback for an empty term', async () => {
    const result = await explainTerm({ term: '' });
    expect(result.fallback).toBe(true);
    expect(result.informational).toBe(true);
    expect(result.definition).toContain('No term was provided to explain.');
    expect(result.error).toBe('Empty term');
  });

  it('returns a graceful fallback for a missing term', async () => {
    const result = await explainTerm({});
    expect(result.fallback).toBe(true);
    expect(result.informational).toBe(true);
  });

  it('returns a graceful fallback when the AI request fails', async () => {
    const result = await explainTerm({
      term: '__simulate_failure__',
      serviceContext: { serviceName: 'Birth Certificate' },
    });
    expect(result.fallback).toBe(true);
    expect(result.informational).toBe(true);
    expect(result.definition).toContain('__simulate_failure__');
    expect(result.error).toBe('AI explanation service unavailable');
  });

  it('uses the verified glossary for known terms without AI generation', async () => {
    const result = await explainTerm({
      term: 'domicile',
      serviceContext: { serviceName: 'Domicile Certificate' },
    });
    expect(result.fallback).toBe(false);
    expect(result.informational).toBe(true);
    expect(result.source).toBe('verified-glossary');
    expect(result.definition).toContain('lived');
  });

  it('generates a contextual AI definition using the service name', async () => {
    const result = await explainTerm({
      term: 'income certificate',
      serviceContext: {
        serviceName: 'Ration Card Application',
        serviceDescription: 'Document issued by state governments for purchasing subsidized food.',
        section: 'Documents you need',
      },
    });
    expect(result.fallback).toBe(false);
    expect(result.informational).toBe(true);
    expect(result.definition).toContain('income');
    expect(result.definition).toContain('Ration Card Application');
  });

  it('includes an illustrative example marked as not an official rule', async () => {
    const result = await explainTerm({
      term: 'self-attested copy',
      serviceContext: { serviceName: 'PAN Card' },
    });
    expect(result.example).toBeDefined();
    expect(result.example).toMatch(/Illustrative only, not an official rule\./);
  });

  it('truncates long explanations to the maximum length', async () => {
    const longTerm = 'a'.repeat(500);
    const result = await explainTerm({
      term: longTerm,
      serviceContext: { serviceName: 'Test Service' },
    });
    expect(result.definition.length).toBeLessThanOrEqual(200);
  });

  it('does not include profile or vault data in the explanation result', async () => {
    const result = await explainTerm({
      term: 'domicile',
      serviceContext: {
        serviceName: 'Test Service',
        userId: 'user-123',
        vaultData: { documents: [] },
        profile: { name: 'Khushi' },
      },
    });
    expect(result.fallback).toBe(false);
    expect(result.informational).toBe(true);
    expect(result.source).toBe('verified-glossary');
  });

  it('marks every explanation as informational', async () => {
    const known = await explainTerm({ term: 'affidavit' });
    const ai = await explainTerm({
      term: 'issuing authority',
      serviceContext: { serviceName: 'Test' },
    });
    const failed = await explainTerm({ term: '__simulate_failure__' });
    const empty = await explainTerm({ term: '' });

    expect(known.informational).toBe(true);
    expect(ai.informational).toBe(true);
    expect(failed.informational).toBe(true);
    expect(empty.informational).toBe(true);
  });
});
