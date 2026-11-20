/* global process */
import { createFirebaseTokenHandler } from './_lib/firebaseToken.js';
import { createRateLimiter } from './_lib/abuseGuard.js';

/**
 * POST /api/firebase-token
 *   Authorization: Bearer <Clerk session token>
 * -> 429 { error: "rate_limited", retryAfterSeconds } with a Retry-After header when called too often
 * -> 200 { token }   a Firebase custom token with the claim { role: "admin" | "citizen" }
 *
 * Server-only configuration (set in the Vercel project; the build never exposes these to the browser):
 *   CLERK_SECRET_KEY            Clerk secret key
 *   FIREBASE_SERVICE_ACCOUNT    the service account JSON, as one line
 * The browser then calls signInWithCustomToken(token). See docs/FIREBASE_RULES.md.
 */

let handler;

async function build() {
  const { CLERK_SECRET_KEY, FIREBASE_SERVICE_ACCOUNT } = process.env;
  if (!CLERK_SECRET_KEY || !FIREBASE_SERVICE_ACCOUNT) return null;

  const { verifyToken, createClerkClient } = await import('@clerk/backend');
  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');

  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
  const app = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) });

  return createFirebaseTokenHandler({
    verifySession: async (token) => {
      const claims = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
      return { userId: claims.sub };
    },
    getPublicMetadata: async (userId) => (await clerk.users.getUser(userId)).publicMetadata,
    mintToken: (userId, claims) => getAuth(app).createCustomToken(userId, claims),
    // Per address before Clerk is called, and per account after. See docs/ABUSE_CONTROLS.md.
    ipLimiter: createRateLimiter({ limit: 30, windowMs: 60_000 }),
    userLimiter: createRateLimiter({ limit: 10, windowMs: 60_000 }),
  });
}

export default async function route(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    handler ??= await build();
  } catch {
    handler = null;
  }
  if (!handler) {
    // Not configured (or misconfigured): say so without revealing which part.
    res.status(503).json({ error: 'not_configured' });
    return;
  }
  const result = await handler({ method: req.method, headers: req.headers });
  for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
  res.status(result.status).json(result.body);
}
