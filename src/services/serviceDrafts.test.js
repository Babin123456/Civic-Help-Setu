import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DRAFTS_STORAGE_KEY,
  MAX_DRAFTS,
  diffRecords,
  discardDraft,
  getDraft,
  getDraftForService,
  listDrafts,
  publishDraft,
  reviewDraft,
  saveDraft,
  validateDraftRecord,
  valueLines,
} from './serviceDrafts';
import { getAllServices, getServiceById, CUSTOM_SERVICES_KEY } from './serviceCatalog';
import { getAuditLogs, saveAdminService } from './adminService';
import { setCurrentActor, PermissionDeniedError } from './accessControl';
import { approveDraft, submitForReview } from './serviceReview';
import { MOCK_SERVICES } from '../data/services';

const makeStorage = () => {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
};

const published = MOCK_SERVICES[0];

// What the editor produces: a full record
const editedRecord = (over = {}) => ({
  ...structuredClone(published),
  processingTime: '9 - 10 days (revised)',
  ...over,
});

const newRecord = (over = {}) => ({
  name: 'Sample Ward Certificate',
  category: published.category,
  type: 'Online',
  difficulty: 'Easy',
  shortDescription: 'A certificate used only in tests.',
  fees: 'Free of cost',
  processingTime: '3 - 5 days',
  documents: ['Proof of address'],
  eligibility: ['Resident of the ward'],
  officialSources: [
    {
      name: 'Sample Portal',
      url: 'https://example.gov.in/ward',
      verified: true,
    },
  ],
  steps: [{ title: 'Apply', description: 'Fill the form.' }],
  ...over,
});

// A new guide changes high-impact fields, so it needs a second admin before it can be published.
const publishApproved = (draftId) => {
  setCurrentActor({ role: 'admin', username: 'Editor Ann' });
  submitForReview(draftId, { sourceReference: 'Official notice' });
  setCurrentActor({ role: 'admin', username: 'Reviewer Raj' });
  approveDraft(draftId, { reason: 'Checked against the notice' });
  setCurrentActor({ role: 'admin', username: 'Test Admin' });
  return publishDraft(draftId);
};

let storage;
beforeEach(() => {
  storage = makeStorage();
  vi.stubGlobal('localStorage', storage);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setCurrentActor({ role: 'admin', username: 'Test Admin' });
});

describe('creating and editing a draft', () => {
  it('starts a draft of a published guide and remembers what was published', () => {
    const draft = saveDraft(editedRecord(), { serviceId: published.id });
    expect(draft.serviceId).toBe(published.id);
    expect(draft.base.processingTime).toBe(published.processingTime);
    expect(draft.record.processingTime).toBe('9 - 10 days (revised)');
    expect(getDraftForService(published.id).draftId).toBe(draft.draftId);
  });

  it('does not change the public catalogue while it is a draft', () => {
    const before = JSON.stringify(getAllServices({ includeArchived: true }));
    const draft = saveDraft(editedRecord(), { serviceId: published.id });
    saveDraft(editedRecord({ processingTime: '99 days' }), { draftId: draft.draftId });
    expect(JSON.stringify(getAllServices({ includeArchived: true }))).toBe(before);
    expect(storage.getItem(CUSTOM_SERVICES_KEY)).toBeNull();
    expect(getServiceById(published.id).processingTime).toBe(published.processingTime);
  });

  it('updates the same draft on a second save instead of adding another', () => {
    const first = saveDraft(editedRecord(), { serviceId: published.id });
    const second = saveDraft(editedRecord({ processingTime: '30 days' }), {
      serviceId: published.id,
    });
    expect(second.draftId).toBe(first.draftId);
    expect(listDrafts()).toHaveLength(1);
    expect(getDraft(first.draftId).record.processingTime).toBe('30 days');
    expect(second.base.processingTime).toBe(published.processingTime);
  });

  it('can draft a new guide that has no published version', () => {
    const draft = saveDraft(newRecord());
    expect(draft.serviceId).toBeNull();
    expect(draft.base).toBeNull();
    expect(draft.draftId).toMatch(/^new-/);
  });

  it('refuses to edit a guide that is not published', () => {
    expect(() => saveDraft(newRecord(), { serviceId: 'no-such-guide' })).toThrow(/no published guide/);
  });

  it('strips markup from the text it keeps', () => {
    const draft = saveDraft(newRecord({ shortDescription: 'Fine <script>alert(1)</script>text' }));
    expect(draft.record.shortDescription).not.toContain('<script');
  });

  it('caps the number of drafts', () => {
    for (let i = 0; i < MAX_DRAFTS; i += 1) saveDraft(newRecord({ name: `Draft number ${i}` }));
    expect(() => saveDraft(newRecord({ name: 'One too many' }))).toThrow(/at most/);
  });

  it('reports a storage failure instead of losing the draft silently', () => {
    vi.stubGlobal('localStorage', {
      ...storage,
      setItem: () => {
        throw new Error('full');
      },
    });
    expect(() => saveDraft(newRecord())).toThrow(/Could not save the draft/);
  });

  it('ignores corrupt storage', () => {
    storage.setItem(DRAFTS_STORAGE_KEY, '{nope');
    expect(listDrafts()).toEqual([]);
  });
});

describe('discarding a draft', () => {
  it('removes only the draft and leaves the published guide as it was', () => {
    const before = JSON.stringify(getAllServices({ includeArchived: true }));
    const draft = saveDraft(editedRecord(), { serviceId: published.id });
    discardDraft(draft.draftId);
    expect(getDraft(draft.draftId)).toBeNull();
    expect(listDrafts()).toEqual([]);
    expect(JSON.stringify(getAllServices({ includeArchived: true }))).toBe(before);
  });

  it('does not write an audit entry', () => {
    const logs = getAuditLogs().length;
    const draft = saveDraft(editedRecord(), { serviceId: published.id });
    discardDraft(draft.draftId);
    expect(getAuditLogs().length).toBe(logs);
  });

  it('says so when the draft is already gone', () => {
    expect(() => discardDraft('edit-nothing')).toThrow(/no longer exists/);
  });
});

describe('the before/after comparison', () => {
  it('marks added, removed and changed fields', () => {
    const before = {
      name: 'A',
      fees: 'Free',
      documents: ['ID', 'Photo'],
      jurisdiction: undefined,
    };
    const after = {
      name: 'A',
      fees: 'Rs 10',
      documents: ['ID', 'Address'],
      shortDescription: 'New text',
    };
    const changes = Object.fromEntries(diffRecords(before, after).map((c) => [c.key, c]));
    expect(changes.fees.kind).toBe('changed');
    expect(changes.shortDescription.kind).toBe('added');
    expect(changes.documents.addedItems).toEqual(['Address']);
    expect(changes.documents.removedItems).toEqual(['Photo']);
    expect(changes.name).toBeUndefined();
    expect(diffRecords({ fees: 'Free' }, {}).find((c) => c.key === 'fees').kind).toBe('removed');
  });

  it('returns nothing when the records read the same', () => {
    expect(diffRecords(published, structuredClone(published))).toEqual([]);
  });

  it('reads structured values as plain lines', () => {
    expect(valueLines([{ name: 'Portal', url: 'https://x.gov.in' }])).toEqual(['Portal (https://x.gov.in)']);
    expect(
      valueLines({
        level: 'state',
        states: ['Sampleland'],
        districts: [],
        localBody: '',
      })
    ).toEqual(['state / Sampleland']);
    expect(valueLines('')).toEqual([]);
    expect(valueLines(undefined)).toEqual([]);
  });
});

describe('validation before publishing', () => {
  it('accepts a complete record', () => {
    expect(validateDraftRecord(newRecord())).toEqual([]);
  });

  it('names each problem and the control to focus', () => {
    const errors = validateDraftRecord({ category: 'Nonsense' });
    const byField = Object.fromEntries(errors.map((e) => [e.field, e.fieldId]));
    expect(byField).toMatchObject({
      name: 'svc-name',
      shortDescription: 'svc-summary',
      category: 'svc-category',
      fees: 'svc-fees',
      processingTime: 'svc-processing',
      documents: 'svc-documents',
    });
    expect(errors.every((e) => typeof e.message === 'string' && e.message.length > 0)).toBe(true);
  });

  it('requires an https official link', () => {
    const errors = validateDraftRecord(
      newRecord({
        officialSources: [{ name: 'P', url: 'http://example.gov.in' }],
      })
    );
    expect(errors.map((e) => e.fieldId)).toContain('svc-official-url');
  });

  it('rejects a new guide whose link would collide with an existing one', () => {
    const errors = validateDraftRecord(newRecord({ name: published.name }), {
      isNew: true,
      existingIds: [published.id],
    });
    expect(errors.some((e) => e.field === 'name' && /already exists/.test(e.message))).toBe(true);
  });
});

describe('publishing', () => {
  it('refuses an invalid draft and keeps it', () => {
    const draft = saveDraft(editedRecord({ shortDescription: '' }), {
      serviceId: published.id,
    });
    const review = reviewDraft(draft.draftId);
    expect(review.canPublish).toBe(false);
    expect(review.errors.map((e) => e.field)).toContain('shortDescription');
    expect(() => publishDraft(draft.draftId)).toThrow(/Fix 1 problem/);
    expect(getDraft(draft.draftId)).not.toBeNull();
    expect(storage.getItem(CUSTOM_SERVICES_KEY)).toBeNull();
  });

  it('refuses a draft that changes nothing', () => {
    const draft = saveDraft(structuredClone(published), {
      serviceId: published.id,
    });
    expect(reviewDraft(draft.draftId).changes).toEqual([]);
    expect(() => publishDraft(draft.draftId)).toThrow(/does not change anything/);
  });

  it('shows exactly what will change before publishing', () => {
    const draft = saveDraft(editedRecord(), { serviceId: published.id });
    const review = reviewDraft(draft.draftId);
    expect(review.errors).toEqual([]);
    expect(review.changes.map((c) => c.label)).toEqual(['Processing time']);
    expect(review.changes[0]).toMatchObject({
      kind: 'changed',
      after: ['9 - 10 days (revised)'],
    });
    expect(review.canPublish).toBe(true);
  });

  it('publishes an edit, updates the public guide, logs it and removes the draft', () => {
    const logs = getAuditLogs().length;
    const draft = saveDraft(editedRecord(), { serviceId: published.id });
    const result = publishDraft(draft.draftId, { actor: 'Test Admin' });
    expect(result.changedFields).toEqual(['Processing time']);
    expect(getServiceById(published.id).processingTime).toBe('9 - 10 days (revised)');
    expect(getDraft(draft.draftId)).toBeNull();
    const audit = getAuditLogs();
    expect(audit.length).toBeGreaterThan(logs);
    expect(audit.some((l) => l.action === 'SERVICE_DRAFT_PUBLISHED' && l.details.includes('Processing time'))).toBe(true);
  });

  it('publishes a new guide under a link made from its name', () => {
    const draft = saveDraft(newRecord());
    const result = publishApproved(draft.draftId);
    expect(result.serviceId).toBe('sample-ward-certificate');
    expect(getServiceById('sample-ward-certificate').name).toBe('Sample Ward Certificate');
    expect(listDrafts()).toEqual([]);
  });

  it('blocks when the published guide changed after the draft began, until confirmed', () => {
    const draft = saveDraft(editedRecord(), { serviceId: published.id });
    saveAdminService({ ...structuredClone(published), shortDescription: 'Concurrent summary edit' }, 'Someone Else');

    const review = reviewDraft(draft.draftId);
    expect(review.stale).toBe(true);
    expect(review.newerChanges.map((c) => c.label)).toEqual(['Plain language summary']);
    expect(() => publishDraft(draft.draftId)).toThrow(/changed after this draft began/);
    expect(getServiceById(published.id).processingTime).toBe(published.processingTime);

    publishDraft(draft.draftId, { acknowledgeNewer: true });
    expect(getServiceById(published.id).processingTime).toBe('9 - 10 days (revised)');
  });

  it('keeps the draft when the guide it edits was removed', () => {
    const draft = saveDraft(newRecord({ name: 'Short lived guide' }));
    publishApproved(draft.draftId);
    const edit = saveDraft({ ...getServiceById('short-lived-guide'), processingTime: '1 day' }, { serviceId: 'short-lived-guide' });
    localStorage.setItem(CUSTOM_SERVICES_KEY, '[]');
    const review = reviewDraft(edit.draftId);
    expect(review.removedFromCatalogue).toBe(true);
    expect(() => publishDraft(edit.draftId)).toThrow(/was removed/);
    expect(getDraft(edit.draftId)).not.toBeNull();
  });
});

describe('who may use drafts', () => {
  it('refuses a citizen for every operation, and a missing user', () => {
    const draft = saveDraft(editedRecord(), { serviceId: published.id });
    for (const actor of [{ role: 'citizen', username: 'Someone' }, null]) {
      setCurrentActor(actor);
      expect(() => listDrafts()).toThrow(PermissionDeniedError);
      expect(() => getDraft(draft.draftId)).toThrow(PermissionDeniedError);
      expect(() => saveDraft(newRecord())).toThrow(PermissionDeniedError);
      expect(() => discardDraft(draft.draftId)).toThrow(PermissionDeniedError);
      expect(() => publishDraft(draft.draftId)).toThrow(PermissionDeniedError);
    }
    setCurrentActor({ role: 'admin', username: 'Test Admin' });
    expect(getDraft(draft.draftId)).not.toBeNull();
  });
});
