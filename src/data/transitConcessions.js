/**
 * Public operator index. Rule fields remain null until an official, dated source
 * has been reviewed; null values must be presented as unavailable, never inferred.
 *
 * @typedef {'bus' | 'metro' | 'suburban_rail'} TransitMode
 * @typedef {Object} TransitConcessionRecord
 * @property {string} id
 * @property {string} authority
 * @property {{state: string, city: string}} jurisdiction
 * @property {TransitMode} mode
 * @property {string} operator
 * @property {string} sourceUrl
 * @property {string|null} sourceDate
 * @property {string|null} effectiveDate
 * @property {string|null} verifiedAt
 * @property {'unverified'|'verified'} status
 * @property {Object|null} officialInstructions
 * @property {string|null} editorialExplanation
 * @property {string|null} generatedSummary
 * @property {Object|null} fees
 * @property {string|null} validity
 * @property {string|null} routeExclusions
 * @property {string|null} eligibility
 * @property {string|null} application
 * @property {string|null} renewal
 * @property {string|null} lostOrBlockedPass
 */

/** @type {TransitConcessionRecord[]} */
export const TRANSIT_CONCESSION_RECORDS = [
  {
    id: 'delhi-dmrc-metro',
    authority: 'Delhi Metro Rail Corporation',
    jurisdiction: { state: 'Delhi (NCT)', city: 'Delhi' },
    mode: 'metro',
    operator: 'Delhi Metro Rail Corporation (DMRC)',
    sourceUrl: 'https://delhimetrorail.com/',
    sourceDate: null,
    effectiveDate: null,
    verifiedAt: null,
    status: 'unverified',
    officialInstructions: null,
    editorialExplanation: null,
    generatedSummary: null,
    fees: null,
    validity: null,
    routeExclusions: null,
    eligibility: null,
    application: null,
    renewal: null,
    lostOrBlockedPass: null,
  },
  {
    id: 'karnataka-bmtc-bus',
    authority: 'Bengaluru Metropolitan Transport Corporation',
    jurisdiction: { state: 'Karnataka', city: 'Bengaluru' },
    mode: 'bus',
    operator: 'Bengaluru Metropolitan Transport Corporation (BMTC)',
    sourceUrl: 'https://mybmtc.karnataka.gov.in/',
    sourceDate: null,
    effectiveDate: null,
    verifiedAt: null,
    status: 'unverified',
    officialInstructions: null,
    editorialExplanation: null,
    generatedSummary: null,
    fees: null,
    validity: null,
    routeExclusions: null,
    eligibility: null,
    application: null,
    renewal: null,
    lostOrBlockedPass: null,
  },
  {
    id: 'karnataka-bmrcl-metro',
    authority: 'Bangalore Metro Rail Corporation Limited',
    jurisdiction: { state: 'Karnataka', city: 'Bengaluru' },
    mode: 'metro',
    operator: 'Bangalore Metro Rail Corporation Limited (BMRCL)',
    sourceUrl: 'https://english.bmrc.co.in/',
    sourceDate: null,
    effectiveDate: null,
    verifiedAt: null,
    status: 'unverified',
    officialInstructions: null,
    editorialExplanation: null,
    generatedSummary: null,
    fees: null,
    validity: null,
    routeExclusions: null,
    eligibility: null,
    application: null,
    renewal: null,
    lostOrBlockedPass: null,
  },
  {
    id: 'maharashtra-best-bus',
    authority: 'Brihanmumbai Electric Supply and Transport Undertaking',
    jurisdiction: { state: 'Maharashtra', city: 'Mumbai' },
    mode: 'bus',
    operator: 'Brihanmumbai Electric Supply and Transport (BEST)',
    sourceUrl: 'https://bestundertaking.com/',
    sourceDate: null,
    effectiveDate: null,
    verifiedAt: null,
    status: 'unverified',
    officialInstructions: null,
    editorialExplanation: null,
    generatedSummary: null,
    fees: null,
    validity: null,
    routeExclusions: null,
    eligibility: null,
    application: null,
    renewal: null,
    lostOrBlockedPass: null,
  },
  {
    id: 'tamil-nadu-mtc-bus',
    authority: 'Metropolitan Transport Corporation (Chennai) Limited',
    jurisdiction: { state: 'Tamil Nadu', city: 'Chennai' },
    mode: 'bus',
    operator: 'Metropolitan Transport Corporation (Chennai) Limited (MTC)',
    sourceUrl: 'https://mtcbus.tn.gov.in/',
    sourceDate: null,
    effectiveDate: null,
    verifiedAt: null,
    status: 'unverified',
    officialInstructions: null,
    editorialExplanation: null,
    generatedSummary: null,
    fees: null,
    validity: null,
    routeExclusions: null,
    eligibility: null,
    application: null,
    renewal: null,
    lostOrBlockedPass: null,
  },
  {
    id: 'tamil-nadu-cmrl-metro',
    authority: 'Chennai Metro Rail Limited',
    jurisdiction: { state: 'Tamil Nadu', city: 'Chennai' },
    mode: 'metro',
    operator: 'Chennai Metro Rail Limited (CMRL)',
    sourceUrl: 'https://chennaimetrorail.org/',
    sourceDate: null,
    effectiveDate: null,
    verifiedAt: null,
    status: 'unverified',
    officialInstructions: null,
    editorialExplanation: null,
    generatedSummary: null,
    fees: null,
    validity: null,
    routeExclusions: null,
    eligibility: null,
    application: null,
    renewal: null,
    lostOrBlockedPass: null,
  },
  {
    id: 'tamil-nadu-southern-railway-suburban',
    authority: 'Southern Railway',
    jurisdiction: { state: 'Tamil Nadu', city: 'Chennai' },
    mode: 'suburban_rail',
    operator: 'Southern Railway — Chennai suburban services',
    sourceUrl: 'https://sr.indianrailways.gov.in/',
    sourceDate: null,
    effectiveDate: null,
    verifiedAt: null,
    status: 'unverified',
    officialInstructions: null,
    editorialExplanation: null,
    generatedSummary: null,
    fees: null,
    validity: null,
    routeExclusions: null,
    eligibility: null,
    application: null,
    renewal: null,
    lostOrBlockedPass: null,
  },
];

export const TRANSIT_MODES = [
  { id: 'bus', label: 'Bus' },
  { id: 'metro', label: 'Metro' },
  { id: 'suburban_rail', label: 'Suburban rail' },
];

export function getTransitStates(records = TRANSIT_CONCESSION_RECORDS) {
  return [...new Set(records.map((record) => record.jurisdiction.state))].sort();
}

export function getTransitCities(state, records = TRANSIT_CONCESSION_RECORDS) {
  return [...new Set(records
    .filter((record) => record.jurisdiction.state === state)
    .map((record) => record.jurisdiction.city))].sort();
}

export function getTransitOperators(state, city, records = TRANSIT_CONCESSION_RECORDS) {
  return records.filter((record) =>
    record.jurisdiction.state === state && record.jurisdiction.city === city
  );
}

export function findTransitRecord(id, records = TRANSIT_CONCESSION_RECORDS) {
  return records.find((record) => record.id === id) || null;
}

export function validateTransitConcessionRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  const isDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  };
  const validHttpsUrl = typeof record.sourceUrl === 'string' && (() => {
    try {
      return new URL(record.sourceUrl).protocol === 'https:';
    } catch {
      return false;
    }
  })();
  const validStatus = ['unverified', 'verified'].includes(record.status);
  const validVerifiedEvidence = record.status !== 'verified' || (
    isDate(record.sourceDate) &&
    typeof record.verifiedAt === 'string' &&
    !Number.isNaN(Date.parse(record.verifiedAt)) &&
    Date.parse(record.verifiedAt) <= Date.now() &&
    (record.effectiveDate === null || isDate(record.effectiveDate)) &&
    record.officialInstructions &&
    typeof record.officialInstructions === 'object' &&
    typeof record.officialInstructions?.content === 'string' &&
    record.officialInstructions.content.trim().length > 0 &&
    [record.eligibility, record.application, record.renewal, record.lostOrBlockedPass,
      record.fees, record.validity, record.routeExclusions].some((value) => value !== null && value !== undefined)
  );
  return Boolean(
    typeof record.id === 'string' &&
    typeof record.authority === 'string' &&
    typeof record.jurisdiction?.state === 'string' &&
    typeof record.jurisdiction?.city === 'string' &&
    TRANSIT_MODES.some((mode) => mode.id === record.mode) &&
    typeof record.operator === 'string' &&
    validHttpsUrl &&
    (record.sourceDate === null || typeof record.sourceDate === 'string') &&
    (record.effectiveDate === null || isDate(record.effectiveDate)) &&
    (record.verifiedAt === null || typeof record.verifiedAt === 'string') &&
    validStatus &&
    validVerifiedEvidence
  );
}

export function isTransitRecordStale(record, now = Date.now()) {
  if (record?.status !== 'verified' || typeof record.verifiedAt !== 'string') return true;
  const verifiedAt = Date.parse(record.verifiedAt);
  return Number.isNaN(verifiedAt) || now - verifiedAt > 180 * 24 * 60 * 60 * 1000;
}

export const TRANSIT_POLICY_FIELDS = [
  ['eligibility', 'Eligibility'],
  ['application', 'Application'],
  ['renewal', 'Renewal'],
  ['fees', 'Fees'],
  ['validity', 'Validity'],
  ['routeExclusions', 'Route exclusions'],
  ['lostOrBlockedPass', 'Lost or blocked pass'],
];

export function formatTransitPolicyValue(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(formatTransitPolicyValue).join('; ');
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${formatTransitPolicyValue(item)}`)
      .join('; ');
  }
  return '';
}
