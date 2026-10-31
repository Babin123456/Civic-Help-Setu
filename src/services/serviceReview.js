/**
 * Two-person review of high-impact service changes.
 *
 * A draft that changes a high-impact field (src/data/reviewPolicy.js) goes
 *   draft -> pending review -> approved | returned for changes -> published.
 * Another admin must decide: the person who sent the change cannot approve or return it. A decision
 * records who decided, when, and a short reason. A returned change leaves the published guide untouched,
 * and any edit to the draft or any change to the published guide voids an approval. Publishing itself
 * (serviceDrafts.publishDraft) refuses a high-impact change that is not approved.
 *
 * Limit, stated plainly: drafts live in this browser's localStorage, so "another admin" means another
 * signed-in account on the same browser profile, and anyone with developer tools can still edit storage.
 * A real two-person guarantee needs shared storage and server-side checks: supply them through
 * `setDraftStore` in serviceDrafts.js and enforce the same rules there. Docs: docs/SERVICE_REVIEW.md
 */
import { actorLabel, requirePermission } from './accessControl';
import { fingerprint, getDraft, listDrafts, patchDraft, reviewDraft } from './serviceDrafts';
import { getServiceById } from './serviceCatalog';
import { addAuditLog } from './adminService';
import { REASON_MAX, REASON_MIN, SOURCE_REFERENCE_MAX } from '../data/reviewPolicy';

const sameUser = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

const currentUser = () => {
  const name = actorLabel('').trim();
  if (!name) throw new Error('Sign in with a named admin account to take part in a review.');
  return name;
};

const publishedOf = (draft) => (draft.serviceId ? getServiceById(draft.serviceId) : null);

/** Drafts waiting for a decision, oldest first. */
export function listPendingReviews() {
  return listDrafts()
    .filter((d) => d.review?.status === 'pending')
    .sort((a, b) => String(a.review.submittedAt).localeCompare(String(b.review.submittedAt)));
}

/**
 * Whether the signed-in admin may decide on this draft right now, and if not, why.
 * For the UI; decideReview enforces the same rules.
 */
export function reviewerCan(draft, user = actorLabel('')) {
  if (!draft?.review || draft.review.status !== 'pending') return { allowed: false, why: 'Nothing is waiting for a decision.' };
  if (!String(user ?? '').trim()) return { allowed: false, why: 'Sign in with a named admin account to review.' };
  if (sameUser(draft.review.submittedBy, user)) return { allowed: false, why: 'You sent this change, so another admin must review it.' };
  return { allowed: true, why: '' };
}

const cleanText = (value, max) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '').slice(0, max);

/**
 * Sends a draft with high-impact changes to a second reviewer.
 * @param {string} draftId
 * @param {{ sourceReference: string }} options the official notice, circular or page that supports the changed facts
 */
export function submitForReview(draftId, { sourceReference = '' } = {}) {
  requirePermission('services.write');
  const user = currentUser();
  const state = reviewDraft(draftId);
  if (!state) throw new Error('That draft no longer exists.');
  if (state.errors.length) throw new Error(`Fix ${state.errors.length} problem${state.errors.length === 1 ? '' : 's'} before sending for review.`);
  if (state.changes.length === 0) throw new Error('This draft does not change anything.');
  if (!state.reviewRequired) throw new Error('These changes do not need a second reviewer. They can be published directly.');
  if (state.approval === 'pending') throw new Error('This change is already waiting for a reviewer.');
  if (state.approval === 'approved') throw new Error('This change is already approved.');

  const reference = cleanText(sourceReference, SOURCE_REFERENCE_MAX);
  if (!reference) throw new Error('Say where the changed facts come from (an official notice, circular or page) so the reviewer can check them.');

  const draft = getDraft(draftId);
  const review = {
    status: 'pending',
    submittedBy: user,
    submittedAt: new Date().toISOString(),
    sourceReference: reference,
    highImpactFields: state.highImpact.map((c) => c.label),
    fingerprint: fingerprint(draft.record),
    baseFingerprint: fingerprint(publishedOf(draft)),
    reviewer: null,
    decidedAt: null,
    reason: null,
  };
  patchDraft(draftId, { review });
  addAuditLog({
    action: 'SERVICE_REVIEW_REQUESTED',
    actor: user,
    target: draft.record.name || draftId,
    details: `Sent for second review. High-impact fields: ${review.highImpactFields.join(', ')}. Source: ${reference}`,
  });
  return review;
}

/** The person who sent a change can take it back from review (it becomes an ordinary draft again). */
export function withdrawReview(draftId) {
  requirePermission('services.write');
  const user = currentUser();
  const draft = getDraft(draftId);
  if (!draft) throw new Error('That draft no longer exists.');
  if (draft.review?.status !== 'pending') throw new Error('This change is not waiting for review.');
  if (!sameUser(draft.review.submittedBy, user)) throw new Error('Only the person who sent this change can withdraw it.');
  patchDraft(draftId, { review: null });
  addAuditLog({ action: 'SERVICE_REVIEW_WITHDRAWN', actor: user, target: draft.record.name || draftId, details: 'Took the change back from review.' });
}

/**
 * Approves or returns a pending change. The reviewer cannot be the person who sent it, must give a short
 * reason, and the decision is recorded with their name and the time.
 * @param {string} draftId
 * @param {'approved'|'returned'} decision
 * @param {{ reason: string }} options
 */
export function decideReview(draftId, decision, { reason = '' } = {}) {
  requirePermission('services.review');
  if (decision !== 'approved' && decision !== 'returned') throw new Error('The decision must be "approved" or "returned".');
  const user = currentUser();
  const draft = getDraft(draftId);
  if (!draft) throw new Error('That draft no longer exists.');
  const check = reviewerCan(draft, user);
  if (!check.allowed) throw new Error(check.why);

  const text = cleanText(reason, REASON_MAX);
  if (text.length < REASON_MIN) throw new Error(`Give a short reason for ${decision === 'approved' ? 'approving' : 'returning'} this change.`);

  if (draft.review.fingerprint !== fingerprint(draft.record)) {
    throw new Error('The draft was edited after it was sent. Ask the editor to send it for review again.');
  }
  if (decision === 'approved' && draft.review.baseFingerprint !== fingerprint(publishedOf(draft))) {
    throw new Error('The published guide changed after this was sent. Ask the editor to review the newer changes and send it again.');
  }

  const review = { ...draft.review, status: decision, reviewer: user, decidedAt: new Date().toISOString(), reason: text };
  patchDraft(draftId, { review });
  addAuditLog({
    action: decision === 'approved' ? 'SERVICE_REVIEW_APPROVED' : 'SERVICE_REVIEW_RETURNED',
    actor: user,
    target: draft.record.name || draftId,
    details: `${decision === 'approved' ? 'Approved' : 'Returned'} a change by ${draft.review.submittedBy}: ${text}`,
  });
  return review;
}

export const approveDraft = (draftId, options) => decideReview(draftId, 'approved', options);
export const returnDraft = (draftId, options) => decideReview(draftId, 'returned', options);
