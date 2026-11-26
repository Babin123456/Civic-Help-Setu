/**
 * src/services/privacyBudgetService.js
 * Privacy budget ledger and repeated-query accounting service (#1163).
 *
 * Tracks cumulative epsilon loss per client session per 24h epoch.
 * Rejects queries when the privacy budget is exhausted to block
 * statistical reconstruction and repeated-query differencing attacks.
 */

import { PRIVACY_LIMITS } from '../data/wardAnalyticsContract';

const STORAGE_KEY_PREFIX = 'civic_privacy_budget_ledger_';
const memoryLedger = new Map();
const queryCache = new Map();

/**
 * Returns current UTC date string YYYY-MM-DD for epoch partitioning.
 */
export const getCurrentEpochDay = (date = new Date()) => {
  return date.toISOString().split('T')[0];
};

/**
 * Fast synchronous salted hash for client identifiers and query keys.
 * Produces deterministic alphanumeric hex digest without external dependencies.
 */
export const hashIdentifier = (input = '', salt = 'civic_dp_salt_v1') => {
  const combined = `${salt}::${input}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  for (let i = 0; i < combined.length; i++) {
    const ch = combined.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
};

/**
 * Clears in-memory ledger and caches (used in testing and maintenance).
 */
export const resetBudgetLedger = () => {
  memoryLedger.clear();
  queryCache.clear();
};

/**
 * Retrieves client budget status for the given epoch.
 */
export const getClientBudgetStatus = (clientId = 'anonymous', epochDay = getCurrentEpochDay()) => {
  const clientHash = hashIdentifier(clientId);
  const ledgerKey = `${clientHash}_${epochDay}`;

  let entry = memoryLedger.get(ledgerKey);

  // Check localStorage if in browser environment
  if (!entry && typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${ledgerKey}`);
      if (stored) {
        entry = JSON.parse(stored);
        memoryLedger.set(ledgerKey, entry);
      }
    } catch {
      // Ignore localStorage errors (e.g. quota or incognito)
    }
  }

  const consumed = entry ? Number(entry.consumedBudget) || 0 : 0;
  const total = PRIVACY_LIMITS.DEFAULT_SESSION_BUDGET;
  const remaining = Math.max(0, Number((total - consumed).toFixed(2)));

  return {
    clientHash,
    epochDay,
    totalBudget: total,
    consumedBudget: Number(consumed.toFixed(2)),
    remainingBudget: remaining,
    isExhausted: remaining < PRIVACY_LIMITS.MIN_EPSILON,
  };
};

/**
 * Evaluates whether a query can be executed within the client's privacy budget,
 * supporting idempotent response caching.
 *
 * @param {Object} params
 * @param {string} [params.clientId] - Unhashed client/session identifier
 * @param {number} [params.epsilon] - Epsilon cost of the query (default 0.5)
 * @param {string} [params.queryKey] - Unique serialized query parameters for idempotency
 * @param {string} [params.epochDay] - Date partition (defaults to today UTC)
 * @returns {Object} Allocation decision payload
 */
export const allocateQueryBudget = ({
  clientId = 'anonymous',
  epsilon = PRIVACY_LIMITS.DEFAULT_QUERY_BUDGET_COST,
  queryKey = '',
  epochDay = getCurrentEpochDay(),
} = {}) => {
  const reqEps = Math.max(PRIVACY_LIMITS.MIN_EPSILON, Math.min(PRIVACY_LIMITS.MAX_EPSILON, Number(epsilon) || PRIVACY_LIMITS.DEFAULT_QUERY_BUDGET_COST));
  const clientHash = hashIdentifier(clientId);
  const ledgerKey = `${clientHash}_${epochDay}`;

  // Check idempotent query cache to avoid double-charging identical requests within TTL
  if (queryKey) {
    const cacheKey = `${clientHash}_${hashIdentifier(queryKey)}`;
    const cached = queryCache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < PRIVACY_LIMITS.IDEMPOTENT_CACHE_TTL_MS) {
      const status = getClientBudgetStatus(clientId, epochDay);
      return {
        allowed: true,
        isCached: true,
        cachedResult: cached.result,
        deductedEpsilon: 0,
        ...status,
      };
    }
  }

  const currentStatus = getClientBudgetStatus(clientId, epochDay);
  const potentialTotal = Number((currentStatus.consumedBudget + reqEps).toFixed(2));

  if (potentialTotal > currentStatus.totalBudget) {
    // Calculate seconds until midnight UTC
    const now = new Date();
    const midnightUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    const retryAfterSeconds = Math.max(60, Math.floor((midnightUtc.getTime() - now.getTime()) / 1000));

    return {
      allowed: false,
      error: 'BUDGET_EXHAUSTED',
      message: `Privacy budget exhausted for epoch ${epochDay}. Maximum daily limit is epsilon=${currentStatus.totalBudget}.`,
      retryAfterSeconds,
      ...currentStatus,
    };
  }

  // Deduct budget and persist ledger entry
  const updatedEntry = {
    clientHash,
    epochDay,
    consumedBudget: potentialTotal,
    lastUpdated: new Date().toISOString(),
  };

  memoryLedger.set(ledgerKey, updatedEntry);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${ledgerKey}`, JSON.stringify(updatedEntry));
    } catch {
      // Ignore storage write issues
    }
  }

  return {
    allowed: true,
    isCached: false,
    deductedEpsilon: reqEps,
    totalBudget: currentStatus.totalBudget,
    consumedBudget: potentialTotal,
    remainingBudget: Number((currentStatus.totalBudget - potentialTotal).toFixed(2)),
    isExhausted: (currentStatus.totalBudget - potentialTotal) < PRIVACY_LIMITS.MIN_EPSILON,
  };
};

/**
 * Stores a computed query result in the idempotent query cache.
 */
export const cacheQueryResult = (clientId, queryKey, result) => {
  if (!queryKey || !result) return;
  const clientHash = hashIdentifier(clientId);
  const cacheKey = `${clientHash}_${hashIdentifier(queryKey)}`;
  queryCache.set(cacheKey, {
    timestamp: Date.now(),
    result,
  });
};
