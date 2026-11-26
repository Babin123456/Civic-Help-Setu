/**
 * Retrieval-Augmented Civic Guidance with Claim-Level Provenance Service (#1154)
 *
 * Implements:
 * 1. Versioned API contract (v1) with typed domain entities.
 * 2. Strict input validation at service boundaries (query length, jurisdiction code, date range).
 * 3. Authority governance: strictly excludes draft, pending, or archived services from the index.
 * 4. Temporal and jurisdiction pre-filtering with missing-jurisdiction limitation disclosures.
 * 5. Hybrid sparse-dense retrieval (BM25 + hash feature vector) with Reciprocal Rank Fusion (RRF).
 * 6. Authority and freshness re-ranking for verified government portals (.gov.in / .nic.in).
 * 7. Passage-level claim decomposition and entailment verification.
 * 8. Explicit classification of unsupported statements as UNKNOWN with fail-closed safeguards.
 * 9. Deterministic index versioning and telemetry.
 */

import {
  tokenize,
  isApprovedService,
} from './groundedCivicRagService.js';
import {
  HybridIndexStore,
  HYBRID_RETRIEVAL_CONFIG,
} from './hybridRetrievalService.js';
import {
  filterVersionedCivicRules,
  JURISDICTION_LEVELS,
} from './temporalJurisdictionRetrievalService.js';
import {
  decomposeClaims,
  verifyClaim,
  ENTAILMENT_STATUS,
  CLAIM_RISK_CATEGORY,
} from './evidenceEntailmentVerificationService.js';
import { getAllServices } from './serviceCatalog.js';

export const PROVENANCE_CONTRACT_VERSION = '1.0.0';

export const PROVENANCE_STATUS = Object.freeze({
  SUCCESS: 'SUCCESS',
  PARTIALLY_GROUNDED: 'PARTIALLY_GROUNDED',
  UNSUPPORTED: 'UNSUPPORTED',
  BLOCKED: 'BLOCKED',
  ERROR: 'ERROR',
});

export const CLAIM_STATUS = Object.freeze({
  SUPPORTED: 'SUPPORTED',
  CONTRADICTED: 'CONTRADICTED',
  UNKNOWN: 'UNKNOWN',
});

export const MANDATORY_LEGAL_DISCLAIMER =
  'Notice: This guidance is retrieved from approved civic service guidelines and does not constitute an official government eligibility decision. Rules, deadlines, and fees may vary by municipality.';

/**
 * Validates untrusted input at the service boundary.
 *
 * @param {Object} input
 * @returns {{ valid: boolean, sanitizedQuery: string, error?: string }}
 */
export function validateGuidanceRequest(input = {}) {
  if (!input || typeof input !== 'object') {
    return { valid: false, sanitizedQuery: '', error: 'Request payload must be an object' };
  }

  const query = typeof input.query === 'string' ? input.query.trim() : '';
  if (!query) {
    return { valid: false, sanitizedQuery: '', error: 'Query parameter must be a non-empty string' };
  }

  if (query.length > 600) {
    return { valid: false, sanitizedQuery: '', error: 'Query exceeds maximum allowed length of 600 characters' };
  }

  // Validate jurisdiction code format if supplied (ISO 3166-2:IN e.g. "IN-MH" or alphanumeric string)
  if (input.jurisdictionCode && typeof input.jurisdictionCode === 'string') {
    const cleanCode = input.jurisdictionCode.trim();
    if (cleanCode.length > 50 || /[^a-zA-Z0-9-_ ]/.test(cleanCode)) {
      return { valid: false, sanitizedQuery: '', error: 'Invalid jurisdiction code format' };
    }
  }

  // Validate reference timestamp if supplied
  if (input.referenceTimestamp != null) {
    const timeNum = new Date(input.referenceTimestamp).getTime();
    if (Number.isNaN(timeNum)) {
      return { valid: false, sanitizedQuery: '', error: 'Invalid referenceTimestamp value' };
    }
  }

  return { valid: true, sanitizedQuery: query };
}

/**
 * Computes a deterministic version hash for the active catalogue index.
 *
 * @param {Array<Object>} services
 * @returns {string} Version identifier
 */
export function computeIndexVersion(services = []) {
  const approved = services.filter(isApprovedService);
  const keys = approved
    .map((s) => `${s.id}:${s.version || '1'}:${s.lastVerified || '0'}`)
    .sort()
    .join('|');

  let hash = 0;
  for (let i = 0; i < keys.length; i++) {
    hash = ((hash << 5) - hash + keys.charCodeAt(i)) | 0;
  }
  return `idx-v1-${Math.abs(hash).toString(16)}`;
}

/**
 * Computes source authority and freshness score multiplier.
 *
 * @param {Object} chunk
 * @param {number} [referenceTime=Date.now()]
 * @returns {number} Boost multiplier (1.0 - 1.5)
 */
export function computePassageFreshnessScore(chunk, referenceTime = Date.now()) {
  let boost = 1.0;

  // Authority boost: official government domains (.gov.in, .nic.in)
  const url = chunk.officialUrl || chunk.sourceUrl || '';
  if (/\.(gov\.in|nic\.in)(\/|$)/i.test(url)) {
    boost += 0.25;
  }

  // Freshness boost: verified within the past 12-24 months
  if (chunk.lastVerified) {
    const verifiedTime = new Date(chunk.lastVerified).getTime();
    if (!Number.isNaN(verifiedTime)) {
      const diffDays = Math.max(0, (referenceTime - verifiedTime) / (1000 * 60 * 60 * 24));
      if (diffDays <= 365) {
        boost += 0.20;
      } else if (diffDays <= 730) {
        boost += 0.10;
      }
    }
  }

  return Number(boost.toFixed(2));
}

// In-memory cache of hybrid index instances keyed by catalog version hash
const indexCache = new Map();

export function getOrBuildHybridIndex(approvedServices) {
  const currentVersion = computeIndexVersion(approvedServices);
  if (indexCache.has(currentVersion)) {
    return { index: indexCache.get(currentVersion), version: currentVersion };
  }

  const index = new HybridIndexStore();
  index.buildIndex(approvedServices);
  indexCache.set(currentVersion, index);
  return { index, version: currentVersion };
}

/**
 * Resets the in-memory cached index (useful for tests and dynamic updates).
 */
export function resetGuidanceIndexCache() {
  indexCache.clear();
}

/**
 * Generates retrieval-augmented civic guidance with claim-level provenance.
 *
 * @param {Object} params
 * @param {string} params.query - Citizen search query
 * @param {string} [params.jurisdictionCode] - Optional ISO state code (e.g. 'IN-MH', 'IN-DL')
 * @param {number|string} [params.referenceTimestamp] - Reference date for rule status
 * @param {Array<Object>} [params.services] - Service catalogue override (defaults to active services)
 * @param {number} [params.topK=4] - Number of top passages to retrieve
 * @param {number} [params.supportThreshold=0.45] - Minimum overlap for claim support
 * @param {number} [params.highRiskSupportThreshold=0.65] - Strict overlap for fee/deadline claims
 * @returns {Promise<Object>} CivicGuidanceResponseV1
 */
export async function generateGuidanceWithProvenance({
  query = '',
  jurisdictionCode = null,
  referenceTimestamp = Date.now(),
  services = null,
  topK = 4,
  supportThreshold = 0.45,
  highRiskSupportThreshold = 0.65,
} = {}) {
  // 1. Boundary Input Validation
  const validation = validateGuidanceRequest({
    query,
    jurisdictionCode,
    referenceTimestamp,
  });

  if (!validation.valid) {
    return {
      version: PROVENANCE_CONTRACT_VERSION,
      guidanceId: `guidance-err-${Date.now()}`,
      status: PROVENANCE_STATUS.ERROR,
      error: validation.error,
      query: String(query || ''),
      sanitizedQuery: validation.sanitizedQuery,
      claims: [],
      unsupportedClaims: [],
      overallGrounded: false,
      confidenceScore: 0,
      officialSources: [],
      disclaimer: MANDATORY_LEGAL_DISCLAIMER,
      timestamp: new Date().toISOString(),
    };
  }

  const cleanQuery = validation.sanitizedQuery;
  const refTime = referenceTimestamp ? new Date(referenceTimestamp).getTime() : Date.now();

  // 2. Fetch and Gate Approved Catalogue Records
  const allAvailable = Array.isArray(services)
    ? services
    : getAllServices({ includeArchived: false });

  // Hard Content Safety Gate: Strictly filter out unapproved, draft, or pending records
  const approvedServices = allAvailable.filter(isApprovedService);

  // 3. Temporal & Jurisdiction Filtering
  const jurisdictionResult = filterVersionedCivicRules({
    rules: approvedServices,
    query: cleanQuery,
    userJurisdiction: jurisdictionCode,
    referenceDate: refTime,
  });

  const targetRules = jurisdictionResult.validRules;
  const indexVersion = computeIndexVersion(targetRules);

  if (targetRules.length === 0) {
    return {
      version: PROVENANCE_CONTRACT_VERSION,
      guidanceId: `guidance-${Date.now()}`,
      status: PROVENANCE_STATUS.UNSUPPORTED,
      query: cleanQuery,
      sanitizedQuery: cleanQuery,
      jurisdiction: {
        requestedCode: jurisdictionCode,
        resolvedLevel: jurisdictionCode ? JURISDICTION_LEVELS.STATE : JURISDICTION_LEVELS.CENTRAL,
        isStateSpecific: !!jurisdictionCode,
        ambiguityNotice: jurisdictionResult.limitationNotice?.message || null,
      },
      summary: 'No verified government catalogue records match this query within the active temporal and jurisdiction rules.',
      claims: [],
      unsupportedClaims: [],
      overallGrounded: false,
      confidenceScore: 0,
      officialSources: [],
      disclaimer: MANDATORY_LEGAL_DISCLAIMER,
      timestamp: new Date().toISOString(),
      indexVersion,
    };
  }

  // 4. Hybrid Dense-Sparse Retrieval with RRF
  const { index } = getOrBuildHybridIndex(targetRules);
  const retrieval = index.retrieve({
    query: cleanQuery,
    services: targetRules,
    topK: Math.max(topK, HYBRID_RETRIEVAL_CONFIG.DEFAULT_TOP_K) * 2,
  });

  const candidates = retrieval.results || [];
  const lowerQuery = cleanQuery.toLowerCase();
  const queryTokens = tokenize(cleanQuery);

  // 5. Freshness, Title Match & Field Intent Re-ranking
  const scoredPassages = candidates.map((item) => {
    const chunk = index.chunks.find((c) => c.chunkId === item.chunkId) || item;
    const freshnessMultiplier = computePassageFreshnessScore(chunk, refTime);

    let intentBoost = 1.0;
    const sTitleLower = (item.serviceTitle || '').toLowerCase();
    const sIdNorm = (item.serviceId || '').replace(/-/g, ' ').toLowerCase();

    // Check if query explicitly mentions the service name/id
    const isServiceMentioned =
      lowerQuery.includes(sTitleLower) ||
      (sIdNorm && lowerQuery.includes(sIdNorm)) ||
      sTitleLower.split(/\s+/).some((w) => w.length > 3 && lowerQuery.includes(w));

    if (isServiceMentioned) {
      intentBoost += 3.0;
    }

    // Contextual section intent boost
    if (
      (lowerQuery.includes('document') || lowerQuery.includes('proof') || lowerQuery.includes('paper')) &&
      (item.field === 'documents' || chunk.field === 'documents')
    ) {
      intentBoost += 2.5;
    }
    if (
      (lowerQuery.includes('fee') || lowerQuery.includes('cost') || lowerQuery.includes('charge') || lowerQuery.includes('payment')) &&
      (item.field === 'fees' || chunk.field === 'fees')
    ) {
      intentBoost += 2.5;
    }
    if (
      (lowerQuery.includes('step') || lowerQuery.includes('process') || lowerQuery.includes('apply') || lowerQuery.includes('procedure') || lowerQuery.includes('how to')) &&
      (item.field === 'process' || chunk.field === 'process')
    ) {
      intentBoost += 2.0;
    }
    if (
      (lowerQuery.includes('eligib') || lowerQuery.includes('criteria') || lowerQuery.includes('who can') || lowerQuery.includes('qualif')) &&
      (item.field === 'eligibility' || chunk.field === 'eligibility')
    ) {
      intentBoost += 2.0;
    }

    const finalScore = Number((item.fusedScore * freshnessMultiplier * intentBoost).toFixed(4));
    return {
      ...item,
      chunk,
      freshnessMultiplier,
      intentBoost,
      finalScore,
    };
  });

  scoredPassages.sort((a, b) => b.finalScore - a.finalScore);
  const topPassages = scoredPassages.slice(0, topK);

  // Token coverage check across all retrieved passages for the candidate service
  const candidatePassages = topPassages.filter(
    (p) => p.serviceId === topPassages[0].serviceId
  );
  const candidateTokenSet = new Set();
  for (const cp of candidatePassages) {
    const chunkTokens =
      cp.chunk?.tokens ||
      tokenize(`${cp.serviceTitle} ${cp.fieldLabel || ''} ${cp.text}`);
    for (const tok of chunkTokens) {
      candidateTokenSet.add(tok);
    }
  }

  const matchedTokensCount = queryTokens.filter((t) => candidateTokenSet.has(t)).length;
  const tokenCoverage = queryTokens.length > 0 ? matchedTokensCount / queryTokens.length : 0;
  const topServiceMentioned =
    topPassages[0] &&
    (lowerQuery.includes(topPassages[0].serviceTitle.toLowerCase()) ||
      (topPassages[0].serviceId &&
        lowerQuery.includes(topPassages[0].serviceId.replace(/-/g, ' ').toLowerCase())) ||
      candidatePassages.some((p) =>
        lowerQuery.includes((p.serviceTitle || '').toLowerCase())
      ));

  // Threshold check: prevent low-relevance hallucination
  const highestScore = topPassages[0]?.finalScore || 0;
  if (
    topPassages.length === 0 ||
    highestScore < 0.015 ||
    (!topServiceMentioned && tokenCoverage < 0.4)
  ) {
    return {
      version: PROVENANCE_CONTRACT_VERSION,
      guidanceId: `guidance-${Date.now()}`,
      status: PROVENANCE_STATUS.UNSUPPORTED,
      query: cleanQuery,
      sanitizedQuery: cleanQuery,
      jurisdiction: {
        requestedCode: jurisdictionCode,
        resolvedLevel: jurisdictionCode ? JURISDICTION_LEVELS.STATE : JURISDICTION_LEVELS.CENTRAL,
        isStateSpecific: !!jurisdictionCode,
        ambiguityNotice: jurisdictionResult.limitationNotice?.message || null,
      },
      summary: `We could not find verified government documentation or official guidelines supporting this request ("${cleanQuery}"). To prevent inaccurate guidance, Civic Help Setu does not generate unverified answers.`,
      claims: [],
      unsupportedClaims: [
        {
          claimId: 'claim-unsupported-1',
          text: cleanQuery,
          status: CLAIM_STATUS.UNKNOWN,
          reason: 'No authoritative passage retrieved above confidence threshold.',
        },
      ],
      overallGrounded: false,
      confidenceScore: 0,
      officialSources: [
        {
          name: 'National Government Services Portal',
          url: 'https://services.india.gov.in',
          verified: true,
          department: 'Government of India',
        },
      ],
      disclaimer: MANDATORY_LEGAL_DISCLAIMER,
      timestamp: new Date().toISOString(),
      indexVersion,
    };
  }

  // 6. Synthesize Authoritative Guidance Text from Top Passages of Primary Service
  const primaryPassage = topPassages[0];
  const matchedService = targetRules.find((s) => s.id === primaryPassage.serviceId) || null;

  const synthesizedSegments = [];
  synthesizedSegments.push(`${primaryPassage.serviceTitle}: ${primaryPassage.text}`);

  for (let i = 1; i < topPassages.length; i++) {
    const p = topPassages[i];
    if (p.serviceId === primaryPassage.serviceId) {
      synthesizedSegments.push(`[${p.fieldLabel || p.field}]: ${p.text}`);
    }
  }

  const synthesizedText = synthesizedSegments.join('\n\n');

  // Normalize passages into evidence units for claim verification
  const evidenceUnits = topPassages
    .filter((p) => p.serviceId === primaryPassage.serviceId)
    .map((p, idx) => {
      const sectionLabel = p.fieldLabel || p.field || '';
      const textWithHeading = sectionLabel ? `[${sectionLabel}]: ${p.text}` : p.text || '';
      return {
        id: p.chunkId || `passage-${idx + 1}`,
        serviceId: p.serviceId,
        serviceTitle: p.serviceTitle,
        title: p.fieldLabel || p.field || 'Official Guideline Section',
        text: textWithHeading,
        rawText: p.text || '',
        officialUrl: p.officialUrl || null,
        department: p.chunk?.department || matchedService?.department || 'Government of India',
        lastVerified: p.chunk?.lastVerified || matchedService?.lastVerified || '2024-01-01',
      };
    });

  // 7. Claim Decomposition & Passage-Level Entailment
  const atomicClaims = decomposeClaims(synthesizedText);
  const verifiedClaims = [];
  const unsupportedClaims = [];

  for (const claim of atomicClaims) {
    const verified = verifyClaim(claim, evidenceUnits, {
      supportThreshold,
      highRiskSupportThreshold,
    });

    let mappedStatus = CLAIM_STATUS.UNKNOWN;
    if (verified.status === ENTAILMENT_STATUS.SUPPORTED) {
      mappedStatus = CLAIM_STATUS.SUPPORTED;
    } else if (verified.status === ENTAILMENT_STATUS.CONTRADICTED) {
      mappedStatus = CLAIM_STATUS.CONTRADICTED;
    }

    // Attach explicit passage-level citations
    const citations = [];
    if (mappedStatus === CLAIM_STATUS.SUPPORTED || mappedStatus === CLAIM_STATUS.CONTRADICTED) {
      for (const chunkId of verified.supportingChunkIds) {
        const ev = evidenceUnits.find((u) => u.id === chunkId);
        if (ev) {
          citations.push({
            chunkId: ev.id,
            serviceId: ev.serviceId,
            serviceName: ev.serviceTitle,
            department: ev.department,
            title: ev.title,
            url: ev.officialUrl,
            passageExcerpt: ev.text.slice(0, 220),
            lastVerified: ev.lastVerified,
          });
        }
      }
    }

    const claimRecord = {
      claimId: claim.id,
      text: claim.text,
      status: mappedStatus,
      riskCategory: claim.riskCategory,
      confidence: verified.confidence,
      citations,
    };

    verifiedClaims.push(claimRecord);

    if (mappedStatus !== CLAIM_STATUS.SUPPORTED) {
      unsupportedClaims.push({
        claimId: claim.id,
        text: claim.text,
        status: mappedStatus,
        reason:
          mappedStatus === CLAIM_STATUS.CONTRADICTED
            ? 'Claim directly conflicts with official statutory documentation.'
            : 'Claim lacks direct clause-level citation in active government records.',
      });
    }
  }

  // 8. Grounding & Uncertainty Assessment
  const supportedCount = verifiedClaims.filter((c) => c.status === CLAIM_STATUS.SUPPORTED).length;
  const hasContradiction = verifiedClaims.some((c) => c.status === CLAIM_STATUS.CONTRADICTED);
  const hasHighRiskUnsupported = verifiedClaims.some(
    (c) =>
      c.status !== CLAIM_STATUS.SUPPORTED &&
      c.riskCategory !== CLAIM_RISK_CATEGORY.GENERAL_FACT
  );

  let overallGrounded =
    supportedCount > 0 &&
    !hasContradiction &&
    !hasHighRiskUnsupported &&
    unsupportedClaims.length <= Math.max(1, Math.floor(verifiedClaims.length * 0.3));

  let finalStatus = PROVENANCE_STATUS.SUCCESS;
  if (!overallGrounded) {
    finalStatus = supportedCount > 0 ? PROVENANCE_STATUS.PARTIALLY_GROUNDED : PROVENANCE_STATUS.UNSUPPORTED;
  }

  // Construct distinct official sources list
  const sourceMap = new Map();
  for (const p of topPassages) {
    if (p.officialUrl && !sourceMap.has(p.officialUrl)) {
      sourceMap.set(p.officialUrl, {
        name: `${p.serviceTitle} Portal`,
        url: p.officialUrl,
        verified: true,
        department: p.chunk?.department || 'Government of India',
        lastVerified: p.chunk?.lastVerified || '2024-01-01',
      });
    }
  }

  // Fail-closed caution notice
  let failClosedNotice = null;
  if (hasContradiction) {
    failClosedNotice =
      'Caution: Portions of this response appear to contradict active statutory documentation. Always follow the official government portal.';
  } else if (hasHighRiskUnsupported) {
    failClosedNotice =
      'Verification Notice: Statutory fees, timelines, or legal penalties in this response could not be corroborated with certainty. Please verify at the official department counter before submission.';
  } else if (jurisdictionResult.limitationNotice) {
    failClosedNotice = jurisdictionResult.limitationNotice.message;
  }

  const confidenceScore = Number(
    Math.min(1.0, Math.max(0.1, (supportedCount / Math.max(1, verifiedClaims.length)) * 0.9 + highestScore * 0.1)).toFixed(2)
  );

  return {
    version: PROVENANCE_CONTRACT_VERSION,
    guidanceId: `guidance-${Date.now()}`,
    status: finalStatus,
    query: cleanQuery,
    sanitizedQuery: cleanQuery,
    jurisdiction: {
      requestedCode: jurisdictionCode,
      resolvedLevel: matchedService?.jurisdictionLevel || JURISDICTION_LEVELS.CENTRAL,
      isStateSpecific: matchedService?.jurisdictionLevel === JURISDICTION_LEVELS.STATE,
      ambiguityNotice: jurisdictionResult.limitationNotice?.message || null,
    },
    summary: primaryPassage.text,
    detailedGuidance: synthesizedText,
    claims: verifiedClaims,
    unsupportedClaims,
    overallGrounded,
    confidenceScore,
    failClosedNotice,
    serviceId: matchedService?.id || primaryPassage.serviceId,
    serviceTitle: matchedService?.name || primaryPassage.serviceTitle,
    officialSources: Array.from(sourceMap.values()),
    retrievedPassages: topPassages.map((p) => ({
      chunkId: p.chunkId,
      serviceId: p.serviceId,
      title: p.fieldLabel || p.field,
      excerpt: p.text,
      score: p.finalScore,
      officialUrl: p.officialUrl,
    })),
    disclaimer: MANDATORY_LEGAL_DISCLAIMER,
    timestamp: new Date().toISOString(),
    indexVersion,
  };
}
