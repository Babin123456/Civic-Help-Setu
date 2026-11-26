import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
function run(input) {
  const dir = mkdtempSync(join(tmpdir(), 'civic-contract-'));
  try {
    const file = join(dir, 'data.json'); writeFileSync(file, input);
    return spawnSync('node', ['scripts/contracts/validate.mjs', file], { cwd: root, encoding: 'utf8', timeout: 20000 });
  } finally { rmSync(dir, { recursive: true }); }
}
describe('operator contract preflight', () => {
  it('loads actual adapters and reports a valid public metadata batch', () => {
    const result = run(JSON.stringify({ registryVersion: 1, entities: [{ type: 'authority', version: '1.0.0', record: { id: 'synthetic-authority', name: 'Synthetic authority', lastVerified: '2026-01-01', jurisdiction: { level: 'national', states: [], districts: [], localBody: '' }, officialSources: [{ name: 'Synthetic source', url: 'https://example.gov.in' }] } }] }));
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout.trim()); expect(report.metrics.accepted).toBe(1); expect(report.accepted).toBeUndefined();
  });
  it('exits nonzero for quarantined data and suppresses private input', () => {
    const result = run(JSON.stringify({ registryVersion: 1, entities: [{ type: 'authority', version: 'bad', record: { password: 'SYNTHETIC_PRIVATE_SENTINEL' } }] }));
    expect(result.status).toBe(1); expect(result.stdout + result.stderr).not.toContain('SYNTHETIC_PRIVATE_SENTINEL');
  });
  it('fails closed for malformed and oversized files without echoing their content', () => {
    for (const input of ['SYNTHETIC_PRIVATE_SENTINEL{', 'x'.repeat(1024 * 1024 + 1)]) {
      const result = run(input); expect(result.status).toBe(2); expect(result.stderr).not.toContain('SYNTHETIC_PRIVATE_SENTINEL');
    }
  });
});
