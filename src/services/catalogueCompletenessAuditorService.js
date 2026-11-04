/**
 * catalogueCompletenessAuditorService.js
 *
 * AI-assisted service catalogue completeness auditor (#474).
 * Performs deep semantic inspection of civic catalogue records to flag
 * missing fields, vague terminology, weakly specified procedures, and
 * missing verification dates.
 *
 * Quality & Safety Guarantees:
 * - Diagnostic auditing only: Never invents requirements or auto-modifies catalogue records.
 * - Persistent dismissal tracking per field & service (stored in localStorage).
 * - Generates structured, exportable quality findings for administrative review.
 */

export const VAGUE_TERMS = [
  'as applicable',
  'as prescribed',
  'etc.',
  'etc',
  'and others',
  'as needed',
  'as required',
  'subject to conditions',
  'various documents',
  'standard documents',
  'concerned department',
  'contact office',
];

export const AUDITOR_DISMISSALS_KEY = 'civicbridge_catalogue_auditor_dismissals_v2';

/**
 * Audit rule specifications covering all mandatory catalogue attributes
 */
export const AUDIT_RULES = [
  {
    field: 'description',
    label: 'Citizen Service Overview',
    severity: 'CRITICAL',
    check: (s) => typeof s.description === 'string' && s.description.trim().length >= 40,
    impact: 'Short or missing descriptions prevent semantic search ranking and confuse citizens trying to understand service benefits.',
    suggestedFix: 'Provide a clear, plain-language description explaining who qualifies, what benefits are granted, and how to apply.',
  },
  {
    field: 'targetAudience',
    label: 'Target Citizen Audience',
    severity: 'HIGH',
    check: (s) => Boolean(s.targetAudience || s.audience || s.category),
    impact: 'Without defined audience criteria (e.g. students, artisans, senior citizens), targeted recommendation engines cannot match the service.',
    suggestedFix: 'Specify beneficiary segments, such as farmers, low-income households, women, or persons with disabilities.',
  },
  {
    field: 'department',
    label: 'Administrative Department',
    severity: 'CRITICAL',
    check: (s) => typeof s.department === 'string' && s.department.trim().length > 0,
    impact: 'Citizens cannot identify the responsible ministry or file grievances if the parent authority is missing.',
    suggestedFix: 'Tag with the exact state or central nodal department (e.g., Department of Social Welfare).',
  },
  {
    field: 'applicationMode',
    label: 'Application Mode (Online / Offline / Hybrid)',
    severity: 'MEDIUM',
    check: (s) => Boolean(s.applicationMode || s.mode || s.deliveryChannel),
    impact: 'Applicants arrive at physical offices for online-only services or struggle finding physical forms.',
    suggestedFix: 'Specify whether applications are processed exclusively via web portal, CSC counters, or designated district offices.',
  },
  {
    field: 'documents',
    label: 'Mandatory Document Checklist',
    severity: 'CRITICAL',
    check: (s) => Array.isArray(s.documents) && s.documents.length > 0,
    impact: 'Lacking itemized documents triggers counter rejections and breaks preflight readiness checks.',
    suggestedFix: 'List all mandatory proofs (e.g., Aadhaar card, income certificate, residence proof).',
  },
  {
    field: 'officialUrl',
    label: 'Official Application Portal URL',
    severity: 'CRITICAL',
    check: (s) => typeof s.officialUrl === 'string' && s.officialUrl.startsWith('http'),
    impact: 'Citizens cannot verify the scheme on official portals or access legitimate submission links.',
    suggestedFix: 'Link to the verified .gov.in or .nic.in portal for online filing.',
  },
  {
    field: 'contactInfo',
    label: 'Official Helpline / Contact Information',
    severity: 'HIGH',
    check: (s) => Boolean(s.contactInfo || s.helpline || s.supportPhone || s.email),
    impact: 'Citizens have no escalation channel when applications stall or technical errors arise.',
    suggestedFix: 'Provide toll-free helpline number, nodal officer email, or district desk address.',
  },
  {
    field: 'lastVerifiedDate',
    label: 'Last Catalogue Verification Date',
    severity: 'MEDIUM',
    check: (s) => Boolean(s.lastVerifiedDate || s.verifiedAt || s.lastUpdated),
    impact: 'Records without verification timestamps risk presenting obsolete guidelines or abolished statutory fees.',
    suggestedFix: 'Review service record against latest gazette circulars and record verification date.',
  },
];

/**
 * Retrieves dismissed finding IDs from storage
 */
export function getAuditorDismissedIds() {
  try {
    const raw = localStorage.getItem(AUDITOR_DISMISSALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Dismisses a specific audit finding
 */
export function dismissAuditorFinding(findingId) {
  try {
    const current = getAuditorDismissedIds();
    if (!current.includes(findingId)) {
      current.push(findingId);
      localStorage.setItem(AUDITOR_DISMISSALS_KEY, JSON.stringify(current));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Resets all dismissed findings
 */
export function resetAuditorDismissals() {
  try {
    localStorage.removeItem(AUDITOR_DISMISSALS_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Scans a service text for vague or weakly specified phrasing.
 */
export function detectVaguePhrasing(text = '') {
  if (!text || typeof text !== 'string') return [];
  const normalized = text.toLowerCase();
  return VAGUE_TERMS.filter((phrase) => normalized.includes(phrase));
}

/**
 * Audits a single service catalogue record for completeness and quality deficiencies.
 *
 * @param {Object} service - Service record
 * @returns {Array<Object>} List of detected audit issues
 */
export function auditServiceRecord(service) {
  if (!service || typeof service !== 'object') return [];

  const findings = [];
  const sId = service.id || 'unidentified';
  const serviceTitle = service.title || service.name || service.serviceName || 'Unnamed Service';

  // Check structured completeness rules
  AUDIT_RULES.forEach((rule) => {
    const passed = rule.check(service);
    if (!passed) {
      findings.push({
        id: `${sId}_${rule.field}_missing`,
        serviceId: sId,
        serviceTitle,
        field: rule.field,
        fieldLabel: rule.label,
        type: 'MISSING_FIELD',
        severity: rule.severity,
        impactExplanation: rule.impact,
        suggestedFix: rule.suggestedFix,
      });
    }
  });

  // Check for vague phrasing in description or notes
  const fullText = `${service.description || ''} ${service.notes || ''} ${Array.isArray(service.documents) ? service.documents.join(' ') : ''}`;
  const vagueMatches = detectVaguePhrasing(fullText);

  if (vagueMatches.length > 0) {
    findings.push({
      id: `${sId}_vague_terms`,
      serviceId: sId,
      serviceTitle,
      field: 'description',
      fieldLabel: 'Clarity & Specificity',
      type: 'VAGUE_LANGUAGE',
      severity: 'MEDIUM',
      impactExplanation: `Found non-committal or ambiguous terms (${vagueMatches.map((m) => `"${m}"`).join(', ')}). This confuses applicants about exact requirements.`,
      suggestedFix: 'Replace ambiguous placeholders with precise statutory conditions or explicit document names.',
    });
  }

  return findings;
}

/**
 * Scans an entire catalogue of services and generates summary statistics.
 *
 * @param {Array<Object>} catalog - Full catalogue
 * @param {Object} [options={}] - Options (e.g. includeDismissed)
 * @returns {Object} Comprehensive audit report
 */
export function runCatalogueCompletenessAudit(catalog = [], options = {}) {
  const items = Array.isArray(catalog) ? catalog : [];
  const dismissedIds = getAuditorDismissedIds();
  const allFindings = [];

  items.forEach((service) => {
    const serviceFindings = auditServiceRecord(service);
    allFindings.push(...serviceFindings);
  });

  const activeFindings = allFindings.filter((f) => !dismissedIds.includes(f.id));
  const dismissedFindings = allFindings.filter((f) => dismissedIds.includes(f.id));

  const criticalCount = activeFindings.filter((f) => f.severity === 'CRITICAL').length;
  const highCount = activeFindings.filter((f) => f.severity === 'HIGH').length;
  const mediumCount = activeFindings.filter((f) => f.severity === 'MEDIUM').length;

  return {
    totalScanned: items.length,
    totalDefects: allFindings.length,
    activeCount: activeFindings.length,
    dismissedCount: dismissedFindings.length,
    severityBreakdown: {
      CRITICAL: criticalCount,
      HIGH: highCount,
      MEDIUM: mediumCount,
    },
    activeFindings: options.includeDismissed ? allFindings : activeFindings,
    dismissedFindings,
  };
}

/**
 * Exports findings as a CSV or JSON report for administration records
 */
export function exportAuditFindings(findings = [], format = 'json') {
  if (format === 'csv') {
    const headers = ['Finding ID', 'Service ID', 'Service Name', 'Field', 'Severity', 'Issue Type', 'Impact Explanation'];
    const rows = findings.map((f) => [
      `"${f.id}"`,
      `"${f.serviceId}"`,
      `"${(f.serviceTitle || '').replace(/"/g, '""')}"`,
      `"${f.fieldLabel}"`,
      `"${f.severity}"`,
      `"${f.type}"`,
      `"${(f.impactExplanation || '').replace(/"/g, '""')}"`,
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  return JSON.stringify(findings, null, 2);
}
