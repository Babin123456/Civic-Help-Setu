/**
 * Duplicate and Near-Duplicate Civic-Service Detection Service (#397)
 * 
 * Compares new or draft service submissions against existing catalogue records
 * using multi-field text similarity (title, department, jurisdiction, description, official URL).
 * 
 * Safety & Governance:
 * - Surfaces duplicate candidates side-by-side with similarity reasons and field diffs.
 * - NEVER deletes or merges records automatically without explicit administrator action.
 * - Supports configurable similarity thresholds.
 * - Persists administrator review decisions (PENDING, CONFIRMED_DUPLICATE, MARKED_DISTINCT).
 */

export const DUPLICATE_STORAGE_KEY = 'civicbridge_duplicate_review_states';
export const DEFAULT_SIMILARITY_THRESHOLD = 0.60;

export const REVIEW_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED_DUPLICATE: 'CONFIRMED_DUPLICATE',
  MARKED_DISTINCT: 'MARKED_DISTINCT',
};

let inMemoryStore = {};

const getStorage = () => {
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
};

const STOP_WORDS = new Set([
  'and', 'or', 'the', 'of', 'in', 'for', 'to', 'a', 'an', 'at', 'by', 'is', 'on', 'with', 'from', 'as'
]);

/**
 * Tokenize and normalize text into a set of lower-case distinct words
 */
export const tokenize = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
};

/**
 * Calculate Jaccard similarity between two token arrays
 */
export const calculateTokenOverlap = (tokensA, tokensB) => {
  if (!tokensA.length && !tokensB.length) return 1.0;
  if (!tokensA.length || !tokensB.length) return 0.0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;

  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }

  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : Number((intersection / union).toFixed(3));
};

/**
 * Calculate Levenshtein distance-based string similarity
 */
export const calculateStringSimilarity = (strA, strB) => {
  if (!strA && !strB) return 1.0;
  if (!strA || !strB) return 0.0;

  const s1 = strA.trim().toLowerCase();
  const s2 = strB.trim().toLowerCase();
  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;
  const maxLen = Math.max(len1, len2);
  if (maxLen === 0) return 1.0;

  const matrix = Array.from({ length: len1 + 1 }, () => new Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[len1][len2];
  return Number((1 - distance / maxLen).toFixed(3));
};

/**
 * Clean and compare official URLs
 */
export const compareUrls = (urlA, urlB) => {
  if (!urlA || !urlB) return 0.0;
  try {
    const parsedA = new URL(urlA);
    const parsedB = new URL(urlB);

    if (parsedA.hostname === parsedB.hostname) {
      if (parsedA.pathname === parsedB.pathname) return 1.0;
      return 0.7; // Same domain/portal
    }
    return 0.0;
  } catch {
    return urlA.trim().toLowerCase() === urlB.trim().toLowerCase() ? 1.0 : 0.0;
  }
};

/**
 * Compute multi-field similarity between two service records
 */
export const computeServiceSimilarity = (serviceA, serviceB) => {
  if (!serviceA || !serviceB) {
    return { score: 0, matchedFields: [], differingFields: [], breakdown: {}, reasons: [] };
  }

  // 1. Title Similarity (Weight 40%)
  const titleA = serviceA.title || serviceA.name || '';
  const titleB = serviceB.title || serviceB.name || '';
  const titleTokensA = tokenize(titleA);
  const titleTokensB = tokenize(titleB);
  const titleOverlap = calculateTokenOverlap(titleTokensA, titleTokensB);
  const titleLev = calculateStringSimilarity(titleA, titleB);
  
  // Substring bonus if one title contains the other's main words
  const isSubstring = titleA.toLowerCase().includes(titleB.toLowerCase()) || 
                      titleB.toLowerCase().includes(titleA.toLowerCase());
  const titleScore = Math.max(titleOverlap, titleLev, isSubstring ? 0.75 : 0.0);

  // 2. Department Similarity (Weight 20%)
  const deptA = (serviceA.department || serviceA.dept || '').trim().toLowerCase();
  const deptB = (serviceB.department || serviceB.dept || '').trim().toLowerCase();
  let deptScore = 0.0;
  if (deptA && deptB) {
    if (deptA === deptB) deptScore = 1.0;
    else deptScore = calculateTokenOverlap(tokenize(deptA), tokenize(deptB));
  }

  // 3. Jurisdiction Match (Weight 15%)
  const jurA = (serviceA.jurisdiction || serviceA.state || 'National').trim().toLowerCase();
  const jurB = (serviceB.jurisdiction || serviceB.state || 'National').trim().toLowerCase();
  const jurScore = (jurA === jurB) ? 1.0 : 0.0;

  // 4. Description Similarity (Weight 15%)
  const descTokensA = tokenize(serviceA.description || serviceA.summary);
  const descTokensB = tokenize(serviceB.description || serviceB.summary);
  const descScore = calculateTokenOverlap(descTokensA, descTokensB);

  // 5. Official URL Similarity (Weight 10%)
  const urlScore = compareUrls(
    serviceA.officialUrl || serviceA.url || serviceA.portalUrl,
    serviceB.officialUrl || serviceB.url || serviceB.portalUrl
  );

  // Weighted aggregate score
  const totalScore = Number(
    (
      titleScore * 0.40 +
      deptScore * 0.20 +
      jurScore * 0.15 +
      descScore * 0.15 +
      urlScore * 0.10
    ).toFixed(3)
  );

  // Analyze matched and differing fields
  const matchedFields = [];
  const differingFields = [];
  const reasons = [];

  // Title analysis
  if (titleScore >= 0.50) {
    matchedFields.push('title');
    reasons.push(titleScore === 1.0 ? 'Identical service title' : `Substantial title word overlap (${Math.round(titleScore * 100)}%)`);
  } else {
    differingFields.push('title');
  }

  // Department analysis
  if (deptScore >= 0.60) {
    matchedFields.push('department');
    reasons.push('Offered by the same or closely related governing department');
  } else if (deptA || deptB) {
    differingFields.push('department');
  }

  // Jurisdiction analysis
  if (jurScore === 1.0) {
    matchedFields.push('jurisdiction');
    reasons.push(`Covers the same jurisdiction (${jurA.toUpperCase()})`);
  } else {
    differingFields.push('jurisdiction');
    reasons.push(`Differing jurisdictions: "${jurA}" vs "${jurB}"`);
  }

  // Official URL analysis
  if (urlScore >= 0.60) {
    matchedFields.push('officialUrl');
    reasons.push(urlScore === 1.0 ? 'Points to identical official application URL' : 'Shares official department domain');
  } else if (serviceA.officialUrl || serviceB.officialUrl) {
    differingFields.push('officialUrl');
  }

  // Description analysis
  if (descScore >= 0.40) {
    matchedFields.push('description');
    reasons.push('Shared operational guidelines and description text');
  } else if (descTokensA.length > 0 || descTokensB.length > 0) {
    differingFields.push('description');
  }

  let confidenceLevel = 'LOW';
  if (totalScore >= 0.70) confidenceLevel = 'HIGH';
  else if (totalScore >= 0.45) confidenceLevel = 'MEDIUM';

  return {
    score: totalScore,
    confidenceLevel,
    matchedFields,
    differingFields,
    breakdown: {
      title: titleScore,
      department: deptScore,
      jurisdiction: jurScore,
      description: descScore,
      officialUrl: urlScore,
    },
    reasons,
  };
};

/**
 * Generate a deterministic pair identifier for two services
 */
export const getPairId = (idA, idB) => {
  const [first, second] = [String(idA), String(idB)].sort();
  return `${first}___${second}`;
};

/**
 * Retrieve persisted admin review decisions from localStorage or memory store
 */
export const getReviewStates = () => {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(DUPLICATE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : inMemoryStore;
    } catch {
      return inMemoryStore;
    }
  }
  return inMemoryStore;
};

/**
 * Update the review decision for a service pair
 */
export const setPairReviewStatus = (pairId, status, notes = '', reviewer = 'Administrator') => {
  const payload = {
    status,
    notes,
    reviewer,
    updatedAt: new Date().toISOString(),
  };

  inMemoryStore[pairId] = payload;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(DUPLICATE_STORAGE_KEY, JSON.stringify(inMemoryStore));
    } catch {
      // fallback to inMemoryStore
    }
  }
  return true;
};

/**
 * Clear all review states (testing or reset purposes)
 */
export const clearReviewStates = () => {
  inMemoryStore = {};
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(DUPLICATE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
};

/**
 * Detect duplicate candidate pairs across a list of services
 */
export const findDuplicateCandidates = (services = [], options = {}) => {
  const {
    threshold = DEFAULT_SIMILARITY_THRESHOLD,
    statusFilter = 'ALL',
  } = options;

  if (!Array.isArray(services) || services.length < 2) return [];

  const reviewStates = getReviewStates();
  const candidates = [];

  for (let i = 0; i < services.length; i++) {
    for (let j = i + 1; j < services.length; j++) {
      const sA = services[i];
      const sB = services[j];
      if (!sA || !sB || sA.id === sB.id) continue;

      const similarity = computeServiceSimilarity(sA, sB);

      // Only evaluate pairs meeting or exceeding the configurable threshold
      if (similarity.score >= threshold) {
        const pairId = getPairId(sA.id, sB.id);
        const review = reviewStates[pairId] || { status: REVIEW_STATUS.PENDING };

        if (statusFilter === 'ALL' || review.status === statusFilter) {
          candidates.push({
            pairId,
            serviceA: sA,
            serviceB: sB,
            similarity,
            reviewStatus: review.status,
            reviewNotes: review.notes || '',
            reviewedBy: review.reviewer || null,
            reviewedAt: review.updatedAt || null,
          });
        }
      }
    }
  }

  // Sort by highest similarity score first
  return candidates.sort((a, b) => b.similarity.score - a.similarity.score);
};
