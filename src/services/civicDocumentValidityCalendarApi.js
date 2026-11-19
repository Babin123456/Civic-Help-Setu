/**
 * Civic Service Document Validity Calendar API
 *
 * Server-side API for document validity calendar evaluations with:
 * - Request validation on client and server
 * - Structured error responses
 * - Pagination and aggregation for large datasets
 * - Provider credentials kept server-side
 * - Paginate or aggregate large datasets rather than loading full catalogue
 */

import {
  VALIDITY_TYPE,
  VALIDITY_STATUS,
  SERVICE_FRESHNESS_RULES,
  DEPENDENCY_LANES,
  evaluateDocumentValidity,
  generateAIExplanation,
  documentValidityStore,
} from './civicDocumentValidityCalendarService.js';

/**
 * Validation result type
 */
export type ValidationResult = {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
  warnings: Array<{ field: string; message: string }>;
};

/**
 * Validate a document validity evaluation request
 *
 * @param {Object} input - The input object to validate
 * @returns {ValidationResult} Validation result with errors/warnings
 */
function validateInput(input = {}) {
  const errors: Array<{ field: string; message: string }> = [];
  const warnings: Array<{ field: string; message: string }> = [];

  // Validate document types
  if (input.documentTypes && Array.isArray(input.documentTypes)) {
    for (let i = 0; i < input.documentTypes.length; i++) {
      const docType = input.documentTypes[i];
      if (!docType || typeof docType !== 'string') {
        errors.push({
          field: `documentTypes[${i}]`,
          message: 'Document type must be a non-empty string',
        });
      } else if (docType.trim().length === 0) {
        errors.push({
          field: `documentTypes[${i}]`,
          message: 'Document type cannot be empty',
        });
      }
    }
  }

  // Validate issue date if provided
  if (input.issueDate !== undefined) {
    if (typeof input.issueDate !== 'string') {
      errors.push({
        field: 'issueDate',
        message: 'Issue date must be a string in YYYY-MM-DD format',
      });
    } else {
      // Basic format validation - reject clearly invalid dates
      const dateParts = input.issueDate.split('-');
      if (dateParts.length !== 3) {
        errors.push({
          field: 'issueDate',
          message: 'Issue date must be in YYYY-MM-DD format',
        });
      } else {
        const [year, month, day] = dateParts.map(Number);
        if (
          isNaN(year) ||
          isNaN(month) ||
          isNaN(day) ||
          month < 1 ||
          month > 12 ||
          day < 1 ||
          day > 31
        ) {
          errors.push({
            field: 'issueDate',
            message: 'Issue date contains invalid values',
          });
        }
      }
    }
  }

  // Validate state key
  if (input.stateKey !== undefined) {
    if (typeof input.stateKey !== 'string') {
      errors.push({
        field: 'stateKey',
        message: 'State key must be a string',
      });
    } else if (
      !['TAMIL_NADU', 'MAHARASHTRA', 'CENTRAL'].includes(input.stateKey.toUpperCase())
    ) {
      warnings.push({
        field: 'stateKey',
        message: 'Unrecognized state key, defaulting to CENTRAL rules',
      });
    }
  }

  // Validate service IDs
  if (input.serviceIds && Array.isArray(input.serviceIds)) {
    for (let i = 0; i < input.serviceIds.length; i++) {
      const serviceId = input.serviceIds[i];
      if (!serviceId || typeof serviceId !== 'string') {
        errors.push({
          field: `serviceIds[${i}]`,
          message: 'Service ID must be a non-empty string',
        });
      }
    }
  }

  // Validate AI explanation request
  if (input.generateAIExplanation) {
    if (typeof input.generateAIExplanation !== 'boolean') {
      errors.push({
        field: 'generateAIExplanation',
        message: 'generateAIExplanation must be a boolean',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate and evaluate document validity for a single document type.
 *
 * @param {Object} input - Evaluation input
 * @param {string} input.documentTitle - Document type/title
 * @param {string} [input.issueDate] - Issue date (YYYY-MM-DD)
 * @param {string} [input.stateKey] - State/jurisdiction key
 * @param {string} [input.serviceId] - Optional service ID for freshness rules
 * @returns {Object} Evaluation result or validation error
 */
export function validateAndEvaluateDocument(input = {}) {
  const validation = validateInput(input);

  if (!validation.valid) {
    return {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input parameters',
        details: validation.errors,
      },
    };
  }

  try {
    const { documentTitle, issueDate, stateKey = 'CENTRAL', serviceId } = input;

    if (!documentTitle) {
      return {
        error: {
          code: 'MISSING_REQUIRED',
          message: 'documentTitle is required',
        },
      };
    }

    // Evaluate document validity with service context
    const validity = evaluateDocumentValidity({
      category: documentTitle.toUpperCase().replace(/[^A-Z]/g, ''),
      stateKey: stateKey.toUpperCase(),
      issueDate,
      serviceId,
    });

    // Get dependency lane info
    const dependencyLane = serviceId
      ? getLaneForDocAndService(
          documentTitle.toUpperCase().replace(/[^A-Z]/g, ''),
          serviceId
        ) : null;

    return {
      data: {
        documentTitle,
        validityType: validity.validityType,
        status: validity.status,
        expiryDate: validity.expiryDate,
        daysRemaining: validity.daysRemaining,
        officialSource: validity.officialSource,
        lastVerifiedDate: validity.lastVerifiedDate,
        renewalGuidanceUrl: validity.renewalGuidanceUrl,
        freshnessInfo: validity.freshnessInfo,
        dependencyLane,
      },
      error: null,
    };
  } catch (err) {
    return {
      error: {
        code: 'EVALUATION_ERROR',
        message: err.message || 'Failed to evaluate document validity',
        details: [{ field: 'unknown', message: err.message }],
      },
    };
  }
}

/**
 * Batch evaluate multiple document types against multiple services.
 *
 * @param {Object} input - Batch evaluation input
 * @param {string[]} input.documentTypes - Array of document type titles
 * @param {string} [input.issueDate] - Optional common issue date for all documents
 * @param {string} [input.stateKey] - State/jurisdiction key
 * @param {string[]} [input.serviceIds] - Optional array of service IDs
 * @returns {Object} Batch evaluation result with errors and data
 */
export function batchEvaluateDocuments(input = {}) {
  const validation = validateInput(input);

  if (!validation.valid) {
    return {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid batch input parameters',
        details: validation.errors,
      },
    };
  }

  try {
    const { documentTypes, issueDate, stateKey = 'CENTRAL', serviceIds = [] } = input;

    if (!documentTypes || !Array.isArray(documentTypes) || documentTypes.length === 0) {
      return {
        error: {
          code: 'MISSING_REQUIRED',
          message: 'documentTypes array is required and must not be empty',
        },
      };
    }

    // Evaluate each document type
    const results = documentTypes.map((docType, idx) => {
      try {
        const validity = evaluateDocumentValidity({
          category: docType.toUpperCase().replace(/[^A-Z]/g, ''),
          stateKey: stateKey.toUpperCase(),
          issueDate,
          serviceIds: serviceIds.length > 0 ? serviceIds : undefined,
        });

        const lanes = [];
        if (serviceIds.length > 0) {
          serviceIds.forEach((serviceId) => {
            const lane = getLaneForDocAndService(
              docType.toUpperCase().replace(/[^A-Z]/g, ''),
              serviceId
            );
            if (lane) {
              lanes.push({
                serviceId,
                ...lane,
              });
            }
          });
        }

        return {
          documentTitle: docType,
          validityType: validity.validityType,
          status: validity.status,
          expiryDate: validity.expiryDate,
          daysRemaining: validity.daysRemaining,
          officialSource: validity.officialSource,
          lastVerifiedDate: validity.lastVerifiedDate,
          renewalGuidanceUrl: validity.renewalGuidanceUrl,
          freshnessInfo: validity.freshnessInfo,
          dependencyLanes: lanes,
        };
      } catch (err) {
        return {
          documentTitle: docType,
          error: {
            code: 'EVALUATION_ERROR',
            message: err.message || 'Failed to evaluate document',
          },
        };
      }
    });

    return {
      data: {
        totalEvaluated: results.length,
        stateKey,
        issueDate,
        results,
      },
      error: null,
    };
  } catch (err) {
    return {
      error: {
        code: 'BATCH_ERROR',
        message: err.message || 'Failed to batch evaluate documents',
      },
    };
  }
}

/**
 * Generate AI explanation for document staleness with guardrails.
 *
 * @param {Object} input - AI explanation input
 * @param {string} input.documentTitle - Document type/title
 * @param {string} input.issueDate - Issue date (YYYY-MM-DD)
 * @param {string} [input.serviceId] - Target service ID
 * @param {string} [input.stateKey] - State/jurisdiction key
 * @returns {Object} AI explanation with source references and guardrail disclaimer
 */
export function validateAndGenerateAIExplanation(input = {}) {
  const validation = validateInput(input);

  if (!validation.valid) {
    return {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid AI explanation input',
        details: validation.errors,
      },
    };
  }

  try {
    const { documentTitle, issueDate, serviceId, stateKey } = input;

    if (!documentTitle) {
      return {
        error: {
          code: 'MISSING_REQUIRED',
          message: 'documentTitle is required for AI explanation',
        },
      };
    }

    if (!issueDate) {
      return {
        error: {
          code: 'MISSING_REQUIRED',
          message: 'issueDate is required for AI explanation',
        },
      };
    }

    // Generate AI explanation
    const explanation = generateAIExplanation({
      documentTitle,
      issueDate,
      serviceId,
      stateKey,
    });

    return {
      data: explanation,
      error: null,
    };
  } catch (err) {
    return {
      error: {
        code: 'AI_EXPLANATION_ERROR',
        message: err.message || 'Failed to generate AI explanation',
      },
    };
  }
}

/**
 * Get available document types and their validity rules for a given state.
 *
 * @param {Object} input - State key input
 * @param {string} input.stateKey - State/jurisdiction key
 * @returns {Object} Available document types and rules
 */
export function getDocumentTypesForState(input = {}) {
  const validation = validateInput(input);

  if (!validation.valid) {
    return {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid state key',
        details: validation.errors,
      },
    };
  }

  try {
    const { stateKey = 'CENTRAL' } = input;
    const upperKey = stateKey.toUpperCase();

    const catalogue = DOCUMENT_VALIDITY_CATALOGUE[upperKey] || DOCUMENT_VALIDITY_CATALOGUE.CENTRAL;

    const documentTypes = Object.entries(catalogue).map(([key, rule]) => ({
      category: key,
      docName: rule.docName,
      validityType: rule.validityType,
      standardTenureMonths: rule.standardTenureMonths,
      officialSource: rule.officialSource,
      sourceUrl: rule.sourceUrl,
      lastVerifiedDate: rule.lastVerifiedDate,
    }));

    return {
      data: {
        stateKey: upperKey,
        totalDocumentTypes: documentTypes.length,
        documentTypes,
      },
      error: null,
    };
  } catch (err) {
    return {
      error: {
        code: 'FETCH_ERROR',
        message: err.message || 'Failed to fetch document types',
      },
    };
  }
}

/**
 * Get dependency lanes for a given document type and optional service.
 *
 * @param {Object} input - Lane lookup input
 * @param {string} input.documentType - Document category (e.g. 'INCOME_CERTIFICATE')
 * @param {string} [input.serviceId] - Optional service ID
 * @returns {Object} Dependency lane configuration
 */
export function getDependencyLaneInfo(input = {}) {
  const validation = validateInput(input);

  if (!validation.valid) {
    return {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid lane lookup input',
        details: validation.errors,
      },
    };
  }

  try {
    const { documentType, serviceId } = input;
    const docKey = documentType.toUpperCase().replace(/[^A-Z]/g, '');

    const lane = getLaneForDocAndService(docKey, serviceId);

    return {
      data: {
        documentType,
        serviceId: serviceId || 'none',
        lane: lane || null,
        availableLanes: Object.keys(DEPENDENCY_LANES),
      },
      error: null,
    };
  } catch (err) {
    return {
      error: {
        code: 'LANE_LOOKUP_ERROR',
        message: err.message || 'Failed to lookup dependency lane',
      },
    };
  }
}

/**
 * Export validity calendar summary for a set of records.
 *
 * @param {Array<Object>} records - Document validity records
 * @param {Object} [options] - Export options
 * @param {boolean} [options.includeFreshness] - Include freshness rule adjustments
 * @param {boolean} [includeDependencyLanes] - Include dependency lane info
 * @returns {Object} Export payload with disclaimer and metadata
 */
export function exportValidityCalendarSummary(records = [], options = {}) {
  try {
    const includedRecords = records.map((r) => ({
      documentTitle: r.documentTitle,
      validityType: r.validityType,
      validityStatus: r.validityStatus,
      expiryDate: r.expiryDate || 'N/A (Lifetime)',
      daysRemaining: r.daysRemaining !== null ? r.daysRemaining : 'Permanent',
      officialSource: r.officialSource || 'N/A',
      renewalLink: r.renewalGuidanceUrl || 'N/A',
      freshnessInfo: options.includeFreshness ? r.freshnessInfo : null,
      dependencyLanes: options.includeDependencyLanes ? r.dependencyLanes : null,
    }));

    return {
      exportedAt: new Date().toISOString(),
      totalTrackedDocuments: includedRecords.length,
      includeFreshness: options.includeFreshness || false,
      includeDependencyLanes: options.includeDependencyLanes || false,
      disclaimer:
        'This document validity calendar tracks statutory renewal schedules. No document contents or ' +
        'identity credentials are saved in this export. Freshness rules and dependency lanes are ' +
        'service-specific and may differ from official government expiry dates.',
      schedule: includedRecords,
    };
  } catch (err) {
    return {
      error: {
        code: 'EXPORT_ERROR',
        message: err.message || 'Failed to export validity calendar',
      },
    };
  }
}

export type {
  ValidationResult,
};

/**
 * Default export for convenience - the full service module re-export
 */
export * from './civicDocumentValidityCalendarService.js';