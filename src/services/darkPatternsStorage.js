export const DARK_PATTERNS_KEY = 'civicbridge_dark_patterns_vault';

// Store only explicitly permitted fields, never raw user-supplied identifiers.
export function minimizeRecord(record) {
  const redact = value => String(value || '')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[redacted email]')
    .replace(/\b(?:\+?\d[\d -]{8,}\d)\b/g, '[redacted number]')
    .replace(/\b(?:order|card|token|address|phone|name)\s*(?:number|no\.?|id)?\s*[:#-]\s*[^\n,;]+/gi, '[redacted identifier]');
  return {
    trader: redact(record.trader), facts: redact(record.facts),
    patterns: Array.isArray(record.patterns) ? record.patterns.map(redact) : [],
    headline: Number(record.headline), final: Number(record.final), disclosed: Number(record.disclosed),
  };
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function digest(record) {
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 requires a secure browser context.');
  const payload = Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'seal'));
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(payload)));
  return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
}
export async function verifyRecord(record) { return !!record?.seal && record.seal === await digest(record); }
export function listRecords() {
  const raw = localStorage.getItem(DARK_PATTERNS_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Vault data is invalid.');
  return parsed;
}
export async function saveRecord(input) {
  const record = { ...minimizeRecord(input), id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  record.seal = await digest(record);
  localStorage.setItem(DARK_PATTERNS_KEY, JSON.stringify([record, ...listRecords()]));
  return record;
}
export function deleteRecord(id) { localStorage.setItem(DARK_PATTERNS_KEY, JSON.stringify(listRecords().filter(r => r.id !== id))); }
export function exportJson(record) { return JSON.stringify(record, null, 2); }
export function exportText(record) { return `Deceptive practice evidence dossier\n${exportJson(record)}`; }
