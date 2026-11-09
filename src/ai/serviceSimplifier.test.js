import { describe, it, expect } from 'vitest';
import { MOCK_SERVICES } from '../data/services';
import { CIVIC_GLOSSARY } from '../data/civicGlossary';
import { buildPlainLanguageSummary, simplifyService, SIMPLIFIER_LABEL } from './serviceSimplifier';

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

const guide = (extra = {}) => ({
  id: 'sample',
  name: 'Sample certificate',
  shortDescription: 'Obtain the certificate in order to prove your age.',
  eligibility: ['Any adult resident.'],
  steps: [{ title: 'Visit the office', description: 'Go to the counter and submit the form.' }],
  officialSources: [{ name: 'Sample portal', url: 'https://example.gov.in' }],
  ...extra,
});

describe('buildPlainLanguageSummary (#382)', () => {
  it('swaps formal words for everyday ones and keeps the rest', () => {
    const out = buildPlainLanguageSummary(guide());
    expect(out.status).toBe('ready');
    expect(out.label).toBe(SIMPLIFIER_LABEL);
    expect(out.purpose).toBe('Get the certificate to prove your age.');
  });

  it('takes who it is for from the first eligibility line and says how many more there are', () => {
    expect(buildPlainLanguageSummary(guide()).audience).toBe('Any adult resident.');
    expect(buildPlainLanguageSummary(guide({ eligibility: ['Any adult resident.', 'Has an ID.'] })).audience)
      .toBe('Any adult resident. The guide lists 1 more condition.');
    expect(buildPlainLanguageSummary(guide({ eligibility: ['A.', 'B.', 'C.'] })).audience)
      .toBe('A. The guide lists 2 more conditions.');
  });

  it('takes the next step from the first step, in everyday words', () => {
    expect(buildPlainLanguageSummary(guide()).nextStep).toBe('Visit the office. Go to the counter and send in the form.');
    expect(buildPlainLanguageSummary(guide({ steps: ['Visit the office'] })).nextStep).toBe('Visit the office.');
  });

  it('splits a long sentence where the guide says ", then" and does not add anything', () => {
    const long = 'Register a birth with the Registrar for the place where it occurred in the state, then search or download the official certificate through the state system.';
    const out = buildPlainLanguageSummary(guide({ shortDescription: long }));
    expect(out.purpose).toBe('Register a birth with the Registrar for the place where it occurred in the state. Then search or download the official certificate through the state system.');
  });

  it('keeps a short sentence whole and uses only the first sentence of a longer text', () => {
    const out = buildPlainLanguageSummary(guide({ shortDescription: 'Pay the fee online. Visit the office later.' }));
    expect(out.purpose).toBe('Pay the fee online.');
  });

  it('explains jargon from the reviewed glossary, and only that', () => {
    const out = buildPlainLanguageSummary(guide({ shortDescription: 'A domicile certificate shows where you live.' }));
    const entry = CIVIC_GLOSSARY.find((g) => g.id === 'domicile');
    expect(out.terms).toEqual(expect.arrayContaining([{ id: 'domicile', term: entry.term, meaning: entry.simpleMeaning }]));
    expect(out.terms.length).toBeLessThanOrEqual(3);
    expect(buildPlainLanguageSummary(guide()).terms).toEqual([]);
  });

  it('is deterministic', () => {
    expect(buildPlainLanguageSummary(guide())).toEqual(buildPlainLanguageSummary(guide()));
  });
});

describe('fallbacks: nothing is invented', () => {
  it.each([
    ['no description', { shortDescription: undefined }],
    ['an empty description', { shortDescription: '' }],
    ['a description of spaces', { shortDescription: '   ' }],
    ['a description that is not text', { shortDescription: 42 }],
    ['a description that is only markup', { shortDescription: '<b></b><script>alert(1)</script>' }],
  ])('a guide with %s gets an explanation, not a summary', (_name, extra) => {
    const out = buildPlainLanguageSummary(guide(extra));
    expect(out.status).toBe('unavailable');
    expect(out.reason).toBe('missing-description');
    expect(out.message).toMatch(/no description/i);
    expect(out.purpose).toBeUndefined();
    expect(out.terms).toEqual([]);
  });

  it('does not throw on a missing or odd record', () => {
    for (const bad of [undefined, null, 'text', 7, [], {}]) {
      expect(buildPlainLanguageSummary(bad).status).toBe('unavailable');
    }
  });

  it('leaves out who it is for when the guide does not say, and lists it as missing', () => {
    const out = buildPlainLanguageSummary(guide({ eligibility: [] }));
    expect(out.status).toBe('ready');
    expect(out.audience).toBeNull();
    expect(out.missing).toContain('audience');
    expect(buildPlainLanguageSummary(guide({ eligibility: undefined })).audience).toBeNull();
    expect(buildPlainLanguageSummary(guide({ eligibility: ['', '  ', 7] })).audience).toBeNull();
  });

  it('points to the official source when there are no steps, and leaves the step out when there is no source either', () => {
    const withSource = buildPlainLanguageSummary(guide({ steps: [] }));
    expect(withSource.nextStep).toBe('The guide does not list steps. Start from the official source: Sample portal.');
    expect(withSource.source).toEqual({ name: 'Sample portal', url: 'https://example.gov.in' });
    const none = buildPlainLanguageSummary(guide({ steps: [], officialSources: [] }));
    expect(none.nextStep).toBeNull();
    expect(none.missing).toContain('nextStep');
  });

  it('never passes markup through', () => {
    const out = buildPlainLanguageSummary(guide({
      shortDescription: '<b>Pay</b> the fee <script>alert(1)</script>online.',
      eligibility: ['<img src=x onerror=alert(1)>Any adult.'],
      steps: [{ title: '<i>Visit</i> the office', description: '<a href="javascript:alert(1)">Go</a> there.' }],
    }));
    const text = [out.purpose, out.audience, out.nextStep].join(' ');
    expect(text).not.toMatch(/[<>]/);
    expect(text).toContain('Pay the fee');
  });
});

describe('the guide itself is never changed', () => {
  it('does not write to a frozen record', () => {
    const frozen = deepFreeze(guide());
    expect(() => buildPlainLanguageSummary(frozen)).not.toThrow();
  });

  it('leaves the whole catalogue as it was', () => {
    const before = JSON.stringify(MOCK_SERVICES);
    MOCK_SERVICES.forEach((s) => buildPlainLanguageSummary(s));
    expect(JSON.stringify(MOCK_SERVICES)).toBe(before);
  });

  it('works on every guide in the catalogue, and adds no number or link that the guide does not have', () => {
    for (const service of MOCK_SERVICES) {
      const out = buildPlainLanguageSummary(service);
      expect(out.status, service.id).toBe('ready');
      const source = [service.shortDescription, service.eligibility?.[0], service.steps?.[0]?.title, service.steps?.[0]?.description, service.officialSources?.[0]?.name].join(' ');
      const produced = [out.purpose, out.audience, out.nextStep].filter(Boolean).join(' ').replace(/The guide lists \d+ more conditions?\./g, '');
      const numbers = (text) => text.match(/\d+/g) || [];
      numbers(produced).forEach((n) => expect(numbers(source), `${service.id}: ${n}`).toContain(n));
      const links = (text) => (text.match(/https?:\/\/[^\s)]+/g) || []).map((l) => l.replace(/[.,;]+$/, ''));
      links(produced).forEach((link) => expect(links(source), `${service.id}: ${link}`).toContain(link));
    }
  });
});

describe('simplifyService', () => {
  it('resolves with the summary', async () => {
    const out = await simplifyService(guide(), { latencyMs: 0 });
    expect(out.status).toBe('ready');
    expect(out.purpose).toBe('Get the certificate to prove your age.');
  });

  it('resolves with the explanation for a guide without a description', async () => {
    const out = await simplifyService(guide({ shortDescription: '' }), { latencyMs: 0 });
    expect(out.status).toBe('unavailable');
  });

  it('comes back as an error result, not a throw, when it takes longer than the timeout', async () => {
    const out = await simplifyService(guide(), { latencyMs: 80, timeoutMs: 10 });
    expect(out).toEqual({ status: 'error', reason: 'timeout' });
  });

  it('comes back as an error result when reading the record fails', async () => {
    const broken = { get shortDescription() { throw new Error('unreadable'); } };
    const out = await simplifyService(broken, { latencyMs: 0 });
    expect(out).toEqual({ status: 'error', reason: 'failed' });
  });

  it('can be cancelled', async () => {
    const controller = new AbortController();
    const pending = simplifyService(guide(), { latencyMs: 200, signal: controller.signal });
    controller.abort();
    expect(await pending).toEqual({ status: 'cancelled' });
  });
});
