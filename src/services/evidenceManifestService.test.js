import { describe, it, expect, vi, beforeEach } from 'vitest';
import { File } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { createManifest, parseManifest, verifyManifest, validateFiles, MAX_FILE_BYTES, MAX_MANIFEST_BYTES } from './evidenceManifestService.js';
const file = (content, name) => new File([content], name, { type: 'text/plain', lastModified: 1000 });
describe('local evidence manifest', () => {
  beforeEach(() => vi.stubGlobal('crypto', webcrypto));
  it('round-trips a manifest and detects changes, missing files and extras', async () => {
    const manifest = await createManifest([file('hello', 'a.txt'), file('hello', 'b.txt')], { 'a.txt': 'receipt' });
    const parsed = parseManifest(JSON.stringify(manifest));
    const result = await verifyManifest(parsed, [file('changed', 'a.txt'), file('extra', 'c.txt')]);
    expect(result.results).toEqual([{ name: 'a.txt', status: 'Changed' }, { name: 'b.txt', status: 'Missing' }]);
    expect(result.extra).toEqual(['c.txt']);
    expect(result.duplicates).toEqual([['a.txt', 'b.txt']]);
    expect((await verifyManifest(parsed, [file('hello', 'a.txt')])).results[0].status).toBe('Match');
  });
  it('rejects malformed and oversized manifests', () => {
    expect(() => parseManifest('{')).toThrow('valid JSON');
    expect(() => parseManifest('{}')).toThrow('Invalid');
    expect(() => parseManifest('x'.repeat(MAX_MANIFEST_BYTES + 1))).toThrow('1 MiB');
    expect(() => parseManifest(JSON.stringify({ version: 1, algorithm: 'SHA-256', createdAt: '2025-01-01', entries: [{ name: 'a.txt' }] }))).toThrow('entry');
  });
  it('rejects unsupported, oversized and duplicate filenames', () => {
    expect(() => validateFiles([file('', 'file.exe')])).toThrow('Unsupported');
    expect(() => validateFiles([{ name: 'large.pdf', size: MAX_FILE_BYTES + 1 }])).toThrow('20 MiB');
    expect(() => validateFiles([file('a', 'same.txt'), file('b', 'same.txt')])).toThrow('Duplicate filename');
    expect(() => validateFiles(Array.from({ length: 21 }, (_, i) => file('', `${i}.txt`)))).toThrow('at most');
  });
  it('rejects empty selection and reports progress', async () => {
    await expect(createManifest([])).rejects.toThrow('at least one');
    const progress = vi.fn(); await createManifest([file('data', 'one.txt')], {}, progress);
    expect(progress).toHaveBeenCalledWith(1, 1);
  });
});
