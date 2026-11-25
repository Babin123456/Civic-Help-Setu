/* global process */
import { createOfficeComparisonHandler } from '../officeComparison.js';
import { resolveRole } from '../../../src/services/roleService.js';

let handlerPromise;

const buildHandler = async () => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return createOfficeComparisonHandler();

  try {
    const { verifyToken, createClerkClient } = await import('@clerk/backend');
    const clerk = createClerkClient({ secretKey });
    return createOfficeComparisonHandler({
      verifySession: async (sessionToken) => {
        const claims = await verifyToken(sessionToken, { secretKey });
        const user = await clerk.users.getUser(claims.sub);
        return {
          userId: claims.sub,
          role: resolveRole(user.publicMetadata),
        };
      },
    });
  } catch {
    return createOfficeComparisonHandler();
  }
};

export default async function route(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  handlerPromise ??= buildHandler();
  const handler = await handlerPromise;

  const result = await handler({
    method: req.method,
    headers: req.headers,
    query: req.query,
    body: req.body,
  });

  for (const [name, value] of Object.entries(result.headers || {})) res.setHeader(name, value);
  return res.status(result.status).json(result.body);
}
