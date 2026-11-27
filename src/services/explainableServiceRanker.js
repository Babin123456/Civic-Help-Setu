/**
 * src/services/explainableServiceRanker.js
 *
 * Explainable Civic Service Recommendation Ranker (#1430).
 *
 * Combines:
 *   - Query relevance (0–0.40)
 *   - Jurisdiction match via `matchesJurisdiction` (0–0.25)
 *   - Task stage fit (0–0.15)
 *   - Verified freshness (0–0.20)
 *
 * Guarantees:
 *   - Deterministic fallback when query is empty or unmatched.
 *   - Zero sensitive-feature inference: demographic/protected attributes are
 *     explicitly stripped and never influence scores (verified by fairness checks).
 *   - Visible explanation factors & provenance distinction.
 *   - User intent correction override.
 *   - Curated offline evaluation dataset & MRR/fairness evaluator.
 */

import { matchesJurisdiction } from './jurisdictionService.js';
import { MOCK_SERVICES } from '../data/services.js';

export const TASK_STAGES = Object.freeze([
  { id: 'discovery', label: '1. Exploring Eligibility & Requirements' },
  { id: 'document_prep', label: '2. Preparing Documents & Checklists' },
  { id: 'application', label: '3. Submitting Application / Portal Filing' },
  { id: 'grievance_followup', label: '4. Follow-Up & Grievance Redressal' },
]);

const SENSITIVE_KEYS = new Set([
  'caste', 'religion', 'gender', 'sex', 'ethnicity', 'race', 'income',
  'disability', 'aadhaar', 'pan', 'otp', 'password', 'biometric', 'age',
]);

/**
 * Strips any sensitive or protected attributes so they can never influence ranking.
 */
export function sanitizeRankingContext(rawContext = {}) {
  const clean = {};
  for (const [k, v] of Object.entries(rawContext || {})) {
    if (!SENSITIVE_KEYS.has(k.toLowerCase())) {
      clean[k] = v;
    }
  }
  return clean;
}

function computeFreshnessScore(service, nowMs = Date.now()) {
  const verifiedAt = service.lastVerifiedAt || service.lastUpdated || service.updatedAt || null;
  if (!verifiedAt) {
    return {
      score: 0.02,
      verificationStatus: 'UNVERIFIED',
      rationale: 'Last-verified timestamp missing; marked UNVERIFIED.',
    };
  }
  const ageDays = Math.max(0, (nowMs - new Date(verifiedAt).getTime()) / (1000 * 60 * 60 * 24));
  if (ageDays <= 180) {
    return {
      score: 0.2,
      verificationStatus: 'VERIFIED',
      rationale: `Verified within ${Math.round(ageDays)} days.`,
    };
  }
  if (ageDays <= 365) {
    return {
      score: 0.12,
      verificationStatus: 'VERIFIED',
      rationale: `Verified ${Math.round(ageDays)} days ago.`,
    };
  }
  return {
    score: 0.05,
    verificationStatus: 'STALE',
    rationale: `Verification is ${Math.round(ageDays)} days old (stale).`,
  };
}

function computeTaskStageScore(service, taskStage) {
  if (!taskStage) return { score: 0.05, rationale: 'General stage fit (no stage specified).' };
  const text = `${service.title || ''} ${service.name || ''} ${service.description || ''} ${service.category || ''}`.toLowerCase();
  if (taskStage === 'grievance_followup' && /grievance|complaint|appeal|rti|ombudsman/.test(text)) {
    return { score: 0.15, rationale: 'Matches grievance & follow-up stage.' };
  }
  if (taskStage === 'document_prep' && /certificate|document|checklist|aadhaar|pan|ration/.test(text)) {
    return { score: 0.15, rationale: 'Matches document preparation stage.' };
  }
  if (taskStage === 'application' && /apply|portal|registration|licence|license|permit|pension/.test(text)) {
    return { score: 0.15, rationale: 'Matches application submission stage.' };
  }
  return { score: 0.08, rationale: 'Standard multi-stage civic service.' };
}

/**
 * Ranks civic services with transparent explanation factors and deterministic fallback.
 */
export function rankCivicServices(
  rawContext = {},
  services = MOCK_SERVICES,
  nowMs = Date.now()
) {
  const ctx = sanitizeRankingContext(rawContext);
  const query = String(ctx.query || '').trim();
  const jurisdiction = String(ctx.jurisdiction || 'All').trim();
  const taskStage = ctx.taskStage || '';
  const intentOverride = ctx.intentOverride || null;

  const effectiveQuery = intentOverride ? `${query} ${intentOverride}`.trim() : query;
  const tokens = effectiveQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  const scored = (Array.isArray(services) ? services : []).map((svc) => {
    const title = svc.title || svc.name || svc.id;
    const hay = `${title} ${svc.category || ''} ${svc.department || ''} ${svc.description || ''} ${(svc.tags || []).join(' ')}`.toLowerCase();

    // 1. Query relevance (0 - 0.40)
    const matchedTokens = tokens.filter((t) => hay.includes(t));
    const relevanceScore =
      tokens.length > 0 ? Number(((matchedTokens.length / tokens.length) * 0.4).toFixed(4)) : 0;

    // 2. Jurisdiction match (0 - 0.25)
    let jurMatch;
    try {
      jurMatch = jurisdiction === 'All' || matchesJurisdiction(svc, jurisdiction);
    } catch {
      jurMatch = true;
    }
    const jurisdictionScore = jurMatch ? 0.25 : 0.05;

    // 3. Task stage fit (0 - 0.15)
    const stageInfo = computeTaskStageScore(svc, taskStage);

    // 4. Verified freshness (0 - 0.20)
    const freshInfo = computeFreshnessScore(svc, nowMs);

    const totalScore = Number(
      (relevanceScore + jurisdictionScore + stageInfo.score + freshInfo.score).toFixed(4)
    );

    const jurLabel = typeof svc.jurisdiction === 'string'
      ? svc.jurisdiction
      : svc.state || (Array.isArray(svc.jurisdiction?.states) && svc.jurisdiction.states.length > 0 ? svc.jurisdiction.states.join(', ') : svc.jurisdiction?.level) || 'All India';

    return {
      id: svc.id,
      title,
      category: svc.category || 'Civic Service',
      department: svc.department || 'Public Authority',
      jurisdiction: jurLabel,
      verificationStatus: freshInfo.verificationStatus,
      lastVerifiedAt: svc.lastVerifiedAt || svc.lastUpdated || null,
      provenance: 'official_catalogue',
      score: totalScore,
      explanationFactors: [
        {
          factor: 'Query Relevance',
          score: relevanceScore,
          maxScore: 0.4,
          rationale:
            tokens.length > 0
              ? `Matched ${matchedTokens.length}/${tokens.length} query term(s).`
              : 'No query entered; deterministic fallback ordering active.',
        },
        {
          factor: 'Jurisdiction Match',
          score: jurisdictionScore,
          maxScore: 0.25,
          rationale: jurMatch ? `Applies to ${jurisdiction}.` : `Outside ${jurisdiction} (fallback weight).`,
        },
        {
          factor: 'Task Stage Fit',
          score: stageInfo.score,
          maxScore: 0.15,
          rationale: stageInfo.rationale,
        },
        {
          factor: 'Verified Freshness',
          score: freshInfo.score,
          maxScore: 0.2,
          rationale: freshInfo.rationale,
        },
      ],
    };
  });

  // Deterministic sort: score desc, then alphabetical title asc
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.title.localeCompare(b.title);
  });

  const hasQueryMatch = tokens.length > 0 && scored.some((s) => s.explanationFactors[0].score > 0);
  const fallbackUsed = !hasQueryMatch;

  return {
    query,
    intentOverride,
    jurisdiction,
    taskStage: taskStage || 'all',
    fallbackUsed,
    sensitiveFeaturesExcluded: true,
    results: scored.slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// OFFLINE EVALUATION DATASET & FAIRNESS CHECKS
// ---------------------------------------------------------------------------

export const OFFLINE_RANKER_EVAL_DATASET = Object.freeze([
  { id: 'eval-1', query: 'income certificate', expectedKeyword: 'income', jurisdiction: 'All' },
  { id: 'eval-2', query: 'ration card', expectedKeyword: 'ration', jurisdiction: 'All' },
  { id: 'eval-3', query: 'birth certificate', expectedKeyword: 'birth', jurisdiction: 'All' },
  { id: 'eval-4', query: 'passport', expectedKeyword: 'passport', jurisdiction: 'All' },
]);

/**
 * Runs offline MRR/Top-1 evaluation AND fairness invariance checks across
 * sensitive demographic perturbations.
 */
export function evaluateRankerOffline(dataset = OFFLINE_RANKER_EVAL_DATASET, services = MOCK_SERVICES) {
  let top1Hits = 0;
  let mrrSum = 0;
  let fairnessInvariantPassed = true;

  for (const item of dataset) {
    const base = rankCivicServices({ query: item.query, jurisdiction: item.jurisdiction }, services);
    const perturbedA = rankCivicServices(
      { query: item.query, jurisdiction: item.jurisdiction, caste: 'SC', religion: 'X', gender: 'F', income: 10000 },
      services
    );
    const perturbedB = rankCivicServices(
      { query: item.query, jurisdiction: item.jurisdiction, caste: 'GEN', religion: 'Y', gender: 'M', income: 900000 },
      services
    );

    const idsBase = base.results.map((r) => r.id);
    const idsA = perturbedA.results.map((r) => r.id);
    const idsB = perturbedB.results.map((r) => r.id);

    if (JSON.stringify(idsBase) !== JSON.stringify(idsA) || JSON.stringify(idsBase) !== JSON.stringify(idsB)) {
      fairnessInvariantPassed = false;
    }

    const matchIdx = base.results.findIndex((r) =>
      `${r.title} ${r.category}`.toLowerCase().includes(item.expectedKeyword)
    );
    if (matchIdx === 0) top1Hits += 1;
    if (matchIdx >= 0) mrrSum += 1 / (matchIdx + 1);
  }

  return {
    totalCases: dataset.length,
    top1Accuracy: dataset.length > 0 ? Number((top1Hits / dataset.length).toFixed(4)) : 0,
    mrr: dataset.length > 0 ? Number((mrrSum / dataset.length).toFixed(4)) : 0,
    fairnessInvariantPassed,
    evaluatedAt: new Date().toISOString(),
  };
}
