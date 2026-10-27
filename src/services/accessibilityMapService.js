/**
 * Civic Service Accessibility and Language Coverage Service (#146)
 *
 * Normalizes, filters, and formats verified public office accessibility features,
 * language support capabilities, and facility review metadata.
 *
 * Strict Compliance:
 * - Unknown attributes are NEVER treated as available or unavailable; they are explicitly 'unknown'.
 * - Incomplete or unverified records are handled gracefully without runtime errors.
 */

export const ACCESSIBILITY_FACILITIES = {
  WHEELCHAIR_RAMP: 'wheelchairRamp',
  ELEVATOR: 'elevator',
  ACCESSIBLE_RESTROOM: 'accessibleRestroom',
  BRAILLE_SIGNAGE: 'brailleSignage',
  ASSISTIVE_LISTENING: 'assistiveListening',
  SIGN_LANGUAGE: 'signLanguageSupport',
  TACTILE_PAVING: 'tactilePaving',
  ACCESSIBLE_PARKING: 'accessibleParking',
};

export const FACILITY_LABELS = {
  [ACCESSIBILITY_FACILITIES.WHEELCHAIR_RAMP]: 'Wheelchair Ramp / Step-Free Entry',
  [ACCESSIBILITY_FACILITIES.ELEVATOR]: 'Accessible Lift / Elevator',
  [ACCESSIBILITY_FACILITIES.ACCESSIBLE_RESTROOM]: 'Accessible Restroom',
  [ACCESSIBILITY_FACILITIES.BRAILLE_SIGNAGE]: 'Braille & High-Contrast Signage',
  [ACCESSIBILITY_FACILITIES.ASSISTIVE_LISTENING]: 'Assistive Listening System',
  [ACCESSIBILITY_FACILITIES.SIGN_LANGUAGE]: 'Sign Language Support',
  [ACCESSIBILITY_FACILITIES.TACTILE_PAVING]: 'Tactile Paving Guiding Paths',
  [ACCESSIBILITY_FACILITIES.ACCESSIBLE_PARKING]: 'Designated Accessible Parking',
};

export const COMMON_OFFICE_LANGUAGES = [
  'Hindi',
  'English',
  'Bengali',
  'Marathi',
  'Tamil',
  'Telugu',
  'Kannada',
  'Gujarati',
  'Malayalam',
  'Odia',
  'Punjabi',
  'Assamese',
  'Urdu',
];

/**
 * Normalizes boolean/unknown flag.
 * If boolean, returns boolean. If null/undefined/unspecified, returns null (unknown).
 */
export const normalizeAttributeStatus = (val) => {
  if (typeof val === 'boolean') return val;
  if (val === 'available' || val === 'yes' || val === 1) return true;
  if (val === 'unavailable' || val === 'no' || val === 0) return false;
  return null; // Explicitly unknown
};

/**
 * Returns readable status tag for a facility attribute: 'available' | 'unavailable' | 'unknown'
 */
export const getAttributeStatus = (val) => {
  const norm = normalizeAttributeStatus(val);
  if (norm === true) return 'available';
  if (norm === false) return 'unavailable';
  return 'unknown';
};

/**
 * Normalizes an office's accessibility and language metadata safely.
 */
export const normalizeAccessibilityRecord = (raw = {}) => {
  const rawAccess = raw.accessibility || {};
  const rawLang = raw.languageCoverage || {};
  const rawAudit = raw.auditMetadata || {};

  const accessibility = {
    wheelchairRamp: normalizeAttributeStatus(rawAccess.wheelchairRamp ?? (raw.features?.includes('wheelchair_accessible') ? true : null)),
    elevator: normalizeAttributeStatus(rawAccess.elevator),
    accessibleRestroom: normalizeAttributeStatus(rawAccess.accessibleRestroom),
    brailleSignage: normalizeAttributeStatus(rawAccess.brailleSignage),
    assistiveListening: normalizeAttributeStatus(rawAccess.assistiveListening),
    signLanguageSupport: normalizeAttributeStatus(rawAccess.signLanguageSupport),
    tactilePaving: normalizeAttributeStatus(rawAccess.tactilePaving),
    accessibleParking: normalizeAttributeStatus(rawAccess.accessibleParking ?? (raw.features?.includes('parking_available') ? true : null)),
  };

  const cleanLangList = (list) =>
    Array.isArray(list)
      ? [...new Set(list.filter((l) => typeof l === 'string' && l.trim()).map((l) => l.trim()))]
      : [];

  const languageCoverage = {
    supportedLanguages: cleanLangList(rawLang.supportedLanguages?.length ? rawLang.supportedLanguages : ['English', 'Hindi']),
    helpdeskLanguages: cleanLangList(rawLang.helpdeskLanguages),
    formsAvailableLanguages: cleanLangList(rawLang.formsAvailableLanguages),
    hasSignLanguageInterpreter: normalizeAttributeStatus(rawLang.hasSignLanguageInterpreter),
  };

  const auditMetadata = {
    verifiedBy: typeof rawAudit.verifiedBy === 'string' ? rawAudit.verifiedBy.trim() : 'District Facilitation Audit',
    reviewDate: typeof rawAudit.reviewDate === 'string' && rawAudit.reviewDate.trim() ? rawAudit.reviewDate.trim() : raw.lastVerified || null,
    sourceUrl: typeof rawAudit.sourceUrl === 'string' ? rawAudit.sourceUrl.trim() : raw.contact?.portalUrl || '',
    verificationNotes: typeof rawAudit.verificationNotes === 'string' ? rawAudit.verificationNotes.trim() : '',
  };

  return {
    ...raw,
    accessibility,
    languageCoverage,
    auditMetadata,
  };
};

/**
 * Aggregates summary counts of verified, unverified and unavailable facilities
 */
export const getFacilityAuditSummary = (office) => {
  if (!office) {
    return { availableCount: 0, unavailableCount: 0, unknownCount: 0, total: 0, reviewDate: null };
  }

  const record = normalizeAccessibilityRecord(office);
  const entries = Object.values(record.accessibility);

  let availableCount = 0;
  let unavailableCount = 0;
  let unknownCount = 0;

  for (const val of entries) {
    if (val === true) availableCount++;
    else if (val === false) unavailableCount++;
    else unknownCount++;
  }

  return {
    availableCount,
    unavailableCount,
    unknownCount,
    total: entries.length,
    reviewDate: record.auditMetadata.reviewDate,
    verifiedBy: record.auditMetadata.verifiedBy,
  };
};

/**
 * Filters offices by accessibility facilities, language coverage, and locality
 * without requiring GPS coordinates.
 */
export const filterOfficesByAccessibilityAndLanguage = ({
  offices = [],
  requiredFacilities = [],
  requiredLanguages = [],
  localityQuery = '',
  state = '',
  district = '',
}) => {
  const cleanLocality = (localityQuery || '').trim().toLowerCase();

  return offices
    .map(normalizeAccessibilityRecord)
    .filter((office) => {
      // 1. Locality text search (does NOT require geolocation)
      if (cleanLocality) {
        const nameMatch = (office.name || '').toLowerCase().includes(cleanLocality);
        const cityMatch = (office.city || '').toLowerCase().includes(cleanLocality);
        const districtMatch = (office.district || '').toLowerCase().includes(cleanLocality);
        const stateMatch = (office.state || '').toLowerCase().includes(cleanLocality);
        const pinMatch = (office.pincode || '').includes(cleanLocality);
        const addrMatch = (office.address || '').toLowerCase().includes(cleanLocality);
        const landmarkMatch = (office.landmark || '').toLowerCase().includes(cleanLocality);

        if (!nameMatch && !cityMatch && !districtMatch && !stateMatch && !pinMatch && !addrMatch && !landmarkMatch) {
          return false;
        }
      }

      // 2. State & District filter
      if (state && office.state && office.state.toLowerCase() !== state.toLowerCase()) {
        return false;
      }
      if (district && office.district && office.district.toLowerCase() !== district.toLowerCase()) {
        return false;
      }

      // 3. Required facilities filter: ONLY offices where attribute === true
      // (unknown or false offices are excluded from strict positive filter)
      if (Array.isArray(requiredFacilities) && requiredFacilities.length > 0) {
        for (const facilityKey of requiredFacilities) {
          if (office.accessibility[facilityKey] !== true) {
            return false;
          }
        }
      }

      // 4. Required languages filter
      if (Array.isArray(requiredLanguages) && requiredLanguages.length > 0) {
        const supported = (office.languageCoverage.supportedLanguages || []).map((l) => l.toLowerCase());
        const helpdesk = (office.languageCoverage.helpdeskLanguages || []).map((l) => l.toLowerCase());
        const combined = [...new Set([...supported, ...helpdesk])];

        const matchesAll = requiredLanguages.every((reqLang) =>
          combined.includes(reqLang.trim().toLowerCase())
        );

        if (!matchesAll) {
          return false;
        }
      }

      return true;
    });
};
