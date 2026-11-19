// Data contract and validation for Civic Moving-Home Address-Change Action Planner (#725).
// Enforces strict dated official government sources, explicit unavailable states,
// separation of official instructions from editorial guidance, and zero PII collection.

export const ADDRESS_CHANGE_SCHEMA_VERSION = 1;

export const MOVE_TYPES = ['same_city', 'inter_district', 'inter_state'];

export const MOVE_TYPE_LABELS = {
  same_city: 'Same City / Within District',
  inter_district: 'Inter-District (Within State)',
  inter_state: 'Inter-State (Relocating Across States)',
};

export const MOVE_TYPE_DESCRIPTIONS = {
  same_city: 'Relocating to a new house or neighborhood within the same municipal or district boundaries.',
  inter_district: 'Relocating to a different administrative district within the same state (cross-district/constituency).',
  inter_state: 'Relocating across state borders, requiring inter-state certificates, RTO NOCs, or new state ration registrations.',
};

export const RECORD_TYPES = [
  'aadhaar',
  'voter_id',
  'driving_licence',
  'vehicle_rc',
  'ration_card',
  'lpg_gas',
  'bank_kyc',
  'electricity_water',
];

export const RECORD_TYPE_LABELS = {
  aadhaar: 'Aadhaar Card (UIDAI)',
  voter_id: 'Voter Electoral Roll (ECI)',
  driving_licence: 'Driving Licence (MoRTH / Parivahan)',
  vehicle_rc: 'Vehicle Registration Certificate (RTO)',
  ration_card: 'Ration Card / PDS (State Food Dept / NFSA)',
  lpg_gas: 'LPG Gas Connection (MoPNG / OMC)',
  bank_kyc: 'Bank Account KYC (RBI Master Direction)',
  electricity_water: 'Municipal Water & Electricity Utility',
};

// Strict Citizen Privacy & Non-Transactional Enforcement:
// Personal credentials, identity numbers, and passwords are strictly prohibited.
export const FORBIDDEN_ADDRESS_PLANNER_FIELDS = [
  'userId', 'password', 'token', 'aadhaar', 'aadhaarNumber', 'panNumber',
  'bankAccountNumber', 'ifscCode', 'personalPhone', 'personalEmail',
  'otp', 'biometricData', 'secretKey', 'loginCredential', 'pinCodeSecret',
];

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const isHttpsUrl = (v) => {
  if (typeof v !== 'string') return false;
  try {
    const url = new URL(v);
    return url.protocol === 'https:';
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
    if (FORBIDDEN_ADDRESS_PLANNER_FIELDS.includes(key)) {
      fail(where, 'prohibited field (citizen privacy or credential collection violation)');
    } else {
      scanForbidden(child, where, fail);
    }
  }
}

/**
 * Validates a single moving-home address-change record.
 * Returns an array of { field, reason } errors (empty array = valid).
 */
export function validateAddressChangeRecord(record) {
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
    fail('name', 'is required and must be non-empty string');
  }
  if (!RECORD_TYPES.includes(record.recordType)) {
    fail('recordType', `must be one of: ${RECORD_TYPES.join(', ')}`);
  }

  // Authority verification
  if (!isObject(record.authority)) {
    fail('authority', 'must be an object');
  } else {
    if (!isText(record.authority.name)) {
      fail('authority.name', 'is required');
    }
    if (!isHttpsUrl(record.authority.portalUrl)) {
      fail('authority.portalUrl', 'must be a valid https URL pointing to official authority portal');
    }
  }

  // Applicable move types
  if (!Array.isArray(record.applicableMoveTypes) || record.applicableMoveTypes.length === 0) {
    fail('applicableMoveTypes', 'must be a non-empty array of valid move types');
  } else {
    for (const mt of record.applicableMoveTypes) {
      if (!MOVE_TYPES.includes(mt)) {
        fail('applicableMoveTypes', `contains invalid move type "${mt}"`);
      }
    }
  }

  // Dependency ordering
  if (typeof record.dependencyOrder !== 'number' || record.dependencyOrder < 1) {
    fail('dependencyOrder', 'must be a positive integer reflecting prerequisite sequence');
  }
  if (!Array.isArray(record.prerequisites)) {
    fail('prerequisites', 'must be an array of prerequisite record IDs');
  }

  // Accepted proofs
  if (!Array.isArray(record.acceptedProofs) || record.acceptedProofs.length === 0) {
    fail('acceptedProofs', 'must be an array containing at least one accepted address proof');
  } else {
    record.acceptedProofs.forEach((proof, idx) => {
      if (!isObject(proof)) {
        fail(`acceptedProofs[${idx}]`, 'must be an object');
      } else {
        if (!isText(proof.name)) fail(`acceptedProofs[${idx}].name`, 'is required');
        if (!isText(proof.proofType)) fail(`acceptedProofs[${idx}].proofType`, 'is required');
      }
    });
  }

  // Official instructions vs Editorial notes
  if (!isText(record.officialInstructions)) {
    fail('officialInstructions', 'must contain verbatim statutory or official instructions');
  }
  if (!isText(record.editorialNotes)) {
    fail('editorialNotes', 'must contain Civic Help Setu editorial advice and practical tips');
  }

  // Provenance & Source URL
  if (!isHttpsUrl(record.sourceUrl)) {
    fail('sourceUrl', 'must be a dated official government https URL');
  }
  if (!isRealDate(record.effectiveDate)) {
    fail('effectiveDate', 'must be an ISO YYYY-MM-DD date');
  }
  if (!isRealDate(record.lastVerified)) {
    fail('lastVerified', 'must be an ISO YYYY-MM-DD date');
  }

  // Unavailable data state
  if (!isObject(record.unavailableData)) {
    fail('unavailableData', 'must be an object documenting any unavailable or unverified rules');
  } else {
    if (typeof record.unavailableData.isUnavailable !== 'boolean') {
      fail('unavailableData.isUnavailable', 'must be a boolean');
    }
    if (record.unavailableData.isUnavailable && !isText(record.unavailableData.reason)) {
      fail('unavailableData.reason', 'must provide an explicit rationale when unavailable');
    }
  }

  return errors;
}

/**
 * Validates a catalog array of moving-home address records.
 */
export function validateAddressChangeCatalog(catalog) {
  if (!Array.isArray(catalog)) {
    return [{ field: '(catalog)', reason: 'catalog must be an array of records' }];
  }
  const errors = [];
  const seenIds = new Set();

  catalog.forEach((item, index) => {
    const itemErrors = validateAddressChangeRecord(item);
    itemErrors.forEach((err) => {
      errors.push({ field: `record[${index}].${err.field}`, reason: err.reason });
    });
    if (item && item.id) {
      if (seenIds.has(item.id)) {
        errors.push({ field: `record[${index}].id`, reason: `duplicate id "${item.id}"` });
      }
      seenIds.add(item.id);
    }
  });

  return errors;
}

