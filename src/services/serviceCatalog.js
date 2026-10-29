import { MOCK_SERVICES } from '../data/services';
import { logDiagnostic } from '../utils/diagnostics';

// Where the admin dashboard keeps guides it added or edited (see adminService).
export const CUSTOM_SERVICES_KEY = 'civicbridge_custom_services';

const isUsableService = (svc) =>
  Boolean(svc) && typeof svc === 'object' && typeof svc.id === 'string' && typeof svc.name === 'string';

/**
 * The one list of service guides every page should read: the built-in guides
 * with the admin's saved guides merged on top (a saved guide with the same id
 * replaces the built-in one). Read it once per mount or per action, it does a
 * localStorage read and JSON parse each call.
 */
export const getAllServices = () => {
  try {
    const raw = localStorage.getItem(CUSTOM_SERVICES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const custom = Array.isArray(parsed) ? parsed.filter(isUsableService) : [];
    if (custom.length === 0) return [...MOCK_SERVICES];
    const customById = new Map(custom.map((c) => [c.id, c]));
    const builtInIds = new Set(MOCK_SERVICES.map((b) => b.id));
    // An edited built-in guide keeps its place in the list, new guides go after the built-in ones.
    return MOCK_SERVICES.map((b) => customById.get(b.id) || b).concat(
      custom.filter((c) => !builtInIds.has(c.id))
    );
  } catch (err) {
    logDiagnostic('Failed to load saved service guides', err);
    return [...MOCK_SERVICES];
  }
};

export const getServiceById = (id) => getAllServices().find((s) => s.id === id) || null;
