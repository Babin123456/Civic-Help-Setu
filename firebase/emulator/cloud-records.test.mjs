/**
 * The app's real mapping (src/services/cloudRecords.js) written through the real rules: every
 * personal store's records are accepted for their owner, read back to the exact original value,
 * and refused for anyone else.
 *   cd firebase/emulator && npm install && npm test
 */
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { serverTimestamp, doc, setDoc, getDoc, getDocs, collection, setLogLevel } from 'firebase/firestore';
import { CLOUD_STORES, toCloudRecords, fromCloudRecords } from '../../src/services/cloudRecords.js';

setLogLevel('silent');

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'civicbridge-rules-test',
    firestore: { rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const alice = () => env.authenticatedContext('alice', { role: 'citizen' }).firestore();
const bob = () => env.authenticatedContext('bob', { role: 'citizen' }).firestore();

const LIST = [
  { id: 'SRV-98234710', serviceName: 'Income Certificate', status: 'in_review', role: 'admin', isAdmin: true, nested: { a: [1, 2] } },
  { id: 'with/slashes and spaces', note: 'जन्म प्रमाण पत्र' },
  { noId: true },
  'bookmark-as-a-string',
  7,
];
const DOCUMENT = { 'income-certificate': { done: ['a', 'b'] }, role: 'admin', permissions: ['all'], uid: 'someone-else' };

const sample = (store) => (store.kind === 'list' ? LIST : DOCUMENT);
const toWrite = (record) => ({ data: record.data, schemaVersion: record.schemaVersion, updatedAt: serverTimestamp() });

for (const store of CLOUD_STORES) {
  test(`${store.key} -> users/{uid}/${store.collection}: accepted for the owner, read back unchanged, closed to others`, async () => {
    const records = toCloudRecords(store.key, sample(store));
    for (const record of records) {
      await assertSucceeds(setDoc(doc(alice(), `users/alice/${record.collection}/${record.id}`), toWrite(record)));
    }

    const snapshot = await assertSucceeds(getDocs(collection(alice(), `users/alice/${store.collection}`)));
    const mine = snapshot.docs.filter((d) => d.id.startsWith(`${store.slug}--`)).map((d) => ({ id: d.id, data: d.data().data }));
    assert.equal(mine.length, records.length);
    assert.deepEqual(fromCloudRecords(store.key, mine), sample(store));

    for (const record of records) {
      const path = `users/alice/${record.collection}/${record.id}`;
      await assertFails(getDoc(doc(bob(), path)));
      await assertFails(setDoc(doc(bob(), path), toWrite(record)));
    }
    await assertFails(getDocs(collection(bob(), `users/alice/${store.collection}`)));
  });
}

test('without the `value` wrapper, a record with a privileged field is refused; with it, nothing is lost', async () => {
  const hostile = { id: 'a', role: 'admin', isAdmin: true };
  await assertFails(setDoc(doc(alice(), 'users/alice/applications/raw'), { data: hostile, schemaVersion: 1, updatedAt: serverTimestamp() }));
  const [record] = toCloudRecords('civicbridge_applications', [hostile]);
  await assertSucceeds(setDoc(doc(alice(), `users/alice/applications/${record.id}`), toWrite(record)));
  const stored = (await getDoc(doc(alice(), `users/alice/applications/${record.id}`))).data();
  assert.deepEqual(stored.data.value, hostile);
});

test('records stay inside the rules limits: an item with many fields still fits', async () => {
  const wide = { id: 'wide', ...Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`field${i}`, i])) };
  const [record] = toCloudRecords('civicbridge_applications', [wide]);
  await assertSucceeds(setDoc(doc(alice(), `users/alice/applications/${record.id}`), toWrite(record)));
});
