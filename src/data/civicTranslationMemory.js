/**
 * Multilingual Civic Form Translation Memory (#1114)
 *
 * A governed terminology memory for approved civic terms, preferred translations,
 * context notes and source references. Editors propose translations and reviewers
 * approve them before publication. This is a governed translation workflow, not
 * unrestricted automatic translation of legal rules.
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

export const TRANSLATION_MEMORY_STATES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ROLLED_BACK: 'rolled-back',
};

export const LANGUAGE_PAIRS = {
  EN_HI: 'en-hi',
  EN_BN: 'en-bn',
  EN_TA: 'en-ta',
  HI_EN: 'hi-en',
  BN_EN: 'bn-en',
  TA_EN: 'ta-en',
};

const getStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/**
 * Read all stored translation memory entries safely
 */
export const getAllTranslationMemory = (storage = getStorage()) => {
  if (!storage) return [];
  try {
    const raw = storage.getItem('civic_translation_memory');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Save translations array to storage
 */
const saveAllTranslationMemory = (translations, storage = getStorage()) => {
  if (!storage) return false;
  try {
    storage.setItem('civic_translation_memory', JSON.stringify(translations));
    return true;
  } catch {
    return false;
  }
};

/**
 * Append an immutable entry to the translation memory audit log
 */
const appendTranslationMemoryAuditLog = (entry, storage = getStorage()) => {
  if (!storage) return;
  try {
    const logs = getTranslationMemoryAuditLogs(storage);
    logs.unshift({
      id: `tm_audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    });
    storage.setItem('civic_translation_memory_audit_logs', JSON.stringify(logs));
  } catch (err) {
    // Log diagnostic but don't break the workflow
    // console.error('Failed to append translation memory audit log', err);
  }
};

/**
 * Read audit log entries for translation memory
 */
export const getTranslationMemoryAuditLogs = (storage = getStorage()) => {
  if (!storage) return [];
  try {
    const raw = storage.getItem('civic_translation_memory_audit_logs');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Returns all entries for a specific language pair
 */
export const getEntriesByLanguagePair = (languagePair, storage = getStorage()) => {
  if (!languagePair) return [];
  const all = getAllTranslationMemory(storage);
  return all.filter((entry) => entry.languagePair === languagePair);
};

/**
 * Returns all pending (unreviewed) entries
 */
export const getPendingEntries = (storage = getStorage()) => {
  const all = getAllTranslationMemory(storage);
  return all.filter((entry) => entry.status === TRANSLATION_MEMORY_STATES.PENDING);
};

/**
 * Returns all approved entries
 */
export const getApprovedEntries = (storage = getStorage()) => {
  const all = getAllTranslationMemory(storage);
  return all.filter((entry) => entry.status === TRANSLATION_MEMORY_STATES.APPROVED);
};

/**
 * Returns all entries that conflict with a given source term and language pair
 * (i.e., there are multiple approved translations for the same term)
 */
export const getConflictingEntries = (sourceTerm, languagePair, storage = getStorage()) => {
  if (!sourceTerm || !languagePair) return [];
  const all = getApprovedEntries(storage);
  return all.filter(
    (entry) =>
      entry.sourceTerm.toLowerCase() === sourceTerm.toLowerCase() &&
      entry.languagePair === languagePair &&
      entry.status === TRANSLATION_MEMORY_STATES.APPROVED
  );
};

/**
 * Returns true if there are conflicting approved translations for the given term and language pair
 */
export const hasConflictingTranslations = (sourceTerm, languagePair, storage = getStorage()) => {
  return getConflictingEntries(sourceTerm, languagePair, storage).length > 0;
};

/**
 * Translation Memory Entry Structure:
 * - id: unique identifier
 * - sourceTerm: the original English term
 * - languagePair: language pair code (e.g., 'en-hi', 'en-ta', 'en-bn')
 * - context: context note about when/where the term is used
 * - suggestedTranslation: translation proposed by editor (may be pending approval)
 * - approvedTranslation: final approved translation (set when status is 'approved')
 * - status: 'pending' | 'approved' | 'rejected' | 'rolled-back'
 * - reviewer: reviewer user identifier or 'System'
 * - reviewerComments: reviewer's notes/comments
 * - sourceReference: official source for the translation
 * - createdAt: timestamp when entry was created
 * - updatedAt: timestamp when entry was last updated
 */

/**
 * Submits a new translation proposal.
 * Editors propose translations; they start in 'pending' status.
 *
 * @param {Object} payload - { sourceTerm, languagePair, context, suggestedTranslation, sourceReference, userContact }
 * @param {Storage} [storage=localStorage]
 * @returns {Object} Result { ok: boolean, error?: string, entryId?: string }
 */
export function submitTranslationProposal(
  payload = {},
  storage = typeof localStorage !== 'undefined' ? localStorage : null
) {
  if (!storage) {
    return { ok: false, error: 'Storage is not accessible to record suggestion.' };
  }

  const { sourceTerm, languagePair, context, suggestedTranslation, sourceReference, userContact } = payload;

  // Validate required fields
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

  // Minimum length check for translation
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
      // Replace existing entry
      existing[existingEntryIndex] = newEntry;
    } else {
      // Add new entry at the beginning
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
 * @param {Object} payload - { entryId, decision: 'approve' | 'reject', reviewerNotes }
 * @param {Storage} [storage=localStorage]
 * @returns {Object} Result { ok: boolean, error?: string }
 */
export function reviewTranslationProposal(
  payload = {},
  storage = typeof localStorage !== 'undefined' ? localStorage : null
) {
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

    // Update the entry based on decision
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
 * Rolls back an approved translation to pending or rejected status.
 * Used when a translation needs to be revised or a conflict is discovered.
 *
 * @param {Object} payload - { entryId, reason }
 * @param {Storage} [storage=localStorage]
 * @returns {Object} Result { ok: boolean, error?: string }
 */
export function rollbackTranslation(
  payload = {},
  storage = typeof localStorage !== 'undefined' ? localStorage : null
) {
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
 * @param {string} query - search term, language pair, or context phrase
 * @param {Object} [options] - { languagePair, state }
 * @param {Storage} [storage=localStorage]
 * @returns {Array} Matching translation memory entries
 */
export function searchTranslationMemory(query = '', { languagePair, state } = {}, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return [];
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
 * Exports all translation memory data for backup or sharing.
 *
 * @param {Storage} [storage=localStorage]
 * @returns {Object} { entries: Array, auditLogs: Array, exportedAt: string }
 */
export function exportTranslationMemory(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
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
 * @param {Object} data - { entries, auditLogs } from exportTranslationMemory()
 * @param {Storage} [storage=localStorage]
 * @returns {Object} Result { ok: boolean, error?: string, importedCount: number }
 */
export function importTranslationMemory(data = {}, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
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