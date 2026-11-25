// Client-side checklist persistence for public library memberships (#727).
// User checklist data is saved strictly in browser localStorage.
// No personal data is transmitted to external servers.

export const LIBRARY_CHECKLIST_KEY = 'civic_library_checklists_v1';
export const LIBRARY_STORAGE_EVENT = 'civicbridge_library_checklist_change';

const getDefaultStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const readMap = (storage) => {
  try {
    const raw = storage.getItem(LIBRARY_CHECKLIST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const notifySubscribers = () => {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new Event(LIBRARY_STORAGE_EVENT));
    } catch {
      // safe fallback
    }
  }
};

/**
 * Reads the stored checklist state for a specific library.
 */
export const readLibraryChecklist = (libraryId, storage = getDefaultStorage()) => {
  if (!libraryId || !storage) {
    return {
      libraryId: libraryId || '',
      checked: [],
      customItems: [],
      selectedCategory: 'general_adult',
      userNotes: '',
      rev: 0,
    };
  }

  const map = readMap(storage);
  const entry = map[libraryId];
  if (!entry || typeof entry !== 'object') {
    return {
      libraryId,
      checked: [],
      customItems: [],
      selectedCategory: 'general_adult',
      userNotes: '',
      rev: 0,
    };
  }

  const rev = Number.isInteger(entry.rev) && entry.rev >= 0 ? entry.rev : 0;
  return {
    libraryId,
    checked: Array.isArray(entry.checked) ? [...new Set(entry.checked.filter((v) => typeof v === 'string'))] : [],
    customItems: Array.isArray(entry.customItems)
      ? [...new Set(entry.customItems.filter((v) => typeof v === 'string'))]
      : [],
    selectedCategory: typeof entry.selectedCategory === 'string' ? entry.selectedCategory : 'general_adult',
    userNotes: typeof entry.userNotes === 'string' ? entry.userNotes.slice(0, 500) : '',
    rev,
    updatedAt: entry.updatedAt || null,
  };
};

/**
 * Saves a full library checklist state with optimistic concurrency check (expectedRev).
 */
export const saveLibraryChecklist = (
  libraryId,
  data,
  expectedRev,
  storage = getDefaultStorage()
) => {
  if (!libraryId || !storage) return { ok: false, reason: 'error' };

  try {
    const current = readLibraryChecklist(libraryId, storage);
    if (expectedRev !== undefined && current.rev !== expectedRev) {
      return { ok: false, reason: 'conflict', state: current };
    }

    const map = readMap(storage);
    const nextRev = current.rev + 1;
    const nextState = {
      libraryId,
      checked: Array.isArray(data.checked) ? [...new Set(data.checked.filter((v) => typeof v === 'string'))] : [],
      customItems: Array.isArray(data.customItems)
        ? [...new Set(data.customItems.filter((v) => typeof v === 'string'))]
        : [],
      selectedCategory: typeof data.selectedCategory === 'string' ? data.selectedCategory : 'general_adult',
      userNotes: typeof data.userNotes === 'string' ? data.userNotes.slice(0, 500) : '',
      rev: nextRev,
      updatedAt: new Date().toISOString(),
    };

    map[libraryId] = nextState;
    storage.setItem(LIBRARY_CHECKLIST_KEY, JSON.stringify(map));
    notifySubscribers();
    return { ok: true, state: nextState };
  } catch {
    return { ok: false, reason: 'error' };
  }
};

/**
 * Toggles a single checklist item in storage.
 */
export const toggleLibraryChecklistItem = (
  libraryId,
  itemLabel,
  expectedRev,
  storage = getDefaultStorage()
) => {
  const current = readLibraryChecklist(libraryId, storage);
  if (expectedRev !== undefined && current.rev !== expectedRev) {
    return { ok: false, reason: 'conflict', state: current };
  }

  const isChecked = current.checked.includes(itemLabel);
  const nextChecked = isChecked
    ? current.checked.filter((l) => l !== itemLabel)
    : [...current.checked, itemLabel];

  return saveLibraryChecklist(
    libraryId,
    {
      ...current,
      checked: nextChecked,
    },
    current.rev,
    storage
  );
};

/**
 * Adds a custom checklist reminder item to storage.
 */
export const addCustomLibraryChecklistItem = (
  libraryId,
  customItem,
  expectedRev,
  storage = getDefaultStorage()
) => {
  const trimmed = typeof customItem === 'string' ? customItem.trim() : '';
  if (!trimmed) return { ok: false, reason: 'empty_item' };

  const current = readLibraryChecklist(libraryId, storage);
  if (expectedRev !== undefined && current.rev !== expectedRev) {
    return { ok: false, reason: 'conflict', state: current };
  }

  if (current.customItems.includes(trimmed)) {
    return { ok: false, reason: 'duplicate_item' };
  }

  return saveLibraryChecklist(
    libraryId,
    {
      ...current,
      customItems: [...current.customItems, trimmed],
    },
    current.rev,
    storage
  );
};

/**
 * Deletes and wipes stored checklist data for a specific library (#727 requirement 10).
 */
export const deleteLibraryChecklist = (libraryId, storage = getDefaultStorage()) => {
  if (!libraryId || !storage) return false;
  try {
    const map = readMap(storage);
    if (!map[libraryId]) return true;
    delete map[libraryId];
    storage.setItem(LIBRARY_CHECKLIST_KEY, JSON.stringify(map));
    notifySubscribers();
    return true;
  } catch {
    return false;
  }
};

