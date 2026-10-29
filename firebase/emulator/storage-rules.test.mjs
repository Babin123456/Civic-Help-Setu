/**
 * Cloud Storage rules tests, run against the Firebase emulator.
 *   cd firebase/emulator && npm install && npm test
 */
import test, { before, after, beforeEach } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes, deleteObject, listAll } from 'firebase/storage';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'civicbridge-rules-test',
    storage: { rules: fs.readFileSync(new URL('../storage.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearStorage(); });

const citizen = (uid = 'alice') => env.authenticatedContext(uid, { role: 'citizen' }).storage();
const admin = () => env.authenticatedContext('root', { role: 'admin' }).storage();
const anonymous = () => env.authenticatedContext('anon1', { firebase: { sign_in_provider: 'anonymous' } }).storage();
const signedOut = () => env.unauthenticatedContext().storage();

const bytes = (n) => new Uint8Array(n).fill(1);
const upload = (storage, path, size = 100, contentType = 'application/pdf') =>
  uploadBytes(ref(storage, path), bytes(size), { contentType });

const seed = (path, size = 100, contentType = 'application/pdf') =>
  env.withSecurityRulesDisabled((ctx) => uploadBytes(ref(ctx.storage(), path), bytes(size), { contentType }));

test('vault: the owner can upload, read and delete their own files', async () => {
  await assertSucceeds(upload(citizen('alice'), 'vault/alice/aadhaar.pdf'));
  await assertSucceeds(getBytes(ref(citizen('alice'), 'vault/alice/aadhaar.pdf')));
  await assertSucceeds(upload(citizen('alice'), 'vault/alice/aadhaar.pdf', 200)); // replace
  await assertSucceeds(deleteObject(ref(citizen('alice'), 'vault/alice/aadhaar.pdf')));
});

test('vault: nobody else can read, write, list or delete, admins and anonymous sessions included', async () => {
  await seed('vault/alice/passport.pdf');
  for (const [name, ctx] of [['another citizen', citizen('bob')], ['admin', admin()], ['anonymous', anonymous()], ['signed out', signedOut()]]) {
    await assertFails(getBytes(ref(ctx, 'vault/alice/passport.pdf')), name);
    await assertFails(upload(ctx, 'vault/alice/other.pdf'));
    await assertFails(deleteObject(ref(ctx, 'vault/alice/passport.pdf')));
    await assertFails(listAll(ref(ctx, 'vault/alice')));
  }
  await assertFails(getBytes(ref(citizen('alice'), 'vault/bob/passport.pdf')));
});

test('vault: anonymous sessions cannot store files, even under their own id', async () => {
  await assertFails(upload(anonymous(), 'vault/anon1/a.pdf'));
});

test('vault: only PDF, JPEG and PNG are accepted', async () => {
  await assertSucceeds(upload(citizen(), 'vault/alice/a.pdf', 10, 'application/pdf'));
  await assertSucceeds(upload(citizen(), 'vault/alice/b.jpg', 10, 'image/jpeg'));
  await assertSucceeds(upload(citizen(), 'vault/alice/c.png', 10, 'image/png'));
  for (const type of ['text/html', 'image/svg+xml', 'application/javascript', 'application/x-msdownload', 'image/gif', 'application/zip']) {
    await assertFails(upload(citizen(), 'vault/alice/bad.bin', 10, type));
  }
  // an allowed type name hidden inside a longer one does not pass
  await assertFails(upload(citizen(), 'vault/alice/bad2.bin', 10, 'text/html; x=application/pdf'));
});

test('vault: files must be between 1 byte and 5 MB', async () => {
  await assertSucceeds(upload(citizen(), 'vault/alice/max.pdf', 5 * 1024 * 1024));
  await assertFails(upload(citizen(), 'vault/alice/big.pdf', 5 * 1024 * 1024 + 1));
  await assertFails(upload(citizen(), 'vault/alice/empty.pdf', 0));
});

test('vault: file names are limited in length', async () => {
  await assertSucceeds(upload(citizen(), `vault/alice/${'a'.repeat(156)}.pdf`));
  await assertFails(upload(citizen(), `vault/alice/${'a'.repeat(158)}.pdf`));
});

test('every other path is closed to everyone', async () => {
  for (const path of ['public/logo.png', 'vault/file-without-owner.pdf', 'avatars/alice.png', 'exports/alice/data.json', 'alice/a.pdf']) {
    for (const ctx of [admin(), citizen(), anonymous(), signedOut()]) {
      await assertFails(upload(ctx, path, 10, 'image/png'));
      await assertFails(getBytes(ref(ctx, path)));
    }
  }
});
