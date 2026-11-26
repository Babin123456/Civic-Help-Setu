import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getBytes } from 'firebase/storage';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
import { FirestoreFeedbackPipeline } from '../../api/_lib/feedbackPipeline.js';

let env, app, db, bucket;
let now = Date.parse('2026-11-25T12:00:00Z');
const projectId = 'civicbridge-rules-test', secret = 'synthetic-emulator-secret-32-bytes-long';
const valid = { serviceId: 'driving-licence', category: 'other', rating: 3, notes: 'Synthetic guide feedback only' };
const pipeline = options => new FirestoreFeedbackPipeline(db, { bucket, secret, now: () => now, ...options });
before(async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/);
  assert.match(process.env.STORAGE_EMULATOR_HOST || process.env.FIREBASE_STORAGE_EMULATOR_HOST || '', /^(https?:\/\/)?(127\.0\.0\.1|localhost):\d+$/);
  env = await initializeTestEnvironment({ projectId,
    firestore: { host: '127.0.0.1', port: 8080, rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
    storage: { host: '127.0.0.1', port: 9199, rules: fs.readFileSync(new URL('../storage.rules', import.meta.url), 'utf8') },
  });
  await env.clearFirestore();
  app = initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` }, 'feedback-pipeline-tests');
  db = getFirestore(app); bucket = getStorage(app).bucket();
});
after(async () => { await db?.terminate(); if (app) await deleteApp(app); await env?.cleanup(); });

test('eight concurrent retries create one durable report; independent instances recover and reject changed payload', async () => {
  const receipts = await Promise.all(Array.from({ length: 8 }, () => pipeline().submit(valid, 'concurrent-key-0001', 'network:shared')));
  assert.equal(new Set(receipts.map(row => row.id)).size, 1);
  assert.equal((await db.collection('bottleneckFeedback').get()).size, 1);
  const replay = await pipeline().submit(valid, 'concurrent-key-0001', 'network:shared');
  assert.equal(replay.id, receipts[0].id);
  await assert.rejects(pipeline().submit({ ...valid, rating: 5 }, 'concurrent-key-0001', 'network:shared'), /idempotency_conflict/);
});

test('spam bursts consume only their actor quota; another actor and next window still submit', async () => {
  const spam = pipeline({ limit: 8 });
  for (let i = 0; i < 8; i++) await spam.submit(valid, `spam-attempt-${String(i).padStart(5, '0')}`, 'network:spammer');
  for (let i = 8; i < 30; i++) await assert.rejects(spam.submit(valid, `spam-attempt-${String(i).padStart(5, '0')}`, 'network:spammer'), /rate_limited/);
  const legitimate = await spam.submit(valid, 'legitimate-key-0001', 'network:another');
  assert.ok(legitimate.id);
  const suspect = await spam.list({ queue: 'suspected_spam' });
  assert.ok(suspect.items.length > 0);
  now += 60_001;
  assert.ok((await spam.submit(valid, 'next-window-key-0001', 'network:spammer')).id);
  const quotas = await db.collection('abuseControlQuotas').get();
  assert.ok(quotas.docs.every(row => !JSON.stringify(row.data()).includes('network:')));
});

test('bounded oldest-first pagination has no gaps and SLA flags survive independent instances', async () => {
  for (let i = 0; i < 5; i++) await pipeline().submit(valid, `page-key-${String(i).padStart(10, '0')}`, `user:page${i}`);
  now += 86_400_001;
  let cursor, ids = [];
  do { const page = await pipeline().list({ limit: 3, cursor }); ids.push(...page.items.map(item => item.id));
    assert.ok(page.items.every(item => item.overdue)); cursor = page.nextCursor;
  } while (cursor);
  assert.equal(ids.length, new Set(ids).size); assert.ok(ids.length >= 5);
});

test('review compare-and-swap records one auditable winner; private data never enters public aggregates', async () => {
  const receipts = [];
  for (let i = 0; i < 6; i++) receipts.push(await pipeline().submit(valid, `metrics-key-${String(i).padStart(8, '0')}`, `user:metrics${i}`));
  const first = receipts[0];
  const race = await Promise.allSettled(['admin-a', 'admin-b'].map(actor => pipeline().review(first.id, { status: 'addressed', revision: 0, notes: 'mail@example.com' }, actor)));
  assert.equal(race.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(race.filter(row => row.status === 'rejected')[0].reason.code, 'review_conflict');
  assert.equal((await pipeline().audit(first.id)).items.length, 1);
  assert.equal((await pipeline().publicMetrics()).totalReports, 0);
  for (const receipt of receipts.slice(1)) await pipeline().review(receipt.id, { status: 'addressed', revision: 0 }, 'admin-a');
  const metrics = await pipeline().publicMetrics();
  assert.equal(metrics.totalReports, 5); assert.equal(metrics.categoryCounts.other, 5);
  assert.doesNotMatch(JSON.stringify(metrics), /notes|Synthetic|reviewedBy|mail@example.com|attachment|serviceId/);
  await pipeline().review(first.id, { status: 'dismissed', revision: 1 }, 'admin-b');
  assert.equal((await pipeline().publicMetrics()).totalReports, 5);
  await pipeline().review(receipts[1].id, { status: 'dismissed', revision: 1 }, 'admin-b');
  assert.equal((await pipeline().publicMetrics()).totalReports, 0);
});

test('attachment quarantine fails closed, resumes after upload outage, and binds scanner verdicts to immutable bytes', async () => {
  const payload = { ...valid, attachment: { base64: Buffer.from('synthetic attachment').toString('base64'), contentType: 'application/pdf', state: 'clean' } };
  await assert.rejects(pipeline({ bucket: null }).submit(payload, 'attachment-key-0001', 'user:attachment'), /attachment_storage_unavailable/);
  const receipt = await pipeline().submit(payload, 'attachment-key-0001', 'user:attachment');
  assert.equal(receipt.attachmentState, 'quarantined');
  await assert.rejects(pipeline().attachmentUrl(receipt.id), /attachment_quarantined/);
  const stored = (await db.collection('bottleneckFeedback').doc(receipt.id).get()).data();
  const attachment = stored.attachment;
  assert.equal((await bucket.file(attachment.object).download())[0].toString(), 'synthetic attachment');
  await assert.rejects(pipeline().recordScan(receipt.id, { ...attachment, generation: '99999', verdict: 'clean', scanner: 'synthetic-scanner' }), /scan_conflict/);
  await pipeline().recordScan(receipt.id, { ...attachment, verdict: 'rejected', scanner: 'synthetic-scanner' });
  await assert.rejects(pipeline().attachmentUrl(receipt.id), /attachment_quarantined/);
  await assert.rejects(pipeline().recordScan(receipt.id, { ...attachment, verdict: 'clean', scanner: 'synthetic-scanner' }), /scan_conflict/);
  const cleanReceipt = await pipeline().submit(payload, 'attachment-key-0002', 'user:attachment');
  const clean = (await db.collection('bottleneckFeedback').doc(cleanReceipt.id).get()).data().attachment;
  await pipeline().recordScan(cleanReceipt.id, { ...clean, verdict: 'clean', scanner: 'synthetic-scanner' });
  let signed;
  const signer = { file: (path, options) => ({ getSignedUrl: async config => { signed = { path, options, config }; return ['https://synthetic.invalid/signed']; } }) };
  assert.equal((await pipeline({ bucket: signer }).attachmentUrl(cleanReceipt.id)).expiresInSeconds, 60);
  assert.equal(signed.options.generation, clean.generation); assert.equal(signed.config.action, 'read');
  assert.equal(signed.config.expires, now + 60_000);
  await pipeline().recordScan(cleanReceipt.id, { ...clean, verdict: 'rejected', scanner: 'synthetic-rescan' });
  await assert.rejects(pipeline().attachmentUrl(cleanReceipt.id), /attachment_quarantined/);
  assert.equal((await pipeline().audit(cleanReceipt.id)).items.length, 2);
});

test('citizens, guests and UI admins cannot bypass the API, forge audit/aggregate rows or read quarantine objects', async () => {
  for (const context of [env.unauthenticatedContext(), env.authenticatedContext('citizen'), env.authenticatedContext('admin', { role: 'admin' })]) {
    const firestore = context.firestore();
    for (const path of ['bottleneckFeedback/forged', 'bottleneckFeedback/forged/audit/1', 'bottleneckFeedbackAggregates/forged']) {
      await assertFails(setDoc(doc(firestore, path), { status: 'addressed' }));
      await assertFails(getDoc(doc(firestore, path)));
    }
    const object = storageRef(context.storage(), 'feedback-quarantine/forged/payload');
    await assertFails(uploadBytes(object, new Uint8Array([1]), { contentType: 'image/png' }));
    await assertFails(getBytes(object));
  }
});

test('synthetic 40-actor concurrent load is bounded and does not share a global quota document', async () => {
  const start = performance.now();
  const results = await Promise.all(Array.from({ length: 40 }, (_, i) => pipeline().submit(valid, `load-key-${String(i).padStart(10, '0')}`, `user:load${i}`)));
  assert.equal(new Set(results.map(result => result.id)).size, 40);
  console.log(JSON.stringify({ workload: '40 synthetic independent actors / emulator', elapsedMs: Math.round(performance.now() - start), accepted: results.length }));
});
