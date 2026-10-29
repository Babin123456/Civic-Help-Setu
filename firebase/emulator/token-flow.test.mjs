/**
 * End to end: Clerk session -> /api/firebase-token handler -> Firebase custom token -> sign in
 * (Auth emulator) -> the REAL ID token is sent to the Firestore emulator, which applies
 * firestore.rules. This is what proves the `role` claim and `sign_in_provider` values the rules
 * rely on are what Firebase really puts in the token.
 *
 * Only Clerk is faked (no Clerk key is needed): the verifier and the metadata lookup are stubs that
 * behave like Clerk's. Everything else is the real code: the handler, firebase-admin, the Auth
 * emulator and the Firestore emulator.
 *   cd firebase/emulator && npm install && npm test
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const AUTH_HOST = '127.0.0.1:9099';
const FIRESTORE_HOST = '127.0.0.1:8080';
const PROJECT = 'civicbridge-rules-test';

// firebase-admin picks the emulator up from the environment, and then signs tokens without a key.
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
process.env.GCLOUD_PROJECT = PROJECT;

const { initializeApp } = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');
const { initializeApp: initClient } = await import('firebase/app');
const { getAuth: getClientAuth, connectAuthEmulator, signInWithCustomToken, signInAnonymously } = await import('firebase/auth');
const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing');
const { createFirebaseTokenHandler } = await import('../../api/_lib/firebaseToken.js');

const adminApp = initializeApp({ projectId: PROJECT }, 'token-flow-admin');

// Stand-ins for Clerk: three sessions and what Clerk's publicMetadata says about them.
const SESSIONS = {
  'clerk-session-admin-0001': { userId: 'user_admin', metadata: { role: 'admin' } },
  'clerk-session-citizen-001': { userId: 'user_citizen', metadata: { role: 'citizen' } },
  'clerk-session-norole-0001': { userId: 'user_norole', metadata: {} },
  'clerk-session-forged-0001': { userId: 'user_forged', metadata: { role: 'superadmin' } },
};
const handler = createFirebaseTokenHandler({
  verifySession: async (token) => {
    if (!SESSIONS[token]) throw new Error('not a Clerk session');
    return { userId: SESSIONS[token].userId };
  },
  getPublicMetadata: async (userId) => Object.values(SESSIONS).find((s) => s.userId === userId).metadata,
  mintToken: (userId, claims) => getAuth(adminApp).createCustomToken(userId, claims),
});

const clientApp = initClient({ apiKey: 'fake-api-key', projectId: PROJECT }, 'token-flow-client');
const clientAuth = getClientAuth(clientApp);
connectAuthEmulator(clientAuth, `http://${AUTH_HOST}`, { disableWarnings: true });

const decode = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));

/** Runs the whole flow for one Clerk session and returns the Firebase ID token. */
async function idTokenFor(session) {
  const response = await handler({ method: 'POST', headers: { authorization: `Bearer ${session}` } });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const credential = await signInWithCustomToken(clientAuth, response.body.token);
  return credential.user.getIdToken(true);
}

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => { await env.cleanup(); });

// ---- minimal Firestore REST helpers: the emulator checks the bearer token against the rules ----

const docUrl = (path) => `http://${FIRESTORE_HOST}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`;
const strings = (object) => ({ fields: Object.fromEntries(Object.entries(object).map(([k, v]) => [k, { stringValue: v }])) });
const call = (method, path, token, body) =>
  fetch(docUrl(path), {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

test('the token the handler issues carries exactly the claims the rules read', async () => {
  const admin = decode(await idTokenFor('clerk-session-admin-0001'));
  assert.equal(admin.user_id, 'user_admin');
  assert.equal(admin.role, 'admin');
  assert.equal(admin.firebase.sign_in_provider, 'custom'); // not 'anonymous': isMember() depends on this

  const citizen = decode(await idTokenFor('clerk-session-citizen-001'));
  assert.equal(citizen.role, 'citizen');
  assert.equal(citizen.firebase.sign_in_provider, 'custom');

  // no publicMetadata role, or one the app does not know, becomes a citizen
  assert.equal(decode(await idTokenFor('clerk-session-norole-0001')).role, 'citizen');
  assert.equal(decode(await idTokenFor('clerk-session-forged-0001')).role, 'citizen');
});

test('an anonymous Firebase session has the provider the rules refuse for personal data', async () => {
  const credential = await signInAnonymously(clientAuth);
  const claims = decode(await credential.user.getIdToken(true));
  assert.equal(claims.firebase.sign_in_provider, 'anonymous');
  assert.equal(claims.role, undefined);
});

test('the handler refuses sessions Clerk does not know and issues nothing', async () => {
  const response = await handler({ method: 'POST', headers: { authorization: 'Bearer not-a-clerk-session' } });
  assert.equal(response.status, 401);
  assert.equal(response.body.token, undefined);
});

test('firestore.rules, driven by real tokens: the admin claim writes service guides, citizens cannot', async () => {
  const adminToken = await idTokenFor('clerk-session-admin-0001');
  const citizenToken = await idTokenFor('clerk-session-citizen-001');

  const guide = strings({ name: 'Income Certificate', category: 'Revenue' });
  assert.equal((await call('PATCH', 'services/income-certificate', adminToken, guide)).status, 200);
  assert.equal((await call('PATCH', 'services/income-certificate', citizenToken, guide)).status, 403);
  assert.equal((await call('PATCH', 'services/income-certificate', null, guide)).status, 403);
  // public read, with and without a token
  assert.equal((await call('GET', 'services/income-certificate', null)).status, 200);
  assert.equal((await call('GET', 'services/income-certificate', citizenToken)).status, 200);
});

test('firestore.rules, driven by real tokens: personal data is the owner only, admins included', async () => {
  const adminToken = await idTokenFor('clerk-session-admin-0001');
  const citizenToken = await idTokenFor('clerk-session-citizen-001');
  const anonymous = await (await signInAnonymously(clientAuth)).user.getIdToken(true);

  await env.withSecurityRulesDisabled(async (ctx) => {
    const { setDoc, doc, Timestamp } = await import('firebase/firestore');
    await setDoc(doc(ctx.firestore(), 'users/user_citizen/saved/s1'), { data: { title: 'x' }, schemaVersion: 1, updatedAt: Timestamp.now() });
  });

  assert.equal((await call('GET', 'users/user_citizen/saved/s1', citizenToken)).status, 200);
  assert.equal((await call('GET', 'users/user_citizen/saved/s1', adminToken)).status, 403);
  assert.equal((await call('GET', 'users/user_citizen/saved/s1', anonymous)).status, 403);
  assert.equal((await call('GET', 'users/user_citizen/saved/s1', null)).status, 403);
  // an owner id in the path must be the caller's own id
  assert.equal((await call('GET', 'users/user_admin/saved/s1', citizenToken)).status, 403);
});

test('firestore.rules, driven by real tokens: the role cannot be forged through a document', async () => {
  const citizenToken = await idTokenFor('clerk-session-citizen-001');
  await env.withSecurityRulesDisabled(async (ctx) => {
    const { setDoc, doc } = await import('firebase/firestore');
    await setDoc(doc(ctx.firestore(), 'roles/user_citizen'), { role: 'admin' });
  });
  const guide = strings({ name: 'Forged', category: 'Revenue' });
  assert.equal((await call('PATCH', 'services/forged', citizenToken, guide)).status, 403);
  assert.equal((await call('PATCH', 'roles/user_citizen', citizenToken, strings({ role: 'admin' }))).status, 403);
});
