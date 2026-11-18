import { describe, it, expect, vi, beforeEach } from 'vitest';
import { File } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import {
  createManifest,
  parseManifest,
  verifyManifest,
  validateFiles,
  generateEvidenceScheduleMarkdown,
  computeManifestDigest,
  EVIDENCE_CATEGORIES,
  INTEGRITY_DISCLAIMER,
  MAX_FILE_BYTES,
  MAX_MANIFEST_BYTES,
} from './evidenceManifestService.js';

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
    const progress = vi.fn();
    await createManifest([file('data', 'one.txt')], {}, progress);
    expect(progress).toHaveBeenCalledWith(1, 1);
  });

  it('supports options bundle with title, case reference, notes, and categories', async () => {
    const manifest = await createManifest(
      [file('proof content', 'proof.png')],
      {
        title: 'Municipal Water Contamination Proof',
        caseReference: 'GRC-2026-0045',
        notes: 'Collected tap water sample photographs and municipal challan',
        descriptions: { 'proof.png': 'Photograph of turbid water sample' },
        categories: { 'proof.png': EVIDENCE_CATEGORIES[4] },
      }
    );

    expect(manifest.title).toBe('Municipal Water Contamination Proof');
    expect(manifest.caseReference).toBe('GRC-2026-0045');
    expect(manifest.disclaimer).toBe(INTEGRITY_DISCLAIMER);
    expect(manifest.entries[0].category).toBe(EVIDENCE_CATEGORIES[4]);
    expect(manifest.entries[0].description).toBe('Photograph of turbid water sample');

    const parsed = parseManifest(JSON.stringify(manifest));
    expect(parsed.title).toBe('Municipal Water Contamination Proof');
  });

  it('provides rich verification details and summary metrics', async () => {
    const f1 = file('original data 1', 'file1.txt');
    const f2 = file('original data 2', 'file2.txt');
    const manifest = await createManifest([f1, f2], { 'file1.txt': 'first', 'file2.txt': 'second' });

    // Verify with 1 match, 1 changed, 1 extra
    const verifyCandidateFiles = [
      file('original data 1', 'file1.txt'),
      file('tampered data 2', 'file2.txt'),
      file('unrelated file', 'extra.txt'),
    ];

    const result = await verifyManifest(manifest, verifyCandidateFiles);
    expect(result.summary).toBeDefined();
    expect(result.summary.totalExpected).toBe(2);
    expect(result.summary.totalChecked).toBe(3);
    expect(result.summary.matchedCount).toBe(1);
    expect(result.summary.changedCount).toBe(1);
    expect(result.summary.missingCount).toBe(0);
    expect(result.summary.extraCount).toBe(1);
    expect(result.summary.isFullyIntact).toBe(false);

    expect(result.details.length).toBe(2);
    expect(result.details[0].expectedHash).toBeDefined();
    expect(result.details[0].actualHash).toBe(result.details[0].expectedHash);
    expect(result.details[1].actualHash).not.toBe(result.details[1].expectedHash);

    // Verify fully intact case
    const intactResult = await verifyManifest(manifest, [f1, f2]);
    expect(intactResult.summary.isFullyIntact).toBe(true);
    expect(intactResult.summary.matchedCount).toBe(2);
  });

  it('generates a clean markdown evidence schedule', async () => {
    const manifest = await createManifest([file('sample', 'receipt.pdf')], {
      title: 'RTE Challan Evidence',
      caseReference: 'RTE-121C-2026',
      descriptions: { 'receipt.pdf': 'School screening receipt' },
    });

    const markdown = generateEvidenceScheduleMarkdown(manifest);
    expect(markdown).toContain('# Evidence Dossier Manifest: RTE Challan Evidence');
    expect(markdown).toContain('receipt.pdf');
    expect(markdown).toContain('RTE-121C-2026');
    expect(markdown).toContain(INTEGRITY_DISCLAIMER);
  });

  it('computes a consistent manifest digest', async () => {
    const manifest = await createManifest([file('content', 'doc.pdf')]);
    const digest1 = await computeManifestDigest(manifest);
    const digest2 = await computeManifestDigest(manifest);

    expect(digest1).toBeDefined();
    expect(digest1.length).toBe(64);
    expect(digest1).toBe(digest2);
  });
});
