/**
 * Community-Reviewed Translation and Terminology Governance Service (#772)
 * 
 * Service layer for managing civic terminology across Indian languages.
 * Handles term creation, translation suggestions, review assignments,
 * version tracking and source reference management.
 * 
 * Business logic lives here; UI components are presentation-only.
 */

import { 
  createTerm,
  createLanguageVariant,
  createTranslationSuggestion,
  createReviewAssignment,
  createTerminologyVersion,
  createSourceReference,
 } from '../data/translationTerms.js';
import { 
  getAllTerms, saveTerm, updateTerm, deleteTerm,
  getAllLanguageVariants, saveLanguageVariant, updateLanguageVariant, deleteLanguageVariant,
  getLanguageVariantsByTermId, getApprovedLanguageVariantsByTermId, getPendingLanguageVariantsByTermId,
  getAllTranslationSuggestions, saveTranslationSuggestion, updateTranslationSuggestion, deleteTranslationSuggestion,
  getPendingTranslationSuggestions, getTranslationSuggestionsByTermId, getSuggestionsByContributor,
  getAllReviewAssignments, saveReviewAssignment, updateReviewAssignment, deleteReviewAssignment,
  getAllTerminologyVersions, saveTerminologyVersion, getTerminologyVersionsByTermId,
  getAllSourceReferences, saveSourceReference, getSourceReferencesByTermId, getSourceReferencesByVariantId,
  executeTransaction, getStatistics, searchTerms,
  getTermById, getLanguageVariantById, getTranslationSuggestionById, getReviewAssignmentById
 } from '../data/translationStore.js';

/**
 * Permission constants for role-based access control
 */
export const TRANSLATION_PERMISSIONS = {
  TERM_READ: 'translation.read',
  TERM_CREATE: 'translation.create',
  TERM_UPDATE: 'translation.update',
  TERM_DELETE: 'translation.delete',
  SUGGESTION_READ: 'suggestion.read',
  SUGGESTION_CREATE: 'suggestion.create',
  SUGGESTION_APPROVE: 'suggestion.approve',
  SUGGESTION_REJECT: 'suggestion.reject',
  REVIEW_ASSIGN_READ: 'review.read',
  REVIEW_ASSIGN_CREATE: 'review.create',
  REVIEW_ASSIGN_UPDATE: 'review.update',
  VERSION_READ: 'version.read',
  VERSION_CREATE: 'version.create',
  SOURCE_READ: 'source.read',
  SOURCE_CREATE: 'source.create',
};

/**
 * Role constants
 */
export const TRANSLATION_ROLES = {
  CITIZEN: 'citizen',
  CONTRIBUTOR: 'contributor',
  REVIEWER: 'reviewer',
  OPERATOR: 'operator',
  ADMIN: 'admin',
};

/**
 * Check if a user has a specific permission
 * @param {string} permission - permission key
 * @param {string} userRole - user's role
 * @returns {boolean}
 */
export function hasPermission(permission, userRole) {
  const permissionRequirements = {
    [TRANSLATION_PERMISSIONS.TERM_READ]: [TRANSLATION_ROLES.CITIZEN, TRANSLATION_ROLES.CONTRIBUTOR, TRANSLATION_ROLES.REVIEWER, TRANSLATION_ROLES.OPERATOR, TRANSLATION_ROLES.ADMIN],
    [TRANSLATION_PERMISSIONS.TERM_CREATE]: [TRANSLATION_ROLES.CONTRIBUTOR, TRANSLATION_ROLES.REVIEWER, TRANSLATION_ROLES.OPERATOR, TRANSLATION_ROLES.ADMIN],
    [TRANSLATION_PERMISSIONS.TERM_UPDATE]: [TRANSLATION_ROLES.CONTRIBUTOR, TRANSLATION_ROLES.REVIEWER, TRANSLATION_ROLES.OPERATOR, TRANSLATION_ROLES.ADMIN],
    [TRANSLATION_PERMISSIONS.TERM_DELETE]: [TRANSLATION_ROLES.ADMIN],
    [TRANSLATION_PERMISSIONS.SUGGESTION_READ]: [TRANSLATION_ROLES.CITIZEN, TRANSLATION_ROLES.CONTRIBUTOR, TRANSLATION_ROLES.REVIEWER, TRANSLATION_ROLES.OPERATOR, TRANSLATION_ROLES.ADMIN],
    [TRANSLATION_PERMISSIONS.SUGGESTION_CREATE]: [TRANSLATION_ROLES.CITIZEN, TRANSLATION_ROLES.CONTRIBUTOR],
    [TRANSLATION_PERMISSIONS.SUGGESTION_APPROVE]: [TRANSLATION_ROLES.REVIEWER, TRANSLATION_ROLES.OPERATOR, TRANSLATION_ROLES.ADMIN],
    [TRANSLATION_PERMISSIONS.SUGGESTION_REJECT]: [TRANSLATION_ROLES.REVIEWER, TRANSLATION_ROLES.OPERATOR, TRANSLATION_ROLES.ADMIN],
    [TRANSLATION_PERMISSIONS.REVIEW_ASSIGN_READ]: [TRANSLATION_ROLES.CITIZEN, TRANSLATION_ROLES.CONTRIBUTOR, TRANSLATION_ROLES.REVIEWER, TRANSLATION_ROLES.OPERATOR, TRANSLATION_ROLES.ADMIN],
    [TRANSLATION_PERMISSIONS.REVIEW_ASSIGN_CREATE]: [TRANSLATION_ROLES.CONTRIBUTOR, TRANSLATION_ROLES.REVIEWER, TRANSLATION_ROLES.OPERATOR, TRANSLATION_ROLES.ADMIN],
    [TRANSLATION_PERMISSIONS.REVIEW_ASSIGN_UPDATE]: [TRANSLATION_ROLES.REVIEWER, TRANSLATION_ROLES.OPERATOR, TRANSLATION_ROLES.ADMIN],
    [TRANSLATION_PERMISSIONS.VERSION_READ]: [TRANSLATION_ROLES.CITIZEN, TRANSLATION_ROLES.CONTRIBUTOR, TRANSLATION_ROLES.REVIEWER, TRANSLATION_ROLES.OPERATOR, TRANSLATION_ROLES.ADMIN],
    [TRANSLATION_PERMISSIONS.VERSION_CREATE]: [TRANSLATION_ROLES.CONTRIBUTOR, TRANSLATION_ROLES.REVIEWER, TRANSLATION_ROLES.OPERATOR, TRANSLATION_ROLES.ADMIN],
    [TRANSLATION_PERMISSIONS.SOURCE_READ]: [TRANSLATION_ROLES.CITIZEN, TRANSLATION_ROLES.CONTRIBUTOR, TRANSLATION_ROLES.REVIEWER, TRANSLATION_ROLES.OPERATOR, TRANSLATION_ROLES.ADMIN],
    [TRANSLATION_PERMISSIONS.SOURCE_CREATE]: [TRANSLATION_ROLES.CONTRIBUTOR, TRANSLATION_ROLES.REVIEWER, TRANSLATION_ROLES.OPERATOR, TRANSLATION_ROLES.ADMIN],
  };
  
  const allowedRoles = permissionRequirements[permission];
  if (!allowedRoles) return false;
  return allowedRoles.includes(userRole);
}

/**
 * Validation helpers for term data
 */

/**
 * Validate term creation payload
 * @param {Object} payload - term creation data
 * @returns {Array} errors list (empty = valid)
 */
function validateTermPayload(payload) {
  const errors = [];
  
  if (!payload || typeof payload !== 'object') {
    errors.push('payload must be an object');
    return errors;
  }
  
  if (!payload.sourceText || typeof payload.sourceText !== 'string' || payload.sourceText.trim().length === 0) {
    errors.push('sourceText is required and must be a non-empty string');
  }
  
  if (payload.category && typeof payload.category !== 'string') {
    errors.push('category must be a string if provided');
  }
  
  if (payload.legalContext && typeof payload.legalContext !== 'string') {
    errors.push('legalContext must be a string if provided');
  }
  
  if (payload.sourceReference) {
    if (payload.sourceReference.sourceName && typeof payload.sourceReference.sourceName !== 'string') {
      errors.push('sourceReference.sourceName must be a string if provided');
    }
    if (payload.sourceReference.sourceUrl && typeof payload.sourceReference.sourceUrl !== 'string') {
      errors.push('sourceReference.sourceUrl must be a string if provided');
    }
    if (payload.sourceReference.sourceUrl && !payload.sourceReference.sourceUrl.startsWith('https://')) {
      errors.push('sourceReference.sourceUrl must be an HTTPS URL if provided');
    }
  }
  
  if (payload.sourceLanguage && !['en', 'hi', 'bn', 'ta', 'ur', 'pa', 'gu', 'ml', 'kn', 'mr'].includes(payload.sourceLanguage)) {
    errors.push('sourceLanguage must be a valid language code');
  }
  
  return errors;
}

/**
 * Validation helpers for language variant data
 */
function validateLanguageVariantPayload(payload) {
  const errors = [];
  
  if (!payload || typeof payload !== 'object') {
    errors.push('payload must be an object');
    return errors;
  }
  
  if (!payload.termId || typeof payload.termId !== 'string') {
    errors.push('termId is required and must be a string');
  }
  
  if (!payload.languageCode || typeof payload.languageCode !== 'string') {
    errors.push('languageCode is required and must be a string');
  } else if (!['en', 'hi', 'bn', 'ta', 'ur', 'pa', 'gu', 'ml', 'kn', 'mr'].includes(payload.languageCode)) {
    errors.push('languageCode must be a valid language code');
  }
  
  if (!payload.languageName || typeof payload.languageName !== 'string' || payload.languageName.trim().length === 0) {
    errors.push('languageName is required and must be a non-empty string');
  }
  
  return errors;
}

/**
 * Validation helpers for translation suggestion data
 */
function validateTranslationSuggestionPayload(payload) {
  const errors = [];
  
  if (!payload || typeof payload !== 'object') {
    errors.push('payload must be an object');
    return errors;
  }
  
  if (!payload.termId || typeof payload.termId !== 'string') {
    errors.push('termId is required and must be a string');
  }
  
  if (!payload.languageCode || typeof payload.languageCode !== 'string') {
    errors.push('languageCode is required and must be a string');
  } else if (!['en', 'hi', 'bn', 'ta', 'ur', 'pa', 'gu', 'ml', 'kn', 'mr'].includes(payload.languageCode)) {
    errors.push('languageCode must be a valid language code');
  }
  
  if (!payload.contributorId || typeof payload.contributorId !== 'string') {
    errors.push('contributorId is required and must be a string');
  }
  
  if (payload.transliteration && typeof payload.transliteration !== 'string') {
    errors.push('transliteration must be a string if provided');
  }
  
  if (payload.plainLanguageDefinition) {
    if (typeof payload.plainLanguageDefinition !== 'string' || payload.plainLanguageDefinition.trim().length === 0) {
      errors.push('plainLanguageDefinition must be a non-empty string if provided');
    }
  }
  
  if (payload.usageExample) {
    if (typeof payload.usageExample !== 'string' || payload.usageExample.trim().length === 0) {
      errors.push('usageExample must be a non-empty string if provided');
    }
  }
  
  if (payload.rationale && typeof payload.rationale !== 'string') {
    errors.push('rationale must be a string if provided');
  }
  
  return errors;
}

/**
 * Validation helpers for review assignment data
 */
function validateReviewAssignmentPayload(payload) {
  const errors = [];
  
  if (!payload || typeof payload !== 'object') {
    errors.push('payload must be an object');
    return errors;
  }
  
  if (!payload.suggestionId || typeof payload.suggestionId !== 'string') {
    errors.push('suggestionId is required and must be a string');
  }
  
  if (!payload.assigneeId || typeof payload.assigneeId !== 'string') {
    errors.push('assigneeId is required and must be a string');
  }
  
  if (payload.priority && !['low', 'medium', 'high', 'urgent'].includes(payload.priority)) {
    errors.push('priority must be one of: low, medium, high, urgent');
  }
  
  if (payload.status && !['pending', 'in_review', 'approved', 'rejected'].includes(payload.status)) {
    errors.push('status must be one of: pending, in_review, approved, rejected');
  }
  
  return errors;
}

/**
 * Validation helpers for terminology version data
 */
function validateTerminologyVersionPayload(payload) {
  const errors = [];
  
  if (!payload || typeof payload !== 'object') {
    errors.push('payload must be an object');
    return errors;
  }
  
  if (!payload.termId || typeof payload.termId !== 'string') {
    errors.push('termId is required and must be a string');
  }
  
  if (payload.versionNumber !== undefined && (typeof payload.versionNumber !== 'number' || !Number.isInteger(payload.versionNumber))) {
    errors.push('versionNumber must be an integer if provided');
  }
  
  if (payload.changeSummary && typeof payload.changeSummary !== 'string') {
    errors.push('changeSummary must be a string if provided');
  }
  
  return errors;
}

/**
 * Validation helpers for source reference data
 */
function validateSourceReferencePayload(payload) {
  const errors = [];
  
  if (!payload || typeof payload !== 'object') {
    errors.push('payload must be an object');
    return errors;
  }
  
  if (!payload.sourceName || typeof payload.sourceName !== 'string' || payload.sourceName.trim().length === 0) {
    errors.push('sourceName is required and must be a non-empty string');
  }
  
  if (payload.sourceUrl && typeof payload.sourceUrl !== 'string') {
    errors.push('sourceUrl must be a string if provided');
  }
  
  if (payload.sourceUrl && !payload.sourceUrl.startsWith('https://')) {
    errors.push('sourceUrl must be an HTTPS URL if provided');
  }
  
  if (payload.sourceType && !['statute', 'caseLaw', 'governmentCircular', 'judgment', 'other'].includes(payload.sourceType)) {
    errors.push('sourceType must be a valid source type if provided');
  }
  
  return errors;
}

/**
 * TERM OPERATIONS
 */

/**
 * Create a new civic term
 * @param {Object} payload - term data
 * @param {string} userRole - role of the requesting user
 * @returns {Object} { success, term, error }
 */
export function createTermService(payload, userRole) {
  // Check permission
  if (!hasPermission(TRANSLATION_PERMISSIONS.TERM_CREATE, userRole)) {
    return { success: false, error: 'Permission denied: translation.create required' };
  }
  
  // Validate payload
  const validationErrors = validateTermPayload(payload);
  if (validationErrors.length > 0) {
    return { success: false, error: `Validation failed: ${validationErrors.join(', ')}` };
  }
  
  // Generate stable ID
  const id = `${payload.sourceLanguage}-${payload.sourceText.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
  
  const term = createTerm(id, {
    sourceLanguage: payload.sourceLanguage || 'en',
    sourceText: payload.sourceText.trim(),
    category: payload.category,
    legalContext: payload.legalContext,
    sourceReference: payload.sourceReference,
    createdBy: payload.createdBy,
  });
  
  saveTerm(term);
  
  return { success: true, term };
}

/**
 * Get all terms with optional filters
 * @param {Object} filters - category, languageCode
 * @param {string} userRole - role of the requesting user
 * @returns {Object} { success, terms }
 */
export function getTermsService(filters = {}, userRole) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.TERM_READ, userRole)) {
    return { success: false, error: 'Permission denied: translation.read required' };
  }
  
  let terms = getAllTerms();
  
  // Apply category filter
  if (filters.category) {
    terms = terms.filter(t => t.category === filters.category);
  }
  
  // Apply search query
  if (filters.query) {
    terms = searchTerms(filters.query, { category: filters.category });
  }
  
  return { success: true, terms };
}

/**
 * Get term by ID
 * @param {string} id - term ID
 * @param {string} userRole - role of the requesting user
 * @returns {Object} { success, term, error }
 */
export function getTermByIdService(id, userRole) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.TERM_READ, userRole)) {
    return { success: false, error: 'Permission denied: translation.read required' };
  }
  
  const term = getTermById(id);
  if (!term) {
    return { success: false, error: `Term with ID ${id} not found` };
  }
  
  return { success: true, term };
}

/**
 * Update a term
 * @param {string} id - term ID
 * @param {Object} changes - changes to apply
 * @param {string} userRole - role of the requesting user
 * @returns {Object} { success, term, error }
 */
export function updateTermService(id, changes, userRole) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.TERM_UPDATE, userRole)) {
    return { success: false, error: 'Permission denied: translation.update required' };
  }
  
  // Validate changes if provided
  if (changes) {
    const validationErrors = validateTermPayload({ ...getTermById(id), ...changes });
    // Only check new fields - simplify validation for update
    if (changes.sourceText && (typeof changes.sourceText !== 'string' || changes.sourceText.trim().length === 0)) {
      return { success: false, error: 'sourceText must be a non-empty string' };
    }
    if (changes.category && typeof changes.category !== 'string') {
      return { success: false, error: 'category must be a string' };
    }
    if (changes.legalContext && typeof changes.legalContext !== 'string') {
      return { success: false, error: 'legalContext must be a string' };
    }
  }
  
  const updated = updateTerm(id, changes);
  if (!updated) {
    return { success: false, error: `Term with ID ${id} not found` };
  }
  
  return { success: true, term: updated };
}

/**
 * Delete a term
 * @param {string} id - term ID
 * @param {string} userRole - role of the requesting user
 * @returns {Object} { success, error }
 */
export function deleteTermService(id, userRole) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.TERM_DELETE, userRole)) {
    return { success: false, error: 'Permission denied: translation.delete required' };
  }
  
  // Check if term has associated language variants or suggestions
  const variants = getLanguageVariantsByTermId(id);
  const suggestions = getTranslationSuggestionsByTermId(id);
  
  if (variants.length > 0) {
    return { success: false, error: `Cannot delete term: ${variants.length} associated language variant(s) exist. Reassign or delete variants first.` };
  }
  
  if (suggestions.length > 0) {
    return { success: false, error: `Cannot delete term: ${suggestions.length} associated translation suggestion(s) exist. Reassign or delete suggestions first.` };
  }
  
  const result = deleteTerm(id);
  if (!result) {
    return { success: false, error: `Term with ID ${id} not found` };
  }
  
  return { success: true };
}

/**
 * LANGUAGE VARIANT OPERATIONS
 */

/**
 * Create a new language variant (translation/transliteration)
 * @param {Object} payload - variant data
 * @param {string} userRole - role of the requesting user
 * @returns {Object} { success, variant, error }
 */
export function createLanguageVariantService(payload, userRole) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.TERM_CREATE, userRole)) {
    return { success: false, error: 'Permission denied: translation.create required' };
  }
  
  const validationErrors = validateLanguageVariantPayload(payload);
  if (validationErrors.length > 0) {
    return { success: false, error: `Validation failed: ${validationErrors.join(', ')}` };
  }
  
  // Find the term to associate with
  const term = getTermById(payload.termId);
  if (!term) {
    return { success: false, error: `Term with ID ${payload.termId} not found` };
  }
  
  // Generate stable ID
  const languageShort = payload.languageCode.slice(0, 2);
  const id = `${payload.termId}-${languageShort}-${Date.now()}`;
  
  const variant = createLanguageVariant(id, {
    termId: payload.termId,
    languageCode: payload.languageCode,
    languageName: payload.languageName.trim(),
    transliteration: payload.transliteration,
    plainLanguageDefinition: payload.plainLanguageDefinition,
    machineDraft: payload.machineDraft,
    reviewStatus: payload.reviewStatus,
    reviewerRationale: payload.reviewerRationale,
    createdBy: payload.createdBy,
  });
  
  saveLanguageVariant(variant);
  
  return { success: true, variant };
}

/**
 * Get language variants for a term
 * @param {string} termId - term ID
 * @param {string} userRole - role of the requesting user
 * @param {Object} filters - reviewStatus filter
 * @returns {Object} { success, variants }
 */
export function getLanguageVariantsService(termId, userRole, filters = {}) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.TERM_READ, userRole)) {
    return { success: false, error: 'Permission denied: translation.read required' };
  }
  
  let variants = getLanguageVariantsByTermId(termId);
  
  // Filter by review status
  if (filters.reviewStatus) {
    variants = variants.filter(v => v.reviewStatus === filters.reviewStatus);
  }
  
  // Filter by language code
  if (filters.languageCode) {
    variants = variants.filter(v => v.languageCode === filters.languageCode);
  }
  
  return { success: true, variants };
}

/**
 * Update a language variant review status
 * @param {string} variantId - variant ID
 * @param {Object} changes - changes including reviewStatus, reviewerRationale
 * @param {string} userRole - role of the requesting user
 * @returns {Object} { success, variant, error }
 */
export function updateLanguageVariantReviewService(variantId, changes, userRole) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.SUGGESTION_APPROVE, userRole)) {
    return { success: false, error: 'Permission denied: suggestion.approve required' };
  }
  
  const variant = getLanguageVariantById(variantId);
  if (!variant) {
    return { success: false, error: `Language variant with ID ${variantId} not found` };
  }
  
  // Validate changes
  if (changes.reviewStatus && !['approved', 'rejected'].includes(changes.reviewStatus)) {
    return { success: false, error: 'reviewStatus must be approved or rejected' };
  }
  
  const updated = updateLanguageVariant(variantId, changes);
  if (!updated) {
    return { success: false, error: `Language variant with ID ${variantId} not found` };
  }
  
  return { success: true, variant: updated };
}

/**
 * TRANSLATION SUGGESTION OPERATIONS
 */

/**
 * Create a new translation suggestion
 * @param {Object} payload - suggestion data
 * @param {string} userRole - role of the requesting user
 * @returns {Object} { success, suggestion, error }
 */
export function createTranslationSuggestionService(payload, userRole) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.SUGGESTION_CREATE, userRole)) {
    return { success: false, error: 'Permission denied: suggestion.create required' };
  }
  
  const validationErrors = validateTranslationSuggestionPayload(payload);
  if (validationErrors.length > 0) {
    return { success: false, error: `Validation failed: ${validationErrors.join(', ')}` };
  }
  
  // Find the term to associate with
  const term = getTermById(payload.termId);
  if (!term) {
    return { success: false, error: `Term with ID ${payload.termId} not found` };
  }
  
  // Generate stable ID
  const id = `SUGG-${payload.termId}-${payload.languageCode}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  
  const suggestion = createTranslationSuggestion(id, {
    termId: payload.termId,
    contributorId: payload.contributorId,
    languageCode: payload.languageCode,
    transliteration: payload.transliteration,
    plainLanguageDefinition: payload.plainLanguageDefinition,
    usageExample: payload.usageExample,
    rationale: payload.rationale,
    status: 'pending_review',
    createdBy: payload.createdBy,
  });
  
  saveTranslationSuggestion(suggestion);
  
  // Create a review assignment automatically
  const assignmentId = `RA-${id}-${Date.now()}`;
  const assignment = createReviewAssignment(assignmentId, {
    suggestionId: id,
    assigneeId: payload.assignedTo || 'reviewer-pool', // default to reviewer pool
    assigneeRole: 'reviewer',
    priority: 'medium',
    status: 'pending',
  });
  
  saveReviewAssignment(assignment);
  
  return { success: true, suggestion };
}

/**
 * Get pending translation suggestions for review
 * @param {string} userRole - role of the requesting user
 * @returns {Object} { success, suggestions }
 */
export function getPendingSuggestionsService(userRole) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.SUGGESTION_READ, userRole)) {
    return { success: false, error: 'Permission denied: suggestion.read required' };
  }
  
  const suggestions = getPendingTranslationSuggestions();
  return { success: true, suggestions };
}

/**
 * Get translation suggestions for a term
 * @param {string} termId - term ID
 * @param {string} userRole - role of the requesting user
 * @returns {Object} { success, suggestions }
 */
export function getSuggestionsByTermService(termId, userRole) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.SUGGESTION_READ, userRole)) {
    return { success: false, error: 'Permission denied: suggestion.read required' };
  }
  
  const termExists = getTermById(termId);
  if (!termExists) {
    return { success: false, error: `Term with ID ${termId} not found` };
  }
  
  const suggestions = getTranslationSuggestionsByTermId(termId);
  return { success: true, suggestions };
}

/**
 * Approve a translation suggestion
 * @param {string} suggestionId - suggestion ID
 * @param {string} userRole - role of the requesting user
 * @param {Object} changes - additional changes (e.g., reviewRationale)
 * @returns {Object} { success, suggestion, error }
 */
export function approveTranslationSuggestionService(suggestionId, userRole, changes = {}) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.SUGGESTION_APPROVE, userRole)) {
    return { success: false, error: 'Permission denied: suggestion.approve required' };
  }
  
  const suggestion = getTranslationSuggestionById(suggestionId);
  if (!suggestion) {
    return { success: false, error: `Suggestion with ID ${suggestionId} not found` };
  }
  
  if (suggestion.status !== 'pending_review') {
    return { success: false, error: `Suggestion ${suggestionId} is not in pending_review status` };
  }
  
  // Update suggestion status
  const updatedSuggestion = updateTranslationSuggestion(suggestionId, {
    status: 'approved',
    ...changes,
  });
  
  // Create a terminology version entry
  const versionId = `VER-${suggestionId}-${Date.now()}`;
  const term = getTermById(suggestion.termId);
  
  const version = createTerminologyVersion(versionId, {
    termId: suggestion.termId,
    versionNumber: term ? (getTerminologyVersionsByTermId(suggestion.termId).length + 1) : 1,
    languageVariantId: suggestion.languageCode ? 
      (getLanguageVariantsByTermId(suggestion.termId).find(v => v.languageCode === suggestion.languageCode)?.id || null) : 
      null,
    changeSummary: changes.changeSummary || `Suggestion ${suggestionId} approved for publication`,
    approvedBy: userRole,
    approvalReason: changes.approvalReason || 'Community review approved',
    isPublished: true,
    parentVersionId: null,
  });
  
  saveTerminologyVersion(version);
  
  return { success: true, suggestion: updatedSuggestion, version };
}

/**
 * Reject a translation suggestion
 * @param {string} suggestionId - suggestion ID
 * @param {string} userRole - role of the requesting user
 * @param {Object} changes - rejection rationale
 * @returns {Object} { success, suggestion, error }
 */
export function rejectTranslationSuggestionService(suggestionId, userRole, changes = {}) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.SUGGESTION_REJECT, userRole) && userRole !== TRANSLATION_ROLES.CITIZEN) {
    return { success: false, error: 'Permission denied: suggestion.reject required' };
  }
  
  const suggestion = getTranslationSuggestionById(suggestionId);
  if (!suggestion) {
    return { success: false, error: `Suggestion with ID ${suggestionId} not found` };
  }
  
  // Update suggestion status
  const updatedSuggestion = updateTranslationSuggestion(suggestionId, {
    status: 'rejected',
    ...changes,
  });
  
  return { success: true, suggestion: updatedSuggestion };
}

/**
 * REVIEW ASSIGNMENT OPERATIONS
 */

/**
 * Create a review assignment
 * @param {Object} payload - assignment data
 * @param {string} userRole - role of the requesting user
 * @returns {Object} { success, assignment, error }
 */
export function createReviewAssignmentService(payload, userRole) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.REVIEW_ASSIGN_CREATE, userRole)) {
    return { success: false, error: 'Permission denied: review.create required' };
  }
  
  const validationErrors = validateReviewAssignmentPayload(payload);
  if (validationErrors.length > 0) {
    return { success: false, error: `Validation failed: ${validationErrors.join(', ')}` };
  }
  
  // Check if suggestion exists
  const suggestion = getTranslationSuggestionById(payload.suggestionId);
  if (!suggestion) {
    return { success: false, error: `Suggestion with ID ${payload.suggestionId} not found` };
  }
  
  // Generate stable ID
  const id = `RA-${payload.suggestionId}-${Date.now()}`;
  
  const assignment = createReviewAssignment(id, {
    suggestionId: payload.suggestionId,
    assigneeId: payload.assigneeId,
    assigneeRole: payload.assigneeRole || 'reviewer',
    priority: payload.priority || 'medium',
    status: payload.status || 'pending',
    reviewerComments: payload.reviewerComments,
    expiresAt: payload.expiresAt,
    createdBy: payload.createdBy,
  });
  
  saveReviewAssignment(assignment);
  
  return { success: true, assignment };
}

/**
 * Get review assignments by suggestion ID
 * @param {string} suggestionId - suggestion ID
 * @param {string} userRole - role of the requesting user
 * @returns {Object} { success, assignments }
 */
export function getReviewAssignmentsBySuggestionService(suggestionId, userRole) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.REVIEW_ASSIGN_READ, userRole)) {
    return { success: false, error: 'Permission denied: review.read required' };
  }
  
  const suggestion = getTranslationSuggestionById(suggestionId);
  if (!suggestion) {
    return { success: false, error: `Suggestion with ID ${suggestionId} not found` };
  }
  
  const assignments = getReviewAssignmentsBySuggestionId(suggestionId);
  return { success: true, assignments };
}

/**
 * Update a review assignment status
 * @param {string} assignmentId - assignment ID
 * @param {Object} changes - changes including status, reviewerComments
 * @param {string} userRole - role of the requesting user
 * @returns {Object} { success, assignment, error }
 */
export function updateReviewAssignmentService(assignmentId, changes, userRole) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.REVIEW_ASSIGN_UPDATE, userRole)) {
    return { success: false, error: 'Permission denied: review.update required' };
  }
  
  const assignment = getReviewAssignmentById(assignmentId);
  if (!assignment) {
    return { success: false, error: `Review assignment with ID ${assignmentId} not found` };
  }
  
  // Validate status if provided
  if (changes.status && !['pending', 'in_review', 'approved', 'rejected'].includes(changes.status)) {
    return { success: false, error: 'status must be one of: pending, in_review, approved, rejected' };
  }
  
  const updated = updateReviewAssignment(assignmentId, changes);
  if (!updated) {
    return { success: false, error: `Review assignment with ID ${assignmentId} not found` };
  }
  
  return { success: true, assignment: updated };
}

/**
 * TERMINOLOGY VERSION OPERATIONS
 */

/**
 * Get terminology versions for a term
 * @param {string} termId - term ID
 * @param {string} userRole - role of the requesting user
 * @returns {Object} { success, versions }
 */
export function getTerminologyVersionsService(termId, userRole) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.VERSION_READ, userRole)) {
    return { success: false, error: 'Permission denied: version.read required' };
  }
  
  const termExists = getTermById(termId);
  if (!termExists) {
    return { success: false, error: `Term with ID ${termId} not found` };
  }
  
  const versions = getTerminologyVersionsByTermId(termId);
  return { success: true, versions };
}

/**
 * Create a terminology version
 * @param {Object} payload - version data
 * @param {string} userRole - role of the requesting user
 * @returns {Object} { success, version, error }
 */
export function createTerminologyVersionService(payload, userRole) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.VERSION_CREATE, userRole)) {
    return { success: false, error: 'Permission denied: version.create required' };
  }
  
  const validationErrors = validateTerminologyVersionPayload(payload);
  if (validationErrors.length > 0) {
    return { success: false, error: `Validation failed: ${validationErrors.join(', ')}` };
  }
  
  // Find the term to associate with
  const term = getTermById(payload.termId);
  if (!term) {
    return { success: false, error: `Term with ID ${payload.termId} not found` };
  }
  
  // Generate stable ID
  const id = `VER-${payload.termId}-${payload.versionNumber}-${Date.now()}`;
  
  const version = createTerminologyVersion(id, {
    termId: payload.termId,
    versionNumber: payload.versionNumber,
    languageVariantId: payload.languageVariantId,
    changeSummary: payload.changeSummary,
    approvedBy: payload.approvedBy,
    approvalReason: payload.approvalReason,
    isPublished: payload.isPublished || false,
    parentVersionId: payload.parentVersionId,
    createdBy: payload.createdBy,
  });
  
  saveTerminologyVersion(version);
  
  return { success: true, version };
}

/**
 * SOURCE REFERENCE OPERATIONS
 */

/**
 * Get source references for a term or variant
 * @param {string} referencedBy - termId or languageVariantId
 * @param {string} userRole - role of the requesting user
 * @returns {Object} { success, references }
 */
export function getSourceReferencesService(referencedBy, userRole) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.SOURCE_READ, userRole)) {
    return { success: false, error: 'Permission denied: source.read required' };
  }
  
  const references = getSourceReferencesByTermId(referencedBy);
  return { success: true, references };
}

/**
 * Create a source reference
 * @param {Object} payload - reference data
 * @param {string} userRole - role of the requesting user
 * @returns {Object} { success, reference, error }
 */
export function createSourceReferenceService(payload, userRole) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.SOURCE_CREATE, userRole)) {
    return { success: false, error: 'Permission denied: source.create required' };
  }
  
  const validationErrors = validateSourceReferencePayload(payload);
  if (validationErrors.length > 0) {
    return { success: false, error: `Validation failed: ${validationErrors.join(', ')}` };
  }
  
  // Generate stable ID
  const id = `SRC-${payload.sourceName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
  
  const reference = createSourceReference(id, {
    sourceId: payload.sourceId,
    sourceName: payload.sourceName.trim(),
    sourceUrl: payload.sourceUrl,
    sourceType: payload.sourceType,
    referencedBy: payload.referencedBy,
    retrievedAt: payload.retrievedAt,
    createdBy: payload.createdBy,
  });
  
  saveSourceReference(reference);
  
  return { success: true, reference };
}

/**
 * SEARCH OPERATIONS
 */

/**
 * Search terms by text query
 * @param {string} query - search text
 * @param {Object} options - filters { category, languageCode }
 * @param {string} userRole - role of the requesting user
 * @returns {Object} { success, terms }
 */
export function searchTermsService(query, options = {}, userRole) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.TERM_READ, userRole)) {
    return { success: false, error: 'Permission denied: translation.read required' };
  }
  
  const results = searchTerms(query, options);
  return { success: true, terms: results };
}

/**
 * Get statistics summary
 * @param {string} userRole - role of the requesting user
 * @returns {Object} { success, stats }
 */
export function getStatisticsService(userRole) {
  if (!hasPermission(TRANSLATION_PERMISSIONS.TERM_READ, userRole)) {
    return { success: false, error: 'Permission denied: translation.read required' };
  }
  
  const stats = getStatistics();
  return { success: true, stats };
}