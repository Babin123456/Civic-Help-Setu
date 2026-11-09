import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MOCK_SERVICES } from '../data/services';
import {
  buildServiceOverview,
  fetchServiceOverview,
  clearOverviewCache,
  OVERVIEW_LABEL,
  INSUFFICIENT_MESSAGE,
} from './serviceOverview';

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

const guide = (extra = {}) => ({
  id: 'sample',
  name: 'Sample licence',
  shortDescription: 'Official document for drivers. A second sentence.',
  department: 'Transport Department',
  eligibility: ['Any adult resident.'],
  ...extra,
});

describe('buildServiceOverview (#384)', () => {
  it('is the first sentence of the description plus the department', () => {
    const out = buildServiceOverview(guide());
    expect(out.status).toBe('ready');
    expect(out.label).toBe(OVERVIEW_LABEL);
    expect(out.sentence).toBe('Official document for drivers, handled by Transport Department.');
    expect(out.basedOn).toEqual(['name', 'shortDescription', 'department']);
  });

  it('does not repeat a department the sentence already names', () => {
    const out = buildServiceOverview(guide({ shortDescription: 'Issued by the Transport Department for drivers.' }));
    expect(out.sentence).toBe('Issued by the Transport Department for drivers.');
    expect(out.basedOn).not.toContain('department');
  });

  it('treats a department with a bracketed short form as named when its main name is in the sentence', () => {
    const out = buildServiceOverview(guide({ shortDescription: 'Identity issued by the Income Tax Department.', department: 'Income Tax Department (CBDT)' }));
    expect(out.sentence).toBe('Identity issued by the Income Tax Department.');
    const other = buildServiceOverview(guide({ shortDescription: 'Identity for tax.', department: 'Income Tax Department (CBDT)' }));
    expect(other.sentence).toBe('Identity for tax, handled by Income Tax Department (CBDT).');
  });

  it('leaves the department out when the record has none', () => {
    expect(buildServiceOverview(guide({ department: undefined })).sentence).toBe('Official document for drivers.');
    expect(buildServiceOverview(guide({ department: '   ' })).sentence).toBe('Official document for drivers.');
  });

  it('is one sentence, and keeps only the first of a longer description', () => {
    const out = buildServiceOverview(guide({ shortDescription: 'Pay the fee online. Visit the office later. Bring ID.', department: undefined }));
    expect(out.sentence).toBe('Pay the fee online.');
  });

  it('does not use the eligibility lines: the catalogue has no audience field', () => {
    const out = buildServiceOverview(guide({ eligibility: ['Only people with a unique marker xyzzy.'] }));
    expect(out.sentence).not.toContain('xyzzy');
  });

  it('is deterministic', () => {
    expect(buildServiceOverview(guide())).toEqual(buildServiceOverview(guide()));
  });
});

describe('an incomplete record gets no overview, not a guess', () => {
  it.each([
    ['no description', { shortDescription: undefined }],
    ['an empty description', { shortDescription: '' }],
    ['a description of spaces', { shortDescription: '   ' }],
    ['a description that is not text', { shortDescription: 42 }],
    ['a description that is only markup', { shortDescription: '<b></b><script>alert(1)</script>' }],
    ['no name', { name: undefined }],
    ['an empty name', { name: '  ' }],
    ['a name that is not text', { name: 7 }],
  ])('a guide with %s', (_label, extra) => {
    const out = buildServiceOverview(guide(extra));
    expect(out.status).toBe('insufficient');
    expect(out.message).toBe(INSUFFICIENT_MESSAGE);
    expect(out.sentence).toBeUndefined();
  });

  it('does not throw on a missing or odd record', () => {
    for (const bad of [undefined, null, 'text', 7, [], {}]) {
      expect(buildServiceOverview(bad).status).toBe('insufficient');
    }
  });

  it('never passes markup through', () => {
    const out = buildServiceOverview(guide({ shortDescription: '<b>Pay</b> the fee <script>alert(1)</script>online.', department: '<i>Revenue</i> Department' }));
    expect(out.sentence).not.toMatch(/[<>]/);
    expect(out.sentence).toContain('Pay the fee');
    expect(out.sentence).toContain('Revenue Department');
  });
});

describe('the record is never changed', () => {
  it('does not write to a frozen record', () => {
    expect(() => buildServiceOverview(deepFreeze(guide()))).not.toThrow();
  });

  it('leaves the whole catalogue as it was, and its order', () => {
    const before = JSON.stringify(MOCK_SERVICES);
    const orderBefore = MOCK_SERVICES.map((s) => s.id);
    MOCK_SERVICES.forEach((s) => buildServiceOverview(s));
    expect(JSON.stringify(MOCK_SERVICES)).toBe(before);
    expect(MOCK_SERVICES.map((s) => s.id)).toEqual(orderBefore);
  });

  it('works on every guide in the catalogue and adds no number or link that the guide does not have', () => {
    for (const service of MOCK_SERVICES) {
      const out = buildServiceOverview(service);
      expect(out.status, service.id).toBe('ready');
      const source = [service.name, service.shortDescription, service.department].join(' ');
      const numbers = (text) => text.match(/\d+/g) || [];
      numbers(out.sentence).forEach((n) => expect(numbers(source), `${service.id}: ${n}`).toContain(n));
      const links = (text) => (text.match(/https?:\/\/[^\s)]+/g) || []).map((l) => l.replace(/[.,;]+$/, ''));
      links(out.sentence).forEach((link) => expect(links(source), `${service.id}: ${link}`).toContain(link));
    }
  });
});

describe('fetchServiceOverview', () => {
  beforeEach(() => clearOverviewCache());
  afterEach(() => vi.useRealTimers());

  it('resolves with the overview', async () => {
    const out = await fetchServiceOverview(guide(), { latencyMs: 0 });
    expect(out.status).toBe('ready');
    expect(out.sentence).toBe('Official document for drivers, handled by Transport Department.');
  });

  it('resolves with the plain message for an incomplete guide', async () => {
    expect((await fetchServiceOverview(guide({ shortDescription: '' }), { latencyMs: 0 })).status).toBe('insufficient');
  });

  it('comes back as an error result, not a throw, on a timeout or an unreadable record', async () => {
    expect(await fetchServiceOverview(guide(), { latencyMs: 80, timeoutMs: 10 })).toEqual({ status: 'error', reason: 'timeout' });
    const broken = { id: 'broken', get name() { throw new Error('unreadable'); } };
    expect(await fetchServiceOverview(broken, { latencyMs: 0 })).toEqual({ status: 'error', reason: 'failed' });
  });

  it('can be cancelled', async () => {
    const controller = new AbortController();
    const pending = fetchServiceOverview(guide(), { latencyMs: 200, signal: controller.signal });
    controller.abort();
    expect(await pending).toEqual({ status: 'cancelled' });
  });

  it('answers a second request for the same guide at once, from the first result', async () => {
    vi.useFakeTimers();
    const first = fetchServiceOverview(guide(), { latencyMs: 300, timeoutMs: 0 });
    await vi.advanceTimersByTimeAsync(300);
    const firstResult = await first;
    // No timer is advanced from here: a request that had to wait would never finish.
    expect(await fetchServiceOverview(guide(), { latencyMs: 300, timeoutMs: 0 })).toBe(firstResult);
  });

  it('makes a new one when the name, description or department changes', async () => {
    const a = await fetchServiceOverview(guide(), { latencyMs: 0 });
    const b = await fetchServiceOverview(guide({ shortDescription: 'Something else entirely.' }), { latencyMs: 0 });
    const c = await fetchServiceOverview(guide({ department: 'Other Department' }), { latencyMs: 0 });
    expect(b.sentence).toBe('Something else entirely, handled by Transport Department.');
    expect(c.sentence).toBe('Official document for drivers, handled by Other Department.');
    expect(a.sentence).not.toBe(b.sentence);
  });

  it('does not keep a failure', async () => {
    expect((await fetchServiceOverview(guide(), { latencyMs: 80, timeoutMs: 10 })).status).toBe('error');
    expect((await fetchServiceOverview(guide(), { latencyMs: 0 })).status).toBe('ready');
  });

  it('does not keep anything for a record without an id', async () => {
    const noId = { name: 'X', shortDescription: 'Does a thing.' };
    const first = await fetchServiceOverview(noId, { latencyMs: 0 });
    const second = await fetchServiceOverview(noId, { latencyMs: 0 });
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});
