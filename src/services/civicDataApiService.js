import { getCurrentActor, requirePermission, checkPermission } from './accessControl';
import { sanitizePlainText, safeHttpUrl } from '../utils/safeContent';
import {
  CIVIC_DATA_API_VERSION,
  DATASET_DEFINITIONS,
  DATASET_ROWS,
  SCHEMA_DEFINITIONS,
} from '../data/civicDataApiCatalog';

export const CIVIC_DATA_API_STORAGE_KEYS = Object.freeze({
  API_CLIENTS: 'civicbridge_api_clients_v1',
  API_KEYS: 'civicbridge_api_keys_v1',
  API_USAGE_DAILY: 'civicbridge_api_usage_daily_v1',
  DATASET_CATALOG: 'civicbridge_dataset_catalog_v1',
  SCHEMA_VERSIONS: 'civicbridge_schema_versions_v1',
  RATE_LIMIT_EVENTS: 'civicbridge_rate_limit_events_v1',
  ACCESS_AUDITS: 'civicbridge_access_audits_v1',
  ANOMALY_REVIEWS: 'civicbridge_api_anomaly_reviews_v1',
});

export const API_ENVIRONMENTS = Object.freeze({
  SANDBOX: 'sandbox',
  PRODUCTION: 'production',
});

export const API_CLIENT_STATES = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  REVOKED: 'revoked',
});

export const API_KEY_STATES = Object.freeze({
  ACTIVE: 'active',
  ROTATING: 'rotating',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
});

export const DATASET_STATES = Object.freeze({
  DRAFT: 'draft',
  APPROVED: 'approved',
  DEPRECATED: 'deprecated',
  ARCHIVED: 'archived',
});

export const API_ERROR_CODES = Object.freeze({
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_FILTER: 'INVALID_FILTER',
  INVALID_PAGINATION: 'INVALID_PAGINATION',
  INVALID_API_KEY: 'INVALID_API_KEY',
  KEY_REVOKED: 'KEY_REVOKED',
  KEY_EXPIRED: 'KEY_EXPIRED',
  CLIENT_NOT_ACTIVE: 'CLIENT_NOT_ACTIVE',
  DATASET_NOT_AVAILABLE: 'DATASET_NOT_AVAILABLE',
  SCOPE_DENIED: 'SCOPE_DENIED',
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  CRYPTO_UNAVAILABLE: 'CRYPTO_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});

export const CLIENT_TRANSITIONS = Object.freeze({
  [API_CLIENT_STATES.PENDING]: [API_CLIENT_STATES.ACTIVE, API_CLIENT_STATES.REVOKED],
  [API_CLIENT_STATES.ACTIVE]: [API_CLIENT_STATES.SUSPENDED, API_CLIENT_STATES.REVOKED],
  [API_CLIENT_STATES.SUSPENDED]: [API_CLIENT_STATES.ACTIVE, API_CLIENT_STATES.REVOKED],
  [API_CLIENT_STATES.REVOKED]: [],
});

export const DATASET_TRANSITIONS = Object.freeze({
  [DATASET_STATES.DRAFT]: [DATASET_STATES.APPROVED, DATASET_STATES.ARCHIVED],
  [DATASET_STATES.APPROVED]: [DATASET_STATES.DEPRECATED, DATASET_STATES.ARCHIVED],
  [DATASET_STATES.DEPRECATED]: [DATASET_STATES.APPROVED, DATASET_STATES.ARCHIVED],
  [DATASET_STATES.ARCHIVED]: [],
});

export const ANOMALY_RULE_VERSION = '1.0.0';
export const RATE_WINDOW_MS = 60_000;
export const RATE_EVENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const API_DATE_FORMAT_RE = /^\d{4}-\d{2}-\d{2}$/;
export const API_PERIOD_FORMAT_RE = /^\d{4}-\d{2}$/;

const TRANSACTION_KEYS = Object.values(CIVIC_DATA_API_STORAGE_KEYS);

const getStorage = (customStorage) => {
  if (customStorage) return customStorage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export class CivicDataApiError extends Error {
  constructor(message, code, meta = {}) {
    super(message);
    this.name = 'CivicDataApiError';
    this.code = code;
    this.meta = meta;
    this.status = meta.status || (code === API_ERROR_CODES.RATE_LIMITED || code === API_ERROR_CODES.QUOTA_EXCEEDED ? 429 : 400);
  }
}

const apiError = (message, code, meta = {}) => new CivicDataApiError(message, code, meta);

const safeReadJson = (storage, key, fallback) => {
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const safeWriteJson = (storage, key, value) => {
  if (!storage) throw apiError('Browser storage is unavailable.', API_ERROR_CODES.INTERNAL_ERROR, { status: 503 });
  storage.setItem(key, JSON.stringify(value));
};

const readList = (storage, key) => safeReadJson(storage, key, []);

const writeList = (storage, key, value) => safeWriteJson(storage, key, value);

const snapshotKeys = (storage) => new Map(TRANSACTION_KEYS.map((key) => [key, storage ? storage.getItem(key) : null]));

const restoreSnapshot = (storage, snapshot) => {
  if (!storage) return;
  for (const [key, value] of snapshot) {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  }
};

const runTransaction = (storage, work) => {
  const snapshot = snapshotKeys(storage);
  try {
    return work();
  } catch (error) {
    restoreSnapshot(storage, snapshot);
    throw error;
  }
};

const randomHex = (bytes = 16) => {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
    throw apiError('Secure random generation is unavailable.', API_ERROR_CODES.CRYPTO_UNAVAILABLE, { status: 503 });
  }
  const values = new Uint8Array(bytes);
  cryptoApi.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('');
};

const sha256Hex = async (value) => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw apiError('Secure hashing is unavailable.', API_ERROR_CODES.CRYPTO_UNAVAILABLE, { status: 503 });
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const toIso = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw apiError('Invalid timestamp.', API_ERROR_CODES.VALIDATION_ERROR);
  return date.toISOString();
};

const todayKey = (value) => toIso(value).slice(0, 10);

const nextUtcDayIso = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  const next = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  return new Date(next).toISOString();
};

const normalizeText = (value, maxLength, field) => {
  if (typeof value !== 'string') throw apiError(`${field} must be text.`, API_ERROR_CODES.VALIDATION_ERROR, { field });
  const clean = sanitizePlainText(value, { max: maxLength, multiline: false });
  if (!clean) throw apiError(`${field} is required.`, API_ERROR_CODES.VALIDATION_ERROR, { field });
  return clean;
};

const normalizeOptionalText = (value, maxLength, field) => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') throw apiError(`${field} must be text.`, API_ERROR_CODES.VALIDATION_ERROR, { field });
  return sanitizePlainText(value, { max: maxLength });
};

const isoOrEmpty = (value, field) => {
  if (!value) return '';
  if (!API_DATE_FORMAT_RE.test(value)) throw apiError(`${field} must use YYYY-MM-DD.`, API_ERROR_CODES.VALIDATION_ERROR, { field });
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw apiError(`${field} is not a valid date.`, API_ERROR_CODES.VALIDATION_ERROR, { field });
  return value;
};

const actorContext = () => {
  const actor = getCurrentActor();
  const role = actor && actor.role === 'admin' ? 'admin' : 'citizen';
  return {
    actor,
    actorId: actor?.id || null,
    actorRole: role,
    authenticated: Boolean(actor),
    label: actor?.username || actor?.fullName || actor?.email || 'Signed-in user',
  };
};

const assertSignedIn = () => {
  const context = actorContext();
  if (!context.authenticated) {
    throw apiError('Sign in to create or manage API credentials.', API_ERROR_CODES.UNAUTHENTICATED, { status: 401 });
  }
  requirePermission('civicDataApi.use');
  return context;
};

const isAdmin = (context = actorContext()) => context.actorRole === 'admin';

const assertAdmin = (reason) => {
  if (checkPermission('civicDataApi.admin') !== 'ok') {
    throw apiError(reason || 'Administrator access is required.', API_ERROR_CODES.FORBIDDEN, { status: 403 });
  }
  return actorContext();
};

const appendAudit = (storage, event, now) => {
  const list = readList(storage, CIVIC_DATA_API_STORAGE_KEYS.ACCESS_AUDITS);
  const context = actorContext();
  const record = {
    id: `audit_${randomHex(8)}`,
    action: event.action,
    actorId: event.actorId || context.actorId || 'anonymous',
    actorRole: event.actorRole || context.actorRole,
    clientId: event.clientId || null,
    datasetId: event.datasetId || null,
    keyId: event.keyId || null,
    reason: event.reason || '',
    metadata: event.metadata || {},
    createdAt: toIso(now),
    schemaVersion: 1,
  };
  list.push(record);
  writeList(storage, CIVIC_DATA_API_STORAGE_KEYS.ACCESS_AUDITS, list);
  return record;
};

const findClient = (clients, clientId) => clients.find((client) => client.id === clientId) || null;

const assertClientAccess = (client, context, { adminOnly = false } = {}) => {
  if (!client) throw apiError('API client not found.', API_ERROR_CODES.NOT_FOUND, { status: 404 });
  if (adminOnly) {
    assertAdmin('Administrator access is required for this API client operation.');
    return;
  }
  if (!isAdmin(context) && client.ownerId !== context.actorId) {
    throw apiError('You do not have access to this API client.', API_ERROR_CODES.FORBIDDEN, { status: 403 });
  }
};

const assertTransition = (current, next, transitions, resource) => {
  const allowed = transitions[current] || [];
  if (!allowed.includes(next)) {
    throw apiError(`Invalid ${resource} transition from ${current} to ${next}.`, API_ERROR_CODES.INVALID_TRANSITION, {
      status: 409,
      current,
      next,
      allowed,
    });
  }
};

const publicKeyView = (keyRecord) => ({
  id: keyRecord.id,
  clientId: keyRecord.clientId,
  label: keyRecord.label,
  keyPrefix: keyRecord.keyPrefix,
  keyLast4: keyRecord.keyLast4,
  state: keyRecord.state,
  environment: keyRecord.environment,
  expiresAt: keyRecord.expiresAt || null,
  createdAt: keyRecord.createdAt,
  updatedAt: keyRecord.updatedAt,
  lastUsedAt: keyRecord.lastUsedAt || null,
  rotatedFromKeyId: keyRecord.rotatedFromKeyId || null,
});

const publicClientView = (client, keys = []) => ({
  ...client,
  keys: keys.filter((key) => key.clientId === client.id).map(publicKeyView),
});

const pruneRateEvents = (events, nowMs) => events.filter((event) => {
  const at = Date.parse(event.at);
  return Number.isFinite(at) && nowMs - at <= RATE_EVENT_RETENTION_MS;
});

const getSchemaForDataset = (schemas, datasetId, version) => {
  if (version) return schemas.find((schema) => schema.datasetId === datasetId && schema.version === version) || null;
  return schemas.find((schema) => schema.datasetId === datasetId && schema.status === 'active') || null;
};

export function ensureCivicDataApiSeed(storageInput) {
  const storage = getStorage(storageInput);
  if (!storage) return { datasets: DATASET_DEFINITIONS, schemas: SCHEMA_DEFINITIONS };

  const existingCatalog = readList(storage, CIVIC_DATA_API_STORAGE_KEYS.DATASET_CATALOG);
  const existingSchemas = readList(storage, CIVIC_DATA_API_STORAGE_KEYS.SCHEMA_VERSIONS);

  if (existingCatalog.length === 0) {
    writeList(storage, CIVIC_DATA_API_STORAGE_KEYS.DATASET_CATALOG, DATASET_DEFINITIONS.map((dataset) => ({ ...dataset })));
  }
  if (existingSchemas.length === 0) {
    writeList(storage, CIVIC_DATA_API_STORAGE_KEYS.SCHEMA_VERSIONS, SCHEMA_DEFINITIONS.map((schema) => ({ ...schema })));
  }

  const datasets = readList(storage, CIVIC_DATA_API_STORAGE_KEYS.DATASET_CATALOG);
  const schemas = readList(storage, CIVIC_DATA_API_STORAGE_KEYS.SCHEMA_VERSIONS);
  return {
    datasets: datasets.length > 0 ? datasets : DATASET_DEFINITIONS.map((dataset) => ({ ...dataset })),
    schemas: schemas.length > 0 ? schemas : SCHEMA_DEFINITIONS.map((schema) => ({ ...schema })),
  };
}

export function listDatasets({ includeUnapproved = false, storage } = {}) {
  const store = getStorage(storage);
  const { datasets } = ensureCivicDataApiSeed(store);
  const list = includeUnapproved
    ? datasets
    : datasets.filter((dataset) => dataset.status === DATASET_STATES.APPROVED || dataset.status === DATASET_STATES.DEPRECATED);
  return list.map((dataset) => ({
    ...dataset,
    endpoint: `/api/${CIVIC_DATA_API_VERSION}/datasets/${dataset.id}/records`,
    schemaEndpoint: `/api/${CIVIC_DATA_API_VERSION}/datasets/${dataset.id}/schema`,
    recordCount: (DATASET_ROWS[dataset.id] || []).length,
  }));
}

export function getDataset(datasetId, { storage, includeUnapproved = false } = {}) {
  const dataset = listDatasets({ storage, includeUnapproved }).find((item) => item.id === datasetId);
  if (!dataset) throw apiError('Dataset not found.', API_ERROR_CODES.NOT_FOUND, { status: 404, datasetId });
  return dataset;
}

export function getDatasetSchema(datasetId, version, { storage } = {}) {
  const { schemas } = ensureCivicDataApiSeed(getStorage(storage));
  const schema = getSchemaForDataset(schemas, datasetId, version);
  if (!schema) throw apiError('Schema version not found.', API_ERROR_CODES.NOT_FOUND, { status: 404, datasetId, version });
  return {
    ...schema,
    fields: schema.fields.filter((field) => field.public),
  };
}

export function listApiClients({ storage, includeKeys = true } = {}) {
  const context = assertSignedIn();
  const store = getStorage(storage);
  const clients = readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_CLIENTS);
  const keys = includeKeys ? readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_KEYS) : [];
  const visible = isAdmin(context) ? clients : clients.filter((client) => client.ownerId === context.actorId);
  return visible.map((client) => publicClientView(client, keys));
}

export function createApiClient(
  { name, description = '', environment = API_ENVIRONMENTS.SANDBOX, allowedDatasetIds, jurisdiction = {} },
  { storage, now = new Date() } = {}
) {
  const context = assertSignedIn();
  const store = getStorage(storage);
  ensureCivicDataApiSeed(store);
  const cleanName = normalizeText(name, 80, 'name');
  const cleanDescription = normalizeOptionalText(description, 300, 'description');
  const env = environment === API_ENVIRONMENTS.PRODUCTION ? API_ENVIRONMENTS.PRODUCTION : API_ENVIRONMENTS.SANDBOX;

  const catalog = listDatasets({ storage: store }).map((dataset) => dataset.id);
  const requested = Array.isArray(allowedDatasetIds) && allowedDatasetIds.length > 0 ? allowedDatasetIds : catalog;
  if (requested.length > catalog.length) throw apiError('Too many datasets requested.', API_ERROR_CODES.VALIDATION_ERROR);
  const uniqueRequested = [...new Set(requested)];
  for (const datasetId of uniqueRequested) {
    if (!catalog.includes(datasetId)) {
      throw apiError(`Dataset ${datasetId} is not available.`, API_ERROR_CODES.DATASET_NOT_AVAILABLE, { datasetId });
    }
  }

  const scopeState = normalizeOptionalText(jurisdiction.state, 60, 'jurisdiction.state') || 'All';
  const scopeDistrict = normalizeOptionalText(jurisdiction.district, 60, 'jurisdiction.district') || 'All';
  const createdAt = toIso(now);
  const client = {
    id: `client_${randomHex(8)}`,
    name: cleanName,
    description: cleanDescription,
    environment: env,
    state: env === API_ENVIRONMENTS.SANDBOX ? API_CLIENT_STATES.ACTIVE : API_CLIENT_STATES.PENDING,
    ownerId: context.actorId,
    ownerRole: context.actorRole,
    allowedDatasetIds: uniqueRequested,
    jurisdiction: { state: scopeState, district: scopeDistrict },
    rateLimitPerMinute: env === API_ENVIRONMENTS.SANDBOX ? 30 : 120,
    dailyQuota: env === API_ENVIRONMENTS.SANDBOX ? 250 : 5000,
    createdAt,
    updatedAt: createdAt,
    createdBy: context.actorId,
    schemaVersion: 1,
  };

  const clients = readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_CLIENTS);
  clients.push(client);
  writeList(store, CIVIC_DATA_API_STORAGE_KEYS.API_CLIENTS, clients);
  appendAudit(store, {
    action: 'api_client_created',
    clientId: client.id,
    reason: cleanDescription,
    metadata: { environment: env, allowedDatasetIds: uniqueRequested, jurisdiction: client.jurisdiction },
  }, now);
  return publicClientView(client, []);
}

export function changeApiClientState(clientId, nextState, { reason = '', storage, now = new Date() } = {}) {
  const context = actorContext();
  const store = getStorage(storage);
  const clients = readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_CLIENTS);
  const client = findClient(clients, clientId);
  assertClientAccess(client, context, { adminOnly: nextState === API_CLIENT_STATES.ACTIVE || nextState === API_CLIENT_STATES.SUSPENDED });
  assertTransition(client.state, nextState, CLIENT_TRANSITIONS, 'API client');
  const cleanReason = normalizeOptionalText(reason, 300, 'reason');
  if ((nextState === API_CLIENT_STATES.SUSPENDED || nextState === API_CLIENT_STATES.REVOKED) && !cleanReason) {
    throw apiError('A reason is required when suspending or revoking an API client.', API_ERROR_CODES.VALIDATION_ERROR, { field: 'reason' });
  }

  client.state = nextState;
  client.updatedAt = toIso(now);
  writeList(store, CIVIC_DATA_API_STORAGE_KEYS.API_CLIENTS, clients);

  if (nextState === API_CLIENT_STATES.REVOKED || nextState === API_CLIENT_STATES.SUSPENDED) {
    const keys = readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_KEYS);
    let changed = false;
    for (const key of keys) {
      if (key.clientId === clientId && key.state === API_KEY_STATES.ACTIVE) {
        key.state = API_KEY_STATES.REVOKED;
        key.revokedAt = toIso(now);
        key.revokedReason = nextState === API_CLIENT_STATES.SUSPENDED ? 'client_suspended' : 'client_revoked';
        key.updatedAt = toIso(now);
        changed = true;
      }
    }
    if (changed) writeList(store, CIVIC_DATA_API_STORAGE_KEYS.API_KEYS, keys);
  }

  appendAudit(store, {
    action: `api_client_${nextState}`,
    clientId,
    reason: cleanReason,
  }, now);
  return publicClientView(client, readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_KEYS));
}

const buildKeyRecord = async ({ client, label, expiresAt, now, rotatedFromKeyId = null }) => {
  const secret = `cdk_${client.environment}_${randomHex(24)}`;
  const createdAt = toIso(now);
  return {
    record: {
      id: `key_${randomHex(8)}`,
      clientId: client.id,
      label,
      keyPrefix: secret.slice(0, 16),
      keyLast4: secret.slice(-4),
      keyHash: await sha256Hex(secret),
      state: API_KEY_STATES.ACTIVE,
      environment: client.environment,
      expiresAt: expiresAt ? toIso(expiresAt) : null,
      rotatedFromKeyId,
      rotatedToKeyId: null,
      createdAt,
      updatedAt: createdAt,
      createdBy: actorContext().actorId,
      schemaVersion: 1,
    },
    plaintextKey: secret,
  };
};

export async function createApiKey({ clientId, label = 'Default key', expiresAt = null }, { storage, now = new Date() } = {}) {
  const context = assertSignedIn();
  const store = getStorage(storage);
  const clients = readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_CLIENTS);
  const client = findClient(clients, clientId);
  assertClientAccess(client, context);
  if (client.state !== API_CLIENT_STATES.ACTIVE) {
    throw apiError('API client must be active before keys can be issued.', API_ERROR_CODES.CLIENT_NOT_ACTIVE, { status: 409, state: client.state });
  }
  if (expiresAt && new Date(expiresAt).getTime() <= (now instanceof Date ? now.getTime() : new Date(now).getTime())) {
    throw apiError('Key expiry must be in the future.', API_ERROR_CODES.VALIDATION_ERROR, { field: 'expiresAt' });
  }
  const cleanLabel = normalizeText(label, 60, 'label');
  const { record, plaintextKey } = await buildKeyRecord({ client, label: cleanLabel, expiresAt, now });

  const keys = readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_KEYS);
  keys.push(record);
  writeList(store, CIVIC_DATA_API_STORAGE_KEYS.API_KEYS, keys);
  appendAudit(store, {
    action: 'api_key_created',
    clientId,
    keyId: record.id,
    reason: cleanLabel,
  }, now);
  return { key: publicKeyView(record), plaintextKey };
}

export function listApiKeys(clientId, { storage } = {}) {
  const context = assertSignedIn();
  const store = getStorage(storage);
  const client = findClient(readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_CLIENTS), clientId);
  assertClientAccess(client, context);
  return readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_KEYS)
    .filter((key) => key.clientId === clientId)
    .map(publicKeyView);
}

export async function rotateApiKey({ keyId, reason = '' }, { storage, now = new Date() } = {}) {
  const context = assertSignedIn();
  const store = getStorage(storage);
  const keys = readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_KEYS);
  const previous = keys.find((key) => key.id === keyId);
  if (!previous) throw apiError('API key not found.', API_ERROR_CODES.NOT_FOUND, { status: 404, keyId });
  const clients = readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_CLIENTS);
  const client = findClient(clients, previous.clientId);
  assertClientAccess(client, context);
  if (previous.state !== API_KEY_STATES.ACTIVE) {
    throw apiError('Only an active key can be rotated.', API_ERROR_CODES.INVALID_TRANSITION, { status: 409, state: previous.state });
  }
  if (client.state !== API_CLIENT_STATES.ACTIVE) {
    throw apiError('API client must be active before keys can be rotated.', API_ERROR_CODES.CLIENT_NOT_ACTIVE, { status: 409 });
  }

  const { record, plaintextKey } = await buildKeyRecord({
    client,
    label: previous.label,
    expiresAt: previous.expiresAt,
    now,
    rotatedFromKeyId: previous.id,
  });

  return runTransaction(store, () => {
    previous.state = API_KEY_STATES.REVOKED;
    previous.revokedAt = toIso(now);
    previous.revokedReason = 'rotated';
    previous.rotatedToKeyId = record.id;
    previous.updatedAt = toIso(now);
    keys.push(record);
    writeList(store, CIVIC_DATA_API_STORAGE_KEYS.API_KEYS, keys);
    appendAudit(store, {
      action: 'api_key_rotated',
      clientId: client.id,
      keyId: previous.id,
      reason: normalizeOptionalText(reason, 300, 'reason') || 'Key rotation',
      metadata: { newKeyId: record.id },
    }, now);
    return { key: publicKeyView(record), plaintextKey, revokedKeyId: previous.id };
  });
}

export function revokeApiKey({ keyId, reason = '' }, { storage, now = new Date() } = {}) {
  const context = assertSignedIn();
  const store = getStorage(storage);
  const keys = readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_KEYS);
  const key = keys.find((item) => item.id === keyId);
  if (!key) throw apiError('API key not found.', API_ERROR_CODES.NOT_FOUND, { status: 404, keyId });
  const client = findClient(readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_CLIENTS), key.clientId);
  assertClientAccess(client, context);
  assertTransition(key.state, API_KEY_STATES.REVOKED, {
    [API_KEY_STATES.ACTIVE]: [API_KEY_STATES.REVOKED],
    [API_KEY_STATES.ROTATING]: [API_KEY_STATES.REVOKED],
    [API_KEY_STATES.REVOKED]: [],
    [API_KEY_STATES.EXPIRED]: [],
  }, 'API key');
  const cleanReason = normalizeOptionalText(reason, 300, 'reason');
  if (!cleanReason) throw apiError('A reason is required when revoking a key.', API_ERROR_CODES.VALIDATION_ERROR, { field: 'reason' });

  key.state = API_KEY_STATES.REVOKED;
  key.revokedAt = toIso(now);
  key.revokedReason = cleanReason;
  key.updatedAt = toIso(now);
  writeList(store, CIVIC_DATA_API_STORAGE_KEYS.API_KEYS, keys);
  appendAudit(store, {
    action: 'api_key_revoked',
    clientId: key.clientId,
    keyId: key.id,
    reason: cleanReason,
  }, now);
  return publicKeyView(key);
}

export async function authenticateApiKey(plaintextKey, { storage, now = new Date() } = {}) {
  if (typeof plaintextKey !== 'string' || plaintextKey.trim().length < 16) {
    throw apiError('A valid API key is required.', API_ERROR_CODES.INVALID_API_KEY, { status: 401 });
  }
  const store = getStorage(storage);
  const keyHash = await sha256Hex(plaintextKey.trim());
  const keys = readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_KEYS);
  const key = keys.find((item) => item.keyHash === keyHash);
  if (!key) throw apiError('API key was not recognised.', API_ERROR_CODES.INVALID_API_KEY, { status: 401 });
  if (key.state === API_KEY_STATES.REVOKED) {
    throw apiError('API key has been revoked.', API_ERROR_CODES.KEY_REVOKED, { status: 401 });
  }
  if (key.expiresAt && new Date(key.expiresAt).getTime() <= new Date(now).getTime()) {
    throw apiError('API key has expired.', API_ERROR_CODES.KEY_EXPIRED, { status: 401 });
  }
  const client = findClient(readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_CLIENTS), key.clientId);
  if (!client) throw apiError('API client not found.', API_ERROR_CODES.NOT_FOUND, { status: 404 });
  if (client.state !== API_CLIENT_STATES.ACTIVE) {
    throw apiError('API client is not active.', API_ERROR_CODES.CLIENT_NOT_ACTIVE, { status: 403, state: client.state });
  }
  return { key, client };
}

const assertAllowedFilters = (dataset, filters) => {
  if (filters === undefined || filters === null) return {};
  if (typeof filters !== 'object' || Array.isArray(filters)) {
    throw apiError('filters must be an object.', API_ERROR_CODES.VALIDATION_ERROR);
  }
  const allowed = new Set(dataset.filterFields);
  const output = {};
  for (const [name, rawValue] of Object.entries(filters)) {
    if (!allowed.has(name)) {
      throw apiError(`Filter "${name}" is not supported by this dataset.`, API_ERROR_CODES.INVALID_FILTER, { filter: name, allowed: [...allowed] });
    }
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;
    if (typeof rawValue !== 'string') {
      throw apiError(`Filter "${name}" must be text.`, API_ERROR_CODES.INVALID_FILTER, { filter: name });
    }
    if (rawValue.length > 100) {
      throw apiError(`Filter "${name}" is too long.`, API_ERROR_CODES.INVALID_FILTER, { filter: name });
    }
    if (name === 'issuedAfter' || name === 'issuedBefore') {
      output[name] = isoOrEmpty(rawValue.trim(), name);
    } else if (name === 'period') {
      if (!API_PERIOD_FORMAT_RE.test(rawValue.trim())) {
        throw apiError('period must use YYYY-MM.', API_ERROR_CODES.INVALID_FILTER, { filter: name });
      }
      output[name] = rawValue.trim();
    } else {
      output[name] = sanitizePlainText(rawValue, { max: 100, multiline: false }).trim();
    }
  }

  const schema = getSchemaForDataset(SCHEMA_DEFINITIONS, dataset.id);
  for (const field of schema?.fields || []) {
    if (field.type === 'enum' && output[field.name] && !field.values.includes(output[field.name])) {
      throw apiError(`Filter "${field.name}" must be one of ${field.values.join(', ')}.`, API_ERROR_CODES.INVALID_FILTER, {
        filter: field.name,
        allowed: field.values,
      });
    }
  }
  return output;
};

const assertScope = (client, filters) => {
  const state = client.jurisdiction?.state || 'All';
  const district = client.jurisdiction?.district || 'All';
  if (state !== 'All') {
    if (filters.state && filters.state.toLowerCase() !== state.toLowerCase()) {
      throw apiError('Requested state is outside this API client jurisdiction.', API_ERROR_CODES.SCOPE_DENIED, { status: 403 });
    }
    filters.state = state;
  }
  if (district !== 'All') {
    if (filters.district && filters.district.toLowerCase() !== district.toLowerCase()) {
      throw apiError('Requested district is outside this API client jurisdiction.', API_ERROR_CODES.SCOPE_DENIED, { status: 403 });
    }
    filters.district = district;
  }
  return filters;
};

const compareText = (left, right) => String(left).toLowerCase() === String(right).toLowerCase();

const applyFilters = (dataset, rows, filters, client) => {
  const scoped = assertScope(client, { ...filters });
  const q = (scoped.q || '').toLowerCase();
  return rows.filter((row) => {
    if (scoped.state && !compareText(row.state, scoped.state)) return false;
    if (scoped.district && !compareText(row.district, scoped.district)) return false;
    if (scoped.ward && !compareText(row.ward, scoped.ward)) return false;
    if (scoped.category && !compareText(row.category, scoped.category)) return false;
    if (scoped.metric && !compareText(row.metric, scoped.metric)) return false;
    if (scoped.period && row.period !== scoped.period) return false;
    if (scoped.issuedAfter && String(row.issuedAt) < scoped.issuedAfter) return false;
    if (scoped.issuedBefore && String(row.issuedAt) > scoped.issuedBefore) return false;
    if (q) {
      const matches = dataset.searchFields.some((field) => String(row[field] || '').toLowerCase().includes(q));
      if (!matches) return false;
    }
    return true;
  });
};

const pickFields = (row, fields) => fields.reduce((accumulator, field) => {
  if (Object.prototype.hasOwnProperty.call(row, field)) accumulator[field] = row[field];
  return accumulator;
}, {});

const parseFields = (dataset, fields) => {
  if (fields === undefined || fields === null || fields === '') return dataset.publicFields;
  const requested = Array.isArray(fields)
    ? fields
    : String(fields).split(',').map((value) => value.trim()).filter(Boolean);
  if (requested.length === 0) return dataset.publicFields;
  for (const field of requested) {
    if (!dataset.publicFields.includes(field)) {
      throw apiError(`Field "${field}" is not public for this dataset.`, API_ERROR_CODES.SCOPE_DENIED, { status: 403, field });
    }
  }
  return [...new Set(requested)];
};

const parsePagination = (dataset, page, pageSize) => {
  const parsedPage = page === undefined || page === null || page === '' ? 1 : Number(page);
  const parsedPageSize = pageSize === undefined || pageSize === null || pageSize === '' ? dataset.defaultPageSize : Number(pageSize);
  if (!Number.isInteger(parsedPage) || parsedPage < 1) {
    throw apiError('page must be a positive integer.', API_ERROR_CODES.INVALID_PAGINATION, { field: 'page' });
  }
  if (!Number.isInteger(parsedPageSize) || parsedPageSize < 1 || parsedPageSize > dataset.maxPageSize) {
    throw apiError(`pageSize must be between 1 and ${dataset.maxPageSize}.`, API_ERROR_CODES.INVALID_PAGINATION, {
      field: 'pageSize',
      max: dataset.maxPageSize,
    });
  }
  return { page: parsedPage, pageSize: parsedPageSize };
};

const getUsageRecord = (usage, clientId, datasetId, date) =>
  usage.find((record) => record.clientId === clientId && record.datasetId === datasetId && record.date === date) || null;

const currentDailyUsage = (usage, client) => usage
  .filter((record) => record.clientId === client.id)
  .reduce((total, record) => total + record.requestCount, 0);

const assertQuota = (usage, client, now) => {
  const used = currentDailyUsage(usage, client);
  if (used >= client.dailyQuota) {
    throw apiError('Daily API quota exceeded.', API_ERROR_CODES.QUOTA_EXCEEDED, {
      status: 429,
      quota: client.dailyQuota,
      used,
      retryAfterSeconds: Math.max(1, Math.ceil((new Date(nextUtcDayIso(now)).getTime() - new Date(now).getTime()) / 1000)),
    });
  }
  return { used, remaining: Math.max(0, client.dailyQuota - used) };
};

const enforceRateLimit = (events, client, key, nowIso, nowMs, storage) => {
  const recent = pruneRateEvents(events, nowMs).filter((event) => event.clientId === client.id && Date.parse(event.at) > nowMs - RATE_WINDOW_MS);
  if (recent.length >= client.rateLimitPerMinute) {
    const oldest = recent.reduce((earliest, event) => Math.min(earliest, Date.parse(event.at)), nowMs);
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + RATE_WINDOW_MS - nowMs) / 1000));
    events.push({
      id: `rle_${randomHex(8)}`,
      clientId: client.id,
      keyId: key.id,
      at: nowIso,
      outcome: 'blocked',
      retryAfterSeconds,
      reason: 'requests_per_minute_exceeded',
      schemaVersion: 1,
    });
    writeList(storage, CIVIC_DATA_API_STORAGE_KEYS.RATE_LIMIT_EVENTS, pruneRateEvents(events, nowMs));
    appendAudit(storage, {
      action: 'api_rate_limit_blocked',
      clientId: client.id,
      keyId: key.id,
      reason: 'requests_per_minute_exceeded',
      metadata: { retryAfterSeconds, limit: client.rateLimitPerMinute },
    }, nowIso);
    throw apiError('Rate limit exceeded.', API_ERROR_CODES.RATE_LIMITED, {
      status: 429,
      retryAfterSeconds,
      limit: client.rateLimitPerMinute,
    });
  }
  events.push({
    id: `rle_${randomHex(8)}`,
    clientId: client.id,
    keyId: key.id,
    at: nowIso,
    outcome: 'allowed',
    schemaVersion: 1,
  });
  writeList(storage, CIVIC_DATA_API_STORAGE_KEYS.RATE_LIMIT_EVENTS, pruneRateEvents(events, nowMs));
  return { limit: client.rateLimitPerMinute, remaining: Math.max(0, client.rateLimitPerMinute - recent.length - 1) };
};

const recordUsage = (usage, client, dataset, nowIso, byteSize) => {
  const date = todayKey(nowIso);
  let record = getUsageRecord(usage, client.id, dataset.id, date);
  if (!record) {
    record = {
      id: `usage_${client.id}_${dataset.id}_${date}`,
      clientId: client.id,
      datasetId: dataset.id,
      date,
      requestCount: 0,
      errorCount: 0,
      bytes: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: client.ownerId,
      schemaVersion: 1,
    };
    usage.push(record);
  }
  record.requestCount += 1;
  record.bytes += byteSize;
  record.lastRequestAt = nowIso;
  record.updatedAt = nowIso;
  return record;
};

const touchKey = (keys, keyId, nowIso) => {
  const key = keys.find((item) => item.id === keyId);
  if (!key) return;
  key.lastUsedAt = nowIso;
  key.updatedAt = nowIso;
};

export async function executeReadOnlyQuery(
  { apiKey, datasetId, page, pageSize, filters, fields, environment = API_ENVIRONMENTS.SANDBOX },
  { storage, now = new Date() } = {}
) {
  const store = getStorage(storage);
  ensureCivicDataApiSeed(store);
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowIso = toIso(nowDate);
  const nowMs = nowDate.getTime();
  const requestId = `req_${randomHex(8)}`;

  const { key, client } = await authenticateApiKey(apiKey, { storage: store, now: nowDate });
  const env = environment === API_ENVIRONMENTS.PRODUCTION ? API_ENVIRONMENTS.PRODUCTION : API_ENVIRONMENTS.SANDBOX;
  if (client.environment !== env) {
    throw apiError('API client environment does not match this endpoint.', API_ERROR_CODES.SCOPE_DENIED, { status: 403 });
  }

  const dataset = getDataset(datasetId, { storage: store });
  if (dataset.status !== DATASET_STATES.APPROVED && dataset.status !== DATASET_STATES.DEPRECATED) {
    throw apiError('Dataset is not available through the public API.', API_ERROR_CODES.DATASET_NOT_AVAILABLE, { status: 404 });
  }
  if (!client.allowedDatasetIds.includes(datasetId)) {
    throw apiError('Dataset is outside this API client scope.', API_ERROR_CODES.SCOPE_DENIED, { status: 403 });
  }

  const usage = readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_USAGE_DAILY);
  const quotaBefore = assertQuota(usage, client, nowDate);
  const rateEvents = readList(store, CIVIC_DATA_API_STORAGE_KEYS.RATE_LIMIT_EVENTS);
  const rate = enforceRateLimit(rateEvents, client, key, nowIso, nowMs, store);

  const cleanFilters = assertAllowedFilters(dataset, filters);
  const pagination = parsePagination(dataset, page, pageSize);
  const selectedFields = parseFields(dataset, fields);
  const rows = DATASET_ROWS[datasetId] || [];
  const filtered = applyFilters(dataset, rows, cleanFilters, client)
    .sort((left, right) => String(left[dataset.sortField]).localeCompare(String(right[dataset.sortField])));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize));
  const start = (pagination.page - 1) * pagination.pageSize;
  const pageRows = filtered.slice(start, start + pagination.pageSize).map((row) => pickFields(row, selectedFields));
  const responseBody = {
    apiVersion: CIVIC_DATA_API_VERSION,
    environment: env,
    requestId,
    dataset: { id: dataset.id, version: dataset.version, schemaVersion: dataset.schemaVersion },
    data: pageRows,
    meta: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages,
      hasNextPage: pagination.page < totalPages,
      hasPreviousPage: pagination.page > 1,
      source: dataset.dataSource,
      license: dataset.license,
      generatedAt: nowIso,
      synthetic: env === API_ENVIRONMENTS.SANDBOX,
    },
    links: {
      self: `/api/${CIVIC_DATA_API_VERSION}/datasets/${dataset.id}/records?page=${pagination.page}&pageSize=${pagination.pageSize}`,
      next: pagination.page < totalPages ? `/api/${CIVIC_DATA_API_VERSION}/datasets/${dataset.id}/records?page=${pagination.page + 1}&pageSize=${pagination.pageSize}` : null,
      previous: pagination.page > 1 ? `/api/${CIVIC_DATA_API_VERSION}/datasets/${dataset.id}/records?page=${pagination.page - 1}&pageSize=${pagination.pageSize}` : null,
    },
    quota: {
      limit: client.dailyQuota,
      used: quotaBefore.used + 1,
      remaining: Math.max(0, quotaBefore.remaining - 1),
    },
    rateLimit: {
      limit: rate.limit,
      remaining: rate.remaining,
      windowSeconds: RATE_WINDOW_MS / 1000,
    },
  };
  const byteSize = new TextEncoder().encode(JSON.stringify(responseBody)).length;
  recordUsage(usage, client, dataset, nowIso, byteSize);
  writeList(store, CIVIC_DATA_API_STORAGE_KEYS.API_USAGE_DAILY, usage);

  const keys = readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_KEYS);
  touchKey(keys, key.id, nowIso);
  writeList(store, CIVIC_DATA_API_STORAGE_KEYS.API_KEYS, keys);

  appendAudit(store, {
    action: 'api_read',
    clientId: client.id,
    datasetId: dataset.id,
    keyId: key.id,
    metadata: { requestId, environment: env, page: pagination.page, pageSize: pagination.pageSize, returned: pageRows.length, total },
  }, nowIso);

  return responseBody;
}

export function listUsageDaily({ clientId, from, to, storage } = {}) {
  const context = assertSignedIn();
  const store = getStorage(storage);
  let rows = readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_USAGE_DAILY);
  if (clientId) {
    const client = findClient(readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_CLIENTS), clientId);
    assertClientAccess(client, context);
    rows = rows.filter((row) => row.clientId === clientId);
  } else if (!isAdmin(context)) {
    const mine = new Set(readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_CLIENTS)
      .filter((client) => client.ownerId === context.actorId)
      .map((client) => client.id));
    rows = rows.filter((row) => mine.has(row.clientId));
  }
  if (from) rows = rows.filter((row) => row.date >= from);
  if (to) rows = rows.filter((row) => row.date <= to);
  return rows.sort((left, right) => left.date.localeCompare(right.date) || left.clientId.localeCompare(right.clientId));
}

export function getUsageSummary({ clientId, storage } = {}) {
  const rows = listUsageDaily({ clientId, storage });
  return rows.reduce((summary, row) => {
    summary.requests += row.requestCount;
    summary.errors += row.errorCount;
    summary.bytes += row.bytes;
    return summary;
  }, { requests: 0, errors: 0, bytes: 0 });
}

export function listAccessAudits({ storage } = {}) {
  assertAdmin('Only administrators can read API access audits.');
  const store = getStorage(storage);
  return readList(store, CIVIC_DATA_API_STORAGE_KEYS.ACCESS_AUDITS)
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function listRateLimitEvents({ clientId, storage } = {}) {
  const context = assertSignedIn();
  const store = getStorage(storage);
  if (clientId) {
    const client = findClient(readList(store, CIVIC_DATA_API_STORAGE_KEYS.API_CLIENTS), clientId);
    assertClientAccess(client, context);
  }
  const rows = readList(store, CIVIC_DATA_API_STORAGE_KEYS.RATE_LIMIT_EVENTS);
  return clientId ? rows.filter((row) => row.clientId === clientId) : rows;
}

const readAnomalyReviews = (storage) => {
  const value = safeReadJson(storage, CIVIC_DATA_API_STORAGE_KEYS.ANOMALY_REVIEWS, []);
  return Array.isArray(value) ? value : [];
};

const buildAnomalies = (storage, now) => {
  const clients = readList(storage, CIVIC_DATA_API_STORAGE_KEYS.API_CLIENTS);
  const usage = readList(storage, CIVIC_DATA_API_STORAGE_KEYS.API_USAGE_DAILY);
  const events = readList(storage, CIVIC_DATA_API_STORAGE_KEYS.RATE_LIMIT_EVENTS);
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowIso = toIso(nowDate);
  const today = todayKey(nowDate);
  const windowStart = new Date(nowDate.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const reviews = readAnomalyReviews(storage);
  const anomalies = [];

  for (const client of clients) {
    const dailyUsed = usage.filter((row) => row.clientId === client.id && row.date === today).reduce((sum, row) => sum + row.requestCount, 0);
    if (dailyUsed >= Math.floor(client.dailyQuota * 0.8)) {
      const id = `anomaly_${client.id}_daily_quota_pressure`;
      anomalies.push({
        id,
        clientId: client.id,
        clientName: client.name,
        ruleId: 'daily_quota_pressure',
        ruleVersion: ANOMALY_RULE_VERSION,
        severity: dailyUsed >= client.dailyQuota ? 'high' : 'medium',
        inputWindow: { from: `${today}T00:00:00.000Z`, to: nowIso },
        executedAt: nowIso,
        explanation: `${client.name} has used ${dailyUsed} of ${client.dailyQuota} daily requests. This rule compares today's aggregate usage with the client quota.`,
        recommendation: 'Review whether the integration is polling too often, then confirm the quota or ask the developer to cache responses.',
        sourceFields: ['api_usage_daily.requestCount', 'api_clients.dailyQuota'],
        metrics: { requests: dailyUsed, quota: client.dailyQuota, ratio: Number((dailyUsed / client.dailyQuota).toFixed(2)) },
        status: 'open',
      });
    }

    const blocked = events.filter((event) => event.clientId === client.id && event.outcome === 'blocked' && event.at >= windowStart);
    if (blocked.length >= 3) {
      const id = `anomaly_${client.id}_repeated_rate_limits`;
      anomalies.push({
        id,
        clientId: client.id,
        clientName: client.name,
        ruleId: 'repeated_rate_limits',
        ruleVersion: ANOMALY_RULE_VERSION,
        severity: blocked.length >= 10 ? 'high' : 'medium',
        inputWindow: { from: windowStart, to: nowIso },
        executedAt: nowIso,
        explanation: `${blocked.length} requests from ${client.name} were blocked in the last 24 hours by the ${client.rateLimitPerMinute}-per-minute limit.`,
        recommendation: 'Contact the developer about request pacing or review whether a higher limit is justified.',
        sourceFields: ['rate_limit_events.outcome', 'api_clients.rateLimitPerMinute'],
        metrics: { blockedRequests: blocked.length, perMinuteLimit: client.rateLimitPerMinute },
        status: 'open',
      });
    }

    const errors = usage.filter((row) => row.clientId === client.id && row.date === today).reduce((sum, row) => sum + row.errorCount, 0);
    const requests = usage.filter((row) => row.clientId === client.id && row.date === today).reduce((sum, row) => sum + row.requestCount, 0);
    if (requests >= 10 && errors / requests > 0.2) {
      const id = `anomaly_${client.id}_error_rate`;
      anomalies.push({
        id,
        clientId: client.id,
        clientName: client.name,
        ruleId: 'error_rate_pressure',
        ruleVersion: ANOMALY_RULE_VERSION,
        severity: errors / requests > 0.5 ? 'high' : 'medium',
        inputWindow: { from: `${today}T00:00:00.000Z`, to: nowIso },
        executedAt: nowIso,
        explanation: `${errors} of ${requests} requests from ${client.name} failed today, above the 20% review threshold.`,
        recommendation: 'Check the client integration and recent schema changes before adjusting access.',
        sourceFields: ['api_usage_daily.errorCount', 'api_usage_daily.requestCount'],
        metrics: { errors, requests, errorRate: Number((errors / requests).toFixed(2)) },
        status: 'open',
      });
    }
  }

  return anomalies.map((anomaly) => {
    const review = reviews.find((item) => item.anomalyId === anomaly.id);
    return review ? { ...anomaly, status: review.decision, review: { ...review } } : anomaly;
  });
};

export function listUsageAnomalies({ storage, now = new Date() } = {}) {
  assertAdmin('Only administrators can inspect usage anomalies.');
  return buildAnomalies(getStorage(storage), now);
}

export function reviewUsageAnomaly(
  { anomalyId, decision, editedRecommendation = '', reason = '' },
  { storage, now = new Date() } = {}
) {
  const context = assertAdmin('Only administrators can review usage anomalies.');
  const store = getStorage(storage);
  const allowed = ['accepted', 'edited', 'rejected'];
  if (!allowed.includes(decision)) {
    throw apiError(`decision must be one of ${allowed.join(', ')}.`, API_ERROR_CODES.VALIDATION_ERROR, { field: 'decision' });
  }
  const anomaly = buildAnomalies(store, now).find((item) => item.id === anomalyId);
  if (!anomaly) throw apiError('Usage anomaly not found.', API_ERROR_CODES.NOT_FOUND, { status: 404, anomalyId });
  const cleanReason = normalizeOptionalText(reason, 300, 'reason');
  if ((decision === 'edited' || decision === 'rejected') && !cleanReason) {
    throw apiError('A reason is required when editing or rejecting a recommendation.', API_ERROR_CODES.VALIDATION_ERROR, { field: 'reason' });
  }
  const reviews = readAnomalyReviews(store);
  const record = {
    anomalyId,
    clientId: anomaly.clientId,
    ruleId: anomaly.ruleId,
    ruleVersion: anomaly.ruleVersion,
    decision,
    originalRecommendation: anomaly.recommendation,
    editedRecommendation: decision === 'edited' ? normalizeText(editedRecommendation, 300, 'editedRecommendation') : '',
    reason: cleanReason,
    reviewedAt: toIso(now),
    reviewedBy: context.actorId,
    schemaVersion: 1,
  };
  const index = reviews.findIndex((item) => item.anomalyId === anomalyId);
  if (index >= 0) reviews[index] = record;
  else reviews.push(record);
  writeList(store, CIVIC_DATA_API_STORAGE_KEYS.ANOMALY_REVIEWS, reviews);
  appendAudit(store, {
    action: 'api_anomaly_reviewed',
    clientId: anomaly.clientId,
    reason: cleanReason || decision,
    metadata: { anomalyId, ruleId: anomaly.ruleId, ruleVersion: anomaly.ruleVersion, decision },
  }, now);
  return record;
}

export function validateSchemaCompatibility(currentSchema, candidateSchema) {
  if (!currentSchema || !Array.isArray(currentSchema.fields) || !candidateSchema || !Array.isArray(candidateSchema.fields)) {
    throw apiError('Both current and candidate schemas are required.', API_ERROR_CODES.VALIDATION_ERROR);
  }
  const breakingChanges = [];
  const safeChanges = [];
  const candidateByName = new Map(candidateSchema.fields.map((field) => [field.name, field]));

  for (const current of currentSchema.fields) {
    const candidate = candidateByName.get(current.name);
    if (!candidate) {
      breakingChanges.push({ field: current.name, change: 'removed_field' });
      continue;
    }
    if (candidate.type !== current.type) {
      breakingChanges.push({ field: current.name, change: 'type_changed', from: current.type, to: candidate.type });
    }
    if (current.public && candidate.public === false) {
      breakingChanges.push({ field: current.name, change: 'public_field_removed' });
    }
    if (current.type === 'enum') {
      const removedValues = (current.values || []).filter((value) => !(candidate.values || []).includes(value));
      if (removedValues.length > 0) {
        breakingChanges.push({ field: current.name, change: 'enum_values_removed', values: removedValues });
      }
    }
  }

  for (const candidate of candidateSchema.fields) {
    if (!currentSchema.fields.some((field) => field.name === candidate.name)) {
      if (candidate.required) breakingChanges.push({ field: candidate.name, change: 'required_field_added' });
      else safeChanges.push({ field: candidate.name, change: 'optional_field_added' });
    }
  }

  return {
    compatible: breakingChanges.length === 0,
    breakingChanges,
    safeChanges,
    checkedAt: new Date().toISOString(),
  };
}

export function validateRecordAgainstSchema(record, schema) {
  const errors = [];
  if (!record || typeof record !== 'object') return { valid: false, errors: [{ field: null, code: 'not_an_object' }] };
  const publicFields = new Set((schema.fields || []).filter((field) => field.public).map((field) => field.name));
  for (const key of Object.keys(record)) {
    if (!publicFields.has(key)) errors.push({ field: key, code: 'not_public' });
  }
  for (const field of schema.fields || []) {
    const value = record[field.name];
    if (value === undefined || value === null || value === '') {
      if (field.required) errors.push({ field: field.name, code: 'required' });
      continue;
    }
    if (field.type === 'string' && typeof value !== 'string') errors.push({ field: field.name, code: 'type' });
    if (field.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) errors.push({ field: field.name, code: 'type' });
    if (field.type === 'number' && typeof value === 'number') {
      if (field.min !== undefined && value < field.min) errors.push({ field: field.name, code: 'min' });
      if (field.max !== undefined && value > field.max) errors.push({ field: field.name, code: 'max' });
    }
    if (field.type === 'string' && typeof value === 'string' && field.maxLength && value.length > field.maxLength) {
      errors.push({ field: field.name, code: 'max_length' });
    }
    if (field.type === 'enum' && !(field.values || []).includes(value)) errors.push({ field: field.name, code: 'enum' });
    if (field.type === 'url' && (!safeHttpUrl(value) || !/^https:\/\//i.test(value))) errors.push({ field: field.name, code: 'url' });
    if (field.type === 'date' && (typeof value !== 'string' || Number.isNaN(Date.parse(value)))) errors.push({ field: field.name, code: 'date' });
  }
  return { valid: errors.length === 0, errors };
}

export function getDeveloperPortalData({ storage } = {}) {
  const store = getStorage(storage);
  ensureCivicDataApiSeed(store);
  const context = actorContext();
  let clients = [];
  let usage = [];
  let audits = [];
  let anomalies = [];
  if (context.authenticated) {
    try {
      clients = listApiClients({ storage: store });
      usage = listUsageDaily({ storage: store });
      if (isAdmin(context)) {
        audits = listAccessAudits({ storage: store }).slice(0, 50);
        anomalies = listUsageAnomalies({ storage: store });
      }
    } catch {
      clients = [];
      usage = [];
    }
  }
  return {
    datasets: listDatasets({ storage: store }),
    schemas: Object.fromEntries(listDatasets({ storage: store }).map((dataset) => [dataset.id, getDatasetSchema(dataset.id, undefined, { storage: store })])),
    clients,
    usage,
    audits,
    anomalies,
    context,
  };
}

export function resetCivicDataApiData({ storage, now = new Date() } = {}) {
  const context = assertAdmin('Only administrators can reset API governance data.');
  const store = getStorage(storage);
  if (!store) return false;
  for (const key of Object.values(CIVIC_DATA_API_STORAGE_KEYS)) {
    if (key === CIVIC_DATA_API_STORAGE_KEYS.DATASET_CATALOG || key === CIVIC_DATA_API_STORAGE_KEYS.SCHEMA_VERSIONS) continue;
    store.removeItem(key);
  }
  appendAudit(store, {
    action: 'api_governance_reset',
    reason: 'Administrator reset of developer sandbox data',
    metadata: { actorRole: context.actorRole },
  }, now);
  return true;
}
