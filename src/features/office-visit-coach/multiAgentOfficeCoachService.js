/**
 * Multi-Agent Office Visit Preparation and Follow-Up Coach Service
 * 
 * Integrates with existing Civic Help Setu services to provide a comprehensive
 * coach experience for citizens preparing for and following up on in-person
 * government service visits.
 * 
 * @module multiAgentOfficeCoachService
 * 
 * Engineering constraints adhered to:
 * - Deterministic rules outside LLM prompts (classification via regex, as in makeChecklistService.js)
 * - AI outputs are untrusted suggestions with provenance metadata
 * - Explicit human approval for high-impact actions (outcome recording, checklist modifications)
 * - Non-AI fallback for essential workflows
 * - Never implies appointment booking or office confirmation without integration
 * - Shared approved source set from existing catalogue services
 */

import {
  createVisitPlan,
  updateVisitPlan,
  validateVisitPlan,
} from './schemas/visit-plan-schema.js';

import {
  createChecklistItem,
  updateChecklistItem,
  validateChecklistItem,
} from './schemas/checklist-item-schema.js';

import {
  createVisitOutcome,
  updateVisitOutcome,
  validateVisitOutcome,
} from './schemas/visit-outcome-schema.js';

import {
  generateAppointmentIcs,
  inferOfficeType,
} from '../../services/physicalVisitDossierService.js';

import {
  classifyItemText,
  CONFIRM_WITH_DEPARTMENT,
} from '../../services/makeChecklistService.js';

import {
  compileVisitPackData,
  buildPrintableVisitPackHtml,
  buildPrintableVisitPackText,
} from '../../services/appointmentVisitPackService.js';

/**
 * Coach configuration constants
 */
export const COACH_CONSTANTS = {
  /** Default verification TTL in days for office data */
  OFFICE_DATA_TTL_DAYS: 30,
  /** Maximum time window (ms) for citizen to record outcome after visit */
  OUTCOME_RECORDING_WINDOW_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  /** Ink-friendly printable pack section selection default */
  DEFAULT_SECTION_SELECTION: {
    office_details: true,
    appointment_info: true,
    required_documents: true,
    procedural_steps: true,
    fees_payment: true,
    rejection_prevention: true,
    user_notes: false, // Strictly excluded by default per ADR
  },
  /** Disclaimer text */
  DISCLAIMER:
    'Notice: This coach stores your visit preparation and follow-up plan locally. ' +
    'This tool is not directly connected to government appointment reservation servers ' +
    'unless expressly confirmed with your official appointment booking receipt. ' +
    'Outcome recording does not imply official verification.',
};

/**
 * Office verification status
 */
export const OFFICE_VERIFICATION_STATUS = {
  FRESH: 'FRESH',     // Verified within TTL
  STALE: 'STALE',     // Beyond TTL, use with caution
  UNVERIFIED: 'UNVERIFIED', // No source data available
};

/**
 * Generate a complete visit plan for a citizen.
 * 
 * @param {Object} params - Plan generation parameters
 * @param {Object} params.service - Civic service record from catalogue
 * @param {Object} params.office - Office location record
 * @param {Object} [params.citizenContext] - Citizen-specific context (opaque ID only)
 * @param {boolean} [params.includeUserNotes] - Whether to include user notes section
 * @param {Object} [options] - Generation options
 * @returns {Object} Complete visit plan validated against schema
 * @throws {Error} If required parameters are missing or data is stale
 */
export function generateVisitPlan({ service, office, citizenContext = {}, includeUserNotes = false, options = {} } = {}, opts = {}) {
  const mergedOptions = { ...options, ...opts };

  // 1. Validate inputs at trust boundaries
  if (!service || typeof service !== 'object') {
    throw new Error('Valid service object is required to generate a visit plan');
  }

  if (!office || typeof office !== 'object') {
    throw new Error('Valid office object is required to generate a visit plan');
  }

  // 2. Infer office type from existing utility
  const inferredType = inferOfficeType(office, service) || 'general';
  if (!inferredType) {
    throw new Error('Could not infer office type from provided service and office data');
  }

  // 3. Check office data freshness (stale data handling)
  const lastVerified = service.lastVerified;
  const officeDataStatus = lastVerified
    ? isOfficeDataFresh(lastVerified)
    : OFFICE_VERIFICATION_STATUS.UNVERIFIED;

  // 4. Generate checklist using deterministic rules (AI fallback path)
  const checklist = generateFallbackChecklistFromService(service);

  // 5. Classify checklist items and enrich with provenance
  const enrichedChecklist = enrichChecklistItems(checklist.items);

  // 6. Generate printable pack data (using existing compilation)
  const sectionSelection = {
    ...COACH_CONSTANTS.DEFAULT_SECTION_SELECTION,
    user_notes: includeUserNotes,
  };

  const packData = compileVisitPackData({
    service,
    office,
    sectionSelection,
    userNotes: includeUserNotes ? citizenContext.notes || '' : '',
    includeUserNotes: includeUserNotes,
  });

  // 7. Build the complete visit plan
  const plan = createVisitPlan({
    planId: mergedOptions.planId,
    citizenId: citizenContext.citizenId || 'citizen_anonymous',
    serviceName: service.name,
    serviceCategory: service.category,
    serviceDepartment: service.department,
    serviceFees: service.fees,
    serviceProcessingTime: service.processingTime,
    serviceDocuments: service.documents,
    serviceSteps: service.steps,
    serviceSources: service.officialSources,
    lastVerified: service.lastVerified,
    officeName: office.name,
    officeAddress: office.address,
    officeCity: office.city,
    officeState: office.state,
    officePincode: office.pincode,
    officeLandmark: office.landmark,
    officeOperatingHours: office.operatingHours,
    inferredType,
    checklist: {
      items: enrichedChecklist,
      requirements: checklist.requirements || {},
    },
    provenance: {
      generatedBy: 'multiAgentOfficeCoachService',
      generatedAt: new Date().toISOString(),
      aiGenerated: mergedOptions?.simulateAiFailure === true,
      ...(mergedOptions?.simulateAiFailure && { aiModel: 'fallback-deterministic' }),
    },
  });

  // 8. Attach office verification status and printable helpers
  plan.inferredType = inferredType;
  plan.officeDataStatus = officeDataStatus;
  plan.COACH_CONSTANTS = {
    ...COACH_CONSTANTS,
    DEFAULT_SECTION_SELECTION: {
      ...COACH_CONSTANTS.DEFAULT_SECTION_SELECTION,
      user_notes: includeUserNotes,
    },
  };
  plan.buildPrintableHtml = () => buildPrintableVisitPackHtml(packData);
  plan.buildPrintableText = () => buildPrintableVisitPackText(packData);
  plan.generateIcs = () => generateAppointmentIcs({
    id: plan.planId,
    serviceName: service.name,
    officeName: office.name,
    officeAddress: office.address,
    appointmentDateTime: new Date().toISOString(),
  });

  return plan;
}

/**
 * Check if office data is within the freshness TTL.
 * @param {string} lastVerifiedDate - ISO date string (YYYY-MM-DD)
 * @returns {string} One of OFFICE_VERIFICATION_STATUS values
 */
function isOfficeDataFresh(lastVerifiedDate) {
  const lastVerified = new Date(lastVerifiedDate);
  const now = new Date();
  const diffDays = (now - lastVerified) / (1000 * 60 * 60 * 24);
  return diffDays <= COACH_CONSTANTS.OFFICE_DATA_TTL_DAYS
    ? OFFICE_VERIFICATION_STATUS.FRESH
    : OFFICE_VERIFICATION_STATUS.STALE;
}

/**
 * Generate a fallback checklist from service data using deterministic rules.
 * @param {Object} service - Service record
 * @returns {Object} Checklist with items and requirements
 */
function generateFallbackChecklistFromService(service) {
  const documents = Array.isArray(service.documents) && service.documents.length > 0
    ? service.documents
    : [
        'Valid Identity Proof (Aadhaar / Voter ID / Passport)',
        'Valid Proof of Address (Utility Bill / Domicile Certificate)',
        'Passport-size photographs with plain white background (x3)',
        'Self-declaration affidavit (if applicable)',
      ];

  const steps = Array.isArray(service.steps) && service.steps.length > 0
    ? service.steps
    : [
        { title: 'Token Collection', description: 'Present yourself at reception token kiosk 15 minutes before slot.' },
        { title: 'Document Verification', description: 'Submit original documents and 2 self-attested photocopy sets at counter.' },
        { title: 'Biometrics & Fee Payment', description: 'Provide biometric capture and pay statutory treasury fees.' },
        { title: 'Acknowledgment Slip', description: 'Collect physical receipt with application reference ID.' },
      ];

  const items = [];
  const requirements = {};

  // Classify each document using deterministic rules
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const classified = classifyItemText(doc, { service });

    const itemLabel = classified.isAmbiguous
      ? `${classified.title} (${CONFIRM_WITH_DEPARTMENT})`
      : classified.title;

    items.push({
      id: `chk_orig_${i + 1}`,
      type: classified.type,
      label: itemLabel,
      description: classified.condition || 'Must carry original document for physical verification at counter.',
      isPacked: false,
      source: classified.source || null,
      isAmbiguous: classified.isAmbiguous,
    });

    requirements[itemLabel] = {
      type: classified.type,
      condition: classified.condition,
      source: classified.source,
      isAmbiguous: classified.isAmbiguous,
    };
  }

  // Add procedural steps as checklist items
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    items.push({
      id: `chk_step_${i + 1}`,
      type: 'unverified',
      label: step.title || `Step ${i + 1}`,
      description: step.description || '',
      isPacked: false,
      source: null,
      isAmbiguous: false,
    });
  }

  return { items, requirements };
}

/**
 * Enrich checklist items with additional provenance and formatting.
 * @param {Array} items - Raw checklist items from generateServiceChecklist
 * @param {Object} service - Service record for source resolution
 * @returns {Array} Enriched checklist items
 */
function enrichChecklistItems(items) {
  return items.map((item, idx) => {
    // Ensure all items have required fields
    const enriched = {
      id: item.id || `chk_${Date.now()}_${idx}`,
      type: item.type || 'unverified',
      label: item.label || 'Checklist item',
      description: item.description || '',
      isPacked: item.isPacked !== undefined ? item.isPacked : false,
      condition: item.condition || null,
      source: item.source || null,
      isAmbiguous: item.isAmbiguous || false,
    };

    // Validate against schema and fallback if invalid
    const validationErrors = validateChecklistItem(enriched);
    if (validationErrors.length > 0) {
      console.warn(`Checklist item ${enriched.id} failed validation, using fallback:`, validationErrors);
      return createChecklistItem({
        id: enriched.id,
        type: 'unverified',
        label: enriched.label,
        description: enriched.description,
      });
    }

    return enriched;
  });
}

/**
 * Record a visit outcome with explicit citizen approval.
 * 
 * @param {Object} plan - The visit plan whose outcome is being recorded
 * @param {Object} options - Outcome recording options
 * @param {string} options.outcomeStatus - One of VISIT_OUTCOME values
 * @param {string} [options.outcomeNotes] - Citizen-entered notes
 * @param {string} [options.recordedBy] - Opaque identifier (defaults to 'citizen')
 * @param {boolean} [options.explicitlyApproved] - Whether citizen approved this change
 * @returns {Object} Updated visit plan with recorded outcome
 * @throws {Error} If the plan is invalid or outcome recording is blocked
 */
function recordVisitOutcome(plan, { outcomeStatus, outcomeNotes, recordedBy, explicitlyApproved } = {}) {
  // Validate that we have a plan
  if (!plan || typeof plan !== 'object') {
    throw new Error('Valid visit plan is required to record an outcome');
  }

  // Determine if explicit approval is needed
  // Outcome changes from PENDING_VISIT to any final status require approval
  const fromPending = plan.outcome && plan.outcome.status === 'PENDING_VISIT';
  const toFinal = outcomeStatus && ['COMPLETED', 'RESCHEDULED', 'TOKEN_ISSUED', 'ADDITIONAL_DOCS_REQUESTED', 'CANCELLED'].includes(outcomeStatus);

  const needsApproval = fromPending && toFinal && !explicitlyApproved;

  if (needsApproval && !explicitlyApproved) {
    throw new Error(
      'Explicit citizen approval required to record visit outcome. ' +
      'This is a high-impact action that cannot be performed autonomously.'
    );
  }

  // Create updated outcome
  const updatedOutcome = updateVisitOutcome(
    plan.outcome,
    {
      status: outcomeStatus || plan.outcome.status || 'PENDING_VISIT',
      outcome: outcomeStatus || plan.outcome.outcome || 'PENDING_VISIT',
      outcomeNotes: outcomeNotes !== undefined ? outcomeNotes : (plan.outcome.outcomeNotes || ''),
      recordedBy: recordedBy || plan.outcome.recordedBy || 'citizen',
    },
    explicitlyApproved || (fromPending && toFinal ? true : false)
  );

  // Update the plan with the new outcome
  const updatedPlan = updateVisitPlan(plan, {
    outcome: updatedOutcome,
    'outcome.status': updatedOutcome.status,
    'outcome.outcome': updatedOutcome.outcome,
    'outcome.outcomeNotes': updatedOutcome.outcomeNotes,
    'outcome.recordedAt': updatedOutcome.recordedAt,
    'outcome.recordedBy': updatedOutcome.recordedBy,
  });

  return updatedPlan;
}

/**
 * Generate a printable visit pack HTML for the given plan.
 * @param {Object} plan - The visit plan
 * @returns {string} Ink-friendly HTML document
 */
function buildPrintableHtml(plan) {
  if (!plan || !plan.buildPrintableHtml) {
    return '<html><body>Invalid visit plan</body></html>';
  }
  return plan.buildPrintableHtml();
}

/**
 * Generate a printable visit pack text for the given plan.
 * @param {Object} plan - The visit plan
 * @returns {string} Plain text document suitable for SMS/clipboard
 */
function buildPrintableText(plan) {
  if (!plan || !plan.buildPrintableText) {
    return 'Invalid visit plan';
  }
  return plan.buildPrintableText();
}

/**
 * Get the office verification status for display to the citizen.
 * @param {Object} plan - The visit plan
 * @returns {Object} Verification status info
 */
function getOfficeVerificationInfo(plan) {
  if (!plan.officeDataStatus) {
    return { status: OFFICE_VERIFICATION_STATUS.UNVERIFIED, message: 'Office data not verified' };
  }

  switch (plan.officeDataStatus) {
    case OFFICE_VERIFICATION_STATUS.FRESH:
      return { status: 'FRESH', message: 'Office data verified recently' };
    case OFFICE_VERIFICATION_STATUS.STALE:
      return { status: 'STALE', message: 'Office data may be outdated - verify at counter' };
    default:
      return { status: 'UNVERIFIED', message: 'No source data available' };
  }
}

/**
 * Validate a visit plan's external input at the trust boundary.
 * This is a standalone validation function that can be used
 * before any operation on external data.
 * @param {Object} data - Data to validate
 * @returns {Array} List of validation errors (empty if valid)
 */
export function validateVisitPlanInput(data) {
  return validateVisitPlan(data);
}

// Export functions for synthetic fixtures and external use
export {
  createVisitPlan,
  updateVisitPlan,
  validateVisitPlan,
  createChecklistItem,
  updateChecklistItem,
  validateChecklistItem,
  createVisitOutcome,
  updateVisitOutcome,
  validateVisitOutcome,
  recordVisitOutcome,
  buildPrintableHtml,
  buildPrintableText,
  getOfficeVerificationInfo,
};