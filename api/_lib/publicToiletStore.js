/* global Buffer */
import { createHash, randomUUID } from 'node:crypto';
import { FieldPath } from 'firebase-admin/firestore';
import { getFirestoreAdmin } from './firebaseAdmin.js';
import { checkTenantAccess } from '../../src/services/tenantContext.js';

export class ToiletStoreError extends Error {
  constructor(code) { super(code); this.code = code; }
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  if (typeof cursor !== 'string' || cursor.length > 300 || !/^[\w-]+$/.test(cursor)) throw new ToiletStoreError('invalid_cursor');
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (!Array.isArray(value) || value.length !== 2 || !Number.isSafeInteger(value[0]) || value[0] < 0 ||
        typeof value[1] !== 'string' || !/^[a-f0-9]{64}$/.test(value[1])) throw new Error();
    return value;
  } catch { throw new ToiletStoreError('invalid_cursor'); }
}

export class FirestoreToiletStore {
  constructor(db) { this.db = db; this.collection = db.collection('publicToiletSubmissions'); }

  async create(payload, key) {
    const id = createHash('sha256').update(key).digest('hex');
    const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const ref = this.collection.doc(id);
    return this.db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists) {
        const record = existing.data();
        if (record.payloadHash !== payloadHash) throw new ToiletStoreError('idempotency_conflict');
        return record;
      }
      const createdAt = Date.now();
      const record = {
        ...payload, id, payloadHash, schemaVersion: 1, createdAt,
        timestamp: new Date(createdAt).toISOString(),
        receiptSeal: 'PT-' + randomUUID(), status: 'queued_for_moderation',
      };
      tx.create(ref, record);
      return record;
    });
  }

  async list({ limit, cursor, tenantId = null, actor = null }) {
    if (actor && tenantId) {
      const access = checkTenantAccess(actor, tenantId);
      if (!access.allowed) throw new ToiletStoreError('tenant_access_denied');
    }
    const after = decodeCursor(cursor);
    let query = this.collection;
    if (tenantId) {
      query = query.where('tenantId', '==', tenantId);
    }
    query = query.orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc');
    if (after) query = query.startAfter(...after);
    const snapshot = await query.limit(limit + 1).get();
    const documents = snapshot.docs.slice(0, limit);
    const items = documents.map(doc => {
      const record = doc.data();
      delete record.payloadHash;
      return record;
    });
    const last = items.at(-1);
    return {
      items,
      nextCursor: snapshot.docs.length > limit && last
        ? Buffer.from(JSON.stringify([last.createdAt, last.id])).toString('base64url') : null,
    };
  }

  async review(id, decision, actorId, { actor = null } = {}) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new ToiletStoreError('invalid_id');
    const ref = this.collection.doc(id);
    return this.db.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) throw new ToiletStoreError('not_found');
      const record = snapshot.data();
      if (actor && record.tenantId) {
        const access = checkTenantAccess(actor, record.tenantId);
        if (!access.allowed) throw new ToiletStoreError('tenant_access_denied');
      }
      if (record.status === decision) return { id, status: decision };
      if (record.status !== 'queued_for_moderation') throw new ToiletStoreError('review_conflict');
      tx.update(ref, { status: decision, review: { actorId, at: new Date().toISOString(), decision } });
      return { id, status: decision };
    });
  }
}

export async function getProductionToiletStore() {
  const db = await getFirestoreAdmin();
  if (!db) throw new ToiletStoreError('storage_unavailable');
  return new FirestoreToiletStore(db);
}
