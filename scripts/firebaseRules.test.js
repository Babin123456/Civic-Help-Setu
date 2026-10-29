import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const firestore = read('firebase/firestore.rules');
const storage = read('firebase/storage.rules');
const config = JSON.parse(read('firebase/firebase.json'));
const doc = read('docs/FIREBASE_RULES.md');
const firestoreTests = read('firebase/emulator/firestore-rules.test.mjs');
const storageTests = read('firebase/emulator/storage-rules.test.mjs');

// Top-level collections: "match /name/{id}" directly inside the documents block.
const topLevel = [...firestore.matchAll(/^ {4}match \/([A-Za-z]+)\/\{/gm)].map((m) => m[1]);

describe('firebase rule files', () => {
  it('are wired into firebase.json and exist', () => {
    expect(config.firestore.rules).toBe('firestore.rules');
    expect(config.storage.rules).toBe('storage.rules');
    expect(existsSync(new URL('../firebase/firestore.rules', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../firebase/storage.rules', import.meta.url))).toBe(true);
    expect(existsSync(new URL(`../firebase/${config.firestore.indexes}`, import.meta.url))).toBe(true);
  });

  it('use rules version 2', () => {
    expect(firestore).toMatch(/rules_version = '2'/);
    expect(storage).toMatch(/rules_version = '2'/);
  });

  it('end with a deny-all rule for everything not listed', () => {
    expect(firestore).toMatch(/match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
    expect(storage).toMatch(/match \/\{allPaths=\*\*\} \{\s*allow read, write: if false;\s*\}/);
    expect(firestore.lastIndexOf('{document=**}')).toBeGreaterThan(firestore.lastIndexOf('match /reviewOverrides/'));
  });

  it('never allow everyone to write', () => {
    for (const rules of [firestore, storage]) {
      const writes = [...rules.matchAll(/allow ([^:]*(?:create|update|delete|write)[^:]*): if ([^;]*);/g)];
      for (const [, , condition] of writes) {
        expect(condition.trim(), `unconditional write: ${condition}`).not.toBe('true');
      }
      expect(rules).not.toMatch(/allow [^:]*: if true[^;]*;[^]*request\.auth == null/);
    }
  });

  it('only read-open collections are the intended public ones', () => {
    const open = [...firestore.matchAll(/match \/([A-Za-z]+)\/\{[A-Za-z]+\} \{([^]*?)\n {4}\}/g)]
      .filter(([, , body]) => /allow read: if true;/.test(body))
      .map(([, name]) => name)
      .sort();
    expect(open).toEqual(['barrierInsights', 'communityAudits', 'services']);
  });

  it('take the admin role from the token, never from a document', () => {
    const isAdmin = firestore.match(/function isAdmin\(\) \{([^}]*)\}/)[1];
    expect(isAdmin).toContain("request.auth.token.get('role', 'citizen') == 'admin'");
    // a document lookup would be get(/databases/...), exists(...) or getAfter(...); token.get(...) is fine
    expect(isAdmin).not.toMatch(/(?<![.\w])get\(|exists\(|getAfter\(|\/databases\//);
    expect(firestore).not.toMatch(/get\(\/databases[^)]*roles/);
  });

  it('keep the vault limits in step with vaultValidation.js', () => {
    const validation = read('src/services/vaultValidation.js');
    const mb = Number(validation.match(/MAX_FILE_SIZE_BYTES = (\d+) \* 1024 \* 1024/)[1]);
    expect(storage).toContain(`request.resource.size <= ${mb} * 1024 * 1024`);
    for (const type of Object.keys(JSON.parse(JSON.stringify({ 'application/pdf': 1, 'image/jpeg': 1, 'image/png': 1 })))) {
      expect(validation).toContain(`'${type}'`);
      expect(storage).toContain(type);
    }
  });

  it('refuse anonymous sessions for personal data', () => {
    expect(firestore).toMatch(/function isMember\(\) \{\s*return signedIn\(\) && !isAnonymous\(\);/);
    expect(storage).toContain("sign_in_provider != 'anonymous'");
  });
});

describe('the access policy document', () => {
  it('names every top-level collection in the rules', () => {
    expect(topLevel.length).toBeGreaterThanOrEqual(10);
    for (const name of topLevel) expect(doc, name).toContain(`\`${name}/`);
  });

  it('names every personal collection', () => {
    const list = firestore.match(/function ownedCollections\(\) \{\s*return \[([^\]]*)\]/)[1];
    const names = [...list.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThanOrEqual(10);
    for (const name of names) expect(doc, name).toContain(name);
  });

  it('documents the storage path and the release instructions', () => {
    expect(doc).toContain('vault/{uid}/{fileName}');
    expect(doc).toMatch(/## Release instructions/);
    expect(doc).toMatch(/npm run rules:test.*passes/);
    expect(doc).toMatch(/not allowed/);
  });
});

describe('the emulator tests', () => {
  it('cover every top-level collection', () => {
    for (const name of topLevel) expect(firestoreTests, name).toContain(name);
  });

  it('cover every personal collection', () => {
    const list = firestore.match(/function ownedCollections\(\) \{\s*return \[([^\]]*)\]/)[1];
    for (const [, name] of list.matchAll(/'([A-Za-z]+)'/g)) expect(firestoreTests, name).toContain(`'${name}'`);
  });

  it('try the three kinds of caller and both outcomes', () => {
    for (const caller of ['anonymous(', 'citizen(', 'admin(', 'signedOut(']) expect(firestoreTests).toContain(caller);
    expect(firestoreTests).toContain('assertSucceeds');
    expect(firestoreTests).toContain('assertFails');
    expect(storageTests).toContain('assertSucceeds');
    expect(storageTests).toContain('assertFails');
  });

  it('check for privileged fields, forged owners and the role claim', () => {
    expect(firestoreTests).toContain("role: 'admin'");
    expect(firestoreTests).toContain('isAdmin: true');
    expect(firestoreTests).toContain('reporterId');
    expect(firestoreTests).toContain('role claim');
  });
});

describe('wiring', () => {
  const pkg = JSON.parse(read('package.json'));

  it('has an npm script for the emulator tests', () => {
    expect(pkg.scripts['rules:test']).toContain('firebase/emulator');
  });

  it('keeps the Firebase client SDK and firebase-tools out of the browser bundle', () => {
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(all).filter((name) => name === 'firebase' || name === 'firebase-tools')).toEqual([]);
    // firebase-admin is server code: only the serverless function under api/ may import it
    const walk = (dir) =>
      readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]
      );
    const importsFirebase = walk('src').filter(
      (file) => /\.(js|jsx)$/.test(file) && /from ['"](firebase|firebase-admin)[/'"]/.test(read(file))
    );
    expect(importsFirebase).toEqual([]);
  });

  it('routes /api to the serverless functions instead of the single-page app', () => {
    const vercel = JSON.parse(read('vercel.json'));
    const rewrite = vercel.rewrites.find((r) => r.destination === '/index.html');
    const matches = (path) => new RegExp(`^${rewrite.source}$`).test(path);
    expect(matches('/api/firebase-token')).toBe(false);
    expect(matches('/services/1')).toBe(true);
    expect(matches('/')).toBe(true);
    expect(matches('/apiary')).toBe(true);
  });

  it('runs the emulator tests in CI for changes under firebase/', () => {
    const workflow = read('.github/workflows/firebase-rules.yml');
    expect(workflow).toContain("'firebase/**'");
    expect(workflow).toContain('npm run rules:test');
    expect(workflow).toMatch(/setup-java/);
  });
});
