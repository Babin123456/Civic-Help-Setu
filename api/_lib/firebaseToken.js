import { resolveRole } from '../../src/services/roleService.js';
import { clientKey, createSingleFlight } from './abuseGuard.js';

/**
 * Turns a signed-in Clerk session into a Firebase custom token whose `role` claim the Firestore and
 * Storage rules trust (docs/FIREBASE_RULES.md).
 *
 * The handler does not know about Clerk, Firebase or HTTP libraries: they are passed in, so the
 * rules around them are tested without network access (api/_lib/firebaseToken.test.js) and the
 * whole flow is tested against the Firebase emulators (firebase/emulator/token-flow.test.mjs).
 *
 *   verifySession(token)        -> { userId }      throws when the Clerk session token is not valid
 *   getPublicMetadata(userId)   -> object          Clerk publicMetadata of that user
 *   mintToken(userId, claims)   -> string          Firebase custom token
 *
 * Rules that matter:
 *  - The role comes only from Clerk publicMetadata (roleService.js), never from the request.
 *  - The only custom claim is `role`. Nothing from the request body is copied into the token.
 *  - If the role cannot be looked up, no token is issued. Falling back to "citizen" would silently
 *    demote an admin, and falling back to anything else is not acceptable.
 *  - Errors answer with a fixed code, never with the library's message.
 *  - Abuse controls (optional, see abuseGuard.js): `ipLimiter` is checked before any Clerk call,
 *    `userLimiter` after the session is verified. Over the limit answers 429 with `Retry-After`.
 *    Concurrent requests from one user share a single role lookup and token mint.
 */

const json = (status, body, extra = {}) => ({
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  body,
});

/** Reads "Bearer <token>" from a headers object with lower-case or mixed-case names. */
export function bearerToken(headers = {}) {
  const key = Object.keys(headers).find((name) => name.toLowerCase() === 'authorization');
  const value = key ? headers[key] : '';
  const match = typeof value === 'string' ? /^Bearer ([A-Za-z0-9._~+/=-]{10,4096})$/.exec(value.trim()) : null;
  return match ? match[1] : null;
}

const tooMany = (retryAfterSeconds) =>
  json(429, { error: 'rate_limited', retryAfterSeconds }, { 'Retry-After': String(retryAfterSeconds) });

export function createFirebaseTokenHandler({ verifySession, getPublicMetadata, mintToken, ipLimiter, userLimiter }) {
  for (const [name, fn] of Object.entries({ verifySession, getPublicMetadata, mintToken })) {
    if (typeof fn !== 'function') throw new TypeError(`createFirebaseTokenHandler needs ${name}`);
  }

  const singleFlight = createSingleFlight();

  return async function handle({ method, headers }) {
    if (method !== 'POST') return json(405, { error: 'method_not_allowed' }, { Allow: 'POST' });

    // No usable address: skip the per-address limit (a shared bucket would let one caller block all
    // the others); the per-account limit below still applies.
    const address = ipLimiter ? clientKey(headers) : null;
    if (address) {
      const verdict = ipLimiter.take(address);
      if (!verdict.allowed) return tooMany(verdict.retryAfterSeconds);
    }

    const sessionToken = bearerToken(headers);
    if (!sessionToken) return json(401, { error: 'missing_token' });

    let userId;
    try {
      ({ userId } = await verifySession(sessionToken));
    } catch {
      return json(401, { error: 'invalid_token' });
    }
    if (typeof userId !== 'string' || userId.length === 0 || userId.length > 128) {
      return json(401, { error: 'invalid_token' });
    }

    if (userLimiter) {
      const verdict = userLimiter.take(userId);
      if (!verdict.allowed) return tooMany(verdict.retryAfterSeconds);
    }

    return singleFlight.run(userId, async () => {
      let role;
      try {
        role = resolveRole(await getPublicMetadata(userId));
      } catch {
        return json(502, { error: 'role_lookup_failed' });
      }

      try {
        const token = await mintToken(userId, { role });
        return json(200, { token });
      } catch {
        return json(502, { error: 'token_failed' });
      }
    });
  };
}
