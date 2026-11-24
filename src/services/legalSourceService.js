/**
 * legalSourceService.js
 *
 * Comprehensive versioned legal source review and citation auditing service
 * for CivicBridge workspace templates.
 *
 * Implements:
 * - Version lifecycles: DRAFT, REVIEWED, and SUPERSEDED.
 * - RBAC authorization enforcement via `requirePermission('legalSources.review')`
 *   and `requirePermission('legalSources.manage')`.
 * - Template citation audit engine flagging missing, stale (>365d), and conflicting sources.
 * - Rollback mechanism restoring previous reviewed versions.
 * - Immutable historical citation snapshot preservation for generated citizen drafts.
 * - Official gazette linking and statutory outcome neutrality assurance.
 */

import { requirePermission, actorLabel } from './accessControl.js';
import {
  loadLegalSources,
  saveLegalSources,
  loadDraftSnapshots,
  saveDraftSnapshots,
  appendLegalSourceAuditLog,
  computeLegalSourceDigest,
} from './legalSourceStorage.js';

export const VERSION_STATUSES = {
  DRAFT: 'DRAFT',
  REVIEWED: 'REVIEWED',
  SUPERSEDED: 'SUPERSEDED',
};

export const DEFAULT_STALE_THRESHOLD_DAYS = 365;

export const STATUTORY_DISCLAIMER =
  'STATUTORY CITATION NOTICE: Legal citations in this registry are verified references to official gazettes and statutory enactments. The presence or applicability of a legal citation does not constitute legal advice, guarantee administrative relief, or infer the final outcome of any dispute or tribunal proceeding.';

/**
 * Standard registry of workspace templates and their required statutory citations.
 */
export const TEMPLATE_REGISTRY = {
  rera_homebuyer_dispute: {
    id: 'rera_homebuyer_dispute',
    name: 'RERA Delay Possession & Execution Complaint',
    description: 'Statutory petition before State RERA Authority for possession delay refund (Section 18) and recovery certificate execution (Section 40).',
    jurisdiction: 'National',
    requiredCitationIds: ['src-rera-sec18', 'src-rera-sec40'],
  },
  senior_citizen_maintenance: {
    id: 'senior_citizen_maintenance',
    name: 'Senior Citizen Maintenance & Welfare Tribunal Petition',
    description: 'Maintenance application under Section 4 and property transfer voidance under Section 23 of MWPSC Act 2007.',
    jurisdiction: 'National',
    requiredCitationIds: ['src-mwpsc-sec4', 'src-mwpsc-sec23'],
  },
  street_vendor_tvc_petition: {
    id: 'street_vendor_tvc_petition',
    name: 'Street Vendor TVC & Section 20 Grievance Redressal',
    description: 'Eviction immunity protection (Section 3(3)) and goods seizure reconciliation (Section 19) under Street Vendors Act 2014.',
    jurisdiction: 'National',
    requiredCitationIds: ['src-sv-sec3', 'src-sv-sec19'],
  },
  electricity_cgrf_petition: {
    id: 'electricity_cgrf_petition',
    name: 'Electricity Consumer CGRF & Outage Compensation Petition',
    description: 'Consumer Grievance Redressal Forum petition under Section 42(5) and standard of performance compensation under 2020 Rules.',
    jurisdiction: 'National',
    requiredCitationIds: ['src-elect-sec42', 'src-elect-rules2020'],
  },
  rte_ews_admission_petition: {
    id: 'rte_ews_admission_petition',
    name: 'RTE Section 12(1)(c) Admission Non-Compliance Grievance',
    description: 'Statutory representation for 25% disadvantaged group admission mandate under Right to Education Act 2009.',
    jurisdiction: 'National',
    requiredCitationIds: ['src-rte-sec12'],
  },
  clinical_establishment_grievance: {
    id: 'clinical_establishment_grievance',
    name: 'Clinical Establishment Emergency Care & Overbilling Grievance',
    description: 'Section 56 emergency stabilization non-refusal and standard package rate capping representation.',
    jurisdiction: 'National',
    requiredCitationIds: ['src-clin-sec56'],
  },
  accessibility_commissioner_petition: {
    id: 'accessibility_commissioner_petition',
    name: 'RPwD Commissioner Built Environment Accessibility Petition',
    description: 'Section 20 reasonable accommodation and Section 45 Harmonised Guidelines accessibility enforcement.',
    jurisdiction: 'National',
    requiredCitationIds: ['src-rpwd-sec20'],
  },
  consumer_protection_drip_pricing: {
    id: 'consumer_protection_drip_pricing',
    name: 'CCPA Dark Pattern & Drip Pricing Grievance',
    description: 'Unfair trade practice grievance against covert markups and drip pricing under Section 18 of Consumer Protection Act 2019.',
    jurisdiction: 'National',
    requiredCitationIds: ['src-cpa-dark-patterns'],
  },
  solid_waste_notice: {
    id: 'solid_waste_notice',
    name: 'Solid Waste Management Rule 4 & 22 Compliance Notice',
    description: 'Statutory notice to municipal authority on legacy dump remediation and bulk waste segregation under SWM Rules 2016.',
    jurisdiction: 'National',
    requiredCitationIds: ['src-swm-rules'],
  },
  tree_preservation_notice: {
    id: 'tree_preservation_notice',
    name: 'Tree Officer Felling & Compensatory Afforestation Notice',
    description: 'Notice to Tree Officer under Section 9 of Delhi Preservation of Trees Act 1994.',
    jurisdiction: 'Delhi',
    requiredCitationIds: ['src-delhi-tree-act-stale'],
  },
};

/**
 * Checks if a source's last review date exceeds the staleness threshold.
 *
 * @param {Object} source
 * @param {number} [staleThresholdDays=365]
 * @returns {boolean}
 */
export function isSourceStale(source, staleThresholdDays = DEFAULT_STALE_THRESHOLD_DAYS) {
  if (!source) return false;
  if (!source.reviewedAt) return true; // Never reviewed
  const reviewTime = new Date(source.reviewedAt).getTime();
  if (Number.isNaN(reviewTime)) return true;
  const ageInDays = (Date.now() - reviewTime) / (1000 * 60 * 60 * 24);
  return ageInDays > staleThresholdDays;
}

/**
 * Increments semver version string (patch, minor, major).
 *
 * @param {string} version
 * @param {'patch'|'minor'|'major'} type
 * @returns {string}
 */
export function incrementVersion(version = '1.0.0', type = 'minor') {
  const parts = String(version).split('.').map((p) => parseInt(p, 10) || 0);
  while (parts.length < 3) parts.push(0);

  if (type === 'major') {
    return `${parts[0] + 1}.0.0`;
  }
  if (type === 'minor') {
    return `${parts[0]}.${parts[1] + 1}.0`;
  }
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

/**
 * Lists registered legal sources with flexible filtering.
 *
 * @param {Object} [filter]
 * @param {Storage} [customStorage]
 * @returns {Array<Object>}
 */
export function listLegalSources(filter = {}, customStorage) {
  const sources = loadLegalSources(customStorage);
  const {
    templateId,
    status,
    jurisdiction,
    search,
    isStale: filterStale,
    staleThresholdDays = DEFAULT_STALE_THRESHOLD_DAYS,
  } = filter;

  return sources.filter((src) => {
    if (status && status !== 'ALL' && src.status !== status) return false;
    if (templateId && !src.applicableTemplates?.includes(templateId)) return false;
    if (jurisdiction && jurisdiction !== 'ALL' && src.jurisdiction !== jurisdiction && src.jurisdiction !== 'National') return false;
    if (filterStale === true && !isSourceStale(src, staleThresholdDays)) return false;
    if (filterStale === false && isSourceStale(src, staleThresholdDays)) return false;

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      const matchTitle = (src.title || '').toLowerCase().includes(q);
      const matchAct = (src.actName || '').toLowerCase().includes(q);
      const matchProv = (src.provision || '').toLowerCase().includes(q);
      const matchSummary = (src.summary || '').toLowerCase().includes(q);
      const matchFullText = (src.fullText || '').toLowerCase().includes(q);
      if (!matchTitle && !matchAct && !matchProv && !matchSummary && !matchFullText) return false;
    }

    return true;
  });
}

/**
 * Retrieves a single legal source by ID.
 *
 * @param {string} sourceId
 * @param {Storage} [customStorage]
 * @returns {Object|null}
 */
export function getLegalSourceById(sourceId, customStorage) {
  const sources = loadLegalSources(customStorage);
  return sources.find((s) => s.id === sourceId) || null;
}

/**
 * Creates a new legal source draft.
 * Requires permission 'legalSources.manage'.
 *
 * @param {Object} sourceData
 * @param {Storage} [customStorage]
 * @returns {Promise<Object>} Created draft source
 */
export function createDraftSource(sourceData, customStorage) {
  requirePermission('legalSources.manage');

  return (async () => {
    if (!sourceData || typeof sourceData !== 'object') {
      throw new Error('Invalid source data: payload object required.');
    }

    const {
      title,
      actName,
      provision,
      jurisdiction = 'National',
      applicableTemplates = [],
      officialUrl = '',
      summary = '',
      fullText = '',
      initialVersion = '0.1.0',
    } = sourceData;

    if (!title || !actName || !provision) {
      throw new Error('Title, Act Name, and Statutory Provision are mandatory.');
    }

    const sources = loadLegalSources(customStorage);
    const sourceId = sourceData.id || `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    if (sources.some((s) => s.id === sourceId)) {
      throw new Error(`A source with ID '${sourceId}' already exists.`);
    }

    const now = new Date().toISOString();
    const newSource = {
      id: sourceId,
      title: title.trim(),
      actName: actName.trim(),
      provision: provision.trim(),
      jurisdiction: jurisdiction.trim(),
      applicableTemplates: Array.isArray(applicableTemplates) ? applicableTemplates : [applicableTemplates],
      officialUrl: officialUrl.trim(),
      summary: summary.trim(),
      fullText: fullText.trim(),
      currentVersion: initialVersion,
      status: VERSION_STATUSES.DRAFT,
      reviewedAt: null,
      reviewedBy: null,
      reviewerNotes: null,
      supersededBy: null,
      supersedes: null,
      supersededReason: null,
      versionHistory: [],
      createdAt: now,
      updatedAt: now,
    };

    newSource.digest = await computeLegalSourceDigest(newSource);
    sources.unshift(newSource);
    saveLegalSources(sources, customStorage);

    appendLegalSourceAuditLog(
      {
        action: 'CREATE_DRAFT',
        sourceId: newSource.id,
        version: newSource.currentVersion,
        actor: actorLabel('System Admin'),
        details: `Created draft legal source '${newSource.title}'`,
      },
      customStorage
    );

    return newSource;
  })();
}

/**
 * Updates an existing draft legal source.
 * Requires permission 'legalSources.manage'.
 *
 * @param {string} sourceId
 * @param {Object} updates
 * @param {Storage} [customStorage]
 * @returns {Promise<Object>} Updated draft
 */
export function updateDraftSource(sourceId, updates = {}, customStorage) {
  requirePermission('legalSources.manage');

  return (async () => {
    const sources = loadLegalSources(customStorage);
    const index = sources.findIndex((s) => s.id === sourceId);
    if (index === -1) {
      throw new Error(`Source with ID '${sourceId}' not found.`);
    }

    const existing = sources[index];
    const updated = {
      ...existing,
      ...updates,
      id: existing.id, // Immutable ID
      updatedAt: new Date().toISOString(),
    };

    updated.digest = await computeLegalSourceDigest(updated);
    sources[index] = updated;
    saveLegalSources(sources, customStorage);

    appendLegalSourceAuditLog(
      {
        action: 'UPDATE_DRAFT',
        sourceId,
        version: updated.currentVersion,
        actor: actorLabel('System Admin'),
        details: `Updated draft attributes for '${updated.title}'`,
      },
      customStorage
    );

    return updated;
  })();
}

/**
 * Reviews and publishes a legal source version.
 * Requires permission 'legalSources.review' (Authorized reviewer).
 *
 * @param {string} sourceId
 * @param {Object} reviewData
 * @param {Storage} [customStorage]
 * @returns {Promise<Object>} Published source
 */
export function reviewAndPublishSource(sourceId, reviewData = {}, customStorage) {
  requirePermission('legalSources.review');

  return (async () => {
    const sources = loadLegalSources(customStorage);
    const index = sources.findIndex((s) => s.id === sourceId);
    if (index === -1) {
      throw new Error(`Source with ID '${sourceId}' not found.`);
    }

    const existing = sources[index];
    const now = new Date().toISOString();
    const reviewer = actorLabel('Authorized Reviewer');
    const reviewerNotes = reviewData.reviewerNotes || 'Statutory alignment and official source citation verified.';

    // Determine next version
    let nextVersion = reviewData.nextVersion;
    if (!nextVersion) {
      if (existing.status === VERSION_STATUSES.DRAFT) {
        nextVersion = existing.currentVersion === '0.1.0' ? '1.0.0' : existing.currentVersion;
      } else {
        nextVersion = incrementVersion(existing.currentVersion, 'minor');
      }
    }

    // Preserve previous revision in version history
    const historicalRevision = {
      version: existing.currentVersion,
      status: existing.status,
      summary: existing.summary,
      fullText: existing.fullText,
      officialUrl: existing.officialUrl,
      reviewedAt: existing.reviewedAt,
      reviewedBy: existing.reviewedBy,
      reviewerNotes: existing.reviewerNotes,
      archivedAt: now,
    };

    const updatedHistory = existing.versionHistory ? [...existing.versionHistory] : [];
    if (existing.reviewedAt) {
      updatedHistory.unshift(historicalRevision);
    }

    const updated = {
      ...existing,
      ...(reviewData.summary ? { summary: reviewData.summary } : {}),
      ...(reviewData.fullText ? { fullText: reviewData.fullText } : {}),
      ...(reviewData.officialUrl ? { officialUrl: reviewData.officialUrl } : {}),
      currentVersion: nextVersion,
      status: VERSION_STATUSES.REVIEWED,
      reviewedAt: now,
      reviewedBy: reviewer,
      reviewerNotes,
      supersededBy: null,
      supersededReason: null,
      versionHistory: updatedHistory,
      updatedAt: now,
    };

    updated.digest = await computeLegalSourceDigest(updated);
    sources[index] = updated;
    saveLegalSources(sources, customStorage);

    appendLegalSourceAuditLog(
      {
        action: 'REVIEW_AND_PUBLISH',
        sourceId,
        version: updated.currentVersion,
        actor: reviewer,
        details: `Published version ${updated.currentVersion} for '${updated.title}' (${reviewerNotes})`,
      },
      customStorage
    );

    return updated;
  })();
}

/**
 * Supersedes a legal source, linking it to its modern replacement provision.
 * Requires permission 'legalSources.review'.
 *
 * @param {string} sourceId
 * @param {Object} options
 * @param {Storage} [customStorage]
 * @returns {Promise<Object>} Superseded source
 */
export function supersedeSource(sourceId, options = {}, customStorage) {
  requirePermission('legalSources.review');

  return (async () => {
    const sources = loadLegalSources(customStorage);
    const index = sources.findIndex((s) => s.id === sourceId);
    if (index === -1) {
      throw new Error(`Source with ID '${sourceId}' not found.`);
    }

    const existing = sources[index];
    const now = new Date().toISOString();
    const reviewer = actorLabel('Authorized Reviewer');
    const { replacementSourceId = null, supersededReason = 'Statutory provision amended or repealed by later enactment.' } = options;

    if (replacementSourceId) {
      const replacementExists = sources.some((s) => s.id === replacementSourceId);
      if (!replacementExists) {
        throw new Error(`Replacement source ID '${replacementSourceId}' does not exist.`);
      }
    }

    const historicalRevision = {
      version: existing.currentVersion,
      status: existing.status,
      summary: existing.summary,
      fullText: existing.fullText,
      officialUrl: existing.officialUrl,
      reviewedAt: existing.reviewedAt,
      reviewedBy: existing.reviewedBy,
      reviewerNotes: existing.reviewerNotes,
      archivedAt: now,
    };

    const updatedHistory = existing.versionHistory ? [...existing.versionHistory] : [];
    updatedHistory.unshift(historicalRevision);

    const updated = {
      ...existing,
      status: VERSION_STATUSES.SUPERSEDED,
      supersededBy: replacementSourceId,
      supersededReason,
      versionHistory: updatedHistory,
      updatedAt: now,
    };

    updated.digest = await computeLegalSourceDigest(updated);
    sources[index] = updated;
    saveLegalSources(sources, customStorage);

    appendLegalSourceAuditLog(
      {
        action: 'SUPERSEDE',
        sourceId,
        version: updated.currentVersion,
        actor: reviewer,
        details: `Marked '${updated.title}' as SUPERSEDED. Replacement: ${replacementSourceId || 'None'}. Reason: ${supersededReason}`,
      },
      customStorage
    );

    return updated;
  })();
}

/**
 * Rolls back a legal source to a previously reviewed version revision.
 * Requires permission 'legalSources.review'.
 *
 * @param {string} sourceId
 * @param {string} targetVersionNumber
 * @param {Object} [options]
 * @param {Storage} [customStorage]
 * @returns {Promise<Object>} Restored source
 */
export function rollbackSourceVersion(sourceId, targetVersionNumber, options = {}, customStorage) {
  requirePermission('legalSources.review');

  return (async () => {
    const sources = loadLegalSources(customStorage);
    const index = sources.findIndex((s) => s.id === sourceId);
    if (index === -1) {
      throw new Error(`Source with ID '${sourceId}' not found.`);
    }

    const existing = sources[index];
    const targetRevision = (existing.versionHistory || []).find((h) => h.version === targetVersionNumber);

    if (!targetRevision) {
      throw new Error(`Version '${targetVersionNumber}' not found in revision history for '${existing.title}'.`);
    }

    const now = new Date().toISOString();
    const reviewer = actorLabel('Authorized Reviewer');
    const rollbackReason = options.rollbackReason || `Rolled back to revision ${targetVersionNumber}`;

    // Archive current active state
    const archiveCurrent = {
      version: existing.currentVersion,
      status: existing.status,
      summary: existing.summary,
      fullText: existing.fullText,
      officialUrl: existing.officialUrl,
      reviewedAt: existing.reviewedAt,
      reviewedBy: existing.reviewedBy,
      reviewerNotes: existing.reviewerNotes,
      archivedAt: now,
    };

    const updatedHistory = [archiveCurrent, ...existing.versionHistory.filter((h) => h.version !== targetVersionNumber)];
    const nextPatchVersion = incrementVersion(existing.currentVersion, 'patch');

    const restored = {
      ...existing,
      summary: targetRevision.summary || existing.summary,
      fullText: targetRevision.fullText || existing.fullText,
      officialUrl: targetRevision.officialUrl || existing.officialUrl,
      currentVersion: nextPatchVersion,
      status: VERSION_STATUSES.REVIEWED,
      reviewedAt: now,
      reviewedBy: reviewer,
      reviewerNotes: `Restored from historical revision ${targetVersionNumber}. Reason: ${rollbackReason}`,
      supersededBy: null,
      supersededReason: null,
      versionHistory: updatedHistory,
      updatedAt: now,
    };

    restored.digest = await computeLegalSourceDigest(restored);
    sources[index] = restored;
    saveLegalSources(sources, customStorage);

    appendLegalSourceAuditLog(
      {
        action: 'ROLLBACK_VERSION',
        sourceId,
        version: restored.currentVersion,
        actor: reviewer,
        details: `Rolled back '${restored.title}' from ${existing.currentVersion} to content of ${targetVersionNumber} as new version ${restored.currentVersion}`,
      },
      customStorage
    );

    return restored;
  })();
}

/**
 * Audits template citations against registered legal sources.
 * Flags missing, stale (>365d), superseded, unreviewed, or conflicting jurisdiction citations.
 *
 * @param {string} templateId
 * @param {Object} [options]
 * @param {Storage} [customStorage]
 * @returns {Object} Audit report
 */
export function auditTemplateCitations(templateId, options = {}, customStorage) {
  const template = TEMPLATE_REGISTRY[templateId];
  const templateName = template?.name || templateId;
  const targetJurisdiction = options.userJurisdiction || template?.jurisdiction || 'National';
  const staleThresholdDays = options.staleThresholdDays || DEFAULT_STALE_THRESHOLD_DAYS;

  // Citations to check: either provided explicitly or template defaults
  const citationIds = options.citedSourceIds || template?.requiredCitationIds || [];
  const sources = loadLegalSources(customStorage);

  const issues = [];
  let missingCount = 0;
  let staleCount = 0;
  let supersededCount = 0;
  let conflictCount = 0;
  let draftCount = 0;

  citationIds.forEach((srcId) => {
    const src = sources.find((s) => s.id === srcId);

    if (!src) {
      missingCount += 1;
      issues.push({
        type: 'MISSING',
        severity: 'CRITICAL',
        sourceId: srcId,
        message: `Required citation '${srcId}' is completely missing from the legal source registry.`,
        recommendation: 'Register and review this statutory provision before citizen draft generation.',
      });
      return;
    }

    // Check Draft status
    if (src.status === VERSION_STATUSES.DRAFT) {
      draftCount += 1;
      issues.push({
        type: 'UNREVIEWED_DRAFT',
        severity: 'HIGH',
        sourceId: srcId,
        title: src.title,
        version: src.currentVersion,
        message: `Citation '${src.title}' is currently an unreviewed DRAFT (v${src.currentVersion}).`,
        recommendation: 'An authorized legal reviewer must verify and publish this source before citizen export.',
      });
    }

    // Check Superseded status
    if (src.status === VERSION_STATUSES.SUPERSEDED) {
      supersededCount += 1;
      issues.push({
        type: 'SUPERSEDED',
        severity: 'CRITICAL',
        sourceId: srcId,
        title: src.title,
        supersededBy: src.supersededBy,
        supersededReason: src.supersededReason,
        message: `Citation '${src.title}' has been superseded. ${src.supersededReason || ''}`,
        recommendation: src.supersededBy
          ? `Migrate template reference to modern provision '${src.supersededBy}'.`
          : 'Update template citation to current statutory enactment.',
      });
    }

    // Check Staleness
    if (src.status === VERSION_STATUSES.REVIEWED && isSourceStale(src, staleThresholdDays)) {
      staleCount += 1;
      const daysSinceReview = src.reviewedAt
        ? Math.floor((Date.now() - new Date(src.reviewedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 'Unknown';
      issues.push({
        type: 'STALE',
        severity: 'WARNING',
        sourceId: srcId,
        title: src.title,
        reviewedAt: src.reviewedAt,
        daysSinceReview,
        message: `Citation '${src.title}' was last reviewed ${daysSinceReview} days ago (exceeds ${staleThresholdDays}-day threshold).`,
        recommendation: 'Perform scheduled statutory review to verify no amendments or high court precedents have occurred.',
      });
    }

    // Check Jurisdiction Conflicts
    if (
      src.jurisdiction &&
      src.jurisdiction !== 'National' &&
      targetJurisdiction !== 'National' &&
      src.jurisdiction.toLowerCase() !== targetJurisdiction.toLowerCase()
    ) {
      conflictCount += 1;
      issues.push({
        type: 'JURISDICTION_CONFLICT',
        severity: 'HIGH',
        sourceId: srcId,
        title: src.title,
        sourceJurisdiction: src.jurisdiction,
        userJurisdiction: targetJurisdiction,
        message: `Citation '${src.title}' applies specifically to ${src.jurisdiction}, conflicting with user circumstance jurisdiction (${targetJurisdiction}).`,
        recommendation: `Switch to ${targetJurisdiction} state rules or National benchmark provision.`,
      });
    }
  });

  const totalChecked = citationIds.length;
  // Calculate health score: 100 base, deductions for critical/high/warning
  let score = 100;
  score -= missingCount * 35;
  score -= supersededCount * 30;
  score -= draftCount * 20;
  score -= conflictCount * 20;
  score -= staleCount * 10;
  score = Math.max(0, Math.min(100, score));

  return {
    templateId,
    templateName,
    targetJurisdiction,
    healthScore: score,
    isValid: missingCount === 0 && supersededCount === 0 && draftCount === 0 && conflictCount === 0,
    hasWarnings: staleCount > 0,
    issues,
    summary: {
      totalChecked,
      missingCount,
      staleCount,
      supersededCount,
      conflictCount,
      draftCount,
    },
    recommendations: issues.map((i) => i.recommendation),
    auditedAt: new Date().toISOString(),
  };
}

/**
 * Binds an immutable snapshot of legal citations at the moment a citizen draft is generated.
 * Ensures previously generated citizen drafts retain historical accuracy even if laws are amended later.
 *
 * @param {string} draftId
 * @param {string} templateId
 * @param {Object} [metadata]
 * @param {Storage} [customStorage]
 * @returns {Promise<Object>} Sealed draft snapshot
 */
export async function bindHistoricalSourcesSnapshot(draftId, templateId, metadata = {}, customStorage) {
  const template = TEMPLATE_REGISTRY[templateId];
  const citationIds = metadata.citedSourceIds || template?.requiredCitationIds || [];
  const sources = loadLegalSources(customStorage);

  const boundSources = citationIds.map((id) => {
    const s = sources.find((src) => src.id === id);
    if (!s) {
      return { id, isMissing: true, boundAt: new Date().toISOString() };
    }
    return {
      id: s.id,
      title: s.title,
      actName: s.actName,
      provision: s.provision,
      jurisdiction: s.jurisdiction,
      version: s.currentVersion,
      status: s.status,
      summary: s.summary,
      fullText: s.fullText,
      officialUrl: s.officialUrl,
      reviewedAt: s.reviewedAt,
      reviewedBy: s.reviewedBy,
      digest: s.digest,
    };
  });

  const snapshot = {
    draftId,
    templateId,
    templateName: template?.name || templateId,
    boundAt: new Date().toISOString(),
    userJurisdiction: metadata.userJurisdiction || 'National',
    sources: boundSources,
    disclaimer: STATUTORY_DISCLAIMER,
  };

  const snapshots = loadDraftSnapshots(customStorage);
  // Replace if existing for same draftId or prepend
  const filtered = snapshots.filter((s) => s.draftId !== draftId);
  filtered.unshift(snapshot);
  saveDraftSnapshots(filtered, customStorage);

  return snapshot;
}

/**
 * Retrieves a historical draft citation snapshot and checks for any subsequent statutory changes.
 *
 * @param {string} draftId
 * @param {Storage} [customStorage]
 * @returns {Object|null}
 */
export function getHistoricalDraftSnapshot(draftId, customStorage) {
  const snapshots = loadDraftSnapshots(customStorage);
  const snapshot = snapshots.find((s) => s.draftId === draftId);
  if (!snapshot) return null;

  const currentSources = loadLegalSources(customStorage);
  const evolutionNotices = [];

  snapshot.sources.forEach((historicalSrc) => {
    if (historicalSrc.isMissing) return;
    const current = currentSources.find((s) => s.id === historicalSrc.id);
    if (!current) {
      evolutionNotices.push({
        sourceId: historicalSrc.id,
        title: historicalSrc.title,
        type: 'REMOVED_IN_REGISTRY',
        notice: `Citation '${historicalSrc.title}' was retained in your draft (v${historicalSrc.version}) but has since been archived in the registry.`,
      });
      return;
    }

    if (current.status === VERSION_STATUSES.SUPERSEDED) {
      evolutionNotices.push({
        sourceId: historicalSrc.id,
        title: historicalSrc.title,
        type: 'SUBSEQUENTLY_SUPERSEDED',
        historicalVersion: historicalSrc.version,
        notice: `Provision cited as v${historicalSrc.version} has since been SUPERSEDED by newer enactment (${current.supersededBy || 'amended law'}). Your draft preserves the statutory text effective at the time of creation.`,
      });
    } else if (current.currentVersion !== historicalSrc.version) {
      evolutionNotices.push({
        sourceId: historicalSrc.id,
        title: historicalSrc.title,
        type: 'VERSION_UPDATED',
        historicalVersion: historicalSrc.version,
        currentVersion: current.currentVersion,
        notice: `Citation updated in registry to v${current.currentVersion}. Your draft remains historically anchored to v${historicalSrc.version}.`,
      });
    }
  });

  return {
    ...snapshot,
    evolutionNotices,
    isHistoricallyConsistent: true,
  };
}

/**
 * Asserts statutory outcome neutrality: ensures citations and summaries
 * never claim guaranteed results, victory, or definitive judicial outcomes.
 *
 * @param {string} text
 * @returns {{ isNeutral: boolean, disallowedTerms: string[] }}
 */
export function verifyOutcomeNeutrality(text = '') {
  const disallowedRegexes = [
    /\bguarantee[ds]?\s+refund\b/i,
    /\bguaranteed\s+compensation\b/i,
    /\bguaranteed\s+relief\b/i,
    /\bwill\s+win\b/i,
    /\bcertain\s+to\s+succeed\b/i,
    /\bassured\s+verdict\b/i,
    /\btribunal\s+will\s+rule\s+in\s+favor\b/i,
  ];

  const disallowedTerms = [];
  disallowedRegexes.forEach((regex) => {
    const match = text.match(regex);
    if (match) {
      disallowedTerms.push(match[0]);
    }
  });

  return {
    isNeutral: disallowedTerms.length === 0,
    disallowedTerms,
  };
}
