import { matchesJurisdiction } from './jurisdictionService';

export const CIVIC_SYNONYMS = {
  dl: ['driving license', 'license', 'rto', 'vehicle', 'driving'],
  license: ['driving license', 'dl', 'rto', 'permit'],
  licence: ['driving license', 'license', 'dl'],
  adhaar: ['aadhaar', 'uidai', 'biometric'],
  adhar: ['aadhaar', 'uidai'],
  uidai: ['aadhaar', 'identity'],
  pan: ['pan card', 'income tax', 'tin', 'nsdl'],
  tax: ['pan card', 'property tax', 'income certificate'],
  birth: ['birth certificate', 'born', 'baby', 'municipal'],
  death: ['death certificate', 'cremation', 'legal heir'],
  passport: ['tatkal', 'visa', 'mea', 'travel'],
  passprot: ['passport'],
  voter: ['voter id', 'election', 'epic', 'ballot'],
  ration: ['ration card', 'food subsidy', 'bpl', 'pds'],
  property: ['property tax', 'mutation', 'encumbrance', 'khata', 'patta'],
  free: ['no fee', 'zero cost', 'gratis'],
};

export const CIVIC_PHONETIC_TRANSLITERATIONS = {
  rashan: ['ration card', 'ration'],
  khadya: ['ration card', 'food'],
  aay: ['income certificate', 'income'],
  aaye: ['income certificate', 'income'],
  jaati: ['caste certificate', 'caste'],
  jati: ['caste certificate', 'caste'],
  janm: ['birth certificate', 'birth'],
  janam: ['birth certificate', 'birth'],
  mrityu: ['death certificate', 'death'],
  niwas: ['domicile', 'residence'],
  nivas: ['domicile', 'residence'],
  pehchan: ['voter id', 'identity'],
  gaadi: ['driving license', 'vehicle'],
  gadi: ['driving license', 'vehicle'],
  parivahan: ['driving license', 'transport'],
  kisan: ['pm-kisan', 'agriculture'],
  kheti: ['pm-kisan', 'agriculture'],
};

const COMMON_CIVIC_DICTIONARY = [
  'aadhaar',
  'passport',
  'license',
  'driving',
  'certificate',
  'income',
  'birth',
  'voter',
  'ration',
  'property',
  'mutation',
  'affidavit',
  'domicile',
  'encumbrance',
  'challan',
  'scholarship',
];

const addSuggestion = (suggestions, value, kind, priority) => {
  const label = String(value || '').trim();
  if (!label) return;
  const key = label.toLowerCase();
  const current = suggestions.get(key);
  if (!current || priority < current.priority) {
    suggestions.set(key, { label, kind, priority });
  }
};

/**
 * Build deterministic type-ahead suggestions from real catalog vocabulary.
 * Prefix matches rank above contains matches, then shorter labels win.
 */
export const getSearchSuggestions = (services = [], query = '', limit = 6) => {
  const clean = query.toLowerCase().trim();
  if (clean.length < 2) return [];

  const candidates = new Map();
  services.forEach((service) => {
    addSuggestion(candidates, service.name, 'Service', 0);
    addSuggestion(candidates, service.category, 'Category', 1);
    addSuggestion(candidates, service.department, 'Department', 2);
    (service.documents || []).forEach((document) => {
      addSuggestion(candidates, document, 'Document', 3);
    });
  });
  Object.entries(CIVIC_SYNONYMS).forEach(([keyword, synonyms]) => {
    addSuggestion(candidates, keyword, 'Keyword', 4);
    synonyms.forEach((synonym) => addSuggestion(candidates, synonym, 'Keyword', 4));
  });
  COMMON_CIVIC_DICTIONARY.forEach((keyword) => {
    addSuggestion(candidates, keyword, 'Keyword', 4);
  });

  return [...candidates.values()]
    .filter(({ label }) => label.toLowerCase().includes(clean))
    .sort((a, b) => {
      const aPrefix = a.label.toLowerCase().startsWith(clean) ? 0 : 1;
      const bPrefix = b.label.toLowerCase().startsWith(clean) ? 0 : 1;
      return aPrefix - bPrefix || a.priority - b.priority ||
        a.label.length - b.label.length || a.label.localeCompare(b.label);
    })
    .slice(0, Math.max(0, limit))
    .map(({ label, kind }) => ({ label, kind }));
};

// Levenshtein distance for fuzzy typo correction
const getLevenshteinDistance = (a, b) => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

export const getDidYouMeanSuggestion = (query = '') => {
  const clean = query.toLowerCase().trim();
  if (!clean || clean.length < 3) return null;

  // 1. Direct synonym mapping
  if (CIVIC_SYNONYMS[clean]) {
    return CIVIC_SYNONYMS[clean][0];
  }

  // 2. Fuzzy match against dictionary
  let bestMatch = null;
  let minDistance = 3; // Max allowable edit distance

  for (const word of COMMON_CIVIC_DICTIONARY) {
    if (word === clean) return null; // exact match, no correction needed
    const dist = getLevenshteinDistance(clean, word);
    if (dist < minDistance && dist <= Math.floor(clean.length / 2)) {
      minDistance = dist;
      bestMatch = word;
    }
  }

  return bestMatch;
};

export const calculateServiceRelevance = (service, query) => {
  if (!query || !query.trim()) return 1;

  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(Boolean);

  let score = 0;
  const nameLower = (service.name || '').toLowerCase();
  const descLower = (service.shortDescription || '').toLowerCase();
  const catLower = (service.category || '').toLowerCase();
  const deptLower = (service.department || '').toLowerCase();
  const docs = (service.documents || []).map((d) => d.toLowerCase());
  const eligibility = (service.eligibility || []).map((e) => e.toLowerCase());

  // 1. Exact phrase match
  if (nameLower.includes(q)) score += 25;
  if (descLower.includes(q)) score += 10;
  if (catLower.includes(q)) score += 8;
  if (deptLower.includes(q)) score += 8;

  // 2. Synonym expansion bonus
  for (const [key, synonyms] of Object.entries(CIVIC_SYNONYMS)) {
    if (q.includes(key)) {
      for (const syn of synonyms) {
        if (nameLower.includes(syn)) score += 15;
        if (descLower.includes(syn)) score += 6;
      }
    }
  }

  // 3. Phonetic transliteration bonus
  for (const [transKey, canonicals] of Object.entries(CIVIC_PHONETIC_TRANSLITERATIONS)) {
    if (q.includes(transKey)) {
      for (const canon of canonicals) {
        if (nameLower.includes(canon)) score += 20;
        if (descLower.includes(canon)) score += 8;
        if (catLower.includes(canon)) score += 6;
      }
    }
  }

  // 4. Token-by-token scoring & fuzzy typo matching
  const serviceWords = nameLower.split(/[\s-]+/).concat(catLower.split(/[\s-]+/));
  for (const token of tokens) {
    let matched = false;
    if (nameLower.includes(token)) { score += 6; matched = true; }
    if (deptLower.includes(token)) { score += 4; matched = true; }
    if (catLower.includes(token)) { score += 3; matched = true; }
    if (descLower.includes(token)) { score += 2; matched = true; }
    if (docs.some((d) => d.includes(token))) { score += 2; matched = true; }
    if (eligibility.some((e) => e.includes(token))) { score += 1; matched = true; }

    if (!matched && token.length >= 4) {
      for (const word of serviceWords) {
        if (word.length >= 4) {
          const dist = getLevenshteinDistance(token, word);
          if (dist === 1 || (dist === 2 && token.length >= 6)) {
            score += 10;
            break;
          }
        }
      }
    }
  }
  if (false) {
  // 3. Token-by-token scoring
  for (const token of tokens) {
    if (nameLower.includes(token)) score += 6;
    if (deptLower.includes(token)) score += 4;
    if (catLower.includes(token)) score += 3;
    if (descLower.includes(token)) score += 2;
    if (docs.some((d) => d.includes(token))) score += 2;
    if (eligibility.some((e) => e.includes(token))) score += 1;
  }

  }

  return score;
};

export const rankAndFilterServices = (
  services,
  {
    searchQuery = '',
    category = 'All',
    department = 'All',
    mode = 'All',
    difficulty = 'All',
    feeType = 'All',
    speedFilter = 'All',
    state = 'All',
    district = 'All',
    sortBy = 'relevance',
  }
) => {
  let result = [...services];

  // 1. Category Filter
  if (category && category !== 'All') {
    result = result.filter((s) => s.category.toLowerCase() === category.toLowerCase());
  }

  // 2. Department Filter
  if (department && department !== 'All') {
    result = result.filter((s) => (s.department || '').toLowerCase() === department.toLowerCase());
  }

  // 3. Mode Filter (Online / Offline / Hybrid)
  if (mode && mode !== 'All') {
    result = result.filter((s) => {
      const type = (s.type || '').toLowerCase();
      if (mode === 'Online') return type.includes('online');
      if (mode === 'Offline') return type.includes('offline');
      if (mode === 'Hybrid') return type.includes('hybrid') || (type.includes('online') && type.includes('offline'));
      return true;
    });
  }

  // 4. Difficulty Filter
  if (difficulty && difficulty !== 'All') {
    result = result.filter((s) => (s.difficulty || '').toLowerCase() === difficulty.toLowerCase());
  }

  // 5. Fee Type Filter (Free vs Paid)
  if (feeType && feeType !== 'All') {
    result = result.filter((s) => {
      const isFree = (s.fees || '').toLowerCase().includes('free') || (s.fees || '').includes('₹0') || s.feeType === 'free';
      if (feeType === 'Free') return isFree;
      if (feeType === 'Paid') return !isFree;
      return true;
    });
  }

  // 6. Processing Speed Filter
  if (speedFilter && speedFilter !== 'All') {
    result = result.filter((s) => {
      const days = s.speedDays || 15;
      if (speedFilter === 'Fast') return days <= 7;
      if (speedFilter === 'Urgent') return days <= 3;
      if (speedFilter === 'Standard') return days > 7;
      return true;
    });
  }

  // 6b. Jurisdiction filter: unknown scope never matches a selected place
  if (state && state !== 'All') {
    result = result.filter((s) => matchesJurisdiction(s, { state, district }));
  }

  // 7. Relevance scoring if search query is present
  if (searchQuery.trim()) {
    result = result
      .map((s) => ({
        service: s,
        relevance: calculateServiceRelevance(s, searchQuery),
      }))
      .filter((item) => item.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .map((item) => item.service);
  }

  // 8. Explicit Sorting
  if (sortBy === 'speed-asc') {
    result.sort((a, b) => (a.speedDays || 15) - (b.speedDays || 15));
  } else if (sortBy === 'popularity') {
    result.sort((a, b) => (b.popularityScore || 50) - (a.popularityScore || 50));
  } else if (sortBy === 'name-asc') {
    result.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'name-desc') {
    result.sort((a, b) => b.name.localeCompare(a.name));
  } else if (sortBy === 'difficulty-asc') {
    const rank = { easy: 1, medium: 2, hard: 3 };
    result.sort((a, b) => (rank[a.difficulty?.toLowerCase()] || 2) - (rank[b.difficulty?.toLowerCase()] || 2));
  }

  return result;
};


/**
 * Detects whether a search query triggered a transliteration or typo match,
 * returning a citizen-friendly message for feedback display.
 */
export const getFuzzyMatchSummary = (query = '') => {
  const clean = query.toLowerCase().trim();
  if (!clean || clean.length < 3) return null;

  for (const [transKey, canonicals] of Object.entries(CIVIC_PHONETIC_TRANSLITERATIONS)) {
    if (clean.includes(transKey)) {
      return {
        isTransliterated: true,
        matchedPhrase: transKey,
        suggestedTerm: canonicals[0],
      };
    }
  }

  const typo = getDidYouMeanSuggestion(clean);
  if (typo && typo !== clean) {
    return {
      isTransliterated: false,
      matchedPhrase: clean,
      suggestedTerm: typo,
    };
  }

  return null;
};
