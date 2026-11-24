const semver = value => typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value);
const requiredTypes = ['service', 'authority', 'document', 'deadline', 'publicFacility'];
const fieldTypes = ['slug', 'text', 'date', 'sources', 'jurisdiction', 'integer', 'ids', 'object'];
const key = value => JSON.stringify(value);
const text = value => typeof value === 'string' && value.trim().length > 0;

/** Fail closed: changed contract definitions need a greater version and an owned change record. */
export function checkContractRegistry(next, previous = null) {
  const errors = [];
  if (next?.registryVersion !== 1 || !Array.isArray(next?.contracts) || !Array.isArray(next?.changes)) return ['Invalid registry envelope.'];
  const ids = next.contracts.map(contract => contract?.id);
  if (new Set(ids).size !== ids.length || requiredTypes.some(type => !ids.includes(type))) errors.push('Registry must contain each civic domain exactly once.');
  for (const contract of next.contracts) {
    if (!contract || typeof contract !== 'object') { errors.push('Invalid contract.'); continue; }
    if (!semver(contract.version) || !text(contract.owner) || !text(contract.producer) || !['serviceRecord', 'communityFacilityRecord', 'metadata'].includes(contract.validator)) errors.push('Invalid contract identity, owner, version or validator.');
    if (!contract.fields || typeof contract.fields !== 'object' || !contract.fields.id?.required) { errors.push('Each contract needs an ID field.'); continue; }
    for (const rule of Object.values(contract.fields)) {
      if (!rule || typeof rule !== 'object') { errors.push('Invalid field rule.'); continue; }
      if (!fieldTypes.includes(rule.type) || (rule.reference && !ids.includes(rule.reference))) errors.push('Unknown field type or reference.');
      if (rule.type === 'integer' && (!Number.isSafeInteger(rule.min) || !Number.isSafeInteger(rule.max) || rule.min > rule.max)) errors.push('Invalid numeric bounds.');
    }
    if (!semver(contract.version)) continue;
    const old = previous?.contracts?.find(row => row.id === contract.id);
    if (old && key(old) === key(contract)) continue;
    if (!next.changes.some(change => change?.version === contract.version && text(change.owner) && text(change.reason))) errors.push('Contract change needs an owned change record.');
    if (old) {
      const before = old.version.split('.').map(Number);
      const after = contract.version.split('.').map(Number);
      const greater = after[0] > before[0] || (after[0] === before[0] && (after[1] > before[1] || (after[1] === before[1] && after[2] > before[2])));
      if (!greater) errors.push('Changed contract must increase its semantic version.');
      // Any removal/narrowing or validator replacement requires a major-version migration.
      const breaking = old.validator !== contract.validator || Object.entries(old.fields).some(([name, rule]) => !contract.fields[name] || key(rule) !== key(contract.fields[name])) || Object.entries(contract.fields).some(([name, rule]) => !old.fields[name] && rule.required);
      if (breaking && (after[0] <= before[0] || !next.changes.some(change => change?.version === contract.version && text(change.migration)))) errors.push('Breaking changes require a major version and migration notes.');
    }
  }
  if (previous?.contracts?.some(old => !ids.includes(old.id))) errors.push('Removing a registered domain is not supported.');
  if (previous?.changes?.some(old => !next.changes.some(change => key(change) === key(old)))) errors.push('Historical change records must be preserved.');
  return errors;
}
