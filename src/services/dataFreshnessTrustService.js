import { requirePermission } from './accessControl';
/**
 * Civic Service Data Freshness and Trust Indicator Service
 * 
 * Provides an objective, formula-driven evaluation of service record quality,
 * freshness age, provenance, and completeness.
 * 
 * Key Principles:
 * 1. Missing data is NEVER treated as verified. Any omitted critical field explicitly lowers confidence.
 * 2. Clear non-guarantee: The score is an informational quality metric, NOT a government endorsement or warranty.
 * 3. Transparent contributing factors: Every score is deconstructed into Provenance (30 pts), Freshness (30 pts), and Completeness (40 pts).
 * 4. Stale record queueing: Automatically flags aging or incomplete records for manual maintainer verification.
 */

const STORAGE_KEY = 'civicbridge_freshness_trust_reviews_v1';

export const TRUST_DISCLAIMER =
  'The Data Freshness & Trust Indicator is an automated quality assessment by Civic Help Setu based on source documentation, catalog completeness, and review cadence. It does not constitute official government endorsement, verification, or statutory guarantee. Always verify procedural requirements with the designated public authority.';

export const TRUST_TIERS = {
  HIGH: {
    minScore: 85,
    label: 'High Freshness & Completeness',
    badgeColor: '#10b981',
    bgLight: 'rgba(16, 185, 129, 0.12)',
    description: 'Recent official source review and complete procedural breakdown.',
  },
  STANDARD: {
    minScore: 60,
    label: 'Standard Verification',
    badgeColor: '#38bdf8',
    bgLight: 'rgba(56, 189, 248, 0.12)',
    description: 'Verified with official sources, but may benefit from updated review or deeper step detail.',
  },
  NEEDS_CONFIRMATION: {
    minScore: 40,
    label: 'Needs Confirmation',
    badgeColor: '#f59e0b',
    bgLight: 'rgba(245, 158, 11, 0.12)',
    description: 'Missing key procedures, fee details, or unreviewed for an extended duration.',
  },
  STALE_OR_INCOMPLETE: {
    minScore: 0,
    label: 'Stale / Incomplete Record',
    badgeColor: '#ef4444',
    bgLight: 'rgba(239, 68, 68, 0.12)',
    description: 'Requires maintainer re-verification; critical fields or authentic sources are missing.',
  },
};

/**
 * Safe local storage resolver
 */
const getStorage = (customStorage) => {
  if (customStorage) return customStorage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

/**
 * Retrieves manual review overrides from local storage
 */
export const getServiceReviewOverrides = (customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

/**
 * Saves manual review overrides
 */
export const saveServiceReviewOverrides = (overrides, customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    return true;
  } catch {
    return false;
  }
};

/**
 * Records a maintainer review timestamp and notes for a service
 */
export const recordServiceReview = (serviceId, reviewer = 'Admin', notes = '', customStorage) => {
  requirePermission('freshness.review');
  if (!serviceId) throw new Error('Service ID is required to record a review.');

  const overrides = getServiceReviewOverrides(customStorage);
  const nowIso = new Date().toISOString();

  overrides[serviceId] = {
    lastReviewedAt: nowIso,
    reviewedBy: reviewer,
    notes: (notes || '').trim(),
    reviewHistory: [
      ...(overrides[serviceId]?.reviewHistory || []),
      { timestamp: nowIso, reviewer, notes: (notes || '').trim() },
    ],
  };

  saveServiceReviewOverrides(overrides, customStorage);
  return overrides[serviceId];
};

/**
 * Computes the data freshness and trust score for a service record
 * 
 * Score Formula (100 Maximum Points):
 * 1. Source Provenance (30 Points Max):
 *    - Official government domain (.gov.in, .nic.in): +20 pts
 *    - Secondary verified source URL present: +10 pts
 * 
 * 2. Review Cadence & Freshness Age (30 Points Max):
 *    - Reviewed within last 90 days: +30 pts
 *    - Reviewed 91 to 180 days ago: +20 pts
 *    - Reviewed 181 to 365 days ago: +10 pts
 *    - Over 365 days or never reviewed: 0 pts
 * 
 * 3. Procedural Completeness (40 Points Max):
 *    - Documents checklist present (non-empty): +10 pts
 *    - Step-by-step instructions present (>=2 steps): +10 pts
 *    - Explicit fee structure specified: +10 pts
 *    - Processing time turnaround specified: +5 pts
 *    - Eligibility criteria outlined: +5 pts
 */
export const calculateDataTrustScore = (service, customStorage) => {
  if (!service || typeof service !== 'object') {
    return {
      score: 0,
      tier: TRUST_TIERS.STALE_OR_INCOMPLETE,
      breakdown: { provenance: 0, freshness: 0, completeness: 0 },
      defects: ['Service record does not exist or has invalid schema.'],
      lastReviewedAt: null,
      reviewedBy: null,
      disclaimer: TRUST_DISCLAIMER,
    };
  }

  const overrides = getServiceReviewOverrides(customStorage);
  const serviceOverride = overrides[service.id] || null;

  // Determine effective last reviewed date
  const lastReviewedAt =
    serviceOverride?.lastReviewedAt ||
    service.lastReviewedAt ||
    service.lastVerified ||
    service.updatedAt ||
    null;

  const reviewedBy = serviceOverride?.reviewedBy || service.verifiedBy || 'Civic Help Setu Catalog';

  let provenanceScore = 0;
  let freshnessScore = 0;
  let completenessScore = 0;
  const defects = [];
  const positiveNotes = [];

  // --- 1. Provenance & Official Sources (30 pts max) ---
  const officialSources = Array.isArray(service.officialSources) ? service.officialSources : [];
  const sourceUrl = service.sourceUrl || service.officialWebsite || service.url || '';
  const allUrls = [sourceUrl, ...officialSources.map((s) => (typeof s === 'string' ? s : s?.url || ''))].filter(
    Boolean
  );

  const hasGovDomain = allUrls.some((u) => {
    try {
      const parsed = new URL(u.startsWith('http') ? u : `https://${u}`);
      const h = parsed.hostname.toLowerCase();
      return h === 'gov.in' || h.endsWith('.gov.in') || h === 'nic.in' || h.endsWith('.nic.in');
    } catch {
      return false;
    }
  });

  if (hasGovDomain) {
    provenanceScore += 20;
    positiveNotes.push('Backed by official government (.gov.in / .nic.in) digital portal.');
  } else {
    defects.push('No official government domain (.gov.in / .nic.in) linked.');
  }

  if (allUrls.length >= 2) {
    provenanceScore += 10;
    positiveNotes.push('Multiple authoritative reference sources cross-linked.');
  } else if (allUrls.length === 1 && !hasGovDomain) {
    provenanceScore += 5;
  } else if (allUrls.length === 0) {
    defects.push('No verifiable official source URLs attached.');
  }

  // --- 2. Freshness & Review Age (30 pts max) ---
  let daysSinceReview = null;
  if (lastReviewedAt) {
    const reviewDate = new Date(lastReviewedAt);
    if (!isNaN(reviewDate.getTime())) {
      const diffMs = Date.now() - reviewDate.getTime();
      daysSinceReview = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      if (daysSinceReview <= 90) {
        freshnessScore = 30;
        positiveNotes.push(`Reviewed recently (${daysSinceReview} days ago).`);
      } else if (daysSinceReview <= 180) {
        freshnessScore = 20;
        positiveNotes.push(`Reviewed within the last 6 months (${daysSinceReview} days ago).`);
      } else if (daysSinceReview <= 365) {
        freshnessScore = 10;
        defects.push(`Review age is aging (${daysSinceReview} days ago; re-check suggested).`);
      } else {
        freshnessScore = 0;
        defects.push(`Record is stale: last checked ${daysSinceReview} days ago (> 1 year).`);
      }
    } else {
      defects.push('Invalid review timestamp format.');
    }
  } else {
    defects.push('Never formally reviewed by a maintainer or missing verification timestamp.');
  }

  // --- 3. Completeness & Practical Actionability (40 pts max) ---
  // A. Documents checklist
  if (Array.isArray(service.documents) && service.documents.length > 0) {
    completenessScore += 10;
  } else {
    defects.push('Required documents checklist is missing or empty.');
  }

  // B. Step-by-step instructions
  if (Array.isArray(service.steps) && service.steps.length >= 2) {
    completenessScore += 10;
  } else if (Array.isArray(service.steps) && service.steps.length === 1) {
    completenessScore += 5;
    defects.push('Procedural steps contain only a single step; detailed flow needed.');
  } else {
    defects.push('Step-by-step application instructions are missing.');
  }

  // C. Official fees
  const feesStr = service.fees ? String(service.fees).trim().toLowerCase() : '';
  if (feesStr && feesStr !== 'not specified' && feesStr !== 'unknown') {
    completenessScore += 10;
  } else {
    defects.push('Official government fee information is missing or unspecified.');
  }

  // D. Processing time
  const timeStr = service.processingTime ? String(service.processingTime).trim().toLowerCase() : '';
  if (timeStr && timeStr !== 'not specified' && timeStr !== 'unknown') {
    completenessScore += 5;
  } else {
    defects.push('Expected statutory processing turnaround time is missing.');
  }

  // E. Eligibility criteria
  if (Array.isArray(service.eligibility) && service.eligibility.length > 0) {
    completenessScore += 5;
  } else {
    defects.push('Citizen eligibility criteria are not outlined.');
  }

  // Total Score Calculation
  const totalScore = Math.min(100, provenanceScore + freshnessScore + completenessScore);

  // Assign Tier
  let tier = TRUST_TIERS.STALE_OR_INCOMPLETE;
  if (totalScore >= TRUST_TIERS.HIGH.minScore) {
    tier = TRUST_TIERS.HIGH;
  } else if (totalScore >= TRUST_TIERS.STANDARD.minScore) {
    tier = TRUST_TIERS.STANDARD;
  } else if (totalScore >= TRUST_TIERS.NEEDS_CONFIRMATION.minScore) {
    tier = TRUST_TIERS.NEEDS_CONFIRMATION;
  }

  return {
    score: totalScore,
    tier,
    breakdown: {
      provenance: provenanceScore,
      freshness: freshnessScore,
      completeness: completenessScore,
    },
    daysSinceReview,
    lastReviewedAt,
    reviewedBy,
    defects,
    positiveNotes,
    disclaimer: TRUST_DISCLAIMER,
    isStale: totalScore < 60 || (daysSinceReview !== null && daysSinceReview > 180),
  };
};

/**
 * Returns a prioritized list of stale or incomplete catalog services queued for maintainer review
 */
export const getStaleReviewQueue = (services, customStorage) => {
  if (!Array.isArray(services)) return [];

  return services
    .map((service) => {
      const evaluation = calculateDataTrustScore(service, customStorage);
      return {
        serviceId: service.id,
        serviceName: service.name,
        category: service.category,
        score: evaluation.score,
        tier: evaluation.tier,
        daysSinceReview: evaluation.daysSinceReview,
        lastReviewedAt: evaluation.lastReviewedAt,
        defects: evaluation.defects,
        isStale: evaluation.isStale,
      };
    })
    .filter((item) => item.isStale)
    .sort((a, b) => a.score - b.score); // Lowest score prioritized first
};

/**
 * Computes overall catalog freshness health distribution
 */
export const getCatalogFreshnessHealth = (services, customStorage) => {
  if (!Array.isArray(services) || services.length === 0) {
    return {
      total: 0,
      highCount: 0,
      standardCount: 0,
      needsConfirmationCount: 0,
      staleCount: 0,
      averageScore: 0,
    };
  }

  let totalScore = 0;
  let highCount = 0;
  let standardCount = 0;
  let needsConfirmationCount = 0;
  let staleCount = 0;

  services.forEach((s) => {
    const res = calculateDataTrustScore(s, customStorage);
    totalScore += res.score;
    if (res.score >= 85) highCount++;
    else if (res.score >= 60) standardCount++;
    else if (res.score >= 40) needsConfirmationCount++;
    else staleCount++;
  });

  return {
    total: services.length,
    highCount,
    standardCount,
    needsConfirmationCount,
    staleCount,
    averageScore: Math.round(totalScore / services.length),
  };
};
