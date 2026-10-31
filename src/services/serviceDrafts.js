/**
 * Private drafts of service guide edits, kept apart from the published catalogue.
 *
 * A draft is a full copy of a record plus a snapshot of what was published when the draft began.
 * Nothing here writes to `civicbridge_custom_services` until `publishDraft` is called, so editing,
 * previewing and discarding a draft never changes what citizens see. Publishing goes through the
 * same `saveAdminService` the direct editor uses (permission check, audit entry), after the draft
 * passes validation and the admin has seen exactly which fields will change.
 *
 * Storage is the browser's localStorage, like the rest of the catalogue: a draft is private to this
 * browser and the signed-in admin, not shared between admins. Docs: docs/SERVICE_DRAFTS.md
 */
import { requirePermission } from './accessControl';
import { FORBIDDEN_FIELDS } from '../data/serviceContract';
import { SERVICE_CATEGORIES } from '../data/serviceCategories';
import { sanitizeTextFields, safeHttpUrl } from '../utils/safeContent';
import { validateJurisdiction, normalizeJurisdiction } from './jurisdictionService';
import { getAllServices, getServiceById } from './serviceCatalog';
import { addAuditLog, saveAdminService } from './adminService';
import { HIGH_IMPACT_KEYS, REVIEW_ALL_CHANGES } from '../data/reviewPolicy';

export const DRAFTS_STORAGE_KEY = 'civicbridge_service_drafts_v1';
export const MAX_DRAFTS = 50;

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

/** Fields shown in the before/after comparison, in reading order. `list` fields compare item by item. */
export const DIFF_FIELDS = [
  { key: 'name', label: 'Service name', fieldId: 'svc-name' },
  { key: 'category', label: 'Category', fieldId: 'svc-category' },
  { key: 'type', label: 'Mode', fieldId: 'svc-type' },
  { key: 'difficulty', label: 'Difficulty', fieldId: 'svc-difficulty' },
  {
    key: 'shortDescription',
    label: 'Plain language summary',
    fieldId: 'svc-summary',
  },
  { key: 'fees', label: 'Fees', fieldId: 'svc-fees' },
  {
    key: 'processingTime',
    label: 'Processing time',
    fieldId: 'svc-processing',
  },
  {
    key: 'officialSources',
    label: 'Official portal',
    fieldId: 'svc-official-url',
  },
  {
    key: 'documents',
    label: 'Required documents',
    list: true,
    fieldId: 'svc-documents',
  },
  {
    key: 'eligibility',
    label: 'Eligibility',
    list: true,
    fieldId: 'svc-eligibility',
  },
  {
    key: 'jurisdiction',
    label: 'Jurisdiction',
    fieldId: 'svc-jurisdiction-level',
  },
  { key: 'intakeWindows', label: 'Intake windows', list: true, fieldId: null },
  { key: 'contacts', label: 'Contact channels', list: true, fieldId: null },
  { key: 'steps', label: 'Steps', list: true, fieldId: null },
];
const FIELD_BY_KEY = new Map(DIFF_FIELDS.map((f) => [f.key, f]));

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim().length > 0;

// ---- formatting and comparing -----------------------------------------------------------------

const lineOf = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'number' || typeof item === 'boolean') return String(item);
  if (isObject(item)) {
    if (item.title && item.description) return `${item.title}: ${item.description}`;
    if (item.name && item.url) return `${item.name} (${item.url})`;
    if (item.label && (item.startDate || item.endDate || item.status)) {
      return [item.label, [item.startDate, item.endDate].filter(Boolean).join(' to '), item.status].filter(Boolean).join(', ');
    }
    if (item.type && item.value) return `${item.type} (${item.method || 'channel'}): ${item.value}`;
    if (item.level) {
      return [item.level, (item.states || []).join(', '), (item.districts || []).join(', '), item.localBody].filter(Boolean).join(' / ');
    }
    return Object.entries(item)
      .map(([k, v]) => `${k}: ${lineOf(v)}`)
      .join(', ');
  }
  return String(item);
};

/** A field's value as a list of readable lines. An empty or missing value is []. */
export const valueLines = (value) => {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value.map(lineOf).filter((l) => l !== '');
  return [lineOf(value)].filter((l) => l !== '');
};

/**
 * What changed between two records, field by field: [{ key, label, kind, before, after, addedItems, removedItems }].
 * kind is 'added' (nothing before), 'removed' (nothing after) or 'changed'. Fields that read the same are left out.
 */
export function diffRecords(before, after) {
  const from = isObject(before) ? before : {};
  const to = isObject(after) ? after : {};
  const changes = [];
  for (const field of DIFF_FIELDS) {
    const b = valueLines(from[field.key]);
    const a = valueLines(to[field.key]);
    if (b.length === a.length && b.every((line, i) => line === a[i])) continue;
    const kind = b.length === 0 ? 'added' : a.length === 0 ? 'removed' : 'changed';
    changes.push({
      key: field.key,
      label: field.label,
      kind,
      before: b,
      after: a,
      addedItems: field.list ? a.filter((line) => !b.includes(line)) : [],
      removedItems: field.list ? b.filter((line) => !a.includes(line)) : [],
    });
  }
  return changes;
}

// ---- validating before publish ------------------------------------------------------------------

/**
 * Problems that stop a draft from being published, as [{ field, fieldId, message }].
 * `fieldId` is the id of the editor control to focus, so the message can link to it.
 */
export function validateDraftRecord(record, { isNew = false, existingIds = [] } = {}) {
  const errors = [];
  const fail = (field, fieldId, message) => errors.push({ field, fieldId, message });
  if (!isObject(record)) return [{ field: '(record)', fieldId: null, message: 'The draft is empty.' }];

  for (const key of FORBIDDEN_FIELDS) {
    if (key in record) fail(key, null, `"${key}" is not allowed in a service guide.`);
  }
  if (!isText(record.name)) fail('name', 'svc-name', 'Service name is required.');
  if (!isText(record.shortDescription)) fail('shortDescription', 'svc-summary', 'The plain language summary is required.');
  if (!SERVICE_CATEGORIES.includes(record.category)) fail('category', 'svc-category', 'Choose a category.');
  if (!isText(record.type)) fail('type', 'svc-type', 'Choose how the service is applied for.');
  if (!DIFFICULTIES.includes(record.difficulty)) fail('difficulty', 'svc-difficulty', 'Choose a difficulty.');
  if (!isText(record.fees)) fail('fees', 'svc-fees', 'Fees are required (write "Free of cost" when there is none).');
  if (!isText(record.processingTime)) fail('processingTime', 'svc-processing', 'Processing time is required.');

  const source = Array.isArray(record.officialSources) ? record.officialSources[0] : null;
  if (!source || !isText(source.name)) fail('officialSources', 'svc-portal-name', 'The official portal name is required.');
  if (!source || !safeHttpUrl(source.url || '').startsWith('https://'))
    fail('officialSources', 'svc-official-url', 'The official portal address must be an https link.');

  if (!Array.isArray(record.documents) || record.documents.length === 0) fail('documents', 'svc-documents', 'List at least one required document.');
  if (record.jurisdiction !== undefined) {
    const problems = validateJurisdiction(record.jurisdiction);
    if (problems.length) fail('jurisdiction', 'svc-jurisdiction-level', problems[0]);
  }

  if (isNew) {
    const id = idFromName(record.name);
    if (!id) fail('name', 'svc-name', 'The name must contain letters or numbers so a link can be made from it.');
    else if (existingIds.includes(id)) fail('name', 'svc-name', `A service with the link "${id}" already exists. Change the name.`);
  }
  return errors;
}

const idFromName = (name) =>
  typeof name === 'string'
    ? name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
    : '';

// ---- storage -----------------------------------------------------------------------------------

/**
 * Where drafts are kept. The default is this browser's localStorage, which is private to one browser. A shared
 * backend (several admins on several devices) supplies its own `{ read(): draft[], write(drafts): void }` with
 * `setDraftStore`; nothing else in the draft or review code needs to change. Docs: docs/SERVICE_REVIEW.md
 */
export const localDraftStore = {
  read() {
    const parsed = JSON.parse(localStorage.getItem(DRAFTS_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  },
  write(drafts) {
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  },
};

let draftStore = localDraftStore;
export const setDraftStore = (store) => {
  draftStore = store ?? localDraftStore;
};

const readAll = () => {
  try {
    return draftStore.read().filter((d) => isObject(d) && isText(d.draftId) && isObject(d.record));
  } catch {
    return [];
  }
};

const writeAll = (drafts) => {
  try {
    draftStore.write(drafts);
  } catch {
    throw new Error('Could not save the draft. Browser storage may be full or blocked.');
  }
  return drafts;
};

/** A short stable fingerprint of any JSON value (keys sorted), used to tell whether a record changed. */
export const fingerprint = (value) => {
  const text = JSON.stringify(value ?? null, (_k, v) => (isObject(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v));
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `${text.length}:${(h >>> 0).toString(16)}`;
};

const clean = (record) => {
  const copy = sanitizeTextFields(structuredClone(record));
  if (copy.jurisdiction) copy.jurisdiction = normalizeJurisdiction(copy.jurisdiction) ?? copy.jurisdiction;
  return copy;
};

const now = () => new Date().toISOString();

/** All drafts, most recently edited first. */
export function listDrafts() {
  requirePermission('services.write');
  return readAll().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function getDraft(draftId) {
  requirePermission('services.write');
  return readAll().find((d) => d.draftId === draftId) ?? null;
}

/** The draft that edits an existing guide, if one was started. */
export function getDraftForService(serviceId) {
  requirePermission('services.write');
  return readAll().find((d) => d.serviceId === serviceId) ?? null;
}

/**
 * Saves a draft. Pass `serviceId` to edit a published guide (the draft remembers what was published when
 * it began), or leave it out to draft a new guide. Passing `draftId` updates that draft.
 */
export function saveDraft(record, { serviceId = null, draftId = null, author = 'Admin' } = {}) {
  requirePermission('services.write');
  if (!isObject(record)) throw new Error('A draft needs a record.');
  const drafts = readAll();
  const existing = drafts.find((d) => d.draftId === draftId) ?? (serviceId ? drafts.find((d) => d.serviceId === serviceId) : null);

  if (existing) {
    const cleaned = clean(record);
    // An edit after the change was sent for review makes that review (or approval) void: it was about other text.
    const reviewStillApplies = existing.review && existing.review.fingerprint === fingerprint(cleaned);
    const next = {
      ...existing,
      record: cleaned,
      review: reviewStillApplies ? existing.review : null,
      updatedAt: now(),
      author,
    };
    writeAll(drafts.map((d) => (d.draftId === existing.draftId ? next : d)));
    return next;
  }
  if (drafts.length >= MAX_DRAFTS) throw new Error(`There can be at most ${MAX_DRAFTS} drafts. Discard one first.`);

  let base = null;
  if (serviceId) {
    base = getServiceById(serviceId);
    if (!base) throw new Error(`There is no published guide "${serviceId}" to edit.`);
  }
  const stamp = now();
  const draft = {
    draftId: serviceId ? `edit-${serviceId}` : `new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    serviceId,
    base: base ? structuredClone(base) : null,
    record: clean(record),
    review: null,
    createdAt: stamp,
    updatedAt: stamp,
    author,
  };
  writeAll([...drafts, draft]);
  return draft;
}

/** Deletes a draft. The published guide is not touched, so there is nothing to undo. */
export function discardDraft(draftId) {
  requirePermission('services.write');
  const drafts = readAll();
  if (!drafts.some((d) => d.draftId === draftId)) throw new Error('That draft no longer exists.');
  writeAll(drafts.filter((d) => d.draftId !== draftId));
}

/** Changes fields of a stored draft other than its record (used by the review workflow). */
export function patchDraft(draftId, patch) {
  requirePermission('services.write');
  const drafts = readAll();
  const existing = drafts.find((d) => d.draftId === draftId);
  if (!existing) throw new Error('That draft no longer exists.');
  const next = { ...existing, ...patch, updatedAt: existing.updatedAt };
  writeAll(drafts.map((d) => (d.draftId === draftId ? next : d)));
  return next;
}

// ---- reviewing and publishing -------------------------------------------------------------------

/**
 * Everything to show before publishing: what will change, what blocks it, and whether the published
 * guide has changed since the draft began (`stale`).
 */
export function reviewDraft(draftId) {
  const draft = getDraft(draftId);
  if (!draft) return null;
  const isNew = draft.serviceId === null;
  const published = isNew ? null : getServiceById(draft.serviceId);
  const existingIds = isNew ? readIds() : [];
  const errors = validateDraftRecord(draft.record, { isNew, existingIds });
  const changes = diffRecords(isNew ? {} : (published ?? draft.base), draft.record);
  const newerChanges = !isNew && published && draft.base ? diffRecords(draft.base, published) : [];

  // Second-reviewer rule: edits to high-impact fields (src/data/reviewPolicy.js) need another admin's approval.
  const highImpact = changes.filter((c) => HIGH_IMPACT_KEYS.includes(c.key));
  const reviewRequired = REVIEW_ALL_CHANGES ? changes.length > 0 : highImpact.length > 0;
  const approval = approvalState(draft, { reviewRequired, published });
  const approvalOk = approval === 'not-needed' || approval === 'approved';
  return {
    draft,
    isNew,
    removedFromCatalogue: !isNew && !published,
    errors,
    changes,
    stale: newerChanges.length > 0,
    newerChanges,
    highImpact,
    reviewRequired,
    approval,
    canPublish: errors.length === 0 && changes.length > 0 && !(!isNew && !published) && approvalOk,
  };
}

/**
 * Where a draft stands with the second-reviewer rule:
 * 'not-needed' (no high-impact field changed), 'none' (not sent yet), 'pending', 'returned', 'approved',
 * or 'outdated' (approved, but the draft or the published guide changed since).
 */
export function approvalState(draft, { reviewRequired, published }) {
  if (!reviewRequired) return 'not-needed';
  const review = draft.review;
  if (!review) return 'none';
  if (review.status === 'approved') {
    const same = review.fingerprint === fingerprint(draft.record) && review.baseFingerprint === fingerprint(published ?? null);
    return same ? 'approved' : 'outdated';
  }
  return review.status === 'pending' || review.status === 'returned' ? review.status : 'none';
}

const APPROVAL_BLOCKS = {
  none: 'This change touches high-impact fields and needs a second reviewer. Send it for review first.',
  pending: 'This change is waiting for a second reviewer. It cannot be published until another admin approves it.',
  returned: 'A reviewer returned this change. Edit the draft and send it for review again.',
  outdated: 'The approval no longer applies because the draft or the published guide changed after it was given. Send it for review again.',
};

const readIds = () => getAllServices({ includeArchived: true }).map((svc) => svc.id);

/**
 * Publishes a draft to the public catalogue and removes it. Refuses when the draft is invalid, when it
 * changes nothing, or when the published guide changed since the draft began and the admin has not
 * confirmed overwriting it (`acknowledgeNewer`).
 * @returns {{ changedFields: string[] }} the labels of the fields that were published
 */
export function publishDraft(draftId, { actor = 'Admin', acknowledgeNewer = false } = {}) {
  requirePermission('services.write');
  const review = reviewDraft(draftId);
  if (!review) throw new Error('That draft no longer exists.');
  if (review.removedFromCatalogue)
    throw new Error('The published guide was removed after this draft began. Discard the draft or copy it to a new guide.');
  if (review.errors.length) throw new Error(`Fix ${review.errors.length} problem${review.errors.length === 1 ? '' : 's'} before publishing.`);
  if (review.changes.length === 0) throw new Error('This draft does not change anything.');
  if (!review.canPublish && APPROVAL_BLOCKS[review.approval]) throw new Error(APPROVAL_BLOCKS[review.approval]);
  if (review.stale && !acknowledgeNewer)
    throw new Error('The published guide changed after this draft began. Review those changes and confirm to overwrite them.');

  const { draft } = review;
  const record = review.isNew ? { ...draft.record } : { ...draft.record, id: draft.serviceId };
  saveAdminService(record, actor);

  const savedId = review.isNew ? idFromName(record.name) : draft.serviceId;
  const saved = getServiceById(savedId);
  if (!saved || saved.name !== record.name) throw new Error('Could not publish. Browser storage may be full or blocked. The draft was kept.');

  const changedFields = review.changes.map((c) => c.label);
  addAuditLog({
    action: 'SERVICE_DRAFT_PUBLISHED',
    actor,
    target: record.name,
    details: `Published a draft. Changed: ${changedFields.join(', ')}.${
      review.approval === 'approved' ? ` Approved by ${draft.review.reviewer}: ${draft.review.reason}` : ''
    }`,
  });
  discardDraft(draftId);
  return { changedFields, serviceId: savedId };
}

export { FIELD_BY_KEY };
