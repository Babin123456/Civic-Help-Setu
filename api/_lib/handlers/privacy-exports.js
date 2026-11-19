/* global process */
import { createHash, randomBytes } from 'node:crypto';
import { createPrivacyExportHandler } from '../privacyExports.js';
import { createRateLimiter } from '../abuseGuard.js';

let handler;

async function build() {
  const { CLERK_SECRET_KEY, FIREBASE_SERVICE_ACCOUNT } = process.env;
  if (!CLERK_SECRET_KEY || !FIREBASE_SERVICE_ACCOUNT) return null;

  const { verifyToken, createClerkClient } = await import('@clerk/backend');
  const { cert, getApps, initializeApp } = await import('firebase-admin/app');
  const { FieldValue, Timestamp, getFirestore } = await import('firebase-admin/firestore');

  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
  const firebase = getApps()[0] ?? initializeApp({
    credential: cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)),
  });
  const firestore = getFirestore(firebase);

  return createPrivacyExportHandler({
    verifySession: async (sessionToken) => {
      const claims = await verifyToken(sessionToken, { secretKey: CLERK_SECRET_KEY });
      return { userId: claims.sub, fva: claims.fva };
    },
    getProfile: async (userId) => {
      const user = await clerk.users.getUser(userId);
      const primaryEmail = user.emailAddresses?.find((email) => email.id === user.primaryEmailAddressId)?.emailAddress;
      const metadata = user.unsafeMetadata ?? {};
      return {
        name: user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
        email: primaryEmail || null,
        phone: typeof metadata.phone === 'string' ? metadata.phone : null,
        city: typeof metadata.city === 'string' ? metadata.city : null,
        state: typeof metadata.state === 'string' ? metadata.state : null,
        occupation: typeof metadata.occupation === 'string' ? metadata.occupation : null,
        bio: typeof metadata.bio === 'string' ? metadata.bio : null,
      };
    },
    createExport: async (tokenHash, record) => {
      await firestore.collection('privacyExports').doc(tokenHash).create({
        ...record,
        createdAt: Timestamp.fromMillis(record.createdAt),
        expiresAt: Timestamp.fromMillis(record.expiresAt),
      });
    },
    consumeExport: async (tokenHash, userId, now) => firestore.runTransaction(async (transaction) => {
      const reference = firestore.collection('privacyExports').doc(tokenHash);
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return { status: 'not_found' };

      const stored = snapshot.data();
      if (stored.userId !== userId) return { status: 'not_found' };
      if (stored.usedAt) return { status: 'used' };
      const expiresAt = stored.expiresAt?.toMillis?.() ?? 0;
      if (expiresAt <= now) return { status: 'expired' };

      transaction.update(reference, {
        payload: FieldValue.delete(),
        usedAt: Timestamp.fromMillis(now),
      });
      return { status: 'ok', payload: stored.payload, metadata: stored.metadata };
    }),
    writeAudit: async ({ userId, action, categories, recordCount, bytes, vaultMetadataIncluded, at }) => {
      await firestore.collection('privacyExportAudit').add({
        userId,
        action,
        categories,
        recordCount,
        bytes,
        vaultMetadataIncluded,
        createdAt: Timestamp.fromMillis(at),
      });
    },
    deleteExport: async (tokenHash) => {
      await firestore.collection('privacyExports').doc(tokenHash).delete();
    },
    createToken: () => randomBytes(32).toString('base64url'),
    hashToken: async (value) => createHash('sha256').update(value, 'utf8').digest('hex'),
    ipLimiter: createRateLimiter({ limit: 20, windowMs: 60_000 }),
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
    res.status(503).json({ error: 'not_configured' });
    return;
  }

  const result = await handler({
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query,
  });
  for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
  if (typeof result.body === 'string') {
    res.status(result.status).send(result.body);
    return;
  }
  res.status(result.status).json(result.body);
}
