import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BASELINE_HEADERS,
  CLERK_DEV_HOST,
  POLICY,
  buildCsp,
  buildHeaders,
  normalizeHost,
  toVercelConfig,
} from './securityHeaders.js';
import { optionsFromVercelJson, parseArgs } from './generateVercelHeaders.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const vercel = () => JSON.parse(read('vercel.json'));

const directives = (csp) =>
  Object.fromEntries(
    csp.split('; ').map((part) => {
      const [name, ...sources] = part.split(' ');
      return [name, sources];
    }),
  );

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

/** Files the production bundle can reach, following static and dynamic relative imports from main.jsx. */
function reachableFromEntry() {
  const seen = new Set();
  const resolve = (from, spec) => {
    const base = join(from, '..', spec);
    for (const candidate of [base, `${base}.js`, `${base}.jsx`, join(base, 'index.js'), join(base, 'index.jsx')]) {
      try {
        if (statSync(candidate).isFile()) return candidate;
      } catch {
        /* try the next one */
      }
    }
    return null;
  };
  const visit = (file) => {
    if (seen.has(file) || !/\.(jsx?)$/.test(file)) return;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    const specs = [...text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g)].map((m) => m[1]);
    for (const spec of specs) {
      const target = resolve(file, spec);
      if (target) visit(target);
    }
  };
  visit(join(ROOT, 'src', 'main.jsx'));
  return seen;
}

const isTest = (file) => /\.test\.[jt]sx?$/.test(file);
const sourceFiles = () => walk(join(ROOT, 'src')).filter((f) => /\.(jsx?|css)$/.test(f) && !isTest(f));

describe('policy shape', () => {
  const csp = directives(buildCsp());

  it('starts from a locked-down default', () => {
    expect(csp['default-src']).toEqual(["'self'"]);
    expect(csp['object-src']).toEqual(["'none'"]);
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
    expect(csp['base-uri']).toEqual(["'self'"]);
    expect(csp['form-action']).toEqual(["'self'"]);
    expect(csp).toHaveProperty('upgrade-insecure-requests');
  });

  it('never allows eval, and never allows inline scripts', () => {
    const everything = Object.values(csp).flat();
    expect(everything).not.toContain("'unsafe-eval'");
    expect(everything).not.toContain("'wasm-unsafe-eval'");
    expect(csp['script-src']).not.toContain("'unsafe-inline'");
    expect(csp['script-src']).not.toContain("'strict-dynamic'"); // not needed, and would change what is trusted
  });

  it('uses no broad wildcards: only the documented Clerk dev subdomain wildcard', () => {
    const wild = Object.values(csp)
      .flat()
      .filter((s) => s.includes('*'));
    expect([...new Set(wild)]).toEqual([CLERK_DEV_HOST]);
    ['*', 'https:', 'http:', 'ws:', 'wss:'].forEach((bare) => {
      expect(Object.values(csp).flat()).not.toContain(bare);
    });
  });

  it('allows data: and blob: only where the app needs them, never for scripts', () => {
    for (const [directive, sources] of Object.entries(csp)) {
      const schemes = sources.filter((s) => s === 'data:' || s === 'blob:');
      if (schemes.length === 0) continue;
      expect(['img-src', 'frame-src', 'worker-src', 'media-src']).toContain(directive);
    }
    expect(csp['script-src']).not.toContain('data:');
    expect(csp['script-src']).not.toContain('blob:');
  });

  it("'unsafe-inline' appears only for styles, which is documented", () => {
    const withInline = Object.entries(csp)
      .filter(([, sources]) => sources.includes("'unsafe-inline'"))
      .map(([name]) => name);
    expect(withInline).toEqual(['style-src']);
    expect(POLICY['style-src'].why).toMatch(/unsafe-inline/);
  });

  it('every directive explains why', () => {
    for (const [directive, { why }] of Object.entries(POLICY)) {
      expect(why.length, directive).toBeGreaterThan(10);
    }
  });

  it('every external origin is documented in docs/SECURITY_HEADERS.md', () => {
    const doc = read('docs/SECURITY_HEADERS.md');
    const origins = new Set(
      Object.values(csp)
        .flat()
        .filter((s) => s.startsWith('https://')),
    );
    expect(origins.size).toBeGreaterThan(3);
    for (const origin of origins) expect(doc, origin).toContain(origin);
  });
});

describe('modes', () => {
  it('defaults to report-only: the CSP header never blocks anything', () => {
    const keys = buildHeaders().map((h) => h.key);
    expect(keys).toContain('Content-Security-Policy-Report-Only');
    expect(keys).not.toContain('Content-Security-Policy');
  });

  it('can enforce, and then the report-only header is gone', () => {
    const keys = buildHeaders({ mode: 'enforce' }).map((h) => h.key);
    expect(keys).toContain('Content-Security-Policy');
    expect(keys).not.toContain('Content-Security-Policy-Report-Only');
  });

  it('refuses an unknown mode instead of silently picking one', () => {
    expect(() => buildHeaders({ mode: 'enforced' })).toThrow(/Unknown mode/);
    expect(() => buildHeaders({ mode: '' })).toThrow(/Unknown mode/);
  });

  it('the policy is identical in both modes, except for the directive browsers ignore when reporting only', () => {
    const value = (mode) => buildHeaders({ mode })[0].value;
    expect(value('enforce')).toBe(`${value('report-only')}; upgrade-insecure-requests`);
    expect(value('report-only')).not.toContain('upgrade-insecure-requests');
  });
});

describe('baseline headers', () => {
  const headers = Object.fromEntries(buildHeaders().map((h) => [h.key, h.value]));

  it('stops MIME sniffing, framing and referrer leakage', () => {
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  it('turns off powerful features the app does not use and limits the ones it does', () => {
    const permissions = headers['Permissions-Policy'];
    ['camera=()', 'payment=()', 'usb=()', 'gyroscope=()', 'accelerometer=()', 'magnetometer=()'].forEach((p) =>
      expect(permissions).toContain(p),
    );
    expect(permissions).toContain('microphone=(self)'); // voice search
    expect(permissions).toContain('geolocation=(self)'); // nearby offices
    expect(permissions).not.toContain('*');
  });

  it('requires HTTPS for a year', () => {
    expect(headers['Strict-Transport-Security']).toMatch(/^max-age=31536000/);
  });

  it('has no duplicate header names', () => {
    const keys = buildHeaders().map((h) => h.key.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
    expect(BASELINE_HEADERS.length).toBe(keys.length - 1);
  });
});

describe('configuring hosts and reporting', () => {
  it('adds a production Clerk host to scripts and API calls only', () => {
    const csp = directives(buildCsp({ clerkHosts: ['clerk.example.org'] }));
    expect(csp['script-src']).toContain('https://clerk.example.org');
    expect(csp['connect-src']).toContain('https://clerk.example.org');
    expect(csp['img-src']).not.toContain('https://clerk.example.org');
    expect(csp['frame-src']).not.toContain('https://clerk.example.org');
  });

  it('accepts a host with or without https and a port', () => {
    expect(normalizeHost('clerk.example.org')).toBe('https://clerk.example.org');
    expect(normalizeHost('https://clerk.example.org')).toBe('https://clerk.example.org');
    expect(normalizeHost('clerk.example.org:8443')).toBe('https://clerk.example.org:8443');
  });

  it('cannot be used to inject another directive or a wildcard', () => {
    [
      "clerk.example.org; script-src 'unsafe-inline'",
      'clerk.example.org script-src *',
      '*.example.org',
      'http://clerk.example.org',
      'https://',
      '',
      'a b',
      "clerk.example.org'",
    ].forEach((bad) => expect(() => normalizeHost(bad), bad).toThrow(/Not a valid host/));
  });

  it('adds a report URI only over https', () => {
    const csp = buildCsp({ reportUri: 'https://example.report-uri.com/r/d/csp/reportOnly' });
    expect(csp).toContain('report-uri https://example.report-uri.com/r/d/csp/reportOnly');
    expect(() => buildCsp({ reportUri: 'http://example.com/r' })).toThrow(/https/);
    expect(() => buildCsp({ reportUri: 'not a url' })).toThrow();
    expect(buildCsp()).not.toContain('report-uri');
  });
});

describe('vercel.json', () => {
  it('matches what scripts/securityHeaders.js generates, so the two cannot drift', () => {
    const current = vercel();
    const options = optionsFromVercelJson(current);
    expect(toVercelConfig(current, options)).toEqual(current);
  });

  it('keeps the single page app rewrite, except for the /api serverless functions', () => {
    expect(vercel().rewrites).toEqual([{ source: '/((?!api/).*)', destination: '/index.html' }]);
  });

  it('applies the headers to every route', () => {
    const { headers } = vercel();
    expect(headers).toHaveLength(1);
    expect(headers[0].source).toBe('/(.*)');
  });

  it('currently ships in report-only mode, as the issue asks for the first stage', () => {
    const keys = vercel().headers[0].headers.map((h) => h.key);
    expect(keys).toContain('Content-Security-Policy-Report-Only');
    expect(keys).not.toContain('Content-Security-Policy');
  });

  it('reads back mode, host and report URI so a bare regeneration keeps them', () => {
    const config = toVercelConfig(
      { rewrites: [] },
      { mode: 'enforce', clerkHosts: ['clerk.example.org'], reportUri: 'https://example.report-uri.com/r' },
    );
    expect(optionsFromVercelJson(config)).toEqual({
      mode: 'enforce',
      reportUri: 'https://example.report-uri.com/r',
      clerkHosts: ['https://clerk.example.org'],
    });
    expect(optionsFromVercelJson({})).toEqual({});
  });
});

describe('generator command line', () => {
  it('parses its options and rejects unknown ones', () => {
    expect(parseArgs([])).toEqual({ mode: undefined, clerkHosts: [], reportUri: undefined, check: false });
    expect(parseArgs(['--mode', 'enforce', '--clerk-host', 'a.example.org', '--clerk-host', 'b.example.org', '--check'])).toEqual({
      mode: 'enforce',
      clerkHosts: ['a.example.org', 'b.example.org'],
      reportUri: undefined,
      check: true,
    });
    expect(() => parseArgs(['--nope'])).toThrow(/Unknown option/);
  });
});

describe('the app still fits the policy', () => {
  const csp = directives(buildCsp());

  const originOf = (url) => {
    try {
      return new URL(url).origin;
    } catch {
      return null;
    }
  };
  const allows = (directive, origin) =>
    csp[directive].some((source) => {
      if (source.includes('*')) {
        const [scheme, host] = source.split('://');
        const o = new URL(origin);
        return `${o.protocol}//`.startsWith(`${scheme}://`) && o.hostname.endsWith(host.replace('*.', '.'));
      }
      return source === origin;
    });

  it('index.html has no inline scripts, inline handlers or javascript: URLs', () => {
    const html = read('index.html');
    const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(
      ([, attrs, body]) => !/\bsrc=/.test(attrs) || body.trim() !== '',
    );
    expect(inline).toEqual([]);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    expect(html).not.toMatch(/javascript:/i);
  });

  it('the source never uses eval, new Function or string timers (so scripts can stay strict)', () => {
    const offenders = sourceFiles()
      .filter((f) => f.endsWith('.js') || f.endsWith('.jsx'))
      .filter((f) => /\beval\s*\(|new Function\s*\(|set(Timeout|Interval)\s*\(\s*['"`]/.test(readFileSync(f, 'utf8')))
      .map((f) => f.replace(ROOT, ''));
    expect(offenders).toEqual([]);
  });

  it('the only HTML built from strings is the print windows, which carry no scripts', () => {
    // Each of these writes a letter into a blank window the user opened to print. The page
    // calls print() itself, so the written HTML needs no inline script, and blank windows inherit
    // this policy anyway. Anything new that writes HTML must be added here on purpose.
    const PRINT_WINDOWS = [
      'src\\components\\services\\FormTemplatePreview.jsx',
      'src\\components\\services\\RtiPreviewLetter.jsx',
      'src\\components\\tracking\\AppellateEscalationModal.jsx',
    ].map((f) => f.replace(/\\/g, sep));
    const offenders = sourceFiles()
      .filter((f) => /dangerouslySetInnerHTML|\.innerHTML\s*=|document\.write\s*\(/.test(readFileSync(f, 'utf8')))
      .map((f) => f.replace(ROOT, ''))
      .filter((f) => !PRINT_WINDOWS.includes(f));
    expect(offenders).toEqual([]);

    for (const file of ['src/utils/printHtml.js', 'src/services/civicFormTemplateEngine.js']) {
      const text = read(file);
      expect(text, file).not.toMatch(/<script/i);
      expect(text, file).not.toMatch(/\son(load|click|error)\s*=/i);
    }
  });

  it('stylesheet imports and fonts come from allowed origins', () => {
    const origins = new Set();
    for (const file of sourceFiles().filter((f) => f.endsWith('.css'))) {
      for (const m of readFileSync(file, 'utf8').matchAll(/(?:@import\s+(?:url\()?|url\()\s*['"]?(https?:\/\/[^'")\s]+)/g)) {
        origins.add(originOf(m[1]));
      }
    }
    expect(origins.size).toBeGreaterThan(0);
    for (const origin of origins) {
      expect(allows('style-src', origin) || allows('font-src', origin), `${origin} is not in style-src or font-src`).toBe(true);
    }
    expect(allows('font-src', 'https://fonts.gstatic.com')).toBe(true);
  });

  it('every network call, socket, script and embedded resource in the source is covered', () => {
    const problems = [];
    for (const file of [...sourceFiles().filter((f) => !f.endsWith('.css')), join(ROOT, 'index.html')]) {
      const text = readFileSync(file, 'utf8');
      const checks = [
        [/fetch\(\s*['"`](https?:\/\/[^'"`$\s]+)/g, 'connect-src'],
        [/new\s+(?:WebSocket|EventSource)\(\s*['"`]((?:wss?|https?):\/\/[^'"`$\s]+)/g, 'connect-src'],
        [/<script[^>]*\ssrc=["'](https?:\/\/[^"']+)/g, 'script-src'],
        [/<(?:img|source)[^>]*\ssrc=["'](https?:\/\/[^"']+)/g, 'img-src'],
        [/<iframe[^>]*\ssrc=["'](https?:\/\/[^"']+)/g, 'frame-src'],
      ];
      for (const [pattern, directive] of checks) {
        for (const m of text.matchAll(pattern)) {
          const origin = originOf(m[1].replace(/^wss?:/, 'https:'));
          if (origin && !allows(directive, origin)) problems.push(`${file.replace(ROOT, '')}: ${origin} needs ${directive}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('the QR image service is only used by components no page mounts; mounting one requires a policy change', () => {
    const reachable = reachableFromEntry();
    const qr = join(ROOT, 'src', 'components', 'common', 'QRCodeView.jsx');
    expect(read('src/components/common/QRCodeView.jsx')).toContain('api.qrserver.com');
    if (reachable.has(qr)) {
      expect(csp['img-src'], 'QRCodeView is now part of the app').toContain('https://api.qrserver.com');
    }
  });

  it('the vault preview frame stays sandboxed, because it shows user-supplied files from blob: URLs', () => {
    expect(read('src/components/vault/FilePreviewPanel.jsx')).toMatch(/<iframe[^>]*sandbox=""/);
    expect(csp['frame-src']).toContain('blob:');
  });
});
