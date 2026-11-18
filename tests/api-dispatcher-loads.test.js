import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

// Vite and Vitest accept `import x from '../utils/diagnostics'`, plain Node ESM does not. Vercel runs
// api/[...path].js under plain Node, so one extensionless import anywhere in its graph turns every
// route behind the dispatcher into a 500 (FUNCTION_INVOCATION_FAILED). Vitest would never notice,
// so these tests look at the graph the way Node does.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DISPATCHER = join(ROOT, 'api', '[...path].js');

const STATIC_IMPORT = /(?:^|[\n;])\s*(?:import|export)\s[^'";]*?from\s*['"](\.{1,2}\/[^'"]+)['"]/g;
const BARE_IMPORT = /(?:^|[\n;])\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;

/** Walks the relative imports from the dispatcher the way Node resolves them: the exact path, no guessing. */
function walkDispatcherGraph() {
  const seen = new Set();
  const unresolved = [];
  const stack = [DISPATCHER];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const pattern of [STATIC_IMPORT, BARE_IMPORT, DYNAMIC_IMPORT]) {
      for (const match of source.matchAll(pattern)) {
        const target = resolve(dirname(file), match[1]);
        if (existsSync(target) && statSync(target).isFile()) stack.push(target);
        else unresolved.push(`${file.slice(ROOT.length + 1)}: ${match[1]}`);
      }
    }
  }
  return { files: [...seen], unresolved: [...new Set(unresolved)].sort() };
}

describe('api/[...path].js import graph', () => {
  it('only has relative imports that Node can resolve as written (every one names its file and extension)', () => {
    const { files, unresolved } = walkDispatcherGraph();
    expect(files.length).toBeGreaterThan(25); // it really reached the handlers and the src/ files behind them
    expect(unresolved).toEqual([]);
  });
});

describe('api/[...path].js under plain Node', () => {
  const PROBE = `
    const { default: handler } = await import(${JSON.stringify(DISPATCHER)});
    const call = async (req) => {
      const res = {
        statusCode: 200, body: undefined, headers: {}, writableEnded: false,
        setHeader(name, value) { this.headers[name] = value; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; this.writableEnded = true; return this; },
        end() { this.writableEnded = true; return this; },
      };
      await handler({ method: 'GET', headers: {}, query: {}, url: '/', ...req }, res);
      return { status: res.statusCode, body: res.body };
    };
    const out = {
      unknown: await call({ url: '/api/does-not-exist', query: { path: 'does-not-exist' } }),
      unknownNoQuery: await call({ url: '/api/does-not-exist?x=1' }),
      nested: await call({ url: '/api/email/verify', query: { path: 'email/verify' } }),
      nestedSegments: await call({ url: '/api/email/verify', query: { path: ['email', 'verify'] } }),
    };
    console.log('@@RESULT@@' + JSON.stringify(out));
  `;

  const run = () =>
    spawnSync(process.execPath, ['--input-type=module', '-e', PROBE], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...process.env, NODE_ENV: 'test' },
    });

  it('loads, answers an unknown route with the dispatcher JSON 404, and routes nested paths to their handler', () => {
    const child = run();
    expect(child.stderr, 'the module graph failed to load').not.toMatch(/ERR_MODULE_NOT_FOUND|Cannot find module|SyntaxError/);
    expect(child.status, child.stderr).toBe(0);
    const result = JSON.parse(child.stdout.split('@@RESULT@@')[1]);

    expect(result.unknown).toEqual({ status: 404, body: { error: 'API route not found' } });
    expect(result.unknownNoQuery).toEqual({ status: 404, body: { error: 'API route not found' } });
    // email/verify has two path segments. It must reach the email handler (which answers for itself)
    // and not the dispatcher's "not found".
    for (const key of ['nested', 'nestedSegments']) {
      expect(result[key].body?.error, key).not.toBe('API route not found');
      expect(result[key].status, key).not.toBe(404);
    }
  });
});

describe('vercel.json', () => {
  const config = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));

  it('sends nested /api paths to the dispatcher before the single page app fallback', () => {
    const [apiRewrite, spaRewrite] = config.rewrites;
    expect(apiRewrite.source).toBe('/api/(.*)');
    expect(apiRewrite.destination).toMatch(/^\/api\/\[\.\.\.path\]/);
    expect(existsSync(DISPATCHER)).toBe(true);
    expect(new RegExp(`^${apiRewrite.source}$`).test('/api/email/verify')).toBe(true);
    expect(spaRewrite.destination).toBe('/index.html');
    // The SPA fallback must still skip /api, or a miss under /api would answer with index.html.
    expect(new RegExp(`^${spaRewrite.source}$`).test('/api/email/verify')).toBe(false);
  });
});
