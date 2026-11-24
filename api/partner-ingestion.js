/* global process */
import {
  createFirestoreIngestionStorageAdapter,
  createPartnerIngestionBoundary,
  createPartnerIngestionHandler,
} from './_lib/partnerIngestionBoundary.js';
import { createRateLimiter } from './_lib/abuseGuard.js';

let cachedHandler = null;

export async function buildPartnerIngestionHandler({
  storage = createFirestoreIngestionStorageAdapter(),
  verifySessionOverride = null,
  ipLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 }),
  environment = process.env.NODE_ENV || 'development',
} = {}) {
  const { CLERK_SECRET_KEY } = process.env || {};
  let verifySession = verifySessionOverride;

  if (!verifySession && CLERK_SECRET_KEY) {
    try {
      const { verifyToken, createClerkClient } = await import('@clerk/backend');
      const { resolveRole } = await import('../src/services/roleService.js');
      const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
      verifySession = async (sessionToken) => {
        const claims = await verifyToken(sessionToken, { secretKey: CLERK_SECRET_KEY });
        if (!claims.sub) throw new Error('missing subject');
        const user = await clerk.users.getUser(claims.sub);
        return {
          userId: claims.sub,
          role: resolveRole(user?.publicMetadata),
        };
      };
    } catch {
      verifySession = null;
    }
  }

  const boundary = createPartnerIngestionBoundary({ storage });

  return createPartnerIngestionHandler({
    boundary,
    verifySession,
    ipLimiter,
    environment,
  });
}

export default async function route(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    cachedHandler ??= await buildPartnerIngestionHandler();
  } catch {
    cachedHandler = null;
  }

  if (!cachedHandler) {
    res.status(503).json({ error: 'not_configured' });
    return;
  }

  const result = await cachedHandler({
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query,
  });

  if (result.headers) {
    for (const [name, value] of Object.entries(result.headers)) {
      res.setHeader(name, value);
    }
  }
  res.status(result.status).json(result.body);
}
