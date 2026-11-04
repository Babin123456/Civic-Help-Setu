/**
 * Client-side rate limiter for API calls and user actions.
 * Uses fixed-window counter with in-memory storage.
 */

const MAX_KEYS = 1000;

export function createRateLimiter({ limit, windowMs, now = Date.now, maxKeys = MAX_KEYS }) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new TypeError('createRateLimiter needs a positive integer limit');
  }
  if (!Number.isFinite(windowMs) || windowMs < 1) {
    throw new TypeError('createRateLimiter needs a positive windowMs');
  }

  const windows = new Map();

  function sweep(at) {
    for (const [key, entry] of windows) {
      if (entry.resetAt <= at) windows.delete(key);
    }
    while (windows.size >= maxKeys) {
      windows.delete(windows.keys().next().value);
    }
  }

  return {
    size: () => windows.size,
    take(key) {
      const at = now();
      let entry = windows.get(key);
      if (!entry || entry.resetAt <= at) {
        if (!entry && windows.size >= maxKeys) sweep(at);
        entry = { count: 0, resetAt: at + windowMs };
        windows.set(key, entry);
      }
      if (entry.count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - at) / 1000)),
        };
      }
      entry.count += 1;
      return {
        allowed: true,
        remaining: limit - entry.count,
        retryAfterSeconds: 0,
      };
    },
    reset(key) {
      windows.delete(key);
    },
    resetAll() {
      windows.clear();
    },
    getWindow(key) {
      return windows.get(key);
    },
  };
}

export const emailVerificationResendLimiter = createRateLimiter({
  limit: 3,
  windowMs: 60 * 60 * 1000,
});

export const emailChangeRequestLimiter = createRateLimiter({
  limit: 2,
  windowMs: 60 * 60 * 1000,
});

export const preferenceUpdateLimiter = createRateLimiter({
  limit: 30,
  windowMs: 60 * 1000,
});

export function setTestTimeProvider(limiter) {
  // This is a hack for testing - replace the internal now function
  // We can't actually do this with the current closure-based implementation
  // So we just document that tests should create their own limiters for time-dependent tests
  return limiter;
}