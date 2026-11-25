import { 
  lookupJurisdictionByLocality, 
  getAuthoritiesForService,
  getHandoffGraph as getBoundaryHandoffGraph,
  hasAmbiguousJurisdiction,
  getJurisdictionSourceInfo,
} from '../data/jurisdictionBoundaries.js';
import { getApplicabilityLevel } from './jurisdictionService.js';

/**
 * Service for resolving jurisdiction hand-offs for services spanning multiple authorities.
 * 
 * This service integrates with the existing Civic Help Setu service catalogue and
 * reuses established authentication, privacy, and design conventions.
 * 
 * Key functions:
 * - Resolve jurisdiction from service + locality/PIN
 * - Build hand-off graph showing authority sequence
 * - Handle ambiguous matches with manual confirmation
 * - Provide text-only alternatives for accessibility
 * - Surface AI-generated suggestions with proper labeling
 */

/**
 * Resolve the jurisdiction for a service given a locality or PIN code.
 * This is the primary entry point for the jurisdiction hand-off workflow.
 *
 * @param {Object} service - Service record from the catalogue
 * @param {string} locality - Locality name or PIN code entered by the citizen
 * @param {string} [state] - Optional selected state from the address filter
 * @returns {Object} Resolution result with stage, authority, and metadata
 */
export const resolveJurisdiction = (service, locality, state) => {
  // Validate inputs
  if (!service || !service.id) {
    return {
      success: false,
      error: 'Invalid service record.',
      stage: null,
      authority: null,
      ambiguity: false,
    };
  }

  if (!locality || typeof locality !== 'string') {
    return {
      success: false,
      error: 'Locality or PIN code is required.',
      stage: null,
      authority: null,
      ambiguity: false,
    };
  }

  // Check if the service has valid jurisdiction metadata
  const level = getApplicabilityLevel(service);
  if (!level || level === 'unknown') {
    return {
      success: false,
      error: 'Jurisdiction for this service has not been verified. '
        + 'Cannot resolve hand-off path without verified jurisdiction metadata.',
      stage: null,
      authority: null,
      ambiguity: false,
    };
  }

  // Use the boundary lookup service to resolve the jurisdiction
  const result = lookupJurisdictionByLocality(locality, state);

  if (result) {
    // Check if the resolved stage is ambiguous
    if (result.stage === 'ambiguous') {
      return {
        success: false,
        error: 'Multiple authorities could serve this locality. '
          + 'Please confirm which authority is responsible, or enter a more specific PIN code or locality name.',
        stage: null,
        authority: null,
        ambiguity: true,
        requiresConfirmation: true,
      };
    }

    // We have a specific locality match
    const { stage, authority, locality: resolvedLocality, state: resolvedState } = result;

    return {
      success: true,
      stage,
      authority: getAuthoritiesForService(service).find(
        (a) => a.level === stage || a.name.toLowerCase().includes(authority.toLowerCase())
      ) || { name: authority, level: stage },
      resolvedLocality,
      resolvedState,
      ambiguity: false,
      sourceInfo: getJurisdictionSourceInfo(),
    };
  }

  // No specific match found - check for ambiguity
  const isAmbiguous = hasAmbiguousJurisdiction(locality);

  if (isAmbiguous) {
    return {
      success: false,
      error: 'Multiple authorities could serve this locality. '
        + 'Please confirm which authority is responsible, or enter a more specific PIN code or locality name.',
      stage: null,
      authority: null,
      ambiguity: true,
      requiresConfirmation: true,
    };
  }

  // No match found at all - return unverified status
  return {
    success: false,
    error: 'Could not resolve jurisdiction for the provided locality. '
      + 'Please verify the locality name or PIN code and try again.',
    stage: null,
    authority: null,
    ambiguity: false,
    unavailable: true,
  };
};

/**
 * Build the hand-off graph for a service, showing the sequence of authorities
 * a citizen interacts with when using this service in their locality.
 *
 * @param {Object} service - Service record from the catalogue
 * @param {string} locality - Locality name or PIN code entered by the citizen
 * @param {string} [state] - Optional selected state from the address filter
 * @returns {Object} Hand-off graph with stages, summary, and ambiguity info
 */
export const buildHandOffGraph = (service, locality, state) => {
  // First resolve the jurisdiction
  const resolution = resolveJurisdiction(service, locality, state);

  if (!resolution.success) {
    // When ambiguity is detected, still provide some stage information
    // based on the service's jurisdiction level
    const { ambiguity, requiresConfirmation, stage } = resolution;
    const serviceStages = [];

    if (ambiguity && requiresConfirmation) {
      // Ambiguous jurisdiction - provide general service-level authorities
      const authorities = getAuthoritiesForService(service);
      authorities.forEach((auth, idx) => {
        serviceStages.push({
          order: idx + 1,
          name: `${auth.name} - ${auth.level.toUpperCase()} Authority (requires confirmation)`,
          description: auth.description,
          authority: auth,
          locality,
          state: stage !== 'national' ? (stage || '') : 'all',
          ambiguity: true,
        });
      });
    } else if (!resolution.unavailable) {
      // Other failure - try to provide service-level info
      const authorities = getAuthoritiesForService(service);
      authorities.forEach((auth, idx) => {
        serviceStages.push({
          order: idx + 1,
          name: `${auth.name} - ${auth.level.toUpperCase()} Authority`,
          description: auth.description,
          authority: auth,
          locality,
          state: stage !== 'national' ? (stage || '') : 'all',
        });
      });
    }

    return {
      stages: serviceStages.length > 0 ? serviceStages : [{ order: 1, name: 'Jurisdiction resolution required', authority: null }],
      summary: resolution.error || 'Could not build hand-off graph.',
      ambiguity: resolution.ambiguity || false,
      requiresConfirmation: resolution.requiresConfirmation || false,
    };
  }

  // Build the hand-off graph using the authority resolution service
  return getBoundaryHandoffGraph(service, locality);
};

/**
 * Get the authoritative contact and portal information for a specific authority
 * in the hand-off path.
 *
 * @param {Object} authority - Authority record from the hand-off graph
 * @returns {Object} Contact and portal information
 */
export const getAuthorityDetails = (authority) => {
  if (!authority) {
    return {
      contact: 'Contact information unavailable',
      portal: '#',
      escalation: 'Escalation path unavailable',
    };
  }

  return {
    contact: authority.contact || 'Contact information unavailable',
    portal: authority.portal || '#',
    escalation: authority.escalation || 'Escalation path unavailable',
    source: authority.source || 'Official source unspecified',
    effectiveFrom: authority.effectiveFrom || new Date(),
  };
};

/**
 * Get a text-only alternative representation of the jurisdiction hand-off.
 * This is used for accessibility support and reduced-motion mode.
 *
 * @param {Object} graph - Hand-off graph from buildHandOffGraph
 * @returns {string} Text-only representation
 */
export const getTextOnlyHandOff = (graph) => {
  if (!graph || !graph.stages || graph.stages.length === 0) {
    return 'No hand-off path available. Please enter a locality or PIN code to see the service journey.';
  }

  let text = 'Service Hand-off Journey:\n';
  text += '========================\n\n';

  text += `Service: ${graph.summary}\n\n`;

  graph.stages.forEach((stage, idx) => {
    text += `${idx + 1}. ${stage.name}\n`;
    if (stage.description) {
      text += `   ${stage.description}\n`;
    }
    if (stage.authority) {
      text += `   Authority: ${stage.authority.name}\n`;
      if (stage.authority.level) {
        text += `   Level: ${stage.authority.level.toUpperCase()}\n`;
      }
      if (stage.authority.contact) {
        text += `   Contact: ${stage.authority.contact}\n`;
      }
      if (stage.authority.portal) {
        text += `   Portal: ${stage.authority.portal}\n`;
      }
    }
    if (stage.locality) {
      text += `   Locality: ${stage.locality}\n`;
    }
    if (stage.state) {
      text += `   State/UT: ${stage.state}\n`;
    }
    text += '\n';
  });

  // Add source information
  const sourceInfo = getJurisdictionSourceInfo();
  text += `Source: ${sourceInfo.dataSource} (v${sourceInfo.version})\n`;
  text += `Data version: ${sourceInfo.lastUpdated}\n`;

  return text;
};

/**
 * Get the essential information available without hover for keyboard navigation.
 * This ensures all critical information is accessible via Tab navigation.
 *
 * @param {Object} graph - Hand-off graph from buildHandOffGraph
 * @returns {Array<Object>} Essential info items for keyboard navigation
 */
export const getKeyboardAccessibleInfo = (graph) => {
  if (!graph || !graph.stages || graph.stages.length === 0) {
    return [{
      type: 'info',
      label: 'No hand-off path available',
      value: 'Enter a locality or PIN code to resolve the service jurisdiction.',
    }];
  }

  const items = [];

  graph.stages.forEach((stage, idx) => {
    // Authority name - always available
    items.push({
      type: 'authority',
      label: `Authority ${idx + 1}: ${stage.authority?.name || 'Unknown'}`,
      value: stage.authority?.name || 'Not resolved',
      order: idx,
    });

    // Level - always available
    items.push({
      type: 'level',
      label: `Level ${idx + 1}: ${stage.authority?.level || 'Unknown'}`,
      value: stage.authority?.level || 'Not resolved',
      order: idx,
    });

    // Contact - available when present
    if (stage.authority?.contact) {
      items.push({
        type: 'contact',
        label: `Contact ${idx + 1}`,
        value: stage.authority.contact,
        order: idx,
      });
    }

    // Portal - available when present
    if (stage.authority?.portal) {
      items.push({
        type: 'portal',
        label: `Portal ${idx + 1}`,
        value: stage.authority.portal,
        order: idx,
      });
    }

    // Escalation - available when present
    if (stage.authority?.escalation) {
      items.push({
        type: 'escalation',
        label: `Escalation ${idx + 1}`,
        value: stage.authority.escalation,
        order: idx,
      });
    }
  });

  // Summary
  items.push({
    type: 'summary',
    label: 'Journey Summary',
    value: graph.summary,
    order: graph.stages.length,
  });

  return items.sort((a, b) => a.order - b.order);
};

/**
 * Check if the jurisdiction result has low confidence and requires review.
 * This handles the AI guardrail requirement: surface ambiguity when multiple
 * authorities overlap, and ask for review instead of guessing.
 *
 * @param {Object} resolution - Resolution result from resolveJurisdiction
 * @returns {boolean} True if review is required
 */
export const requiresReview = (resolution) => {
  if (!resolution) return false;

  // Requires confirmation when ambiguity is detected
  if (resolution.ambiguity && resolution.requiresConfirmation) {
    return true;
  }

  // Requires review when the resolution was unavailable
  if (resolution.unavailable) {
    return true;
  }

  // Requires review when the service jurisdiction is unknown
  if (!resolution.success) {
    return true;
  }

  return false;
};

/**
 * Get a plain language explanation of the confirmed jurisdiction result.
 * AI can explain but must be labelled as a suggestion until confirmed.
 *
 * @param {Object} resolution - Resolution result from resolveJurisdiction
 * @param {boolean} [isConfirmed=false] - Whether the user has confirmed the result
 * @returns {Object} Explanation with suggestion labeling
 */
/**
 * Session storage keys for non-sensitive draft progress.
 */
export const JURISDICTION_DRAFT_KEY = 'civic_jurisdiction_handoff_draft_v1';

/**
 * Save user's non-sensitive workspace progress to session storage.
 * Distinguishes user progress from official government application status.
 */
export const saveJurisdictionDraft = (draft) => {
  if (typeof window === 'undefined' || !window.sessionStorage) return false;
  try {
    const payload = {
      serviceId: draft.serviceId || '',
      locality: (draft.locality || '').slice(0, 100),
      state: draft.state || 'All',
      confirmedAuthorityId: draft.confirmedAuthorityId || null,
      isConfirmed: Boolean(draft.isConfirmed),
      savedAt: new Date().toISOString(),
      isOfficialGovernmentApplication: false,
    };
    window.sessionStorage.setItem(JURISDICTION_DRAFT_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
};

/**
 * Retrieve saved non-sensitive draft progress.
 */
export const getJurisdictionDraft = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(JURISDICTION_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * Clear saved draft progress.
 */
export const clearJurisdictionDraft = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(JURISDICTION_DRAFT_KEY);
  } catch {
    // ignore
  }
};

/**
 * Generate plain-language explanation with strict AI guardrails.
 * AI output is labelled as suggestion until confirmed.
 */
export const getPlainLanguageExplanation = (resolutionOrGraph, isConfirmed = false) => {
  if (!resolutionOrGraph) {
    return {
      text: 'Unable to resolve jurisdiction. Please verify the service and locality details.',
      isSuggestion: false,
      requiresConfirmation: true,
    };
  }

  // Handle graph object
  if (resolutionOrGraph.stages && Array.isArray(resolutionOrGraph.stages)) {
    const primaryStage = resolutionOrGraph.stages[0];
    const explanation = resolutionOrGraph.summary || (primaryStage
      ? `This workflow starts with ${primaryStage.name} and passes through ${resolutionOrGraph.stages.length} authorities.`
      : 'Jurisdiction resolved.');
    return {
      text: explanation,
      isSuggestion: !isConfirmed,
      requiresConfirmation: !isConfirmed || Boolean(resolutionOrGraph.ambiguity),
      sourceInfo: getJurisdictionSourceInfo(),
      aiLabel: !isConfirmed
        ? '(AI suggestion - confirm with official authority before proceeding)'
        : '(Confirmed by user)',
    };
  }

  if (!resolutionOrGraph.success) {
    return {
      text: resolutionOrGraph.error || 'Unable to resolve jurisdiction. Please verify the service and locality details.',
      isSuggestion: false,
      requiresConfirmation: true,
    };
  }

  const { stage, resolvedLocality, resolvedState } = resolutionOrGraph;

  // Build the plain language explanation
  let explanation;
  if (stage === 'national') {
    explanation = `The ${resolvedLocality || 'this'} service is available across India. `
      + `The Central Government is responsible for this service.`;
  } else if (stage === 'state') {
    explanation = `The ${resolvedLocality || 'this'} service is available in ${resolvedState || 'your state'}. `
      + `The State Government is responsible for this service.`;
  } else if (stage === 'district') {
    explanation = `The ${resolvedLocality || 'this'} service is available in ${resolvedState || 'your district'}. `
      + `The District Administration is responsible for this service.`;
  } else if (stage === 'local') {
    explanation = `The ${resolvedLocality || 'this'} service is available in your local area. `
      + `The Local Body (municipality/panchayat) is responsible for this service.`;
  } else {
    explanation = 'Jurisdiction resolved. Please confirm the details with the official authority.';
  }

  return {
    text: explanation,
    isSuggestion: !isConfirmed, // AI output is labelled as suggestion until confirmed
    requiresConfirmation: !isConfirmed,
    sourceInfo: getJurisdictionSourceInfo(),
    aiLabel: !isConfirmed
      ? '(AI suggestion - confirm with official authority before proceeding)'
      : '(Confirmed by user)',
  };
};

export const getHandoffGraph = buildHandOffGraph;

export default {
  resolveJurisdiction,
  buildHandOffGraph,
  getHandoffGraph,
  getAuthorityDetails,
  getTextOnlyHandOff,
  getKeyboardAccessibleInfo,
  requiresReview,
  getPlainLanguageExplanation,
  saveJurisdictionDraft,
  getJurisdictionDraft,
  clearJurisdictionDraft,
};