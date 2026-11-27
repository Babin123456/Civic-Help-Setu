/**
 * src/services/aiHallucinationReportService.js
 *
 * Civic AI Hallucination and Unsupported-Claim Reporting Workflow (#1448).
 *
 * Provides:
 * - Claim-level feedback linked to responseId, sourceSnapshot, modelVersion & rulesetVersion
 * - Minimal telemetry & reporter privacy (hashed/anonymized reporterRef, zero PII)
 * - Automatic risk classification & routing for high-risk reports
 * - Correction, withdrawal, and reviewer resolution lifecycle
 * - Redacted regression fixture export compatible with Civic Agent Eval Harness
 * - Safe backward-compatible store migration
 */

import { inspectStringForPII } from './piiLeakageGuardService.js';

export const HALLUCINATION_REPORT_SCHEMA_VERSION = '1.0.0';

export const REPORT_REASON_CODES = {
  NO_SOURCE_CITED: 'no_source_cited',
  MISSTATED_REQUIREMENT: 'misstated_requirement',
  OUTDATED_RULE: 'outdated_rule',
  FABRICATED_PORTAL_OR_URL: 'fabricated_portal_or_url',
  JURISDICTION_MISMATCH: 'jurisdiction_mismatch',
};

export const REPORT_STATUS = {
  OPEN: 'open',
  UNDER_REVIEW: 'under_review',
  CORRECTION_ISSUED: 'correction_issued',
  WITHDRAWN_BY_REPORTER: 'withdrawn_by_reporter',
  DISMISSED: 'dismissed',
  RESOLVED_NO_DEFECT: 'resolved_no_defect',
};

export const RISK_LEVEL = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

export const CLAIM_ORIGIN = {
  AI_CLAIM: 'ai_generated_claim',
  CITIZEN_REPORT: 'citizen_entered_report',
  OFFICIAL_CORRECTION: 'official_verified_record',
};

const SENSITIVE_KEY_PATTERN =
  /^(aadhaar|pan|otp|password|biometric|fingerprint|iris|phone|mobile|email|voter_?id)$/i;

/**
 * Deterministic non-reversible pseudonymous reporter reference for privacy-by-design.
 */
export function anonymizeReporterId(rawActorId) {
  const input = String(rawActorId || 'anonymous');
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `rep-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function sanitizeReportText(val, maxLen = 600) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
}

/**
 * Validates that a report or correction payload contains zero PII or sensitive credentials.
 */
export function validateZeroPiiPayload(payload, path = 'report') {
  const violations = [];

  function walk(node, currentPath) {
    if (node === null || node === undefined) return;
    if (typeof node === 'string') {
      const check = inspectStringForPII(node);
      if (!check.clean) {
        for (const v of check.violations) {
          violations.push(`${currentPath}: prohibited PII (${v.type})`);
        }
      }
      if (/\b\d{6}\b/.test(node) && /otp/i.test(currentPath)) {
        violations.push(`${currentPath}: OTP value is prohibited`);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, idx) => walk(item, `${currentPath}[${idx}]`));
      return;
    }
    if (typeof node === 'object') {
      for (const [key, val] of Object.entries(node)) {
        if (SENSITIVE_KEY_PATTERN.test(key.trim())) {
          violations.push(`${currentPath}.${key}: sensitive field is prohibited`);
        }
        walk(val, `${currentPath}.${key}`);
      }
    }
  }

  walk(payload, path);
  return { valid: violations.length === 0, violations };
}

/**
 * Evaluates official source snapshot provenance. Unknown/incomplete rules are marked unverified.
 */
export function evaluateOfficialSourceSnapshot(snapshot = {}) {
  const required = ['source', 'jurisdiction', 'effectiveDate', 'lastVerifiedAt'];
  const missingFields = required.filter(
    (f) => typeof snapshot?.[f] !== 'string' || snapshot[f].trim().length === 0
  );
  const verified = missingFields.length === 0 && snapshot?.verified !== false;
  return {
    source: sanitizeReportText(snapshot?.source || 'Unverified / No source cited', 200),
    jurisdiction: sanitizeReportText(snapshot?.jurisdiction || 'UNSPECIFIED', 64),
    effectiveDate: sanitizeReportText(snapshot?.effectiveDate || '', 40),
    lastVerifiedAt: sanitizeReportText(snapshot?.lastVerifiedAt || '', 64),
    snapshotId: sanitizeReportText(snapshot?.snapshotId || 'snap-unverified', 80),
    verified,
    status: verified ? 'verified' : 'unverified',
    missingFields,
  };
}

/**
 * Classifies report risk and determines review queue routing.
 */
export function classifyReportRisk({ reasonCode, serviceId = '', claimText = '' }) {
  const highRiskReasons = [
    REPORT_REASON_CODES.FABRICATED_PORTAL_OR_URL,
    REPORT_REASON_CODES.MISSTATED_REQUIREMENT,
  ];
  const highStakesKeywords = /(eligibility|deadline|fee|penalty|appeal|court|pension|ration|aadhaar|passport)/i;

  if (
    highRiskReasons.includes(reasonCode) ||
    (reasonCode === REPORT_REASON_CODES.NO_SOURCE_CITED &&
      (highStakesKeywords.test(claimText) || highStakesKeywords.test(serviceId)))
  ) {
    return { riskLevel: RISK_LEVEL.HIGH, routedTo: 'priority_reviewer_queue' };
  }
  if (
    reasonCode === REPORT_REASON_CODES.OUTDATED_RULE ||
    reasonCode === REPORT_REASON_CODES.JURISDICTION_MISMATCH
  ) {
    return { riskLevel: RISK_LEVEL.MEDIUM, routedTo: 'standard_reviewer_queue' };
  }
  return { riskLevel: RISK_LEVEL.LOW, routedTo: 'standard_reviewer_queue' };
}

/**
 * Validates and builds a minimal-telemetry hallucination report record.
 */
export function createHallucinationReport(input, actorId = 'anonymous') {
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Report payload must be a JSON object.'], report: null };
  }

  const piiCheck = validateZeroPiiPayload(input, 'report');
  if (!piiCheck.valid) {
    return { valid: false, errors: piiCheck.violations, report: null };
  }

  const errors = [];
  const responseId = sanitizeReportText(input.responseId, 80);
  const claimId = sanitizeReportText(input.claimId, 80);
  const claimText = sanitizeReportText(input.claimText, 500);
  const serviceId = sanitizeReportText(input.serviceId || 'general-civic', 80);
  const modelVersion = sanitizeReportText(input.modelVersion || 'unknown-model', 64);
  const rulesetVersion = sanitizeReportText(input.rulesetVersion || 'unknown-ruleset', 64);
  const reasonCode = input.reasonCode;
  const citizenCorrectionNote = sanitizeReportText(input.citizenCorrectionNote || '', 500);

  if (!responseId) errors.push('responseId is required.');
  if (!claimId) errors.push('claimId is required.');
  if (!claimText || claimText.length < 5) errors.push('claimText must be at least 5 characters.');
  if (!Object.values(REPORT_REASON_CODES).includes(reasonCode)) {
    errors.push(`reasonCode must be one of: ${Object.values(REPORT_REASON_CODES).join(', ')}`);
  }

  if (errors.length > 0) {
    return { valid: false, errors, report: null };
  }

  const sourceSnapshot = evaluateOfficialSourceSnapshot(input.sourceSnapshot || {});
  const routing = classifyReportRisk({ reasonCode, serviceId, claimText });
  const now = new Date().toISOString();

  const report = {
    schemaVersion: HALLUCINATION_REPORT_SCHEMA_VERSION,
    reportId: `hal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    reporterRef: anonymizeReporterId(actorId),
    telemetry: {
      responseId,
      claimId,
      serviceId,
      modelVersion,
      rulesetVersion,
      language: sanitizeReportText(input.language || 'en', 16),
    },
    claim: {
      origin: CLAIM_ORIGIN.AI_CLAIM,
      text: claimText,
    },
    citizenFeedback: {
      origin: CLAIM_ORIGIN.CITIZEN_REPORT,
      reasonCode,
      note: citizenCorrectionNote,
    },
    sourceSnapshot,
    riskLevel: routing.riskLevel,
    routedTo: routing.routedTo,
    status: routing.riskLevel === RISK_LEVEL.HIGH ? REPORT_STATUS.UNDER_REVIEW : REPORT_STATUS.OPEN,
    resolution: null,
    regressionFixtureId: null,
    createdAt: now,
    updatedAt: now,
  };

  return { valid: true, errors: [], report };
}

/**
 * Allows the reporter (matching reporterRef) or an admin to withdraw an open/under-review report.
 */
export function withdrawHallucinationReport(report, { actorId, role = 'citizen', reason = '' } = {}) {
  if (!report) throw new Error('Report not found.');
  const isOwner = report.reporterRef === anonymizeReporterId(actorId);
  if (!isOwner && role !== 'admin') {
    throw new Error('Forbidden: only the original reporter or an admin can withdraw this report.');
  }
  if ([REPORT_STATUS.CORRECTION_ISSUED, REPORT_STATUS.WITHDRAWN_BY_REPORTER].includes(report.status)) {
    throw new Error(`Cannot withdraw report in terminal status '${report.status}'.`);
  }

  const piiCheck = validateZeroPiiPayload({ reason }, 'withdraw');
  if (!piiCheck.valid) {
    throw new Error(piiCheck.violations[0]);
  }

  return {
    ...report,
    status: REPORT_STATUS.WITHDRAWN_BY_REPORTER,
    resolution: {
      origin: CLAIM_ORIGIN.CITIZEN_REPORT,
      outcome: REPORT_STATUS.WITHDRAWN_BY_REPORTER,
      note: sanitizeReportText(reason || 'Withdrawn by reporter.', 300),
      resolvedByRef: anonymizeReporterId(actorId),
      resolvedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Resolves a report (admin/reviewer only), issuing an official verified correction or dismissal
 * and optionally exporting a redacted regression fixture.
 */
export function resolveHallucinationReport(
  report,
  {
    actorId,
    outcome = REPORT_STATUS.CORRECTION_ISSUED,
    correctionNote = '',
    officialSource = {},
    exportFixture = true,
  } = {}
) {
  if (!report) throw new Error('Report not found.');
  const allowedOutcomes = [
    REPORT_STATUS.CORRECTION_ISSUED,
    REPORT_STATUS.DISMISSED,
    REPORT_STATUS.RESOLVED_NO_DEFECT,
  ];
  if (!allowedOutcomes.includes(outcome)) {
    throw new Error(`Invalid resolution outcome '${outcome}'.`);
  }

  const piiCheck = validateZeroPiiPayload({ correctionNote, officialSource }, 'resolution');
  if (!piiCheck.valid) {
    throw new Error(piiCheck.violations[0]);
  }

  const cleanNote = sanitizeReportText(correctionNote, 500);
  if (outcome === REPORT_STATUS.CORRECTION_ISSUED && cleanNote.length < 5) {
    throw new Error('correctionNote (min 5 chars) is required when issuing a correction.');
  }

  const verifiedOfficial = evaluateOfficialSourceSnapshot(officialSource);
  const now = new Date().toISOString();

  const updated = {
    ...report,
    status: outcome,
    resolution: {
      origin: CLAIM_ORIGIN.OFFICIAL_CORRECTION,
      outcome,
      correctionNote: cleanNote,
      officialSource: verifiedOfficial,
      resolvedByRef: anonymizeReporterId(actorId),
      resolvedAt: now,
    },
    updatedAt: now,
  };

  let fixture = null;
  if (outcome === REPORT_STATUS.CORRECTION_ISSUED && exportFixture) {
    fixture = exportAsRegressionFixture(updated);
    updated.regressionFixtureId = fixture.id;
  }

  return { report: updated, fixture };
}

/**
 * Converts a confirmed hallucination report into a redaction-safe regression fixture
 * compatible with the Civic Agent Evaluation Harness.
 */
export function exportAsRegressionFixture(report) {
  const officialUrlOrSource = report.resolution?.officialSource?.source || report.sourceSnapshot?.source || '';
  return {
    id: `reg-${report.reportId}`,
    schemaVersion: HALLUCINATION_REPORT_SCHEMA_VERSION,
    sourceReportId: report.reportId,
    domain: report.telemetry?.serviceId || 'general-civic',
    language: report.telemetry?.language || 'en',
    jurisdiction:
      report.resolution?.officialSource?.jurisdiction ||
      report.sourceSnapshot?.jurisdiction ||
      'UNSPECIFIED',
    serviceContextId: report.telemetry?.serviceId || 'general-civic',
    modelVersion: report.telemetry?.modelVersion || 'unknown-model',
    rulesetVersion: report.telemetry?.rulesetVersion || 'unknown-ruleset',
    prohibitedClaim: report.claim?.text || '',
    expectedCorrection: report.resolution?.correctionNote || '',
    expectedCitations: officialUrlOrSource ? [officialUrlOrSource] : [],
    verified: Boolean(report.resolution?.officialSource?.verified),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Built-in synthetic/seeded reports for offline inspection and initial dashboard readiness.
 */
export function getBuiltInHallucinationReports() {
  const now = '2026-11-20T09:00:00.000Z';
  return [
    {
      schemaVersion: HALLUCINATION_REPORT_SCHEMA_VERSION,
      reportId: 'hal-seed-passport-fee',
      reporterRef: 'rep-00000001',
      telemetry: {
        responseId: 'resp-2026-11-001',
        claimId: 'claim-passport-tatkal',
        serviceId: 'passport',
        modelVersion: 'civic-rag-v2.4',
        rulesetVersion: 'rules-2026.11',
        language: 'en',
      },
      claim: {
        origin: CLAIM_ORIGIN.AI_CLAIM,
        text: 'Tatkal passport applications are processed free of charge for all applicants under 30.',
      },
      citizenFeedback: {
        origin: CLAIM_ORIGIN.CITIZEN_REPORT,
        reasonCode: REPORT_REASON_CODES.MISSTATED_REQUIREMENT,
        note: 'Tatkal passport requires an additional Tatkal fee above the standard fee.',
      },
      sourceSnapshot: {
        source: 'Ministry of External Affairs — Passport Seva Fee Calculator',
        jurisdiction: 'IN-NATIONAL',
        effectiveDate: '2026-01-01',
        lastVerifiedAt: now,
        snapshotId: 'snap-mea-2026-01',
        verified: true,
        status: 'verified',
        missingFields: [],
      },
      riskLevel: RISK_LEVEL.HIGH,
      routedTo: 'priority_reviewer_queue',
      status: REPORT_STATUS.UNDER_REVIEW,
      resolution: null,
      regressionFixtureId: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      schemaVersion: HALLUCINATION_REPORT_SCHEMA_VERSION,
      reportId: 'hal-seed-ration-uncited',
      reporterRef: 'rep-00000002',
      telemetry: {
        responseId: 'resp-2026-11-002',
        claimId: 'claim-ration-deadline',
        serviceId: 'ration-card',
        modelVersion: 'civic-rag-v2.4',
        rulesetVersion: 'rules-2026.11',
        language: 'hi',
      },
      claim: {
        origin: CLAIM_ORIGIN.AI_CLAIM,
        text: 'Ration card e-KYC deadline is automatically extended by 180 days without visiting any center.',
      },
      citizenFeedback: {
        origin: CLAIM_ORIGIN.CITIZEN_REPORT,
        reasonCode: REPORT_REASON_CODES.NO_SOURCE_CITED,
        note: 'No official UP FCS circular was cited for this extension.',
      },
      sourceSnapshot: {
        source: 'Unverified / No source cited',
        jurisdiction: 'IN-UP',
        effectiveDate: '',
        lastVerifiedAt: '',
        snapshotId: 'snap-unverified',
        verified: false,
        status: 'unverified',
        missingFields: ['effectiveDate', 'lastVerifiedAt'],
      },
      riskLevel: RISK_LEVEL.HIGH,
      routedTo: 'priority_reviewer_queue',
      status: REPORT_STATUS.CORRECTION_ISSUED,
      resolution: {
        origin: CLAIM_ORIGIN.OFFICIAL_CORRECTION,
        outcome: REPORT_STATUS.CORRECTION_ISSUED,
        correctionNote: 'No automatic 180-day extension exists; verify active UP FCS notification.',
        officialSource: {
          source: 'UP Food & Civil Supplies Department Portal (fcs.up.gov.in)',
          jurisdiction: 'IN-UP',
          effectiveDate: '2026-10-01',
          lastVerifiedAt: now,
          snapshotId: 'snap-up-fcs-2026-10',
          verified: true,
          status: 'verified',
          missingFields: [],
        },
        resolvedByRef: 'rep-admin-01',
        resolvedAt: now,
      },
      regressionFixtureId: 'reg-hal-seed-ration-uncited',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function migrateHallucinationStoreState(rawState = {}) {
  const safe = rawState && typeof rawState === 'object' ? rawState : {};
  return {
    schemaVersion: HALLUCINATION_REPORT_SCHEMA_VERSION,
    reports: Array.isArray(safe.reports) ? safe.reports : getBuiltInHallucinationReports(),
    regressionFixtures: Array.isArray(safe.regressionFixtures) ? safe.regressionFixtures : [],
    auditLog: Array.isArray(safe.auditLog) ? safe.auditLog : [],
  };
}
