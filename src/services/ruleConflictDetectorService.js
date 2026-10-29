/**
 * Civic Rule Conflict Detector Service (#270)
 * Scans service definitions, eligibility criteria, and required documents
 * to proactively detect logical contradictions, mutually exclusive prerequisites,
 * impossible demographic ranges, and channel inconsistencies.
 */

export const CONFLICT_SEVERITY = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

export const CONFLICT_TYPES = {
  MUTUALLY_EXCLUSIVE_REQUIREMENTS: 'MUTUALLY_EXCLUSIVE_REQUIREMENTS',
  IMPOSSIBLE_NUMERICAL_BOUNDS: 'IMPOSSIBLE_NUMERICAL_BOUNDS',
  INCONSISTENT_SERVICE_MODE: 'INCONSISTENT_SERVICE_MODE',
  CONTRADICTORY_PREREQUISITE: 'CONTRADICTORY_PREREQUISITE',
  DISCREPANT_TIMELINE_OR_SLA: 'DISCREPANT_TIMELINE_OR_SLA',
};

const BPL_KEYWORDS = ['bpl', 'below poverty line', 'antyodaya', 'aay', 'yellow ration card', 'subsidized food'];
const HIGH_INCOME_KEYWORDS = ['itr', 'tax return', 'form 16', 'income tax payer', 'above 8 lakh', 'above 8,00,000'];
const PHYSICAL_VERIFICATION_KEYWORDS = ['in-person physical', 'gazetted officer attested', 'original notary affidavit', 'counter submission only', 'physical hardcopy'];
const ONLINE_ONLY_KEYWORDS = ['online only', 'paperless', 'digital-only', '100% online'];

/**
 * Analyzes a single civic service guide for contradictory criteria and document rules.
 */
export function detectServiceRuleConflicts(service = {}) {
  const conflicts = [];
  const serviceId = service.id || 'unknown';
  const serviceName = service.name || 'Untitled Service';

  const eligibility = Array.isArray(service.eligibility) ? service.eligibility : [];
  const documents = Array.isArray(service.documents) ? service.documents : [];
  const steps = Array.isArray(service.steps) ? service.steps : [];
  const mode = String(service.mode || '').toLowerCase();
  const processingTime = String(service.processingTime || '').toLowerCase();

  const allCriteriaText = eligibility.join(' ').toLowerCase();
  const allDocumentsText = documents.join(' ').toLowerCase();
  const allStepsText = steps.join(' ').toLowerCase();

  // 1. Check for Mutually Exclusive Criteria (e.g. BPL entitlement vs High Income Tax)
  const hasBpl = BPL_KEYWORDS.some((kw) => allCriteriaText.includes(kw) || allDocumentsText.includes(kw));
  const hasHighIncome = HIGH_INCOME_KEYWORDS.some((kw) => allCriteriaText.includes(kw) || allDocumentsText.includes(kw));

  if (hasBpl && hasHighIncome) {
    conflicts.push({
      id: `${serviceId}-exclusive-income-bpl`,
      type: CONFLICT_TYPES.MUTUALLY_EXCLUSIVE_REQUIREMENTS,
      severity: CONFLICT_SEVERITY.HIGH,
      title: 'Contradictory BPL and High-Income Requirements',
      description: 'The service simultaneously lists Below-Poverty-Line (BPL) criteria and high-bracket Income Tax / ITR filings.',
      ruleRef: 'Eligibility and Document Criteria',
      resolutionSuggestion: 'Split into separate sub-schemes or clarify whether ITR is an exemption or alternative criterion.',
    });
  }

  // 2. Check for Mode Inconsistency (e.g. 100% Online mode with Mandatory Physical Attestation)
  const isOnlineMode = ONLINE_ONLY_KEYWORDS.some((kw) => mode.includes(kw) || allCriteriaText.includes(kw));
  const hasPhysicalMandate = PHYSICAL_VERIFICATION_KEYWORDS.some((kw) => allDocumentsText.includes(kw) || allStepsText.includes(kw));

  if (isOnlineMode && hasPhysicalMandate) {
    conflicts.push({
      id: `${serviceId}-mode-inconsistency`,
      type: CONFLICT_TYPES.INCONSISTENT_SERVICE_MODE,
      severity: CONFLICT_SEVERITY.HIGH,
      title: 'Service Mode Contradiction (Online vs Physical Stamping)',
      description: 'Service is advertised as 100% Online/Paperless, but requires physical in-person gazetted attestation or counter submission.',
      ruleRef: 'Mode and Application Steps',
      resolutionSuggestion: 'Update service mode to "Hybrid / Semi-Online" or clarify digital e-Sign alternatives for affidavits.',
    });
  }

  // 3. Check for Circular or Contradictory Prerequisite
  const lowerName = serviceName.toLowerCase();
  if (lowerName.includes('learner') && allDocumentsText.includes('driving license')) {
    conflicts.push({
      id: `${serviceId}-circular-prerequisite`,
      type: CONFLICT_TYPES.CONTRADICTORY_PREREQUISITE,
      severity: CONFLICT_SEVERITY.HIGH,
      title: 'Circular Document Requirement Detected',
      description: 'A Learner License cannot mandate an existing active permanent Driving License as a prerequisite document.',
      ruleRef: 'Required Documents',
      resolutionSuggestion: 'Remove Driving License requirement; replace with Age Proof and Identity Proof.',
    });
  }

  // 4. Check for Discrepant Timeline vs Heavy In-Person Scrutiny
  const isInstant = processingTime.includes('instant') || processingTime.includes('same day') || processingTime.includes('1 day');
  const hasLengthySteps = allStepsText.includes('police verification') || allStepsText.includes('30 days public notice') || allStepsText.includes('site inspection by patwari');

  if (isInstant && hasLengthySteps) {
    conflicts.push({
      id: `${serviceId}-timeline-discrepancy`,
      type: CONFLICT_TYPES.DISCREPANT_TIMELINE_OR_SLA,
      severity: CONFLICT_SEVERITY.MEDIUM,
      title: 'Unrealistic Processing Time Claim',
      description: 'The service claims instant / same-day delivery, but includes mandatory police verification or field site inspection.',
      ruleRef: 'Processing Time SLA vs Application Steps',
      resolutionSuggestion: 'Align statutory SLA with field inspection duration (typically 15-30 days).',
    });
  }

  // 5. Numerical Age or Fee Bound Inconsistencies
  const ageMatch = allCriteriaText.match(/minimum age\s*(\d+).*maximum age\s*(\d+)/i);
  if (ageMatch) {
    const minAge = parseInt(ageMatch[1], 10);
    const maxAge = parseInt(ageMatch[2], 10);
    if (minAge > maxAge) {
      conflicts.push({
        id: `${serviceId}-impossible-age-range`,
        type: CONFLICT_TYPES.IMPOSSIBLE_NUMERICAL_BOUNDS,
        severity: CONFLICT_SEVERITY.HIGH,
        title: 'Impossible Age Criterion Bound',
        description: `Minimum age threshold (${minAge}) is strictly greater than maximum age limit (${maxAge}).`,
        ruleRef: 'Eligibility Criteria',
        resolutionSuggestion: 'Invert or correct the age eligibility interval.',
      });
    }
  }

  let highestSeverity = null;
  if (conflicts.some((c) => c.severity === CONFLICT_SEVERITY.HIGH)) {
    highestSeverity = CONFLICT_SEVERITY.HIGH;
  } else if (conflicts.some((c) => c.severity === CONFLICT_SEVERITY.MEDIUM)) {
    highestSeverity = CONFLICT_SEVERITY.MEDIUM;
  } else if (conflicts.length > 0) {
    highestSeverity = CONFLICT_SEVERITY.LOW;
  }

  return {
    serviceId,
    serviceName,
    hasConflicts: conflicts.length > 0,
    conflictCount: conflicts.length,
    highestSeverity,
    conflicts,
  };
}

/**
 * Audit an entire catalogue of civic services for latent rule contradictions.
 */
export function auditCatalogueRuleConflicts(servicesList = []) {
  if (!Array.isArray(servicesList)) return { totalServices: 0, flaggedServices: 0, totalConflicts: 0, reports: [] };

  const reports = servicesList.map((svc) => detectServiceRuleConflicts(svc));
  const flagged = reports.filter((r) => r.hasConflicts);
  const totalConflicts = flagged.reduce((acc, curr) => acc + curr.conflictCount, 0);

  return {
    totalServices: servicesList.length,
    flaggedServicesCount: flagged.length,
    totalConflicts,
    hasCriticalIssues: flagged.some((f) => f.highestSeverity === CONFLICT_SEVERITY.HIGH),
    reports: flagged,
  };
}
