import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { REGIONAL_REVIEW_KEY, MAX_REVIEW_HISTORY, validateRegionalReview, readRegionalReviews, saveRegionalReview, buildRegionalDirectory } from './regionalServiceDirectoryService';
import { setCurrentActor } from './accessControl';
import { assignServiceOwnership, getOwnershipMap } from './serviceOwnershipService';
import { getAuditLogs } from './adminService';
import RegionalDirectoryStatus from '../components/services/RegionalDirectoryStatus';
import RegionalDirectoryReviewPanel from '../components/admin/RegionalDirectoryReviewPanel';

const makeStorage = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data };
};
const locks = () => {
  let tail = Promise.resolve();
  return { request: (_name, operation) => { const current = tail.then(operation); tail = current.catch(() => {}); return current; } };
};
const input = { cadenceDays: 30, availability: 'available', verifiedAt: '2026-11-01', sourceUrl: 'https://example.gov.in/rule', authorityUrl: 'https://example.gov.in/contact' };
const now = Date.parse('2026-11-24T12:00:00Z');
const service = { id: 'aadhaar-card', name: 'Example public service', department: 'Public Authority', jurisdiction: { level: 'state', states: ['Maharashtra'], districts: [], localBody: '' }, lastVerified: '2026-11-01', resources: [{ url: input.sourceUrl }] };
let storage;
beforeEach(() => { storage = makeStorage(); vi.stubGlobal('localStorage', storage); setCurrentActor({ id: 'admin', role: 'admin' }); });
afterEach(() => { vi.unstubAllGlobals(); setCurrentActor(null); });
const save = (value = input, options = {}) => saveRegionalReview('aadhaar-card', value, { locks: locks(), storage, now, ...options });

describe('regional review validation and local persistence', () => {
  it.each([0, -1, 1.2, 366, true, Infinity, '', null])('rejects invalid cadence %s', (cadenceDays) => {
    expect(() => validateRegionalReview({ ...input, cadenceDays }, now)).toThrow();
  });
  it.each(['javascript:alert(1)', 'http://example.gov.in', 'https://user:secret@example.gov.in', 'https://example.gov.in/?token=secret', 'https://example.gov.in/#private'])('rejects unsafe or private URL %s', (sourceUrl) => {
    expect(() => validateRegionalReview({ ...input, sourceUrl }, now)).toThrow();
  });
  it.each(['2026-02-31', '2027-01-01', 'not-a-date'])('rejects invalid/future date %s', (verifiedAt) => {
    expect(() => validateRegionalReview({ ...input, verifiedAt }, now)).toThrow();
  });
  it('requires dated evidence for an availability assertion', () => {
    expect(() => validateRegionalReview({ ...input, sourceUrl: '' }, now)).toThrow();
    expect(() => validateRegionalReview({ ...input, verifiedAt: '' }, now)).toThrow();
  });
  it('allows explicit unknown status without evidence', () => {
    expect(validateRegionalReview({ cadenceDays: 180, availability: 'unknown' }, now).verifiedAt).toBe('');
  });
  it('preserves every prior verification revision in one local write', async () => {
    expect((await save()).ok).toBe(true);
    expect((await save({ ...input, availability: 'unavailable' }, { expectedRevision: 1 })).ok).toBe(true);
    const record = readRegionalReviews(storage).records['aadhaar-card'];
    expect(record.revision).toBe(2); expect(record.history[0].availability).toBe('available');
    expect(record.availability).toBe('unavailable');
  });
  it('refuses citizen writes before touching storage', async () => {
    setCurrentActor({ role: 'citizen' });
    await expect(save()).rejects.toMatchObject({ code: 'FORBIDDEN' }); expect(storage.data.size).toBe(0);
  });
  it('refuses missing Web Locks instead of a racy save', async () => {
    expect((await save(input, { locks: null })).ok).toBe(false); expect(storage.data.size).toBe(0);
  });
  it('allows one of two stale-tab saves, preventing a lost update', async () => {
    const shared = locks();
    const results = await Promise.all([save(input, { locks: shared }), save({ ...input, availability: 'unavailable' }, { locks: shared })]);
    expect(results.filter((r) => r.ok)).toHaveLength(1); expect(readRegionalReviews(storage).records['aadhaar-card'].revision).toBe(1);
  });
  it('preserves old bytes after a quota failure and permits retry', async () => {
    await save(); const original = storage.data.get(REGIONAL_REVIEW_KEY); const write = storage.setItem;
    storage.setItem = () => { throw new Error('quota'); };
    expect((await save(input, { expectedRevision: 1 })).ok).toBe(false);
    expect(storage.data.get(REGIONAL_REVIEW_KEY)).toBe(original);
    storage.setItem = write; expect((await save(input, { expectedRevision: 1 })).ok).toBe(true);
  });
  it('does not overwrite corrupt or future-version storage', async () => {
    for (const raw of ['{bad', JSON.stringify({ schemaVersion: 99, records: {} })]) {
      storage.data.set(REGIONAL_REVIEW_KEY, raw); expect((await save()).ok).toBe(false); expect(storage.data.get(REGIONAL_REVIEW_KEY)).toBe(raw);
    }
  });
  it('rejects tampered history revisions', async () => {
    await save(); const state = JSON.parse(storage.data.get(REGIONAL_REVIEW_KEY)); state.records['aadhaar-card'].revision = 200;
    storage.data.set(REGIONAL_REVIEW_KEY, JSON.stringify(state)); expect(readRegionalReviews(storage).ok).toBe(false);
  });
  it('fails closed at retained-history capacity instead of silently deleting it', async () => {
    for (let revision = 0; revision <= MAX_REVIEW_HISTORY; revision++) expect((await save(input, { expectedRevision: revision })).ok).toBe(true);
    const raw = storage.data.get(REGIONAL_REVIEW_KEY); expect((await save(input, { expectedRevision: MAX_REVIEW_HISTORY + 1 })).ok).toBe(false);
    expect(storage.data.get(REGIONAL_REVIEW_KEY)).toBe(raw);
  });
});

describe('public regional projection and integration', () => {
  it('marks the exact cadence boundary overdue with an escalation', () => {
    const entry = buildRegionalDirectory([service], { [service.id]: input }, Date.parse('2026-12-01T00:00:00Z'))[0];
    expect(entry.status).toBe('stale'); expect(entry.escalation).toContain('overdue');
  });
  it('never treats missing dates or invalid jurisdictions as reviewed', () => {
    const entries = buildRegionalDirectory([{ ...service, lastVerified: '' }, { ...service, id: 'bad', jurisdiction: null }], {}, now);
    expect(entries.every((entry) => entry.status === 'unknown')).toBe(true); expect(entries[1].conflict).toBe(true);
  });
  it('flags incompatible records in the same jurisdiction but not disjoint regions', () => {
    const other = { ...service, id: 'other', department: 'Different Authority' };
    expect(buildRegionalDirectory([service, other], {}, now).every((entry) => entry.conflict)).toBe(true);
    other.jurisdiction = { ...service.jurisdiction, states: ['Tamil Nadu'] };
    expect(buildRegionalDirectory([service, other], {}, now).some((entry) => entry.conflict)).toBe(false);
  });
  it('keeps private owners and notes out of storage and public markup', async () => {
    await save({ ...input, reviewerName: 'PRIVATE REVIEWER', privateNote: 'PRIVATE NOTE' });
    const html = renderToStaticMarkup(<RegionalDirectoryStatus services={[service]} />);
    expect(html).not.toContain('PRIVATE'); expect(storage.data.get(REGIONAL_REVIEW_KEY)).not.toContain('PRIVATE');
    expect(html).toContain('Public Authority'); expect(html).toContain('Source evidence');
  });
  it('retains legacy ownership transfer events without exposing their private note', () => {
    assignServiceOwnership('aadhaar-card', { team: 'First team', privateNote: 'PRIVATE NOTE' }, { storage });
    assignServiceOwnership('aadhaar-card', { team: 'Second team' }, { storage });
    expect(getOwnershipMap(storage)['aadhaar-card'].team).toBe('Second team');
    const logs = getAuditLogs().filter((log) => log.action === 'OWNERSHIP_CHANGED');
    expect(logs).toHaveLength(2); expect(JSON.stringify(logs)).not.toContain('PRIVATE NOTE');
    const html = renderToStaticMarkup(<RegionalDirectoryReviewPanel service={service} auditLogs={logs} />);
    expect(html).toContain('First team'); expect(html).toContain('Second team'); expect(html).toContain('Device-local only');
  });
  it('marks public metadata unknown when local review storage cannot be read', () => {
    storage.data.set(REGIONAL_REVIEW_KEY, '{bad');
    const html = renderToStaticMarkup(<RegionalDirectoryStatus services={[service]} />);
    expect(html).toContain('Review: unknown');
  });
  it('builds a bounded synthetic 1000-record directory without inventing review data', () => {
    const rows = Array.from({ length: 1000 }, (_, n) => ({ ...service, id: `s-${n}`, name: `Service ${n}`, lastVerified: '' }));
    const result = buildRegionalDirectory(rows, {}, now); expect(result).toHaveLength(1000); expect(result.every((entry) => entry.status === 'unknown')).toBe(true);
  });
});
