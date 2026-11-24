import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { checkContractRegistry } from '../../src/data/contracts/compatibility.js';

const path = 'src/data/contracts/registry.json';
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--base' || !/^[a-f0-9]{40}$/.test(args[1]))) {
  throw new Error('Usage: npm run contracts:check -- [--base <40-character commit SHA>]');
}
const next = JSON.parse(readFileSync(new URL('../../src/data/contracts/registry.json', import.meta.url), 'utf8'));
let previous = null;
if (args.length) {
  // Verify the base exists; an unavailable base must not turn into a bootstrap pass.
  execFileSync('git', ['cat-file', '-e', `${args[1]}^{commit}`], { stdio: 'pipe' });
  const files = execFileSync('git', ['ls-tree', '--name-only', args[1], '--', path], { encoding: 'utf8' }).trim();
  if (files) previous = JSON.parse(execFileSync('git', ['show', `${args[1]}:${path}`], { encoding: 'utf8' }));
}
const errors = checkContractRegistry(next, previous);
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else console.log(`Civic contracts: ${next.contracts.length} domains checked${previous ? ' against base history' : ' (registry bootstrap)'}.`);
