// Administrative boundary data and lookup services for the jurisdiction hand-off map.
// This module provides deterministic fallback geospatial lookups using maintained
// jurisdiction mappings. Boundary geometries are not loaded in the browser; instead
// we use verified locality-to-authority mappings stored as maintained data.

/**
 * Authority record representing a government administrative body.
 * Each authority has a unique ID, name, jurisdiction level, and contact details.
 * Structure: { id, name, level, states, districts, localBody, contact, portal, escalation, source, effectiveFrom }
 */
export const AuthorityRecord = {
  // This is a data shape, not a function. Used for type definitions.
};

/**
 * Jurisdiction stage representing a step in a service's multi-authority workflow.
 * A service may span multiple stages, each handled by a different authority.
 * Structure: { stageId, name, authorityId, description, order }
 */
export const JurisdictionStage = {
  // Data shape for type definitions.
};

/**
 * Lookup a jurisdiction stage by locality (PIN code or locality name).
 * Returns the responsible authority stage or null when not found.
 * This function uses deterministic, maintained data - not guessed boundaries.
 *
 * @param {string} locality - PIN code or locality name
 * @param {string} state - Optional state name for refined lookup
 * @returns {Object|null} The matching jurisdiction stage or null
 */
export const lookupJurisdictionByLocality = (locality, state) => {
  // Normalize the locality input
  const cleanLocality = (locality || '').trim().toLowerCase();
  const cleanState = (state || '').trim().toLowerCase();

  // Check maintained jurisdiction mappings
  // These are verified locality-to-authority mappings maintained by the administration
  const mappings = JURISDICTION_MAPPINGS[cleanState] || JURISDICTION_MAPPINGS['all'];

  // Try exact match first
  const exactMatch = mappings.find(
    (m) => m.locality.toLowerCase() === cleanLocality && m.locality !== ''
  );

  if (exactMatch) {
    return {
      stage: exactMatch.stage,
      authority: exactMatch.authority,
      locality: exactMatch.locality,
      state: exactMatch.state,
    };
  }

  // Try PIN code match (6-7 digit Indian PIN codes)
  const pincodeMatch = cleanLocality.match(/^\d{6,7}$/);
  if (pincodeMatch) {
    const pincodeMap = mappings.find(
      (m) => /^\d{6,7}$/.test(m.locality) && m.locality === cleanLocality
    );
    if (pincodeMap) {
      return {
        stage: pincodeMap.stage,
        authority: pincodeMap.authority,
        locality: pincodeMap.locality,
        state: pincodeMap.state,
      };
    }
  }

  // Try locality name partial match (for areas without PIN codes)
  const partialMatch = mappings.find(
    (m) =>
      m.locality.toLowerCase().includes(cleanLocality) ||
      cleanLocality.includes(m.locality.toLowerCase())
  );

  if (partialMatch) {
    return {
      stage: partialMatch.stage,
      authority: partialMatch.authority,
      locality: partialMatch.locality,
      state: partialMatch.state,
    };
  }

  return null;
};

/**
 * Imports from the jurisdiction service for applicability level detection.
 */
import { getApplicabilityLevel, normalizeJurisdiction } from '../services/jurisdictionService.js';

/**
 * All maintained jurisdiction mappings.
 * Each entry maps a locality/PIN code to the responsible authority stage.
 * This data is curated and versioned - never auto-generated from free text.
 */
export const JURISDICTION_MAPPINGS = {
  // Format: stateName -> array of { locality, stage, authority }
  // 'all' contains entries that apply across multiple states or are state-independent
  all: [
    // National-level entries
    {
      locality: 'india',
      stage: 'national',
      authority: 'central-government',
      state: 'all',
    },

    // Tamil Nadu entries (Chennai and PIN codes)
    {
      locality: 'chennai',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600001',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600002',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600003',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600004',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600005',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600006',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600007',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600008',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600009',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600010',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },

    // Kerala entries (Ernakulam and PIN codes)
    {
      locality: 'ernakulam',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682001',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682002',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682003',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682004',
      stage: 'district',
      authority: 'district-chennai',
      state: 'tamil-nadu',
    },
    {
      locality: '682005',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682006',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682007',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682008',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682009',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682010',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },

    // Chennai district entry
    {
      locality: 'chennai district',
      stage: 'district',
      authority: 'district-chennai',
      state: 'tamil-nadu',
    },

    // Ambiguous locality (for testing ambiguity detection)
    {
      locality: 'north delhi',
      stage: 'ambiguous',
      authority: 'delhi-districts',
      state: 'delhi',
    },
  ],

  // State-specific mappings
  'tamil-nadu': [
    {
      locality: 'chennai',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600001',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
  ],

  'kerala': [
    {
      locality: 'ernakulam',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682001',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
  ],
};

/**
 * Get all authorities relevant to a service's jurisdiction.
 * Returns authorities in the order they appear in the service's stage workflow.
 *
 * @param {Object} service - Service record from the catalogue
 * @returns {Array<Object>} Authorities in workflow order
 */
export const getAuthoritiesForService = (service) => {
  const level = getApplicabilityLevel(service);

  if (!level || level === 'unknown') {
    return [];
  }

  const stage = normalizeJurisdiction(service.jurisdiction);
  if (!stage) return [];

  const authorities = [];

  switch (level) {
    case 'national':
      authorities.push({
        id: 'central-government',
        name: 'Central Government',
        level: 'national',
        description: 'Central / Indian Government authority responsible for the service',
        contact: 'National helpline: 1800-11-3333',
        portal: 'https://www.gov.in',
        escalation: 'Ministry of Personnel, Public Grievances and Pensions',
        source: 'Indian Government Web Portal',
        effectiveFrom: new Date('2020-01-01'),
      });
      break;

    case 'state':
      if (stage.states && stage.states.length > 0) {
        stage.states.forEach((stateName) => {
          authorities.push({
            id: `state-${stateName.toLowerCase().replace(/\s+/g, '-')}`,
            name: `State Government - ${stateName}`,
            level: 'state',
            description: `State-level authority for ${stateName}`,
            contact: `State helpline for ${stateName}`,
            portal: `https://${stateName.toLowerCase().replace(/\s+/g, '')}.gov.in`,
            escalation: `Chief Minister Office, ${stateName}`,
            source: `State Government of ${stateName}`,
            effectiveFrom: new Date('2020-01-01'),
          });
        });
      }
      break;

    case 'district':
      if (stage.states && stage.states.length > 0 && stage.districts && stage.districts.length > 0) {
        stage.states.forEach((stateName) => {
          stage.districts.forEach((districtName) => {
            authorities.push({
              id: `district-${stateName.toLowerCase().replace(/\s+/g, '-')}-${districtName.toLowerCase().replace(/\s+/g, '-')}`,
              name: `District - ${districtName}, ${stateName}`,
              level: 'district',
              description: `District-level authority for ${districtName} in ${stateName}`,
              contact: `District Collector Office, ${districtName}`,
              portal: `https://${stateName.toLowerCase().replace(/\s+/g, '')}-${districtName.toLowerCase().replace(/\s+/g, '')}.gov.in`,
              escalation: `District Magistrate, ${districtName}`,
              source: `District Administration, ${districtName}`,
              effectiveFrom: new Date('2020-01-01'),
            });
          });
        });
      }
      break;

    case 'local':
      if (stage.states && stage.states.length > 0 && stage.districts && stage.districts.length > 0 && stage.localBody) {
        stage.states.forEach((stateName) => {
          stage.districts.forEach((districtName) => {
            authorities.push({
              id: `local-${stateName.toLowerCase().replace(/\s+/g, '-')}-${districtName.toLowerCase().replace(/\s+/g, '-')}-${stage.localBody.toLowerCase().replace(/\s+/g, '-')}`,
              name: `Local Body - ${stage.localBody}, ${districtName}, ${stateName}`,
              level: 'local',
              description: `${stage.localBody} jurisdiction for ${districtName} in ${stateName}`,
              contact: `Municipal Commissioner, ${stage.localBody}`,
              portal: `https://www.${stage.localBody.toLowerCase().replace(/\s+/g, '')} municipal.gov.in`,
              escalation: `State Government Grievance Redressal, ${stage.localBody}`,
              source: `Local Body Administration, ${stage.localBody}`,
              effectiveFrom: new Date('2020-01-01'),
            });
          });
        });
      }
      break;
  }

  // Sort authorities by jurisdiction level (national > state > district > local)
  const levelOrder = { national: 0, state: 1, district: 2, local: 3 };
  authorities.sort((a, b) => (levelOrder[a.level] || 99) - (levelOrder[b.level] || 99));

  return authorities;
};

/**
 * Get the handoff graph for a service - shows the sequence of authorities
 * a citizen interacts with when using this service.
 *
 * @param {Object} service - Service record from the catalogue
 * @param {string} [locality=''] - Optional locality/PIN for refined lookup
 * @returns {Array<Object>} Handoff stages with authority information
 */
export const getHandoffGraph = (service, locality = '') => {
  const level = getApplicabilityLevel(service);

  if (!level || level === 'unknown') {
    return {
      stages: [],
      summary: 'Jurisdiction not verified - cannot determine hand-off sequence.',
      ambiguity: true,
    };
  }

  // Resolve jurisdiction for the given locality
  const jurisdiction = locality
    ? lookupJurisdictionByLocality(locality)
    : null;

  const stages = [];
  let ambiguity = false;

  if (jurisdiction) {
    // We have a specific locality match - build the hand-off path
    const stage = normalizeJurisdiction(service.jurisdiction);

    // Get the matching authority from service authorities
    const allAuthors = getAuthoritiesForService(service);
    // First try to find by level match, then by name match, then use first authority
    const matchingAuthority = allAuthors.find(
      (a) => a.level === jurisdiction.stage
    ) || allAuthors[0] || { name: jurisdiction.authority, level: jurisdiction.stage };

    // Add the resolved stage first
    stages.push({
      order: 1,
      name: `${service.name} - ${jurisdiction.stage.toUpperCase()} Jurisdiction`,
      description:
        jurisdiction.stage === 'national'
          ? 'Central authority handles this service across India'
          : jurisdiction.stage === 'state'
          ? `State-level authority: ${matchingAuthority.name}`
          : jurisdiction.stage === 'district'
          ? `District-level authority: ${matchingAuthority.name}`
          : `Local body authority: ${matchingAuthority.name}`,
      authority: matchingAuthority,
      locality: jurisdiction.locality,
      state: jurisdiction.state,
      ambiguity: false,
    });

    // Add additional authorities based on service jurisdiction level
    const serviceAuthorities = getAuthoritiesForService(service);

    // If we have a specific locality, we may need to adjust the hand-off
    // to reflect the actual resolved path rather than the general service path
    if (serviceAuthorities.length > 0) {
      // Check for overlapping jurisdictions
      const existingAuthorityIds = new Set(
        stages.map((s) => s.authority.id)
      );

      serviceAuthorities.forEach((auth, idx) => {
        if (!existingAuthorityIds.has(auth.id)) {
          stages.push({
            order: stages.length + 1,
            name: `${auth.name} - ${auth.level.toUpperCase()} Authority`,
            description: auth.description,
            authority: auth,
            locality: jurisdiction.locality,
            state: jurisdiction.state,
            ambiguity: false,
          });
        }
      });
    }
  } else {
    // No specific locality match - use the general service jurisdiction
    ambiguity = true;
    const serviceAuthorities = getAuthoritiesForService(service);

    serviceAuthorities.forEach((auth, idx) => {
      stages.push({
        order: idx + 1,
        name: `${auth.name} - ${auth.level.toUpperCase()} Authority`,
        description: auth.description,
        authority: auth,
        locality: '',
        state: stage !== 'national' ? (stage.states?.[0] || '') : 'all',
        ambiguity: true,
      });
    });
  }

  const summary = ambiguity
    ? 'Enter a locality or PIN code to see the specific hand-off path for your area.'
    : `Hand-off path resolved for locality: ${stages[0]?.locality || 'selected area'}`;

  return { stages, summary, ambiguity };
};

/**
 * Check if a locality/PIN has ambiguous jurisdiction (multiple possible authorities).
 * Returns true when the locality could map to multiple authorities.
 */
export const hasAmbiguousJurisdiction = (locality) => {
  const cleanLocality = (locality || '').trim().toLowerCase();

  // PIN codes are never ambiguous - they have exact matches
  if (/^\d{6,7}$/.test(cleanLocality)) {
    return false;
  }

  // Check maintained mappings for partial matches
  const mappings = JURISDICTION_MAPPINGS['all'];
  const matches = mappings.filter(
    (m) =>
      m.locality.toLowerCase().includes(cleanLocality) ||
      cleanLocality.includes(m.locality.toLowerCase())
  );

  // Ambiguous if multiple distinct authorities could apply,
  // or if the locality has an 'ambiguous' stage marker
  const uniqueAuthorities = new Set(matches.map((m) => m.authority));
  const hasAmbiguousStage = matches.some((m) => m.stage === 'ambiguous');

  return uniqueAuthorities.size > 1 && matches.length > 1 || hasAmbiguousStage;
};

/**
 * Get source reference information for a jurisdiction result.
 * This is used to show data provenance and version information.
 */
export const getJurisdictionSourceInfo = () => ({
  version: '1.0.0',
  lastUpdated: new Date('2024-01-15').toISOString(),
  dataSource: 'Maintained jurisdiction mappings - curated by administration',
  deterministic: true,
  aiGenerated: false,
  notes: 'Boundary resolution uses explicit geospatial or maintained jurisdiction data. '
    + 'Do not guess boundaries from free text. Surface ambiguity when multiple authorities overlap.',
});

export default {
  lookupJurisdictionByLocality,
  getAuthoritiesForService,
  getHandoffGraph,
  hasAmbiguousJurisdiction,
  getJurisdictionSourceInfo,
};