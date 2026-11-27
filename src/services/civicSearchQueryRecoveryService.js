/**
 * src/services/civicSearchQueryRecoveryService.js
 *
 * Civic Search Query Understanding & Spelling Recovery Layer (#1431).
 *
 * Extends `phoneticTransliterationSearchService.js` and `CIVIC_ACRONYMS` with:
 *   1. Multilingual / Devanagari & Hinglish transliteration normalization.
 *   2. Typo-tolerant spelling recovery (edit distance <= 2) against curated civic vocabulary.
 *   3. Curated synonym mappings for service names and departments.
 *   4. Strict Legal Identifier Protection: never silently alters Form numbers
 *      (Form 16, Form 26AS), statutory sections (Section 80C), case/RTI refs
 *      (RTI/2026/101, GRV-123), PIN codes, or IFSC codes.
 *   5. Preserves `originalQuery` and surfaces transparent correction chips.
 *   6. Reviewed query evaluation log (PII-free).
 */

import { INDIC_CIVIC_COLLOQUIAL_LEXICON } from './phoneticTransliterationSearchService.js';
import { MOCK_SERVICES } from '../data/services.js';

export const QUERY_EVALUATION_STORAGE_KEY = 'civicbridge_search_query_evaluations_v1';

export const DEVANAGARI_PHRASE_MAP = Object.freeze({
  'आय प्रमाण पत्र': 'aay praman patra',
  'जाति प्रमाण पत्र': 'jaati praman patra',
  'निवास प्रमाण पत्र': 'niwas praman patra',
  'राशन कार्ड': 'rashan card',
  'जन्म प्रमाण पत्र': 'birth certificate',
  'पेंशन': 'pension',
  'बिजली': 'electricity',
  'पानी': 'water',
});

export const CURATED_SYNONYMS = Object.freeze({
  bijli: 'electricity',
  paani: 'water',
  pani: 'water',
  tehsil: 'revenue collectorate',
  nagar: 'municipal',
  nigam: 'municipal corporation',
  sadak: 'road',
  shikayat: 'grievance complaint',
  rashan: 'ration',
  dakhil: 'mutation',
  kharij: 'mutation',
});

export const CIVIC_VOCABULARY = Object.freeze([
  'income', 'certificate', 'caste', 'domicile', 'ration', 'card', 'birth',
  'death', 'marriage', 'pension', 'senior', 'citizen', 'disability', 'udid',
  'passport', 'driving', 'licence', 'license', 'voter', 'aadhaar', 'property',
  'tax', 'mutation', 'electricity', 'water', 'municipal', 'corporation',
  'collectorate', 'revenue', 'grievance', 'complaint', 'scholarship', 'rationing',
  'welfare', 'housing', 'building', 'permit', 'health', 'hospital',
]);

// Legal / statutory identifiers that MUST NEVER be altered by spell correction
const LEGAL_ID_PATTERNS = [
  /^form[-_\s]?\d+[a-z]*$/i,
  /^sec(?:tion)?[-_\s]?\d+[a-z]*$/i,
  /^(?:rti|grv|pwd|rc|g\.o\.|ipc|bns|crpc|bnss)[/-]?[a-z0-9/-]*$/i,
  /^[a-z]{2,5}[-/]\d{2,6}(?:[-/][a-z0-9]+)*$/i,
  /^\d{6}$/, // PIN codes
  /^[A-Z]{4}0[A-Z0-9]{6}$/i, // IFSC
];

const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;

export function isLegalIdentifierToken(token = '', prevToken = '') {
  const t = String(token || '').trim();
  if (!t) return false;
  if (LEGAL_ID_PATTERNS.some((re) => re.test(t))) return true;
  if (/^(form|section|sec|rule|article|act)$/i.test(prevToken) && /^\d+[a-z]*$/i.test(t)) {
    return true;
  }
  return false;
}

export function editDistance(a = '', b = '') {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[m][n];
}

function findClosestCivicTerm(token) {
  const lower = token.toLowerCase();
  if (lower.length < 4 || CIVIC_VOCABULARY.includes(lower)) return null;
  let best = null;
  let bestDist = 3;
  for (const term of CIVIC_VOCABULARY) {
    if (Math.abs(term.length - lower.length) > 2) continue;
    const d = editDistance(lower, term);
    if (d <= 2 && d < bestDist) {
      bestDist = d;
      best = term;
    }
  }
  return best ? { term: best, distance: bestDist } : null;
}

export function understandAndRecoverQuery(rawQuery = '') {
  const originalQuery = String(rawQuery || '').trim();
  if (!originalQuery) {
    return {
      originalQuery: '',
      normalizedQuery: '',
      correctedQuery: '',
      hasCorrection: false,
      corrections: [],
      transliterations: [],
      synonymsApplied: [],
      lockedLegalTokens: [],
      results: [],
    };
  }

  let working = originalQuery;
  const transliterations = [];
  const synonymsApplied = [];
  const corrections = [];
  const lockedLegalTokens = [];

  // 1. Devanagari transliteration
  for (const [devanagari, latin] of Object.entries(DEVANAGARI_PHRASE_MAP)) {
    if (working.includes(devanagari)) {
      working = working.replaceAll(devanagari, latin);
      transliterations.push({ from: devanagari, to: latin, kind: 'devanagari_transliteration' });
    }
  }

  // 2. Colloquial Indic lexicon phrase expansion (longest phrase first)
  const lowerWorking = working.toLowerCase();
  const sortedLexicon = [...INDIC_CIVIC_COLLOQUIAL_LEXICON].sort(
    (a, b) => b.colloquial.length - a.colloquial.length
  );
  for (const entry of sortedLexicon) {
    if (lowerWorking.includes(entry.colloquial)) {
      transliterations.push({
        from: entry.colloquial,
        to: entry.canonical,
        kind: 'indic_colloquial_lexicon',
        explanation: entry.explanation,
      });
      working = working.replace(new RegExp(entry.colloquial, 'ig'), entry.canonical);
    }
  }

  // 3. Token-level legal identifier lock, synonym mapping, and spelling recovery
  const tokens = working.split(/\s+/).filter(Boolean);
  const recoveredTokens = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    const prev = i > 0 ? tokens[i - 1] : '';

    if (isLegalIdentifierToken(tok, prev)) {
      lockedLegalTokens.push(tok);
      recoveredTokens.push(tok); // NEVER alter legal identifiers
      continue;
    }

    const lower = tok.toLowerCase();
    if (CURATED_SYNONYMS[lower]) {
      const mapped = CURATED_SYNONYMS[lower];
      synonymsApplied.push({ from: tok, to: mapped });
      recoveredTokens.push(mapped);
      continue;
    }

    const match = findClosestCivicTerm(tok);
    if (match) {
      corrections.push({
        original: tok,
        corrected: match.term,
        editDistance: match.distance,
        reason: 'spelling_recovery',
      });
      recoveredTokens.push(match.term);
      continue;
    }

    recoveredTokens.push(tok);
  }

  const correctedQuery = recoveredTokens.join(' ');
  const hasCorrection =
    corrections.length > 0 || transliterations.length > 0 || synonymsApplied.length > 0;

  // 4. Retrieve matching civic services
  const searchTerms = correctedQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  const results = MOCK_SERVICES.map((svc) => {
    const hay = `${svc.title || ''} ${svc.name || ''} ${svc.category || ''} ${svc.description || ''} ${(svc.tags || []).join(' ')}`.toLowerCase();
    const hits = searchTerms.filter((t) => hay.includes(t)).length;
    return { svc, hits };
  })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 8)
    .map((x) => ({
      id: x.svc.id,
      title: x.svc.title || x.svc.name,
      category: x.svc.category,
      matchedTerms: x.hits,
      provenance: 'official_catalogue',
    }));

  return {
    originalQuery,
    normalizedQuery: working,
    correctedQuery,
    hasCorrection,
    corrections,
    transliterations,
    synonymsApplied,
    lockedLegalTokens,
    results,
  };
}

function getStorage(customStorage = null) {
  if (customStorage) return customStorage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function listQueryEvaluations(customStorage = null) {
  const store = getStorage(customStorage);
  if (!store) return [];
  try {
    const raw = store.getItem(QUERY_EVALUATION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordReviewedQueryEvaluation({
  originalQuery,
  correctedQuery,
  accepted,
  evaluatorId = 'reviewer_local',
  notes = '',
  customStorage = null,
}) {
  const combined = `${originalQuery || ''} ${correctedQuery || ''} ${notes || ''}`;
  if (AADHAAR_RE.test(combined) || PAN_RE.test(combined)) {
    throw new Error('Evaluation log rejected: must not contain Aadhaar or PAN numbers.');
  }

  const list = listQueryEvaluations(customStorage);
  const entry = {
    evalId: `qeval_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    originalQuery,
    correctedQuery,
    accepted: Boolean(accepted),
    evaluatorId,
    notes: String(notes || '').trim(),
    evaluatedAt: new Date().toISOString(),
  };
  list.unshift(entry);
  const store = getStorage(customStorage);
  if (store) {
    try {
      store.setItem(QUERY_EVALUATION_STORAGE_KEY, JSON.stringify(list.slice(0, 200)));
    } catch {
      // ignore quota errors
    }
  }
  return entry;
}
