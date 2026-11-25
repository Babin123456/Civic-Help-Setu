/* global Buffer */
/**
 * src/utils/rywClient.js
 *
 * Client-side Read-Your-Writes (RYW) token management and stale-read disclosure utility (#1233).
 * Captures, stores, and attaches session tokens for read-your-writes consistency across regional replicas.
 */

const STORAGE_PREFIX = 'civic_ryw_token';
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

// In-memory fallback when sessionStorage is not available (SSR, tests, disabled cookies)
const memoryStorage = new Map();

const getStorage = () => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch {
    // sessionStorage blocked or restricted
  }
  return null;
};

const storageKey = (userId = 'anon') => `${STORAGE_PREFIX}_${userId}`;

/**
 * Decode JWT/JWS token payload without external crypto libraries.
 */
export const decodeTokenPayload = (token) => {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function'
      ? atob(base64)
      : (typeof Buffer !== 'undefined' ? Buffer.from(base64, 'base64').toString('utf-8') : '');
    return JSON.parse(json);
  } catch {
    return null;
  }
};

/**
 * Save a Read-Your-Writes token for a user session.
 */
export const saveRywToken = (token, userId = 'anon') => {
  if (!token || typeof token !== 'string') return;
  const payload = decodeTokenPayload(token);
  const expiresAt = payload?.exp ? payload.exp * 1000 : Date.now() + DEFAULT_TTL_MS;

  const record = JSON.stringify({
    token,
    userId,
    expiresAt,
    savedAt: Date.now(),
  });

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(storageKey(userId), record);
      return;
    } catch {
      // Fall through to memory storage
    }
  }
  memoryStorage.set(storageKey(userId), record);
};

/**
 * Retrieve the active non-expired RYW token for a user session.
 */
export const getRywToken = (userId = 'anon') => {
  const storage = getStorage();
  let raw;

  if (storage) {
    try {
      raw = storage.getItem(storageKey(userId));
    } catch {
      raw = memoryStorage.get(storageKey(userId));
    }
  } else {
    raw = memoryStorage.get(storageKey(userId));
  }

  if (!raw) return null;

  try {
    const record = JSON.parse(raw);
    if (!record?.token) return null;
    if (record.expiresAt && Date.now() > record.expiresAt) {
      clearRywToken(userId);
      return null;
    }
    return record.token;
  } catch {
    clearRywToken(userId);
    return null;
  }
};

/**
 * Clear the stored RYW token for a user session.
 */
export const clearRywToken = (userId = 'anon') => {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(storageKey(userId));
    } catch {
      // Ignore
    }
  }
  memoryStorage.delete(storageKey(userId));
};

/**
 * Clear all stored RYW tokens across all sessions.
 */
export const clearAllRywTokens = () => {
  const storage = getStorage();
  if (storage) {
    try {
      const keysToRemove = [];
      for (let i = 0; i < storage.length; i += 1) {
        const k = storage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => storage.removeItem(k));
    } catch {
      // Ignore
    }
  }
  memoryStorage.clear();
};

/**
 * Extract RYW token from response headers and save if present.
 */
export const captureRywTokenFromResponse = (response, userId = 'anon') => {
  if (!response) return null;

  let token = null;
  if (response.headers) {
    if (typeof response.headers.get === 'function') {
      token = response.headers.get('x-read-your-writes-token');
    } else if (typeof response.headers === 'object') {
      token = response.headers['x-read-your-writes-token'] || response.headers['X-Read-Your-Writes-Token'];
    }
  }

  if (token) {
    saveRywToken(token, userId);
  }
  return token;
};

/**
 * Attach the active RYW token to request headers.
 */
export const attachRywTokenToHeaders = (headers = {}, userId = 'anon') => {
  const token = getRywToken(userId);
  if (!token) return headers;

  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    headers.set('x-read-your-writes-token', token);
    return headers;
  }

  return {
    ...headers,
    'x-read-your-writes-token': token,
  };
};

/**
 * Parse stale-read disclosure metadata from response headers for UI display.
 */
export const parseStaleReadHeaders = (response) => {
  if (!response) return null;

  const getHeader = (name) => {
    if (response.headers) {
      if (typeof response.headers.get === 'function') {
        return response.headers.get(name);
      }
      if (typeof response.headers === 'object') {
        const lower = name.toLowerCase();
        for (const [k, v] of Object.entries(response.headers)) {
          if (k.toLowerCase() === lower) return v;
        }
      }
    }
    return null;
  };

  const servedBy = getHeader('x-served-by') || getHeader('x-served-by-region') || 'unknown';
  const consistencyLevel = getHeader('x-consistency') || getHeader('x-consistency-level') || 'bounded_stale';
  const staleReadHeader = getHeader('x-stale-read');
  const lagHeader = getHeader('x-replica-lag-ms');
  const primaryRegion = getHeader('x-primary-region') || 'asia-south1';
  const isFailover = getHeader('x-failover') === 'true';

  const lagMs = lagHeader ? parseInt(lagHeader, 10) || 0 : 0;
  const isStale = staleReadHeader === 'true' || lagMs > 0;

  return {
    isStale,
    replicaLagMs: lagMs,
    servedBy,
    consistencyLevel,
    primaryRegion,
    isFailover,
    disclosureLabel: isStale
      ? `Regional replica (${servedBy}) • Lag: ${lagMs}ms`
      : `Regional replica (${servedBy}) • Up to date`,
  };
};

/**
 * Wrap fetch to automatically manage RYW tokens and parse stale read headers.
 */
export const createRywFetch = (customFetch = (typeof fetch !== 'undefined' ? fetch : null), getUserId = () => 'anon') => {
  return async (url, options = {}) => {
    if (!customFetch) {
      throw new Error('Fetch implementation is required');
    }

    const userId = typeof getUserId === 'function' ? getUserId() : getUserId;
    const modifiedHeaders = attachRywTokenToHeaders(options.headers || {}, userId);

    const response = await customFetch(url, {
      ...options,
      headers: modifiedHeaders,
    });

    captureRywTokenFromResponse(response, userId);
    const staleInfo = parseStaleReadHeaders(response);

    // Attach metadata property to response without mutating standard methods
    if (response && typeof response === 'object') {
      try {
        Object.defineProperty(response, 'multiRegionMetadata', {
          value: staleInfo,
          configurable: true,
          enumerable: false,
        });
      } catch {
        // Ignore if immutable
      }
    }

    return response;
  };
};
