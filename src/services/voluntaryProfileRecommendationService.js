/**
 * voluntaryProfileRecommendationService.js
 *
 * Recommends relevant civic services matched against voluntary citizen profile
 * attributes (state, age group, occupation, social category) with transparent,
 * explainable reasoning and zero external network transmission.
 *
 * Privacy Principles:
 * - Anonymous browsing is primary. Users never need a profile to use services.
 * - Opt-in required: profile recommendations only activate with explicit consent.
 * - Local-first matching: 100% in-browser deterministic evaluation.
 * - Full transparency: every recommendation explicitly lists the influencing attributes.
 * - Instant reset: citizens can opt out and wipe voluntary attributes at any time.
 */

import { services } from '../data/services';

export const VOLUNTARY_PROFILE_OPT_IN_KEY = 'civicbridge_voluntary_profile_opt_in';
export const VOLUNTARY_PROFILE_ATTRS_KEY = 'civicbridge_voluntary_profile_attrs';

/**
 * Checks whether user has opted into voluntary profile recommendations.
 * Defaults to false (consent-first).
 */
export function isVoluntaryProfileOptedIn() {
  try {
    return localStorage.getItem(VOLUNTARY_PROFILE_OPT_IN_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Sets opt-in status for voluntary profile recommendations.
 */
export function setVoluntaryProfileOptIn(enabled) {
  try {
    localStorage.setItem(VOLUNTARY_PROFILE_OPT_IN_KEY, enabled ? 'true' : 'false');
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieves voluntary profile attributes from local storage.
 */
export function getVoluntaryProfileAttributes() {
  try {
    const raw = localStorage.getItem(VOLUNTARY_PROFILE_ATTRS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Updates voluntary profile attributes in local storage.
 */
export function saveVoluntaryProfileAttributes(attributes = {}) {
  try {
    const current = getVoluntaryProfileAttributes();
    const updated = {
      ...current,
      ...attributes,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(VOLUNTARY_PROFILE_ATTRS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return attributes;
  }
}

/**
 * Completely resets and clears voluntary profile attributes.
 */
export function clearVoluntaryProfileAttributes() {
  try {
    localStorage.removeItem(VOLUNTARY_PROFILE_ATTRS_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fallback recommendations for anonymous users or when opted out.
 */
export function getAnonymousFallbackRecommendations(limit = 4) {
  const fallbackIds = ['aadhaar-update', 'voter-id', 'ration-card', 'ayushman-bharat', 'driving-license', 'birth-certificate'];
  const catalogList = Array.isArray(services) ? services : [];

  const matched = catalogList.filter((s) => fallbackIds.includes(s.id));
  const items = [...matched];
  for (const s of catalogList) {
    if (items.length >= limit) break;
    if (!items.some((item) => item.id === s.id)) {
      items.push(s);
    }
  }

  return items.slice(0, limit).map((s) => ({
    serviceId: s.id,
    serviceName: s.name,
    category: s.category || 'General Civic',
    department: s.department || 'Civic Authority',
    matchScore: 50,
    matchReason: 'Essential civic baseline service recommended for all residents regardless of profile.',
    influencingAttributes: ['Universal Baseline'],
    isFallback: true,
  }));
}

/**
 * Generates explainable service recommendations based on voluntary profile.
 *
 * @param {Object} profileOverrides - Optional profile attributes passed directly
 * @param {Object} options - Configuration options (limit, catalog)
 * @returns {Object} Recommendations report
 */
export function getVoluntaryProfileRecommendations(profileOverrides = null, options = {}) {
  const isOptedIn = isVoluntaryProfileOptedIn();
  const attributes = profileOverrides || getVoluntaryProfileAttributes();
  const catalog = options.catalog || services || [];
  const limit = options.limit || 6;

  // If user has not opted in or has no attributes, return standard anonymous fallbacks safely
  const hasAttributes = Object.values(attributes).some(
    (v) => typeof v === 'string' && v.trim().length > 0
  );

  if (!isOptedIn || !hasAttributes) {
    return {
      isPersonalized: false,
      optedIn: isOptedIn,
      reason: isOptedIn
        ? 'No voluntary profile attributes specified yet. Showing baseline civic services.'
        : 'Recommendations are in anonymous mode. Opt-in to receive suggestions based on your voluntary profile.',
      recommendations: getAnonymousFallbackRecommendations(limit),
      influencingAttributesUsed: [],
    };
  }

  const state = (attributes.state || '').trim().toLowerCase();
  const ageGroup = (attributes.ageGroup || '').trim().toLowerCase();
  const occupation = (attributes.occupation || '').trim().toLowerCase();
  const category = (attributes.category || '').trim().toLowerCase();

  const scoredServices = [];

  catalog.forEach((s) => {
    let score = 0;
    const reasons = [];
    const influencing = [];

    const searchableText = `${s.name || ''} ${s.description || ''} ${s.category || ''} ${s.department || ''} ${JSON.stringify(s.eligibility || '')}`.toLowerCase();

    // 1. Occupation match
    if (occupation) {
      const isFarmer = occupation.includes('farm') || occupation.includes('agri');
      const isStudent = occupation.includes('student') || occupation.includes('educat');
      const isSenior = occupation.includes('retir') || occupation.includes('pension') || occupation.includes('senior');
      const isWorker = occupation.includes('labor') || occupation.includes('construct') || occupation.includes('artisan');

      if (isFarmer && (searchableText.includes('farmer') || searchableText.includes('kisan') || searchableText.includes('agriculture') || searchableText.includes('crop'))) {
        score += 40;
        reasons.push('Matched with your voluntary occupation: Agriculture & Farming.');
        influencing.push(`Occupation (${attributes.occupation})`);
      } else if (isStudent && (searchableText.includes('scholarship') || searchableText.includes('student') || searchableText.includes('education') || searchableText.includes('college'))) {
        score += 40;
        reasons.push('Matched with your voluntary occupation: Student / Education.');
        influencing.push(`Occupation (${attributes.occupation})`);
      } else if (isSenior && (searchableText.includes('senior') || searchableText.includes('pension') || searchableText.includes('elderly') || searchableText.includes('old age'))) {
        score += 40;
        reasons.push('Matched with your voluntary occupation: Senior Citizen / Retired.');
        influencing.push(`Occupation (${attributes.occupation})`);
      } else if (isWorker && (searchableText.includes('unorganised') || searchableText.includes('eshram') || searchableText.includes('labour') || searchableText.includes('worker'))) {
        score += 35;
        reasons.push('Matched with your voluntary occupation: Unorganised Worker / Labour.');
        influencing.push(`Occupation (${attributes.occupation})`);
      } else if (searchableText.includes(occupation)) {
        score += 25;
        reasons.push(`Direct term match with your occupation: ${attributes.occupation}.`);
        influencing.push(`Occupation (${attributes.occupation})`);
      }
    }

    // 2. Age group match
    if (ageGroup) {
      if ((ageGroup.includes('senior') || ageGroup.includes('60')) && (searchableText.includes('senior') || searchableText.includes('pension') || searchableText.includes('60 years'))) {
        score += 30;
        reasons.push('Relevant for senior citizens (60+ years).');
        influencing.push(`Age Group (${attributes.ageGroup})`);
      } else if ((ageGroup.includes('youth') || ageGroup.includes('18-25') || ageGroup.includes('student')) && (searchableText.includes('youth') || searchableText.includes('scholarship') || searchableText.includes('driving license') || searchableText.includes('voter'))) {
        score += 25;
        reasons.push('Recommended milestone service for youth & young adults.');
        influencing.push(`Age Group (${attributes.ageGroup})`);
      } else if ((ageGroup.includes('child') || ageGroup.includes('minor') || ageGroup.includes('0-17')) && (searchableText.includes('birth') || searchableText.includes('immunization') || searchableText.includes('school'))) {
        score += 30;
        reasons.push('Relevant for children and minors.');
        influencing.push(`Age Group (${attributes.ageGroup})`);
      }
    }

    // 3. State / Jurisdiction match
    if (state) {
      const rawState = typeof s.state === 'string' ? s.state : typeof s.jurisdiction === 'string' ? s.jurisdiction : '';
      const serviceState = rawState.toLowerCase();
      if (serviceState && (serviceState.includes(state) || state.includes(serviceState))) {
        score += 25;
        reasons.push(`Designated specifically for residents of ${attributes.state}.`);
        influencing.push(`State (${attributes.state})`);
      } else if (searchableText.includes(state)) {
        score += 15;
        reasons.push(`Includes provisions applicable in ${attributes.state}.`);
        influencing.push(`State (${attributes.state})`);
      }
    }

    // 4. Social Category match
    if (category) {
      const isBpl = category.includes('bpl') || category.includes('poor') || category.includes('low income');
      const isDisability = category.includes('pwd') || category.includes('disab') || category.includes('divyang');

      if (isBpl && (searchableText.includes('bpl') || searchableText.includes('subsid') || searchableText.includes('ration') || searchableText.includes('food security'))) {
        score += 30;
        reasons.push('Covers targeted benefits for priority and BPL households.');
        influencing.push(`Category (${attributes.category})`);
      } else if (isDisability && (searchableText.includes('disability') || searchableText.includes('udid') || searchableText.includes('divyang'))) {
        score += 35;
        reasons.push('Includes specific disability accessibility assistance or UDID benefits.');
        influencing.push(`Category (${attributes.category})`);
      }
    }

    if (score > 0) {
      scoredServices.push({
        serviceId: s.id,
        serviceName: s.name,
        category: s.category || 'Civic Service',
        department: s.department || 'Department',
        matchScore: score,
        matchReason: reasons.join(' ') || 'Relevant based on your voluntary profile parameters.',
        influencingAttributes: influencing,
        isFallback: false,
      });
    }
  });

  // Sort descending by matchScore
  scoredServices.sort((a, b) => b.matchScore - a.matchScore);

  const topRecommendations = scoredServices.slice(0, limit);

  // If score yields fewer than 2 results, append fallback baseline services
  if (topRecommendations.length < 2) {
    const fallbacks = getAnonymousFallbackRecommendations(limit - topRecommendations.length);
    fallbacks.forEach((f) => {
      if (!topRecommendations.some((r) => r.serviceId === f.serviceId)) {
        topRecommendations.push(f);
      }
    });
  }

  const allInfluencing = Array.from(
    new Set(topRecommendations.flatMap((r) => r.influencingAttributes).filter((x) => x !== 'Universal Baseline'))
  );

  return {
    isPersonalized: true,
    optedIn: true,
    reason: `Displaying ${topRecommendations.length} recommendations matched with your voluntary profile attributes.`,
    recommendations: topRecommendations,
    influencingAttributesUsed: allInfluencing,
  };
}
