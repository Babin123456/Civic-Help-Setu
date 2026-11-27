/* global process */

/**
 * Shared Firebase Admin initialization for serverless API handlers.
 * Reuses any existing initialized default app to prevent duplicate app initialization errors.
 */

let cachedFirestore = null;

export async function getFirebaseAdminApp() {
  const { FIREBASE_SERVICE_ACCOUNT } = process.env || {};
  const { cert, getApps, initializeApp } = await import('firebase-admin/app');
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }
  if (!FIREBASE_SERVICE_ACCOUNT) {
    return null;
  }
  try {
    return initializeApp({
      credential: cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)),
    });
  } catch {
    return null;
  }
}

export async function getFirestoreAdmin() {
  if (cachedFirestore) return cachedFirestore;
  const app = await getFirebaseAdminApp();
  if (!app) return null;
  const { getFirestore } = await import('firebase-admin/firestore');
  cachedFirestore = getFirestore(app);
  return cachedFirestore;
}

export function resetFirebaseAdminCacheForTests() {
  cachedFirestore = null;
}
