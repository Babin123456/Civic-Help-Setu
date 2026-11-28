/**
 * src/services/mgnregaEvidenceBuilderService.js
 *
 * MGNREGA Work-Demand and Wage Delay Evidence Builder (#1419).
 *
 * Extends `grievanceEvidenceService.js` to provide a worker-controlled
 * timeline and complaint-preparation workspace:
 *   - Demand receipt references & work allocation dates
 *   - Muster-roll discrepancies & unpaid wage-period evidence
 *   - Never fabricates rupee entitlement or compensation calculations
 *   - Privacy-safe exports & zero-PII guard (no Aadhaar, PAN, OTP, password, biometrics)
 *   - Distinct provenance: citizen_entered | official_record | ai_suggestion
 */

import { getAllGrievanceDrafts, saveAllGrievanceDrafts } from './grievanceEvidenceService.js';

export const MGNREGA_EVIDENCE_STORAGE_KEY = 'civicbridge_mgnrega_evidence_v1';

export const NO_FABRICATED_ENTITLEMENT_DISCLAIMER =
  'This tool records factual dates, receipt references, and muster-roll discrepancies only. It does NOT calculate or guarantee rupee wage entitlements, unemployment allowance, or delay compensation; official calculations are determined solely by the Programme Officer and official MGNREGA records.';

export const PUBLISHED_MGNREGA_PROCESS_REFERENCES = Object.freeze([
  {
    ruleId: 'mgnrega-work-demand-15d',
    title: 'Work Allocation Within 15 Days of Demand Receipt',
    sourceUrl: 'https://nrega.nic.in/netnrega/WriteReaddata/Circulars/MGNREGA_Act_2005.pdf',
    jurisdiction: 'India (Central MGNREGA Act, 2005)',
    effectiveDate: '2005-09-07',
    lastVerifiedAt: '2026-01-15',
    verificationStatus: 'VERIFIED',
    provenance: 'official_record',
  },
  {
    ruleId: 'mgnrega-wage-payment-15d',
    title: 'Wage Payment Within 15 Days of Muster-Roll Closure',
    sourceUrl: 'https://nrega.nic.in/netnrega/WriteReaddata/Circulars/MGNREGA_Act_2005.pdf',
    jurisdiction: 'India (Central MGNREGA Act, 2005)',
    effectiveDate: '2005-09-07',
    lastVerifiedAt: '2026-01-15',
    verificationStatus: 'VERIFIED',
    provenance: 'official_record',
  },
]);

export const VALID_PROVENANCE = Object.freeze([
  'citizen_entered',
  'official_record',
  'ai_suggestion',
]);

const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const SENSITIVE_KEY_RE = /\b(aadhaar|password|otp|biometric|fingerprint|iris|bankaccount|ifsc)\b/i;

export function hasForbiddenPII(input) {
  if (!input) return false;
  if (typeof input === 'string') {
    return AADHAAR_RE.test(input) || PAN_RE.test(input);
  }
  if (typeof input === 'object') {
    for (const [k, v] of Object.entries(input)) {
      if (SENSITIVE_KEY_RE.test(k) && v !== undefined && v !== null && String(v).trim() !== '') {
        return true;
      }
      if (hasForbiddenPII(v)) return true;
    }
  }
  return false;
}

const getDefaultStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

function readStore(storage = getDefaultStorage()) {
  if (!storage) return { cases: {}, auditLog: [] };
  try {
    const raw = storage.getItem(MGNREGA_EVIDENCE_STORAGE_KEY);
    if (!raw) return { cases: {}, auditLog: [] };
    const parsed = JSON.parse(raw);
    return {
      cases: parsed?.cases && typeof parsed.cases === 'object' ? parsed.cases : {},
      auditLog: Array.isArray(parsed?.auditLog) ? parsed.auditLog : [],
    };
  } catch {
    return { cases: {}, auditLog: [] };
  }
}

function writeStore(store, storage = getDefaultStorage()) {
  if (!storage) return false;
  storage.setItem(MGNREGA_EVIDENCE_STORAGE_KEY, JSON.stringify(store));
  return true;
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function appendAudit(store, { caseId, actorId, action, outcome, detail = '' }) {
  store.auditLog.push({
    auditId: makeId('aud'),
    timestamp: new Date().toISOString(),
    caseId,
    actorId: actorId || 'anonymous',
    action,
    outcome,
    detail: String(detail || '').slice(0, 120),
  });
}

function diffDays(startIso, endIso) {
  if (!startIso || !endIso) return null;
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  if (Number.isNaN(s) || Number.isNaN(e)) return null;
  return Math.round((e - s) / 86_400_000);
}

export function createEvidenceCase({
  workerId,
  jobCardRef = '',
  panchayat = '',
  jurisdiction = '',
  demandReceiptRef = '',
  demandDate = '',
  daysDemanded = null,
  localRuleSourceUrl = '',
  localRuleEffectiveDate = '',
  localRuleLastVerifiedAt = '',
  storage = getDefaultStorage(),
}) {
  if (!workerId) return { ok: false, code: 401, error: 'Authentication required.' };
  if (hasForbiddenPII({ jobCardRef, panchayat, jurisdiction, demandReceiptRef })) {
    return { ok: false, code: 400, error: 'Evidence case must not contain Aadhaar, PAN, OTPs, passwords, or bank details.' };
  }
  if (!demandReceiptRef || !String(demandReceiptRef).trim() || !demandDate) {
    return { ok: false, code: 400, error: 'demandReceiptRef and demandDate are required.' };
  }

  const store = readStore(storage);
  const caseId = makeId('mgn');
  const hasVerifiedLocalRule = Boolean(localRuleSourceUrl && localRuleEffectiveDate && localRuleLastVerifiedAt);

  const evidenceCase = {
    caseId,
    workerId,
    jobCardRef: String(jobCardRef || '').trim(),
    panchayat: String(panchayat || '').trim(),
    jurisdiction: String(jurisdiction || 'UNVERIFIED').trim(),
    demandReceipt: {
      demandReceiptRef: String(demandReceiptRef).trim(),
      demandDate,
      daysDemanded: Number.isFinite(Number(daysDemanded)) ? Number(daysDemanded) : null,
      provenance: 'citizen_entered',
    },
    workAllocation: null,
    musterRollEvidence: [],
    timeline: [
      {
        eventId: makeId('evt'),
        date: demandDate,
        stage: 'work_demand_submitted',
        summary: `Work demand receipt ${String(demandReceiptRef).trim()} recorded`,
        provenance: 'citizen_entered',
      },
    ],
    officialRuleMetadata: {
      centralReferences: PUBLISHED_MGNREGA_PROCESS_REFERENCES,
      localRule: {
        sourceUrl: localRuleSourceUrl || null,
        jurisdiction: jurisdiction || 'UNVERIFIED',
        effectiveDate: localRuleEffectiveDate || null,
        lastVerifiedAt: localRuleLastVerifiedAt || null,
        verificationStatus: hasVerifiedLocalRule ? 'VERIFIED' : 'UNVERIFIED',
      },
    },
    entitlementDisclaimer: NO_FABRICATED_ENTITLEMENT_DISCLAIMER,
    createdAt: new Date().toISOString(),
  };

  store.cases[caseId] = evidenceCase;
  appendAudit(store, { caseId, actorId: workerId, action: 'create_case', outcome: 'allowed' });
  writeStore(store, storage);
  return { ok: true, evidenceCase };
}

export function recordWorkAllocation({
  caseId,
  actorId,
  allocationStatus = 'allocated',
  workAllocationDate = '',
  worksiteName = '',
  provenance = 'official_record',
  storage = getDefaultStorage(),
}) {
  if (!actorId) return { ok: false, code: 401, error: 'Authentication required.' };
  if (hasForbiddenPII({ worksiteName, workAllocationDate })) {
    return { ok: false, code: 400, error: 'Sensitive PII is forbidden.' };
  }

  const store = readStore(storage);
  const c = store.cases[caseId];
  if (!c) return { ok: false, code: 404, error: 'Evidence case not found.' };
  if (c.workerId !== actorId) {
    appendAudit(store, { caseId, actorId, action: 'record_allocation', outcome: 'denied' });
    writeStore(store, storage);
    return { ok: false, code: 403, error: 'Only the owning worker can update this evidence case.' };
  }

  const daysFromDemand = workAllocationDate
    ? diffDays(c.demandReceipt.demandDate, workAllocationDate)
    : null;
  const safeProv = VALID_PROVENANCE.includes(provenance) ? provenance : 'citizen_entered';

  c.workAllocation = {
    allocationStatus,
    workAllocationDate: workAllocationDate || null,
    worksiteName: String(worksiteName || '').trim(),
    daysFromDemand,
    exceeded15DayWindow: typeof daysFromDemand === 'number' ? daysFromDemand > 15 : false,
    provenance: safeProv,
  };

  c.timeline.push({
    eventId: makeId('evt'),
    date: workAllocationDate || new Date().toISOString().slice(0, 10),
    stage: 'work_allocation',
    summary: `Allocation status: ${allocationStatus}${worksiteName ? ` at ${worksiteName}` : ''}`,
    provenance: safeProv,
  });

  appendAudit(store, { caseId, actorId, action: 'record_allocation', outcome: 'allowed' });
  writeStore(store, storage);
  return { ok: true, evidenceCase: c };
}

export function addMusterRollAndWageEvidence({
  caseId,
  actorId,
  musterRollRef,
  workedPeriodStart,
  workedPeriodEnd,
  daysWorkedClaimed,
  daysRecordedOnMusterRoll,
  wageCreditStatus = 'unpaid',
  wageCreditDate = null,
  unpaidPeriodNote = '',
  provenance = 'citizen_entered',
  storage = getDefaultStorage(),
}) {
  if (!actorId) return { ok: false, code: 401, error: 'Authentication required.' };
  if (hasForbiddenPII({ musterRollRef, unpaidPeriodNote })) {
    return { ok: false, code: 400, error: 'Sensitive PII is forbidden.' };
  }
  if (!musterRollRef || !String(musterRollRef).trim()) {
    return { ok: false, code: 400, error: 'musterRollRef is required.' };
  }

  const store = readStore(storage);
  const c = store.cases[caseId];
  if (!c) return { ok: false, code: 404, error: 'Evidence case not found.' };
  if (c.workerId !== actorId) {
    appendAudit(store, { caseId, actorId, action: 'add_muster_evidence', outcome: 'denied' });
    writeStore(store, storage);
    return { ok: false, code: 403, error: 'Only the owning worker can update this evidence case.' };
  }

  const claimed = Number(daysWorkedClaimed);
  const recorded = Number(daysRecordedOnMusterRoll);
  const hasMusterRollDiscrepancy =
    Number.isFinite(claimed) && Number.isFinite(recorded) && claimed !== recorded;

  const safeProv = VALID_PROVENANCE.includes(provenance) ? provenance : 'citizen_entered';
  const entry = {
    entryId: makeId('mr'),
    musterRollRef: String(musterRollRef).trim(),
    workedPeriodStart: workedPeriodStart || null,
    workedPeriodEnd: workedPeriodEnd || null,
    daysWorkedClaimed: Number.isFinite(claimed) ? claimed : null,
    daysRecordedOnMusterRoll: Number.isFinite(recorded) ? recorded : null,
    hasMusterRollDiscrepancy,
    wageCreditStatus,
    wageCreditDate: wageCreditDate || null,
    unpaidPeriodNote: String(unpaidPeriodNote || '').trim(),
    provenance: safeProv,
    recordedAt: new Date().toISOString(),
  };

  c.musterRollEvidence.push(entry);
  c.timeline.push({
    eventId: makeId('evt'),
    date: workedPeriodEnd || workedPeriodStart || new Date().toISOString().slice(0, 10),
    stage: 'muster_roll_and_wage_evidence',
    summary: `Muster Roll ${entry.musterRollRef}: ${wageCreditStatus}${hasMusterRollDiscrepancy ? ' (day-count discrepancy flagged)' : ''}`,
    provenance: safeProv,
  });

  appendAudit(store, {
    caseId,
    actorId,
    action: 'add_muster_evidence',
    outcome: 'allowed',
    detail: `discrepancy=${hasMusterRollDiscrepancy},wage=${wageCreditStatus}`,
  });
  writeStore(store, storage);
  return { ok: true, entry, evidenceCase: c };
}

export function exportPrivacySafeComplaintDossier({
  caseId,
  actorId,
  saveToGrievanceDrafts = false,
  storage = getDefaultStorage(),
}) {
  if (!actorId) return { ok: false, code: 401, error: 'Authentication required.' };
  const store = readStore(storage);
  const c = store.cases[caseId];
  if (!c) return { ok: false, code: 404, error: 'Evidence case not found.' };
  if (c.workerId !== actorId) {
    appendAudit(store, { caseId, actorId, action: 'export_dossier', outcome: 'denied' });
    writeStore(store, storage);
    return { ok: false, code: 403, error: 'Only the owning worker can export this evidence dossier.' };
  }

  const dossier = {
    exportedAt: new Date().toISOString(),
    caseId: c.caseId,
    jurisdiction: c.jurisdiction,
    panchayat: c.panchayat,
    jobCardRef: c.jobCardRef ? `***${c.jobCardRef.slice(-4)}` : null,
    demandReceipt: c.demandReceipt,
    workAllocation: c.workAllocation,
    musterRollEvidence: c.musterRollEvidence,
    timeline: c.timeline,
    officialRuleMetadata: c.officialRuleMetadata,
    entitlementDisclaimer: NO_FABRICATED_ENTITLEMENT_DISCLAIMER,
    fabricatedEntitlementCalculations: false,
  };

  if (saveToGrievanceDrafts && storage) {
    const drafts = getAllGrievanceDrafts(storage);
    drafts.push({
      id: `griev-${c.caseId}`,
      userId: actorId,
      title: `MGNREGA Evidence (${c.demandReceipt.demandReceiptRef})`,
      createdAt: dossier.exportedAt,
      sourceCaseId: c.caseId,
    });
    saveAllGrievanceDrafts(drafts, storage);
  }

  appendAudit(store, { caseId, actorId, action: 'export_dossier', outcome: 'allowed' });
  writeStore(store, storage);
  return { ok: true, dossier };
}

export function getEvidenceCase({ caseId, actorId, storage = getDefaultStorage() }) {
  if (!actorId) return { ok: false, code: 401, error: 'Authentication required.' };
  const store = readStore(storage);
  const c = store.cases[caseId];
  if (!c) return { ok: false, code: 404, error: 'Evidence case not found.' };
  if (c.workerId !== actorId) {
    return { ok: false, code: 403, error: 'Unauthorized access to another worker evidence case.' };
  }
  return { ok: true, evidenceCase: c };
}
