import { withApiErrorContract } from './_lib/errorContract.js';
/* global process */
import {
  applicationEventRepository,
  createApplicationEventsHandler,
} from './_lib/applicationEvents.js';
import { createRateLimiter } from './_lib/abuseGuard.js';
import { withRequestSecurity } from './_lib/requestSecurity.js';

let handler = null;

async function build() {
  const { CLERK_SECRET_KEY } = process.env;
  if (!CLERK_SECRET_KEY) return null;

  const { verifyToken, createClerkClient } = await import('@clerk/backend');
  const { resolveRole } = await import('../src/services/roleService.js');
  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });

  return createApplicationEventsHandler({
    verifySession: async (sessionToken) => {
      const claims = await verifyToken(sessionToken, { secretKey: CLERK_SECRET_KEY });
      if (!claims.sub) throw new Error('missing subject');
      const user = await clerk.users.getUser(claims.sub);
      return {
        userId: claims.sub,
        role: resolveRole(user.publicMetadata),
      };
    },
    repository: applicationEventRepository,
    ipLimiter: createRateLimiter({ limit: 30, windowMs: 60_000 }),
  });
}

async function route(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    handler ??= await build();
  } catch {
    handler = null;
  }
  if (!handler) {
    res.status(503).json({ error: 'not_configured' });
    return;
  }

  const result = await handler({
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query,
  });

  for (const [name, value] of Object.entries(result.headers)) {
    res.setHeader(name, value);
  }
  res.status(result.status).json(result.body);
}

export default withApiErrorContract(withRequestSecurity(route, { allowMissingOrigin: true }));
