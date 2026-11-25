import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { createRequire } from 'node:module';
// Use the API SDK instance so FieldPath and Firestore share the same package.
const require = createRequire(new URL('../../package.json', import.meta.url));
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
import { FirestoreToiletStore } from '../../api/_lib/publicToiletStore.js';

let env, app, db;
const projectId = 'civicbridge-rules-test';
before(async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/);
  env = await initializeTestEnvironment({ projectId, firestore: {
    host: '127.0.0.1', port: 8080,
    rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
  } });
  await env.clearFirestore();
  app = initializeApp({ projectId }, 'toilet-submission-tests');
  db = getFirestore(app);
});
after(async () => { await db?.terminate(); if (app) await deleteApp(app); await env?.cleanup(); });

test('durable transactions survive independent store instances and concurrent retries', async () => {
  const a = new FirestoreToiletStore(db), b = new FirestoreToiletStore(db);
  const payload = { facilityId: 'pt-test', description: 'Broken tap', reportType: 'maintenance_issue' };
  const [first, replay] = await Promise.all([
    a.create(payload, 'emulator-key-00001'), b.create(payload, 'emulator-key-00001'),
  ]);
  assert.equal(first.receiptSeal, replay.receiptSeal);
  assert.equal((await db.collection('publicToiletSubmissions').get()).size, 1);
  await assert.rejects(b.create({ ...payload, description: 'Other report' }, 'emulator-key-00001'), /idempotency_conflict/);
  await a.create(payload, 'emulator-key-00002');
  await b.create(payload, 'emulator-key-00003');
  const page = await a.list({ limit: 2 });
  const last = await b.list({ limit: 2, cursor: page.nextCursor });
  assert.equal(new Set([...page.items, ...last.items].map(x => x.id)).size, 3);
  assert.equal(last.nextCursor, null);
  await a.review(first.id, 'approved', 'admin-one');
  await b.review(first.id, 'approved', 'admin-two');
  await assert.rejects(a.review(first.id, 'dismissed', 'admin-two'), /review_conflict/);
  const stored = (await db.collection('publicToiletSubmissions').doc(first.id).get()).data();
  assert.equal(stored.review.actorId, 'admin-one');
  assert.equal(stored.receiptSeal, first.receiptSeal);
  for (const context of [env.unauthenticatedContext(), env.authenticatedContext('citizen'), env.authenticatedContext('admin', { role: 'admin' })]) {
    const ref = doc(context.firestore(), 'publicToiletSubmissions', first.id);
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, payload));
  }
});
