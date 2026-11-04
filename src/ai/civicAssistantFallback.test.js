import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildCivicAssistantFallback } from './civicAssistantFallback';
import { askCivicAssistant } from './civicAssistant';
import { MOCK_SERVICES } from '../data/services';
import { CIVIC_OFFICES } from '../data/locationOffices';

const storage = new Map();
beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('buildCivicAssistantFallback', () => {
  it('returns a structured unverified fallback for a no-result query', () => {
    const result = buildCivicAssistantFallback('quantum physics cooking recipe', {
      activeServices: MOCK_SERVICES,
      offices: CIVIC_OFFICES,
    });

    expect(result.status).toBe('unverified');
    expect(result.grounded).toBe(false);
    expect(result.serviceId).toBeNull();
    expect(result.timeout).toBe(false);
    expect(result.data.title).toBe('I could not verify an answer');
    expect(result.data.summary).toContain('could not verify an answer');
    expect(result.data.summary).toContain('does not invent departments, URLs, deadlines, or application statuses');
    expect(result.data.missingInformationNotice).toContain('No verified government guideline or catalogue record was found');
  });

  it('never fabricates a department, URL, or status; uses the national portal when nothing matches', () => {
    const result = buildCivicAssistantFallback('qwerty uiop asdfghjkl zxcvbnm unrelated gibberish', {
      activeServices: MOCK_SERVICES,
      offices: CIVIC_OFFICES,
    });

    expect(result.data.catalogueSearch).toEqual([]);
    expect(result.data.nearbyOffices).toEqual([]);
    expect(result.data.officialSource).toEqual({
      name: 'National Government Services Portal (Services.india.gov.in)',
      url: 'https://services.india.gov.in',
      verified: true,
    });
    expect(result.data.retryPrompts.length).toBeGreaterThan(0);
    expect(result.data.retryPrompts).toContain('Try again');
    expect(result.data.retryPrompts).toContain('Rephrase your question');
  });

  it('is context-aware for transport/driving queries', () => {
    const result = buildCivicAssistantFallback('how do I get a driving license in delhi', {
      activeServices: MOCK_SERVICES,
      offices: CIVIC_OFFICES,
    });

    expect(result.data.catalogueSearch.length).toBeGreaterThan(0);
    expect(result.data.catalogueSearch.some((c) => c.id === 'driving-license')).toBe(true);

    const rtoOffices = result.data.nearbyOffices.filter((o) => o.type === 'Regional Transport Office');
    expect(rtoOffices.length).toBeGreaterThan(0);
    rtoOffices.forEach((o) => {
      expect(o.name).toBeTruthy();
      expect(o.city).toBeTruthy();
      expect(o.state).toBeTruthy();
      // Contact info must come from real directory data, never fabricated
      if (o.phone) expect(typeof o.phone).toBe('string');
      if (o.portalUrl) expect(o.portalUrl.startsWith('http')).toBe(true);
    });

    const official = result.data.officialSource;
    expect(official.url).toBeTruthy();
    expect(official.verified).toBe(true);
  });

  it('is context-aware for certificate queries', () => {
    const result = buildCivicAssistantFallback('birth certificate apply online', {
      activeServices: MOCK_SERVICES,
      offices: CIVIC_OFFICES,
    });

    expect(result.data.catalogueSearch.some((c) => c.id === 'birth-certificate')).toBe(true);
    const collectorateOffices = result.data.nearbyOffices.filter(
      (o) => o.type === 'Tehsil / Collectorate' || o.category === 'Revenue & Certificates'
    );
    expect(collectorateOffices.length).toBeGreaterThan(0);
  });

  it('prefers in-app catalogue results and real official sources over fabrication', () => {
    const result = buildCivicAssistantFallback('pan card documents needed', {
      activeServices: MOCK_SERVICES,
      offices: CIVIC_OFFICES,
    });

    expect(result.data.catalogueSearch.some((c) => c.id === 'pan-card')).toBe(true);
    const official = result.data.officialSource;
    // Must be a real stored official source, not a made-up URL
    expect([official.url, ...result.data.catalogueSearch.map((c) => c.route)]).toEqual(
      expect.arrayContaining([expect.stringMatching(/^https?:\/\//)])
    );
  });

  it('includes retry / rephrase affordances', () => {
    const result = buildCivicAssistantFallback('unclear query', {
      activeServices: MOCK_SERVICES,
      offices: CIVIC_OFFICES,
    });

    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.data.retryPrompts).toContain('Try again');
    expect(result.data.retryPrompts).toContain('Rephrase your question');
    const prompt = result.data.retryPrompts.find((p) =>
      p.toLowerCase().includes('question to name')
    );
    expect(prompt).toBeTruthy();
  });
});

describe('askCivicAssistant AI-timeout', () => {
  it('returns the structured fallback with a timeout flag when the assistant times out', async () => {
    const response = await askCivicAssistant('driving license fees', { timeoutMs: 50 });

    expect(response.status).toBe('unverified');
    expect(response.grounded).toBe(false);
    expect(response.serviceId).toBeNull();
    expect(response.timeout).toBe(true);
    expect(response.data.summary).toContain('could not verify an answer');
    expect(response.data.retryPrompts).toContain('Try again');
  });

  it('still returns a successful service match when no timeout is set', async () => {
    const response = await askCivicAssistant('pan card fees');

    expect(response.status).toBe('success');
    expect(response.data.title).toBe('PAN Card (Permanent Account Number)');
    expect(response.serviceId).toBe('pan-card');
  });

  it('still returns the structured fallback for a no-result query without a timeout', async () => {
    const response = await askCivicAssistant('qwerty uiop asdfghjkl zxcvbnm unrelated gibberish');

    expect(response.status).toBe('unverified');
    expect(response.grounded).toBe(false);
    expect(response.timeout).toBe(false);
    expect(response.data.officialSource.url).toBe('https://services.india.gov.in');
  });
});
