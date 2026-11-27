// Persistence and state management for Civic Moving-Home Address-Change Action Planner (#725).
// All citizen checklist statuses, document preparation tracking, and acknowledgement URNs
// are stored strictly in client-side localStorage. No citizen data is transmitted to servers.

export const ADDRESS_CHANGE_STORAGE_KEY = 'civic_address_change_planner_v1';

export const CHECKLIST_STATUSES = ['not_started', 'documents_prepared', 'submitted', 'completed'];

export const CHECKLIST_STATUS_LABELS = {
  not_started: 'Not Started',
  documents_prepared: 'Documents Ready',
  submitted: 'Submitted (URN / Ack Received)',
  completed: 'Verified & Completed',
};

const getDefaultStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export const DEFAULT_PLAN_STATE = {
  moveType: 'same_city',
  originState: '',
  originDistrict: '',
  destinationState: '',
  destinationDistrict: '',
  selectedRecordIds: [
    'aadhaar-address-update',
    'voter-electoral-roll-shifting',
    'driving-licence-address-change',
    'ration-card-address-transfer',
  ],
  items: {},
  citizenNotes: '',
  rev: 0,
  updatedAt: null,
};

/**
 * Reads the stored moving home action plan from client storage.
 */
export const readAddressChangePlan = (storage = getDefaultStorage()) => {
  if (!storage) return { ...DEFAULT_PLAN_STATE };

  try {
    const raw = storage.getItem(ADDRESS_CHANGE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PLAN_STATE };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...DEFAULT_PLAN_STATE };
    }

    const rev = Number.isInteger(parsed.rev) && parsed.rev >= 0 ? parsed.rev : 0;
    const moveType = ['same_city', 'inter_district', 'inter_state'].includes(parsed.moveType)
      ? parsed.moveType
      : 'same_city';

    const selectedRecordIds = Array.isArray(parsed.selectedRecordIds)
      ? parsed.selectedRecordIds.filter((id) => typeof id === 'string')
      : DEFAULT_PLAN_STATE.selectedRecordIds;

    const items = parsed.items && typeof parsed.items === 'object' && !Array.isArray(parsed.items)
      ? parsed.items
      : {};

    return {
      moveType,
      originState: typeof parsed.originState === 'string' ? parsed.originState : '',
      originDistrict: typeof parsed.originDistrict === 'string' ? parsed.originDistrict : '',
      destinationState: typeof parsed.destinationState === 'string' ? parsed.destinationState : '',
      destinationDistrict: typeof parsed.destinationDistrict === 'string' ? parsed.destinationDistrict : '',
      selectedRecordIds,
      items,
      citizenNotes: typeof parsed.citizenNotes === 'string' ? parsed.citizenNotes : '',
      rev,
      updatedAt: parsed.updatedAt || null,
    };
  } catch {
    return { ...DEFAULT_PLAN_STATE };
  }
};

/**
 * Saves a moving home action plan with optimistic revision tracking.
 */
export const saveAddressChangePlan = (plan, { expectedRev } = {}, storage = getDefaultStorage()) => {
  if (!storage) {
    return { success: false, error: 'Storage is unavailable' };
  }
  if (!plan || typeof plan !== 'object') {
    return { success: false, error: 'Invalid plan object' };
  }

  const current = readAddressChangePlan(storage);

  if (expectedRev !== undefined && current.rev !== expectedRev) {
    return {
      success: false,
      conflict: true,
      error: `Revision conflict: expected revision ${expectedRev}, but current revision is ${current.rev}`,
      current,
    };
  }

  const newRev = current.rev + 1;
  const updatedAt = new Date().toISOString();

  const sanitized = {
    moveType: ['same_city', 'inter_district', 'inter_state'].includes(plan.moveType)
      ? plan.moveType
      : current.moveType,
    originState: typeof plan.originState === 'string' ? plan.originState.trim() : current.originState,
    originDistrict: typeof plan.originDistrict === 'string' ? plan.originDistrict.trim() : current.originDistrict,
    destinationState: typeof plan.destinationState === 'string' ? plan.destinationState.trim() : current.destinationState,
    destinationDistrict: typeof plan.destinationDistrict === 'string' ? plan.destinationDistrict.trim() : current.destinationDistrict,
    selectedRecordIds: Array.isArray(plan.selectedRecordIds) ? plan.selectedRecordIds : current.selectedRecordIds,
    items: plan.items && typeof plan.items === 'object' ? plan.items : current.items,
    citizenNotes: typeof plan.citizenNotes === 'string' ? plan.citizenNotes.slice(0, 3000) : current.citizenNotes,
    rev: newRev,
    updatedAt,
  };

  try {
    storage.setItem(ADDRESS_CHANGE_STORAGE_KEY, JSON.stringify(sanitized));
    return { success: true, plan: sanitized, rev: newRev };
  } catch (err) {
    return { success: false, error: err?.message || 'Storage write failed' };
  }
};

/**
 * Updates a specific record item in the checklist (status, acknowledgementRef, date, notes).
 */
export const updateRecordProgress = (recordId, patch, storage = getDefaultStorage()) => {
  if (!recordId) return { success: false, error: 'recordId is required' };
  const current = readAddressChangePlan(storage);
  const existingItem = current.items[recordId] || {
    status: 'not_started',
    acknowledgementRef: '',
    submissionDate: '',
    notes: '',
    completedProofs: [],
  };

  const updatedItem = {
    ...existingItem,
    ...patch,
  };

  const newItems = {
    ...current.items,
    [recordId]: updatedItem,
  };

  return saveAddressChangePlan({ ...current, items: newItems }, { expectedRev: current.rev }, storage);
};

/**
 * Permanently deletes the stored address change action plan.
 */
export const deleteAddressChangePlan = (storage = getDefaultStorage()) => {
  if (!storage) return false;
  try {
    storage.removeItem(ADDRESS_CHANGE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
};

