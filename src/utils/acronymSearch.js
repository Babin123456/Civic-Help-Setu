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
 * Search acronyms by acronym, expanded form, or plain-language explanation.
 * Case-insensitive and tolerant of extra whitespace.
 * @param {string} query
 * @returns {Array} Matching acronym entries (empty array when nothing matches)
 */
export function searchAcronyms(query = '') {
  const q = normalize(query);
  if (!q) return [];

  return CIVIC_ACRONYMS.filter((entry) => {
    const acronym = normalize(entry.acronym);
    const expanded = normalize(entry.expandedForm);
    const explanation = normalize(entry.plainLanguageExplanation);
    return acronym === q || acronym.includes(q) || expanded.includes(q) || explanation.includes(q);
  });
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
  searchAcronyms,
  getAcronymById,
  getAcronymByAcronym,
  resolveRelatedServices,
  validateAcronymData,
};
