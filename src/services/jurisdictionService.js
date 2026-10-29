import { INDIAN_STATES_AND_UTS, JURISDICTION_LEVELS, JURISDICTION_LEVEL_LABELS } from '../data/jurisdictions';

/**
 * Service applicability by jurisdiction (#260).
 *
 * A service record may carry `jurisdiction: { level, states, districts, localBody }`.
 * A record without it is "unknown": it is shown as unverified and is never treated as
 * available everywhere.
 */

export const MAX_REGION_NAME_LENGTH = 80;

const clean = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');
const cleanList = (value) => (Array.isArray(value) ? value.map(clean).filter(Boolean) : []);
const sameText = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase();
const includesText = (list, value) => list.some((item) => sameText(item, value));

const stateByName = (name) => INDIAN_STATES_AND_UTS.find((s) => sameText(s, name));

/** Returns a clean jurisdiction object, or null when the record has no usable one. */
export const normalizeJurisdiction = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const level = clean(raw.level).toLowerCase();
  if (!JURISDICTION_LEVELS.includes(level)) return null;
  return {
    level,
    states: cleanList(raw.states).map((s) => stateByName(s) || s),
    districts: cleanList(raw.districts),
    localBody: clean(raw.localBody),
  };
};

/**
 * Checks a jurisdiction for impossible hierarchy values. Returns a list of messages,
 * empty when the value is consistent.
 */
export const validateJurisdiction = (raw) => {
  const j = normalizeJurisdiction(raw);
  if (!j) return ['Choose a jurisdiction level.'];
  const errors = [];
  const { level, states, districts, localBody } = j;

  states.forEach((s) => {
    if (!stateByName(s)) errors.push(`"${s}" is not a recognised state or Union Territory.`);
  });
  [...districts, localBody].forEach((name) => {
    if (name.length > MAX_REGION_NAME_LENGTH) {
      errors.push(`Region names must be ${MAX_REGION_NAME_LENGTH} characters or fewer.`);
    }
  });

  if (level === 'national') {
    if (states.length || districts.length || localBody) {
      errors.push('A national service cannot list a state, district or local body.');
    }
  } else if (level === 'state') {
    if (states.length === 0) errors.push('Select at least one state or Union Territory.');
    if (districts.length || localBody) errors.push('A state-level service cannot list a district or local body.');
  } else {
    if (states.length !== 1) errors.push('Select exactly one state for a district or local-body service.');
    if (districts.length === 0) errors.push('Enter the district.');
    if (level === 'district' && localBody) errors.push('A district-level service cannot list a local body.');
    if (level === 'local') {
      if (districts.length > 1) errors.push('A local-body service belongs to exactly one district.');
      if (!localBody) errors.push('Enter the local body (municipality, panchayat or ward).');
    }
  }
  return errors;
};

/**
 * Scope of a service: 'national' | 'state' | 'district' | 'local' for a valid record,
 * 'unknown' when the metadata is missing or inconsistent.
 */
export const getApplicabilityLevel = (service) => {
  const j = normalizeJurisdiction(service?.jurisdiction);
  if (!j || validateJurisdiction(j).length > 0) return 'unknown';
  return j.level;
};

/** Short label for a card or badge. */
export const getApplicabilityLabel = (service) => {
  const level = getApplicabilityLevel(service);
  if (level === 'unknown') return 'Jurisdiction unverified';
  const j = normalizeJurisdiction(service.jurisdiction);
  if (level === 'national') return 'National';
  if (level === 'state') return j.states.length > 2 ? `${j.states.length} states / UTs` : j.states.join(', ');
  if (level === 'district') return `${j.districts.join(', ')}, ${j.states[0]}`;
  return `${j.localBody}, ${j.districts[0]}, ${j.states[0]}`;
};

/** Text and rows for the applicability panel on the service details page. */
export const getApplicabilityDetails = (service) => {
  const level = getApplicabilityLevel(service);
  if (level === 'unknown') {
    return {
      level,
      levelLabel: 'Not specified',
      summary:
        'The jurisdiction for this service has not been verified. Do not assume it is available in your area; check with the official source.',
      rows: [],
    };
  }
  const j = normalizeJurisdiction(service.jurisdiction);
  const rows = [];
  if (j.states.length) rows.push({ label: j.states.length > 1 ? 'States / UTs' : 'State / UT', value: j.states.join(', ') });
  if (j.districts.length) rows.push({ label: 'District', value: j.districts.join(', ') });
  if (j.localBody) rows.push({ label: 'Local body', value: j.localBody });
  return {
    level,
    levelLabel: JURISDICTION_LEVEL_LABELS[level],
    summary: level === 'national' ? 'Applies across India.' : `Applies only to: ${getApplicabilityLabel(service)}.`,
    rows,
  };
};

/**
 * Does the service apply to the selected place? A national service applies everywhere, a state
 * service to the listed states, a district or local service to its own state and district.
 * Unknown services never match a selected place (not specified is not "everywhere").
 * With no state selected every service matches.
 */
export const matchesJurisdiction = (service, { state = 'All', district = 'All' } = {}) => {
  if (state === 'All') return true;
  const level = getApplicabilityLevel(service);
  if (level === 'unknown') return false;
  if (level === 'national') return true;
  const j = normalizeJurisdiction(service.jurisdiction);
  if (!includesText(j.states, state)) return false;
  if (district === 'All' || level === 'state') return true;
  return includesText(j.districts, district);
};

/** Districts named by district or local services in a state, for the district filter. */
export const getDistrictOptions = (services, state) => {
  if (!state || state === 'All') return [];
  const found = new Set();
  services.forEach((s) => {
    const level = getApplicabilityLevel(s);
    if (level !== 'district' && level !== 'local') return;
    const j = normalizeJurisdiction(s.jurisdiction);
    if (includesText(j.states, state)) j.districts.forEach((d) => found.add(d));
  });
  return [...found].sort((a, b) => a.localeCompare(b));
};

/**
 * Reads the state and district filters from the address bar. Unknown states fall back to
 * "All"; a district must be one the catalogue lists for that state.
 */
export const parseJurisdictionFilters = (params, services = []) => {
  const wantedState = clean(params.get('state'));
  const state = stateByName(wantedState) || 'All';
  const options = getDistrictOptions(services, state);
  const wantedDistrict = clean(params.get('district'));
  const district = options.find((d) => sameText(d, wantedDistrict)) || 'All';
  return { state, district, districtOptions: options };
};
