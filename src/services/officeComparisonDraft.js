/**
 * Non-sensitive comparison draft persistence (#824).
 *
 * A draft only keeps the service/locality filters and selected office IDs so a
 * citizen can return to the workspace. It stores no coordinates, names, phone
 * numbers, Aadhaar numbers or free text.
 */

export const COMPARISON_DRAFT_KEY = 'civicbridge_office_comparison_draft_v1';
export const COMPARISON_DRAFT_VERSION = 1;

const MAX_OFFICE_IDS = 3;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,119}$/i;

const clean = (value, maxLength = 120) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const validViewMode = (value) => ['cards', 'table', 'map'].includes(value);
const validChannel = (value) => ['all', 'in-person', 'online', 'phone'].includes(value);
const validRadius = (value) => [25, 50, 100, 250].includes(Number(value));

export const normalizeComparisonDraft = (draft) => {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;

  const serviceId = clean(draft.serviceId);
  const selectedOfficeIds = Array.isArray(draft.selectedOfficeIds)
    ? [...new Set(draft.selectedOfficeIds.filter((id) => typeof id === 'string' && id.trim()))]
        .slice(0, MAX_OFFICE_IDS)
    : [];

  return {
    version: COMPARISON_DRAFT_VERSION,
    serviceId: SLUG_PATTERN.test(serviceId) ? serviceId : '',
    state: clean(draft.state, 80),
    district: clean(draft.district, 80),
    locality: clean(draft.locality, 120),
    channel: validChannel(draft.channel) ? draft.channel : 'all',
    onlyWheelchairAccessible: draft.onlyWheelchairAccessible === true,
    radiusKm: validRadius(draft.radiusKm) ? Number(draft.radiusKm) : 100,
    selectedOfficeIds,
    viewMode: validViewMode(draft.viewMode) ? draft.viewMode : 'cards',
  };
};

export const hasMeaningfulComparisonDraft = (draft) => {
  const normalized = normalizeComparisonDraft(draft);
  if (!normalized) return false;
  return Boolean(
    normalized.serviceId ||
      normalized.state ||
      normalized.district ||
      normalized.locality ||
      normalized.channel !== 'all' ||
      normalized.onlyWheelchairAccessible ||
      normalized.radiusKm !== 100 ||
      normalized.selectedOfficeIds.length > 0 ||
      normalized.viewMode !== 'cards'
  );
};

export const readComparisonDraft = (storage = globalThis.sessionStorage) => {
  try {
    const raw = storage?.getItem?.(COMPARISON_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== COMPARISON_DRAFT_VERSION) return null;
    return normalizeComparisonDraft(parsed);
  } catch {
    return null;
  }
};

export const writeComparisonDraft = (draft, storage = globalThis.sessionStorage) => {
  const normalized = normalizeComparisonDraft(draft);
  if (!normalized) return false;
  try {
    storage?.setItem?.(COMPARISON_DRAFT_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
};

export const clearComparisonDraft = (storage = globalThis.sessionStorage) => {
  try {
    storage?.removeItem?.(COMPARISON_DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
};
