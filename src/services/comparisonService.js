import { getAllServices } from './serviceCatalog';

const STORAGE_KEY = 'civic_compared_services';
export const MAX_COMPARE_LIMIT = 3;
export const NOT_AVAILABLE = 'Not available';

const readIds = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeIds = (ids) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // storage unavailable: selection simply will not persist
  }
};

const text = (value) => (typeof value === 'string' && value.trim() ? [value.trim()] : []);

const list = (value) =>
  Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v.trim()) : [];

const sources = (value) =>
  Array.isArray(value)
    ? value.filter((s) => s && s.name).map((s) => s.name)
    : [];

// Each row value is an array of strings; an empty array means the record has no data for it.
const MATRIX_ROWS = [
  { attribute: 'Department', pick: (s) => text(s.department) },
  { attribute: 'Category', pick: (s) => text(s.category) },
  { attribute: 'Application channel', pick: (s) => text(s.type) },
  { attribute: 'Difficulty', pick: (s) => text(s.difficulty) },
  { attribute: 'Fees', pick: (s) => text(s.fees) },
  { attribute: 'Processing time', pick: (s) => text(s.processingTime) },
  { attribute: 'Eligibility', pick: (s) => list(s.eligibility) },
  { attribute: 'Required documents', pick: (s) => list(s.documents) },
  { attribute: 'Official sources', pick: (s) => sources(s.officialSources) },
  { attribute: 'Last verified', pick: (s) => text(s.lastVerified) },
];

export const comparisonService = {
  getComparedIds() {
    return readIds();
  },

  getComparedServices() {
    const services = getAllServices();
    return readIds()
      .map((id) => services.find((s) => s.id === id))
      .filter(Boolean);
  },

  addService(serviceId) {
    const ids = readIds();
    if (ids.includes(serviceId)) {
      return { success: false, reason: 'already_added', ids };
    }
    if (ids.length >= MAX_COMPARE_LIMIT) {
      return { success: false, reason: 'limit_reached', max: MAX_COMPARE_LIMIT, ids };
    }
    if (!getAllServices().some((s) => s.id === serviceId)) {
      return { success: false, reason: 'unknown_service', ids };
    }
    const updated = [...ids, serviceId];
    writeIds(updated);
    return { success: true, ids: updated };
  },

  removeService(serviceId) {
    const updated = readIds().filter((id) => id !== serviceId);
    writeIds(updated);
    return updated;
  },

  clearAll() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    return [];
  },

  isCompared(serviceId) {
    return readIds().includes(serviceId);
  },

  buildComparisonMatrix(serviceList) {
    if (!serviceList || serviceList.length === 0) return [];
    return MATRIX_ROWS.map(({ attribute, pick }) => ({
      attribute,
      values: serviceList.map(pick),
    }));
  },

  getDifferencesSummary(serviceList) {
    if (!serviceList || serviceList.length < 2) {
      return { totalRows: 0, differingRows: 0, identicalRows: 0 };
    }
    const matrix = this.buildComparisonMatrix(serviceList);
    let differingRows = 0;
    for (const row of matrix) {
      const distinct = new Set(row.values.map((v) => v.join('\n')));
      if (distinct.size > 1) differingRows++;
    }
    return {
      totalRows: matrix.length,
      differingRows,
      identicalRows: matrix.length - differingRows,
    };
  },
};
