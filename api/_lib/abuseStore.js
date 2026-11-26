/**
 * api/_lib/abuseStore.js
 *
 * Firestore-backed store for the Abuse Control Plane (#1174). Implements the
 * store contract consumed by createAbuseControlPlane. Initializes Firebase
   * Admin lazily and reuses the default app; returns null when not configured
 * so the control plane degrades gracefully (limits still apply in memory).
 */

import { getFirestoreAdmin } from './firebaseAdmin.js';

const ABUSE_QUOTAS = 'abuseControlQuotas';
const ABUSE_SIGNALS = 'abuseControlSignals';
const ABUSE_ALLOWLISTS = 'abuseControlAllowlists';
const ABUSE_BLOCKLISTS = 'abuseControlBlocklists';
const ABUSE_APPEALS = 'abuseControlAppeals';

export class AbuseStoreError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export class FirestoreAbuseStore {
  constructor(db) {
    this.db = db;
  }

  async getQuota(bucket) {
    const snap = await this.db.collection(ABUSE_QUOTAS).doc(bucket).get();
    if (!snap.exists) return null;
    return snap.data();
  }

  async setQuota(bucket, value) {
    await this.db.collection(ABUSE_QUOTAS).doc(bucket).set(value);
  }

  async recordSignal(signal) {
    const id = `${signal.bucket}:${signal.at}:${Math.random().toString(36).slice(2)}`;
    await this.db.collection(ABUSE_SIGNALS).doc(id).set(signal);
  }

  async getSignals(bucket, since = 0) {
    const snap = await this.db.collection(ABUSE_SIGNALS)
      .where('bucket', '==', bucket)
      .where('at', '>=', since)
      .orderBy('at', 'desc')
      .limit(500)
      .get();
    return snap.docs.map((d) => d.data());
  }

  async setAllowlist(identifierHash, route, reason, expiresAt) {
    const id = `${identifierHash}:${route}`;
    await this.db.collection(ABUSE_ALLOWLISTS).doc(id).set({
      identifierHash, route, reason, expiresAt,
    });
  }

  async setBlocklist(identifierHash, route, reason, expiresAt) {
    const id = `${identifierHash}:${route}`;
    await this.db.collection(ABUSE_BLOCKLISTS).doc(id).set({
      identifierHash, route, reason, expiresAt,
    });
  }

  async isAllowlisted(identifierHash, route) {
    const id = `${identifierHash}:${route}`;
    const snap = await this.db.collection(ABUSE_ALLOWLISTS).doc(id).get();
    return snap.exists;
  }

  async isBlocklisted(identifierHash, route) {
    const id = `${identifierHash}:${route}`;
    const snap = await this.db.collection(ABUSE_BLOCKLISTS).doc(id).get();
    return snap.exists;
  }

  async createAppeal(appeal) {
    const ref = this.db.collection(ABUSE_APPEALS).doc(appeal.id);
    const snap = await ref.get();
    if (snap.exists) throw new AbuseStoreError('appeal_conflict');
    await ref.set(appeal);
    return appeal;
  }

  async getAppeal(appealId) {
    const snap = await this.db.collection(ABUSE_APPEALS).doc(appealId).get();
    if (!snap.exists) return null;
    return snap.data();
  }

  async updateAppeal(appealId, patch) {
    const ref = this.db.collection(ABUSE_APPEALS).doc(appealId);
    const snap = await ref.get();
    if (!snap.exists) return null;
    await ref.update(patch);
    return { ...snap.data(), ...patch };
  }

  async listAppeals({ status, limit = 20, cursor } = {}) {
    let query = this.db.collection(ABUSE_APPEALS).orderBy('createdAt', 'desc');
    if (status) query = query.where('status', '==', status);
    if (cursor) {
      const doc = await this.db.collection(ABUSE_APPEALS).doc(cursor).get();
      if (doc.exists) query = query.startAfter(doc);
    }
    const snap = await query.limit(limit + 1).get();
    const docs = snap.docs.slice(0, limit);
    return {
      appeals: docs.map((d) => d.data()),
      nextCursor: snap.docs.length > limit && docs.length ? docs[docs.length - 1].id : null,
    };
  }
}

let cachedStore = null;

export async function getProductionAbuseStore() {
  if (cachedStore) return cachedStore;
  const db = await getFirestoreAdmin();
  if (!db) return null;
  cachedStore = new FirestoreAbuseStore(db);
  return cachedStore;
}

export function resetProductionAbuseStoreCacheForTests() {
  cachedStore = null;
}
