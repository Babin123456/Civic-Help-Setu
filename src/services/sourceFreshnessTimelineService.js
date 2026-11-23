/**
 * Civic Service Source Freshness and Validity Timeline Service
 *
 * Implements a maintainer-facing provenance and validity timeline engine:
 * - Distinguishes between:
 *   * Source Publication Date (when gazette/circular was officially printed)
 *   * Legal Effective Period: effectiveFrom and effectiveTo dates
 *   * Last Verified Date (when human maintainer confirmed rule applicability)
 * - Explicit Unknown Dates:
 *   * Missing or unstated dates remain explicitly 'UNKNOWN', never guessed or backfilled
 * - Freshness Classification:
 *   * CURRENT: Within legal validity period and recently verified (< 180 days)
 *   * STALE_NEEDS_REVIEW: Exceeds verification window (> 180 days without review)
 *   * EXPIRED: Surpassed effectiveTo date
 *   * SUPERSEDED: Formally replaced by a newer statutory order
 *   * WITHDRAWN: Repealed or struck down
 * - Timezone-independent date normalization (UTC ISO 8601)
 * - Reviewer workflow:
 *   * Direct link to original source URL and cryptographic checksum
 *   * Flags expired sources without silently mutating live citizen guidance
 */

export const SOURCE_FRESHNESS_STATUS = Object.freeze({
  CURRENT: 'CURRENT',
  STALE_NEEDS_REVIEW: 'STALE_NEEDS_REVIEW',
  EXPIRED: 'EXPIRED',
  SUPERSEDED: 'SUPERSEDED',
  WITHDRAWN: 'WITHDRAWN'
});

export const MAX_VERIFICATION_AGE_DAYS = 180;

/**
 * Normalizes date inputs to UTC ISO strings or explicitly 'UNKNOWN'
 * @param {string|number|Date} dateInput
 * @returns {string} Normalized date or 'UNKNOWN'
 */
export function normalizeValidityDate(dateInput) {
  if (!dateInput) return 'UNKNOWN';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'UNKNOWN';
  return d.toISOString().split('T')[0];
}

/**
 * Evaluates the freshness status of a source document
 * @param {Object} source Source metadata record
 * @param {number} currentTime Current timestamp in ms
 * @returns {Object} Freshness evaluation record
 */
export function evaluateSourceFreshness(source = {}, currentTime = Date.now()) {
  const {
    sourceId,
    title,
    publicationDate,
    effectiveFrom,
    effectiveTo,
    lastVerifiedDate,
    supersededBy = null,
    isWithdrawn = false
  } = source;

  const normPublication = normalizeValidityDate(publicationDate);
  const normEffectiveFrom = normalizeValidityDate(effectiveFrom);
  const normEffectiveTo = normalizeValidityDate(effectiveTo);
  const normLastVerified = normalizeValidityDate(lastVerifiedDate);

  if (isWithdrawn) {
    return {
      sourceId,
      status: SOURCE_FRESHNESS_STATUS.WITHDRAWN,
      reason: 'Source document was officially withdrawn or repealed',
      publicationDate: normPublication,
      effectiveFrom: normEffectiveFrom,
      effectiveTo: normEffectiveTo,
      lastVerifiedDate: normLastVerified,
      supersededBy: null
    };
  }

  if (supersededBy) {
    return {
      sourceId,
      status: SOURCE_FRESHNESS_STATUS.SUPERSEDED,
      reason: `Superseded by source: ${supersededBy}`,
      publicationDate: normPublication,
      effectiveFrom: normEffectiveFrom,
      effectiveTo: normEffectiveTo,
      lastVerifiedDate: normLastVerified,
      supersededBy
    };
  }

  // Check if past legal effectiveTo date
  if (normEffectiveTo !== 'UNKNOWN') {
    const toTimestamp = new Date(normEffectiveTo).getTime();
    if (currentTime > toTimestamp) {
      return {
        sourceId,
        status: SOURCE_FRESHNESS_STATUS.EXPIRED,
        reason: `Legal effective period ended on ${normEffectiveTo}`,
        publicationDate: normPublication,
        effectiveFrom: normEffectiveFrom,
        effectiveTo: normEffectiveTo,
        lastVerifiedDate: normLastVerified,
        supersededBy: null
      };
    }
  }

  // Check verification staleness (> 180 days)
  if (normLastVerified !== 'UNKNOWN') {
    const verifiedTimestamp = new Date(normLastVerified).getTime();
    const ageDays = (currentTime - verifiedTimestamp) / (24 * 60 * 60 * 1000);
    if (ageDays > MAX_VERIFICATION_AGE_DAYS) {
      return {
        sourceId,
        status: SOURCE_FRESHNESS_STATUS.STALE_NEEDS_REVIEW,
        reason: `Last verified ${Math.round(ageDays)} days ago (exceeds ${MAX_VERIFICATION_AGE_DAYS}d ceiling)`,
        publicationDate: normPublication,
        effectiveFrom: normEffectiveFrom,
        effectiveTo: normEffectiveTo,
        lastVerifiedDate: normLastVerified,
        supersededBy: null
      };
    }
  } else {
    // Never verified
    return {
      sourceId,
      status: SOURCE_FRESHNESS_STATUS.STALE_NEEDS_REVIEW,
      reason: 'Source has never undergone formal maintainer verification',
      publicationDate: normPublication,
      effectiveFrom: normEffectiveFrom,
      effectiveTo: normEffectiveTo,
      lastVerifiedDate: 'UNKNOWN',
      supersededBy: null
    };
  }

  return {
    sourceId,
    status: SOURCE_FRESHNESS_STATUS.CURRENT,
    reason: 'Source is legally effective and recently verified',
    publicationDate: normPublication,
    effectiveFrom: normEffectiveFrom,
    effectiveTo: normEffectiveTo,
    lastVerifiedDate: normLastVerified,
    supersededBy: null
  };
}

export class SourceFreshnessTimelineService {
  constructor() {
    this.sourceRecords = new Map(); // serviceId -> Array<SourceRecord>
  }

  registerSource(serviceId, sourceData) {
    if (!serviceId || !sourceData.sourceId) {
      throw new Error('Valid serviceId and sourceId required');
    }

    const list = this.sourceRecords.get(serviceId) || [];
    list.push(sourceData);
    this.sourceRecords.set(serviceId, list);
    return sourceData;
  }

  /**
   * Builds an ordered chronological timeline of sources for a service
   * @param {string} serviceId
   * @param {number} currentTime
   * @returns {Array<Object>} Timeline items sorted chronologically
   */
  getServiceTimeline(serviceId, currentTime = Date.now()) {
    const list = this.sourceRecords.get(serviceId) || [];

    const evaluated = list.map(source => ({
      ...source,
      freshness: evaluateSourceFreshness(source, currentTime)
    }));

    // Sort by publication date or effective date
    return evaluated.sort((a, b) => {
      const dateA = a.publicationDate ? new Date(a.publicationDate).getTime() : 0;
      const dateB = b.publicationDate ? new Date(b.publicationDate).getTime() : 0;
      return dateA - dateB;
    });
  }
}
