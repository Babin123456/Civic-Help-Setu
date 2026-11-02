/**
 * Acronym directory search utilities (#263)
 *
 * Reusable search over the civic acronym dataset. Search is case-insensitive
 * and collapses extra whitespace so citizens can type " epfo ", "EPFO", or
 * "employees provident fund" and find the same entry.
 *
 * Unknown acronyms are never expanded by guessing: only curated entries are
 * returned.
 */

import { CIVIC_ACRONYMS } from '../data/civicAcronyms.js';
import { MOCK_SERVICES } from '../data/services.js';
import { getServiceById } from '../services/serviceCatalog.js';

const VALID_SERVICE_IDS = new Set(MOCK_SERVICES.map((service) => service.id));

/** Lowercase, collapse internal whitespace, and trim. */
const normalize = (value) => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Civic Acronym Category Constants
 */
export const ACRONYM_CATEGORIES = Object.freeze({
  ALL: 'all',
  IDENTITY: 'identity',
  WELFARE: 'welfare',
  FINANCE: 'finance',
  GOVERNANCE: 'governance',
});

/**
 * Human-readable labels for acronym categories
 */
export const ACRONYM_CATEGORY_LABELS = Object.freeze({
  [ACRONYM_CATEGORIES.ALL]: 'All Categories',
  [ACRONYM_CATEGORIES.IDENTITY]: 'Identity & KYC',
  [ACRONYM_CATEGORIES.WELFARE]: 'Social Welfare & Benefits',
  [ACRONYM_CATEGORIES.FINANCE]: 'Finance & Employment',
  [ACRONYM_CATEGORIES.GOVERNANCE]: 'Governance & Transport',
});

/**
 * Internal classification dictionary mapping acronym IDs to functional categories.
 */
const ACRONYM_CATEGORY_MAP = Object.freeze({
  uidai: ACRONYM_CATEGORIES.IDENTITY,
  poi: ACRONYM_CATEGORIES.IDENTITY,
  poa: ACRONYM_CATEGORIES.IDENTITY,
  epic: ACRONYM_CATEGORIES.IDENTITY,
  eid: ACRONYM_CATEGORIES.IDENTITY,
  nsdl: ACRONYM_CATEGORIES.IDENTITY,
  bpl: ACRONYM_CATEGORIES.WELFARE,
  ews: ACRONYM_CATEGORIES.WELFARE,
  dbt: ACRONYM_CATEGORIES.WELFARE,
  csc: ACRONYM_CATEGORIES.WELFARE,
  epfo: ACRONYM_CATEGORIES.FINANCE,
  uan: ACRONYM_CATEGORIES.FINANCE,
  ifsc: ACRONYM_CATEGORIES.FINANCE,
  rti: ACRONYM_CATEGORIES.GOVERNANCE,
  noc: ACRONYM_CATEGORIES.GOVERNANCE,
  psk: ACRONYM_CATEGORIES.GOVERNANCE,
  rto: ACRONYM_CATEGORIES.GOVERNANCE,
});

/**
 * Resolve category for a given acronym ID.
 * @param {string} id
 * @returns {string} Category slug
 */
export function getAcronymCategory(id) {
  const cleanId = normalize(id);
  return ACRONYM_CATEGORY_MAP[cleanId] || ACRONYM_CATEGORIES.GOVERNANCE;
}

/**
 * Returns all available acronyms optionally sorted.
 * @param {'acronym-asc'|'acronym-desc'|'name-asc'} [sortBy='acronym-asc']
 * @returns {Array} Sorted list of acronym entries
 */
export function getAllAcronyms(sortBy = 'acronym-asc') {
  const entries = [...CIVIC_ACRONYMS];
  return entries.sort((a, b) => {
    if (sortBy === 'acronym-desc') {
      return b.acronym.localeCompare(a.acronym);
    }
    if (sortBy === 'name-asc') {
      return a.expandedForm.localeCompare(b.expandedForm);
    }
    return a.acronym.localeCompare(b.acronym);
  });
}

/**
 * Calculate distribution of acronyms across categories.
 * @param {Array} [entries=CIVIC_ACRONYMS]
 * @returns {Record<string, number>} Category count map
 */
export function getAcronymCategoryCounts(entries = CIVIC_ACRONYMS) {
  const counts = {
    [ACRONYM_CATEGORIES.ALL]: entries.length,
    [ACRONYM_CATEGORIES.IDENTITY]: 0,
    [ACRONYM_CATEGORIES.WELFARE]: 0,
    [ACRONYM_CATEGORIES.FINANCE]: 0,
    [ACRONYM_CATEGORIES.GOVERNANCE]: 0,
  };

  entries.forEach((entry) => {
    const category = getAcronymCategory(entry.id);
    if (counts[category] !== undefined) {
      counts[category] += 1;
    }
  });

  return counts;
}

/**
 * Filter acronym entries by keyword, category, starting letter, and sorting criteria.
 * @param {Object} [params]
 * @param {string} [params.query=''] Search keyword
 * @param {string} [params.category='all'] Category filter
 * @param {string} [params.letter=''] First letter filter (A-Z)
 * @param {'acronym-asc'|'acronym-desc'|'name-asc'} [params.sortBy='acronym-asc'] Sort order
 * @param {Array} [params.entries=CIVIC_ACRONYMS] List of entries
 * @returns {Array} Filtered and sorted acronym entries
 */
export function filterAcronyms({
  query = '',
  category = ACRONYM_CATEGORIES.ALL,
  letter = '',
  sortBy = 'acronym-asc',
  entries = CIVIC_ACRONYMS,
} = {}) {
  const q = normalize(query);
  const selectedLetter = normalize(letter).charAt(0);
  const selectedCategory = normalize(category);

  const filtered = entries.filter((entry) => {
    // 1. Text search
    if (q) {
      const acronym = normalize(entry.acronym);
      const expanded = normalize(entry.expandedForm);
      const explanation = normalize(entry.plainLanguageExplanation);
      const matchesSearch = acronym === q || acronym.includes(q) || expanded.includes(q) || explanation.includes(q);
      if (!matchesSearch) return false;
    }

    // 2. Category filter
    if (selectedCategory && selectedCategory !== ACRONYM_CATEGORIES.ALL) {
      const entryCategory = getAcronymCategory(entry.id);
      if (entryCategory !== selectedCategory) return false;
    }

    // 3. Alphabetical letter filter
    if (selectedLetter) {
      const firstChar = normalize(entry.acronym).charAt(0);
      if (firstChar !== selectedLetter) return false;
    }

    return true;
  });

  return filtered.sort((a, b) => {
    if (sortBy === 'acronym-desc') {
      return b.acronym.localeCompare(a.acronym);
    }
    if (sortBy === 'name-asc') {
      return a.expandedForm.localeCompare(b.expandedForm);
    }
    return a.acronym.localeCompare(b.acronym);
  });
}

/**
 * Search acronyms by acronym, expanded form, or plain-language explanation.
 * Case-insensitive and tolerant of extra whitespace.
 * @param {string} query
 * @param {Object} [options]
 * @param {boolean} [options.includeAllOnEmpty=false]
 * @returns {Array} Matching acronym entries
 */
export function searchAcronyms(query = '', { includeAllOnEmpty = false } = {}) {
  const q = normalize(query);
  if (!q) {
    return includeAllOnEmpty ? getAllAcronyms() : [];
  }

  return CIVIC_ACRONYMS.filter((entry) => {
    const acronym = normalize(entry.acronym);
    const expanded = normalize(entry.expandedForm);
    const explanation = normalize(entry.plainLanguageExplanation);
    return acronym === q || acronym.includes(q) || expanded.includes(q) || explanation.includes(q);
  });
}

/**
 * Format an acronym entry into an official plain-text citation format.
 * Suitable for copying to clipboard or quoting in an application.
 * @param {Object} entry
 * @returns {string} Formatted citation
 */
export function formatAcronymCitation(entry) {
  if (!entry || !entry.acronym) return '';
  const lines = [
    `${entry.acronym} — ${entry.expandedForm || ''}`,
    `Definition: ${entry.plainLanguageExplanation || ''}`,
    'Source: Civic Help Setu Verified Acronym Directory',
  ];
  return lines.join('\n');
}

/**
 * Resolve one acronym entry by its stable id.
 * @param {string} id
 * @returns {Object|null}
 */
export function getAcronymById(id) {
  const clean = normalize(id);
  if (!clean) return null;
  return CIVIC_ACRONYMS.find((entry) => entry.id === clean) || null;
}

/**
 * Resolve one acronym entry by an exact acronym match (case-insensitive).
 * @param {string} acronym
 * @returns {Object|null}
 */
export function getAcronymByAcronym(acronym) {
  const clean = normalize(acronym);
  if (!clean) return null;
  return CIVIC_ACRONYMS.find((entry) => normalize(entry.acronym) === clean) || null;
}

/**
 * Resolve an acronym's related service IDs to full catalogue records.
 * Records that no longer exist in the catalogue are silently skipped so a
 * stale reference never breaks the directory.
 * @param {Object} acronymEntry
 * @returns {Array} Resolved service records
 */
export function resolveRelatedServices(acronymEntry) {
  if (!acronymEntry || !Array.isArray(acronymEntry.relatedServiceIds)) return [];
  return acronymEntry.relatedServiceIds
    .map((serviceId) => getServiceById(serviceId))
    .filter(Boolean);
}

/**
 * Validate the curated acronym data for integrity problems used in tests:
 * duplicate acronyms, missing definitions, and invalid service references.
 * @param {Array} [entries=CIVIC_ACRONYMS]
 * @returns {Object} { valid: boolean, errors: Array<{ entryId, field, reason }> }
 */
export function validateAcronymData(entries = CIVIC_ACRONYMS) {
  const errors = [];
  const seenAcronyms = new Set();

  for (const entry of entries) {
    const entryId = entry.id;

    // Duplicate acronyms (case-insensitive)
    const acronymKey = normalize(entry.acronym);
    if (seenAcronyms.has(acronymKey)) {
      errors.push({ entryId, field: 'acronym', reason: `Duplicate acronym "${entry.acronym}".` });
    }
    seenAcronyms.add(acronymKey);

    // Missing / blank plain-language definition
    if (!entry.plainLanguageExplanation || !entry.plainLanguageExplanation.trim()) {
      errors.push({ entryId, field: 'plainLanguageExplanation', reason: 'Missing plain-language definition.' });
    }

    // Invalid service references (must resolve to catalogue records)
    if (Array.isArray(entry.relatedServiceIds)) {
      for (const serviceId of entry.relatedServiceIds) {
        if (!VALID_SERVICE_IDS.has(serviceId)) {
          errors.push({ entryId, field: 'relatedServiceIds', reason: `Invalid service reference "${serviceId}".` });
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export default {
  ACRONYM_CATEGORIES,
  ACRONYM_CATEGORY_LABELS,
  getAcronymCategory,
  getAllAcronyms,
  getAcronymCategoryCounts,
  filterAcronyms,
  searchAcronyms,
  formatAcronymCitation,
  getAcronymById,
  getAcronymByAcronym,
  resolveRelatedServices,
  validateAcronymData,
};
