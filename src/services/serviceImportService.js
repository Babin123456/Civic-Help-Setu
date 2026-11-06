// Parsing and validation for bulk service imports (CSV / JSON).
// Everything here is pure so it can be tested without a browser; saving the
// accepted records is done by importAdminServices in adminService.js.

import { MOCK_SERVICES } from '../data/services';
import { SERVICE_CATEGORIES } from '../data/serviceCategories';

export const MAX_IMPORT_BYTES = 1024 * 1024;
export const MAX_IMPORT_ROWS = 500;

const DELIVERY_TYPES = [...new Set(['Online', 'Offline', 'Online / Offline', ...MOCK_SERVICES.map((s) => s.type)])];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const FEE_TYPES = ['free', 'paid'];
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// Date.parse rolls invalid days over (2026-02-30 becomes March 2), so rebuild
// the date and compare each part. A day of slack keeps "today" valid in time
// zones ahead of UTC.
function checkLastVerified(value) {
  const match = typeof value === 'string' && DATE_PATTERN.exec(value);
  if (!match) return 'lastVerified must be a date in YYYY-MM-DD format';
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return `lastVerified "${value}" is not a real date`;
  }
  if (date.getTime() > Date.now() + DAY_MS) return `lastVerified "${value}" is in the future`;
  return null;
}

// CSV columns in template order. Array columns hold pipe separated values;
// steps are nested objects, so they can only be imported from JSON.
export const CSV_COLUMNS = [
  'id',
  'name',
  'shortDescription',
  'category',
  'department',
  'type',
  'difficulty',
  'feeType',
  'fees',
  'processingTime',
  'speedDays',
  'eligibility',
  'documents',
  'warnings',
  'officialSourceName',
  'officialSourceUrl',
  'lastVerified',
];
const PIPE_COLUMNS = new Set(['eligibility', 'documents', 'warnings']);
const JSON_ONLY_FIELDS = new Set(['steps', 'officialSources', 'popularityScore', 'eligibilityRuleKey', 'dateGuidance', 'validityNote']);
const KNOWN_FIELDS = new Set([...CSV_COLUMNS, ...JSON_ONLY_FIELDS]);

// "Short Description", "short_description" and "shortDescription" all map to the same column.
const headerKey = (h) => h.toLowerCase().replace(/[^a-z0-9]/g, '');
const HEADER_LOOKUP = new Map([...KNOWN_FIELDS].map((f) => [headerKey(f), f]));

export const normalizeName = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const slugify = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/**
 * Parse CSV text (RFC 4180: quoted fields, "" escapes, commas and newlines
 * inside quotes, CRLF line endings). Returns rows with the line each row
 * starts on, so errors can point at the right line in a spreadsheet.
 */
export function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let line = 1;
  let rowStartLine = 1;
  let inQuotes = false;
  // true right after a closing quote: only a comma or a line break may follow
  let afterQuote = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const endRow = () => {
    row.push(field);
    if (row.some((cell) => cell.trim() !== '')) rows.push({ line: rowStartLine, cells: row });
    row = [];
    field = '';
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
        afterQuote = true;
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
    } else if (ch === ',') {
      row.push(field);
      field = '';
      afterQuote = false;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      endRow();
      line++;
      rowStartLine = line;
      afterQuote = false;
    } else if (afterQuote) {
      throw new Error(`Unexpected text after a closing quote on line ${line}; quote the whole field`);
    } else if (ch === '"') {
      // A quote only starts a quoted field at the very beginning of the field.
      // Anywhere else it's malformed, and two stray quotes would otherwise pair
      // up and silently merge the rows between them.
      if (field !== '') {
        throw new Error(`Unexpected quote in the middle of a field on line ${line}; wrap the field in quotes and double the inner quote ("")`);
      }
      inQuotes = true;
    } else {
      field += ch;
    }
  }
  if (inQuotes) {
    throw new Error(`Unclosed quote in the row starting on line ${rowStartLine}`);
  }
  if (field !== '' || row.length) endRow();
  return rows;
}

const splitPipes = (value) =>
  value
    .split('|')
    .map((v) => v.trim())
    .filter(Boolean);

function csvToRecords(text, warnings) {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error('The file is empty');

  const [header, ...dataRows] = rows;
  const columns = header.cells.map((h) => {
    const field = HEADER_LOOKUP.get(headerKey(h));
    if (!field && h.trim()) warnings.push(`Unknown column "${h.trim()}" was ignored`);
    if (field && JSON_ONLY_FIELDS.has(field)) {
      warnings.push(`Column "${h.trim()}" is only supported in JSON imports and was ignored`);
      return null;
    }
    return field || null;
  });
  if (!columns.includes('name')) throw new Error('The CSV header needs at least a "name" column');

  return dataRows.map(({ line, cells }) => {
    const raw = {};
    columns.forEach((field, idx) => {
      if (!field) return;
      const value = (cells[idx] ?? '').trim();
      if (value === '') return;
      raw[field] = PIPE_COLUMNS.has(field) ? splitPipes(value) : value;
    });
    if (raw.officialSourceUrl || raw.officialSourceName) {
      raw.officialSources = [
        { name: raw.officialSourceName || 'Official Government Portal', url: raw.officialSourceUrl || '' },
      ];
    }
    delete raw.officialSourceUrl;
    delete raw.officialSourceName;
    if (raw.speedDays !== undefined) raw.speedDays = Number(raw.speedDays);
    return { row: line, raw };
  });
}

function jsonToRecords(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err.message}`, { cause: err });
  }
  const list = Array.isArray(data) ? data : data?.services;
  if (!Array.isArray(list)) {
    throw new Error('JSON must be an array of services or an object with a "services" array');
  }
  return list.map((raw, idx) => {
    // Accept the flat CSV-style source columns in JSON too.
    if (raw && typeof raw === 'object' && !raw.officialSources && raw.officialSourceUrl) {
      const { officialSourceName, officialSourceUrl, ...rest } = raw;
      raw = { ...rest, officialSources: [{ name: officialSourceName, url: officialSourceUrl }] };
    }
    return { row: idx + 1, raw };
  });
}

const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';

// Spreadsheets often end up with "identity" or "EASY"; match those to the canonical value.
const matchOption = (value, options) =>
  typeof value === 'string' ? options.find((o) => o.toLowerCase() === value.trim().toLowerCase()) || null : null;

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function checkStringList(errors, raw, field) {
  if (raw[field] === undefined) return [];
  if (!Array.isArray(raw[field]) || !raw[field].every(isNonEmptyString)) {
    errors.push(`${field} must be a list of non-empty text values`);
    return [];
  }
  return raw[field].map((v) => v.trim());
}

/**
 * Validate one raw record against the service data model.
 * Returns { service, errors, warnings }; service is only set when there are no errors.
 */
export function validateRecord(raw) {
  const errors = [];
  const warnings = [];

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { service: null, errors: ['Each record must be an object'], warnings };
  }

  const name = isNonEmptyString(raw.name) ? raw.name.trim() : '';
  if (!name) errors.push('name is required');

  const shortDescription = isNonEmptyString(raw.shortDescription) ? raw.shortDescription.trim() : '';
  if (!shortDescription) errors.push('shortDescription is required');

  const category = matchOption(raw.category, SERVICE_CATEGORIES);
  if (!isNonEmptyString(raw.category)) {
    errors.push('category is required');
  } else if (!category) {
    errors.push(`category "${raw.category}" is not one of: ${SERVICE_CATEGORIES.join(', ')}`);
  }

  const id = raw.id === undefined || raw.id === '' ? slugify(name) : String(raw.id).trim();
  if (raw.id !== undefined && raw.id !== '' && !ID_PATTERN.test(id)) {
    errors.push(`id "${raw.id}" must be lowercase letters, numbers and dashes`);
  }
  if (name && !id) errors.push('name must contain letters or numbers so an id can be generated');

  const type = matchOption(raw.type, DELIVERY_TYPES);
  if (raw.type !== undefined && !type) {
    errors.push(`type "${raw.type}" is not one of: ${DELIVERY_TYPES.join(', ')}`);
  }
  const difficulty = matchOption(raw.difficulty, DIFFICULTIES);
  if (raw.difficulty !== undefined && !difficulty) {
    errors.push(`difficulty must be one of: ${DIFFICULTIES.join(', ')}`);
  }
  const feeType = matchOption(raw.feeType, FEE_TYPES);
  if (raw.feeType !== undefined && !feeType) {
    errors.push(`feeType must be "free" or "paid"`);
  }
  if (raw.speedDays !== undefined && !(Number.isInteger(raw.speedDays) && raw.speedDays > 0)) {
    errors.push('speedDays must be a whole number of days greater than 0');
  }
  if (
    raw.popularityScore !== undefined &&
    !(typeof raw.popularityScore === 'number' && raw.popularityScore >= 0 && raw.popularityScore <= 100)
  ) {
    errors.push('popularityScore must be a number from 0 to 100');
  }
  if (raw.lastVerified !== undefined) {
    const problem = checkLastVerified(raw.lastVerified);
    if (problem) errors.push(problem);
  }
  for (const field of ['department', 'fees', 'processingTime']) {
    if (raw[field] !== undefined && typeof raw[field] !== 'string') errors.push(`${field} must be text`);
  }

  const eligibility = checkStringList(errors, raw, 'eligibility');
  const documents = checkStringList(errors, raw, 'documents');
  const warningsList = checkStringList(errors, raw, 'warnings');

  let steps = [];
  if (raw.steps !== undefined) {
    const valid =
      Array.isArray(raw.steps) &&
      raw.steps.every((s) => s && isNonEmptyString(s.title) && isNonEmptyString(s.description));
    if (valid) steps = raw.steps.map((s) => ({ title: s.title.trim(), description: s.description.trim() }));
    else errors.push('steps must be a list of { title, description } objects');
  }

  let officialSources = [];
  if (!Array.isArray(raw.officialSources) || raw.officialSources.length === 0) {
    errors.push('at least one official source URL is required');
  } else {
    raw.officialSources.forEach((src, idx) => {
      const label = raw.officialSources.length > 1 ? `officialSources[${idx}]` : 'official source';
      if (!src || !isHttpUrl(src.url)) {
        errors.push(`${label} URL "${src?.url ?? ''}" is not a valid http(s) link`);
      } else if (src.url.startsWith('http:')) {
        warnings.push(`${label} uses http instead of https`);
      }
    });
    officialSources = raw.officialSources.map((src) => ({
      name: isNonEmptyString(src?.name) ? src.name.trim() : 'Official Government Portal',
      url: typeof src?.url === 'string' ? src.url.trim() : '',
      // An import can't confirm a source, so it starts unverified until an
      // admin reviews and saves the service.
      verified: false,
    }));
  }

  for (const key of Object.keys(raw)) {
    if (!KNOWN_FIELDS.has(key)) warnings.push(`Unknown field "${key}" was ignored`);
  }

  if (errors.length) return { service: null, errors, warnings };

  const service = {
    id,
    name,
    shortDescription,
    category,
    department: raw.department?.trim() || '',
    type: type || 'Online / Offline',
    difficulty: difficulty || 'Medium',
    feeType: feeType || 'free',
    fees: raw.fees?.trim() || '',
    processingTime: raw.processingTime?.trim() || '',
    eligibility,
    documents,
    steps,
    officialSources,
    warnings: warningsList,
  };
  if (raw.speedDays !== undefined) service.speedDays = raw.speedDays;
  if (raw.popularityScore !== undefined) service.popularityScore = raw.popularityScore;
  if (raw.lastVerified !== undefined) service.lastVerified = raw.lastVerified;
  if (isNonEmptyString(raw.eligibilityRuleKey)) service.eligibilityRuleKey = raw.eligibilityRuleKey.trim();
  return { service, errors, warnings };
}

const detectFormat = (fileName, text) => {
  const lower = (fileName || '').toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.csv')) return 'csv';
  return /^\s*[[{]/.test(text) ? 'json' : 'csv';
};

/**
 * Build the import preview: every record lands in exactly one of
 * valid / invalid / duplicates. Nothing is saved here.
 *
 * @param {string} text file contents
 * @param {object} options
 * @param {string} [options.fileName] used to pick CSV or JSON
 * @param {Array} [options.existingServices] services already in the catalog
 */
export function buildImportPreview(text, { fileName = '', existingServices = [] } = {}) {
  const report = { format: null, fileErrors: [], warnings: [], valid: [], invalid: [], duplicates: [], total: 0 };

  if (typeof text !== 'string' || text.trim() === '') {
    report.fileErrors.push('The file is empty');
    return report;
  }
  if (new Blob([text]).size > MAX_IMPORT_BYTES) {
    report.fileErrors.push(`The file is larger than ${MAX_IMPORT_BYTES / 1024} KB`);
    return report;
  }

  report.format = detectFormat(fileName, text);
  let records;
  try {
    records = report.format === 'json' ? jsonToRecords(text) : csvToRecords(text, report.warnings);
  } catch (err) {
    report.fileErrors.push(err.message);
    return report;
  }

  report.total = records.length;
  if (records.length === 0) {
    report.fileErrors.push('No service records were found in the file');
    return report;
  }
  if (records.length > MAX_IMPORT_ROWS) {
    report.fileErrors.push(`The file has ${records.length} records; the limit is ${MAX_IMPORT_ROWS} per import`);
    return report;
  }

  const existingIds = new Map(existingServices.map((s) => [s.id, s.name]));
  const existingNames = new Map(existingServices.map((s) => [normalizeName(s.name), s.name]));
  const seenIds = new Map();
  const seenNames = new Map();

  for (const { row, raw } of records) {
    const { service, errors, warnings } = validateRecord(raw);
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    if (!service) {
      report.invalid.push({ row, name, errors, warnings });
      continue;
    }

    const key = normalizeName(service.name);
    let reason = null;
    if (existingIds.has(service.id)) reason = `id "${service.id}" already exists (${existingIds.get(service.id)})`;
    else if (existingNames.has(key)) reason = `a service named "${existingNames.get(key)}" already exists`;
    else if (seenIds.has(service.id)) reason = `same id as row ${seenIds.get(service.id)} in this file`;
    else if (seenNames.has(key)) reason = `same name as row ${seenNames.get(key)} in this file`;

    if (reason) {
      report.duplicates.push({ row, name: service.name, id: service.id, reason, warnings });
    } else {
      seenIds.set(service.id, row);
      seenNames.set(key, row);
      report.valid.push({ row, service, warnings });
    }
  }
  return report;
}

/** CSV template with one filled example row, for the "Download template" link. */
export function csvTemplate() {
  const example = {
    id: 'senior-citizen-card',
    name: 'Senior Citizen Identity Card',
    shortDescription: 'Identity and concession card for citizens aged 60 and above.',
    category: 'Identity',
    department: 'Social Justice Department',
    type: 'Online / Offline',
    difficulty: 'Easy',
    feeType: 'free',
    fees: 'Free of cost',
    processingTime: '7 - 14 days',
    speedDays: '14',
    eligibility: 'Indian citizen aged 60 or above|Resident of the issuing state',
    documents: 'Age proof (Aadhaar / birth certificate)|Address proof|Passport size photograph',
    warnings: 'Process may vary by state.',
    officialSourceName: 'Department of Social Justice',
    officialSourceUrl: 'https://socialjustice.gov.in',
    lastVerified: '2026-10-01',
  };
  const quote = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return `${CSV_COLUMNS.join(',')}\n${CSV_COLUMNS.map((c) => quote(example[c] || '')).join(',')}\n`;
}
