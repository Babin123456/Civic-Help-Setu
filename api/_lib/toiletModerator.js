/* global process */
import { bearerToken } from './firebaseToken.js';
import { resolveRole } from '../../src/services/roleService.js';

/** Uses verified Clerk identity and server-fetched metadata; never UI demo roles. */
export async function authorizeToiletModerator(req) {
  const token = bearerToken(req.headers);
  if (!token) return { status: 401 };
  if (!process.env.CLERK_SECRET_KEY) return { status: 503 };
  const { verifyToken, createClerkClient } = await import('@clerk/backend');
  let claims;
  try { claims = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY }); }
  catch { return { status: 401 }; }
  if (typeof claims.sub !== 'string' || !claims.sub) return { status: 401 };
  try {
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const user = await clerk.users.getUser(claims.sub);
    return resolveRole(user.publicMetadata) === 'admin'
      ? { userId: claims.sub } : { status: 403 };
  } catch { return { status: 503 }; }
}
