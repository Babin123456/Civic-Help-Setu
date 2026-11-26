import { openSync, readSync, closeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// Operator preflight only: no writes, remote requests, authentication or citizen-data access.
let server;
try {
  if (process.argv.length !== 3) throw new Error('usage');
  const descriptor = openSync(process.argv[2], 'r');
  const buffer = Buffer.alloc(1024 * 1024 + 1);
  let length = 0;
  try {
    while (length < buffer.length) {
      const count = readSync(descriptor, buffer, length, buffer.length - length, null);
      if (!count) break;
      length += count;
    }
  } finally { closeSync(descriptor); }
  if (length === buffer.length) throw new Error('input limit');
  const input = JSON.parse(buffer.subarray(0, length).toString('utf8'));
  server = await createServer({ root: fileURLToPath(new URL('../../', import.meta.url)), configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const { validateCivicDataset } = await server.ssrLoadModule('/src/services/civicDataQualityService.js');
  const result = validateCivicDataset(input);
  // Rejected values and accepted source records are deliberately omitted from this report.
  console.log(JSON.stringify({ valid: result.valid, metrics: result.metrics, errors: result.errors, quarantined: result.quarantined }));
  process.exitCode = result.valid ? 0 : 1;
} catch {
  console.error('Preflight could not read bounded JSON. Use: npm run contracts:validate -- <public-metadata.json>');
  process.exitCode = 2;
} finally { await server?.close(); }
