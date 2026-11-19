/**
 * Local civic office comparison service (#824)
 *
 * Pure, deterministic helpers shared by the comparison workspace and the
 * read-only ranking endpoint. Nothing here calls the network or reads browser
 * storage, so the same rules run in the browser and in the server handler.
 *
 * Grounding rules:
 * - An office only "offers" a service when its office record lists that
 *   service ID. A catalogue match alone never upgrades the claim.
 * - Every capability claim carries the office-record source that supports it.
 *   When the record has no source, the claim is shown as unverified; a portal
 *   link is offered as context, not as proof.
 * - Missing values stay `Unknown`. Unverified coordinates never become a pin.
 * - Ranking is deterministic: service capability, jurisdiction, then evidence
 *   freshness. Names and IDs break ties so equal records always sort the same.
 */

import { CIVIC_OFFICES } from '../data/locationOffices.js';
import { MOCK_SERVICES } from '../data/services.js';
import { safeHttpUrl } from '../utils/safeContent.js';

export const OFFICE_COMPARISON_DATA_VERSION = 'office-registry-2026-11-18.1';
export const STALE_RECORD_DAYS = 180;
export const MAX_COMPARE_OFFICES = 3;
export const MIN_COMPARE_OFFICES = 2;
export const DEFAULT_PAGE_SIZE = 6;
export const MAX_PAGE_SIZE = 50;

export const COMPARISON_MATCH_STATUS = {
  VERIFIED_MATCH: 'VERIFIED_MATCH',
  STALE_MATCH: 'STALE_MATCH',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  CAPABILITY_CONFLICT: 'CAPABILITY_CONFLICT',
  JURISDICTION_ONLY: 'JURISDICTION_ONLY',
  NOT_MATCHED: 'NOT_MATCHED',
  NEUTRAL: 'NEUTRAL',
};

export const MATCH_STATUS_LABELS = {
  [COMPARISON_MATCH_STATUS.VERIFIED_MATCH]: 'Verified service match',
  [COMPARISON_MATCH_STATUS.STALE_MATCH]: 'Service match — record stale',
  [COMPARISON_MATCH_STATUS.REVIEW_REQUIRED]: 'Service match — review required',
  [COMPARISON_MATCH_STATUS.CAPABILITY_CONFLICT]: 'Conflicting evidence — review required',
  [COMPARISON_MATCH_STATUS.JURISDICTION_ONLY]: 'Jurisdiction match only',
  [COMPARISON_MATCH_STATUS.NOT_MATCHED]: 'No recorded service capability',
  [COMPARISON_MATCH_STATUS.NEUTRAL]: 'No service selected',
};

export const MATCH_STATUS_TONES = {
  [COMPARISON_MATCH_STATUS.VERIFIED_MATCH]: 'success',
  [COMPARISON_MATCH_STATUS.STALE_MATCH]: 'warning',
  [COMPARISON_MATCH_STATUS.REVIEW_REQUIRED]: 'warning',
  [COMPARISON_MATCH_STATUS.CAPABILITY_CONFLICT]: 'danger',
  [COMPARISON_MATCH_STATUS.JURISDICTION_ONLY]: 'info',
  [COMPARISON_MATCH_STATUS.NOT_MATCHED]: 'neutral',
  [COMPARISON_MATCH_STATUS.NEUTRAL]: 'neutral',
};

export const JURISDICTION_LEVELS = ['national', 'state', 'district', 'local', 'unknown'];

export const ACCESSIBILITY_KEYS = [
  ['wheelchairRamp', 'Wheelchair ramp / step-free entry'],
  ['elevator', 'Accessible lift'],
  ['accessibleRestroom', 'Accessible restroom'],
  ['brailleSignage', 'Braille or high-contrast signage'],
  ['assistiveListening', 'Assistive listening'],
  ['signLanguageSupport', 'Sign-language support'],
  ['tactilePaving', 'Tactile paving'],
  ['accessibleParking', 'Accessible parking'],
];

export const REPORT_REASONS = [
  { value: 'outdated_contact', label: 'Contact details are outdated' },
  { value: 'outdated_hours', label: 'Opening hours are outdated' },
  { value: 'wrong_service', label: 'Office does not handle this service' },
  { value: 'accessibility_changed', label: 'Accessibility information changed' },
  { value: 'wrong_location', label: 'Location or coordinates are wrong' },
  { value: 'other', label: 'Something else is wrong' },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const SERVICE_LOOKUP = new Map(MOCK_SERVICES.map((service) => [service.id, service]));
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,119}$/i;

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

const asList = (value) =>
  Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : [];

const isValidDate = (value) => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const isValidLat = (value) => Number.isFinite(value) && value >= -90 && value <= 90;
const isValidLng = (value) => Number.isFinite(value) && value >= -180 && value <= 180;

const toTimestamp = (now) => {
  if (now instanceof Date) return now.getTime();
  if (typeof now === 'number') return now;
  if (typeof now === 'string') {
    const parsed = Date.parse(now);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }
  return Date.now();
};

const titleizeSlug = (value) =>
  asText(value)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

/** Makes a stable, human-readable label for a service jurisdiction. */
export const formatJurisdictionLabel = (jurisdiction) => {
  if (!jurisdiction) return 'Unknown';
  if (jurisdiction.level === 'national') return 'National (all India)';
  const regions = [...jurisdiction.states, ...jurisdiction.districts].filter(Boolean);
  if (regions.length > 0) return regions.join(', ');
  if (jurisdiction.localBody) return jurisdiction.localBody;
  return 'Unknown';
};

/**
 * Accepts both the structured service-contract jurisdiction and a legacy plain
 * string. A missing jurisdiction is "unknown", never nationwide.
 */
export const normalizeServiceJurisdiction = (service) => {
  if (!service || typeof service !== 'object') return null;
  const raw = service.jurisdiction;

  if (typeof raw === 'string' && raw.trim()) {
    return {
      level: 'unknown',
      states: [raw.trim()],
      districts: [],
      localBody: '',
      label: raw.trim(),
    };
  }

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const level = typeof raw.level === 'string' && raw.level.trim() ? raw.level.trim().toLowerCase() : 'unknown';
    const states = asList(raw.states);
    const districts = asList(raw.districts);
    const localBody = asText(raw.localBody);
    const jurisdiction = { level, states, districts, localBody };
    return { ...jurisdiction, label: formatJurisdictionLabel(jurisdiction) };
  }

  if (asText(service.state)) {
    return {
      level: 'state',
      states: [asText(service.state)],
      districts: [],
      localBody: '',
      label: asText(service.state),
    };
  }

  return null;
};

export const getCatalogService = (serviceId) => SERVICE_LOOKUP.get(serviceId) || null;

/** Resolves the newest verified official source on a service guide. */
export const getServiceCatalogSource = (service) => {
  if (!service || !Array.isArray(service.officialSources)) return null;
  const source = service.officialSources.find((candidate) => candidate && safeHttpUrl(candidate.url));
  if (!source) return null;
  return {
    name: asText(source.name) || 'Service catalogue source',
    url: safeHttpUrl(source.url),
    verified: source.verified === true,
    verifiedOn: isValidDate(source.lastVerified) ? source.lastVerified : null,
    kind: 'service_catalogue',
  };
};

/** Normalizes the office record's own verification evidence. */
export const normalizeOfficeVerification = (office = {}, { now = Date.now() } = {}) => {
  const audit = office.auditMetadata && typeof office.auditMetadata === 'object' ? office.auditMetadata : {};
  const reviewDate = isValidDate(audit.reviewDate) ? audit.reviewDate : null;
  const sourceUrl = safeHttpUrl(audit.sourceUrl);
  const verifiedBy = asText(audit.verifiedBy);
  const hasEvidence = Boolean(reviewDate && sourceUrl);

  if (!hasEvidence) {
    return {
      status: 'unknown',
      freshness: 'unknown',
      reviewDate: null,
      verifiedBy,
      source: null,
      ageDays: null,
      label: 'Verification not recorded',
    };
  }

  // A review date later than today cannot be evidence that a record was checked.
  // Keep the source visible as unverified context, but require review.
  const reviewEndOfDay = Date.parse(`${reviewDate}T23:59:59Z`);
  if (Number.isFinite(reviewEndOfDay) && reviewEndOfDay > toTimestamp(now)) {
    return {
      status: 'unknown',
      freshness: 'unknown',
      reviewDate: null,
      verifiedBy,
      source: {
        name: verifiedBy || 'Office record audit',
        url: sourceUrl,
        verified: false,
        verifiedOn: null,
        kind: 'office_record',
        note: 'The recorded review date is in the future, so it is not treated as verification evidence.',
      },
      ageDays: null,
      label: `Verification date ${reviewDate} is in the future — review required`,
    };
  }

  const ageDays = Math.max(
    0,
    Math.floor((toTimestamp(now) - Date.parse(`${reviewDate}T00:00:00Z`)) / DAY_MS)
  );
  const freshness = ageDays > STALE_RECORD_DAYS ? 'stale' : 'verified';

  return {
    status: freshness,
    freshness,
    reviewDate,
    verifiedBy,
    source: {
      name: verifiedBy || 'Office record audit',
      url: sourceUrl,
      verified: true,
      verifiedOn: reviewDate,
      kind: 'office_record',
    },
    ageDays,
    label: freshness === 'verified' ? `Verified ${reviewDate}` : `Last verified ${reviewDate} (stale)`,
  };
};

/**
 * Coordinates are never assumed to be verified just because numbers exist.
 * A record needs an explicit `coordinateVerification` (or
 * `coordinatesVerified: true`) and an HTTPS source before a pin is allowed.
 */
export const normalizeOfficeCoordinates = (office = {}) => {
  const lat = office.coordinates?.lat;
  const lng = office.coordinates?.lng;
  const valid = isValidLat(lat) && isValidLng(lng);
  const explicit = office.coordinateVerification;
  const sourceUrl = safeHttpUrl(
    explicit?.sourceUrl || explicit?.source || office.coordinateSourceUrl
  );
  const verifiedOn = isValidDate(explicit?.verifiedOn || explicit?.verificationDate)
    ? explicit.verifiedOn || explicit.verificationDate
    : null;
  const verified =
    valid &&
    (office.coordinatesVerified === true || explicit?.verified === true) &&
    Boolean(sourceUrl);

  return {
    lat: valid ? lat : null,
    lng: valid ? lng : null,
    valid,
    verified,
    status: verified ? 'verified' : valid ? 'unverified' : 'missing',
    source: sourceUrl
      ? {
          name: asText(explicit?.sourceName) || 'Coordinate verification',
          url: sourceUrl,
          verified,
          verifiedOn,
          kind: 'coordinates',
        }
      : null,
    verifiedOn,
    reason: verified ? null : 'No verified coordinate source is recorded for this office.',
  };
};

/**
 * Accessibility values are only shown as available/unavailable when the office
 * record has dated, sourced audit evidence. Otherwise every value is Unknown.
 */
export const normalizeOfficeAccessibility = (office = {}, { now = Date.now() } = {}) => {
  const verification = normalizeOfficeVerification(office, { now });
  const raw = office.accessibility && typeof office.accessibility === 'object' ? office.accessibility : {};

  const values = {};
  for (const [key] of ACCESSIBILITY_KEYS) {
    const value = raw[key];
    values[key] = verification.status === 'unknown' ? null : typeof value === 'boolean' ? value : null;
  }

  return {
    values,
    source: verification.source,
    verificationStatus: verification.status,
    label: verification.status === 'unknown' ? 'Accessibility evidence not recorded' : verification.label,
  };
};

export const normalizeOfficeContact = (office = {}, { now = Date.now() } = {}) => {
  const verification = normalizeOfficeVerification(office, { now });
  const contact = office.contact && typeof office.contact === 'object' ? office.contact : {};
  const verified = verification.status !== 'unknown';
  const source = verification.source;

  const channels = [];
  if (asText(contact.helpline)) {
    channels.push({
      kind: 'helpline',
      label: 'Helpline',
      value: asText(contact.helpline),
      href: `tel:${asText(contact.helpline).replace(/[^\d+]/g, '')}`,
      verified,
      source,
    });
  }
  if (asText(contact.phone)) {
    channels.push({
      kind: 'phone',
      label: 'Phone',
      value: asText(contact.phone),
      href: `tel:${asText(contact.phone).replace(/[^\d+]/g, '')}`,
      verified,
      source,
    });
  }
  if (asText(contact.email)) {
    channels.push({
      kind: 'email',
      label: 'Email',
      value: asText(contact.email),
      href: `mailto:${asText(contact.email)}`,
      verified,
      source,
    });
  }
  const portalUrl = safeHttpUrl(contact.portalUrl);
  if (portalUrl) {
    channels.push({
      kind: 'portal',
      label: 'Official portal',
      value: portalUrl,
      href: portalUrl,
      verified,
      source,
    });
  }

  return {
    channels,
    verified,
    verificationStatus: verification.status,
    source,
    label: verified ? `Contact recorded in ${verification.label.toLowerCase()}` : 'Contact verification unknown',
  };
};

const resolveCapabilitySource = (verification, office) => {
  if (verification.source) return verification.source;

  const portalUrl = safeHttpUrl(office.contact?.portalUrl);
  if (!portalUrl) return null;

  return {
    name: 'Official portal',
    url: portalUrl,
    verified: false,
    verifiedOn: null,
    kind: 'portal_context',
    note: 'The office record does not include a capability source. The portal is context only.',
  };
};

/**
 * Builds one fully normalized comparison record from a raw office row.
 * The selected service is optional; without it the record is still usable.
 */
export const buildOfficeComparisonRecord = (
  office,
  service = null,
  { now = Date.now() } = {}
) => {
  if (!office || typeof office !== 'object') return null;

  const verification = normalizeOfficeVerification(office, { now });
  const coordinates = normalizeOfficeCoordinates(office);
  const accessibility = normalizeOfficeAccessibility(office, { now });
  const contact = normalizeOfficeContact(office, { now });
  const catalogService = getCatalogService(service?.id);
  const jurisdiction = normalizeServiceJurisdiction(service);
  const officeRegion = {
    state: asText(office.state) || 'Unknown',
    district: asText(office.district) || 'Unknown',
    city: asText(office.city) || 'Unknown',
  };

  const capabilities = asList(office.serviceIds).map((serviceId) => {
    const knownService = getCatalogService(serviceId);
    const source = resolveCapabilitySource(verification, office);
    return {
      id: serviceId,
      name: knownService?.name || titleizeSlug(serviceId),
      known: Boolean(knownService),
      requested: Boolean(service?.id && service.id === serviceId),
      verified: Boolean(source?.verified) && verification.status === 'verified',
      source,
      catalogSource: getServiceCatalogSource(knownService),
    };
  });

  const record = {
    id: asText(office.id),
    name: asText(office.name) || 'Unnamed office',
    type: asText(office.type) || asText(office.category) || 'Unknown office type',
    category: asText(office.category) || 'Unknown category',
    address: asText(office.address) || 'Unknown address',
    landmark: asText(office.landmark),
    city: officeRegion.city,
    district: officeRegion.district,
    state: officeRegion.state,
    pincode: asText(office.pincode) || 'Unknown',
    channels: asList(office.channels),
    distanceKm: Number.isFinite(office.distanceKm) ? office.distanceKm : null,
    capabilities,
    capabilityIds: capabilities.map((capability) => capability.id),
    verification,
    coordinates,
    accessibility,
    contact,
    jurisdiction: {
      service: jurisdiction,
      serviceLabel: jurisdiction?.label || 'Unknown',
      officeLabel:
        [officeRegion.district !== 'Unknown' ? officeRegion.district : '', officeRegion.state !== 'Unknown' ? officeRegion.state : '']
          .filter(Boolean)
          .join(', ') || 'Unknown',
    },
    source: verification.source || resolveCapabilitySource(verification, office),
    dataVersion: OFFICE_COMPARISON_DATA_VERSION,
    raw: office,
  };

  record.match = evaluateOfficeMatch(record, service, catalogService);
  return record;
};

/** Covered / conflict / unknown jurisdiction decision for one office + service. */
export const evaluateJurisdictionCoverage = (office, service) => {
  const jurisdiction = normalizeServiceJurisdiction(service);
  if (!jurisdiction) {
    return {
      status: 'unknown',
      score: 0.5,
      reason: 'The service guide does not state a jurisdiction. Confirm locally before relying on this match.',
    };
  }

  const state = asText(office.state);
  const district = asText(office.district);
  const city = asText(office.city);

  if (jurisdiction.level === 'national') {
    return {
      status: 'covered',
      score: 1,
      reason: 'The service guide applies nationally.',
    };
  }

  if (!state && !district && !city) {
    return {
      status: 'unknown',
      score: 0.5,
      reason: 'The office record does not state a state or district.',
    };
  }

  const lower = (value) => value.toLowerCase();
  if (state && jurisdiction.states.some((region) => lower(region) === lower(state))) {
    return {
      status: 'covered',
      score: 1,
      reason: `The service guide covers ${state}.`,
    };
  }
  if (district && jurisdiction.districts.some((region) => lower(region) === lower(district))) {
    return {
      status: 'covered',
      score: 1,
      reason: `The service guide covers ${district}.`,
    };
  }
  if (
    jurisdiction.localBody &&
    [district, city].filter(Boolean).some((region) => lower(jurisdiction.localBody) === lower(region))
  ) {
    return {
      status: 'covered',
      score: 1,
      reason: `The service guide covers ${jurisdiction.localBody}.`,
    };
  }

  const serviceRegions = [...jurisdiction.states, ...jurisdiction.districts].filter(Boolean);
  if (serviceRegions.length === 0) {
    return {
      status: 'unknown',
      score: 0.5,
      reason: 'The service guide names a jurisdiction level but no region.',
    };
  }

  return {
    status: 'conflict',
    score: 0,
    reason: `The service guide covers ${serviceRegions.join(', ')}, but the office is recorded in ${
      district || state || 'an unknown region'
    }.`,
  };
};

/**
 * Deterministic match status and score. This is a suggestion for the citizen,
 * never an official decision.
 */
export const evaluateOfficeMatch = (record, service, catalogService = null) => {
  if (!service || typeof service !== 'object') {
    return {
      status: COMPARISON_MATCH_STATUS.NEUTRAL,
      label: MATCH_STATUS_LABELS[COMPARISON_MATCH_STATUS.NEUTRAL],
      tone: MATCH_STATUS_TONES[COMPARISON_MATCH_STATUS.NEUTRAL],
      score: 0,
      confidence: 'unknown',
      requiresReview: false,
      suggestion: true,
      reasons: ['Select a service to evaluate service capability.'],
      explanation:
        'No service is selected yet. This list is ordered by record evidence only, not by service fit.',
      dataVersion: OFFICE_COMPARISON_DATA_VERSION,
    };
  }

  const capability = record.capabilities.find((item) => item.id === service.id);
  const coverage = evaluateJurisdictionCoverage(record, service);
  const verificationStatus = record.verification.status;
  const reasons = [];

  let capabilityScore = capability ? 1 : 0;
  if (capability && coverage.status === 'conflict') capabilityScore = 0.3;

  const jurisdictionScore = coverage.score;
  const verificationScore =
    verificationStatus === 'verified' ? 1 : verificationStatus === 'stale' ? 0.5 : 0.1;

  let status;
  let explanation;
  let confidence;

  if (capability && coverage.status === 'covered') {
    if (verificationStatus === 'verified') {
      status = COMPARISON_MATCH_STATUS.VERIFIED_MATCH;
      explanation = `The office record lists ${capability.name}, the service guide covers this region, and the record was verified on ${record.verification.reviewDate}.`;
      confidence = 'high';
      reasons.push(`Office record lists ${capability.name}.`);
      reasons.push(coverage.reason);
      reasons.push(`Office record verified ${record.verification.reviewDate}.`);
    } else if (verificationStatus === 'stale') {
      status = COMPARISON_MATCH_STATUS.STALE_MATCH;
      explanation = `The office record lists ${capability.name} and the region matches, but the record is older than ${STALE_RECORD_DAYS} days.`;
      confidence = 'medium';
      reasons.push(`Office record lists ${capability.name}.`);
      reasons.push(coverage.reason);
      reasons.push(`Last verified ${record.verification.reviewDate}; re-confirm before visiting.`);
    } else {
      status = COMPARISON_MATCH_STATUS.REVIEW_REQUIRED;
      explanation = `The office record lists ${capability.name} and the region matches, but the record has no dated source. Ask the office to confirm.`;
      confidence = 'low';
      reasons.push(`Office record lists ${capability.name}.`);
      reasons.push(coverage.reason);
      reasons.push('No dated office-record source is recorded.');
    }
  } else if (capability && coverage.status === 'conflict') {
    status = COMPARISON_MATCH_STATUS.CAPABILITY_CONFLICT;
    explanation = `The office record lists ${capability.name}, but the service guide's jurisdiction does not match the office region. Treat this as conflicting evidence.`;
    confidence = 'low';
    reasons.push(`Office record lists ${capability.name}.`);
    reasons.push(coverage.reason);
    reasons.push('Ask the office or the issuing authority to confirm before travelling.');
  } else if (capability) {
    status = COMPARISON_MATCH_STATUS.REVIEW_REQUIRED;
    explanation = `The office record lists ${capability.name}, but the service jurisdiction could not be verified. Ask the office to confirm.`;
    confidence = 'low';
    reasons.push(`Office record lists ${capability.name}.`);
    reasons.push(coverage.reason);
  } else if (coverage.status === 'covered') {
    status = COMPARISON_MATCH_STATUS.JURISDICTION_ONLY;
    explanation = `The office is in the service's jurisdiction, but its record does not list ${service.name || 'this service'}. It may only assist with the application.`;
    confidence = 'medium';
    reasons.push(coverage.reason);
    reasons.push('No explicit service capability is recorded for this office.');
  } else {
    status = COMPARISON_MATCH_STATUS.NOT_MATCHED;
    explanation = `The office record does not list ${service.name || 'this service'} and the jurisdiction check did not confirm a match.`;
    confidence = 'low';
    reasons.push(capability ? 'The office record lists the service.' : 'No explicit service capability is recorded.');
    reasons.push(coverage.reason);
  }

  const score = Math.round(
    (capabilityScore * 0.5 + jurisdictionScore * 0.3 + verificationScore * 0.2) * 100
  ) / 100;

  return {
    status,
    label: MATCH_STATUS_LABELS[status],
    tone: MATCH_STATUS_TONES[status],
    score,
    confidence,
    requiresReview:
      status === COMPARISON_MATCH_STATUS.REVIEW_REQUIRED ||
      status === COMPARISON_MATCH_STATUS.CAPABILITY_CONFLICT,
    suggestion: true,
    reasons,
    explanation,
    dataVersion: OFFICE_COMPARISON_DATA_VERSION,
    catalogSource: getServiceCatalogSource(catalogService),
  };
};

/**
 * Comparison-safe office normalization. Unlike the nearby map helper, this does
 * not drop a record when coordinates are missing: a text-only office still has
 * a usable comparison card, it simply never gets a map pin.
 */
const normalizeComparisonOffice = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const id = asText(raw.id);
  const name = asText(raw.name);
  if (!id || !name) return null;

  return {
    ...raw,
    id,
    name,
    category: asText(raw.category),
    type: asText(raw.type),
    state: asText(raw.state),
    district: asText(raw.district),
    city: asText(raw.city),
    pincode: asText(raw.pincode),
    address: asText(raw.address),
    landmark: asText(raw.landmark),
    channels: asList(raw.channels),
    serviceIds: asList(raw.serviceIds),
    features: asList(raw.features),
  };
};

const normalizeComparisonOffices = (list) => {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];
  for (const raw of list) {
    const office = normalizeComparisonOffice(raw);
    if (!office || seen.has(office.id)) continue;
    seen.add(office.id);
    result.push(office);
  }
  return result;
};

/** Loads one normalized office record by ID, optionally evaluated for a service. */
export const getOfficeComparisonRecord = (officeId, service = null, { now = Date.now(), offices = CIVIC_OFFICES } = {}) => {
  const id = asText(officeId);
  if (!id) return null;
  const office = normalizeComparisonOffices(offices).find((candidate) => candidate.id === id);
  if (!office) return null;
  return buildOfficeComparisonRecord(office, service, { now });
};

/**
 * Filters, normalizes, and deterministically ranks office records.
 * The selected service is required for a meaningful ranking but is optional
 * for browsing a neutral list.
 */
export const rankOfficeComparisonRecords = ({
  service = null,
  offices = CIVIC_OFFICES,
  state = '',
  district = '',
  locality = '',
  channel = 'all',
  city = '',
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  onlyWheelchairAccessible = false,
  userCoords = null,
  maxRadiusKm = 100,
  now = Date.now(),
} = {}) => {
  const normalized = normalizeComparisonOffices(offices);
  const cleanLocality = asText(locality).toLowerCase();
  const cleanState = asText(state).toLowerCase();
  const cleanDistrict = asText(district).toLowerCase();
  const cleanCity = asText(city).toLowerCase();

  const records = [];
  for (const office of normalized) {
    if (cleanState && office.state.toLowerCase() !== cleanState) continue;
    if (cleanDistrict && office.district.toLowerCase() !== cleanDistrict) continue;
    if (cleanCity && office.city.toLowerCase() !== cleanCity) continue;
    if (channel !== 'all' && !office.channels.includes(channel)) continue;
    if (cleanLocality) {
      const searchable = [
        office.name,
        office.address,
        office.city,
        office.district,
        office.state,
        office.pincode,
        office.landmark,
        office.category,
        office.type,
      ]
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(cleanLocality)) continue;
    }

    const record = buildOfficeComparisonRecord(office, service, { now });
    if (!record) continue;

    if (onlyWheelchairAccessible && record.accessibility.values.wheelchairRamp !== true) continue;

    if (userCoords && Number.isFinite(userCoords.lat) && Number.isFinite(userCoords.lng)) {
      if (record.coordinates.valid) {
        const distance = haversineKm(
          userCoords.lat,
          userCoords.lng,
          record.coordinates.lat,
          record.coordinates.lng
        );
        record.distanceKm = distance;
        if (distance != null && distance > maxRadiusKm) continue;
      }
    }

    records.push(record);
  }

  records.sort((left, right) => {
    if (right.match.score !== left.match.score) return right.match.score - left.match.score;
    if (left.distanceKm != null && right.distanceKm != null && left.distanceKm !== right.distanceKm) {
      return left.distanceKm - right.distanceKm;
    }
    if (left.distanceKm != null && right.distanceKm == null) return -1;
    if (right.distanceKm != null && left.distanceKm == null) return 1;
    const nameOrder = left.name.localeCompare(right.name, 'en');
    if (nameOrder !== 0) return nameOrder;
    return left.id.localeCompare(right.id, 'en');
  });

  const total = records.length;
  const safePageSize = Math.min(Math.max(Number(pageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const start = (safePage - 1) * safePageSize;

  return {
    dataVersion: OFFICE_COMPARISON_DATA_VERSION,
    generatedAt: new Date(toTimestamp(now)).toISOString(),
    service: service
      ? {
          id: service.id,
          name: service.name || service.title || 'Selected service',
          jurisdiction: normalizeServiceJurisdiction(service)?.label || 'Unknown',
          lastVerified: isValidDate(service.lastVerified) ? service.lastVerified : null,
          catalogSource: getServiceCatalogSource(service),
        }
      : null,
    results: records.slice(start, start + safePageSize),
    allResults: records,
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
    aggregation: buildAggregation(records),
  };
};

const haversineKm = (lat1, lon1, lat2, lon2) => {
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const radius = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
};

const buildAggregation = (records) => {
  const byState = {};
  let capabilityMatches = 0;
  let verifiedRecords = 0;
  let reviewRequired = 0;
  let verifiedCoordinates = 0;

  for (const record of records) {
    byState[record.state] = (byState[record.state] || 0) + 1;
    if (record.capabilities.some((capability) => capability.requested)) capabilityMatches += 1;
    if (record.verification.status === 'verified') verifiedRecords += 1;
    if (record.match.requiresReview) reviewRequired += 1;
    if (record.coordinates.verified) verifiedCoordinates += 1;
  }

  return {
    byState,
    capabilityMatches,
    verifiedRecords,
    reviewRequired,
    verifiedCoordinates,
    total: records.length,
  };
};

/** True when at least one record is stale or has no dated verification. */
export const hasStaleOrUnknownRecords = (records = []) =>
  records.some((record) => record.verification.status !== 'verified');

/** Builds the comparison matrix with sources and explicit Unknown values. */
export const buildComparisonRows = (records = []) => {
  if (!Array.isArray(records) || records.length === 0) return [];

  const cell = (value, extras = {}) => ({
    value: value === null || value === undefined || value === '' ? 'Unknown' : value,
    isUnknown: value === null || value === undefined || value === '',
    source: null,
    ...extras,
  });

  return [
    {
      key: 'serviceMatch',
      label: 'Service match',
      cells: records.map((record) =>
        cell(record.match.label, {
          status: record.match.status,
          tone: record.match.tone,
          detail: record.match.explanation,
        })
      ),
    },
    {
      key: 'requestedCapability',
      label: 'Recorded service capability',
      cells: records.map((record) => {
        const capability = record.capabilities.find((item) => item.requested);
        if (!capability) {
          return cell(null, { detail: 'The office record does not list this service.' });
        }
        return cell(capability.name, {
          source: capability.source,
          detail: capability.verified
            ? 'The office record lists this service and has dated audit evidence.'
            : 'The office record lists this service, but the mapping is not independently verified.',
        });
      }),
    },
    {
      key: 'jurisdiction',
      label: 'Jurisdiction',
      cells: records.map((record) =>
        cell(record.jurisdiction.officeLabel, {
          detail: record.jurisdiction.serviceLabel
            ? `Service guide jurisdiction: ${record.jurisdiction.serviceLabel}`
            : 'Service jurisdiction unknown.',
        })
      ),
    },
    {
      key: 'contact',
      label: 'Official contact',
      cells: records.map((record) => {
        const preferred =
          record.contact.channels.find((channel) => channel.kind === 'helpline') ||
          record.contact.channels.find((channel) => channel.kind === 'phone') ||
          record.contact.channels.find((channel) => channel.kind === 'email');
        if (!preferred) {
          return cell(null, { detail: 'No contact channel is recorded.' });
        }
        return cell(preferred.value, {
          detail: `${preferred.label}; ${record.contact.verified ? 'verification recorded' : 'verification unknown'}`,
        });
      }),
    },
    {
      key: 'contactVerification',
      label: 'Contact verification',
      cells: records.map((record) =>
        cell(record.contact.verified ? 'Recorded in verified source' : null, {
          detail: record.contact.label,
          source: record.contact.source,
        })
      ),
    },
    {
      key: 'accessibility',
      label: 'Accessibility',
      cells: records.map((record) => {
        const available = ACCESSIBILITY_KEYS.filter(
          ([key]) => record.accessibility.values[key] === true
        ).map(([, label]) => label);
        if (record.accessibility.verificationStatus === 'unknown') {
          return cell(null, { detail: 'No dated accessibility evidence is recorded.' });
        }
        return cell(available.length > 0 ? available.join('; ') : 'None recorded', {
          detail: record.accessibility.label,
          source: record.accessibility.source,
        });
      }),
    },
    {
      key: 'lastVerified',
      label: 'Last verified',
      cells: records.map((record) =>
        cell(record.verification.reviewDate, {
          detail: record.verification.label,
          source: record.verification.source,
        })
      ),
    },
    {
      key: 'source',
      label: 'Record source',
      cells: records.map((record) =>
        record.source
          ? cell(record.source.name, { source: record.source, detail: record.source.note || '' })
          : cell(null, { detail: 'No office-record source is recorded.' })
      ),
    },
    {
      key: 'coordinates',
      label: 'Map pin',
      cells: records.map((record) =>
        cell(record.coordinates.verified ? 'Verified coordinates' : 'No verified pin', {
          detail: record.coordinates.reason,
          source: record.coordinates.source,
        })
      ),
    },
  ];
};

/** Validation for the public ranking query. Returns structured errors. */
export const validateComparisonQuery = (query = {}) => {
  const errors = [];
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return { valid: false, errors: ['Query parameters must be an object.'], value: null };
  }

  const readString = (key, maxLength, required = false) => {
    const raw = query[key];
    if (raw === undefined || raw === null || raw === '') {
      if (required) errors.push(`${key} is required.`);
      return '';
    }
    if (typeof raw !== 'string') {
      errors.push(`${key} must be a single string value.`);
      return '';
    }
    const value = raw.trim();
    if (value.length > maxLength) errors.push(`${key} must be ${maxLength} characters or fewer.`);
    if (required && !value) errors.push(`${key} is required.`);
    return value;
  };

  const serviceId = readString('serviceId', 120, true);
  if (serviceId && !SLUG_PATTERN.test(serviceId)) {
    errors.push('serviceId must be a slug such as birth-certificate.');
  } else if (serviceId && !getCatalogService(serviceId)) {
    errors.push('serviceId is not in the built-in service catalogue.');
  }

  const state = readString('state', 80);
  const district = readString('district', 80);
  const locality = readString('locality', 120);
  const channel = readString('channel', 20) || 'all';
  if (!['all', 'in-person', 'online', 'phone'].includes(channel)) {
    errors.push('channel must be one of: all, in-person, online, phone.');
  }

  const parseInteger = (key, fallback, min, max) => {
    const raw = query[key];
    if (raw === undefined || raw === null || raw === '') return fallback;
    const number = Number(raw);
    if (!Number.isInteger(number) || number < min || number > max) {
      errors.push(`${key} must be an integer between ${min} and ${max}.`);
      return fallback;
    }
    return number;
  };

  const page = parseInteger('page', 1, 1, 100000);
  const pageSize = parseInteger('pageSize', DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);

  let onlyWheelchairAccessible = false;
  if (query.onlyWheelchairAccessible !== undefined) {
    if (query.onlyWheelchairAccessible === true || query.onlyWheelchairAccessible === 'true') {
      onlyWheelchairAccessible = true;
    } else if (
      query.onlyWheelchairAccessible !== false &&
      query.onlyWheelchairAccessible !== 'false'
    ) {
      errors.push('onlyWheelchairAccessible must be true or false.');
    }
  }

  if (errors.length > 0) return { valid: false, errors, value: null };

  return {
    valid: true,
    errors: [],
    value: {
      serviceId,
      state,
      district,
      locality,
      channel,
      page,
      pageSize,
      onlyWheelchairAccessible,
    },
  };
};

export const paginateComparisonResults = (records = [], page = 1, pageSize = DEFAULT_PAGE_SIZE) => {
  const list = Array.isArray(records) ? records : [];
  const total = list.length;
  const safePageSize = Math.min(Math.max(Number(pageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const start = (safePage - 1) * safePageSize;

  return {
    items: list.slice(start, start + safePageSize),
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
    hasPrevious: safePage > 1,
    hasNext: safePage < totalPages,
  };
};
