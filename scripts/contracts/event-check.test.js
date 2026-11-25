import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import process from 'node:process';

const owned = [];
afterEach(() => { for (const path of owned.splice(0)) rmSync(path, { recursive: true, force: true }); });

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'civic-event-contract-fixture-')); owned.push(cwd);
  for (const folder of ['scripts/contracts', 'src/data/contracts']) {
    mkdirSync(join(cwd, folder), { recursive: true });
  }
  for (const path of ['scripts/contracts/check.mjs', 'src/data/contracts/compatibility.js', 'src/data/contracts/eventCompatibility.js', 'src/data/contracts/registry.json']) cpSync(new URL('../../' + path, import.meta.url), join(cwd, path));
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ type: 'module' }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q');git('config', 'user.name', 'Synthetic fixture');git('config', 'user.email', 'fixture@example.invalid');git('add', '.');git('commit', '-qm', 'Synthetic baseline');
  const base = git('rev-parse', 'HEAD');
  const path = join(cwd, 'src/data/contracts/registry.json');
  const registry = JSON.parse(readFileSync(path, 'utf8'));
  return { cwd, base, registry, save: () => writeFileSync(path, JSON.stringify(registry)), run: (sha = base) => spawnSync(process.execPath, ['scripts/contracts/check.mjs', '--base', sha], { cwd, encoding: 'utf8' }), report: () => JSON.parse(readFileSync(join(cwd, '.platform-evidence/event-contract-impact.json'), 'utf8')) };
}

describe('actual CI entrypoint with repository-owned producer/consumer fixtures', () => {
  it('passes an unchanged real registry and writes a machine-readable impact report', () => {
    const f = fixture();const result = f.run();expect(result.status).toBe(0);expect(f.report()).toMatchObject({ base: f.base, errors: [], changes: [] });
  });

  it('fails CI for a changed published field type and emits the owner impact instead of silently bootstrapping', () => {
    const f = fixture();const release = f.registry.events.releases.find(r => r.version === '2.0.0');release.schema.properties.serviceId = { type: 'integer' };release.samples = [{ serviceId: 7 }];f.save();
    const result = f.run();expect(result.status).toBe(1);expect(result.stderr).toContain('published releases are immutable');expect(f.report().changes[0]).toMatchObject({ owner: 'GoldRay19', version: '2.0.0' });
  });

  it('fails CI when a published registry/version is removed', () => {
    const f = fixture();delete f.registry.events;f.save();expect(f.run().status).toBe(1);expect(f.report().errors).toContain('Removing the event registry is not supported');
  });

  it('passes a compatible optional addition and names a consumer that has not opted in', () => {
    const f = fixture();const old = f.registry.events.releases.find(r => r.version === '2.0.0');const next = structuredClone(old);next.version = '2.1.0';next.schema.properties.channel = { type: 'string' };f.registry.events.releases.push(next);f.registry.events.changes.push({ eventType: next.eventType, version: next.version, owner: 'synthetic-owner', reason: 'Add optional channel' });f.registry.events.consumers.push({ id: 'synthetic-reader', owner: 'synthetic-owner', status: 'active', eventTypes: [next.eventType], contractVersions: { [next.eventType]: ['2.0.0'] } });f.save();
    expect(f.run().status).toBe(0);expect(f.report().changes[0].consumers).toEqual([{ id: 'synthetic-reader', owner: 'synthetic-owner', acceptsVersion: false }]);
  });

  it('fails closed when the requested base is unavailable', () => {
    const f = fixture();const result = f.run('f'.repeat(40));expect(result.status).not.toBe(0);expect(result.stdout).not.toContain('registry bootstrap');
  });

  it.each(['envelope', 'null release', 'consumer'])('retains a diagnostic report for malformed %s records', shape => {
    const f = fixture();
    if (shape === 'envelope') f.registry.events.releases = {};
    if (shape === 'null release') f.registry.events.releases.push(null);
    if (shape === 'consumer') f.registry.events.consumers.push({ id: 'invalid', status: 'active', eventTypes: null });
    f.save();
    expect(f.run().status).toBe(1);
    expect(f.report().errors.length).toBeGreaterThan(0);
  });
});
