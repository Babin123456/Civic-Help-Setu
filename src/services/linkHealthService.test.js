import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkLink,
  checkLinkWithRetry,
  sameDestination,
  saveLinkCheck,
  recordManualCheck,
  reviewRedirect,
  getLinkHealthRecords,
  getApplicationLinks,
  needsAttention,
} from './linkHealthService';
import { setCurrentActor } from './accessControl';

const makeStorage = () => {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
};
const resp = (status, url) => ({ status, url, type: 'basic' });
const NOW = new Date('2026-10-29T10:00:00Z');

beforeEach(() => setCurrentActor({ role: 'admin', username: 'Test Admin' }));

describe('checkLink', () => {
  it.each(['not a url', 'javascript:alert(1)', 'ftp://example.gov.in', 'data:text/html,hi', '', 'https://user:pw@example.gov.in', null, 42])(
    'never fetches %s and reports it as not a web link',
    async (bad) => {
      const fetchImpl = vi.fn();
      const r = await checkLink(bad, { fetchImpl, now: NOW });
      expect(r.status).toBe('invalid');
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('reports a normal answer at the same address as reachable, with a checked-at time', async () => {
    const r = await checkLink('https://example.gov.in/apply', { fetchImpl: async () => resp(200, 'https://example.gov.in/apply/'), now: NOW });
    expect(r.status).toBe('reachable');
    expect(r.checkedAt).toBe(NOW.toISOString());
    expect(r.redirectedTo).toBeNull();
  });

  it('sends a credential-free request and never submits anything', async () => {
    const fetchImpl = vi.fn(async () => resp(200, 'https://example.gov.in/'));
    await checkLink('https://example.gov.in/', { fetchImpl });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init).toMatchObject({ method: 'GET', credentials: 'omit', redirect: 'follow' });
    expect(init.body).toBeUndefined();
  });

  it('flags a different final address as redirected and keeps it for review', async () => {
    const r = await checkLink('https://old.gov.in/apply', { fetchImpl: async () => resp(200, 'https://new.gov.in/apply'), now: NOW });
    expect(r.status).toBe('redirected');
    expect(r.redirectedTo).toBe('https://new.gov.in/apply');
    expect(r.reviewed).toBe(false);
  });

  it('treats http to https as a redirect and ignores a trailing slash or fragment', async () => {
    expect((await checkLink('http://a.gov.in/x', { fetchImpl: async () => resp(200, 'https://a.gov.in/x') })).status).toBe('redirected');
    expect((await checkLink('https://a.gov.in/x', { fetchImpl: async () => resp(200, 'https://a.gov.in/x/#top') })).status).toBe('reachable');
  });

  it.each([404, 410, 500, 503])('reports status %i as not working', async (code) => {
    expect((await checkLink('https://a.gov.in/', { fetchImpl: async () => resp(code, 'https://a.gov.in/') })).status).toBe('unavailable');
  });

  it.each([401, 403, 429])('does not call a %i answer "not working"', async (code) => {
    expect((await checkLink('https://a.gov.in/', { fetchImpl: async () => resp(code, 'https://a.gov.in/') })).status).toBe('unverified');
  });

  it('reports a CORS or network failure as unable to verify, not down', async () => {
    const r = await checkLink('https://a.gov.in/', {
      fetchImpl: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    expect(r.status).toBe('unverified');
  });

  it('reports an opaque response as unable to verify', async () => {
    expect((await checkLink('https://a.gov.in/', { fetchImpl: async () => ({ status: 0, type: 'opaque', url: '' }) })).status).toBe('unverified');
  });

  it('reports a timeout as unable to verify', async () => {
    const fetchImpl = (_u, { signal }) => new Promise((_res, rej) => signal.addEventListener('abort', () => rej(new Error('aborted'))));
    const r = await checkLink('https://a.gov.in/', { fetchImpl, timeoutMs: 10 });
    expect(r.status).toBe('unverified');
  });
});

describe('checkLinkWithRetry', () => {
  it('retries a temporary failure and stops at the first real answer', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new TypeError('x')).mockResolvedValueOnce(resp(200, 'https://a.gov.in/'));
    expect((await checkLinkWithRetry('https://a.gov.in/', { fetchImpl })).status).toBe('reachable');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry a definite answer', async () => {
    const fetchImpl = vi.fn(async () => resp(404, 'https://a.gov.in/'));
    await checkLinkWithRetry('https://a.gov.in/', { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('gives up after the allowed attempts', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('x'));
    expect((await checkLinkWithRetry('https://a.gov.in/', { fetchImpl }, 3)).status).toBe('unverified');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe('sameDestination', () => {
  it('ignores fragments, trailing slashes and host case but not path or query', () => {
    expect(sameDestination('https://A.gov.in/x/', 'https://a.gov.in/x#y')).toBe(true);
    expect(sameDestination('https://a.gov.in/x', 'https://a.gov.in/y')).toBe(false);
    expect(sameDestination('https://a.gov.in/x?a=1', 'https://a.gov.in/x')).toBe(false);
    expect(sameDestination('nope', 'https://a.gov.in')).toBe(false);
  });
});

describe('storing results', () => {
  it('saves and reads back a result with its time and checker', () => {
    const storage = makeStorage();
    saveLinkCheck('svc:0', { url: 'https://a.gov.in/', status: 'reachable', checkedAt: NOW.toISOString() }, storage);
    expect(getLinkHealthRecords(storage)['svc:0']).toMatchObject({ status: 'reachable', checkedAt: NOW.toISOString(), checkedBy: 'Test Admin' });
  });

  it('keeps a redirect unreviewed until an admin reviews it, and never edits the service', () => {
    const storage = makeStorage();
    const service = { id: 's', officialSources: [{ name: 'P', url: 'https://old.gov.in/' }] };
    const before = JSON.stringify(service);
    saveLinkCheck('s:0', { url: 'https://old.gov.in/', status: 'redirected', redirectedTo: 'https://new.gov.in/' }, storage);
    expect(needsAttention(getLinkHealthRecords(storage)['s:0'])).toBe(true);
    reviewRedirect('s:0', storage);
    const after = getLinkHealthRecords(storage)['s:0'];
    expect(after.reviewed).toBe(true);
    expect(needsAttention(after)).toBe(false);
    expect(JSON.stringify(service)).toBe(before);
  });

  it('refuses to review something that is not a redirect', () => {
    const storage = makeStorage();
    saveLinkCheck('s:0', { url: 'https://a.gov.in/', status: 'reachable' }, storage);
    expect(() => reviewRedirect('s:0', storage)).toThrow();
  });

  it('records a manual result and requires a valid destination for a redirect', () => {
    const storage = makeStorage();
    expect(() => recordManualCheck('s:0', 'https://a.gov.in/', 'redirected', { destination: 'javascript:alert(1)' }, storage)).toThrow();
    expect(() => recordManualCheck('s:0', 'mailto:a@b.in', 'reachable', {}, storage)).toThrow();
    expect(() => recordManualCheck('s:0', 'https://a.gov.in/', 'maybe', {}, storage)).toThrow();
    const r = recordManualCheck('s:0', 'https://a.gov.in/', 'redirected', { destination: 'https://b.gov.in/' }, storage);
    expect(r).toMatchObject({ method: 'manual', status: 'redirected', redirectedTo: 'https://b.gov.in/', reviewed: false });
  });

  it('survives corrupted storage', () => {
    const storage = makeStorage();
    storage.setItem('civicbridge_link_health_v1', '{broken');
    expect(getLinkHealthRecords(storage)).toEqual({});
  });
});

describe('admin only', () => {
  it.each([null, { role: 'citizen' }])('blocks saving, manual checks and reviews for %j', (actor) => {
    setCurrentActor(actor);
    const storage = makeStorage();
    expect(() => saveLinkCheck('s:0', { status: 'reachable' }, storage)).toThrow(/Not allowed/);
    expect(() => recordManualCheck('s:0', 'https://a.gov.in/', 'reachable', {}, storage)).toThrow(/Not allowed/);
    expect(() => reviewRedirect('s:0', storage)).toThrow(/Not allowed/);
  });
});

describe('getApplicationLinks', () => {
  it('lists official sources and marks non-http addresses as not checkable', () => {
    const links = getApplicationLinks({ officialSources: [{ name: 'A', url: 'https://a.gov.in' }, { name: 'B', url: 'javascript:x' }, { name: 'C' }] });
    expect(links).toHaveLength(2);
    expect(links[0].url).toBe('https://a.gov.in/');
    expect(links[1].url).toBe('');
  });

  it('handles a service with no sources', () => {
    expect(getApplicationLinks({})).toEqual([]);
  });
});
