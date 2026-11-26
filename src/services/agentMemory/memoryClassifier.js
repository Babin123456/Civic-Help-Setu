/**
 * Memory Classification & Contract Validation
 *
 * Enforces the strict dichotomy between citizen-provided FactualCaseNotes
 * and untrusted ModelProposals with citation and provenance tracking.
 */

import { minimizeForExternal } from '../../utils/dataMinimization';

export const MEMORY_ENTRY_TYPES = {
  FACTUAL_NOTE: 'FACTUAL_NOTE',
  MODEL_PROPOSAL: 'MODEL_PROPOSAL',
};

export const MEMORY_CATEGORIES = {
  DOCUMENT_METADATA: 'DOCUMENT_METADATA',
  ELIGIBILITY_CRITERIA: 'ELIGIBILITY_CRITERIA',
  ACTION_STEP: 'ACTION_STEP',
  INTERACTION_SUMMARY: 'INTERACTION_SUMMARY',
};

// Default TTLs in seconds
export const DEFAULT_TTL_SECONDS = {
  FACTUAL_NOTE: 7 * 24 * 60 * 60, // 7 days
  MODEL_PROPOSAL: 24 * 60 * 60,   // 24 hours
};

/**
 * Validates and normalizes entry category
 */
export const validateCategory = (category) => {
  const values = Object.values(MEMORY_CATEGORIES);
  if (!category || !values.includes(category)) {
    return MEMORY_CATEGORIES.INTERACTION_SUMMARY;
  }
  return category;
};

/**
 * Creates a validated FactualCaseNote descriptor
 */
export const createFactualNoteEntry = ({
  id,
  tenantId,
  caseId,
  title,
  text,
  category = MEMORY_CATEGORIES.INTERACTION_SUMMARY,
  metadata = {},
  ttlSeconds = DEFAULT_TTL_SECONDS.FACTUAL_NOTE,
  now = Date.now(),
}) => {
  const sanitizedTitle = minimizeForExternal(String(title || 'Case Note')).trim();
  const sanitizedText = minimizeForExternal(String(text || '')).trim();

  return {
    id: id || `mem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    tenantId,
    caseId,
    entryType: MEMORY_ENTRY_TYPES.FACTUAL_NOTE,
    category: validateCategory(category),
    provenance: {
      source: 'user',
      verifiedByCitizen: true,
      promotedAt: null,
    },
    payload: {
      title: sanitizedTitle,
      text: sanitizedText,
      metadata: metadata || {},
    },
    createdAt: now,
    expiresAt: now + (ttlSeconds * 1000),
    ttlSeconds,
  };
};

/**
 * Creates a validated ModelProposal descriptor
 */
export const createModelProposalEntry = ({
  id,
  tenantId,
  caseId,
  title,
  text,
  category = MEMORY_CATEGORIES.ACTION_STEP,
  citationIds = [],
  confidenceScore = 0.5,
  metadata = {},
  ttlSeconds = DEFAULT_TTL_SECONDS.MODEL_PROPOSAL,
  now = Date.now(),
}) => {
  const sanitizedTitle = minimizeForExternal(String(title || 'AI Suggestion')).trim();
  const sanitizedText = minimizeForExternal(String(text || '')).trim();

  return {
    id: id || `prop-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    tenantId,
    caseId,
    entryType: MEMORY_ENTRY_TYPES.MODEL_PROPOSAL,
    category: validateCategory(category),
    provenance: {
      source: 'assistant',
      citationIds: Array.isArray(citationIds) ? citationIds : [],
      confidenceScore: typeof confidenceScore === 'number' ? Math.max(0, Math.min(1, confidenceScore)) : 0.5,
      verifiedByCitizen: false,
      promotedAt: null,
    },
    payload: {
      title: sanitizedTitle,
      text: sanitizedText,
      metadata: metadata || {},
    },
    createdAt: now,
    expiresAt: now + (ttlSeconds * 1000),
    ttlSeconds,
  };
};
