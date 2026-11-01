/**
 * Saved Service Recommendations Service
 *
 * Suggests relevant catalogue services based on a citizen's bookmarked services.
 *
 * Rules:
 * 1. Only explain relationships as "often needed before / after this service"
 *    when supported by curated data.
 * 2. Otherwise use neutral wording such as "similar category" or "same department".
 * 3. Never infer a legal prerequisite from semantic similarity alone.
 * 4. Never recommend services the user has already saved.
 * 5. Let users dismiss recommendations (persisted locally).
 * 6. Return empty recommendations when evidence is insufficient or records are incomplete.
 */

export const RECOMMENDATION_DISMISSALS_KEY = 'civicbridge_dismissed_recommendations';

/**
 * Curated, verified administrative prerequisite and sequence relationships
 */
export const CURATED_SERVICE_RELATIONSHIPS = {
  'birth-certificate': {
    enables: ['aadhaar-card', 'passport-seva'],
    reason: 'Birth Certificate is an official document of age and parentage often needed for Aadhaar enrollment and Passport issuance.'
  },
  'aadhaar-card': {
    enables: ['pan-card', 'pm-kisan', 'ration-card', 'ayushman-bharat'],
    reason: 'Aadhaar identity e-KYC is mandatory for PAN allocation and welfare subsidy disbursement.'
  },
  'caste-certificate': {
    enables: ['non-creamy-layer-certificate', 'scholarship-post-matric'],
    reason: 'Caste Certificate is a mandatory prerequisite for Non-Creamy Layer verification and reserved category scholarships.'
  },
  'income-certificate': {
    enables: ['ration-card', 'scholarship-post-matric', 'ayushman-bharat', 'disability-pension'],
    reason: 'Income Certificate establishes economic status required to verify means-tested welfare thresholds.'
  },
  'driving-license': {
    enables: ['commercial-driving-permit', 'international-driving-permit'],
    reason: 'A valid permanent Driving License is legally required before applying for commercial or international endorsements.'
  }
};

/**
 * Reads dismissed recommendation IDs from localStorage.
 */
export function getDismissedRecommendations() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECOMMENDATION_DISMISSALS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Dismisses a recommendation for a specific service ID.
 */
export function dismissRecommendation(serviceId) {
  if (!serviceId || typeof localStorage === 'undefined') return;
  try {
    const current = getDismissedRecommendations();
    if (!current.includes(serviceId)) {
      localStorage.setItem(RECOMMENDATION_DISMISSALS_KEY, JSON.stringify([...current, serviceId]));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Restores a previously dismissed recommendation ID.
 */
export function restoreRecommendation(serviceId) {
  if (!serviceId || typeof localStorage === 'undefined') return;
  try {
    const current = getDismissedRecommendations();
    const updated = current.filter((id) => id !== serviceId);
    localStorage.setItem(RECOMMENDATION_DISMISSALS_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
}

/**
 * Clears all recommendation dismissals.
 */
export function clearDismissedRecommendations() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(RECOMMENDATION_DISMISSALS_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Evaluates saved services against the catalogue and returns evidence-grounded recommendations.
 *
 * @param {Array} savedServices List of service objects currently saved by user
 * @param {Array} catalogueServices Full collection of catalogue services
 * @param {Object} [options]
 * @param {boolean} [options.includeDismissed=false]
 * @param {number} [options.limit=4]
 * @returns {Array} List of recommended service objects with relationship explanations
 */
export function getRelatedServiceRecommendations(savedServices = [], catalogueServices = [], options = {}) {
  if (!Array.isArray(savedServices) || !Array.isArray(catalogueServices)) return [];
  if (savedServices.length === 0 || catalogueServices.length === 0) return [];

  const limit = options.limit || 4;
  const dismissed = options.includeDismissed ? [] : getDismissedRecommendations();
  const savedIds = new Set(savedServices.map((s) => s.id));

  const candidatesMap = new Map();

  for (const saved of savedServices) {
    if (!saved || !saved.id) continue;

    // 1. Check Curated Prerequisite / Follow-up relationships
    // A enables B (B is often needed after A)
    const curatedForward = CURATED_SERVICE_RELATIONSHIPS[saved.id];
    if (curatedForward && Array.isArray(curatedForward.enables)) {
      for (const targetId of curatedForward.enables) {
        if (!savedIds.has(targetId) && !dismissed.includes(targetId)) {
          const match = catalogueServices.find((s) => s.id === targetId);
          if (match) {
            candidatesMap.set(targetId, {
              service: match,
              relationshipType: 'curated_sequence',
              relationshipLabel: `Often needed after ${saved.name || 'this service'}`,
              explanation: curatedForward.reason,
              evidenceGrounding: 'curated_rule',
              weight: 100
            });
          }
        }
      }
    }

    // B enables A (B is often needed before A)
    for (const [providerId, rule] of Object.entries(CURATED_SERVICE_RELATIONSHIPS)) {
      if (rule.enables.includes(saved.id) && !savedIds.has(providerId) && !dismissed.includes(providerId)) {
        const match = catalogueServices.find((s) => s.id === providerId);
        if (match) {
          candidatesMap.set(providerId, {
            service: match,
            relationshipType: 'curated_prerequisite',
            relationshipLabel: `Often needed before ${saved.name || 'this service'}`,
            explanation: rule.reason,
            evidenceGrounding: 'curated_rule',
            weight: 90
          });
        }
      }
    }
  }

  // 2. Shared Category & Department synergy (only when curated matches haven't filled limit)
  if (candidatesMap.size < limit) {
    for (const saved of savedServices) {
      if (!saved || !saved.category) continue;

      for (const candidate of catalogueServices) {
        if (!candidate || !candidate.id) continue;
        if (savedIds.has(candidate.id) || dismissed.includes(candidate.id) || candidatesMap.has(candidate.id)) {
          continue;
        }

        // Both must have valid category and department metadata (incomplete records are skipped)
        if (!candidate.category || !candidate.department || !saved.department) {
          continue;
        }

        const sameDept = candidate.department.toLowerCase() === saved.department.toLowerCase();
        const sameCategory = candidate.category.toLowerCase() === saved.category.toLowerCase();

        if (sameDept && sameCategory) {
          candidatesMap.set(candidate.id, {
            service: candidate,
            relationshipType: 'category_synergy',
            relationshipLabel: 'Similar Category & Department',
            explanation: `Shares both the ${candidate.category} classification and administration under ${candidate.department}.`,
            evidenceGrounding: 'metadata',
            weight: 50
          });
        } else if (sameCategory) {
          candidatesMap.set(candidate.id, {
            service: candidate,
            relationshipType: 'similar_category',
            relationshipLabel: 'Similar Category',
            explanation: `Both services relate to ${candidate.category} civic procedures.`,
            evidenceGrounding: 'metadata',
            weight: 30
          });
        }
      }
    }
  }

  const sortedCandidates = Array.from(candidatesMap.values()).sort((a, b) => b.weight - a.weight);
  return sortedCandidates.slice(0, limit);
}
