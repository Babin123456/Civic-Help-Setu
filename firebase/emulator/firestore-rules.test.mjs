/**
 * Firestore rules tests, run against the Firebase emulator.
 *   cd firebase/emulator && npm install && npm test
 * Needs Java 11+. Also run by the release checklist (docs/FIREBASE_RULES.md) before any deploy.
 *
 * Three kinds of caller are tested everywhere: an anonymous session, an ordinary signed-in citizen,
 * and an admin (the `role: "admin"` claim in the signed token).
 */
import test, { before, after, beforeEach } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  serverTimestamp, Timestamp, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, query, where, addDoc, setLogLevel,
} from 'firebase/firestore';

// Denied requests are expected here; keep the SDK from printing each one.
setLogLevel('silent');

let env;
const PROJECT = 'civicbridge-rules-test';

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

// A citizen signs in through the Clerk -> Firebase custom token, so the provider is "custom".
const citizen = (uid = 'alice') => env.authenticatedContext(uid, { role: 'citizen' }).firestore();
const noRoleClaim = (uid = 'carol') => env.authenticatedContext(uid).firestore();
const admin = (uid = 'root') => env.authenticatedContext(uid, { role: 'admin' }).firestore();
const anonymous = (uid = 'anon1') => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const signedOut = () => env.unauthenticatedContext().firestore();

// Put a document in place without going through the rules.
const seed = (path, data) => env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));

const record = (extra = {}) => ({ data: { title: 'Income certificate' }, schemaVersion: 1, updatedAt: serverTimestamp(), ...extra });

// ---------- personal records ----------

test('users/{uid}: only the owner can read, create, edit or delete the profile', async () => {
  const profile = { displayName: 'Alice', language: 'hi', createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(citizen('alice'), 'users/alice'), profile));
  await assertSucceeds(getDoc(doc(citizen('alice'), 'users/alice')));
  await assertFails(getDoc(doc(citizen('bob'), 'users/alice')));
  await assertFails(getDoc(doc(anonymous(), 'users/alice')));
  await assertFails(getDoc(doc(signedOut(), 'users/alice')));
  await assertFails(getDoc(doc(admin(), 'users/alice'))); // private citizen data: admins have no access
  await assertFails(setDoc(doc(citizen('bob'), 'users/alice'), profile));
  await assertFails(deleteDoc(doc(citizen('bob'), 'users/alice')));
  await assertSucceeds(deleteDoc(doc(citizen('alice'), 'users/alice')));
});

test('users/{uid}: anonymous sessions cannot keep a profile', async () => {
  await assertFails(setDoc(doc(anonymous('anon1'), 'users/anon1'), { createdAt: serverTimestamp() }));
});

test('users/{uid}: cannot grant yourself privileged fields or send unexpected, oversized or forged data', async () => {
  const ref = doc(citizen('alice'), 'users/alice');
  await assertFails(setDoc(ref, { role: 'admin', createdAt: serverTimestamp() }));
  await assertFails(setDoc(ref, { isAdmin: true, createdAt: serverTimestamp() }));
  await assertFails(setDoc(ref, { verified: true, createdAt: serverTimestamp() }));
  await assertFails(setDoc(ref, { surprise: 1, createdAt: serverTimestamp() }));
  await assertFails(setDoc(ref, { displayName: 'x'.repeat(101), createdAt: serverTimestamp() }));
  await assertFails(setDoc(ref, { displayName: 42, createdAt: serverTimestamp() }));
  await assertFails(setDoc(ref, { displayName: 'A', createdAt: Timestamp.fromDate(new Date('2001-01-01')) })); // client clock
  await assertFails(setDoc(ref, { displayName: 'A' })); // createdAt is required
});

test('users/{uid}: createdAt cannot be rewritten later', async () => {
  await assertSucceeds(setDoc(doc(citizen('alice'), 'users/alice'), { displayName: 'A', createdAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(citizen('alice'), 'users/alice'), { createdAt: Timestamp.fromDate(new Date('2001-01-01')) }));
  await assertSucceeds(updateDoc(doc(citizen('alice'), 'users/alice'), { displayName: 'Alice V' }));
});

const OWNED = ['vaultDocs', 'saved', 'applications', 'officeTokens', 'reminders', 'settings', 'assessments', 'grievanceTickets', 'checklists', 'drafts', 'applicantProfiles', 'scorecards', 'assistantChats'];

for (const name of OWNED) {
  test(`users/{uid}/${name}: owner-only create, read, update, delete`, async () => {
    const path = `users/alice/${name}/r1`;
    await assertSucceeds(setDoc(doc(citizen('alice'), path), record()));
    await assertSucceeds(getDoc(doc(citizen('alice'), path)));
    await assertSucceeds(updateDoc(doc(citizen('alice'), path), { data: { title: 'Changed' }, updatedAt: serverTimestamp() }));
    await assertFails(getDoc(doc(citizen('bob'), path)));
    await assertFails(getDoc(doc(admin(), path)));
    await assertFails(getDoc(doc(anonymous(), path)));
    await assertFails(getDoc(doc(signedOut(), path)));
    await assertFails(setDoc(doc(citizen('bob'), path), record()));
    await assertFails(updateDoc(doc(citizen('bob'), path), { data: { title: 'Hijack' }, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(citizen('bob'), path)));
    await assertFails(deleteDoc(doc(admin(), path)));
    await assertSucceeds(deleteDoc(doc(citizen('alice'), path)));
  });
}

test('users/{uid}/{collection}: collections that are not in the list are refused', async () => {
  await assertFails(setDoc(doc(citizen('alice'), 'users/alice/secretStuff/r1'), record()));
  await assertFails(setDoc(doc(citizen('alice'), 'users/alice/roles/r1'), record()));
});

test('users/{uid}/{collection}: listing is limited to your own records', async () => {
  await seed('users/alice/saved/a', record({ updatedAt: Timestamp.now() }));
  await seed('users/bob/saved/b', record({ updatedAt: Timestamp.now() }));
  await assertSucceeds(getDocs(collection(citizen('alice'), 'users/alice/saved')));
  await assertFails(getDocs(collection(citizen('alice'), 'users/bob/saved')));
  await assertFails(getDocs(collection(admin(), 'users/bob/saved')));
});

test('personal records: reject privileged, unexpected, forged and oversized fields', async () => {
  const ref = (id = 'r1') => doc(citizen('alice'), `users/alice/applications/${id}`);
  await assertFails(setDoc(ref(), record({ role: 'admin' })));
  await assertFails(setDoc(ref(), record({ ownerId: 'bob' })));
  await assertFails(setDoc(ref(), record({ extra: 'field' })));
  await assertFails(setDoc(ref(), record({ data: { role: 'admin' } })));
  await assertFails(setDoc(ref(), record({ data: { isAdmin: true } })));
  await assertFails(setDoc(ref(), record({ data: 'not a map' })));
  await assertFails(setDoc(ref(), record({ data: Object.fromEntries(Array.from({ length: 61 }, (_, i) => [`k${i}`, i])) })));
  await assertFails(setDoc(ref(), record({ schemaVersion: '1' })));
  await assertFails(setDoc(ref(), record({ schemaVersion: 0 })));
  await assertFails(setDoc(ref(), record({ schemaVersion: 101 })));
  await assertFails(setDoc(ref(), record({ updatedAt: Timestamp.fromDate(new Date('2001-01-01')) })));
  const { updatedAt, ...noStamp } = record();
  void updatedAt;
  await assertFails(setDoc(ref(), noStamp));
  await assertSucceeds(setDoc(ref(), record({ data: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`k${i}`, i])) })));
});

test('personal records: createdAt cannot be changed after creation', async () => {
  const ref = doc(citizen('alice'), 'users/alice/saved/r1');
  await assertSucceeds(setDoc(ref, record({ createdAt: Timestamp.fromDate(new Date('2026-01-01')) })));
  await assertFails(updateDoc(ref, { createdAt: Timestamp.fromDate(new Date('2020-01-01')), updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(ref, { data: { title: 'ok' }, updatedAt: serverTimestamp() }));
});

test('users/{uid}/privacyAudit: append-only', async () => {
  const entry = { action: 'clear_data', category: 'drafts', createdAt: serverTimestamp() };
  const ref = doc(citizen('alice'), 'users/alice/privacyAudit/e1');
  await assertSucceeds(setDoc(ref, entry));
  await assertSucceeds(getDoc(ref));
  await assertFails(updateDoc(ref, { action: 'edited' }));
  await assertFails(deleteDoc(ref));
  await assertFails(getDoc(doc(citizen('bob'), 'users/alice/privacyAudit/e1')));
  await assertFails(getDoc(doc(admin(), 'users/alice/privacyAudit/e1')));
  await assertFails(setDoc(doc(citizen('alice'), 'users/alice/privacyAudit/e2'), { ...entry, extra: 1 }));
  await assertFails(setDoc(doc(citizen('bob'), 'users/alice/privacyAudit/e3'), entry));
});

// ---------- public reference data ----------

test('services: anyone reads, only admins write', async () => {
  const guide = { name: 'Income Certificate', category: 'Revenue', shortDescription: 'How to apply.' };
  await assertSucceeds(setDoc(doc(admin(), 'services/income-certificate'), guide));
  for (const ctx of [signedOut(), anonymous(), citizen(), noRoleClaim()]) {
    await assertSucceeds(getDoc(doc(ctx, 'services/income-certificate')));
    await assertFails(setDoc(doc(ctx, 'services/income-certificate'), { ...guide, name: 'Changed' }));
    await assertFails(setDoc(doc(ctx, 'services/new'), guide));
    await assertFails(updateDoc(doc(ctx, 'services/income-certificate'), { name: 'Changed' }));
    await assertFails(deleteDoc(doc(ctx, 'services/income-certificate')));
  }
  await assertSucceeds(getDocs(collection(signedOut(), 'services')));
});

test('services: admin writes are validated', async () => {
  await assertFails(setDoc(doc(admin(), 'services/x'), { category: 'Revenue' })); // no name
  await assertFails(setDoc(doc(admin(), 'services/x'), { name: '', category: 'Revenue' }));
  await assertFails(setDoc(doc(admin(), 'services/x'), { name: 'N'.repeat(201), category: 'Revenue' }));
  await assertFails(setDoc(doc(admin(), 'services/x'), { name: 'N', category: 5 }));
  await assertSucceeds(deleteDoc(doc(admin(), 'services/x')));
});

test('the role claim is the only way to be an admin', async () => {
  const guide = { name: 'G', category: 'C' };
  await assertFails(setDoc(doc(noRoleClaim(), 'services/g'), guide));
  await assertFails(setDoc(doc(env.authenticatedContext('x', { role: 'Admin' }).firestore(), 'services/g'), guide));
  await assertFails(setDoc(doc(env.authenticatedContext('x', { role: ['admin'] }).firestore(), 'services/g'), guide));
  await assertFails(setDoc(doc(env.authenticatedContext('x', { isAdmin: true }).firestore(), 'services/g'), guide));
  await assertFails(setDoc(doc(env.authenticatedContext('x', { role: 'admin', firebase: { sign_in_provider: 'anonymous' } }).firestore(), 'services/g'), guide));
  await assertSucceeds(setDoc(doc(admin(), 'services/g'), guide));
});

test('a role stored in a Firestore document does not make anyone an admin', async () => {
  await seed('roles/alice', { role: 'admin' });
  await seed('users/alice', { role: 'admin', createdAt: Timestamp.now() });
  await assertFails(setDoc(doc(citizen('alice'), 'services/g'), { name: 'G', category: 'C' }));
});

test('notices: only approved notices are public; admins manage all', async () => {
  const notice = (status) => ({ title: 'Fee revision', status });
  await seed('notices/n-ok', notice('approved'));
  await seed('notices/n-pending', notice('pending_review'));
  await assertSucceeds(getDoc(doc(signedOut(), 'notices/n-ok')));
  await assertSucceeds(getDoc(doc(citizen(), 'notices/n-ok')));
  await assertFails(getDoc(doc(signedOut(), 'notices/n-pending')));
  await assertFails(getDoc(doc(citizen(), 'notices/n-pending')));
  await assertSucceeds(getDoc(doc(admin(), 'notices/n-pending')));
  await assertSucceeds(getDocs(query(collection(signedOut(), 'notices'), where('status', '==', 'approved'))));
  await assertFails(getDocs(collection(signedOut(), 'notices'))); // an unfiltered list would expose pending notices
  await assertFails(setDoc(doc(citizen(), 'notices/n2'), notice('approved')));
  await assertSucceeds(setDoc(doc(admin(), 'notices/n2'), notice('approved')));
  await assertFails(setDoc(doc(admin(), 'notices/n3'), notice('published'))); // not a known status
});

test('barrierInsights: public to read, never writable from a client', async () => {
  await seed('barrierInsights/summary', { total: 3 });
  await assertSucceeds(getDoc(doc(signedOut(), 'barrierInsights/summary')));
  await assertFails(setDoc(doc(admin(), 'barrierInsights/summary'), { total: 99 }));
  await assertFails(setDoc(doc(citizen(), 'barrierInsights/summary'), { total: 99 }));
});

// ---------- citizen submissions ----------

const errorReport = (uid, extra = {}) => ({
  reporterId: uid, serviceId: 'income-certificate', serviceName: 'Income Certificate', issueType: 'Broken link',
  description: 'The portal returns 404.', status: 'pending', createdAt: serverTimestamp(), ...extra,
});

test('errorReports: any session can file one as itself, and read it back', async () => {
  for (const [ctx, uid] of [[anonymous('anon1'), 'anon1'], [citizen('alice'), 'alice'], [noRoleClaim('carol'), 'carol']]) {
    await assertSucceeds(setDoc(doc(ctx, `errorReports/${uid}-1`), errorReport(uid, { reporterEmail: 'x@example.org' })));
    await assertSucceeds(getDoc(doc(ctx, `errorReports/${uid}-1`)));
  }
  await assertFails(setDoc(doc(signedOut(), 'errorReports/r'), errorReport('nobody')));
});

test('errorReports: others cannot read; admins read and moderate; nobody else edits or deletes', async () => {
  await assertSucceeds(setDoc(doc(citizen('alice'), 'errorReports/r1'), errorReport('alice', { reporterEmail: 'a@example.org' })));
  await assertFails(getDoc(doc(citizen('bob'), 'errorReports/r1')));
  await assertFails(getDoc(doc(anonymous(), 'errorReports/r1')));
  await assertFails(getDoc(doc(signedOut(), 'errorReports/r1')));
  await assertFails(getDocs(collection(citizen('bob'), 'errorReports')));
  await assertSucceeds(getDoc(doc(admin(), 'errorReports/r1')));
  await assertSucceeds(getDocs(collection(admin(), 'errorReports')));
  await assertSucceeds(getDocs(query(collection(citizen('alice'), 'errorReports'), where('reporterId', '==', 'alice'))));
  await assertFails(updateDoc(doc(citizen('alice'), 'errorReports/r1'), { status: 'resolved' }));
  await assertFails(deleteDoc(doc(citizen('alice'), 'errorReports/r1')));
  await assertFails(updateDoc(doc(citizen('bob'), 'errorReports/r1'), { status: 'resolved' }));
  await assertSucceeds(updateDoc(doc(admin(), 'errorReports/r1'), { status: 'resolved', resolutionNotes: 'Fixed.' }));
  await assertFails(updateDoc(doc(admin(), 'errorReports/r1'), { description: 'rewritten' })); // admins may not rewrite the report
  await assertFails(updateDoc(doc(admin(), 'errorReports/r1'), { reporterId: 'bob' }));
  await assertFails(updateDoc(doc(admin(), 'errorReports/r1'), { status: 'weird' }));
  await assertSucceeds(deleteDoc(doc(admin(), 'errorReports/r1')));
});

test('errorReports: cannot be filed as someone else or with a forged status, time or extra fields', async () => {
  const ctx = citizen('alice');
  await assertFails(setDoc(doc(ctx, 'errorReports/a'), errorReport('bob')));
  await assertFails(setDoc(doc(ctx, 'errorReports/b'), errorReport('alice', { status: 'resolved' })));
  await assertFails(setDoc(doc(ctx, 'errorReports/c'), errorReport('alice', { createdAt: Timestamp.fromDate(new Date('2001-01-01')) })));
  await assertFails(setDoc(doc(ctx, 'errorReports/d'), errorReport('alice', { role: 'admin' })));
  await assertFails(setDoc(doc(ctx, 'errorReports/e'), errorReport('alice', { resolutionNotes: 'pre-filled' })));
  await assertFails(setDoc(doc(ctx, 'errorReports/f'), errorReport('alice', { description: 'x'.repeat(2001) })));
  await assertFails(setDoc(doc(ctx, 'errorReports/g'), errorReport('alice', { description: '' })));
  await assertFails(setDoc(doc(ctx, 'errorReports/h'), errorReport('alice', { description: 7 })));
  const { issueType, ...missing } = errorReport('alice');
  void issueType;
  await assertFails(setDoc(doc(ctx, 'errorReports/i'), missing));
});

test('serviceSubmissions: filed by any session, read by the filer and admins, reviewed only by admins', async () => {
  const submission = (uid, extra = {}) => ({
    reporterId: uid, name: 'Disability pension', category: 'Social welfare', officialUrl: 'https://example.gov.in/x',
    contributorEmail: 'c@example.org', status: 'pending', createdAt: serverTimestamp(), ...extra,
  });
  await assertSucceeds(setDoc(doc(anonymous('anon1'), 'serviceSubmissions/s1'), submission('anon1')));
  await assertSucceeds(setDoc(doc(citizen('alice'), 'serviceSubmissions/s2'), submission('alice')));
  await assertFails(setDoc(doc(citizen('alice'), 'serviceSubmissions/s3'), submission('alice', { status: 'approved' })));
  await assertFails(setDoc(doc(citizen('alice'), 'serviceSubmissions/s4'), submission('bob')));
  await assertFails(setDoc(doc(citizen('alice'), 'serviceSubmissions/s5'), submission('alice', { verified: true })));
  await assertSucceeds(getDoc(doc(citizen('alice'), 'serviceSubmissions/s2')));
  await assertFails(getDoc(doc(citizen('bob'), 'serviceSubmissions/s2')));
  await assertFails(getDoc(doc(signedOut(), 'serviceSubmissions/s2')));
  await assertFails(updateDoc(doc(citizen('alice'), 'serviceSubmissions/s2'), { status: 'approved' }));
  await assertSucceeds(updateDoc(doc(admin(), 'serviceSubmissions/s2'), { status: 'approved', reviewNotes: 'Checked.' }));
  await assertFails(updateDoc(doc(admin(), 'serviceSubmissions/s2'), { contributorEmail: 'other@example.org' }));
});

test('barrierReports: filed by any session; read by filer and admins; moderated by admins', async () => {
  const report = (uid, extra = {}) => ({
    reporterId: uid, serviceId: 'passport', barrierCategory: 'long_wait', severity: 'high', status: 'pending', createdAt: serverTimestamp(), ...extra,
  });
  await assertSucceeds(setDoc(doc(anonymous('anon1'), 'barrierReports/b1'), report('anon1')));
  await assertFails(setDoc(doc(anonymous('anon1'), 'barrierReports/b2'), report('anon1', { status: 'approved' })));
  await assertFails(setDoc(doc(citizen('alice'), 'barrierReports/b3'), report('bob')));
  await assertSucceeds(getDoc(doc(anonymous('anon1'), 'barrierReports/b1')));
  await assertFails(getDoc(doc(anonymous('anon2'), 'barrierReports/b1')));
  await assertFails(getDoc(doc(citizen('alice'), 'barrierReports/b1')));
  await assertFails(updateDoc(doc(anonymous('anon1'), 'barrierReports/b1'), { status: 'approved' }));
  await assertSucceeds(updateDoc(doc(admin(), 'barrierReports/b1'), { status: 'approved', reviewerNotes: 'ok', reviewedBy: 'root', reviewedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(admin(), 'barrierReports/b1'), { description: 'edited' }));
});

test('bottleneckFeedback: filed by any session; moderated by admins only', async () => {
  const feedback = (uid, extra = {}) => ({
    reporterId: uid, serviceId: 'ration-card', category: 'documents', message: 'The form asks for the same proof twice.', status: 'new', createdAt: serverTimestamp(), ...extra,
  });
  await assertSucceeds(setDoc(doc(anonymous('anon1'), 'bottleneckFeedback/f1'), feedback('anon1')));
  await assertFails(setDoc(doc(anonymous('anon1'), 'bottleneckFeedback/f2'), feedback('anon1', { message: 'x'.repeat(1501) })));
  await assertFails(setDoc(doc(anonymous('anon1'), 'bottleneckFeedback/f3'), feedback('anon1', { status: 'addressed' })));
  await assertFails(getDoc(doc(citizen('alice'), 'bottleneckFeedback/f1')));
  await assertSucceeds(getDoc(doc(admin(), 'bottleneckFeedback/f1')));
  await assertFails(updateDoc(doc(citizen('alice'), 'bottleneckFeedback/f1'), { status: 'dismissed' }));
  await assertSucceeds(updateDoc(doc(admin(), 'bottleneckFeedback/f1'), { status: 'addressed' }));
});

test('communityAudits: public to read, filed by accounts, resolved by admins, one vote per account', async () => {
  const audit = (uid, extra = {}) => ({
    reporterId: uid, serviceId: 'driving-license', category: 'FEE_CHANGE', title: 'Fee is now 300', status: 'PENDING_CORROBORATION', createdAt: serverTimestamp(), ...extra,
  });
  await assertSucceeds(setDoc(doc(citizen('alice'), 'communityAudits/a1'), audit('alice')));
  await assertFails(setDoc(doc(anonymous('anon1'), 'communityAudits/a2'), audit('anon1'))); // needs an account
  await assertFails(setDoc(doc(signedOut(), 'communityAudits/a3'), audit('x')));
  await assertFails(setDoc(doc(citizen('alice'), 'communityAudits/a4'), audit('bob')));
  await assertFails(setDoc(doc(citizen('alice'), 'communityAudits/a5'), audit('alice', { status: 'RESOLVED' })));
  await assertSucceeds(getDoc(doc(signedOut(), 'communityAudits/a1')));
  await assertSucceeds(getDocs(collection(signedOut(), 'communityAudits')));
  await assertFails(updateDoc(doc(citizen('alice'), 'communityAudits/a1'), { status: 'RESOLVED' }));
  await assertFails(updateDoc(doc(citizen('alice'), 'communityAudits/a1'), { upvotes: 999 }));
  await assertSucceeds(updateDoc(doc(admin(), 'communityAudits/a1'), { status: 'RESOLVED', adminNote: 'Confirmed.' }));
  await assertFails(updateDoc(doc(admin(), 'communityAudits/a1'), { title: 'rewritten' }));

  const vote = (ctx, voter, value = 'UP') => setDoc(doc(ctx, `communityAudits/a1/votes/${voter}`), { vote: value, updatedAt: serverTimestamp() });
  await assertSucceeds(vote(citizen('alice'), 'alice'));
  await assertSucceeds(vote(citizen('alice'), 'alice', 'DOWN')); // change your own vote
  await assertFails(vote(citizen('alice'), 'bob')); // vote as someone else
  await assertFails(vote(anonymous('anon1'), 'anon1'));
  await assertFails(vote(citizen('alice'), 'alice', 'SIDEWAYS'));
  await assertSucceeds(getDoc(doc(citizen('alice'), 'communityAudits/a1/votes/alice')));
  await assertFails(getDoc(doc(citizen('bob'), 'communityAudits/a1/votes/alice')));
  await assertSucceeds(deleteDoc(doc(citizen('alice'), 'communityAudits/a1/votes/alice')));
});

// ---------- admin only ----------

test('roles: owner and admins can read; nobody can write from a client', async () => {
  await seed('roles/alice', { role: 'citizen' });
  await assertSucceeds(getDoc(doc(citizen('alice'), 'roles/alice')));
  await assertSucceeds(getDoc(doc(admin(), 'roles/alice')));
  await assertFails(getDoc(doc(citizen('bob'), 'roles/alice')));
  await assertFails(getDoc(doc(signedOut(), 'roles/alice')));
  for (const ctx of [citizen('alice'), admin(), anonymous(), signedOut()]) {
    await assertFails(setDoc(doc(ctx, 'roles/alice'), { role: 'admin' }));
    await assertFails(updateDoc(doc(ctx, 'roles/alice'), { role: 'admin' }));
    await assertFails(deleteDoc(doc(ctx, 'roles/alice')));
  }
});

test('auditLogs: admins append entries as themselves; no edits, no deletes; nobody else reads', async () => {
  const entry = (actorId, extra = {}) => ({ action: 'SERVICE_UPDATED', actorId, target: 'income-certificate', createdAt: serverTimestamp(), ...extra });
  await assertSucceeds(setDoc(doc(admin('root'), 'auditLogs/l1'), entry('root')));
  await assertFails(setDoc(doc(admin('root'), 'auditLogs/l2'), entry('someone-else'))); // cannot sign as another admin
  await assertFails(setDoc(doc(admin('root'), 'auditLogs/l3'), entry('root', { createdAt: Timestamp.fromDate(new Date('2001-01-01')) })));
  await assertFails(setDoc(doc(admin('root'), 'auditLogs/l4'), entry('root', { extra: 1 })));
  await assertFails(setDoc(doc(citizen('alice'), 'auditLogs/l5'), entry('alice')));
  await assertFails(setDoc(doc(anonymous(), 'auditLogs/l6'), entry('anon1')));
  await assertSucceeds(getDoc(doc(admin(), 'auditLogs/l1')));
  await assertSucceeds(getDocs(collection(admin(), 'auditLogs')));
  await assertFails(getDoc(doc(citizen('alice'), 'auditLogs/l1')));
  await assertFails(getDocs(collection(citizen('alice'), 'auditLogs')));
  await assertFails(getDoc(doc(signedOut(), 'auditLogs/l1')));
  await assertFails(updateDoc(doc(admin('root'), 'auditLogs/l1'), { action: 'EDITED' }));
  await assertFails(deleteDoc(doc(admin('root'), 'auditLogs/l1')));
});

test('sourceConflicts and reviewOverrides: admin only', async () => {
  for (const path of ['sourceConflicts/c1', 'reviewOverrides/income-certificate']) {
    await assertSucceeds(setDoc(doc(admin(), path), { status: 'open' }));
    await assertSucceeds(getDoc(doc(admin(), path)));
    for (const ctx of [citizen(), anonymous(), signedOut()]) {
      await assertFails(getDoc(doc(ctx, path)));
      await assertFails(setDoc(doc(ctx, path), { status: 'resolved' }));
      await assertFails(deleteDoc(doc(ctx, path)));
    }
  }
});

// ---------- default deny ----------

test('collections that are not in the policy are closed to everyone', async () => {
  for (const path of ['unknown/x', 'config/app', 'adminSettings/x', 'secrets/key']) {
    for (const ctx of [admin(), citizen(), anonymous(), signedOut()]) {
      await assertFails(setDoc(doc(ctx, path), { a: 1 }));
      await assertFails(getDoc(doc(ctx, path)));
    }
  }
  await assertFails(addDoc(collection(admin(), 'newCollection'), { a: 1 }));
});
