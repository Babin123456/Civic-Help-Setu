export const TRANSIT_CHECKLIST_STORAGE_KEY = 'civic_transit_concession_checklists_v1';

const EMPTY_CHECKLIST = {
  renewalDate: '',
  completed: {},
  notes: '',
};

const isValidDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};

const getStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export function readTransitChecklists(storage = getStorage()) {
  if (!storage) return {};
  const raw = storage.getItem(TRANSIT_CHECKLIST_STORAGE_KEY);
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Saved transit checklist data is invalid.');
  }
  return Object.fromEntries(Object.entries(parsed).map(([id, value]) => [
    id,
    {
      renewalDate: isValidDate(value?.renewalDate) ? value.renewalDate : '',
      completed: value?.completed && typeof value.completed === 'object' && !Array.isArray(value.completed)
        ? Object.fromEntries(Object.entries(value.completed).filter(([, done]) => typeof done === 'boolean'))
        : {},
      notes: typeof value?.notes === 'string' ? value.notes.slice(0, 1000) : '',
    },
  ]));
}

export function readTransitChecklist(operatorId, storage = getStorage()) {
  return readTransitChecklists(storage)[operatorId] || { ...EMPTY_CHECKLIST, completed: {} };
}

export function saveTransitChecklist(operatorId, checklist, storage = getStorage()) {
  if (!storage) throw new Error('Checklist storage is unavailable on this device.');
  if (typeof operatorId !== 'string' || !/^[a-z0-9-]{1,100}$/.test(operatorId)) {
    throw new Error('Choose a valid transport operator before saving.');
  }
  if (!checklist || typeof checklist !== 'object' || Array.isArray(checklist)) {
    throw new Error('Checklist data is invalid.');
  }
  const checklists = readTransitChecklists(storage);
  checklists[operatorId] = {
    renewalDate: isValidDate(checklist.renewalDate)
      ? checklist.renewalDate
      : '',
    completed: checklist.completed && typeof checklist.completed === 'object' && !Array.isArray(checklist.completed)
      ? Object.fromEntries(Object.entries(checklist.completed).filter(([, done]) => typeof done === 'boolean'))
      : {},
    notes: typeof checklist.notes === 'string' ? checklist.notes.trim().slice(0, 1000) : '',
  };
  storage.setItem(TRANSIT_CHECKLIST_STORAGE_KEY, JSON.stringify(checklists));
  return checklists[operatorId];
}

export function deleteTransitChecklist(operatorId, storage = getStorage()) {
  if (!storage) throw new Error('Checklist storage is unavailable on this device.');
  const checklists = readTransitChecklists(storage);
  delete checklists[operatorId];
  if (Object.keys(checklists).length) {
    storage.setItem(TRANSIT_CHECKLIST_STORAGE_KEY, JSON.stringify(checklists));
  } else {
    storage.removeItem(TRANSIT_CHECKLIST_STORAGE_KEY);
  }
}

export function deleteAllTransitChecklists(storage = getStorage()) {
  if (!storage) throw new Error('Checklist storage is unavailable on this device.');
  storage.removeItem(TRANSIT_CHECKLIST_STORAGE_KEY);
}
