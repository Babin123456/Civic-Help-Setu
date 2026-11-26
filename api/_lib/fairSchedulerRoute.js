/* global process */
import {
  createFairScheduler,
  createFirestoreSchedulerStorageAdapter,
  createFairSchedulerHandler,
} from './fairScheduler.js';
import { createRateLimiter } from './abuseGuard.js';

let handler = null;

async function build() {
  const { CLERK_SECRET_KEY, USE_FIRESTORE_SCHEDULER } = process.env || {};
  let verifySession = async (token) => {
    if (!token) return { userId: null, role: 'guest' };
    return { userId: token, role: 'citizen' };
  };

  if (CLERK_SECRET_KEY) {
    try {
      const { verifyToken, createClerkClient } = await import('@clerk/backend');
      const { resolveRole } = await import('../../src/services/roleService.js');
      const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
      verifySession = async (sessionToken) => {
        const claims = await verifyToken(sessionToken, { secretKey: CLERK_SECRET_KEY });
        if (!claims.sub) throw new Error('missing subject');
        const user = await clerk.users.getUser(claims.sub);
        return {
          userId: claims.sub,
          role: resolveRole(user.publicMetadata),
        };
      };
    } catch {
      // Fallback to basic session derivation
    }
  }

  const storage = USE_FIRESTORE_SCHEDULER === 'true'
    ? createFirestoreSchedulerStorageAdapter()
    : undefined;

  const scheduler = createFairScheduler({ storage });

  return createFairSchedulerHandler({
    scheduler,
    verifySession,
    ipLimiter: createRateLimiter({ limit: 30, windowMs: 60_000 }),
  });
}

export default async function route(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  handler ??= await build();

  const result = await handler({
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query,
  });

  for (const [name, value] of Object.entries(result.headers || {})) {
    res.setHeader(name, value);
  }
  res.status(result.status).json(result.body);
}
