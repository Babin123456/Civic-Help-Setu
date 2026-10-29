import { logDiagnostic } from '../utils/diagnostics';
const STORAGE_KEY = 'civicbridge_saved_rich';
const LEGACY_KEY = 'civicbridge_saved';

export const getSavedItems = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Check if legacy list exists
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        const migrated = parsed.map((item) => ({
          serviceId: typeof item === 'string' ? item : item.id,
          folder: item.category || 'General',
          priority: 'normal',
          notes: '',
          savedAt: new Date().toISOString().split('T')[0],
          targetDate: null,
          status: 'pending',
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      // New users start with nothing saved so the Saved page can show its empty state.
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logDiagnostic('Failed to load saved items from storage', err);
    return [];
  }
};

export const saveItem = (serviceId, folder = 'General', notes = '', priority = 'normal') => {
  const current = getSavedItems();
  const existing = current.find((item) => item.serviceId === serviceId);

  let updated;
  if (existing) {
    updated = current.map((item) =>
      item.serviceId === serviceId
        ? { ...item, folder, notes, priority }
        : item
    );
  } else {
    const newItem = {
      serviceId,
      folder,
      notes,
      priority,
      savedAt: new Date().toISOString().split('T')[0],
      targetDate: null,
      status: 'pending',
    };
    updated = [newItem, ...current];
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  // Keep legacy key in sync for backwards compatibility
  localStorage.setItem(LEGACY_KEY, JSON.stringify(updated.map((u) => ({ id: u.serviceId }))));
  return updated;
};

export const updateItem = (serviceId, updates = {}) => {
  const current = getSavedItems();
  const updated = current.map((item) =>
    item.serviceId === serviceId ? { ...item, ...updates } : item
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const removeItem = (serviceId) => {
  const current = getSavedItems();
  const updated = current.filter((item) => item.serviceId !== serviceId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  localStorage.setItem(LEGACY_KEY, JSON.stringify(updated.map((u) => ({ id: u.serviceId }))));
  return updated;
};

export const clearAllSaved = () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_KEY);
  return [];
};

export const toggleFavoriteItem = (serviceId) => {
  const current = getSavedItems();
  const updated = current.map((item) =>
    item.serviceId === serviceId ? { ...item, isFavorite: !item.isFavorite } : item
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const getFolders = (items = []) => {
  const found = new Set(items.map((i) => i.folder || 'General'));
  return ['All', ...Array.from(found)];
};
