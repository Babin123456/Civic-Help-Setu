import { describe, it, expect, beforeEach } from 'vitest';
import {
  MANIFEST_SCHEMA_VERSION,
  INGESTION_POLICY_VERSION,
  DATA_CLASSIFICATIONS,
  BATCH_STATUS,
  REASON_CODES,
  computeSha256Hex,
  canonicalizeManifest,
  signManifestHmac,
  verifyManifestHmac,
  createMemoryStorageAdapter,
  createIngestionStorageAdapter,
  createFirestoreIngestionStorageAdapter,
  createPartnerIngestionBoundary,
  createPartnerIngestionHandler,
  bearerToken,
} from '../api/_lib/partnerIngestionBoundary.js';
import { buildPartnerIngestionHandler } from '../api/partner-ingestion.js';

describe('Partner Ingestion Boundary Engine (#1275)', () => {
  let currentTime;
  let mockNow;
  let storage;
  let engine;
  let auditLogs;

  const TEST_SECRET = 'partner_secret_test_key_super_secure_32bytes!';
  const PARTNER_ID = 'partner_civic_org_01';
  const KEY_ID = 'key_2026_primary';

  beforeEach(async () => {
    currentTime = 1700000000000;
    mockNow = () => currentTime;
    auditLogs = [];
    storage = createMemoryStorageAdapter();

    // Register active test partner
    await storage.registerPartner({
      partnerId: PARTNER_ID,
      name: 'Civic Data Partner',
      status: 'ACTIVE',
      allowedClassifications: [DATA_CLASSIFICATIONS.PUBLIC, DATA_CLASSIFICATIONS.OFFICIAL],
    });

    // Register active test key
    await storage.registerKey({
      partnerId: PARTNER_ID,
      keyId: KEY_ID,
      secretKey: TEST_SECRET,
      status: 'ACTIVE',
      revoked: false,
    });

    engine = createPartnerIngestionBoundary({
      storage,
      audit: (entry) => auditLogs.push(entry),
      now: mockNow,
    });
  });

  let nonceSeq = 0;

  const createValidPackage = async (overrides = {}, fileOverrides = {}) => {
    nonceSeq += 1;
    const currentSeq = nonceSeq;
    const fileContent = fileOverrides.content || 'name,category\nWater Aid,utilities\n';
    const fileBytes = new TextEncoder().encode(fileContent);
    const fileSha256 = await computeSha256Hex(fileBytes);

    const manifest = {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      manifestId: overrides.manifestId || `man_test_${currentSeq}`,
      partnerId: overrides.partnerId || PARTNER_ID,
      keyId: overrides.keyId || KEY_ID,
      issuedAt: overrides.issuedAt || new Date(currentTime).toISOString(),
      expiresAt: overrides.expiresAt || new Date(currentTime + 3600000).toISOString(), // +1 hour
      nonce: overrides.nonce !== undefined ? overrides.nonce : `nonce_rand_${currentSeq}`,
      dataClassification: overrides.dataClassification || DATA_CLASSIFICATIONS.PUBLIC,
      files: [
        {
          name: 'dataset.csv',
          sha256: fileSha256,
          sizeBytes: fileBytes.byteLength,
        },
      ],
      ...overrides,
    };

    const canonicalStr = canonicalizeManifest(manifest);
    const signature = overrides.signature || (await signManifestHmac(canonicalStr, TEST_SECRET));

    return {
      manifest,
      files: {
        'dataset.csv': fileContent,
      },
      signature,
    };
  };

  describe('Cryptographic Helpers & Web Crypto Operations', () => {
    it('computes consistent SHA-256 digests using Web Crypto', async () => {
      const digest1 = await computeSha256Hex('civic dataset payload');
      const digest2 = await computeSha256Hex('civic dataset payload');
      expect(digest1).toBe(digest2);
      expect(digest1).toHaveLength(64);
      expect(digest1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('canonicalizes manifests by sorting keys and excluding signature field', () => {
      const m1 = { b: 2, a: 1, signature: 'to_ignore' };
      const m2 = { a: 1, b: 2 };
      expect(canonicalizeManifest(m1)).toBe(canonicalizeManifest(m2));
      expect(canonicalizeManifest(m1)).toBe('{"a":1,"b":2}');
    });

    it('signs and verifies HMAC signatures using crypto.subtle', async () => {
      const payload = 'canonical_test_string';
      const sig = await signManifestHmac(payload, TEST_SECRET);
      expect(await verifyManifestHmac(payload, sig, TEST_SECRET)).toBe(true);
      expect(await verifyManifestHmac(payload, sig, 'wrong_secret')).toBe(false);
      expect(await verifyManifestHmac('tampered_payload', sig, TEST_SECRET)).toBe(false);
      expect(await verifyManifestHmac(payload, 'not_a_hex_sig', TEST_SECRET)).toBe(false);
    });
  });

  describe('Storage Adapter & Contract', () => {
    it('verifies in-memory storage adapter marks isDurable as false', () => {
      const mem = createMemoryStorageAdapter();
      expect(mem.isDurable).toBe(false);
    });

    it('validates custom durable storage adapter contract', () => {
      expect(() => createIngestionStorageAdapter({})).toThrow(TypeError);
      const valid = createIngestionStorageAdapter({
        read: async () => null,
        write: async () => true,
        remove: async () => true,
        consumeNonce: async () => true,
      });
      expect(valid.isDurable).toBe(true);
    });
  });

  describe('Fixed 7-Step Verification Order & Reason Codes', () => {
    it('verifies a fully valid partner package (Happy Path)', async () => {
      const pkg = await createValidPackage();
      const res = await engine.verifyAndIngestPackage(pkg);

      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      expect(res.decision).toBe('PROMOTE_ELIGIBLE');
      expect(res.record).toMatchObject({
        status: BATCH_STATUS.ACCEPTED,
        partnerId: PARTNER_ID,
        keyId: KEY_ID,
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        policyVersion: INGESTION_POLICY_VERSION,
        dataClassification: DATA_CLASSIFICATIONS.PUBLIC,
      });

      expect(auditLogs).toContainEqual(
        expect.objectContaining({
          action: 'PARTNER_PACKAGE_ACCEPTED',
          partnerId: PARTNER_ID,
          keyId: KEY_ID,
        })
      );
    });

    it('Step 1: Rejects missing required manifest fields or invalid schema version', async () => {
      // Invalid schema version
      const pkgBadSchema = await createValidPackage({ schemaVersion: 'v0.9_unsupported' });
      const res1 = await engine.verifyAndIngestPackage(pkgBadSchema);
      expect(res1.ok).toBe(false);
      expect(res1.failureStep).toBe(1);
      expect(res1.reasonCodes).toContain(REASON_CODES.ERR_SCHEMA_INVALID);

      // Missing required field: nonce
      const pkgNoNonce = await createValidPackage({ nonce: null });
      const res2 = await engine.verifyAndIngestPackage(pkgNoNonce);
      expect(res2.ok).toBe(false);
      expect(res2.failureStep).toBe(1);
      expect(res2.reasonCodes).toContain(REASON_CODES.ERR_REQUIRED_FIELD_MISSING);
    });

    it('Step 2: Rejects tampered manifest or invalid cryptographic signature', async () => {
      const pkg = await createValidPackage();
      // Tamper manifest content after signature was generated
      pkg.manifest.partnerId = 'tampered_partner';
      const res = await engine.verifyAndIngestPackage(pkg);

      expect(res.ok).toBe(false);
      expect(res.failureStep).toBe(2);
      expect(res.reasonCodes).toContain(REASON_CODES.ERR_SIGNATURE_INVALID);
    });

    it('Step 2: Rejects malformed signature strings', async () => {
      const pkg = await createValidPackage({ signature: 'invalid_non_hex_sig_xyz!' });
      const res = await engine.verifyAndIngestPackage(pkg);

      expect(res.ok).toBe(false);
      expect(res.failureStep).toBe(2);
      expect(res.reasonCodes).toContain(REASON_CODES.ERR_SIGNATURE_MALFORMED);
    });

    it('Step 3: Rejects revoked keys and unregistered partners', async () => {
      // Revoke the key
      await storage.revokeKey(PARTNER_ID, KEY_ID);

      const pkg = await createValidPackage();
      const res = await engine.verifyAndIngestPackage(pkg);

      // Note: Signature is mathematically valid for that key, but key status fails revocation check at Step 3
      expect(res.ok).toBe(false);
      expect(res.failureStep).toBe(3);
      expect(res.reasonCodes).toContain(REASON_CODES.ERR_KEY_REVOKED);

      const metrics = engine.getMetrics();
      expect(metrics.revokedKeyAttempts).toBe(1);
    });

    it('Step 4: Rejects expired manifests or manifests not yet valid', async () => {
      // Manifest expired in the past
      const pkgExpired = await createValidPackage({
        issuedAt: new Date(currentTime - 7200000).toISOString(), // -2h
        expiresAt: new Date(currentTime - 3600000).toISOString(), // -1h
      });
      const resExpired = await engine.verifyAndIngestPackage(pkgExpired);
      expect(resExpired.ok).toBe(false);
      expect(resExpired.failureStep).toBe(4);
      expect(resExpired.reasonCodes).toContain(REASON_CODES.ERR_MANIFEST_EXPIRED);

      // Manifest not yet valid (future issuedAt)
      const pkgFuture = await createValidPackage({
        issuedAt: new Date(currentTime + 3600000).toISOString(), // +1h
        expiresAt: new Date(currentTime + 7200000).toISOString(), // +2h
      });
      const resFuture = await engine.verifyAndIngestPackage(pkgFuture);
      expect(resFuture.ok).toBe(false);
      expect(resFuture.failureStep).toBe(4);
      expect(resFuture.reasonCodes).toContain(REASON_CODES.ERR_MANIFEST_NOT_YET_VALID);
    });

    it('Step 5: Rejects duplicate/replayed nonces', async () => {
      const pkg1 = await createValidPackage({ nonce: 'unique_nonce_123', manifestId: 'm1' });
      const res1 = await engine.verifyAndIngestPackage(pkg1);
      expect(res1.ok).toBe(true);

      // Replay identical nonce on new manifest
      const pkg2 = await createValidPackage({ nonce: 'unique_nonce_123', manifestId: 'm2' });
      const res2 = await engine.verifyAndIngestPackage(pkg2);
      expect(res2.ok).toBe(false);
      expect(res2.failureStep).toBe(5);
      expect(res2.reasonCodes).toContain(REASON_CODES.ERR_NONCE_REPLAYED);

      const metrics = engine.getMetrics();
      expect(metrics.replaysPrevented).toBe(1);
    });

    it('Step 6: Rejects missing files, size mismatches, and payload checksum mismatches', async () => {
      // Missing file in package
      const pkgMissing = await createValidPackage({ manifestId: 'm_miss' });
      delete pkgMissing.files['dataset.csv'];
      const resMiss = await engine.verifyAndIngestPackage(pkgMissing);
      expect(resMiss.ok).toBe(false);
      expect(resMiss.failureStep).toBe(6);
      expect(resMiss.reasonCodes).toContain(REASON_CODES.ERR_FILE_MISSING);

      // Tampered file content (checksum mismatch)
      const pkgTampered = await createValidPackage({ manifestId: 'm_tamp' });
      pkgTampered.files['dataset.csv'] = 'tampered,csv,row\n';
      const resTamp = await engine.verifyAndIngestPackage(pkgTampered);
      expect(resTamp.ok).toBe(false);
      expect(resTamp.failureStep).toBe(6);
      expect(
        resTamp.reasonCodes.includes(REASON_CODES.ERR_FILE_CHECKSUM_MISMATCH) ||
        resTamp.reasonCodes.includes(REASON_CODES.ERR_FILE_SIZE_MISMATCH)
      ).toBe(true);
    });

    it('Step 7: Rejects unauthorized data classifications', async () => {
      // Partner only authorized for PUBLIC and OFFICIAL, requesting RESTRICTED
      const pkgRestricted = await createValidPackage({
        manifestId: 'm_rest',
        dataClassification: DATA_CLASSIFICATIONS.RESTRICTED,
      });
      const resRest = await engine.verifyAndIngestPackage(pkgRestricted);
      expect(resRest.ok).toBe(false);
      expect(resRest.failureStep).toBe(7);
      expect(resRest.reasonCodes).toContain(REASON_CODES.ERR_DATA_CLASSIFICATION_UNAUTHORIZED);
    });
  });

  describe('Concurrency & Replay Safety', () => {
    it('prevents concurrent double-submission with serialized nonce consumption', async () => {
      const pkg1 = await createValidPackage({ nonce: 'race_nonce_001', manifestId: 'race_m1' });
      const pkg2 = await createValidPackage({ nonce: 'race_nonce_001', manifestId: 'race_m2' });

      // Run two submissions concurrently with identical nonce
      const [res1, res2] = await Promise.all([
        engine.verifyAndIngestPackage(pkg1),
        engine.verifyAndIngestPackage(pkg2),
      ]);

      const successCount = (res1.ok ? 1 : 0) + (res2.ok ? 1 : 0);
      const replayCount = (res1.reasonCodes?.includes(REASON_CODES.ERR_NONCE_REPLAYED) ? 1 : 0) +
                          (res2.reasonCodes?.includes(REASON_CODES.ERR_NONCE_REPLAYED) ? 1 : 0);

      expect(successCount).toBe(1);
      expect(replayCount).toBe(1);
    });
  });

  describe('Promotion Guards, Quarantine & Fail-Closed Production Rule', () => {
    it('prevents quarantined packages from ever being promoted', async () => {
      const pkgBad = await createValidPackage({
        manifestId: 'quar_pkg',
        nonce: null, // Fails Step 1
      });
      const ingestRes = await engine.verifyAndIngestPackage(pkgBad);
      expect(ingestRes.ok).toBe(false);

      // Attempt promoting the quarantined batch
      const promoteRes = await engine.promoteBatch('pkg_quar_pkg', { environment: 'development' });
      expect(promoteRes.ok).toBe(false);
      expect(promoteRes.reasonCode).toBe(REASON_CODES.ERR_PROMOTION_QUARANTINED);
    });

    it('fails closed when attempting promotion with in-memory storage in production mode', async () => {
      const pkg = await createValidPackage({ manifestId: 'prod_pkg' });
      const ingestRes = await engine.verifyAndIngestPackage(pkg);
      expect(ingestRes.ok).toBe(true);

      // Attempt promotion in production mode with in-memory adapter (isDurable: false)
      await expect(
        engine.promoteBatch(ingestRes.batchId, { environment: 'production' })
      ).rejects.toThrow('FAIL_CLOSED_PRODUCTION_DURABLE_STORAGE_REQUIRED');

      // Allowed in explicit test/development mode
      const devPromote = await engine.promoteBatch(ingestRes.batchId, { environment: 'test' });
      expect(devPromote.ok).toBe(true);
      expect(devPromote.batch.status).toBe(BATCH_STATUS.PROMOTED);
    });

    it('allows production promotion when a durable storage adapter is configured', async () => {
      const durableStore = new Map();
      const nonces = new Map();
      const durableAdapter = createIngestionStorageAdapter({
        async read(key) { return durableStore.get(key) || null; },
        async write(key, val) { durableStore.set(key, val); return true; },
        async remove(key) { return durableStore.delete(key); },
        async getBatch(id) { return durableStore.get(id) || null; },
        async saveBatch(batch) { durableStore.set(batch.batchId, batch); return true; },
        async getPartner() { return { status: 'ACTIVE', allowedClassifications: [DATA_CLASSIFICATIONS.PUBLIC] }; },
        async getKey() { return { status: 'ACTIVE', revoked: false, secretKey: TEST_SECRET }; },
        async consumeNonce(p, n) {
          if (nonces.has(`${p}:${n}`)) return false;
          nonces.set(`${p}:${n}`, true);
          return true;
        },
      });

      const durableEngine = createPartnerIngestionBoundary({
        storage: durableAdapter,
        now: mockNow,
      });

      const pkg = await createValidPackage({ manifestId: 'durable_pkg' });
      const ingestRes = await durableEngine.verifyAndIngestPackage(pkg);
      expect(ingestRes.ok).toBe(true);

      // Promotion succeeds in production because storage.isDurable is true
      const prodPromote = await durableEngine.promoteBatch(ingestRes.batchId, { environment: 'production' });
      expect(prodPromote.ok).toBe(true);
      expect(prodPromote.batch.status).toBe(BATCH_STATUS.PROMOTED);
    });
  });

  describe('Audit Logging & Non-Exposure of Secrets', () => {
    it('audit entries and batch records never expose raw key material or payload content', async () => {
      const pkg = await createValidPackage({ manifestId: 'audit_test' });
      await engine.verifyAndIngestPackage(pkg);

      expect(auditLogs).toHaveLength(1);
      const auditEntry = auditLogs[0];
      const serializedAudit = JSON.stringify(auditEntry);

      // Verify no secret key material is logged
      expect(serializedAudit).not.toContain(TEST_SECRET);
      expect(auditEntry).toHaveProperty('manifestDigest');
      expect(auditEntry).toHaveProperty('partnerId', PARTNER_ID);
      expect(auditEntry).toHaveProperty('keyId', KEY_ID);

      const savedBatch = await storage.getBatch('pkg_audit_test');
      const serializedBatch = JSON.stringify(savedBatch);
      expect(serializedBatch).not.toContain(TEST_SECRET);
      expect(serializedBatch).not.toContain('Water Aid'); // payload content not stored
    });
  });

  describe('Degraded Storage Handling & Resilience', () => {
    it('handles degraded storage read/write errors gracefully without unhandled exceptions', async () => {
      const badStorage = {
        isDurable: false,
        getPartner: async () => { throw new Error('Storage disk failure'); },
        getKey: async () => { throw new Error('Storage disk failure'); },
        saveBatch: async () => { throw new Error('Storage disk failure'); },
        consumeNonce: async () => { throw new Error('Storage disk failure'); },
      };

      const resilientEngine = createPartnerIngestionBoundary({
        storage: badStorage,
        now: mockNow,
      });

      const pkg = await createValidPackage({ manifestId: 'm_deg' });
      const res = await resilientEngine.verifyAndIngestPackage(pkg);
      expect(res.ok).toBe(false);
      expect(res.decision).toBe('QUARANTINED');
    });
  });

  const createMockFirestore = () => {
    const store = new Map();

    const getCollection = (colName) => {
      if (!store.has(colName)) store.set(colName, new Map());
      return store.get(colName);
    };

    return {
      collection(colName) {
        const col = getCollection(colName);
        return {
          doc(docId) {
            return {
              async get() {
                const data = col.get(docId);
                return {
                  exists: data !== undefined,
                  data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
                };
              },
              async set(data) {
                col.set(docId, JSON.parse(JSON.stringify(data)));
              },
              async update(patch) {
                const existing = col.get(docId) || {};
                col.set(docId, { ...existing, ...JSON.parse(JSON.stringify(patch)) });
              },
              async delete() {
                col.delete(docId);
              },
            };
          },
        };
      },
      async runTransaction(updateFunction) {
        const transaction = {
          async get(ref) {
            return ref.get();
          },
          set(ref, data) {
            return ref.set(data);
          },
        };
        return updateFunction(transaction);
      },
      _rawStore: store,
    };
  };

  describe('Firestore Ingestion Storage Adapter (#1275 Slice 2)', () => {
    let mockDb;
    let firestoreAdapter;

    beforeEach(async () => {
      mockDb = createMockFirestore();
      firestoreAdapter = createFirestoreIngestionStorageAdapter({
        db: mockDb,
        now: mockNow,
      });

      await firestoreAdapter.registerPartner({
        partnerId: PARTNER_ID,
        name: 'Durable Partner',
        status: 'ACTIVE',
        allowedClassifications: [DATA_CLASSIFICATIONS.PUBLIC],
      });

      await firestoreAdapter.registerKey({
        partnerId: PARTNER_ID,
        keyId: KEY_ID,
        secretKey: TEST_SECRET,
        status: 'ACTIVE',
      });
    });

    it('verifies adapter is marked as isDurable: true when Firestore is provided', () => {
      expect(firestoreAdapter.isDurable).toBe(true);
    });

    it('registers, retrieves, and revokes partner keys', async () => {
      const key = await firestoreAdapter.getKey(PARTNER_ID, KEY_ID);
      expect(key).toMatchObject({
        partnerId: PARTNER_ID,
        keyId: KEY_ID,
        status: 'ACTIVE',
        revoked: false,
      });

      await firestoreAdapter.revokeKey(PARTNER_ID, KEY_ID);
      const revoked = await firestoreAdapter.getKey(PARTNER_ID, KEY_ID);
      expect(revoked.revoked).toBe(true);
      expect(revoked.status).toBe('REVOKED');
    });

    it('registers and retrieves partner profile', async () => {
      const partner = await firestoreAdapter.getPartner(PARTNER_ID);
      expect(partner).toMatchObject({
        partnerId: PARTNER_ID,
        name: 'Durable Partner',
        status: 'ACTIVE',
      });
    });

    it('atomically consumes nonce and rejects replays via Firestore transaction', async () => {
      const consumed1 = await firestoreAdapter.consumeNonce(PARTNER_ID, 'fs_nonce_1', currentTime + 3600000);
      expect(consumed1).toBe(true);

      // Replay attempt with same nonce
      const consumed2 = await firestoreAdapter.consumeNonce(PARTNER_ID, 'fs_nonce_1', currentTime + 3600000);
      expect(consumed2).toBe(false);
    });

    it('allows consuming expired nonces while rejecting active nonces', async () => {
      // Nonce expired 10 minutes ago
      await firestoreAdapter.consumeNonce(PARTNER_ID, 'expired_nonce', currentTime - 600000);

      // Now consumed at currentTime -> should overwrite expired doc and return true
      const consumedNow = await firestoreAdapter.consumeNonce(PARTNER_ID, 'expired_nonce', currentTime + 3600000);
      expect(consumedNow).toBe(true);
    });

    it('saves, reads, and deletes batch records', async () => {
      const batch = {
        batchId: 'batch_fs_01',
        partnerId: PARTNER_ID,
        status: BATCH_STATUS.ACCEPTED,
      };
      await firestoreAdapter.saveBatch(batch);

      const retrieved = await firestoreAdapter.getBatch('batch_fs_01');
      expect(retrieved).toMatchObject({
        batchId: 'batch_fs_01',
        status: BATCH_STATUS.ACCEPTED,
      });

      // Contract read / write / remove
      await firestoreAdapter.write('contract_k', { val: 42 });
      const readVal = await firestoreAdapter.read('contract_k');
      expect(readVal.val).toBe(42);

      await firestoreAdapter.remove('contract_k');
      const deletedVal = await firestoreAdapter.read('contract_k');
      expect(deletedVal).toBeNull();
    });

    it('falls back to memory adapter when getDb returns null (unconfigured), marking isDurable: false', async () => {
      const unconfiguredAdapter = createFirestoreIngestionStorageAdapter({
        getDb: async () => null,
        now: mockNow,
      });

      expect(unconfiguredAdapter.isDurable).toBe(false);
      await unconfiguredAdapter.registerPartner({ partnerId: 'mem_p1', status: 'ACTIVE' });
      const p = await unconfiguredAdapter.getPartner('mem_p1');
      expect(p.partnerId).toBe('mem_p1');
    });

    it('catches Firestore operation errors and gracefully falls back to memory', async () => {
      const failingDb = {
        collection() {
          throw new Error('Firestore connection timeout');
        },
      };
      const resilientFsAdapter = createFirestoreIngestionStorageAdapter({
        db: failingDb,
        now: mockNow,
      });

      await resilientFsAdapter.registerPartner({ partnerId: 'p_res', status: 'ACTIVE' });
      const p = await resilientFsAdapter.getPartner('p_res');
      expect(p.partnerId).toBe('p_res');
    });
  });

  describe('Partner Ingestion HTTP API Handler (#1275 Slice 2)', () => {
    let mockSession;
    let handler;
    let handlerStorage;
    let handlerEngine;

    const TOKEN = 'valid_test_token_partner_boundary';

    beforeEach(async () => {
      handlerStorage = createMemoryStorageAdapter({ now: mockNow });
      await handlerStorage.registerPartner({
        partnerId: PARTNER_ID,
        status: 'ACTIVE',
        allowedClassifications: [DATA_CLASSIFICATIONS.PUBLIC, DATA_CLASSIFICATIONS.OFFICIAL],
      });
      await handlerStorage.registerKey({
        partnerId: PARTNER_ID,
        keyId: KEY_ID,
        secretKey: TEST_SECRET,
        status: 'ACTIVE',
      });

      handlerEngine = createPartnerIngestionBoundary({
        storage: handlerStorage,
        now: mockNow,
      });

      mockSession = { userId: 'admin_user_01', role: 'admin' };

      handler = createPartnerIngestionHandler({
        boundary: handlerEngine,
        verifySession: async (token) => {
          if (token !== TOKEN) throw new Error('invalid_token');
          return mockSession;
        },
        environment: 'development',
      });
    });

    it('handles valid partner package submission (POST /api/partner-ingestion) returning 200', async () => {
      const pkg = await createValidPackage({ manifestId: 'http_man_1' });
      const res = await handler({
        method: 'POST',
        body: pkg,
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.decision).toBe('PROMOTE_ELIGIBLE');
      expect(res.body.batchId).toBe('pkg_http_man_1');
    });

    it('handles invalid partner package submission returning 400 with quarantine details', async () => {
      const pkg = await createValidPackage({ manifestId: 'http_bad_1', nonce: null });
      const res = await handler({
        method: 'POST',
        body: pkg,
      });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.decision).toBe('QUARANTINED');
      expect(res.body.failureStep).toBe(1);
      expect(res.body.reasonCodes).toContain(REASON_CODES.ERR_REQUIRED_FIELD_MISSING);
    });

    it('enforces IP rate limiting returning 429 and Retry-After header', async () => {
      const limitedHandler = createPartnerIngestionHandler({
        boundary: handlerEngine,
        ipLimiter: {
          take: () => ({ allowed: false, retryAfterSeconds: 30 }),
        },
      });

      const res = await limitedHandler({
        method: 'POST',
        headers: { 'x-forwarded-for': '198.51.100.1' },
        body: {},
      });

      expect(res.status).toBe(429);
      expect(res.body.error).toBe('rate_limited');
      expect(res.headers['Retry-After']).toBe('30');
    });

    it('GET ?batchId returns batch record for authenticated user', async () => {
      const pkg = await createValidPackage({ manifestId: 'lookup_man' });
      await handler({ method: 'POST', body: pkg });

      const res = await handler({
        method: 'GET',
        headers: { authorization: `Bearer ${TOKEN}` },
        query: { batchId: 'pkg_lookup_man' },
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.batch).toMatchObject({
        batchId: 'pkg_lookup_man',
        status: BATCH_STATUS.ACCEPTED,
        partnerId: PARTNER_ID,
      });
    });

    it('GET ?batchId rejects unauthenticated requests with 401', async () => {
      const res = await handler({
        method: 'GET',
        query: { batchId: 'pkg_any' },
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });

    it('GET ?batchId returns 404 for non-existent batch', async () => {
      const res = await handler({
        method: 'GET',
        headers: { authorization: `Bearer ${TOKEN}` },
        query: { batchId: 'pkg_non_existent' },
      });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('batch_not_found');
    });

    it('POST action: "promote" promotes batch for admin role', async () => {
      const pkg = await createValidPackage({ manifestId: 'promote_man' });
      await handler({ method: 'POST', body: pkg });

      const res = await handler({
        method: 'POST',
        headers: { authorization: `Bearer ${TOKEN}` },
        body: { action: 'promote', batchId: 'pkg_promote_man' },
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.batch.status).toBe(BATCH_STATUS.PROMOTED);
    });

    it('POST action: "promote" rejects non-admin users with 403', async () => {
      mockSession = { userId: 'citizen_01', role: 'citizen' };

      const res = await handler({
        method: 'POST',
        headers: { authorization: `Bearer ${TOKEN}` },
        body: { action: 'promote', batchId: 'pkg_any' },
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('POST action: "promote" rejects quarantined batches with 400', async () => {
      const badPkg = await createValidPackage({ manifestId: 'quar_man', nonce: null });
      await handler({ method: 'POST', body: badPkg });

      const res = await handler({
        method: 'POST',
        headers: { authorization: `Bearer ${TOKEN}` },
        body: { action: 'promote', batchId: 'pkg_quar_man' },
      });

      expect(res.status).toBe(400);
      expect(res.body.reasonCode).toBe(REASON_CODES.ERR_PROMOTION_QUARANTINED);
    });

    it('POST action: "promote" fails closed (500) when memory storage is used in production', async () => {
      const prodHandler = createPartnerIngestionHandler({
        boundary: handlerEngine,
        verifySession: async () => ({ userId: 'admin_1', role: 'admin' }),
        environment: 'production',
      });

      const pkg = await createValidPackage({ manifestId: 'prod_fail_closed' });
      await prodHandler({ method: 'POST', body: pkg });

      const res = await prodHandler({
        method: 'POST',
        headers: { authorization: `Bearer ${TOKEN}` },
        body: { action: 'promote', batchId: 'pkg_prod_fail_closed' },
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('durable_storage_required');
      expect(res.body.reasonCode).toBe(REASON_CODES.FAIL_CLOSED_PRODUCTION_DURABLE_STORAGE_REQUIRED);
    });

    it('GET ?metrics=true returns telemetry for admin and rejects non-admin', async () => {
      const adminRes = await handler({
        method: 'GET',
        headers: { authorization: `Bearer ${TOKEN}` },
        query: { metrics: 'true' },
      });
      expect(adminRes.status).toBe(200);
      expect(adminRes.body.ok).toBe(true);
      expect(adminRes.body.metrics).toHaveProperty('totalProcessed');

      mockSession = { userId: 'citizen_01', role: 'citizen' };
      const citizenRes = await handler({
        method: 'GET',
        headers: { authorization: `Bearer ${TOKEN}` },
        query: { metrics: 'true' },
      });
      expect(citizenRes.status).toBe(403);
    });

    it('returns 405 Method Not Allowed for unsupported methods', async () => {
      const res = await handler({ method: 'DELETE' });
      expect(res.status).toBe(405);
      expect(res.body.error).toBe('method_not_allowed');
    });

    it('bearerToken helper extracts token correctly from headers', () => {
      expect(bearerToken({ authorization: 'Bearer token-1234567890' })).toBe('token-1234567890');
      expect(bearerToken({ Authorization: 'Bearer token-1234567890' })).toBe('token-1234567890');
      expect(bearerToken({ authorization: 'Basic xyz' })).toBeNull();
      expect(bearerToken({})).toBeNull();
    });
  });

  describe('End-to-End Persistence & State Continuity Across Re-instantiation', () => {
    it('prevents cross-instance nonce replay when boundary is re-instantiated against shared durable storage', async () => {
      const sharedDb = createMockFirestore();
      const storageA = createFirestoreIngestionStorageAdapter({ db: sharedDb, now: mockNow });
      const storageB = createFirestoreIngestionStorageAdapter({ db: sharedDb, now: mockNow });

      await storageA.registerPartner({
        partnerId: PARTNER_ID,
        status: 'ACTIVE',
        allowedClassifications: [DATA_CLASSIFICATIONS.PUBLIC],
      });
      await storageA.registerKey({
        partnerId: PARTNER_ID,
        keyId: KEY_ID,
        secretKey: TEST_SECRET,
        status: 'ACTIVE',
      });

      const engineA = createPartnerIngestionBoundary({ storage: storageA, now: mockNow });
      const engineB = createPartnerIngestionBoundary({ storage: storageB, now: mockNow });

      const pkg1 = await createValidPackage({ nonce: 'shared_nonce_999', manifestId: 'pkg_inst_A' });
      const resA = await engineA.verifyAndIngestPackage(pkg1);
      expect(resA.ok).toBe(true);

      const pkg2 = await createValidPackage({ nonce: 'shared_nonce_999', manifestId: 'pkg_inst_B' });
      const resB = await engineB.verifyAndIngestPackage(pkg2);
      expect(resB.ok).toBe(false);
      expect(resB.failureStep).toBe(5);
      expect(resB.reasonCodes).toContain(REASON_CODES.ERR_NONCE_REPLAYED);
    });

    it('enforces key revocation across boundary re-instantiations', async () => {
      const sharedDb = createMockFirestore();
      const storageA = createFirestoreIngestionStorageAdapter({ db: sharedDb, now: mockNow });
      const storageB = createFirestoreIngestionStorageAdapter({ db: sharedDb, now: mockNow });

      await storageA.registerPartner({ partnerId: PARTNER_ID, status: 'ACTIVE' });
      await storageA.registerKey({
        partnerId: PARTNER_ID,
        keyId: KEY_ID,
        secretKey: TEST_SECRET,
        status: 'ACTIVE',
      });

      const engineB = createPartnerIngestionBoundary({ storage: storageB, now: mockNow });

      await storageA.revokeKey(PARTNER_ID, KEY_ID);

      const pkg = await createValidPackage();
      const resB = await engineB.verifyAndIngestPackage(pkg);
      expect(resB.ok).toBe(false);
      expect(resB.failureStep).toBe(3);
      expect(resB.reasonCodes).toContain(REASON_CODES.ERR_KEY_REVOKED);
    });

    it('buildPartnerIngestionHandler builds route handler with default configurations', async () => {
      const h = await buildPartnerIngestionHandler();
      expect(typeof h).toBe('function');
      const res = await h({ method: 'GET', query: {} });
      expect(res.status).toBe(400);
    });
  });
});
