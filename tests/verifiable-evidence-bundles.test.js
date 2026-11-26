import { describe, it, expect } from 'vitest';
import apiRouter from '../api/[...path].js';
import handler from '../api/_lib/handlers/verifiable-evidence-bundles.js';
import {
  createInitialBundleManifest,
  computeEntryHash,
  computeManifestSeal,
  computeSha256Hex,
  GENESIS_PREV_HASH,
  EVIDENCE_SOURCE_TYPES,
  PROVENANCE_TIERS,
} from '../src/data/verifiableEvidenceBundleContract.js';

describe('api/verifiable-evidence-bundles endpoint (#1160)', () => {
  const createMockRes = () => {
    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      writableEnded: false,
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        this.writableEnded = true;
        return this;
      },
      end() {
        this.writableEnded = true;
        return this;
      },
    };
    return res;
  };

  it('handles GET request and returns service operational status', async () => {
    const req = { method: 'GET', headers: {} };
    const res = createMockRes();

    await handler(req, res);
    if (res.statusCode !== 200) console.log('DEBUG ERRORS:', res.body);

    expect(res.statusCode).toBe(200);
    expect(res.body.service).toBe('civic-verifiable-evidence-verifier');
    expect(res.body.status).toBe('OPERATIONAL');
    expect(res.body.supportedSchemaVersions).toContain('1.0.0');
    expect(res.body.disclaimer).toContain('Civic Help Setu Verifiable Evidence Bundles');
  });

  it('verifies a valid evidence bundle via POST and returns 200', async () => {
    const manifest = createInitialBundleManifest({
      id: 'GRV-API-01',
      title: 'Water Pipeline Burst',
      department: 'Delhi Jal Board',
    });

    const fileContent = 'valid_pipeline_leak_photo_bytes';
    const fileSha256 = await computeSha256Hex(fileContent);

    const entryData = {
      sequence: 1,
      entryId: 'ENT-API-001',
      timestamp: '2026-11-25T10:00:00.000Z',
      source: EVIDENCE_SOURCE_TYPES.CITIZEN_PHOTO,
      provenanceTier: PROVENANCE_TIERS.CITIZEN_ASSERTION,
      title: 'Water pipeline burst photo',
      userAnnotation: 'Road inundated',
      attachment: {
        fileName: 'burst.jpg',
        mimeType: 'image/jpeg',
        byteSize: fileContent.length,
        sha256: fileSha256,
      },
      previousEntryHash: GENESIS_PREV_HASH,
    };

    const entryHash = await computeEntryHash(entryData);
    const entry = { ...entryData, entryHash };
    manifest.entries = [entry];
    manifest.chainState = {
      entryCount: 1,
      rootHash: entryHash,
      latestEntryHash: entryHash,
    };
    manifest.chainState.manifestSeal = await computeManifestSeal(manifest);

    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: {
        manifest,
        enclosedFiles: {
          'ENT-API-001': fileContent,
        },
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.verified).toBe(true);
    expect(res.body.bundleId).toBe(manifest.bundleId);
    expect(res.body.status).toBe('VERIFIED');
    expect(res.body.checkedEntriesCount).toBe(1);
    expect(res.body.errors).toHaveLength(0);
  });

  it('returns 422 Unprocessable Entity when bundle manifest is tampered', async () => {
    const manifest = createInitialBundleManifest({
      id: 'GRV-API-02',
      title: 'Garbage Dump Overflow',
    });

    const entryData = {
      sequence: 1,
      entryId: 'ENT-API-002',
      timestamp: '2026-11-25T10:00:00.000Z',
      source: EVIDENCE_SOURCE_TYPES.CITIZEN_PHOTO,
      provenanceTier: PROVENANCE_TIERS.CITIZEN_ASSERTION,
      title: 'Original Title',
      previousEntryHash: GENESIS_PREV_HASH,
    };
    const entryHash = await computeEntryHash(entryData);
    manifest.entries = [{ ...entryData, entryHash }];
    manifest.chainState = {
      entryCount: 1,
      rootHash: entryHash,
      latestEntryHash: entryHash,
    };

    // Tampering with manifest title after hash calculation
    manifest.entries[0].title = 'TAMPERED TITLE AFTER SEAL';

    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { manifest },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.verified).toBe(false);
    expect(res.body.status).toBe('TAMPERED');
    expect(res.body.errors.some((e) => e.includes('Entry hash mismatch'))).toBe(true);
  });

  it('returns 400 Bad Request when request body is malformed or invalid schema', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { manifest: { schemaVersion: '999.0.0' } }, // invalid schema
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Schema Validation Failed');
  });

  it('routes through [...path].js dispatcher to verifiable-evidence-bundles', async () => {
    const req = {
      method: 'GET',
      headers: {},
      query: { path: ['verifiable-evidence-bundles'] },
    };
    const res = createMockRes();

    await apiRouter(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.service).toBe('civic-verifiable-evidence-verifier');
  });
});
