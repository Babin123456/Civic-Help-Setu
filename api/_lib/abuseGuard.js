/**
 * Server-side abuse controls for the Vercel functions in api/ (docs/ABUSE_CONTROLS.md).
 *
 *  - createRateLimiter: fixed-window counter per key. A blocked request gets `retryAfterSeconds`,
 *    which the caller sends as the standard `Retry-After` header.
 *  - createSingleFlight: requests with the same key that arrive while the first is still running
 *    share its result, so a double click or a retry storm causes the side effect once.
 *  - clientKey: the caller's address, read only from headers the Vercel edge sets.
 *
 * State is held in memory, so it is per function instance (a warm instance on Vercel). That slows
 * bulk abuse and removes accidental duplicates, but it is not a global limit; a global limit needs
 * a shared store, which the project does not have yet. The clock and the map are injectable for tests.
 */

const MAX_KEYS = 5000;

export function createRateLimiter({ limit, windowMs, now = Date.now, maxKeys = MAX_KEYS }) {
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError('createRateLimiter needs a positive integer limit');
  if (!Number.isFinite(windowMs) || windowMs < 1) throw new TypeError('createRateLimiter needs a positive windowMs');
  const windows = new Map();

  function sweep(at) {
    for (const [key, entry] of windows) if (entry.resetAt <= at) windows.delete(key);
    // Still full of live windows (many distinct callers): drop the oldest so memory stays bounded.
    // Side effect: a caller with many addresses can push other callers' live counters out (docs/ABUSE_CONTROLS.md).
    while (windows.size >= maxKeys) windows.delete(windows.keys().next().value);
  }

  return {
    /** Number of windows currently held (for tests and diagnostics). */
    size: () => windows.size,
    /** Counts one request for `key`. Returns { allowed, remaining, retryAfterSeconds }. */
    take(key) {
      const at = now();
      let entry = windows.get(key);
      if (!entry || entry.resetAt <= at) {
        if (!entry && windows.size >= maxKeys) sweep(at);
        entry = { count: 0, resetAt: at + windowMs };
        windows.set(key, entry);
      }
      if (entry.count >= limit) {
        return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - at) / 1000)) };
      }
      entry.count += 1;
      return { allowed: true, remaining: limit - entry.count, retryAfterSeconds: 0 };
    },
  };
}

export function createSingleFlight() {
  const running = new Map();
  return {
    /** Runs `work` unless one for `key` is already running; then both callers get the same result. */
    run(key, work) {
      const existing = running.get(key);
      if (existing) return existing;
      const promise = Promise.resolve()
        .then(work)
        .finally(() => running.delete(key));
      running.set(key, promise);
      return promise;
    },
  };
}

const firstValue = (value) => (Array.isArray(value) ? value[0] : value);

/**
 * The caller's address. `x-vercel-forwarded-for` and `x-real-ip` are set by Vercel and cannot be
 * chosen by the client. `x-forwarded-for` is deliberately not read: without the Vercel headers the
 * client could set it to any value. Returns null when there is no usable address; the caller then
 * skips the per-address limit rather than putting every such request in one shared bucket.
 */
export function clientKey(headers = {}) {
  const lower = {};
  for (const [name, value] of Object.entries(headers)) lower[name.toLowerCase()] = firstValue(value);
  for (const name of ['x-vercel-forwarded-for', 'x-real-ip']) {
    const raw = lower[name];
    if (typeof raw !== 'string') continue;
    const candidate = raw.split(',')[0].trim();
    if (/^[0-9a-fA-F:.]{2,45}$/.test(candidate)) return candidate;
  }
  return null;
}
