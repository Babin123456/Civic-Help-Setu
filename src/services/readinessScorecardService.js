/**
 * Civic Application Readiness Scorecard Service (#147)
 *
 * Transparent, deterministic readiness calculation based on explicit citizen checklist
 * completion and service metadata.
 *
 * Strict Compliance:
 * - No opaque AI guessing; score is calculated exclusively from defined, configurable criteria.
 * - Prominently states that readiness does not guarantee official government approval.
 * - Discloses data confidence penalties when service records have missing or unverified metadata.
 * - Supports saving and resuming progress locally.
 */
import { logDiagnostic } from '../utils/diagnostics';

export const READINESS_STORAGE_KEY = 'civicbridge_readiness_scorecards';

export const READINESS_CATEGORIES = {
  ELIGIBILITY: 'eligibility',
  DOCUMENTS: 'documents',
  OFFICIAL_SOURCES: 'official_sources',
  FEES_PAYMENT: 'fees_payment',
  SUBMISSION_PROCEDURE: 'submission_procedure',
};

export const READINESS_CATEGORY_LABELS = {
  [READINESS_CATEGORIES.ELIGIBILITY]: 'Eligibility Verification',
  [READINESS_CATEGORIES.DOCUMENTS]: 'Mandatory Documents Checklist',
  [READINESS_CATEGORIES.OFFICIAL_SOURCES]: 'Official Portal & Link Verification',
  [READINESS_CATEGORIES.FEES_PAYMENT]: 'Fees & Payment Preparation',
  [READINESS_CATEGORIES.SUBMISSION_PROCEDURE]: 'Submission Procedure & SLA Awareness',
};

export const APPROVAL_DISCLAIMER_TEXT =
  'Readiness score is an independent preparation assessment tool and does NOT guarantee official government approval, statutory eligibility, or document acceptance by licensing authorities.';

/**
 * Service-specific configurable readiness criteria definitions.
 * Services not listed here fall back to generated criteria based on service metadata.
 */
export const SERVICE_READINESS_RULES = {
  'birth-certificate': [
    {
      id: 'bc-eligibility-parent',
      category: READINESS_CATEGORIES.ELIGIBILITY,
      title: 'Parent or Guardian Authorization',
      weight: 15,
      whatToVerify: 'Verify that applicant is a biological/legal parent or primary hospital guardian of the child.',
      commonPitfalls: 'Applying for non-immediate family members requires special court authorization.',
    },
    {
      id: 'bc-eligibility-timeline',
      category: READINESS_CATEGORIES.ELIGIBILITY,
      title: 'Reporting Timeline Check (Within 21 Days)',
      weight: 10,
      whatToVerify: 'Check if birth occurred within the statutory 21-day window. If late (>21 days), SDM affidavit is mandatory.',
      commonPitfalls: 'Late reporting past 30 days incurs non-refundable delay fees and SDM magistrate inquiry.',
    },
    {
      id: 'bc-doc-discharge',
      category: READINESS_CATEGORIES.DOCUMENTS,
      title: 'Hospital Birth Notification / Discharge Report',
      weight: 20,
      whatToVerify: 'Ensure original institutional discharge letter from hospital/nursing home bearing serial number is collected.',
      commonPitfalls: 'Photocopies without doctor seal or hospital RMO signature are routinely rejected.',
    },
    {
      id: 'bc-doc-parent-id',
      category: READINESS_CATEGORIES.DOCUMENTS,
      title: 'Both Parents Identity & Marriage Proof',
      weight: 15,
      whatToVerify: 'Match spelling of parents names across Aadhaar/Voter IDs and marriage certificate.',
      commonPitfalls: 'Name discrepancies between father Aadhaar and mother discharge book cause file suspension.',
    },
    {
      id: 'bc-source-portal',
      category: READINESS_CATEGORIES.OFFICIAL_SOURCES,
      title: 'Municipal / Civil Registration System Link Verified',
      weight: 10,
      whatToVerify: 'Verify application link is hosted on official state e-district or crsorgi.gov.in portal.',
      commonPitfalls: 'Third-party commercial agents charging unofficial facilitation surcharges.',
    },
    {
      id: 'bc-fees-ready',
      category: READINESS_CATEGORIES.FEES_PAYMENT,
      title: 'Treasury Fee & Payment Mode Prepared',
      weight: 15,
      whatToVerify: 'Confirm statutory fee (typically ₹20 - ₹100 depending on days elapsed) and keep UPI / exact change ready.',
      commonPitfalls: 'Municipal counters do not provide cash change for large currency notes.',
    },
    {
      id: 'bc-sub-acknowledgment',
      category: READINESS_CATEGORIES.SUBMISSION_PROCEDURE,
      title: 'Submission Procedure & Counter Timings Verified',
      weight: 15,
      whatToVerify: 'Check municipal ward office timings (usually 10:00 AM - 02:00 PM for public counters) and SLA (14-21 days).',
      commonPitfalls: 'Arriving outside public counter reception hours.',
    },
  ],
  'driving-license': [
    {
      id: 'dl-eligibility-learner',
      category: READINESS_CATEGORIES.ELIGIBILITY,
      title: 'Valid Learner License Held (>30 Days)',
      weight: 20,
      whatToVerify: 'Ensure Learner License was issued at least 30 days prior and has not expired (valid for 6 months).',
      commonPitfalls: 'Cannot take practical driving test within first 30 days of Learner License issue date.',
    },
    {
      id: 'dl-doc-address',
      category: READINESS_CATEGORIES.DOCUMENTS,
      title: 'Original Address Proof for RTO Jurisdiction',
      weight: 20,
      whatToVerify: 'Address proof must fall strictly within the selected RTO territorial district jurisdiction.',
      commonPitfalls: 'Electricity bills older than 3 months are rejected by motor licensing officers.',
    },
    {
      id: 'dl-source-parivahan',
      category: READINESS_CATEGORIES.OFFICIAL_SOURCES,
      title: 'Parivahan Sarathi Government Portal Verified',
      weight: 15,
      whatToVerify: 'Verify booking appointment exclusively on parivahan.gov.in.',
      commonPitfalls: 'Phishing portals pretending to book automated test tracks.',
    },
    {
      id: 'dl-fees-slot',
      category: READINESS_CATEGORIES.FEES_PAYMENT,
      title: 'Driving Test & Smart Card Fee Receipt',
      weight: 20,
      whatToVerify: 'Keep printed payment receipt of form 7/smart card fee and slot booking slip.',
      commonPitfalls: 'Payment pending in bank gateway results in slot cancellation at RTO biometric booth.',
    },
    {
      id: 'dl-sub-vehicle',
      category: READINESS_CATEGORIES.SUBMISSION_PROCEDURE,
      title: 'Test Vehicle Compliance (RC, Pollution & Insurance)',
      weight: 25,
      whatToVerify: 'Bring physical vehicle with valid RC, active comprehensive/third-party insurance, and valid PUC certificate.',
      commonPitfalls: 'Expired vehicle pollution certificate immediately disqualifies test candidate.',
    },
  ],
};

/**
 * Dynamically synthesizes transparent readiness criteria for any service
 * based on its registered metadata (documents, steps, officialSources, fees).
 */
export const generateReadinessCriteriaForService = (service) => {
  if (!service) return [];
  if (SERVICE_READINESS_RULES[service.id]) {
    return SERVICE_READINESS_RULES[service.id];
  }

  const criteria = [];

  // 1. Eligibility Criteria
  if (Array.isArray(service.eligibility) && service.eligibility.length > 0) {
    service.eligibility.forEach((crit, idx) => {
      criteria.push({
        id: `gen-eligibility-${idx}`,
        category: READINESS_CATEGORIES.ELIGIBILITY,
        title: `Eligibility: ${crit}`,
        weight: 15,
        whatToVerify: `Confirm that you meet statutory rule: "${crit}" before submitting application.`,
        commonPitfalls: 'Failure to satisfy minimum eligibility leads to immediate application rejection.',
      });
    });
  } else {
    criteria.push({
      id: 'gen-eligibility-basic',
      category: READINESS_CATEGORIES.ELIGIBILITY,
      title: 'General Domicile & Age Pre-check',
      weight: 15,
      whatToVerify: 'Verify that applicant satisfies standard age, domicile, and identity prerequisites for this service.',
      commonPitfalls: 'Applying under incorrect regional jurisdiction.',
    });
  }

  // 2. Documents Criteria
  if (Array.isArray(service.documents) && service.documents.length > 0) {
    service.documents.forEach((doc, idx) => {
      criteria.push({
        id: `gen-doc-${idx}`,
        category: READINESS_CATEGORIES.DOCUMENTS,
        title: `Document: ${doc}`,
        weight: Math.max(10, Math.floor(40 / service.documents.length)),
        whatToVerify: `Collect original and self-attested photocopy of ${doc}. Ensure name matches identity records.`,
        commonPitfalls: 'Blurry copies, expired validity, or missing gazetted attestation where mandated.',
      });
    });
  } else {
    criteria.push({
      id: 'gen-doc-default',
      category: READINESS_CATEGORIES.DOCUMENTS,
      title: 'Standard Identity & Residence Documentation',
      weight: 25,
      whatToVerify: 'Gather government-issued photo ID (Aadhaar/PAN/Voter ID) and current address proof.',
      commonPitfalls: 'Missing self-attestation or illegible scans.',
    });
  }

  // 3. Official Source & Portal Criteria
  const hasOfficialSource = Array.isArray(service.officialSources) && service.officialSources.length > 0;
  criteria.push({
    id: 'gen-source-verification',
    category: READINESS_CATEGORIES.OFFICIAL_SOURCES,
    title: 'Official Portal & Domain Security Check',
    weight: 15,
    whatToVerify: hasOfficialSource
      ? `Verify submission on designated official portal (${service.officialSources[0]?.url || 'gov.in domain'}).`
      : 'Verify portal URL ends in .gov.in or .nic.in before entering personal demographic information.',
    commonPitfalls: 'Beware of fraudulent clone sites advertising instant processing for extra payments.',
  });

  // 4. Fees Criteria
  criteria.push({
    id: 'gen-fees-check',
    category: READINESS_CATEGORIES.FEES_PAYMENT,
    title: 'Statutory Fee & Payment Mode Confirmation',
    weight: 15,
    whatToVerify: `Verify fee details: "${service.fees || 'Nil / Standard government schedule'}". Ensure payment mode is ready.`,
    commonPitfalls: 'Third-party agent surcharges are not official government statutory fees.',
  });

  // 5. Procedural Instructions Criteria
  criteria.push({
    id: 'gen-proc-sla',
    category: READINESS_CATEGORIES.SUBMISSION_PROCEDURE,
    title: 'Procedure & Processing SLA Understanding',
    weight: 15,
    whatToVerify: `Familiarize with expected timeline: "${service.processingTime || '15-30 days'}". Retain acknowledgment slip upon filing.`,
    commonPitfalls: 'Losing application tracking number prevents status escalation.',
  });

  return criteria;
};

/**
 * Assesses data confidence based on freshness and completeness of official service record.
 */
export const evaluateDataConfidence = (service) => {
  if (!service) {
    return {
      level: 'low',
      score: 30,
      penalty: 30,
      disclosures: ['No service record loaded.'],
    };
  }

  const disclosures = [];
  let score = 100;

  // 1. Missing official source check
  const hasSources = Array.isArray(service.officialSources) && service.officialSources.length > 0;
  const hasVerifiedSource = hasSources && service.officialSources.some((s) => s.verified || s.isVerified);
  if (!hasSources) {
    score -= 25;
    disclosures.push('Official government portal link is unverified or missing from registry.');
  } else if (!hasVerifiedSource) {
    score -= 15;
    disclosures.push('Official source link has not undergone secondary verification.');
  }

  // 2. Freshness check
  if (!service.lastVerified) {
    score -= 20;
    disclosures.push('Service rules have no recorded audit timestamp.');
  } else {
    try {
      const auditDate = new Date(service.lastVerified);
      const daysOld = Math.floor((Date.now() - auditDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysOld > 365) {
        score -= 15;
        disclosures.push(`Official service data was last reviewed ${daysOld} days ago (annual audit overdue).`);
      }
    } catch {
      score -= 10;
      disclosures.push('Audit timestamp format is invalid.');
    }
  }

  // 3. Completeness of critical fields
  if (!service.fees) {
    score -= 15;
    disclosures.push('Statutory fee structure is unlisted or variable; verify with counter.');
  }

  if (!service.documents || service.documents.length === 0) {
    score -= 20;
    disclosures.push('Mandatory document checklist is incomplete in registry.');
  }

  const finalScore = Math.max(20, Math.min(100, score));
  let level = 'high';
  if (finalScore < 60) level = 'low';
  else if (finalScore < 85) level = 'moderate';

  return {
    level,
    score: finalScore,
    disclosures,
  };
};

/**
 * Calculates deterministic readiness scorecard from explicit checklist selections.
 */
export const calculateReadinessScore = (service, checkedItemIds = []) => {
  const criteria = generateReadinessCriteriaForService(service);
  const checkedSet = new Set(Array.isArray(checkedItemIds) ? checkedItemIds : []);

  let totalWeight = 0;
  let completedWeight = 0;

  const categoryStats = {};
  Object.values(READINESS_CATEGORIES).forEach((cat) => {
    categoryStats[cat] = {
      completedCount: 0,
      totalCount: 0,
      completedWeight: 0,
      totalWeight: 0,
    };
  });

  const incompleteItems = [];
  const completedItems = [];

  for (const item of criteria) {
    const isCompleted = checkedSet.has(item.id);
    const weight = item.weight || 10;
    totalWeight += weight;

    const catStat = categoryStats[item.category] || {
      completedCount: 0,
      totalCount: 0,
      completedWeight: 0,
      totalWeight: 0,
    };
    catStat.totalCount += 1;
    catStat.totalWeight += weight;

    if (isCompleted) {
      completedWeight += weight;
      catStat.completedCount += 1;
      catStat.completedWeight += weight;
      completedItems.push(item);
    } else {
      incompleteItems.push(item);
    }
    categoryStats[item.category] = catStat;
  }

  const percentage = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
  const dataConfidence = evaluateDataConfidence(service);

  return {
    score: percentage,
    totalCriteria: criteria.length,
    completedCount: completedItems.length,
    incompleteCount: incompleteItems.length,
    completedWeight,
    totalWeight,
    categoryStats,
    incompleteItems,
    completedItems,
    allCriteria: criteria,
    dataConfidence,
    disclaimer: APPROVAL_DISCLAIMER_TEXT,
    isReadyForSubmission: percentage >= 90 && dataConfidence.level !== 'low',
  };
};

/**
 * Persistence helpers for saving / resuming scorecard progress
 */
const getStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export const saveReadinessProgress = (serviceId, checkedIds = [], notes = '', storage = getStorage()) => {
  if (!serviceId || !storage) return null;

  try {
    const raw = storage.getItem(READINESS_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};

    const record = {
      serviceId,
      checkedIds: Array.isArray(checkedIds) ? [...new Set(checkedIds)] : [],
      notes: typeof notes === 'string' ? notes.trim() : '',
      updatedAt: new Date().toISOString(),
    };

    map[serviceId] = record;
    storage.setItem(READINESS_STORAGE_KEY, JSON.stringify(map));
    return record;
  } catch (err) {
    logDiagnostic('Failed to save readiness scorecard', err);
    return null;
  }
};

export const getReadinessProgress = (serviceId, storage = getStorage()) => {
  if (!serviceId || !storage) return null;

  try {
    const raw = storage.getItem(READINESS_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map[serviceId] || null;
  } catch {
    return null;
  }
};

export const resetReadinessProgress = (serviceId, storage = getStorage()) => {
  if (!serviceId || !storage) return false;

  try {
    const raw = storage.getItem(READINESS_STORAGE_KEY);
    if (!raw) return true;
    const map = JSON.parse(raw);
    delete map[serviceId];
    storage.setItem(READINESS_STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
};
