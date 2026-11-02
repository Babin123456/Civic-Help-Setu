/**
 * Indic Phonetic Transliteration & Colloquial Query Engine (#435)
 *
 * Expands citizen search queries using Indic phonetic transformations,
 * Soundex hashing tailored to South Asian phonology (e.g. aa/a, ee/i, kh/k, bh/b),
 * and a curated colloquial civic lexicon mapping vernacular Hindi/Indic terms
 * (e.g. 'dakhil kharij', 'khatoni', 'praman patra', 'aay', 'jaati', 'niwas', 'vriddha')
 * to standard government catalogue services.
 */

/**
 * Curated Colloquial & Vernacular Indic Civic Lexicon.
 * Maps common citizen colloquialisms to formal government service names & keywords.
 */
export const INDIC_CIVIC_COLLOQUIAL_LEXICON = Object.freeze([
  {
    colloquial: 'dakhil kharij',
    canonical: 'property tax mutation',
    category: 'Revenue & Land',
    explanation: 'Dakhil Kharij is the Hindi term for property mutation in land records.',
  },
  {
    colloquial: 'khatoni',
    canonical: 'land revenue record',
    category: 'Revenue & Land',
    explanation: 'Khatoni is the record of land rights (RoR) issued by revenue authorities.',
  },
  {
    colloquial: 'khasra',
    canonical: 'land parcel revenue map',
    category: 'Revenue & Land',
    explanation: 'Khasra denotes the unique survey number and plot record of agricultural land.',
  },
  {
    colloquial: 'praman patra',
    canonical: 'certificate',
    category: 'General Certificates',
    explanation: 'Praman Patra is the standard Hindi term for an official government certificate.',
  },
  {
    colloquial: 'pramanpatra',
    canonical: 'certificate',
    category: 'General Certificates',
    explanation: 'Pramanpatra denotes official certificate.',
  },
  {
    colloquial: 'aay praman patra',
    canonical: 'income certificate',
    category: 'Revenue & Social Welfare',
    explanation: 'Aay Praman Patra refers to the statutory Income Certificate.',
  },
  {
    colloquial: 'jaati praman patra',
    canonical: 'caste certificate',
    category: 'Social Justice',
    explanation: 'Jaati Praman Patra refers to the SC/ST/OBC Community/Caste Certificate.',
  },
  {
    colloquial: 'niwas praman patra',
    canonical: 'domicile certificate',
    category: 'Revenue & Administration',
    explanation: 'Niwas or Mool Niwas Praman Patra refers to the Domicile / Residence Certificate.',
  },
  {
    colloquial: 'mool niwas',
    canonical: 'domicile certificate',
    category: 'Revenue & Administration',
    explanation: 'Mool Niwas refers to permanent domicile.',
  },
  {
    colloquial: 'pehchan patra',
    canonical: 'voter id card',
    category: 'Elections',
    explanation: 'Pehchan Patra is colloquial for Electoral Photo Identity Card (EPIC / Voter ID).',
  },
  {
    colloquial: 'vriddha pension',
    canonical: 'old age senior citizen pension',
    category: 'Social Welfare',
    explanation: 'Vriddha Pension refers to national/state Old Age Senior Citizen Pensions.',
  },
  {
    colloquial: 'divyang',
    canonical: 'disability certificate udid',
    category: 'Social Welfare',
    explanation: 'Divyang / Divyangjan refers to Persons with Disabilities under RPwD Act.',
  },
  {
    colloquial: 'viklang',
    canonical: 'disability certificate udid',
    category: 'Social Welfare',
    explanation: 'Viklang is the older colloquial term for Persons with Disabilities.',
  },
  {
    colloquial: 'rashan',
    canonical: 'ration card food subsidy',
    category: 'Civil Supplies',
    explanation: 'Rashan / Rashan Card refers to PDS subsidized food rationing cards.',
  },
  {
    colloquial: 'ayushmaan',
    canonical: 'ayushman bharat health card',
    category: 'Healthcare',
    explanation: 'Ayushman / Ayushmaan Card refers to PM-JAY health insurance.',
  },
  {
    colloquial: 'parivahan',
    canonical: 'driving license vehicle rto',
    category: 'Transport',
    explanation: 'Parivahan refers to the Ministry of Road Transport and Highways services.',
  },
  {
    colloquial: 'nakal',
    canonical: 'certified copy record',
    category: 'Revenue & Judiciary',
    explanation: 'Nakal refers to an official certified copy of public or court records.',
  },
]);

/**
 * Normalizes phonetic variants characteristic of Indic/Hinglish spellings:
 * - Collapses long vowels (aa -> a, ee -> i, oo -> u)
 * - Harmonizes aspirated consonants (kh -> k, gh -> g, ch/chh -> c, jh -> j, th/dh -> t/d, ph/bh -> f/b)
 * - Harmonizes sibilants (sh/zh -> s)
 * - Harmonizes w and v
 * @param {string} text
 * @returns {string} Invariant phonetic string
 */
export function normalizeIndicPhonetic(text) {
  if (!text) return '';
  let str = String(text).toLowerCase().trim();

  // Whitespace & punctuation collapsing
  str = str.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');

  // Vowel simplifications
  str = str.replace(/aa+/g, 'a');
  str = str.replace(/ee+/g, 'i');
  str = str.replace(/ii+/g, 'i');
  str = str.replace(/oo+/g, 'u');
  str = str.replace(/uu+/g, 'u');
  str = str.replace(/ai/g, 'e');
  str = str.replace(/au/g, 'o');

  // Consonant clusters
  str = str.replace(/kh/g, 'k');
  str = str.replace(/gh/g, 'g');
  str = str.replace(/chh/g, 'ch');
  str = str.replace(/jh/g, 'j');
  str = str.replace(/th/g, 't');
  str = str.replace(/dh/g, 'd');
  str = str.replace(/bh/g, 'b');
  str = str.replace(/ph/g, 'f');
  str = str.replace(/sh/g, 's');
  str = str.replace(/zh/g, 's');
  str = str.replace(/w/g, 'v');

  // Double consonants
  str = str.replace(/([b-df-hj-np-tv-z])\1+/g, '$1');

  return str.trim();
}

/**
 * Generates an Indic Soundex code for coarse phonetic bucket indexing.
 * @param {string} word
 * @returns {string} 5-character soundex hash
 */
export function computeIndicSoundex(word) {
  const norm = normalizeIndicPhonetic(word);
  if (!norm) return '00000';

  const firstLetter = norm.charAt(0).toUpperCase();
  const rest = norm.slice(1);

  // Phonetic soundex groups for Indic phonemes
  const soundexMap = {
    b: '1', p: '1', f: '1', v: '1',
    c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
    d: '3', t: '3',
    l: '4',
    m: '5', n: '5',
    r: '6',
  };

  let code = firstLetter;
  let prevCode = soundexMap[firstLetter.toLowerCase()] || '0';

  for (let i = 0; i < rest.length && code.length < 5; i++) {
    const char = rest.charAt(i);
    const currCode = soundexMap[char];

    if (currCode && currCode !== prevCode) {
      code += currCode;
      prevCode = currCode;
    } else if (!currCode) {
      prevCode = '0'; // vowel separates duplicate codes
    }
  }

  while (code.length < 5) {
    code += '0';
  }

  return code;
}

/**
 * Resolves a citizen query by identifying colloquial lexicon matches
 * and generating canonical expansion keywords.
 * @param {string} query
 * @returns {Object} Resolution details
 */
export function resolveIndicCivicQuery(query = '') {
  const raw = String(query || '').toLowerCase().trim();
  const normalized = normalizeIndicPhonetic(raw);

  const matchedEntries = [];
  const expandedKeywords = new Set();

  const sortedLexicon = [...INDIC_CIVIC_COLLOQUIAL_LEXICON].sort(
    (a, b) => b.colloquial.length - a.colloquial.length
  );
  sortedLexicon.forEach((entry) => {
    const colloquialNorm = normalizeIndicPhonetic(entry.colloquial);
    const rawMatches = raw.includes(entry.colloquial);
    const normMatches = normalized.includes(colloquialNorm);

    if (rawMatches || normMatches) {
      matchedEntries.push(entry);
      entry.canonical.split(/\s+/).forEach((word) => expandedKeywords.add(word));
    }
  });

  return {
    originalQuery: raw,
    phoneticNormalized: normalized,
    matchedEntries,
    expandedKeywords: Array.from(expandedKeywords),
    hasIndicMatch: matchedEntries.length > 0,
  };
}

/**
 * Calculates phonetic similarity score (0 to 100) between query and target text.
 * @param {string} query
 * @param {string} targetText
 * @returns {number} Score between 0 and 100
 */
export function calculatePhoneticMatchScore(query, targetText) {
  if (!query || !targetText) return 0;

  const qNorm = normalizeIndicPhonetic(query);
  const tNorm = normalizeIndicPhonetic(targetText);

  // Exact phonetic match
  if (qNorm === tNorm || tNorm.includes(qNorm)) {
    return 95;
  }

  // Token level phonetic matching
  const qTokens = qNorm.split(/\s+/).filter((t) => t.length > 2);
  const tTokens = tNorm.split(/\s+/).filter((t) => t.length > 2);

  if (qTokens.length === 0 || tTokens.length === 0) return 0;

  let totalMatches = 0;
  qTokens.forEach((qTok) => {
    const qSoundex = computeIndicSoundex(qTok);
    const matched = tTokens.some((tTok) => {
      if (tTok.includes(qTok) || qTok.includes(tTok)) return true;
      return computeIndicSoundex(tTok) === qSoundex;
    });

    if (matched) totalMatches += 1;
  });

  const ratio = totalMatches / qTokens.length;
  return Math.round(ratio * 80);
}

/**
 * Generates an explainability rationale if an Indic colloquial match was triggered.
 * @param {string} query
 * @param {Object} service
 * @returns {string|null} Explainable match reason or null
 */
export function explainPhoneticMatch(query, service) {
  if (!query || !service) return null;

  const resolution = resolveIndicCivicQuery(query);
  if (!resolution.hasIndicMatch) return null;

  const serviceText = `${service.name || ''} ${service.category || ''} ${service.description || ''}`.toLowerCase();

  for (const entry of resolution.matchedEntries) {
    const canonicalTokens = entry.canonical.split(/\s+/);
    const hasCanonical = canonicalTokens.some((t) => serviceText.includes(t));

    if (hasCanonical) {
      return `Matched via Indic colloquial phrase "${entry.colloquial}" (${entry.explanation})`;
    }
  }

  return null;
}

export default {
  INDIC_CIVIC_COLLOQUIAL_LEXICON,
  normalizeIndicPhonetic,
  computeIndicSoundex,
  resolveIndicCivicQuery,
  calculatePhoneticMatchScore,
  explainPhoneticMatch,
};
