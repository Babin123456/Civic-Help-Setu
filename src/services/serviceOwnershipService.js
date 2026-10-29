import { requirePermission } from './accessControl';
import { addAuditLog } from './adminService';

/**
 * Service record ownership and review assignment (admin only).
 *
 * Who is responsible for keeping a service guide correct is kept apart from the guide itself and
 * from who created or last edited it. Assignments live under their own storage key; nothing here
 * writes to the service records, and no public page imports this module, so reviewer names and
 * private notes cannot reach a citizen-facing view. Nothing is emailed or notified.
 */

const STORAGE_KEY = 'civicbridge_service_ownership_v1';

export const QUEUE_STATUSES = {
  none: 'No status',
  queued: 'Queued for review',
  in_review: 'In review',
  needs_follow_up: 'Needs follow-up',
  done: 'Reviewed',
};

export const MAX_TEAM_LENGTH = 60;
export const MAX_NOTE_LENGTH = 500;

const getStorage = (customStorage) => {
  if (customStorage) return customStorage;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  return null;
};

const text = (value, max) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const isStatus = (value) => typeof value === 'string' && Object.prototype.hasOwnProperty.call(QUEUE_STATUSES, value);

/** Coerces whatever is stored into a safe record, or null when it holds no ownership at all. */
export const normalizeOwnership = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const reviewerId = text(raw.reviewerId, 80);
  const team = text(raw.team, MAX_TEAM_LENGTH);
  if (!reviewerId && !team) return null;
  return {
    reviewerId,
    reviewerName: text(raw.reviewerName, 80),
    team,
    queueStatus: isStatus(raw.queueStatus) ? raw.queueStatus : 'none',
    privateNote: typeof raw.privateNote === 'string' ? raw.privateNote.trim().slice(0, MAX_NOTE_LENGTH) : '',
    assignedAt: typeof raw.assignedAt === 'string' ? raw.assignedAt : '',
    assignedBy: text(raw.assignedBy, 80),
  };
};

/** Validates the assignment form. Returns { ok, errors, value }. A reviewer or a team is required. */
export const validateOwnership = (input, users = []) => {
  const errors = {};
  const source = input && typeof input === 'object' ? input : {};
  const reviewerId = text(source.reviewerId, 80);
  const team = text(source.team, MAX_TEAM_LENGTH);
  const rawNote = typeof source.privateNote === 'string' ? source.privateNote.trim() : '';
  const reviewer = reviewerId ? (Array.isArray(users) ? users : []).find((u) => u && u.id === reviewerId) : null;

  if (!reviewerId && !team) errors.owner = 'Choose a reviewer or enter a team.';
  if (reviewerId && !reviewer) errors.reviewerId = 'That reviewer account is not available.';
  if (typeof source.team === 'string' && source.team.trim().length > MAX_TEAM_LENGTH) {
    errors.team = `Team name must be ${MAX_TEAM_LENGTH} characters or fewer.`;
  }
  if (rawNote.length > MAX_NOTE_LENGTH) errors.privateNote = `Note must be ${MAX_NOTE_LENGTH} characters or fewer.`;
  if (source.queueStatus !== undefined && !isStatus(source.queueStatus)) errors.queueStatus = 'Choose a valid queue status.';
  if (Object.keys(errors).length) return { ok: false, errors, value: null };

  return {
    ok: true,
    errors: {},
    value: {
      reviewerId,
      reviewerName: reviewer ? reviewer.username || reviewer.email || reviewer.id : '',
      team,
      queueStatus: source.queueStatus || 'none',
      privateNote: rawNote,
    },
  };
};

const readAll = (customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return {};
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const map = {};
    for (const [id, raw] of Object.entries(parsed)) {
      const record = normalizeOwnership(raw);
      if (record) map[id] = record;
    }
    return map;
  } catch {
    return {};
  }
};

const writeAll = (map, customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
};

export const getOwnershipMap = (customStorage) => {
  requirePermission('ownership.read');
  return readAll(customStorage);
};

/**
 * What to show for a record's owner. A reviewer whose account is gone is reported as unavailable,
 * using the name saved at assignment time, instead of throwing or showing a blank.
 */
export const describeOwner = (record, users = []) => {
  const safe = normalizeOwnership(record);
  if (!safe) return { state: 'unassigned', label: 'Unassigned', reviewer: '', team: '' };
  const list = Array.isArray(users) ? users : [];
  let reviewer = '';
  let unavailable = false;
  if (safe.reviewerId) {
    const found = list.find((u) => u && u.id === safe.reviewerId);
    if (found) {
      reviewer = found.username || found.email || safe.reviewerName || safe.reviewerId;
    } else {
      unavailable = true;
      reviewer = `${safe.reviewerName || 'Unknown reviewer'} (account unavailable)`;
    }
  }
  const label = [reviewer, safe.team && `Team: ${safe.team}`].filter(Boolean).join(' / ');
  return { state: unavailable ? 'unavailable' : 'assigned', label, reviewer, team: safe.team };
};

/**
 * Assigns or reassigns a service record. Returns { ok, errors, record }.
 * Does not touch the service record, its creator or its last-editor metadata.
 */
export const assignServiceOwnership = (serviceId, input, { users = [], actorName = 'Admin', storage } = {}) => {
  requirePermission('ownership.manage');
  if (!serviceId) return { ok: false, errors: { serviceId: 'A service is required.' }, record: null };
  const checked = validateOwnership(input, users);
  if (!checked.ok) return { ok: false, errors: checked.errors, record: null };

  const map = readAll(storage);
  const record = { ...checked.value, assignedAt: new Date().toISOString(), assignedBy: text(actorName, 80) || 'Admin' };
  map[serviceId] = record;
  if (!writeAll(map, storage)) {
    return { ok: false, errors: { save: 'Could not save the assignment on this device.' }, record: null };
  }

  // The private note is deliberately left out of the audit trail.
  addAuditLog({
    action: 'OWNERSHIP_CHANGED',
    actor: record.assignedBy,
    target: String(serviceId),
    details: `Assigned to ${describeOwner(record, users).label}.`,
  });
  return { ok: true, errors: {}, record };
};

export const clearServiceOwnership = (serviceId, { actorName = 'Admin', storage } = {}) => {
  requirePermission('ownership.manage');
  const map = readAll(storage);
  if (!map[serviceId]) return false;
  delete map[serviceId];
  const saved = writeAll(map, storage);
  if (saved) {
    addAuditLog({ action: 'OWNERSHIP_CHANGED', actor: text(actorName, 80) || 'Admin', target: String(serviceId), details: 'Ownership cleared.' });
  }
  return saved;
};

/** Filter choices: the fixed ones, then each reviewer and team that currently has records. */
export const buildOwnershipFilterOptions = (map = {}, users = []) => {
  const teams = new Set();
  const reviewers = new Map();
  for (const raw of Object.values(map || {})) {
    const record = normalizeOwnership(raw);
    if (!record) continue;
    if (record.team) teams.add(record.team);
    if (record.reviewerId) reviewers.set(record.reviewerId, describeOwner(record, users).reviewer);
  }
  return [
    { value: 'all', label: 'All records' },
    { value: 'unassigned', label: 'Unassigned' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'unavailable', label: 'Reviewer unavailable' },
    ...[...reviewers].map(([id, name]) => ({ value: `reviewer:${id}`, label: `Reviewer: ${name}` })),
    ...[...teams].sort().map((team) => ({ value: `team:${team}`, label: `Team: ${team}` })),
  ];
};

export const filterByOwnership = (services, map = {}, users = [], filter = 'all') => {
  const list = Array.isArray(services) ? services : [];
  if (!filter || filter === 'all') return list;
  return list.filter((svc) => {
    const record = normalizeOwnership(map?.[svc?.id]);
    if (filter === 'unassigned') return !record;
    if (!record) return false;
    if (filter === 'assigned') return true;
    if (filter === 'unavailable') return describeOwner(record, users).state === 'unavailable';
    if (filter.startsWith('reviewer:')) return record.reviewerId === filter.slice('reviewer:'.length);
    if (filter.startsWith('team:')) return record.team === filter.slice('team:'.length);
    return true;
  });
};
