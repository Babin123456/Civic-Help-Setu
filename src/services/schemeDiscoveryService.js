import { MOCK_SERVICES } from '../data/services.js';
import {
  CIVIC_SYNONYMS,
  CIVIC_PHONETIC_TRANSLITERATIONS,
  calculateServiceRelevance,
} from './searchRankingEngine.js';

export const DISCOVERY_DISCLAIMER =
  'Discovery Disclaimer: These suggestions are based on matching your description to published service information. They are not an eligibility determination. Always verify details on the official service page before applying.';

const NEED_KEYWORDS = {
  education_support: [
    'education', 'school', 'college', 'study', 'student', 'scholarship', 'fee', 'fees',
    'tuition', 'books', 'uniform', 'hostel', 'degree', 'course', 'training', 'skill',
    'vocational', 'learn', 'learning', 'academic', 'exam', 'examination', 'admission',
    'enrollment', 'mid day meal', 'mid-day meal', 'textbook', 'stationery',
  ],
  certificates: [
    'certificate', 'certificates', 'certify', 'proof', 'document', 'identity', 'id',
    'birth', 'death', 'marriage', 'caste', 'income', 'domicile', 'residence', 'address',
    'age', 'disability', 'bonafide', 'character', 'transfer', 'migration', 'legal heir',
  ],
  pensions: [
    'pension', 'old age', 'senior citizen', 'retirement', 'elderly', 'widow', 'widower',
    'disability pension', 'survivor', 'family pension', 'provident fund', 'pf', 'epf',
    'gratuity', 'annuity', 'superannuation',
  ],
  livelihood: [
    'job', 'employment', 'work', 'livelihood', 'income', 'earning', 'business', 'startup',
    'enterprise', 'msme', 'udyam', 'self employed', 'freelance', 'skill development',
    'training', 'apprenticeship', 'loan', 'credit', 'mudra', 'subsidy', 'grant',
    'entrepreneur', 'shop', 'factory', 'manufacturing', 'service', 'agriculture', 'farming',
    'farmer', 'kisan', 'crop', 'land', 'tractor', 'equipment', 'seed', 'fertilizer',
  ],
  healthcare: [
    'health', 'medical', 'hospital', 'doctor', 'treatment', 'medicine', 'surgery',
    'insurance', 'ayushman', 'bharat', 'pmjay', 'cghs', 'esic', 'maternity', 'pregnancy',
    'child', 'vaccination', 'immunization', 'disability', 'rehabilitation', 'therapy',
    'dental', 'vision', 'eye', 'hearing', 'mental', 'counseling',
  ],
  housing: [
    'house', 'housing', 'home', 'property', 'land', 'plot', 'construction', 'building',
    'pmay', 'pradhan mantri awas', 'slum', 'rehabilitation', 'rent', 'tenant', 'owner',
    'mutation', 'patta', 'khata', 'encumbrance', 'title', 'deed', 'registry',
  ],
  social_welfare: [
    'ration', 'food', 'subsidy', 'bpl', 'apl', 'pds', 'fair price', 'shop', 'kerosene',
    'sugar', 'wheat', 'rice', 'pulse', 'widow', 'destitute', 'orphan', 'abandoned',
    'beggar', 'homeless', 'shelter', 'night shelter', 'old age home', 'ngo',
  ],
  transport: [
    'driving', 'license', 'dl', 'vehicle', 'car', 'bike', 'motor', 'rto', 'registration',
    'rc', 'permit', 'fitness', 'pollution', 'puc', 'insurance', 'challan', 'fine',
    'parking', 'road', 'highway', 'toll', 'fastag',
  ],
  identity: [
    'aadhaar', 'uidai', 'pan', 'voter', 'epic', 'passport', 'identity', 'id card',
    'biometric', 'enrollment', 'update', 'correction', 'link', 'linking', 'kyc',
  ],
  grievance: [
    'complaint', 'grievance', 'problem', 'issue', 'corruption', 'bribe', 'harassment',
    'delay', 'denied', 'refused', 'officer', 'department', 'ministry', 'cpgrams',
    'rti', 'right to information', 'appeal', 'justice', 'court', 'legal', 'lawyer',
  ],
  utilities: [
    'electricity', 'power', 'water', 'gas', 'connection', 'meter', 'bill', 'billing',
    'subsidy', 'connection', 'disconnection', 'reconnection', 'fault', 'complaint',
    'municipal', 'panchayat', 'corporation', 'sewage', 'drainage', 'garbage', 'waste',
  ],
};

const SERVICE_TAGS = {
  'birth-certificate': ['certificates', 'identity'],
  'aadhaar-card': ['identity', 'certificates'],
  'driving-license': ['transport', 'identity'],
  'pan-card': ['identity', 'certificates'],
  'voter-id': ['identity', 'certificates'],
  'passport': ['identity', 'travel'],
  'ration-card': ['social_welfare', 'certificates'],
  'income-certificate': ['certificates', 'social_welfare', 'education_support'],
  'pf-withdrawal': ['pensions', 'livelihood'],
  'public-grievance': ['grievance'],
  'udyam-registration': ['livelihood', 'business'],
  'pm-kisan': ['livelihood', 'agriculture', 'pensions'],
};

export function extractKeywordsFromQuery(query) {
  const clean = query.toLowerCase().trim();
  const tokens = clean.split(/[\s,.;:!?]+/).filter((t) => t.length > 2);

  const matchedCategories = new Set();
  const primaryCategories = new Set(); // From phrase matches
  const matchedSynonyms = new Map();

  // Check for multi-word phrases first - these are strong signals
  for (const [category, keywords] of Object.entries(NEED_KEYWORDS)) {
    for (const kw of keywords) {
      if (kw.includes(' ') && clean.includes(kw)) {
        matchedCategories.add(category);
        primaryCategories.add(category);
      }
    }
  }

  // Civic intent indicators - queries with these are more likely to be civic needs
  const civicIntentWords = ['need', 'help', 'support', 'apply', 'get', 'obtain', 'scheme', 'benefit', 'assistance', 'aid', 'subsidy', 'grant', 'pension', 'certificate', 'card', 'registration', 'enrollment', 'service', 'government', 'govt', 'public', 'official', 'document', 'proof', 'identity', 'eligible', 'eligibility', 'requirement', 'procedure', 'process', 'how to', 'where to', 'want to apply', 'looking for', 'searching for'];

  // Commercial intent patterns - these override civic intent
  const commercialPatterns = [
    'want to buy',
    'want to purchase',
    'looking to buy',
    'looking to purchase',
    'where to buy',
    'where can i buy',
    'price of',
    'cost of',
    'buy a',
    'purchase a',
    'shop for',
    'order a',
    'book a',
  ];

  const hasCivicIntentWords = civicIntentWords.some((word) => clean.includes(word));
  const hasCommercialPattern = commercialPatterns.some((pattern) => clean.includes(pattern));

  // Check for transliteration matches (indicates civic intent in local language)
  let hasTransliterationMatch = false;
  for (const token of tokens) {
    for (const transKey of Object.keys(CIVIC_PHONETIC_TRANSLITERATIONS)) {
      if (token.includes(transKey)) {
        hasTransliterationMatch = true;
        break;
      }
    }
    if (hasTransliterationMatch) break;
  }

  // If commercial pattern detected, don't treat as civic query
  // But transliteration matches indicate civic intent even without English civic words
  const isCivicQuery = (hasCivicIntentWords || hasTransliterationMatch) && !hasCommercialPattern;

  for (const token of tokens) {
    // Only add categories if this is a civic query
    if (isCivicQuery) {
      for (const [category, keywords] of Object.entries(NEED_KEYWORDS)) {
        if (keywords.some((kw) => kw === token || token.includes(kw))) {
          matchedCategories.add(category);
          // Don't add to primaryCategories - these are token matches, weaker signals
        }
      }
    }

    if (CIVIC_SYNONYMS[token]) {
      matchedSynonyms.set(token, CIVIC_SYNONYMS[token]);
    }

    for (const [transKey, canonicals] of Object.entries(CIVIC_PHONETIC_TRANSLITERATIONS)) {
      if (token.includes(transKey)) {
        matchedSynonyms.set(transKey, canonicals);
      }
    }
  }

  return {
    tokens,
    matchedCategories: [...matchedCategories],
    primaryCategories: [...primaryCategories],
    matchedSynonyms: Object.fromEntries(matchedSynonyms),
    hasCivicIntent: isCivicQuery,
  };
}

export function calculateNeedAlignmentScore(service, extracted) {
  const tags = SERVICE_TAGS[service.id] || [];
  let score = 0;
  const reasons = [];

  const primaryCategories = extracted.primaryCategories || [];

  // Primary categories (from phrase matches) get higher weight
  for (const category of primaryCategories) {
    if (tags.includes(category)) {
      score += 50;
      reasons.push(`Strongly matches your mentioned need for ${category.replace('_', ' ')}`);
    }
  }

  // Secondary categories (from token matches) get lower weight
  const secondaryCategories = (extracted.matchedCategories || []).filter((c) => !primaryCategories.includes(c));
  for (const category of secondaryCategories) {
    if (tags.includes(category)) {
      score += 15;
      reasons.push(`Matches your mentioned need for ${category.replace('_', ' ')}`);
    }
  }

  const serviceText = [
    service.name,
    service.shortDescription,
    service.category,
    service.department,
    ...(service.documents || []),
    ...(service.eligibility || []),
  ].join(' ').toLowerCase();

  for (const token of extracted.tokens) {
    if (token.length >= 3 && serviceText.includes(token)) {
      score += 5;
      const field = findMatchingField(service, token);
      if (field) {
        reasons.push(`Keyword "${token}" found in ${field}`);
      }
    }
  }

  for (const [synKey, synonyms] of Object.entries(extracted.matchedSynonyms)) {
    for (const syn of synonyms) {
      if (serviceText.includes(syn.toLowerCase())) {
        score += 10;
        reasons.push(`Synonym "${synKey}" → "${syn}" matches service ${fieldLabel(service, syn)}`);
      }
    }
  }

  return { score: Math.min(score, 100), reasons: [...new Set(reasons)] };
}

export function findMatchingField(service, token) {
  const fields = {
    name: service.name,
    description: service.shortDescription,
    category: service.category,
    department: service.department,
    documents: service.documents || [],
    eligibility: service.eligibility || [],
  };

  for (const [field, value] of Object.entries(fields)) {
    const text = Array.isArray(value) ? value.join(' ') : value;
    if (text.toLowerCase().includes(token)) {
      return field;
    }
  }
  return null;
}

export function fieldLabel(service, keyword) {
  const fields = {
    name: service.name,
    description: service.shortDescription,
    category: service.category,
    department: service.department,
  };

  for (const [field, value] of Object.entries(fields)) {
    if (value.toLowerCase().includes(keyword.toLowerCase())) {
      return field;
    }
  }
  const docs = (service.documents || []).find((d) => d.toLowerCase().includes(keyword.toLowerCase()));
  if (docs) return `documents: "${docs}"`;
  const elig = (service.eligibility || []).find((e) => e.toLowerCase().includes(keyword.toLowerCase()));
  if (elig) return `eligibility: "${elig}"`;
  return 'service details';
}

export function generateSourceGroundedReason(service, alignment, extracted) {
  const parts = [];

  if (alignment.reasons.length > 0) {
    parts.push(alignment.reasons.slice(0, 3).join('; '));
  }

  const relevance = calculateServiceRelevance(service, extracted.tokens.join(' '));
  if (relevance > 0) {
    parts.push(`Search relevance score: ${relevance}`);
  }

  const reason = parts.length > 0
    ? parts.join('. ')
    : `This service (${service.name}) was suggested based on general relevance to your query.`;

  return `${reason}. Source: ${service.officialSources?.[0]?.name || 'Official government portal'} (${service.officialSources?.[0]?.url || 'N/A'})`;
}

export function discoverSchemes(query, options = {}) {
  const {
    services = MOCK_SERVICES,
    limit = 5,
    minScore = 5,
  } = options;

  if (!query || !query.trim()) {
    return {
      results: [],
      query: '',
      message: 'Please describe what you need help with (e.g., "I need financial help for my child\'s education" or "I\'m a farmer looking for government support")',
      suggestion: 'Try the catalogue search or ask the assistant for guidance.',
    };
  }

  const extracted = extractKeywordsFromQuery(query);

  // If no civic intent detected and no matched categories, return empty with guidance
  if (!extracted.hasCivicIntent && extracted.matchedCategories.length === 0) {
    return {
      results: [],
      query,
      extracted,
      message: 'No matching schemes found for your description.',
      suggestion: 'Try the catalogue search with different keywords, or ask the assistant for guidance.',
      disclaimer: DISCOVERY_DISCLAIMER,
    };
  }

  const scored = services.map((service) => {
    const alignment = calculateNeedAlignmentScore(service, extracted);
    const relevance = calculateServiceRelevance(service, query);
    const combinedScore = Math.max(alignment.score, relevance);

    if (combinedScore < minScore) return null;

    return {
      service,
      score: combinedScore,
      alignment,
      relevance,
    };
  }).filter(Boolean);

  scored.sort((a, b) => b.score - a.score || b.relevance - a.relevance);

  const topResults = scored.slice(0, limit).map(({ service, score, alignment }) => ({
    id: service.id,
    name: service.name,
    shortDescription: service.shortDescription,
    category: service.category,
    department: service.department,
    type: service.type,
    difficulty: service.difficulty,
    feeType: service.feeType,
    fees: service.fees,
    processingTime: service.processingTime,
    eligibility: service.eligibility,
    documents: service.documents,
    steps: service.steps,
    officialSources: service.officialSources,
    warnings: service.warnings,
    lastVerified: service.lastVerified,
    matchScore: score,
    reason: generateSourceGroundedReason(service, alignment, extracted),
    disclaimer: DISCOVERY_DISCLAIMER,
  }));

  if (topResults.length === 0) {
    return {
      results: [],
      query,
      extracted,
      message: 'No matching schemes found for your description.',
      suggestion: 'Try the catalogue search with different keywords, or ask the assistant for guidance.',
      disclaimer: DISCOVERY_DISCLAIMER,
    };
  }

  return {
    results: topResults,
    query,
    extracted,
    disclaimer: DISCOVERY_DISCLAIMER,
  };
}

export function getCatalogueSearchFallback(query) {
  return {
    message: 'No direct matches found.',
    suggestion: 'You can search the full catalogue or try rephrasing your need.',
    searchQuery: query,
  };
}