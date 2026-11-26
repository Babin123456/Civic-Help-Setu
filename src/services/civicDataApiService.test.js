import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  API_CLIENT_STATES,
  API_ERROR_CODES,
  CIVIC_DATA_API_STORAGE_KEYS,
  authenticateApiKey,
  changeApiClientState,
  createApiClient,
  createApiKey,
  ensureCivicDataApiSeed,
  executeReadOnlyQuery,
  getDatasetSchema,
  listAccessAudits,
  listApiClients,
  listApiKeys,
  listDatasets,
  listUsageAnomalies,
  reviewUsageAnomaly,
  revokeApiKey,
  rotateApiKey,
  validateRecordAgainstSchema,
  validateSchemaCompatibility,
} from './civicDataApiService';
import { setCurrentActor } from './accessControl';
import { DATASET_IDS, DATASET_DEFINITIONS, SCHEMA_DEFINITIONS } from '../data/civicDataApiCatalog';

const CITIZEN = { id: 'citizen-1', role: 'citizen', username: 'Developer One' };
const OTHER_CITIZEN = { id: 'citizen-2', role: 'citizen', username: 'Developer Two' };
const ADMIN = { id: 'admin-1', role: 'admin', username: 'API Administrator' };

const makeStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
    _map: map,
  };
};

const readStored = (storage, key) => JSON.parse(storage.getItem(key) || '[]');
const writeStored = (storage, key, value) => storage.setItem(key, JSON.stringify(value));

const setupClient = async (storage, overrides = {}) => {
  setCurrentActor(CITIZEN);
  const client = createApiClient({
    name: 'Ward dashboard prototype',
    description: 'Testing approved ward metrics and service locations.',
    environment: 'sandbox',
    allowedDatasetIds: [DATASET_IDS.SERVICE_LOCATIONS, DATASET_IDS.WARD_METRICS],
    ...overrides,
  }, { storage });
  const key = await createApiKey({ clientId: client.id, label: 'Sandbox test key' }, { storage });
  return { client, key };
};

describe('Civic Data API service (#773)', () => {
  let storage;

  beforeEach(() => {
    storage = makeStorage();
    setCurrentActor(null);
  });

  afterEach(() => {
    setCurrentActor(null);
  });

  describe('persistent seed and catalogue', () => {
    it('seeds approved datasets and schemas into empty storage without overwriting existing rows', () => {
      const seeded = ensureCivicDataApiSeed(storage);
      expect(seeded.datasets).toHaveLength(3);
      expect(seeded.schemas).toHaveLength(3);

      const custom = [{ ...DATASET_DEFINITIONS[0], id: 'custom-dataset', name: 'Custom dataset' }];
      writeStored(storage, CIVIC_DATA_API_STORAGE_KEYS.DATASET_CATALOG, custom);
      ensureCivicDataApiSeed(storage);
      expect(readStored(storage, CIVIC_DATA_API_STORAGE_KEYS.DATASET_CATALOG)).toHaveLength(1);
    });

    it('lists only approved public fields and exposes a stable versioned schema', () => {
      const datasets = listDatasets({ storage });
      expect(datasets.map((dataset) => dataset.id)).toEqual([
        DATASET_IDS.SERVICE_LOCATIONS,
        DATASET_IDS.PUBLIC_NOTICES,
        DATASET_IDS.WARD_METRICS,
      ]);
      const schema = getDatasetSchema(DATASET_IDS.SERVICE_LOCATIONS, 'v1', { storage });
      expect(schema.schemaVersion).toBe(1);
      expect(schema.fields.every((field) => field.public)).toBe(true);
    });
  });

  describe('authorization and ownership', () => {
    it('refuses anonymous API client creation', () => {
      expect(() => createApiClient({ name: 'Anon client' }, { storage })).toThrow(/Sign in/i);
    });

    it('activates sandbox clients immediately and keeps production requests pending until an administrator approves them', async () => {
      setCurrentActor(CITIZEN);
      const sandbox = createApiClient({ name: 'Sandbox client', environment: 'sandbox' }, { storage });
      expect(sandbox.state).toBe(API_CLIENT_STATES.ACTIVE);

      const production = createApiClient({ name: 'Production client', environment: 'production' }, { storage });
      expect(production.state).toBe(API_CLIENT_STATES.PENDING);

      setCurrentActor(ADMIN);
      expect(() => changeApiClientState(production.id, API_CLIENT_STATES.SUSPENDED, { reason: 'test', storage })).toThrow(/Invalid API client transition/i);
      const approved = changeApiClientState(production.id, API_CLIENT_STATES.ACTIVE, { reason: 'Approved after review', storage });
      expect(approved.state).toBe(API_CLIENT_STATES.ACTIVE);

      setCurrentActor(CITIZEN);
      expect(() => changeApiClientState(production.id, API_CLIENT_STATES.SUSPENDED, { reason: 'Not allowed', storage })).toThrow(/Administrator access/i);
    });

    it('shows a citizen only their own clients while administrators see all clients', () => {
      setCurrentActor(CITIZEN);
      createApiClient({ name: 'Client A' }, { storage });
      setCurrentActor(OTHER_CITIZEN);
      createApiClient({ name: 'Client B' }, { storage });
      expect(listApiClients({ storage })).toHaveLength(1);
      expect(listApiClients({ storage })[0].name).toBe('Client B');

      setCurrentActor(ADMIN);
      expect(listApiClients({ storage })).toHaveLength(2);
    });

    it('requires administrator permission to read append-only access audits', async () => {
      await setupClient(storage);
      setCurrentActor(CITIZEN);
      expect(() => listAccessAudits({ storage })).toThrow(/Administrator/i);
      setCurrentActor(ADMIN);
      const audits = listAccessAudits({ storage });
      expect(audits.some((audit) => audit.action === 'api_client_created')).toBe(true);
      expect(audits.some((audit) => audit.action === 'api_key_created')).toBe(true);
    });
  });

  describe('key governance', () => {
    it('stores only a SHA-256 key hash and never returns the hash from list views', async () => {
      const { key } = await setupClient(storage);
      const storedKeys = readStored(storage, CIVIC_DATA_API_STORAGE_KEYS.API_KEYS);
      expect(storedKeys[0].keyHash).toHaveLength(64);
      expect(storage.getItem(CIVIC_DATA_API_STORAGE_KEYS.API_KEYS)).not.toContain(key.plaintextKey);
      expect(key.key).not.toHaveProperty('keyHash');
      const listed = listApiKeys(key.key.clientId, { storage });
      expect(listed[0]).not.toHaveProperty('keyHash');
    });

    it('authenticates an active key and rejects the old key after rotation', async () => {
      const { key } = await setupClient(storage);
      const authenticated = await authenticateApiKey(key.plaintextKey, { storage });
      expect(authenticated.client.id).toBe(key.key.clientId);

      const rotated = await rotateApiKey({ keyId: key.key.id, reason: 'Scheduled rotation' }, { storage });
      expect(rotated.revokedKeyId).toBe(key.key.id);
      await expect(authenticateApiKey(key.plaintextKey, { storage })).rejects.toMatchObject({ code: API_ERROR_CODES.KEY_REVOKED });
      await expect(authenticateApiKey(rotated.plaintextKey, { storage })).resolves.toBeTruthy();
      setCurrentActor(ADMIN);
      const audits = listAccessAudits({ storage });
      expect(audits.some((audit) => audit.action === 'api_key_rotated')).toBe(true);
    });

    it('revokes a key and requires a reason', async () => {
      const { key } = await setupClient(storage);
      expect(() => revokeApiKey({ keyId: key.key.id, reason: '' }, { storage })).toThrow(/reason/i);
      revokeApiKey({ keyId: key.key.id, reason: 'Developer request' }, { storage });
      await expect(authenticateApiKey(key.plaintextKey, { storage })).rejects.toMatchObject({ code: API_ERROR_CODES.KEY_REVOKED });
    });

    it('revokes all active keys when a client is revoked', async () => {
      const { client, key } = await setupClient(storage);
      changeApiClientState(client.id, API_CLIENT_STATES.REVOKED, { reason: 'Owner request', storage });
      await expect(authenticateApiKey(key.plaintextKey, { storage })).rejects.toMatchObject({ code: API_ERROR_CODES.KEY_REVOKED });
      expect(listApiKeys(client.id, { storage }).every((item) => item.state === 'revoked')).toBe(true);
    });
  });

  describe('read-only queries, pagination and scoping', () => {
    it('paginates deterministically and returns bounded metadata', async () => {
      const { key } = await setupClient(storage);
      const first = await executeReadOnlyQuery({
        apiKey: key.plaintextKey,
        datasetId: DATASET_IDS.SERVICE_LOCATIONS,
        page: 1,
        pageSize: 5,
      }, { storage });
      expect(first.data).toHaveLength(5);
      expect(first.meta.total).toBe(18);
      expect(first.meta.totalPages).toBe(4);

      const last = await executeReadOnlyQuery({
        apiKey: key.plaintextKey,
        datasetId: DATASET_IDS.SERVICE_LOCATIONS,
        page: 4,
        pageSize: 5,
      }, { storage });
      expect(last.data).toHaveLength(3);
      expect(last.meta.hasNextPage).toBe(false);
      await expect(executeReadOnlyQuery({
        apiKey: key.plaintextKey,
        datasetId: DATASET_IDS.SERVICE_LOCATIONS,
        page: 0,
        pageSize: 5,
      }, { storage })).rejects.toMatchObject({ code: API_ERROR_CODES.INVALID_PAGINATION });
    });

    it('rejects filters outside the dataset allow-list', async () => {
      const { key } = await setupClient(storage);
      await expect(executeReadOnlyQuery({
        apiKey: key.plaintextKey,
        datasetId: DATASET_IDS.SERVICE_LOCATIONS,
        filters: { citizenName: 'Asha' },
      }, { storage })).rejects.toMatchObject({ code: API_ERROR_CODES.INVALID_FILTER });
    });

    it('enforces the client jurisdiction even when the caller omits filters', async () => {
      const { key } = await setupClient(storage, { jurisdiction: { state: 'Karnataka', district: 'All' } });
      const response = await executeReadOnlyQuery({
        apiKey: key.plaintextKey,
        datasetId: DATASET_IDS.SERVICE_LOCATIONS,
        pageSize: 50,
      }, { storage });
      expect(response.data.length).toBeGreaterThan(0);
      expect(response.data.every((row) => row.state === 'Karnataka')).toBe(true);
      await expect(executeReadOnlyQuery({
        apiKey: key.plaintextKey,
        datasetId: DATASET_IDS.SERVICE_LOCATIONS,
        filters: { state: 'Delhi' },
      }, { storage })).rejects.toMatchObject({ code: API_ERROR_CODES.SCOPE_DENIED });
    });

    it('rejects dataset requests outside the client scope', async () => {
      const { key } = await setupClient(storage, { allowedDatasetIds: [DATASET_IDS.WARD_METRICS] });
      await expect(executeReadOnlyQuery({
        apiKey: key.plaintextKey,
        datasetId: DATASET_IDS.PUBLIC_NOTICES,
      }, { storage })).rejects.toMatchObject({ code: API_ERROR_CODES.SCOPE_DENIED });
    });
  });

  describe('rate limits and quotas', () => {
    it('blocks requests above the per-minute rate limit with a retry hint', async () => {
      const { client, key } = await setupClient(storage);
      const clients = readStored(storage, CIVIC_DATA_API_STORAGE_KEYS.API_CLIENTS);
      clients[0].rateLimitPerMinute = 2;
      writeStored(storage, CIVIC_DATA_API_STORAGE_KEYS.API_CLIENTS, clients);

      const payload = { apiKey: key.plaintextKey, datasetId: DATASET_IDS.WARD_METRICS, pageSize: 2 };
      await executeReadOnlyQuery(payload, { storage });
      await executeReadOnlyQuery(payload, { storage });
      await expect(executeReadOnlyQuery(payload, { storage })).rejects.toMatchObject({
        code: API_ERROR_CODES.RATE_LIMITED,
        meta: { retryAfterSeconds: expect.any(Number) },
      });
      expect(client.id).toBeTruthy();
    });

    it('blocks requests above the daily quota and reports the reset window', async () => {
      const { key } = await setupClient(storage);
      const clients = readStored(storage, CIVIC_DATA_API_STORAGE_KEYS.API_CLIENTS);
      clients[0].dailyQuota = 1;
      writeStored(storage, CIVIC_DATA_API_STORAGE_KEYS.API_CLIENTS, clients);

      const payload = { apiKey: key.plaintextKey, datasetId: DATASET_IDS.WARD_METRICS, pageSize: 2 };
      await executeReadOnlyQuery(payload, { storage });
      await expect(executeReadOnlyQuery(payload, { storage })).rejects.toMatchObject({
        code: API_ERROR_CODES.QUOTA_EXCEEDED,
        meta: { retryAfterSeconds: expect.any(Number) },
      });
    });
  });

  describe('data minimisation and schema safety', () => {
    it('returns only explicitly public fields and no credentials or citizen records', async () => {
      const { key } = await setupClient(storage);
      const response = await executeReadOnlyQuery({
        apiKey: key.plaintextKey,
        datasetId: DATASET_IDS.SERVICE_LOCATIONS,
        pageSize: 50,
      }, { storage });
      const dataset = listDatasets({ storage }).find((item) => item.id === DATASET_IDS.SERVICE_LOCATIONS);
      const schema = getDatasetSchema(DATASET_IDS.SERVICE_LOCATIONS, 'v1', { storage });
      for (const row of response.data) {
        expect(Object.keys(row).every((field) => dataset.publicFields.includes(field))).toBe(true);
        expect(validateRecordAgainstSchema(row, schema).valid).toBe(true);
      }
      const serialized = JSON.stringify(response);
      expect(serialized).not.toContain('keyHash');
      expect(serialized).not.toContain(key.plaintextKey);
      expect(serialized).not.toContain('applicantName');
      expect(response.meta.synthetic).toBe(true);
      expect(response.meta.source).toBeTruthy();
      expect(response.meta.generatedAt).toBeTruthy();
    });

    it('refuses to expose a field outside the public schema', async () => {
      const { key } = await setupClient(storage);
      await expect(executeReadOnlyQuery({
        apiKey: key.plaintextKey,
        datasetId: DATASET_IDS.SERVICE_LOCATIONS,
        fields: ['id', 'internalNotes'],
      }, { storage })).rejects.toMatchObject({ code: API_ERROR_CODES.SCOPE_DENIED });
    });

    it('detects breaking and non-breaking schema changes deterministically', () => {
      const current = SCHEMA_DEFINITIONS[0];
      const compatible = {
        ...current,
        fields: [
          ...current.fields,
          { name: 'optionalNote', type: 'string', required: false, public: true, maxLength: 100 },
        ],
      };
      expect(validateSchemaCompatibility(current, compatible).compatible).toBe(true);

      const breaking = {
        ...current,
        fields: current.fields.filter((field) => field.name !== 'district'),
      };
      const result = validateSchemaCompatibility(current, breaking);
      expect(result.compatible).toBe(false);
      expect(result.breakingChanges[0]).toMatchObject({ field: 'district', change: 'removed_field' });
    });
  });

  describe('usage anomalies and human review', () => {
    it('explains deterministic anomalies and records an administrator decision', async () => {
      const { client } = await setupClient(storage);
      setCurrentActor(ADMIN);
      const today = new Date().toISOString().slice(0, 10);
      writeStored(storage, CIVIC_DATA_API_STORAGE_KEYS.API_USAGE_DAILY, [{
        id: `usage_${client.id}_${DATASET_IDS.WARD_METRICS}_${today}`,
        clientId: client.id,
        datasetId: DATASET_IDS.WARD_METRICS,
        date: today,
        requestCount: 240,
        errorCount: 55,
        bytes: 1200,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: client.ownerId,
        schemaVersion: 1,
      }]);
      writeStored(storage, CIVIC_DATA_API_STORAGE_KEYS.RATE_LIMIT_EVENTS, [1, 2, 3].map((value) => ({
        id: `event_${value}`,
        clientId: client.id,
        keyId: 'key_test',
        at: new Date().toISOString(),
        outcome: 'blocked',
        schemaVersion: 1,
      })));

      const anomalies = listUsageAnomalies({ storage });
      expect(anomalies.map((anomaly) => anomaly.ruleId)).toEqual(expect.arrayContaining([
        'daily_quota_pressure',
        'repeated_rate_limits',
        'error_rate_pressure',
      ]));
      const anomaly = anomalies.find((item) => item.ruleId === 'daily_quota_pressure');
      expect(anomaly.ruleVersion).toBeTruthy();
      expect(anomaly.inputWindow.from).toBeTruthy();
      expect(anomaly.executedAt).toBeTruthy();
      expect(anomaly.sourceFields).toContain('api_usage_daily.requestCount');

      expect(() => reviewUsageAnomaly({ anomalyId: anomaly.id, decision: 'rejected', reason: '' }, { storage })).toThrow(/reason/i);
      const review = reviewUsageAnomaly({ anomalyId: anomaly.id, decision: 'accepted', reason: 'Quota reviewed' }, { storage });
      expect(review.decision).toBe('accepted');
      expect(listUsageAnomalies({ storage }).find((item) => item.id === anomaly.id).status).toBe('accepted');
      expect(listAccessAudits({ storage }).some((audit) => audit.action === 'api_anomaly_reviewed')).toBe(true);
    });

    it('keeps anomaly review administrator-only', async () => {
      await setupClient(storage);
      setCurrentActor(CITIZEN);
      expect(() => listUsageAnomalies({ storage })).toThrow(/Administrator/i);
    });
  });
});
