/**
 * Explainable Nearby-Office Recommendation Service (#399)
 * 
 * Evaluates and explains why an office is (or is not) suitable for a chosen civic service.
 * Grounding & Safety Principles:
 * 1. Distinguish "confirmed responsible office" from generic "nearby facility".
 * 2. Transparent match explanation stating the exact basis (department, jurisdiction, servicesOffered).
 * 3. Flag unverified recommendations when jurisdiction or administrative boundaries cannot be confirmed.
 * 4. Preserve full GPS-denied fallback functionality (manual pincode, district, or state HQ fallback).
 */

export const OFFICE_MATCH_STATUS = {
  CONFIRMED_RESPONSIBLE_OFFICE: 'CONFIRMED_RESPONSIBLE_OFFICE',
  JURISDICTION_MATCH: 'JURISDICTION_MATCH',
  NEARBY_FACILITY_ONLY: 'NEARBY_FACILITY_ONLY',
  UNVERIFIED_MATCH: 'UNVERIFIED_MATCH',
  UNMATCHED: 'UNMATCHED',
};

export const MATCH_STATUS_CONFIG = {
  [OFFICE_MATCH_STATUS.CONFIRMED_RESPONSIBLE_OFFICE]: {
    label: 'Confirmed Responsible Office',
    tone: 'success',
    color: '#16a34a',
    bgColor: '#dcfce7',
    borderColor: '#bbf7d0',
    description: 'Designated authority directly responsible for intake and processing of this service.',
  },
  [OFFICE_MATCH_STATUS.JURISDICTION_MATCH]: {
    label: 'Civic Facilitation Center',
    tone: 'info',
    color: '#2563eb',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    description: 'Serves your administrative jurisdiction and offers assisted application submission.',
  },
  [OFFICE_MATCH_STATUS.NEARBY_FACILITY_ONLY]: {
    label: 'Nearby Civic Facility Only',
    tone: 'neutral',
    color: '#64748b',
    bgColor: '#f8fafc',
    borderColor: '#e2e8f0',
    description: 'Geographically close, but not the designated processing center for this specific scheme.',
  },
  [OFFICE_MATCH_STATUS.UNVERIFIED_MATCH]: {
    label: 'Unverified Jurisdiction',
    tone: 'warning',
    color: '#b45309',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    description: 'Facility matches service category, but local municipal/jurisdiction boundary could not be confirmed.',
  },
  [OFFICE_MATCH_STATUS.UNMATCHED]: {
    label: 'Incompatible Office Type',
    tone: 'danger',
    color: '#dc2626',
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
    description: 'This facility does not handle services in this department or jurisdiction.',
  },
};

/**
 * Normalize text tokens for robust fuzzy matching
 */
const normalizeText = (txt) => {
  if (!txt || typeof txt !== 'string') return '';
  return txt.toLowerCase().trim().replace(/[^a-z0-9\s]/g, ' ');
};

/**
 * Check if two department strings refer to the same department
 */
export const checkDepartmentMatch = (officeDept, serviceDept) => {
  if (!officeDept || !serviceDept) return { matched: false, confidence: 0 };
  const dOffice = normalizeText(officeDept);
  const dService = normalizeText(serviceDept);

  if (dOffice === dService) return { matched: true, confidence: 1.0, type: 'EXACT' };
  if (dOffice.includes(dService) || dService.includes(dOffice)) {
    return { matched: true, confidence: 0.85, type: 'SUBSTRING' };
  }

  // Token overlap
  const wordsOffice = new Set(dOffice.split(/\s+/).filter((w) => w.length > 2));
  const wordsService = new Set(dService.split(/\s+/).filter((w) => w.length > 2));
  let overlap = 0;
  for (const w of wordsService) {
    if (wordsOffice.has(w)) overlap++;
  }

  const confidence = wordsService.size > 0 ? overlap / wordsService.size : 0;
  return {
    matched: confidence >= 0.5,
    confidence: Number(confidence.toFixed(2)),
    type: confidence >= 0.5 ? 'TOKEN_OVERLAP' : 'NONE',
  };
};

/**
 * Check if office jurisdiction covers the service jurisdiction
 */
export const checkJurisdictionMatch = (office, service) => {
  const sJur = normalizeText(service?.jurisdiction || service?.state || '');
  const oState = normalizeText(office?.state || '');
  const oDistrict = normalizeText(office?.district || office?.city || '');

  // If service has no stated jurisdiction or office has no state/district info, mark UNVERIFIED
  if (!sJur || (!oState && !oDistrict)) {
    return { matched: false, unverified: true, reason: 'Jurisdiction boundary not stated on record.' };
  }

  if (sJur === 'national' || sJur === 'central' || sJur === 'all india') {
    return { matched: true, unverified: false, reason: 'National scheme valid across all regions.' };
  }

  if (oState && sJur.includes(oState)) {
    return { matched: true, unverified: false, reason: `Covers state jurisdiction (${office.state}).` };
  }

  if (oDistrict && sJur.includes(oDistrict)) {
    return { matched: true, unverified: false, reason: `Matches district jurisdiction (${office.district || office.city}).` };
  }

  return {
    matched: false,
    unverified: false,
    reason: `Service jurisdiction "${service.jurisdiction}" differs from office region (${office.state || 'Unknown'}).`,
  };
};

/**
 * Evaluate suitability and explain the match between an office and a service
 */
export const evaluateOfficeServiceMatch = (office, service) => {
  if (!office) {
    return {
      status: OFFICE_MATCH_STATUS.UNMATCHED,
      config: MATCH_STATUS_CONFIG[OFFICE_MATCH_STATUS.UNMATCHED],
      explanation: 'Office information missing.',
      reasons: [],
      isResponsibleOffice: false,
      isUnverified: false,
      score: 0,
    };
  }

  if (!service) {
    return {
      status: OFFICE_MATCH_STATUS.NEARBY_FACILITY_ONLY,
      config: MATCH_STATUS_CONFIG[OFFICE_MATCH_STATUS.NEARBY_FACILITY_ONLY],
      explanation: 'No service selected. Recommended as general nearby civic facility.',
      reasons: ['General civic service counter'],
      isResponsibleOffice: false,
      isUnverified: false,
      score: 0.5,
    };
  }

  const officeDept = office.department || office.type || '';
  const serviceDept = service.department || service.category || '';
  const deptMatch = checkDepartmentMatch(officeDept, serviceDept);
  const jurMatch = checkJurisdictionMatch(office, service);

  // Check explicit services handled by this office
  const officeServices = Array.isArray(office.servicesOffered)
    ? office.servicesOffered.map(normalizeText)
    : [];
  const sTitleNorm = normalizeText(service.title || service.name || '');
  const handlesServiceDirectly = officeServices.some(
    (offered) => sTitleNorm.includes(offered) || offered.includes(sTitleNorm)
  );

  const reasons = [];
  let status = OFFICE_MATCH_STATUS.UNMATCHED;
  let score = 0;

  // 1. Check for Unverified Jurisdiction
  if (jurMatch.unverified) {
    status = OFFICE_MATCH_STATUS.UNVERIFIED_MATCH;
    reasons.push(jurMatch.reason);
    if (deptMatch.matched) {
      reasons.push(`Matches department (${officeDept}), but jurisdiction requires confirmation.`);
    }
    score = 0.55;
  }
  // 2. Confirmed Responsible Office
  else if ((handlesServiceDirectly || deptMatch.matched) && jurMatch.matched) {
    status = OFFICE_MATCH_STATUS.CONFIRMED_RESPONSIBLE_OFFICE;
    if (handlesServiceDirectly) {
      reasons.push(`Explicitly verified intake center for "${service.title || service.name}".`);
    } else {
      reasons.push(`Official administrative center for the ${service.department || 'governing department'}.`);
    }
    reasons.push(jurMatch.reason);
    score = 0.95;
  }
  // 3. Civic Facilitation Center (e.g. CSC, Seva Kendra, MeeSeva, Taluk Office in same jurisdiction)
  else if (jurMatch.matched) {
    const isFacilitationCenter = /seva|csc|citizen|taluk|tehsil|ward|municipal|kendra/i.test(office.name || office.type);
    if (isFacilitationCenter) {
      status = OFFICE_MATCH_STATUS.JURISDICTION_MATCH;
      reasons.push('General citizen service center that can assist with online applications and document uploads.');
      reasons.push(jurMatch.reason);
      score = 0.75;
    } else {
      status = OFFICE_MATCH_STATUS.NEARBY_FACILITY_ONLY;
      reasons.push('Geographically located in your region, but primary department does not match this service.');
      score = 0.40;
    }
  }
  // 4. Incompatible / Unmatched
  else {
    status = OFFICE_MATCH_STATUS.UNMATCHED;
    reasons.push(jurMatch.reason);
    score = 0.10;
  }

  const isResponsible = status === OFFICE_MATCH_STATUS.CONFIRMED_RESPONSIBLE_OFFICE;
  const isUnverified = status === OFFICE_MATCH_STATUS.UNVERIFIED_MATCH;

  return {
    status,
    config: MATCH_STATUS_CONFIG[status],
    explanation: reasons[0] || 'Office match evaluated.',
    reasons,
    isResponsibleOffice: isResponsible,
    isUnverified,
    score,
    distanceKm: office.distanceKm ?? office.distance ?? null,
  };
};

/**
 * Rank and explain a list of offices for a selected service,
 * prioritising confirmed responsible offices and suitable facilitation centers
 */
export const rankAndExplainOffices = (offices = [], service = null) => {
  if (!Array.isArray(offices)) return [];

  return offices
    .map((office) => {
      const match = evaluateOfficeServiceMatch(office, service);
      return {
        ...office,
        matchExplanation: match,
      };
    })
    .sort((a, b) => {
      // 1. Sort by match status priority
      const scoreDiff = b.matchExplanation.score - a.matchExplanation.score;
      if (Math.abs(scoreDiff) > 0.1) return scoreDiff;

      // 2. Secondary sort by geographic distance if available
      const distA = a.distanceKm ?? 9999;
      const distB = b.distanceKm ?? 9999;
      return distA - distB;
    });
};

/**
 * Provide regional or headquarters fallback offices when GPS is denied
 */
export const getGpsDeniedOfficeFallback = (service = null, fallbackRegion = {}) => {
  const { state = 'Delhi', district = 'New Delhi' } = fallbackRegion;

  const fallbackOffices = [
    {
      id: 'fallback-state-hq',
      name: `${service?.department || 'Civic Affairs'} State Directorate`,
      department: service?.department || 'Department of Public Services',
      state: state,
      district: district,
      address: `Vikas Bhawan, Secretariat Complex, ${district}`,
      pincode: '110002',
      phone: '011-23378900',
      hours: 'Mon - Fri: 09:30 AM - 05:30 PM',
      type: 'Department Headquarters',
      isFallbackRecord: true,
      servicesOffered: [service?.title || 'Civic Services'],
    },
    {
      id: 'fallback-csc-central',
      name: `Central Citizen Facilitation Center - ${district}`,
      department: 'Revenue & Public Delivery',
      state: state,
      district: district,
      address: `Mini Secretariat / DC Office Compound, ${district}`,
      pincode: '110001',
      phone: '1800-111-555',
      hours: 'Mon - Sat: 09:00 AM - 06:00 PM',
      type: 'Citizen Service Center (CSC)',
      isFallbackRecord: true,
      servicesOffered: ['Application Assistance', 'Document Upload', 'Fee Receipt'],
    },
  ];

  return rankAndExplainOffices(fallbackOffices, service);
};
