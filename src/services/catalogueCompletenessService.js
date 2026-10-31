/**
 * Catalogue Completeness & Quality Audit Service
 *
 * Inspects civic-service catalogue records for missing administrative and procedural fields,
 * explains how each omission damages the citizen user journey, and enables administrators
 * to review and dismiss quality advisories without automated model hallucinations.
 */

export const CATALOGUE_DISMISSALS_KEY = 'civicbridge_catalogue_completeness_dismissals';

/**
 * Standard audit specifications for catalogue fields
 */
export const AUDITABLE_FIELDS = [
  {
    field: 'officialUrl',
    label: 'Official Government URL',
    severity: 'critical',
    check: (s) => Boolean(s.officialUrl && typeof s.officialUrl === 'string' && s.officialUrl.trim().length > 0),
    impactExplanation: 'Citizens cannot verify or submit online applications; AI assistant cannot ground citations in verified government portals.'
  },
  {
    field: 'documents',
    label: 'Required Documents List',
    severity: 'critical',
    check: (s) => Array.isArray(s.documents) && s.documents.length > 0,
    impactExplanation: 'Citizens risk in-person counter rejection due to missing paperwork; document preflight validation is disabled.'
  },
  {
    field: 'department',
    label: 'Responsible Department / Ministry',
    severity: 'high',
    check: (s) => Boolean(s.department && typeof s.department === 'string' && s.department.trim().length > 0),
    impactExplanation: 'Citizens cannot determine administrative hierarchy or identify the proper appellate grievance authority.'
  },
  {
    field: 'jurisdiction',
    label: 'Geographical Jurisdiction',
    severity: 'high',
    check: (s) => Boolean(s.jurisdiction && (typeof s.jurisdiction === 'string' || Array.isArray(s.jurisdiction))),
    impactExplanation: 'Nearby office locator and localized eligibility matching cannot scope applicability to the citizen’s state or district.'
  },
  {
    field: 'eligibilityCriteria',
    label: 'Structured Eligibility Criteria',
    severity: 'high',
    check: (s) => Array.isArray(s.eligibilityCriteria) && s.eligibilityCriteria.length > 0,
    impactExplanation: 'The automated eligibility test bench and welfare entitlement checker cannot assess citizen qualification.'
  },
  {
    field: 'processingTime',
    label: 'Prescribed Processing SLA / Time',
    severity: 'moderate',
    check: (s) => Boolean((s.processingTime || s.slaDays) && String(s.processingTime || s.slaDays).trim().length > 0),
    impactExplanation: 'Citizens cannot track application delays or compute statutory compensation under Right to Public Services Acts.'
  },
  {
    field: 'fee',
    label: 'Statutory Fee / Concession Rules',
    severity: 'moderate',
    check: (s) => Boolean(s.fee !== undefined && s.fee !== null && String(s.fee).trim().length > 0),
    impactExplanation: 'Citizens face unexpected expenses at public counters and miss out on statutory BPL/PwD fee waivers.'
  },
  {
    field: 'steps',
    label: 'Application Steps & Procedure',
    severity: 'moderate',
    check: (s) => Array.isArray(s.steps) && s.steps.length > 0,
    impactExplanation: 'Citizens are left without a clear sequence of actions, increasing application abandonment and procedural mistakes.'
  },
  {
    field: 'contact',
    label: 'Helpline / Support Contact',
    severity: 'advisory',
    check: (s) => Boolean(s.contact || s.helpline || s.supportEmail || (s.office && s.office.phone)),
    impactExplanation: 'Citizens have no official contact point to resolve technical portal glitches or procedural queries.'
  }
];

/**
 * Reads dismissed findings from client storage.
 * @returns {Record<string, string[]>} Map of serviceId -> array of dismissed field keys
 */
export function getDismissedFindings() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CATALOGUE_DISMISSALS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Dismisses a specific field quality finding for a service record.
 */
export function dismissFinding(serviceId, field) {
  if (!serviceId || !field || typeof localStorage === 'undefined') return;
  try {
    const current = getDismissedFindings();
    const serviceList = current[serviceId] || [];
    if (!serviceList.includes(field)) {
      current[serviceId] = [...serviceList, field];
      localStorage.setItem(CATALOGUE_DISMISSALS_KEY, JSON.stringify(current));
    }
  } catch {
    /* storage write failures fail silently */
  }
}

/**
 * Restores a previously dismissed field finding.
 */
export function restoreFinding(serviceId, field) {
  if (!serviceId || !field || typeof localStorage === 'undefined') return;
  try {
    const current = getDismissedFindings();
    if (current[serviceId]) {
      current[serviceId] = current[serviceId].filter((f) => f !== field);
      if (current[serviceId].length === 0) {
        delete current[serviceId];
      }
      localStorage.setItem(CATALOGUE_DISMISSALS_KEY, JSON.stringify(current));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Clears all dismissed findings.
 */
export function clearAllDismissals() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(CATALOGUE_DISMISSALS_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Audits a single service catalogue record for completeness.
 *
 * @param {Object} service The catalogue service object
 * @param {Object} [options] Audit configuration
 * @param {boolean} [options.filterDismissed=false] Whether to omit dismissed findings
 * @returns {Object} Detailed completeness audit result
 */
export function auditServiceCompleteness(service, options = {}) {
  if (!service || typeof service !== 'object') {
    return {
      serviceId: 'unknown',
      serviceName: 'Unnamed Service',
      completenessScore: 0,
      missingFields: [],
      status: 'severely-incomplete',
      totalFieldsEvaluated: AUDITABLE_FIELDS.length
    };
  }

  const serviceId = service.id || 'unidentified-service';
  const serviceName = service.name || service.title || 'Untitled Service';
  const dismissedMap = options.filterDismissed ? getDismissedFindings() : {};
  const dismissedForService = dismissedMap[serviceId] || [];

  const missingFields = [];
  let satisfiedWeight = 0;
  const totalWeight = AUDITABLE_FIELDS.length;

  for (const spec of AUDITABLE_FIELDS) {
    const isPresent = spec.check(service);
    if (isPresent) {
      satisfiedWeight += 1;
    } else {
      const isDismissed = dismissedForService.includes(spec.field);
      if (!isDismissed) {
        missingFields.push({
          field: spec.field,
          label: spec.label,
          severity: spec.severity,
          impactExplanation: spec.impactExplanation,
          isDismissed: false
        });
      }
    }
  }

  const completenessScore = Math.round((satisfiedWeight / totalWeight) * 100);

  let status = 'complete';
  if (completenessScore < 60) {
    status = 'severely-incomplete';
  } else if (completenessScore < 90 || missingFields.length > 0) {
    status = 'needs-review';
  }

  return {
    serviceId,
    serviceName,
    completenessScore,
    missingFields,
    status,
    totalFieldsEvaluated: totalWeight,
    satisfiedCount: satisfiedWeight
  };
}

/**
 * Audits an entire collection of service records.
 *
 * @param {Array} services List of services to inspect
 * @param {Object} [options] Audit configuration
 * @returns {Object} Aggregated catalogue quality report
 */
export function auditEntireCatalogue(services = [], options = {}) {
  if (!Array.isArray(services)) return { totalServices: 0, completeCount: 0, incompleteCount: 0, averageScore: 100, findings: [] };

  const findings = [];
  let completeCount = 0;
  let totalScore = 0;

  for (const svc of services) {
    const audit = auditServiceCompleteness(svc, options);
    totalScore += audit.completenessScore;
    if (audit.missingFields.length === 0) {
      completeCount += 1;
    } else {
      findings.push(audit);
    }
  }

  // Sort findings by lowest completeness score first (most urgent)
  findings.sort((a, b) => a.completenessScore - b.completenessScore);

  const totalServices = services.length;
  const averageScore = totalServices > 0 ? Math.round(totalScore / totalServices) : 100;
  const incompleteCount = findings.length;

  return {
    totalServices,
    completeCount,
    incompleteCount,
    averageScore,
    findings
  };
}
