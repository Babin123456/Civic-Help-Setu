/**
 * src/services/civicContributionPipelineService.js
 *
 * Client-side service for the Human-Reviewed Civic Data Contribution Pipeline (#1432).
 * Provides field-level diff calculation, HTTPS source validation, PII screening,
 * offline-first local proposal queue, role-separated review/publish, and rollback.
 */

export const CONTRIBUTION_STORAGE_KEY = 'civicbridge_contribution_proposals_v1';

export const PROVENANCE_LABELS = Object.freeze({
  official_record: 'Official Record',
  citizen_entered: 'Citizen Entered',
  community_suggestion: 'Community Suggestion (Unverified)',
  ai_suggestion: 'AI Suggestion (Verify)',
});

const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;

export function hasForbiddenPII(input) {
  const s = typeof input === 'string' ? input : JSON.stringify(input || {});
  return AADHAAR_RE.test(s) || PAN_RE.test(s);
}

export function isHttpsUrl(url) {
  try {
    return new URL(String(url || '').trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

export function computeFieldDiffs(beforeObj = {}, afterObj = {}) {
  const keys = Array.from(new Set([...Object.keys(beforeObj || {}), ...Object.keys(afterObj || {})]));
  return keys
    .map((field) => ({
      field,
      before: beforeObj?.[field] ?? null,
      after: afterObj?.[field] ?? null,
    }))
    .filter((d) => JSON.stringify(d.before) !== JSON.stringify(d.after));
}

function getStorage(customStorage = null) {
  if (customStorage) return customStorage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function listLocalProposals(customStorage = null) {
  const store = getStorage(customStorage);
  if (!store) return [];
  try {
    const raw = store.getItem(CONTRIBUTION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalProposals(list, customStorage = null) {
  const store = getStorage(customStorage);
  if (!store) return false;
  try {
    store.setItem(CONTRIBUTION_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function submitLocalProposal({
  targetEntityId,
  contributorId = 'contributor_local',
  beforeFields = {},
  proposedFields = {},
  sourceUrl,
  effectiveDate,
  jurisdiction = 'India',
  provenanceKind = 'community_suggestion',
  rationale = '',
  customStorage = null,
}) {
  if (!targetEntityId) throw new Error('Target record ID is required.');
  if (!isHttpsUrl(sourceUrl)) throw new Error('Valid https:// official source attachment URL is required.');
  if (hasForbiddenPII({ proposedFields, rationale })) {
    throw new Error('Proposal must not contain Aadhaar or PAN numbers.');
  }

  const fieldDiffs = computeFieldDiffs(beforeFields, proposedFields);
  if (fieldDiffs.length === 0) throw new Error('No field changes detected.');

  const proposal = {
    proposalId: `prop_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    targetEntityId,
    contributorId,
    beforeFields,
    proposedFields,
    fieldDiffs,
    sourceAttachment: {
      sourceUrl: sourceUrl.trim(),
      effectiveDate: effectiveDate || new Date().toISOString().slice(0, 10),
      jurisdiction,
    },
    provenanceKind,
    rationale: rationale.trim(),
    status: 'PENDING_REVIEW',
    rejectionReason: null,
    createdAt: new Date().toISOString(),
  };

  const all = listLocalProposals(customStorage);
  all.unshift(proposal);
  saveLocalProposals(all, customStorage);
  return proposal;
}

export function reviewLocalProposal({
  proposalId,
  publisherId = 'publisher_local',
  decision,
  rejectionReason = '',
  customStorage = null,
}) {
  const all = listLocalProposals(customStorage);
  const p = all.find((x) => x.proposalId === proposalId);
  if (!p) throw new Error('Proposal not found.');
  if (publisherId === p.contributorId) {
    throw new Error('Role separation: contributor cannot approve or publish their own proposal.');
  }
  if (decision === 'REJECT' && !rejectionReason.trim()) {
    throw new Error('Rejection reason is required.');
  }

  p.status = decision === 'PUBLISH' ? 'PUBLISHED' : 'REJECTED';
  p.rejectionReason = decision === 'REJECT' ? rejectionReason.trim() : null;
  p.reviewedBy = publisherId;
  p.reviewedAt = new Date().toISOString();
  saveLocalProposals(all, customStorage);
  return p;
}

export function rollbackLocalProposal({
  proposalId,
  publisherId = 'publisher_local',
  reason = 'Rolled back by publisher',
  customStorage = null,
}) {
  const all = listLocalProposals(customStorage);
  const p = all.find((x) => x.proposalId === proposalId);
  if (!p) throw new Error('Proposal not found.');
  if (p.status !== 'PUBLISHED') throw new Error('Only PUBLISHED proposals can be rolled back.');
  p.status = 'ROLLED_BACK';
  p.rollbackReason = reason;
  p.rolledBackBy = publisherId;
  p.rolledBackAt = new Date().toISOString();
  saveLocalProposals(all, customStorage);
  return p;
}

