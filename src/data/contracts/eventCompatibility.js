/** Repository-reviewed contracts for the existing, process-local civic event bus. */
export const CIVIC_EVENT_TYPE = Object.freeze({
  APPLICATION_SUBMITTED: 'APPLICATION_SUBMITTED',
  APPLICATION_STATUS_CHANGED: 'APPLICATION_STATUS_CHANGED',
  GRIEVANCE_LODGED: 'GRIEVANCE_LODGED',
  GRIEVANCE_ESCALATED: 'GRIEVANCE_ESCALATED',
  DEFICIENCY_NOTICE_ISSUED: 'DEFICIENCY_NOTICE_ISSUED',
  DOCUMENT_VERIFIED: 'DOCUMENT_VERIFIED',
  FEE_RECEIPT_ISSUED: 'FEE_RECEIPT_ISSUED',
  TEMPORAL_POLICY_EVALUATED: 'TEMPORAL_POLICY_EVALUATED',
  TEMPORAL_RULE_PUBLISHED: 'TEMPORAL_RULE_PUBLISHED',
});

const own = (value, key) => Object.hasOwn(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const key = release => `${release?.eventType}@${release?.version}`;
const version = value => typeof value === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value) && value.split('.').every(n => Number.isSafeInteger(Number(n)));
const compare = (a, b) => {
  const left = a.split('.').map(Number); const right = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) if (left[i] !== right[i]) return left[i] - right[i];
  return 0;
};
export const canonicalEventValue = value => JSON.stringify(value, (_name, item) => object(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

const schemaTypes = ['json', 'object', 'array', 'string', 'number', 'integer', 'boolean', 'null'];
function schemaErrors(schema, path = '$', depth = 0) {
  if (!object(schema) || depth > 8 || !schemaTypes.includes(schema.type)) return [`${path}: unsupported schema or depth`];
  const errors = [];
  const schemaKeys = ['type', ...(schema.type === 'json' ? [] : ['enum']),
    ...(schema.type === 'object' ? ['properties', 'required', 'additionalProperties'] : []),
    ...(schema.type === 'array' ? ['items'] : []),
    ...(['integer', 'number'].includes(schema.type) ? ['minimum', 'maximum'] : []),
    ...(schema.type === 'string' ? ['minLength', 'maxLength'] : [])];
  if (Object.keys(schema).some(name => !schemaKeys.includes(name))) errors.push(`${path}: unsupported schema keyword`);
  if (schema.type === 'object') {
    if (!object(schema.properties) || Object.keys(schema.properties).length > 64 || typeof schema.additionalProperties !== 'boolean' || !Array.isArray(schema.required)) return [...errors, `${path}: invalid object definition`];
    if (new Set(schema.required).size !== schema.required.length || schema.required.some(name => !own(schema.properties, name))) errors.push(`${path}: invalid required fields`);
    for (const [name, field] of Object.entries(schema.properties)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name) || ['__proto__', 'constructor', 'prototype'].includes(name)) errors.push(`${path}: unsafe field name`);
      errors.push(...schemaErrors(field, `${path}.${name}`, depth + 1));
    }
  }
  if (schema.type === 'array') errors.push(...schemaErrors(schema.items, `${path}[]`, depth + 1));
  for (const bound of ['minimum', 'maximum', 'minLength', 'maxLength']) {
    if (schema[bound] !== undefined && (!Number.isFinite(schema[bound]) || (bound.endsWith('Length') && (!Number.isSafeInteger(schema[bound]) || schema[bound] < 0)))) errors.push(`${path}: invalid bound`);
  }
  if (schema.minimum > schema.maximum || schema.minLength > schema.maxLength) errors.push(`${path}: inverted bounds`);
  if (schema.enum !== undefined && (!Array.isArray(schema.enum) || !schema.enum.length || schema.enum.some(item => item !== null && !['string', 'boolean', 'number'].includes(typeof item)))) errors.push(`${path}: invalid enum`);
  return errors;
}

function inspectValue(schema, value, path, errors) {
  if (schema.type === 'json') return;
  const matches = schema.type === 'object' ? object(value)
    : schema.type === 'array' ? Array.isArray(value)
      : schema.type === 'null' ? value === null
        : schema.type === 'integer' ? Number.isSafeInteger(value)
          : schema.type === 'number' ? typeof value === 'number' && Number.isFinite(value)
            : typeof value === schema.type;
  if (!matches) { errors.push(`${path}: expected ${schema.type}`); return; }
  if (schema.enum && !schema.enum.some(item => item === value)) errors.push(`${path}: value outside enum`);
  if (typeof value === 'number' && ((schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum))) errors.push(`${path}: outside numeric bounds`);
  if (typeof value === 'string' && ((schema.minLength !== undefined && value.length < schema.minLength) || (schema.maxLength !== undefined && value.length > schema.maxLength))) errors.push(`${path}: outside string bounds`);
  if (schema.type === 'object') {
    for (const field of schema.required) if (!own(value, field)) errors.push(`${path}.${field}: required`);
    for (const [field, item] of Object.entries(value)) {
      if (own(schema.properties, field)) inspectValue(schema.properties[field], item, `${path}.${field}`, errors);
      else if (!schema.additionalProperties) errors.push(`${path}.${field}: unexpected field`);
    }
  }
  if (schema.type === 'array') value.forEach((item, i) => inspectValue(schema.items, item, `${path}[${i}]`, errors));
}

export function validateEventPayload(release, payload, maxPayloadBytes = 65536) {
  const errors = schemaErrors(release?.schema);
  if (errors.length) return errors;
  // Legacy 1.0.0 keeps the bus's existing JSON payload behavior; stricter releases opt in.
  if (release.legacy === true) return [];
  let serialized;
  try { serialized = JSON.stringify(payload); } catch { return ['Payload must be serializable JSON']; }
  if (typeof serialized !== 'string' || new TextEncoder().encode(serialized).length > maxPayloadBytes) return ['Payload exceeds the configured byte limit'];
  inspectValue(release.schema, payload, '$', errors);
  return errors;
}

export function findEventContract(events, eventType, schemaVersion) {
  return events?.releases?.find(row => row.eventType === eventType && row.version === schemaVersion);
}

export function assertEventContract(events, eventType, schemaVersion, producerDomain, payload, now = Date.now()) {
  const release = findEventContract(events, eventType, schemaVersion);
  if (!release) throw new Error(`Unknown event contract: ${eventType}@${schemaVersion}`);
  if (!release.producers.includes('*') && !release.producers.includes(producerDomain)) throw new Error('Producer is not declared for this event contract');
  const retirement = events.deprecations.find(row => row.eventType === eventType && row.version === schemaVersion);
  if (retirement && now >= Date.parse(retirement.sunsetAt)) throw new Error('Event contract admission window has ended; migrate the producer');
  const errors = validateEventPayload(release, payload, events.maxPayloadBytes);
  if (errors.length) throw new Error(`Event payload rejected: ${errors.join('; ')}`);
  return release;
}

export function consumerContractVersions(events, eventTypes, requested = {}) {
  if (!object(requested) || Object.keys(requested).some(type => !eventTypes.includes(type))) throw new Error('Consumer contract versions must match its subscriptions');
  return Object.fromEntries(eventTypes.map(type => {
    const versions = requested[type] ?? ['1.0.0'];
    if (!Array.isArray(versions) || !versions.length || versions.length > 32 || new Set(versions).size !== versions.length || versions.some(v => !findEventContract(events, type, v))) throw new Error(`Invalid consumer contract versions for ${type}`);
    return [type, [...versions]];
  }));
}

/** Conservative source compatibility: existing fields cannot disappear or change semantics. */
export function eventSchemaBreaking(previous, next) {
  if (previous.type !== next.type) return true;
  for (const name of ['enum', 'minimum', 'maximum', 'minLength', 'maxLength']) if (canonicalEventValue(previous[name]) !== canonicalEventValue(next[name])) return true;
  if (previous.type === 'array') return eventSchemaBreaking(previous.items, next.items);
  if (previous.type !== 'object') return false;
  if (previous.additionalProperties !== next.additionalProperties) return true;
  if (Object.entries(previous.properties).some(([field, schema]) => !own(next.properties, field) || eventSchemaBreaking(schema, next.properties[field]))) return true;
  if (next.required.some(field => !previous.required.includes(field))) return true;
  return !previous.additionalProperties && Object.keys(next.properties).some(field => !own(previous.properties, field));
}

export function checkEventRegistry(next, previous = null, now = Date.now()) {
  const events = next?.events; const old = previous?.events;
  if (!events) return old ? ['Removing the event registry is not supported'] : [];
  if (!object(events) || !Array.isArray(events.releases) || !Array.isArray(events.consumers) || !Array.isArray(events.changes) || !Array.isArray(events.deprecations)) return ['Invalid event registry envelope'];
  const errors = [];
  if ([...events.releases, ...events.consumers, ...events.changes, ...events.deprecations].some(row => !object(row))) return ['Event registry records must be objects'];
  if (!Number.isSafeInteger(events.minimumDeprecationDays) || events.minimumDeprecationDays < 1 || !Number.isSafeInteger(events.maxPayloadBytes) || events.maxPayloadBytes < 1) errors.push('Invalid event policy bounds');
  if (old && events.minimumDeprecationDays < old.minimumDeprecationDays) errors.push('The deprecation notice window cannot be shortened');
  if (new Set(events.releases.map(key)).size !== events.releases.length) errors.push('Duplicate event contract version');
  for (const type of Object.values(CIVIC_EVENT_TYPE)) if (!findEventContract(events, type, '1.0.0')) errors.push(`Missing legacy event contract: ${type}`);
  for (const release of events.releases) {
    const name = key(release);
    if (!own(CIVIC_EVENT_TYPE, release.eventType) || !version(release.version) || !text(release.owner) || !Array.isArray(release.producers) || !release.producers.length || release.producers.some(p => !text(p)) || !Array.isArray(release.samples) || !release.samples.length) { errors.push(`${name}: invalid release identity/ownership/samples`); continue; }
    if ((release.schema?.type === 'json' || release.legacy) && !(release.version === '1.0.0' && release.legacy === true && release.schema?.type === 'json')) errors.push(`${name}: untyped contracts are limited to the explicit legacy version`);
    const invalidSchema = schemaErrors(release.schema);
    errors.push(...invalidSchema.map(message => `${name}: ${message}`));
    if (!invalidSchema.length) for (const sample of release.samples) errors.push(...validateEventPayload(release, sample, events.maxPayloadBytes).map(message => `${name} sample: ${message}`));
    const historical = old?.releases.find(row => key(row) === name);
    if (historical && canonicalEventValue(historical) !== canonicalEventValue(release)) errors.push(`${name}: published releases are immutable; register a new version`);
    if (!historical) {
      const change = events.changes.find(row => row.eventType === release.eventType && row.version === release.version && text(row.owner) && text(row.reason));
      if (!change) errors.push(`${name}: an owned change record is required`);
      const older = events.releases.filter(row => row.eventType === release.eventType && version(row.version) && compare(row.version, release.version) < 0).sort((a, b) => compare(b.version, a.version))[0];
      if (older && !schemaErrors(older.schema).length && !invalidSchema.length && eventSchemaBreaking(older.schema, release.schema) && (Number(release.version.split('.')[0]) <= Number(older.version.split('.')[0]) || !text(change?.migration))) errors.push(`${name}: incompatible changes require a new major version and migration instructions`);
    }
  }
  for (const release of old?.releases ?? []) if (!events.releases.some(row => key(row) === key(release))) errors.push(`${key(release)}: published schemas must remain available for draining/rollback`);
  for (const change of old?.changes ?? []) if (!events.changes.some(row => canonicalEventValue(row) === canonicalEventValue(change))) errors.push('Historical event change records must be preserved');
  const consumerIds = new Set();
  for (const consumer of events.consumers) {
    if (!text(consumer.id) || consumerIds.has(consumer.id) || !text(consumer.owner) || !Array.isArray(consumer.eventTypes) || !consumer.eventTypes.length || !['active', 'retired'].includes(consumer.status)) { errors.push('Invalid/duplicate consumer inventory entry'); continue; }
    consumerIds.add(consumer.id);
    try {
      const accepted = consumerContractVersions(events, consumer.eventTypes, consumer.contractVersions);
      if (consumer.status === 'active') for (const [type, versions] of Object.entries(accepted)) if (!versions.some(v => !events.deprecations.some(d => d.eventType === type && d.version === v && now >= Date.parse(d.sunsetAt)))) errors.push(`${consumer.id}: no supported version remains; migrate the consumer`);
    } catch (error) { errors.push(`${consumer.id}: ${error.message}`); }
  }
  for (const consumer of old?.consumers ?? []) if (!events.consumers.some(row => row.id === consumer.id)) errors.push(`${consumer.id}: retain an explicit retired inventory entry`);
  const sunsetIds = new Set();
  for (const retirement of events.deprecations) {
    const name = key(retirement); const announced = Date.parse(retirement.announcedAt); const sunset = Date.parse(retirement.sunsetAt);
    if (sunsetIds.has(name) || !findEventContract(events, retirement.eventType, retirement.version) || !Number.isFinite(announced) || !Number.isFinite(sunset) || !text(retirement.owner) || !text(retirement.migration)) errors.push(`${name}: invalid deprecation record`);
    sunsetIds.add(name);
    if (sunset - announced < events.minimumDeprecationDays * 86400000) errors.push(`${name}: deprecation notice is too short`);
    const prior = old?.deprecations.find(row => key(row) === name);
    if (!prior && sunset < now + events.minimumDeprecationDays * 86400000) errors.push(`${name}: new sunset must allow the full notice window from this review`);
    if (prior && (announced !== Date.parse(prior.announcedAt) || sunset < Date.parse(prior.sunsetAt))) errors.push(`${name}: existing sunset cannot be accelerated or announcement rewritten`);
  }
  for (const retirement of old?.deprecations ?? []) if (!events.deprecations.some(row => key(row) === key(retirement))) errors.push('Deprecation history must be preserved');
  return errors;
}

export function eventContractImpact(next, previous = null) {
  const events = next?.events;
  // Invalid proposals must still produce a diagnostic artifact rather than crash CI.
  if (!object(events) || !Array.isArray(events.releases)) return [];
  const prior = Array.isArray(previous?.events?.releases) ? previous.events.releases : [];
  const consumers = Array.isArray(events.consumers) ? events.consumers.filter(object) : [];
  const changes = Array.isArray(events.changes) ? events.changes.filter(object) : [];
  return events.releases.filter(object).filter(release => !prior.some(old => key(old) === key(release) && canonicalEventValue(old) === canonicalEventValue(release))).map(release => ({
    eventType: release.eventType, version: release.version, owner: release.owner,
    consumers: consumers.filter(consumer => consumer.status === 'active' && Array.isArray(consumer.eventTypes) && consumer.eventTypes.includes(release.eventType)).map(consumer => ({
      id: consumer.id, owner: consumer.owner, acceptsVersion: Array.isArray(consumer.contractVersions?.[release.eventType]) && consumer.contractVersions[release.eventType].includes(release.version),
    })),
    migration: changes.find(change => change.eventType === release.eventType && change.version === release.version)?.migration ?? null,
  }));
}
