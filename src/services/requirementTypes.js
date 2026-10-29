// Requirement types for checklist items (#265).
//
// A service lists its documents as plain strings in `documents`. Optionally it
// can also carry `documentRequirements`, a map from the exact document label to
// { type, condition?, source? }:
//   required    - officially required; `source` ({ name, url }) is shown if given
//   conditional - required only when `condition` applies
//   optional    - a helpful suggestion, not a mandatory document
//   unverified  - the record does not establish whether it is required
// Any document without a valid entry falls back to `unverified`, so nothing is
// ever presented as mandatory (or optional) without data to back it up.

export const REQUIREMENT_TYPES = {
  REQUIRED: 'required',
  CONDITIONAL: 'conditional',
  OPTIONAL: 'optional',
  UNVERIFIED: 'unverified',
};

export const REQUIREMENT_LABELS = {
  required: 'Official requirement',
  conditional: 'Conditional requirement',
  optional: 'Optional suggestion',
  unverified: 'Not verified',
};

export const REQUIREMENT_DESCRIPTIONS = {
  required: 'Officially required for this service.',
  conditional: 'Required only when a specific condition applies to you.',
  optional: 'A helpful suggestion. It is not a mandatory document.',
  unverified: 'Our records do not confirm whether this is required. Check with the official source.',
};

const VALID_TYPES = new Set(Object.values(REQUIREMENT_TYPES));

const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');

const cleanSource = (source) => {
  if (!source || typeof source !== 'object') return null;
  const name = cleanText(source.name);
  const url = cleanText(source.url);
  if (!name && !url) return null;
  return { name: name || url, url: url || null };
};

/** Classifies one document label against an optional requirements map. */
export const classifyRequirement = (label, requirements) => {
  const entry =
    requirements && typeof requirements === 'object' ? requirements[label] : null;
  const type = entry && typeof entry === 'object' ? entry.type : null;
  const condition = cleanText(entry?.condition);

  // Unknown types and conditional items with no stated condition cannot be
  // explained to the citizen, so they fall back to unverified.
  if (!VALID_TYPES.has(type) || (type === 'conditional' && !condition)) {
    return { label, type: REQUIREMENT_TYPES.UNVERIFIED, condition: null, source: null };
  }

  return {
    label,
    type,
    condition: type === 'conditional' ? condition : null,
    source: type === 'required' ? cleanSource(entry.source) : null,
  };
};

/** Returns every document of a service with its requirement type. */
export const getDocumentRequirements = (service) => {
  const documents = Array.isArray(service?.documents) ? service.documents : [];
  return documents
    .filter((d) => typeof d === 'string')
    .map((d) => classifyRequirement(d, service.documentRequirements));
};

/** Builds the label -> requirement map the checklist component expects. */
export const toRequirementMap = (service) =>
  Object.fromEntries(getDocumentRequirements(service).map((r) => [r.label, r]));

/**
 * Progress over official requirements only. Optional suggestions never count
 * as missing. Conditional and unverified items are not counted either (we
 * cannot tell whether they apply to this citizen), but they are reported so the
 * UI can mention them.
 */
export const summarizeRequirementProgress = (items = [], checked = [], requirements = {}) => {
  const done = new Set(checked);
  let mandatoryTotal = 0;
  let mandatoryDone = 0;
  let conditionalCount = 0;
  let optionalCount = 0;
  let unverifiedCount = 0;

  for (const label of items) {
    const { type } = classifyRequirement(label, requirements);
    if (type === 'required') {
      mandatoryTotal += 1;
      if (done.has(label)) mandatoryDone += 1;
    } else if (type === 'conditional') {
      conditionalCount += 1;
    } else if (type === 'optional') {
      optionalCount += 1;
    } else {
      unverifiedCount += 1;
    }
  }

  return { mandatoryTotal, mandatoryDone, conditionalCount, optionalCount, unverifiedCount };
};
