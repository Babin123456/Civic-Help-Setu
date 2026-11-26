/**
 * Multilingual Civic Form Translation Memory Service (#1114)
 *
 * Implements a governed terminology memory for approved civic terms, preferred
 * translations, context notes and source references. Editors propose translations
 * and reviewers approve them before publication. This is a governed translation
 * workflow, not unrestricted automatic translation of legal rules.
 *
 * States: pending | approved | rejected | rolled-back
 *
 * Acceptance criteria compliance:
 * - Store source term, language pair, context, approved translation and reviewer metadata
 * - Support proposal, review, approval and rollback states
 * - Flag conflicting translations across service content
 * - Show context notes and avoid machine-overwriting approved terms
 * - Include glossary search for contributors and citizens
 * - Preserve an audit trail and support export/import
 */

import { TRANSLATION_MEMORY_STATES, LANGUAGE_PAIRS, getConflictingEntries, hasConflictingTranslations } from '../data/civicTranslationMemory';
import { requirePermission } from './accessControl';
import { logDiagnostic } from '../utils/diagnostics';

export const TRANSLATION_MEMORY_SERVICE_KEY = 'civic_translation_memory_service';

/**
 * Submits a new translation proposal.
 * Editors propose translations; they start in 'pending' status for reviewer approval.
 *
 * Acceptance criteria compliance:
 * - Store source term, language pair, context, approved translation and reviewer metadata
 * - Support proposal state
 *
 * @param {Object} payload - { sourceTerm, languagePair, context, suggestedTranslation, sourceReference, userContact }
 * @param {Storage} [storage=localStorage]
 * @returns {Object} Result { ok: boolean, error?: string, entryId?: message?: string }
 */
export function submitTranslationProposal(
  payload = {},
  storage = typeof localStorage !== 'undefined' ? localStorage : null
) {
  requirePermission('civictranslationmemory.write');

  const result = submitTranslationProposalCore(payload, storage);
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    entryId: result.entryId,
    message: result.message,
  };
}

/**
 * Core implementation of submitTranslationProposal (separated for testing/permission layering)
 * @internal
 */
function submitTranslationProposalCore(payload = {}, storage = null) {
  if (!storage) {
    return { ok: false, error: 'Storage is not accessible to record suggestion.' };
  }

  const { sourceTerm, languagePair, context, suggestedTranslation, sourceReference, userContact } = payload;

  const cleanTerm = (sourceTerm || '').trim();
  if (!cleanTerm) {
    return { ok: false, error: 'Source term is required.' };
  }

  const validPairs = Object.values(LANGUAGE_PAIRS);
  if (!languagePair || !validPairs.includes(languagePair)) {
    return {
      ok: false,
      error: `Valid language pair is required. Available: ${Object.values(LANGUAGE_PAIRS).join(', ')}`,
    };
  }

  const cleanContext = (context || '').trim();
  if (!cleanContext) {
    return { ok: false, error: 'Context is required.' };
  }

  const cleanTranslation = (suggestedTranslation || '').trim();
  if (!cleanTranslation) {
    return { ok: false, error: 'Suggested translation is required.' };
  }

  if (cleanTranslation.length < 3) {
    return { ok: false, error: 'Suggested translation must be at least 3 characters.' };
  }

  const cleanRationale = (sourceReference || '').trim();
  if (!cleanRationale) {
    return { ok: false, error: 'Source reference is required.' };
  }

  if (cleanRationale.length < 5) {
    return { ok: false, error: 'Source reference must be at least 5 characters.' };
  }

  try {
    const existingRaw = storage.getItem('civic_translation_memory');
    const existing = existingRaw ? JSON.parse(existingRaw) : [];

    // Check for conflicting pending/approved translations
    const conflictingApproved = existing.filter(
      (e) =>
        e.sourceTerm.toLowerCase() === cleanTerm.toLowerCase() &&
        e.languagePair === languagePair &&
        e.status === TRANSLATION_MEMORY_STATES.APPROVED
    );

    if (conflictingApproved.length > 0 && !payload.forceOverride) {
      return {
        ok: false,
        error: `There are already ${conflictingApproved.length} approved translation${conflictingApproved.length > 1 ? 's' : ''} for "${cleanTerm}" in ${languagePair}. Use forceOverride if you want to override.`,
      };
    }

    const newEntry = {
      id: `TM-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      sourceTerm: cleanTerm,
      languagePair,
      context: cleanContext,
      suggestedTranslation: cleanTranslation,
      approvedTranslation: null,
      status: TRANSLATION_MEMORY_STATES.PENDING,
      reviewer: userContact ? userContact.trim() : 'Editor',
      reviewerComments: null,
      sourceReference: cleanRationale,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Check for existing entries with same source term and language pair
    const existingEntryIndex = existing.findIndex(
      (e) => e.sourceTerm.toLowerCase() === cleanTerm.toLowerCase() && e.languagePair === languagePair
    );

    if (existingEntryIndex >= 0) {
      existing[existingEntryIndex] = newEntry;
    } else {
      existing.unshift(newEntry);
    }

    saveAllTranslationMemory(existing, storage);

    // Append audit log
    appendTranslationMemoryAuditLog({
      action: 'TRANSLATION_PROPOSAL_SUBMITTED',
      entryId: newEntry.id,
      sourceTerm: cleanTerm,
      languagePair,
      actor: newEntry.reviewer,
      notes: `New translation proposal submitted for "${cleanTerm}" (${languagePair}).`,
    });

    return {
      ok: true,
      entryId: newEntry.id,
      message: 'Translation proposal submitted successfully and is pending reviewer approval.',
    };
  } catch (err) {
    return { ok: false, error: 'Failed to record translation proposal due to storage error.' };
  }
}

/**
 * Reviews a translation proposal and either approves or rejects it.
 *
 * Acceptance criteria compliance:
 * - Support review, approval and rollback states
 * - Flag conflicting translations
 *
 * @param {Object} payload - { entryId, decision: 'approve' | 'reject', reviewerNotes }
 * @param {Storage} [storage=localStorage]
 * @returns {Object} Result { ok: boolean, error?: string }
 */
export function reviewTranslationProposal(
  payload = {},
  storage = typeof localStorage !== 'undefined' ? localStorage : null
) {
  requirePermission('civictranslationmemory.review');

  const result = reviewTranslationProposalCore(payload, storage);
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    message: result.message,
  };
}

/**
 * Core implementation of reviewTranslationProposal (separated for testing/permission layering)
 * @internal
 */
function reviewTranslationProposalCore(payload = {}, storage = null) {
  if (!storage) {
    return { ok: false, error: 'Storage is not accessible to review suggestion.' };
  }

  const { entryId, decision, reviewerNotes } = payload;

  if (!entryId) {
    return { ok: false, error: 'Entry ID is required.' };
  }

  const validDecisions = ['approve', 'reject'];
  if (!decision || !validDecisions.includes(decision)) {
    return {
      ok: false,
      error: `Decision must be one of: ${validDecisions.join(' | ')}`,
    };
  }

  const cleanNotes = (reviewerNotes || '').trim();
  if (!cleanNotes) {
    return { ok: false, error: 'Reviewer notes are required.' };
  }

  if (cleanNotes.length < 5) {
    return { ok: false, error: 'Reviewer notes must be at least 5 characters.' };
  }

  try {
    const existingRaw = storage.getItem('civic_translation_memory');
    if (!existingRaw) {
      return { ok: false, error: 'No translation memory entries found.' };
    }
    const existing = JSON.parse(existingRaw);

    const entryIndex = existing.findIndex((e) => e.id === entryId);
    if (entryIndex === -1) {
      return { ok: false, error: `Translation memory entry "${entryId}" not found.` };
    }

    const entry = existing[entryIndex];

    const now = new Date().toISOString();
    const updatedEntry = {
      ...entry,
      status: decision === 'approve' ? TRANSLATION_MEMORY_STATES.APPROVED : TRANSLATION_MEMORY_STATES.REJECTED,
      reviewer: entry.reviewer || 'Reviewer',
      reviewerComments: cleanNotes,
      updatedAt: now,
    };

    existing[entryIndex] = updatedEntry;
    saveAllTranslationMemory(existing, storage);

    // Append audit log
    appendTranslationMemoryAuditLog({
      action: decision === 'approve' ? 'TRANSLATION_APPROVED' : 'TRANSLATION_REJECTED',
      entryId: entry.id,
      sourceTerm: entry.sourceTerm,
      languagePair: entry.languagePair,
      reviewer: updatedEntry.reviewer,
      notes: `Translation ${decision}ed by reviewer: ${cleanNotes.substring(0, 100)}${cleanNotes.length > 100 ? '...' : ''}`,
    });

    return {
      ok: true,
      message: `Translation ${decision}ed successfully.`,
    };
  } catch (err) {
    return { ok: false, error: 'Failed to review translation proposal due to storage error.' };
  }
}

/**
 * Rolls back an approved translation to pending status or rejected status.
 * Used when a translation needs to be revised or a conflict is discovered.
 *
 * Acceptance criteria compliance:
 * - Support rollback state
 *
 * @param {Object} payload - { entryId, reason }
 * @param {Storage} [storage=localStorage]
 * @returns {Object} Result { ok: boolean, error?: string }
 */
export function rollbackTranslation(
  payload = {},
  storage = typeof localStorage !== 'undefined' ? localStorage : null
) {
  requirePermission('civictranslationmemory.write');

  const result = rollbackTranslationCore(payload, storage);
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    message: result.message,
  };
}

/**
 * Core implementation of rollbackTranslation (separated for testing/permission layering)
 * @internal
 */
function rollbackTranslationCore(payload = {}, storage = null) {
  if (!storage) {
    return { ok: false, error: 'Storage is not accessible to rollback translation.' };
  }

  const { entryId, reason } = payload;

  if (!entryId) {
    return { ok: false, error: 'Entry ID is required.' };
  }

  const cleanReason = (reason || '').trim();
  if (!cleanReason) {
    return { ok: false, error: 'Rollback reason is required.' };
  }

  if (cleanReason.length < 5) {
    return { ok: false, error: 'Rollback reason must be at least 5 characters.' };
  }

  try {
    const existingRaw = storage.getItem('civic_translation_memory');
    if (!existingRaw) {
      return { ok: false, error: 'No translation memory entries found.' };
    }
    const existing = JSON.parse(existingRaw);

    const entryIndex = existing.findIndex((e) => e.id === entryId);
    if (entryIndex === -1) {
      return { ok: false, error: `Translation memory entry "${entryId}" not found.` };
    }

    const entry = existing[entryIndex];

    // Only approved entries can be rolled back
    if (entry.status !== TRANSLATION_MEMORY_STATES.APPROVED) {
      return {
        ok: false,
        error: `Entry "${entryId}" is currently "${entry.status}" and cannot be rolled back. Only "approved" entries can be rolled back.`,
      };
    }

    const now = new Date().toISOString();
    const updatedEntry = {
      ...entry,
      status: TRANSLATION_MEMORY_STATES.ROLLED_BACK,
      reviewer: entry.reviewer || 'System',
      reviewerComments: `${entry.reviewerComments || ''} | Rolled back: ${cleanReason}`.trim(),
      updatedAt: now,
    };

    existing[entryIndex] = updatedEntry;
    saveAllTranslationMemory(existing, storage);

    // Append audit log
    appendTranslationMemoryAuditLog({
      action: 'TRANSLATION_ROLLED_BACK',
      entryId: entry.id,
      sourceTerm: entry.sourceTerm,
      languagePair: entry.languagePair,
      reviewer: updatedEntry.reviewer,
      notes: `Entry rolled back: ${cleanReason}`,
    });

    return {
      ok: true,
      message: `Translation memory entry rolled back successfully.`,
    };
  } catch (err) {
    return { ok: false, error: 'Failed to rollback translation due to storage error.' };
  }
}

/**
 * Searches the translation memory by term, language, or context.
 * Available for contributors and citizens to look up approved translations.
 *
 * Acceptance criteria compliance:
 * - Include glossary search for contributors and citizens
 *
 * @param {string} query - search term, language pair, or context phrase
 * @param {Object} [options] - { languagePair, state }
 * @param {Storage} [storage=localStorage]
 * @returns {Array} Matching translation memory entries
 */
export function searchTranslationMemory(
  query = '',
  { languagePair, state } = {},
  storage = typeof localStorage !== 'undefined' ? localStorage : null
) {
  if (!storage) return [];

  // Citizens can search without permission requirement
  // Contributors need read access for proposing/editing

  try {
    const all = getAllTranslationMemory(storage);

    let results = all;

    // Filter by language pair if specified
    if (languagePair) {
      results = results.filter((entry) => entry.languagePair === languagePair);
    }

    // Filter by state if specified
    if (state) {
      results = results.filter((entry) => entry.status === state);
    }

    if (!query || !query.trim()) {
      return results;
    }

    const q = query.toLowerCase().trim();

    // Filter by search query
    results = results.filter((entry) => {
      const searchable = [
        entry.sourceTerm,
        entry.suggestedTranslation,
        entry.approvedTranslation,
        entry.context,
        entry.sourceReference,
      ]
        .filter((s) => s && typeof s === 'string')
        .join(' ')
        .toLowerCase();

      return searchable.includes(q);
    });

    return results;
  } catch (err) {
    return [];
  }
}

/**
 * Gets a translation memory entry by source term and language pair.
 * Prioritizes approved entries, falls back to pending.
 * Used by the UI to display the preferred translation for a term.
 *
 * @param {string} sourceTerm - the English term
 * @param {string} languagePair - language pair code
 * @param {Storage} [storage=localStorage]
 * @returns {Object|null} Translation memory entry or null
 */
export function getTranslationByTerm(sourceTerm, languagePair, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage || !sourceTerm || !languagePair) return null;

  try {
    const all = getAllTranslationMemory(storage);

    // First try to find an approved entry
    const approved = all.find(
      (e) =>
        e.sourceTerm.toLowerCase() === sourceTerm.toLowerCase() &&
        e.languagePair === languagePair &&
        e.status === TRANSLATION_MEMORY_STATES.APPROVED
    );

    if (approved) return approved;

    // Fall back to pending entries
    const pending = all.find(
      (e) =>
        e.sourceTerm.toLowerCase() === sourceTerm.toLowerCase() &&
        e.languagePair === languagePair &&
        e.status === TRANSLATION_MEMORY_STATES.PENDING
    );

    if (pending) return pending;

    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Flags conflicting translations across service content.
 * Checks if there are multiple approved translations for the same source term and language pair.
 *
 * Acceptance criteria compliance:
 * - Flag conflicting translations across service content
 *
 * @param {string} sourceTerm - the English term to check
 * @param {string} languagePair - language pair code to check
 * @param {Storage} [storage=localStorage]
 * @returns {Object} Result { hasConflicts: boolean, conflictingCount: number, entries: Array }
 */
export function flagConflictingTranslations(sourceTerm, languagePair, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage || !sourceTerm || !languagePair) {
    return { hasConflicts: false, conflictingCount: 0, entries: [] };
  }

  try {
    const hasConflicts = hasConflictingTranslations(sourceTerm, languagePair, storage);
    const conflictingEntries = getConflictingEntries(sourceTerm, languagePair, storage);

    return {
      hasConflicts,
      conflictingCount: conflictingEntries.length,
      entries: conflictingEntries,
    };
  } catch (err) {
    return { hasConflicts: false, conflictingCount: 0, entries: [] };
  }
}

/**
 * Exports all translation memory data for backup or sharing.
 *
 * Acceptance criteria compliance:
 * - Preserve an audit trail and support export/import
 *
 * @param {Storage} [storage=localStorage]
 * @returns {Object} { entries: Array, auditLogs: Array, exportedAt: string }
 */
export function exportTranslationMemoryData(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return { entries: [], auditLogs: [], exportedAt: new Date().toISOString() };

  try {
    const entries = getAllTranslationMemory(storage);
    const auditLogs = getTranslationMemoryAuditLogs(storage);

    return {
      entries,
      auditLogs,
      exportedAt: new Date().toISOString(),
    };
  } catch (err) {
    return { entries: [], auditLogs: [], exportedAt: new Date().toISOString() };
  }
}

/**
 * Imports translation memory data, merging with existing entries.
 * Existing entries with the same ID are replaced; others are appended.
 *
 * Acceptance criteria compliance:
 * - Preserve an audit trail and support export/import
 *
 * @param {Object} data - { entries, auditLogs } from exportTranslationMemoryData()
 * @param {Storage} [storage=localStorage]
 * @returns {Object} Result { ok: boolean, error?: string, importedCount: number }
 */
export function importTranslationMemoryData(data = {}, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return { ok: false, error: 'Storage is not accessible for import.' };

  try {
    const { entries, auditLogs } = data;
    if (!entries || !Array.isArray(entries)) {
      return { ok: false, error: 'Import data must contain an "entries" array.' };
    }

    const existingRaw = storage.getItem('civic_translation_memory');
    const existing = existingRaw ? JSON.parse(existingRaw) : [];

    // Merge: replace entries by ID, add new ones
    const existingIds = new Set(existing.map((e) => e.id));
    const merged = [...existing];

    let importedCount = 0;
    for (const entry of entries) {
      if (!entry.id) continue;
      if (existingIds.has(entry.id)) {
        // Replace existing
        const idx = merged.findIndex((e) => e.id === entry.id);
        if (idx >= 0) {
          merged[idx] = entry;
          importedCount++;
        }
      } else {
        // Add new
        merged.unshift(entry);
        importedCount++;
      }
    }

    // Also merge audit logs if provided
    if (auditLogs && Array.isArray(auditLogs)) {
      const existingAuditRaw = storage.getItem('civic_translation_memory_audit_logs');
      const existingAudit = existingAuditRaw ? JSON.parse(existingAuditRaw) : [];
      const auditIds = new Set(existingAudit.map((a) => a.id));

      for (const log of auditLogs) {
        if (!auditIds.has(log.id)) {
          existingAudit.unshift(log);
        }
      }
      // Save audit logs separately
      try {
        storage.setItem('civic_translation_memory_audit_logs', JSON.stringify(existingAudit));
      } catch {
        // Ignore audit log save errors
      }
    }

    saveAllTranslationMemory(merged, storage);

    return {
      ok: true,
      importedCount,
      message: `Successfully imported ${importedCount} translation memory entry${importedCount !== 1 ? 's' : ''}.`,
    };
  } catch (err) {
    return { ok: false, error: 'Failed to import translation memory data.' };
  }
}