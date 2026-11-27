/**
 * Community-Reviewed Translation and Terminology Governance (#772)
 * 
 * Normalized data model for civic terminology across Indian languages.
 * All entities use stable identifiers and include audit metadata.
 */

export const TRANSLATION_SCHEMA_VERSION = 1;
export const SUPPORTED_SCHEMA_VERSIONS = [1];

/**
 * Core Term entity - represents a civic term in a source language
 */
export function createTerm(id, options = {}) {
  const {
    sourceLanguage = 'en',
    sourceText,
    category,
    legalContext,
    sourceReference,
    createdBy,
    schemaVersion = TRANSLATION_SCHEMA_VERSION,
  } = options;

  return {
    id,
    sourceLanguage,
    sourceText,
    category,
    legalContext,
    sourceReference: sourceReference || null,
    createdBy: createdBy || null,
    schemaVersion,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * LanguageVariant entity - a translation/transliteration variant of a term
 */
export function createLanguageVariant(id, options = {}) {
  const {
    termId,
    languageCode, // 'hi', 'bn', 'ta', etc.
    languageName, // native name e.g. 'हिन्दी'
    transliteration,
    plainLanguageDefinition,
    machineDraft, // draft machine translation, requires review
    // reviewedBy is reserved for future use; not stored in base term
    reviewStatus, // 'pending', 'approved', 'rejected'
    reviewerRationale,
    createdBy,
    schemaVersion = TRANSLATION_SCHEMA_VERSION,
  } = options;

  return {
    id,
    termId,
    languageCode,
    languageName,
    transliteration: transliteration || null,
    plainLanguageDefinition: plainLanguageDefinition || null,
    machineDraft: machineDraft || null,
    reviewStatus: reviewStatus || 'pending',
    reviewerRationale: reviewerRationale || null,
    createdBy: createdBy || null,
    schemaVersion,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * TranslationSuggestion entity - a contributor's suggestion for a term variant
 */
export function createTranslationSuggestion(id, options = {}) {
  const {
    termId,
    contributorId,
    languageCode,
    transliteration,
    plainLanguageDefinition,
    usageExample,
    rationale,
    status, // 'pending_review', 'approved', 'rejected', 'published'
    createdBy,
    schemaVersion = TRANSLATION_SCHEMA_VERSION,
  } = options;

  return {
    id,
    termId,
    contributorId,
    languageCode,
    transliteration: transliteration || null,
    plainLanguageDefinition: plainLanguageDefinition || null,
    usageExample: usageExample || null,
    rationale: rationale || null,
    status: status || 'pending_review',
    createdBy: createdBy || null,
    schemaVersion,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * ReviewAssignment entity - assigns a term variant to a reviewer
 */
export function createReviewAssignment(id, options = {}) {
  const {
    suggestionId,
    assigneeId, // reviewer user ID
    assigneeRole, // 'reviewer', 'operator', 'admin'
    priority, // 'low', 'medium', 'high', 'urgent'
    status, // 'pending', 'in_review', 'approved', 'rejected'
    reviewerComments,
    expiresAt,
    createdBy,
    schemaVersion = TRANSLATION_SCHEMA_VERSION,
  } = options;

  return {
    id,
    suggestionId,
    assigneeId,
    assigneeRole,
    priority: priority || 'medium',
    status: status || 'pending',
    reviewerComments: reviewerComments || null,
    expiresAt: expiresAt || null,
    createdBy: createdBy || null,
    schemaVersion,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * TerminologyVersion entity - version history for a term
 */
export function createTerminologyVersion(id, options = {}) {
  const {
    termId,
    versionNumber,
    languageVariantId,
    changeSummary,
    approvedBy,
    approvalReason,
    isPublished,
    parentVersionId,
    schemaVersion = TRANSLATION_SCHEMA_VERSION,
  } = options;

  return {
    id,
    termId,
    versionNumber,
    languageVariantId,
    changeSummary: changeSummary || null,
    approvedBy: approvedBy || null,
    approvalReason: approvalReason || null,
    isPublished: isPublished || false,
    parentVersionId: parentVersionId || null,
    schemaVersion,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * SourceReference entity - cited source for a term or variant
 */
export function createSourceReference(id, options = {}) {
  const {
    sourceId, // external source identifier
    sourceName, // e.g. 'Department of Legal Affairs'
    sourceUrl, // HTTPS URL
    sourceType, // 'statute', 'caseLaw', 'governmentCircular', 'judgment', 'other'
    referencedBy, // termId or languageVariantId
    retrievedAt,
    schemaVersion = TRANSLATION_SCHEMA_VERSION,
  } = options;

  return {
    id,
    sourceId: sourceId || null,
    sourceName,
    sourceUrl: sourceUrl || null,
    sourceType: sourceType || 'other',
    referencedBy: referencedBy || null,
    retrievedAt: retrievedAt || new Date().toISOString(),
    schemaVersion,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}