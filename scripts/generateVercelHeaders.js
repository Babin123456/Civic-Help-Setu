/**
 * Writes the security headers from scripts/securityHeaders.js into vercel.json.
 *
 *   npm run headers:generate                                  report-only (the default)
 *   npm run headers:generate -- --mode enforce                enforce the policy
 *   npm run headers:generate -- --clerk-host clerk.example.org --report-uri https://example.report-uri.com/r/d/csp/reportOnly
 *   npm run headers:check                                     exit 1 if vercel.json is out of date
 *
 * Options are remembered in vercel.json's own CSP value, so a later run without options keeps them:
 * pass them again if you want to change them. See docs/SECURITY_HEADERS.md.
 */
/* global process */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { toVercelConfig } from './securityHeaders.js';

const VERCEL_JSON = fileURLToPath(new URL('../vercel.json', import.meta.url));

export function parseArgs(argv) {
  const options = { mode: undefined, clerkHosts: [], reportUri: undefined, check: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') options.check = true;
    else if (arg === '--mode') options.mode = argv[++i];
    else if (arg === '--clerk-host') options.clerkHosts.push(argv[++i]);
    else if (arg === '--report-uri') options.reportUri = argv[++i];
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

/** Read the options the current vercel.json was generated with, so --check and a bare run agree. */
export function optionsFromVercelJson(config) {
  const headers = config.headers?.[0]?.headers ?? [];
  const csp = headers.find((h) => /^Content-Security-Policy(-Report-Only)?$/.test(h.key));
  if (!csp) return {};
  const mode = csp.key === 'Content-Security-Policy' ? 'enforce' : 'report-only';
  const reportUri = /(?:^|; )report-uri (\S+)/.exec(csp.value)?.[1];
  const connect = /(?:^|; )connect-src ([^;]*)/.exec(csp.value)?.[1].split(' ') ?? [];
  const clerkHosts = connect.filter(
    (s) => s.startsWith('https://') && !s.includes('clerk.accounts.dev') && !s.includes('clerk-telemetry.com'),
  );
  return { mode, reportUri, clerkHosts };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const existing = JSON.parse(readFileSync(VERCEL_JSON, 'utf8'));
  const remembered = optionsFromVercelJson(existing);

  const options = {
    mode: args.mode ?? remembered.mode ?? 'report-only',
    clerkHosts: args.clerkHosts.length ? args.clerkHosts : remembered.clerkHosts ?? [],
    reportUri: args.reportUri ?? remembered.reportUri,
  };
  const next = `${JSON.stringify(toVercelConfig(existing, options), null, 2)}\n`;

  if (args.check) {
    const current = readFileSync(VERCEL_JSON, 'utf8').replace(/\r\n/g, '\n');
    if (current !== next) {
      console.error('vercel.json is out of date with scripts/securityHeaders.js. Run: npm run headers:generate');
      process.exit(1);
    }
    console.log('vercel.json matches scripts/securityHeaders.js');
    return;
  }
  writeFileSync(VERCEL_JSON, next);
  console.log(`vercel.json updated (${options.mode}).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
