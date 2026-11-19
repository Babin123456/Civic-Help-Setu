// Volunteer Profile Contract (schema version 1)
// ---------------------------------------------
// Defines the schema for volunteer_profile records.
// Full field reference: docs/VOLUNTEER_PROFILE_DATA_CONTRACT.md
// This is a code-level contract for components and future integrations.
// NOT a deployed network API: nothing here is served over HTTP.

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const isTextList = (v) => Array.isArray(v) && v.every((item) => typeof item === 'string' && item.trim().length > 0);
const isNonEmptyText = (v) => typeof v === 'string' && v.trim().length > 0;
const isRealDate = (value) => {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// ... rest of the file stays the same