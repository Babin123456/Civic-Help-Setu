export const ACCESSIBILITY_VAULT_KEY = 'civicbridge_accessibility_audit_vault';
// Persist only structured, non-identifying audit outcomes, never free text or coordinates.
export function minimizeAudit(answers) {
  const keys = ['ramp', 'rails', 'door', 'tactile', 'washroom', 'lift'];
  return Object.fromEntries(keys.map(key => [key, ['yes', 'no', 'unknown', 'na'].includes(answers[key]) ? answers[key] : 'unknown']));
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function auditDigest(record) {
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 requires a secure browser context.');
  const payload = Object.fromEntries(Object.entries(record).filter(([k]) => k !== 'seal'));
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(payload)));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
export async function verifyAudit(record) { return !!record?.seal && record.seal === await auditDigest(record); }
export function listAudits() {
  const raw = localStorage.getItem(ACCESSIBILITY_VAULT_KEY);
  if (!raw) return [];
  const records = JSON.parse(raw);
  if (!Array.isArray(records)) throw new Error('Invalid vault data.');
  return records;
}
export async function saveAudit(answers) {
  const record = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), answers: minimizeAudit(answers) };
  record.seal = await auditDigest(record);
  localStorage.setItem(ACCESSIBILITY_VAULT_KEY, JSON.stringify([record, ...listAudits()]));
  return record;
}
export function deleteAudit(id) { localStorage.setItem(ACCESSIBILITY_VAULT_KEY, JSON.stringify(listAudits().filter(r => r.id !== id))); }
