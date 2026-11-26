import { describe, it, expect } from 'vitest';
import { FirestoreToiletStore } from './publicToiletStore.js';
import { createPublicToiletHandler } from './handlers/public-toilets.js';
import { ToiletFirestoreFixture } from '../../tests/helpers/toiletFirestore.js';

const payload = { facilityId: 'pt-001', reportType: 'maintenance_issue', description: 'Broken tap', category: 'hygiene_cleanliness' };
function response() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}
function handler(db, authorizeModerator = async () => ({ userId: 'admin' })) {
  return createPublicToiletHandler({ getStore: async () => new FirestoreToiletStore(db), authorizeModerator });
}
const post = (key = 'idempotency-test-key-1234', body = payload) => ({
  method: 'POST', headers: { 'idempotency-key': key }, body,
});

describe('durable public toilet reports', () => {
  it('reuses one record and receipt across independent handler/store instances', async () => {
    const db = new ToiletFirestoreFixture();
    const a = response(), b = response();
    await Promise.all([handler(db)(post(), a), handler(db)(post(), b)]);
    expect(a.statusCode).toBe(201);
    expect(b.body).toEqual(a.body);
    expect(db.records.size).toBe(1);
    const recreated = new FirestoreToiletStore(db);
    expect((await recreated.list({ limit: 10 })).items[0].receiptSeal).toBe(a.body.receiptSeal);
  });
  it('rejects a reused key with a different payload', async () => {
    const db = new ToiletFirestoreFixture();
    await handler(db)(post(), response());
    const res = response();
    await handler(db)(post(undefined, { ...payload, description: 'Different broken tap' }), res);
    expect(res.statusCode).toBe(409);
    expect(db.records.size).toBe(1);
  });
  it('does not acknowledge persistence failure and can safely retry', async () => {
    const db = new ToiletFirestoreFixture();
    db.failNext = true;
    const failed = response();
    await handler(db)(post(), failed);
    expect(failed.statusCode).toBe(503);
    expect(failed.body.receiptSeal).toBeUndefined();
    const retried = response();
    await handler(db)(post(), retried);
    expect(retried.statusCode).toBe(201);
  });
  it('keeps health public and queue data behind verified moderation access', async () => {
    const db = new ToiletFirestoreFixture();
    await handler(db)(post(), response());
    const health = response();
    await handler(db)({ method: 'GET', headers: {} }, health);
    expect(health.body.items).toBeUndefined();
    for (const status of [401, 403, 503]) {
      const denied = response();
      await handler(db, async () => ({ status }))({ method: 'GET', query: { view: 'moderation' } }, denied);
      expect(denied.statusCode).toBe(status);
      expect(denied.body.items).toBeUndefined();
    }
  });
  it('paginates with a stable cursor without returning idempotency fingerprints', async () => {
    const db = new ToiletFirestoreFixture();
    const store = new FirestoreToiletStore(db);
    for (let i = 0; i < 4; i++) await store.create(payload, 'different-test-key-' + i);
    const first = await store.list({ limit: 2 });
    const second = await new FirestoreToiletStore(db).list({ limit: 2, cursor: first.nextCursor });
    expect(new Set([...first.items, ...second.items].map(item => item.id)).size).toBe(4);
    expect(second.nextCursor).toBeNull();
    expect(first.items[0].payloadHash).toBeUndefined();
    await expect(store.list({ limit: 2, cursor: 'not-a-valid-cursor' })).rejects.toMatchObject({ code: 'invalid_cursor' });
  });
  it('persists a fenced review and rejects conflicting decisions', async () => {
    const db = new ToiletFirestoreFixture();
    const store = new FirestoreToiletStore(db);
    const record = await store.create(payload, 'review-test-key-1234');
    await store.review(record.id, 'approved', 'admin-1');
    await store.review(record.id, 'approved', 'admin-2');
    expect(db.records.get(record.id).review.actorId).toBe('admin-1');
    await expect(store.review(record.id, 'dismissed', 'admin-2')).rejects.toMatchObject({ code: 'review_conflict' });
  });
  it('bounds list requests and requires an idempotency key', async () => {
    const db = new ToiletFirestoreFixture();
    const missing = response();
    await handler(db)({ method: 'POST', headers: {}, body: payload }, missing);
    expect(missing.statusCode).toBe(400);
    const oversized = response();
    await handler(db)({ method: 'GET', query: { view: 'moderation', limit: 51 } }, oversized);
    expect(oversized.statusCode).toBe(400);
  });
});
