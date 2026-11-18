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

const sourceIds = (value) =>
  Array.isArray(value)
    ? value.filter((s) => s && s.id).map((s) => s.id)
    : [];

/** Each row value is an array of strings; an empty array means the record has no data for it. */
const MATRIX_ROWS = [
  { attribute: 'Department', pick: (s) => text(s.department), sourcePick: (s) => sourceIds(s.department) },
  { attribute: 'Category', pick: (s) => text(s.category), sourcePick: (s) => sourceIds(s.category) },
  { attribute: 'Application channel', pick: (s) => text(s.type), sourcePick: (s) => sourceIds(s.type) },
  { attribute: 'Difficulty', pick: (s) => text(s.difficulty), sourcePick: (s) => sourceIds(s.difficulty) },
  { attribute: 'Fees', pick: (s) => text(s.fees), sourcePick: (s) => sourceIds(s.fees) },
  { attribute: 'Processing time', pick: (s) => text(s.processingTime), sourcePick: (s) => sourceIds(s.processingTime) },
  { attribute: 'Eligibility', pick: (s) => list(s.eligibility), sourcePick: (s) => sourceIds(s.eligibility) },
  { attribute: 'Required documents', pick: (s) => list(s.documents), sourcePick: (s) => sourceIds(s.documents) },
  { attribute: 'Official sources', pick: (s) => sources(s.officialSources), sourcePick: (s) => sourceIds(s.officialSources) },
  { attribute: 'Last verified', pick: (s) => text(s.lastVerified), sourcePick: (s) => sourceIds(s.lastVerified) },
];

/** Build a comparison matrix row with both values and their source references. */
const buildMatrixRow = (serviceList, pick, sourcePick) =>
  serviceList.map((s) => {
    const v = pick(s);
    const src = sourcePick(s);
    return { value: v, source: src, serviceId: s.id };
  });

/**
 * Comparison result for a single attribute across services.
 * Holds the displayed values, which services provide each value,
 * and which values are missing vs present.
 */
export const ComparisonAttribute = ({
  attribute,
  services,
  serviceMap,
}) => {
  const rows = MATRIX_ROWS.filter((row) => row.attribute === attribute);
  if (rows.length === 0) return null;

  const result = rows.map((row) => {
    const servicedValues = buildMatrixRow(services, row.pick, row.sourcePick);
    const allEmpty = servicedValues.every((r) => !r.value || r.value.length === 0);
    const allSame = new Set(servicedValues.map((r) => r.value.join('\n'))).size <= 1;
    const differs = allEmpty ? false : !allSame;

    return {
      attribute: row.attribute,
      values: servicedValues.map((r) => r.value),
      sources: servicedValues.map((r) => r.source),
      serviceIds: servicedValues.map((r) => r.serviceId),
      differs,
      allEmpty,
      isMissing: allEmpty,
    };
  });

  return {
    attribute,
    rows: result,
    totalRows: result.length,
    hasDiffs: result.some((r) => r.differs),
    hasMissing: result.some((r) => r.allEmpty),
  };
};

/** Generate an AI-drafted explanation summarizing differences across compared services.
 * Uses only the exact compared fields; does not rank options as better;
 * cites source service records by ID.
 */
export const generateAIExplanation = (comparedServices) => {
  if (!comparedServices || comparedServices.length < 2) {
    return { explanation: '', sources: [] };
  }

  const serviceMap = new Map(
    comparedServices.map((s) => [s.id, { name: s.name, department: s.department }])
  );

  // Collect all non-empty values per attribute across services
  const attributeValues = {};
  comparedServices.forEach((s) => {
    const matrix = comparisonService.buildComparisonMatrix([s]);
    matrix.forEach((row) => {
      const attr = row.attribute;
      if (!attributeValues[attr]) attributeValues[attr] = [];
      attributeValues[attr].push({
        serviceId: s.id,
        value: row.values[0] || [],
      });
    });
  });

  // Build summary citing only exact fields
  const lines = [];
  const citedSources = new Set();

  MATRIX_ROWS.forEach((rowDef) => {
    const attr = rowDef.attribute;
    const values = attributeValues[attr];
    if (!values || values.length === 0) return;

    const serviceNames = values
      .filter((v) => v.value && v.value.length > 0)
      .map((v) => serviceMap.get(v.serviceId)?.name || v.serviceId);

    if (serviceNames.length > 0) {
      const uniqueServices = [...new Set(serviceNames)];
      let summary;
      if (uniqueServices.length === 1) {
        summary = `${uniqueServices[0]} ${
          values[0].value.length > 0
            ? 'has: ' + values[0].value[0]
            : 'no data available'
        }`;
      } else {
        summary = `${uniqueServices.join(' and ')} ${
          values[0].value.length > 0
            ? 'have differing values: '
            : 'have no data for this attribute'
        } ${values
          .filter((v) => v.value && v.value.length > 0)
          .map((v) => `${serviceMap.get(v.serviceId)?.name}: ${v.value[0]}`)
          .join(', ')}`;
      }
      lines.push(`• ${attr}: ${summary}`);
      // Cite source service IDs
      values.forEach((v) => citedSources.add(v.serviceId));
    }
  });

  return {
    explanation: lines.join('\n    '),
    sources: Array.from(citedSources),
  };
};

/** Add a service to the comparison store. */
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

/** Reset localStorage comparison state (useful for testing or stale-data recovery). */
comparisonService.resetStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};