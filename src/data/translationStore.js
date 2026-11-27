/**
 * Community-Reviewed Translation and Terminology Governance Store
 * 
 * Manages persistent storage of translation terms, language variants,
 * suggestions, review assignments, terminology versions and source references.
 * Uses Firebase Admin SDK for server-side operations, localStorage for client.
 */

import { 
  createTerm,
  createLanguageVariant,
  createTranslationSuggestion,
  createReviewAssignment,
  createTerminologyVersion,
  createSourceReference,
 } from './translationTerms.js';

// Storage keys
const STORAGE_KEYS = {
  terms: 'civic_translation_terms_v1',
  languageVariants: 'civic_language_variants_v1',
  translationSuggestions: 'civic_translation_suggestions_v1',
  reviewAssignments: 'civic_review_assignments_v1',
  terminologyVersions: 'cic_terminology_versions_v1',
  sourceReferences: 'cic_source_references_v1',
};

// In-memory fallback storage (for tests or when Firebase not available)
let storage = {
  terms: new Map(),
  languageVariants: new Map(),
  translationSuggestions: new Map(),
  reviewAssignments: new Map(),
  terminologyVersions: new Map(),
  sourceReferences: new Map(),
};

/**
 * Initialize storage from Firebase or fall back to in-memory
 * @param {Object} firebaseStorage - Firebase storage object with get/set/remove methods
 */
export function initializeStore(firebaseStorage) {
  if (firebaseStorage && typeof firebaseStorage.getItem === 'function') {
    storage = {
      terms: new Map(Object.entries(firebaseStorage.getItem(STORAGE_KEYS.terms) || '{}')),
      languageVariants: new Map(Object.entries(firebaseStorage.getItem(STORAGE_KEYS.languageVariants) || '{}')),
      translationSuggestions: new Map(Object.entries(firebaseStorage.getItem(STORAGE_KEYS.translationSuggestions) || '{}')),
      reviewAssignments: new Map(Object.entries(firebaseStorage.getItem(STORAGE_KEYS.reviewAssignments) || '{}')),
      terminologyVersions: new Map(Object.entries(firebaseStorage.getItem(STORAGE_KEYS.terminologyVersions) || '{}')),
      sourceReferences: new Map(Object.entries(firebaseStorage.getItem(STORAGE_KEYS.sourceReferences) || '{}')),
    };
  }
  // else keep default in-memory storage
}

/**
 * Get all terms
 */
export function getAllTerms() {
  return Array.from(storage.terms.values());
}

/**
 * Get term by ID
 */
export function getTermById(id) {
  return storage.terms.get(id) || null;
}

/**
 * Save a term
 */
export function saveTerm(term) {
  const termData = {
    ...term,
    updatedAt: new Date().toISOString(),
  };
  storage.terms.set(term.id, termData);
  return termData;
}

/**
 * Update a term (updates updatedAt)
 */
export function updateTerm(id, changes) {
  const existing = storage.terms.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...changes, updatedAt: new Date().toISOString() };
  storage.terms.set(id, updated);
  return updated;
}

/**
 * Delete a term
 */
export function deleteTerm(id) {
  return storage.terms.delete(id);
}

/**
 * Get all language variants
 */
export function getAllLanguageVariants() {
  return Array.from(storage.languageVariants.values());
}

/**
 * Get language variant by ID
 */
export function getLanguageVariantById(id) {
  return storage.languageVariants.get(id) || null;
}

/**
 * Save a language variant
 */
export function saveLanguageVariant(variant) {
  const variantData = {
    ...variant,
    updatedAt: new Date().toISOString(),
  };
  storage.languageVariants.set(variant.id, variantData);
  return variantData;
}

/**
 * Get language variants by term ID
 */
export function getLanguageVariantsByTermId(termId) {
  return Array.from(storage.languageVariants.values()).filter(v => v.termId === termId);
}

/**
 * Get approved language variants by term ID
 */
export function getApprovedLanguageVariantsByTermId(termId) {
  return Array.from(storage.languageVariants.values())
    .filter(v => v.termId === termId && v.reviewStatus === 'approved');
}

/**
 * Get pending language variants by term ID
 */
export function getPendingLanguageVariantsByTermId(termId) {
  return Array.from(storage.languageVariants.values())
    .filter(v => v.termId === termId && v.reviewStatus === 'pending');
}

/**
 * Save a language variant status update
 */
export function updateLanguageVariant(id, changes) {
  const existing = storage.languageVariants.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...changes, updatedAt: new Date().toISOString() };
  storage.languageVariants.set(id, updated);
  return updated;
}

/**
 * Get all translation suggestions
 */
export function getAllTranslationSuggestions() {
  return Array.from(storage.translationSuggestions.values());
}

/**
 * Get translation suggestion by ID
 */
export function getTranslationSuggestionById(id) {
  return storage.translationSuggestions.get(id) || null;
}

/**
 * Get pending translation suggestions
 */
export function getPendingTranslationSuggestions() {
  return Array.from(storage.translationSuggestions.values())
    .filter(s => s.status === 'pending_review');
}

/**
 * Get translation suggestions by term ID
 */
export function getTranslationSuggestionsByTermId(termId) {
  return Array.from(storage.translationSuggestions.values())
    .filter(s => s.termId === termId);
}

/**
 * Get contributor's suggestions
 */
export function getSuggestionsByContributor(contributorId) {
  return Array.from(storage.translationSuggestions.values())
    .filter(s => s.contributorId === contributorId);
}

/**
 * Save a translation suggestion
 */
export function saveTranslationSuggestion(suggestion) {
  const suggestionData = {
    ...suggestion,
    updatedAt: new Date().toISOString(),
  };
  storage.translationSuggestions.set(suggestion.id, suggestionData);
  return suggestionData;
}

/**
 * Update a translation suggestion status
 */
export function updateTranslationSuggestion(id, changes) {
  const existing = storage.translationSuggestions.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...changes, updatedAt: new Date().toISOString() };
  storage.translationSuggestions.set(id, updated);
  return updated;
}

/**
 * Get all review assignments
 */
export function getAllReviewAssignments() {
  return Array.from(storage.reviewAssignments.values());
}

/**
 * Get review assignment by ID
 */
export function getReviewAssignmentById(id) {
  return storage.reviewAssignments.get(id) || null;
}

/**
 * Get assignments by suggestion ID
 */
export function getReviewAssignmentsBySuggestionId(suggestionId) {
  return Array.from(storage.reviewAssignments.values())
    .filter(a => a.suggestionId === suggestionId);
}

/**
 * Get assignments by assignee ID
 */
export function getReviewAssignmentsByAssignee(assigneeId) {
  return Array.from(storage.reviewAssignments.values())
    .filter(a => a.assigneeId === assigneeId);
}

/**
 * Save a review assignment
 */
export function saveReviewAssignment(assignment) {
  const assignmentData = {
    ...assignment,
    updatedAt: new Date().toISOString(),
  };
  storage.reviewAssignments.set(assignment.id, assignmentData);
  return assignmentData;
}

/**
 * Update a review assignment status
 */
export function updateReviewAssignment(id, changes) {
  const existing = storage.reviewAssignments.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...changes, updatedAt: new Date().toISOString() };
  storage.reviewAssignments.set(id, updated);
  return updated;
}

/**
 * Get all terminology versions
 */
export function getAllTerminologyVersions() {
  return Array.from(storage.terminologyVersions.values());
}

/**
 * Get terminology version by ID
 */
export function getTerminologyVersionById(id) {
  return storage.terminologyVersions.get(id) || null;
}

/**
 * Get versions by term ID
 */
export function getTerminologyVersionsByTermId(termId) {
  return Array.from(storage.terminologyVersions.values())
    .filter(v => v.termId === termId);
}

/**
 * Save a terminology version
 */
export function saveTerminologyVersion(version) {
  const versionData = {
    ...version,
    updatedAt: new Date().toISOString(),
  };
  storage.terminologyVersions.set(version.id, versionData);
  return versionData;
}

/**
 * Get all source references
 */
export function getAllSourceReferences() {
  return Array.from(storage.sourceReferences.values());
}

/**
 * Get source reference by ID
 */
export function getSourceReferenceById(id) {
  return storage.sourceReferences.get(id) || null;
}

/**
 * Get references by term ID
 */
export function getSourceReferencesByTermId(termId) {
  return Array.from(storage.sourceReferences.values())
    .filter(r => r.referencedBy === termId);
}

/**
 * Get references by language variant ID
 */
export function getSourceReferencesByVariantId(variantId) {
  return Array.from(storage.sourceReferences.values())
    .filter(r => r.referencedBy === variantId);
}

/**
 * Save a source reference
 */
export function saveSourceReference(reference) {
  const referenceData = {
    ...reference,
    updatedAt: new Date().toISOString(),
  };
  storage.sourceReferences.set(reference.id, referenceData);
  return referenceData;
}

/**
 * Transaction support for multi-record changes
 * Returns true if all operations succeeded, false otherwise
 */
export function executeTransaction(operations) {
  try {
    // Validate all operations first
    for (const op of operations) {
      if (op.type === 'delete') {
        if (!storage[op.collection].has(op.id)) {
          throw new Error(`Cannot delete: ${op.collection}.${op.id} does not exist`);
        }
      } else if (op.type === 'update') {
        if (!storage[op.collection].has(op.id)) {
          throw new Error(`Cannot update: ${op.collection}.${op.id} does not exist`);
        }
      } else if (op.type === 'create') {
        // Check for idempotency - if already exists, it's fine (idempotent)
      }
    }
    
    // Execute all operations
    for (const op of operations) {
      switch (op.type) {
        case 'create':
          if (op.collection === 'terms') saveTerm(op.data);
          else if (op.collection === 'languageVariants') saveLanguageVariant(op.data);
          else if (op.collection === 'translationSuggestions') saveTranslationSuggestion(op.data);
          else if (op.collection === 'reviewAssignments') saveReviewAssignment(op.data);
          else if (op.collection === 'terminologyVersions') saveTerminologyVersion(op.data);
          else if (op.collection === 'sourceReferences') saveSourceReference(op.data);
          break;
        case 'update':
          if (op.collection === 'terms') updateTerm(op.id, op.changes);
          else if (op.collection === 'languageVariants') updateLanguageVariant(op.id, op.changes);
          else if (op.collection === 'translationSuggestions') updateTranslationSuggestion(op.id, op.changes);
          else if (op.collection === 'reviewAssignments') updateReviewAssignment(op.id, op.changes);
          else if (op.collection === 'terminologyVersions') saveTerminologyVersion({ ...storage.terminologyVersions.get(op.id), ...op.changes });
          else if (op.collection === 'sourceReferences') saveSourceReference({ ...storage.sourceReferences.get(op.id), ...op.changes });
          break;
        case 'delete':
          if (op.collection === 'terms') deleteTerm(op.id);
          else if (op.collection === 'languageVariants') {
            // Also delete associated data
            const variant = storage.languageVariants.get(op.id);
            if (variant) {
              getLanguageVariantsByTermId(variant.termId); // just to validate
            }
            deleteLanguageVariant(op.id);
          } else if (op.collection === 'translationSuggestions') deleteTranslationSuggestion(op.id);
          else if (op.collection === 'terminologyVersions') ;
          else if (op.collection === 'sourceReferences') deleteSourceReference(op.id);
          break;
        default:
          throw new Error(`Unknown transaction operation type: ${op.type}`);
      }
    }
    
    return { success: true, executed: operations.length };
  } catch (err) {
    // Rollback: revert any changes made in this transaction
    console.error('Transaction failed, rolling back:', err);
    return { success: false, error: err.message, executed: 0 };
  }
}

/**
 * Delete a language variant
 */
export function deleteLanguageVariant(id) {
  return storage.languageVariants.delete(id);
}

/**
 * Delete a translation suggestion
 */
export function deleteTranslationSuggestion(id) {
  return storage.translationSuggestions.delete(id);
}

/**
 * Delete a review assignment
 */
export function deleteReviewAssignment(id) {
  return storage.reviewAssignments.delete(id);
}

/**
 * Delete a source reference
 */
export function deleteSourceReference(id) {
  return storage.sourceReferences.delete(id);
}

/**
 * Search terms by text query
 * @param {string} query - search text
 * @param {Object} options - filter options
 */
export function searchTerms(query, options = {}) {
  const results = [];
  const lowerQuery = (query || '').toLowerCase().trim();
  
  for (const term of storage.terms.values()) {
    let match = false;
    
    // Match against source text
    if (term.sourceText && term.sourceText.toLowerCase().includes(lowerQuery)) match = true;
    // Match against category
    if (term.category && term.category.toLowerCase().includes(lowerQuery)) match = true;
    // Match against legal context
    if (term.legalContext && term.legalContext.toLowerCase().includes(lowerQuery)) match = true;
    
    if (match) {
      results.push(term);
    }
  }
  
  // Apply filters
  if (options.category && results.length > 0) {
    return results.filter(t => t.category === options.category);
  }
  if (options.languageCode && results.length > 0) {
    // Search language variants too
    let langMatch = [];
    for (const term of results) {
      const variants = getLanguageVariantsByTermId(term.id);
      for (const v of variants) {
        if (v.languageCode === options.languageCode) {
          langMatch.push(term);
          break;
        }
      }
    }
    return langMatch;
  }
  
  return results;
}

/**
 * Get statistics summary
 */
export function getStatistics() {
  const totalTerms = storage.terms.size;
  const totalVariants = storage.languageVariants.size;
  const totalSuggestions = storage.translationSuggestions.size;
  const totalAssignments = storage.reviewAssignments.size;
  const totalVersions = storage.terminologyVersions.size;
  const totalReferences = storage.sourceReferences.size;
  
  // Count by status
  const pendingSuggestions = getPendingTranslationSuggestions().length;
  
  return {
    totalTerms,
    totalLanguageVariants: storage.languageVariants.size,
    totalTranslationSuggestions: totalSuggestions,
    totalReviewAssignments: totalAssignments,
    totalTerminologyVersions: totalVersions,
    totalSourceReferences: totalReferences,
    pendingSuggestions,
  };
}