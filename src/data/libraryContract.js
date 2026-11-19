// Data contract and validation for public library and civic learning resource records (#727).
// Internal code contract; all records must link to dated official government/institutional sources.
// Speculative assumptions and live seat counts are strictly forbidden.

import { validateJurisdiction as validateAppJurisdiction } from '../services/jurisdictionService';

export const LIBRARY_SCHEMA_VERSION = 1;

export const LIBRARY_TYPES = [
  'national_library',
  'state_central_library',
  'district_central_library',
  'city_central_library',
  'branch_library',
  'digital_learning_centre',
  'community_library',
];

export const LIBRARY_TYPE_LABELS = {
  national_library: 'National Library of India',
  state_central_library: 'State Central Library',
  district_central_library: 'District Central Library',
  city_central_library: 'City Central Library',
  branch_library: 'Public Branch Library',
  digital_learning_centre: 'Civic Digital Learning Resource Centre',
  community_library: 'Municipal Community Library',
};

export const MEMBERSHIP_CATEGORIES = [
  'general_adult',
  'student',
  'senior_citizen',
  'children',
  'researcher',
];

export const MEMBERSHIP_CATEGORY_LABELS = {
  general_adult: 'General / Adult Reader',
  student: 'Student / Youth (Concessional)',
  senior_citizen: 'Senior Citizen',
  children: 'Children / Juvenile Section',
  researcher: 'Research Scholar / Institutional',
};

export const DIGITAL_ACCESS_TYPES = [
  'open_access',
  'card_required',
  'intranet_only',
];

export const DIGITAL_ACCESS_TYPE_LABELS = {
  open_access: 'Open Public Access (Free for all citizens)',
  card_required: 'Library Membership Card Required',
  intranet_only: 'On-Premises Dedicated Workstations Only',
};

// Citizen privacy & live seat prevention:
// Personal applicant details and speculative real-time seat availability are strictly rejected.
export const FORBIDDEN_LIBRARY_FIELDS = [
  'userId', 'email_personal', 'phone_personal', 'password', 'token',
  'aadhaar', 'aadhaarNumber', 'applicantName', 'familyContact', 'libraryCardNumber',
  'liveSeats', 'availableSeats', 'currentQueue', 'estimatedWaitMinutes', 'seatBookingLive',
];

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const isHttpsUrl = (v) => {
  if (typeof v !== 'string') return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};

const isRealDate = (v) => {
  const match = typeof v === 'string' && DATE_PATTERN.exec(v);
  if (!match) return false;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

function scanForbidden(node, path, fail) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => scanForbidden(item, `${path}[${i}]`, fail));
    return;
  }
  if (!isObject(node)) return;
  for (const [key, child] of Object.entries(node)) {
    const where = path ? `${path}.${key}` : key;
    if (FORBIDDEN_LIBRARY_FIELDS.includes(key)) {
      fail(where, 'prohibited field (citizen privacy or forbidden live seat tracker)');
    } else {
      scanForbidden(child, where, fail);
    }
  }
}

/**
 * Validates a single public library record.
 * Returns an array of { field, reason } errors (empty array = valid).
 */
export function validateLibraryRecord(record) {
  const errors = [];
  const fail = (field, reason) => errors.push({ field, reason });

  if (!isObject(record)) {
    fail('(record)', 'must be an object');
    return errors;
  }

  scanForbidden(record, '', fail);

  if (!isText(record.id) || !ID_PATTERN.test(record.id)) {
    fail('id', 'must be a lowercase kebab-case slug');
  }
  if (!isText(record.name)) {
    fail('name', 'is required and must be a non-empty string');
  }
  if (!LIBRARY_TYPES.includes(record.libraryType)) {
    fail('libraryType', `must be one of: ${LIBRARY_TYPES.join(', ')}`);
  }
  if (!isText(record.managingAuthority)) {
    fail('managingAuthority', 'is required (e.g. Department of Public Libraries or Municipal Corporation)');
  }

  // Jurisdiction check
  if (!isObject(record.jurisdiction)) {
    fail('jurisdiction', 'must be a valid structured jurisdiction object');
  } else {
    const jErrors = validateAppJurisdiction(record.jurisdiction);
    for (const msg of jErrors) {
      fail('jurisdiction', msg);
    }
  }

  if (!isText(record.address)) {
    fail('address', 'is required and must be non-empty');
  }
  if (!isText(record.district)) {
    fail('district', 'is required');
  }
  if (!isText(record.state)) {
    fail('state', 'is required');
  }
  if (!isText(record.pincode) || !PINCODE_PATTERN.test(record.pincode)) {
    fail('pincode', 'must be a valid 6-digit Indian postal PIN code');
  }

  if (record.coordinates !== undefined) {
    if (
      !isObject(record.coordinates) ||
      typeof record.coordinates.lat !== 'number' ||
      typeof record.coordinates.lng !== 'number' ||
      record.coordinates.lat < -90 ||
      record.coordinates.lat > 90 ||
      record.coordinates.lng < -180 ||
      record.coordinates.lng > 180
    ) {
      fail('coordinates', 'must have valid latitude and longitude numbers');
    }
  }

  // Official contact
  if (!isObject(record.officialContact)) {
    fail('officialContact', 'must be an object containing official contact details');
  } else {
    if (!Array.isArray(record.officialContact.phone) || record.officialContact.phone.length === 0) {
      fail('officialContact.phone', 'must contain at least one official contact phone string');
    } else {
      record.officialContact.phone.forEach((p, idx) => {
        if (!isText(p)) fail(`officialContact.phone[${idx}]`, 'must be a non-empty string');
      });
    }
    if (record.officialContact.portalUrl !== undefined && !isHttpsUrl(record.officialContact.portalUrl)) {
      fail('officialContact.portalUrl', 'must be a valid https URL when provided');
    }
    if (record.officialContact.opacCatalogueUrl !== undefined && !isHttpsUrl(record.officialContact.opacCatalogueUrl)) {
      fail('officialContact.opacCatalogueUrl', 'must be a valid https URL when provided');
    }
    if (record.officialContact.email !== undefined && !EMAIL_PATTERN.test(record.officialContact.email)) {
      fail('officialContact.email', 'must be a valid email string when provided');
    }
  }

  // Operating hours
  if (!isObject(record.operatingHours) || !isText(record.operatingHours.hours)) {
    fail('operatingHours.hours', 'must be provided');
  }

  // Membership categories (optional/null if unverified)
  if (record.membershipCategories !== null && record.membershipCategories !== undefined) {
    if (!Array.isArray(record.membershipCategories)) {
      fail('membershipCategories', 'must be an array of membership categories or null');
    } else {
      record.membershipCategories.forEach((cat, idx) => {
        if (!isObject(cat) || !MEMBERSHIP_CATEGORIES.includes(cat.category)) {
          fail(`membershipCategories[${idx}].category`, `must be one of: ${MEMBERSHIP_CATEGORIES.join(', ')}`);
        }
        if (typeof cat.annualFee !== 'number' || cat.annualFee < 0) {
          fail(`membershipCategories[${idx}].annualFee`, 'must be a non-negative number');
        }
      });
    }
  }

  // Statutory charges & caution deposits
  if (record.statutoryCharges !== null && record.statutoryCharges !== undefined) {
    if (!isObject(record.statutoryCharges) || typeof record.statutoryCharges.isFree !== 'boolean') {
      fail('statutoryCharges', 'must be an object with boolean isFree property or null');
    }
  }

  // Renewal rules (optional/null if unverified)
  if (record.renewalRules !== null && record.renewalRules !== undefined) {
    if (!isObject(record.renewalRules)) {
      fail('renewalRules', 'must be an object or null');
    } else {
      if (typeof record.renewalRules.loanPeriodDays !== 'number' || record.renewalRules.loanPeriodDays <= 0) {
        fail('renewalRules.loanPeriodDays', 'must be a positive number');
      }
      if (typeof record.renewalRules.onlineRenewalAvailable !== 'boolean') {
        fail('renewalRules.onlineRenewalAvailable', 'must be a boolean');
      }
    }
  }

  // Digital Learning Resources (National Digital Library, Swayam, e-Shodh, etc.)
  if (record.digitalLearningResources !== null && record.digitalLearningResources !== undefined) {
    if (!Array.isArray(record.digitalLearningResources)) {
      fail('digitalLearningResources', 'must be an array of digital learning resources or null');
    } else {
      record.digitalLearningResources.forEach((res, idx) => {
        if (!isObject(res) || !isText(res.name) || !DIGITAL_ACCESS_TYPES.includes(res.accessType)) {
          fail(`digitalLearningResources[${idx}]`, 'must have name and valid accessType (open_access, card_required, intranet_only)');
        }
        if (res.url !== undefined && !isHttpsUrl(res.url)) {
          fail(`digitalLearningResources[${idx}].url`, 'must be a valid https URL when provided');
        }
      });
    }
  }

  // Required documents
  if (record.requiredDocuments !== null && record.requiredDocuments !== undefined) {
    if (!Array.isArray(record.requiredDocuments)) {
      fail('requiredDocuments', 'must be an array of document requirement objects or null');
    } else {
      const validTypes = ['required', 'conditional', 'optional', 'unverified'];
      record.requiredDocuments.forEach((doc, idx) => {
        if (!isObject(doc) || !isText(doc.name) || !validTypes.includes(doc.type)) {
          fail(`requiredDocuments[${idx}]`, 'must contain name and type (required|conditional|optional|unverified)');
        }
        if (doc.type === 'conditional' && !isText(doc.condition)) {
          fail(`requiredDocuments[${idx}].condition`, 'is required when type is conditional');
        }
      });
    }
  }

  // Accessibility features
  if (record.accessibility !== undefined) {
    if (!isObject(record.accessibility)) {
      fail('accessibility', 'must be an object containing accessibility booleans');
    }
  }

  // Audit metadata (Mandatory: All claims must link to a dated official source)
  if (!isObject(record.auditMetadata)) {
    fail('auditMetadata', 'is required for data provenance and verification');
  } else {
    if (!isHttpsUrl(record.auditMetadata.sourceUrl)) {
      fail('auditMetadata.sourceUrl', 'must be a valid https URL pointing to official authority/gazette');
    }
    if (!isRealDate(record.auditMetadata.effectiveDate)) {
      fail('auditMetadata.effectiveDate', 'must be a valid date in YYYY-MM-DD format');
    }
    if (!isRealDate(record.auditMetadata.lastVerified)) {
      fail('auditMetadata.lastVerified', 'must be a valid date in YYYY-MM-DD format');
    }
    if (!isText(record.auditMetadata.verifiedBy)) {
      fail('auditMetadata.verifiedBy', 'must be specified');
    }
  }

  return errors;
}

/**
 * Validates a complete library directory array.
 */
export function validateLibraryDirectory(libraries) {
  if (!Array.isArray(libraries)) {
    return { valid: false, errors: [{ field: 'directory', reason: 'must be an array' }] };
  }
  const errors = [];
  const seenIds = new Set();
  libraries.forEach((record, idx) => {
    const recordId = isObject(record) && isText(record.id) ? record.id : `#${idx}`;
    const recordErrors = validateLibraryRecord(record);
    recordErrors.forEach((err) => errors.push({ id: recordId, ...err }));
    if (isObject(record) && isText(record.id)) {
      if (seenIds.has(record.id)) {
        errors.push({ id: recordId, field: 'id', reason: 'duplicate library id' });
      }
      seenIds.add(record.id);
    }
  });
  return { valid: errors.length === 0, errors };
}

