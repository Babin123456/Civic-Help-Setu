/**
 * Civic Form Field Explainer and Plain-Language Glossary Service (#142)
 *
 * Implements curated administrative term lookups, acronym and abbreviation resolution,
 * contextual "What does this mean?" explainers, safe fallbacks without AI-invented legal advice,
 * and user correction suggestion submissions with editorial separation.
 */

import { CIVIC_GLOSSARY, searchGlossary } from '../data/civicGlossary.js';

export const GLOSSARY_SUGGESTIONS_STORAGE_KEY = 'civic_glossary_suggestions';

/**
 * Returns all published glossary entries.
 * @returns {Array}
 */
export function getGlossaryEntries() {
  return CIVIC_GLOSSARY;
}

/**
 * Resolves a glossary entry by its ID or exact term/abbreviation match.
 * @param {string} identifier
 * @returns {Object|null}
 */
export function getGlossaryEntryById(identifier) {
  if (!identifier || typeof identifier !== 'string') return null;
  const clean = identifier.trim().toLowerCase();

  // 1. Direct ID match
  const byId = CIVIC_GLOSSARY.find((item) => item.id.toLowerCase() === clean);
  if (byId) return byId;

  // 2. Exact term match
  const byTerm = CIVIC_GLOSSARY.find((item) => item.term.toLowerCase() === clean);
  if (byTerm) return byTerm;

  // 3. Exact abbreviation match
  const byAbbr = CIVIC_GLOSSARY.find((item) =>
    Array.isArray(item.abbreviations) && item.abbreviations.some((a) => a.toLowerCase() === clean)
  );
  if (byAbbr) return byAbbr;

  return null;
}

/**
 * Searches the glossary supporting terms and common abbreviations.
 * @param {string} query
 * @returns {Array}
 */
export function searchCivicGlossary(query = '') {
  return searchGlossary(query);
}

/**
 * Contextual explainer for form field labels and legal jargon.
 *
 * Acceptance Criteria Compliance:
 * "Unknown terms produce a safe fallback rather than an AI-invented legal definition."
 *
 * @param {string} termOrLabel
 * @returns {Object} { found: boolean, entry?: Object, safeFallback?: Object }
 */
export function explainFormField(termOrLabel) {
  if (!termOrLabel || typeof termOrLabel !== 'string' || !termOrLabel.trim()) {
    return {
      found: false,
      term: '',
      safeFallback: {
        title: 'Unknown Field',
        definition: 'No field label or term was provided to explain.',
        disclaimer: 'Civic Help Setu does not invent administrative or legal definitions.',
        canSuggest: false,
      },
    };
  }

  const clean = termOrLabel.trim();
  const matched = getGlossaryEntryById(clean);

  if (matched) {
    return {
      found: true,
      term: clean,
      entry: matched,
    };
  }

  // Check if any known glossary term is a substring or keyword in the label
  const matches = searchGlossary(clean);
  if (matches.length > 0) {
    return {
      found: true,
      term: clean,
      entry: matches[0],
      relatedMatches: matches.slice(1, 4),
    };
  }

  // Safe Fallback: Do NOT invent legal guidance
  return {
    found: false,
    term: clean,
    safeFallback: {
      title: clean,
      definition: `No verified official definition found for "${clean}".`,
      disclaimer:
        'Civic Help Setu provides verified civic guidance and strictly refuses to generate unverified, automated, or AI-invented legal definitions. Please consult the official departmental portal or instructions accompanying this specific form.',
      officialPortal: {
        name: 'National Government Services Portal',
        url: 'https://services.india.gov.in',
      },
      canSuggest: true,
    },
  };
}

/**
 * Submits a user suggestion/correction for an administrative definition.
 *
 * Acceptance Criteria Compliance:
 * "Users can suggest a correction without directly editing published definitions."
 *
 * @param {Object} payload - { term, termId, suggestedDefinition, rationale, userContact }
 * @param {Storage} [storage=localStorage]
 * @returns {Object} Result { ok: boolean, error?: string, suggestionId?: string }
 */
export function submitGlossarySuggestion(
  payload = {},
  storage = typeof localStorage !== 'undefined' ? localStorage : null
) {
  if (!storage) {
    return { ok: false, error: 'Storage is not accessible to record suggestion.' };
  }

  const { term, termId, suggestedDefinition, rationale, userContact } = payload;

  const cleanTerm = (term || termId || '').trim();
  if (!cleanTerm) {
    return { ok: false, error: 'Term or field name is required.' };
  }

  const cleanDef = (suggestedDefinition || '').trim();
  if (cleanDef.length < 10) {
    return { ok: false, error: 'Suggested plain-language definition must be at least 10 characters.' };
  }

  const cleanRationale = (rationale || '').trim();
  if (cleanRationale.length < 5) {
    return { ok: false, error: 'Please provide a brief reason or source reference for this suggestion.' };
  }

  try {
    const existingRaw = storage.getItem(GLOSSARY_SUGGESTIONS_STORAGE_KEY);
    const suggestions = existingRaw ? JSON.parse(existingRaw) : [];

    const newSuggestion = {
      id: `SUGG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      term: cleanTerm,
      termId: termId || null,
      suggestedDefinition: cleanDef,
      rationale: cleanRationale,
      userContact: userContact ? userContact.trim() : null,
      status: 'pending_editorial_review',
      createdAt: new Date().toISOString(),
    };

    suggestions.unshift(newSuggestion);
    storage.setItem(GLOSSARY_SUGGESTIONS_STORAGE_KEY, JSON.stringify(suggestions));

    return {
      ok: true,
      suggestionId: newSuggestion.id,
      message: 'Thank you! Your suggested clarification has been submitted for verified editorial review.',
    };
  } catch (err) {
    return { ok: false, error: 'Failed to record suggestion due to storage error.' };
  }
}

/**
 * Reads all stored user suggestions.
 * @param {Storage} [storage=localStorage]
 * @returns {Array}
 */
export function getGlossarySuggestions(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(GLOSSARY_SUGGESTIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Clears stored user suggestions.
 * @param {Storage} [storage=localStorage]
 * @returns {boolean}
 */
export function clearGlossarySuggestions(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return false;
  try {
    storage.removeItem(GLOSSARY_SUGGESTIONS_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
