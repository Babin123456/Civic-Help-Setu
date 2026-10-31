import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getServiceById } from './serviceCatalog';
import { getAuditLogs, saveAdminService } from './adminService';
import { setCurrentActor, PermissionDeniedError } from './accessControl';
import { getDraft, publishDraft, reviewDraft, saveDraft, setDraftStore, localDraftStore, fingerprint } from './serviceDrafts';
import { approveDraft, decideReview, listPendingReviews, returnDraft, reviewerCan, submitForReview, withdrawReview } from './serviceReview';
import { HIGH_IMPACT_FIELDS, HIGH_IMPACT_KEYS } from '../data/reviewPolicy';
import { MOCK_SERVICES } from '../data/services';

const published = MOCK_SERVICES[0];
const editor = { role: 'admin', username: 'Editor Ann' };
const reviewer = { role: 'admin', username: 'Reviewer Raj' };

const makeStorage = () => {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
};

const feeEdit = (over = {}) => ({ ...structuredClone(published), fees: 'Rs 250 (revised)', ...over });
const lowImpactEdit = () => ({ ...structuredClone(published), processingTime: '2 - 3 days' });
const asEditor = () => setCurrentActor(editor);
const asReviewer = () => setCurrentActor(reviewer);
const SOURCE = 'Notification 12/2026, fee schedule';

let id;
beforeEach(() => {
  vi.stubGlobal('localStorage', makeStorage());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setDraftStore(localDraftStore);
  asEditor();
  id = null;
});

const draftWithFeeChange = () => {
  id = saveDraft(feeEdit(), { serviceId: published.id }).draftId;
  return id;
};
const pending = () => {
  draftWithFeeChange();
  submitForReview(id, { sourceReference: SOURCE });
  return id;
};

describe('which changes need review', () => {
  it('names the high-impact fields explicitly', () => {
    expect(HIGH_IMPACT_KEYS).toEqual(['eligibility', 'documents', 'fees', 'officialSources']);
    expect(HIGH_IMPACT_FIELDS.every((f) => f.label && f.why)).toBe(true);
  });

  it('lets a low-impact edit publish without a second reviewer', () => {
    id = saveDraft(lowImpactEdit(), { serviceId: published.id }).draftId;
    const state = reviewDraft(id);
    expect(state.reviewRequired).toBe(false);
    expect(state.approval).toBe('not-needed');
    publishDraft(id);
    expect(getServiceById(published.id).processingTime).toBe('2 - 3 days');
  });

  it('refuses to send a low-impact edit for review', () => {
    id = saveDraft(lowImpactEdit(), { serviceId: published.id }).draftId;
    expect(() => submitForReview(id, { sourceReference: SOURCE })).toThrow(/do not need a second reviewer/);
  });

  it('flags a fee change, and lists it as the high-impact part', () => {
    draftWithFeeChange();
    const state = reviewDraft(id);
    expect(state.reviewRequired).toBe(true);
    expect(state.highImpact.map((c) => c.key)).toEqual(['fees']);
    expect(state.approval).toBe('none');
    expect(state.canPublish).toBe(false);
  });

  it('treats a new guide as high impact', () => {
    const record = { ...structuredClone(published), name: 'Brand new ward guide' };
    delete record.id;
    id = saveDraft(record).draftId;
    expect(reviewDraft(id).reviewRequired).toBe(true);
  });
});

describe('publishing is blocked until a second reviewer approves', () => {
  it('blocks a high-impact change that was never sent', () => {
    draftWithFeeChange();
    expect(() => publishDraft(id)).toThrow(/second reviewer/);
    expect(getServiceById(published.id).fees).toBe(published.fees);
  });

  it('blocks while the review is pending', () => {
    pending();
    expect(reviewDraft(id).approval).toBe('pending');
    expect(() => publishDraft(id)).toThrow(/waiting for a second reviewer/);
    expect(getServiceById(published.id).fees).toBe(published.fees);
  });

  it('blocks a returned change and leaves the published guide unchanged', () => {
    pending();
    asReviewer();
    returnDraft(id, { reason: 'Fee does not match the notice' });
    asEditor();
    expect(reviewDraft(id).approval).toBe('returned');
    expect(() => publishDraft(id)).toThrow(/returned/);
    expect(getServiceById(published.id).fees).toBe(published.fees);
  });

  it('publishes after approval and records who approved in the audit trail', () => {
    pending();
    asReviewer();
    approveDraft(id, { reason: 'Matches notification 12/2026' });
    asEditor();
    expect(reviewDraft(id).approval).toBe('approved');
    expect(reviewDraft(id).canPublish).toBe(true);
    publishDraft(id, { actor: 'Editor Ann' });
    expect(getServiceById(published.id).fees).toBe('Rs 250 (revised)');
    const entry = getAuditLogs().find((l) => l.action === 'SERVICE_DRAFT_PUBLISHED');
    expect(entry.details).toContain('Approved by Reviewer Raj');
  });
});

describe('sending a change for review', () => {
  it('records who sent it, when, the source and the fields', () => {
    pending();
    const review = getDraft(id).review;
    expect(review).toMatchObject({ status: 'pending', submittedBy: 'Editor Ann', sourceReference: SOURCE, highImpactFields: ['Fees'] });
    expect(Number.isNaN(Date.parse(review.submittedAt))).toBe(false);
    expect(getAuditLogs().some((l) => l.action === 'SERVICE_REVIEW_REQUESTED')).toBe(true);
  });

  it('needs a source for the changed facts', () => {
    draftWithFeeChange();
    expect(() => submitForReview(id, { sourceReference: '  ' })).toThrow(/where the changed facts come from/);
    expect(getDraft(id).review).toBeNull();
  });

  it('refuses an invalid draft and a repeat', () => {
    id = saveDraft(feeEdit({ shortDescription: '' }), { serviceId: published.id }).draftId;
    expect(() => submitForReview(id, { sourceReference: SOURCE })).toThrow(/Fix 1 problem/);
    saveDraft(feeEdit(), { draftId: id });
    submitForReview(id, { sourceReference: SOURCE });
    expect(() => submitForReview(id, { sourceReference: SOURCE })).toThrow(/already waiting/);
  });

  it('needs a named admin account', () => {
    draftWithFeeChange();
    setCurrentActor({ role: 'admin' });
    expect(() => submitForReview(id, { sourceReference: SOURCE })).toThrow(/named admin account/);
  });

  it('lists pending reviews', () => {
    pending();
    expect(listPendingReviews().map((d) => d.draftId)).toEqual([id]);
  });

  it('lets only the sender withdraw, which turns it back into an ordinary draft', () => {
    pending();
    asReviewer();
    expect(() => withdrawReview(id)).toThrow(/Only the person who sent/);
    asEditor();
    withdrawReview(id);
    expect(getDraft(id).review).toBeNull();
    expect(reviewDraft(id).approval).toBe('none');
    expect(() => withdrawReview(id)).toThrow(/not waiting/);
  });
});

describe('deciding', () => {
  it('rejects self-approval and self-return', () => {
    pending();
    expect(() => approveDraft(id, { reason: 'Looks fine to me' })).toThrow(/another admin must review/);
    expect(() => returnDraft(id, { reason: 'Changing my mind' })).toThrow(/another admin must review/);
    expect(getDraft(id).review.status).toBe('pending');
  });

  it('compares names ignoring case and spacing', () => {
    pending();
    setCurrentActor({ role: 'admin', username: '  editor ann ' });
    expect(() => approveDraft(id, { reason: 'Same person, different spelling' })).toThrow(/another admin/);
  });

  it('refuses a citizen and a missing user', () => {
    pending();
    for (const actor of [{ role: 'citizen', username: 'Someone' }, null]) {
      setCurrentActor(actor);
      expect(() => approveDraft(id, { reason: 'Let me in please' })).toThrow(PermissionDeniedError);
    }
    asEditor();
    expect(getDraft(id).review.status).toBe('pending');
  });

  it('refuses an admin without a name', () => {
    pending();
    setCurrentActor({ role: 'admin' });
    expect(() => approveDraft(id, { reason: 'No name on the account' })).toThrow(/named admin account/);
  });

  it('records the reviewer, the time and the reason for an approval', () => {
    pending();
    asReviewer();
    const review = approveDraft(id, { reason: '  Matches   the notice ' });
    expect(review).toMatchObject({ status: 'approved', reviewer: 'Reviewer Raj', reason: 'Matches the notice', submittedBy: 'Editor Ann' });
    expect(Number.isNaN(Date.parse(review.decidedAt))).toBe(false);
    expect(getDraft(id).review.status).toBe('approved');
    expect(getAuditLogs().some((l) => l.action === 'SERVICE_REVIEW_APPROVED' && l.actor === 'Reviewer Raj')).toBe(true);
  });

  it('records the same for a return', () => {
    pending();
    asReviewer();
    const review = returnDraft(id, { reason: 'Cite the page number' });
    expect(review).toMatchObject({ status: 'returned', reviewer: 'Reviewer Raj', reason: 'Cite the page number' });
    expect(getAuditLogs().some((l) => l.action === 'SERVICE_REVIEW_RETURNED')).toBe(true);
  });

  it('needs a reason, and only accepts the two decisions', () => {
    pending();
    asReviewer();
    expect(() => approveDraft(id, { reason: ' ' })).toThrow(/short reason/);
    expect(() => returnDraft(id, {})).toThrow(/short reason/);
    expect(() => decideReview(id, 'maybe', { reason: 'unsure about this' })).toThrow(/must be/);
    expect(getDraft(id).review.status).toBe('pending');
  });

  it('cannot decide twice or on something that was never sent', () => {
    draftWithFeeChange();
    asReviewer();
    expect(() => approveDraft(id, { reason: 'Never sent' })).toThrow(/Nothing is waiting/);
    asEditor();
    submitForReview(id, { sourceReference: SOURCE });
    asReviewer();
    approveDraft(id, { reason: 'Matches the notice' });
    expect(() => returnDraft(id, { reason: 'Second thoughts' })).toThrow(/Nothing is waiting/);
  });

  it('says who may decide, for the interface', () => {
    pending();
    const draft = getDraft(id);
    expect(reviewerCan(draft, 'Editor Ann').allowed).toBe(false);
    expect(reviewerCan(draft, 'Reviewer Raj').allowed).toBe(true);
    expect(reviewerCan(draft, '').allowed).toBe(false);
    expect(reviewerCan({ review: null }, 'Reviewer Raj').allowed).toBe(false);
  });
});

describe('stale and edited drafts', () => {
  it('voids a pending review when the draft is edited', () => {
    pending();
    saveDraft(feeEdit({ fees: 'Rs 999' }), { draftId: id });
    expect(getDraft(id).review).toBeNull();
    asReviewer();
    expect(() => approveDraft(id, { reason: 'Approving stale text' })).toThrow(/Nothing is waiting/);
  });

  it('keeps a review when the same record is saved again', () => {
    pending();
    saveDraft(feeEdit(), { draftId: id });
    expect(getDraft(id).review.status).toBe('pending');
  });

  it('voids an approval when the draft is edited afterwards', () => {
    pending();
    asReviewer();
    approveDraft(id, { reason: 'Matches the notice' });
    asEditor();
    saveDraft(feeEdit({ fees: 'Rs 777' }), { draftId: id });
    expect(reviewDraft(id).approval).toBe('none');
    expect(() => publishDraft(id)).toThrow(/second reviewer/);
  });

  it('refuses to approve when the published guide changed after the change was sent', () => {
    pending();
    saveAdminService({ ...structuredClone(published), processingTime: '1 day' }, 'Someone Else');
    asReviewer();
    expect(() => approveDraft(id, { reason: 'Matches the notice' })).toThrow(/published guide changed/);
    expect(() => returnDraft(id, { reason: 'Please rebase on the newer guide' })).not.toThrow();
  });

  it('treats an approval as outdated when the published guide changes after it', () => {
    pending();
    asReviewer();
    approveDraft(id, { reason: 'Matches the notice' });
    asEditor();
    saveAdminService({ ...structuredClone(published), processingTime: '1 day' }, 'Someone Else');
    expect(reviewDraft(id).approval).toBe('outdated');
    expect(() => publishDraft(id, { acknowledgeNewer: true })).toThrow(/no longer applies/);
    expect(getServiceById(published.id).fees).toBe(published.fees);
  });
});

describe('the storage adapter', () => {
  it('keeps drafts and reviews in whatever store it is given', () => {
    let held = [];
    setDraftStore({
      read: () => structuredClone(held),
      write: (drafts) => {
        held = structuredClone(drafts);
      },
    });
    pending();
    expect(held).toHaveLength(1);
    expect(held[0].review.status).toBe('pending');
    expect(localStorage.getItem('civicbridge_service_drafts_v1')).toBeNull();
  });

  it('fingerprints records without caring about key order', () => {
    expect(fingerprint({ a: 1, b: [1, 2] })).toBe(fingerprint({ b: [1, 2], a: 1 }));
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
  });
});
