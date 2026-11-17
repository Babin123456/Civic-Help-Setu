/** Local, ephemeral evidence manifests. No file contents are persisted or uploaded. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_FILES = 20;
export const MAX_MANIFEST_BYTES = 1024 * 1024;
const EXTENSIONS = /\.(pdf|png|jpe?g|txt)$/i;
const SHA256 = /^[a-f0-9]{64}$/;

export function validateFiles(files) {
  if (files.length > MAX_FILES) throw new Error(`Select at most ${MAX_FILES} files.`);
  const names = new Set();
  for (const file of files) {
    if (!EXTENSIONS.test(file.name)) throw new Error(`Unsupported file type: ${file.name}. Use PDF, PNG, JPEG or TXT.`);
    if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} exceeds the 20 MiB limit.`);
    if (names.has(file.name)) throw new Error(`Duplicate filename: ${file.name}. Rename files before selecting them.`);
    names.add(file.name);
  }
}
export async function hashFile(file) {
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 requires a secure browser context.');
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
export async function createManifest(files, descriptions = {}, onProgress = () => {}) {
  if (!files.length) throw new Error('Select at least one file.');
  validateFiles(files);
  const entries = [];
  for (const [i, file] of files.entries()) {
    const description = String(descriptions[file.name] || '').trim();
    if (description.length > 500) throw new Error('Descriptions must be at most 500 characters.');
    entries.push({ name: file.name, size: file.size, type: file.type || '', lastModified: file.lastModified, description, sha256: await hashFile(file) });
    onProgress(i + 1, files.length);
  }
  return { version: 1, createdAt: new Date().toISOString(), algorithm: 'SHA-256', entries };
}
export function parseManifest(text) {
  if (new TextEncoder().encode(text).length > MAX_MANIFEST_BYTES) throw new Error('Manifest exceeds the 1 MiB limit.');
  let manifest;
  try { manifest = JSON.parse(text); } catch { throw new Error('Manifest is not valid JSON.'); }
  if (!manifest || manifest.version !== 1 || manifest.algorithm !== 'SHA-256' || !Array.isArray(manifest.entries) || !manifest.entries.length || manifest.entries.length > MAX_FILES || typeof manifest.createdAt !== 'string' || Number.isNaN(Date.parse(manifest.createdAt))) throw new Error('Invalid or unsupported manifest.');
  const names = new Set();
  for (const entry of manifest.entries) {
    if (!entry || typeof entry.name !== 'string' || !EXTENSIONS.test(entry.name) || entry.name.length > 255 || names.has(entry.name) || !Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > MAX_FILE_BYTES || typeof entry.type !== 'string' || entry.type.length > 255 || !Number.isSafeInteger(entry.lastModified) || entry.lastModified < 0 || typeof entry.description !== 'string' || entry.description.length > 500 || typeof entry.sha256 !== 'string' || !SHA256.test(entry.sha256)) throw new Error('Invalid manifest entry.');
    names.add(entry.name);
  }
  return manifest;
}
export function duplicateGroups(entries) {
  const groups = new Map();
  for (const entry of entries) groups.set(entry.sha256, [...(groups.get(entry.sha256) || []), entry.name]);
  return [...groups.values()].filter(group => group.length > 1);
}
export async function verifyManifest(manifest, files, onProgress = () => {}) {
  const parsed = parseManifest(JSON.stringify(manifest));
  validateFiles(files);
  const selected = new Map(files.map(file => [file.name, file]));
  const results = [];
  for (const [i, entry] of parsed.entries.entries()) {
    const file = selected.get(entry.name);
    const status = !file ? 'Missing' : await hashFile(file) === entry.sha256 ? 'Match' : 'Changed';
    results.push({ name: entry.name, status });
    onProgress(i + 1, parsed.entries.length);
  }
  const expected = new Set(parsed.entries.map(entry => entry.name));
  const extra = files.filter(file => !expected.has(file.name)).map(file => file.name);
  return { results, extra, duplicates: duplicateGroups(parsed.entries) };
}
