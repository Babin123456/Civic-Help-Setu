/**
 * Citizen Consent Purpose Visualizer for Connected Civic Data Service
 *
 * Implements an interactive data-flow visualizer, consent purpose lifecycle manager,
 * and auditable revocation engine under the Digital Personal Data Protection Act (DPDP 2023):
 *
 * 1. Purpose-Specific Consent Catalog & Granular Scopes:
 *    - Models explicit civic purposes (SERVICE_ELIGIBILITY_MATCHING, OFFICE_VISIT_PREPARATION,
 *      DOCUMENT_OCR_PRE_SCRUTINY, STATUTORY_NOTICES_SMS_ALERTS, ANONYMOUS_COMMUNITY_ANALYTICS).
 *    - Binds each purpose to explicit requested field scopes, lawful basis (DPDP Sec 6),
 *      designated processors, and enforceable retention periods.
 *
 * 2. Strict Downstream Access Enforcement:
 *    - Enforces zero-processing of optional civic data before explicit citizen grant.
 *    - verifyDownstreamProcessingAllowed() gates all downstream feature invocations.
 *
 * 3. Auditable Revocation & Cascade Restriction Workflow:
 *    - Supports instant consent withdrawal with auditable justification logging.
 *    - Generates actionable downstream restriction and purging directives upon revocation.
 *
 * 4. Interactive Data-Flow Graph Model:
 *    - Produces a directed visualizer graph mapping Citizen Data Nodes -> Purpose Nodes
 *      -> Processor Nodes -> Retention State Nodes.
 *
 * 5. Multi-Modal Accessibility:
 *    - Provides a full tabular and text-based alternative for screen readers and keyboard navigation.
 *
 * 6. Privacy & PII Protection:
 *    - Enforces least-privilege scoping; scrubs direct citizen identifiers in audit exports.
 *    - Distinguishes saved user progress from official government application status.
 */

export const CONSENT_STATUS = {
  GRANTED: 'GRANTED',
  DENIED: 'DENIED',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
  UNSPECIFIED: 'UNSPECIFIED',
};

export const CONSENT_PURPOSE_KEY = {
  SERVICE_ELIGIBILITY_MATCHING: 'SERVICE_ELIGIBILITY_MATCHING',
  OFFICE_VISIT_PREPARATION: 'OFFICE_VISIT_PREPARATION',
  DOCUMENT_OCR_PRE_SCRUTINY: 'DOCUMENT_OCR_PRE_SCRUTINY',
  STATUTORY_NOTICES_SMS_ALERTS: 'STATUTORY_NOTICES_SMS_ALERTS',
  ANONYMOUS_COMMUNITY_ANALYTICS: 'ANONYMOUS_COMMUNITY_ANALYTICS',
};

export const LAWFUL_BASIS_TIER = {
  CONSENT_EXPLICIT_DPDP_SEC_6: 'CONSENT_EXPLICIT_DPDP_SEC_6',
  STATUTORY_SERVICE_FULFILLMENT: 'STATUTORY_SERVICE_FULFILLMENT',
  LEGITIMATE_OPERATIONAL_PURPOSE: 'LEGITIMATE_OPERATIONAL_PURPOSE',
};

export const DATA_PROCESSOR_ENTITY = {
  LOCAL_BROWSER_ENGINE: 'LOCAL_BROWSER_ENGINE',
  LOCAL_ENCRYPTED_VAULT: 'LOCAL_ENCRYPTED_VAULT',
  CLIENT_SIDE_WEBCRYPTO_WORKER: 'CLIENT_SIDE_WEBCRYPTO_WORKER',
  TRAI_COMPLIANT_TELECOM_GATEWAY: 'TRAI_COMPLIANT_TELECOM_GATEWAY',
  INTERNAL_METRICS_AGGREGATOR: 'INTERNAL_METRICS_AGGREGATOR',
};

export const RETENTION_POLICY_TIER = {
  SESSION_ONLY_EPHEMERAL: 'SESSION_ONLY_EPHEMERAL',
  DAYS_30_POST_VISIT: 'DAYS_30_POST_VISIT',
  PURGED_IMMEDIATELY_AFTER_PARSING: 'PURGED_IMMEDIATELY_AFTER_PARSING',
  DURATION_OF_TRACKED_APPLICATION: 'DURATION_OF_TRACKED_APPLICATION',
  DAYS_90_AGGREGATE: 'DAYS_90_AGGREGATE',
};

export const CONSENT_VIEW_STATE = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  EMPTY: 'EMPTY',
  ERROR: 'ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  STALE_DATA_WARNING: 'STALE_DATA_WARNING',
  READY: 'READY',
};

export const STATUTORY_DPDP_CONSENT_NOTICE =
  'Statutory Notice under Digital Personal Data Protection Act, 2023 (Section 6): Civic Help Setu processes personal data strictly for specified civic facilitation purposes. You may grant or decline optional purposes and withdraw consent at any time. Withdrawal terminates downstream processing without affecting prior lawful processing.';

/**
 * Authoritative registered consent purpose catalog.
 */
export const REGISTERED_CONSENT_PURPOSES = {
  [CONSENT_PURPOSE_KEY.SERVICE_ELIGIBILITY_MATCHING]: {
    purposeId: CONSENT_PURPOSE_KEY.SERVICE_ELIGIBILITY_MATCHING,
    title: 'Civic Scheme & Benefit Eligibility Assessment',
    plainLanguageSummary: 'Assesses whether citizen age, district, and income tier qualify for state and central civic schemes.',
    lawfulBasis: LAWFUL_BASIS_TIER.CONSENT_EXPLICIT_DPDP_SEC_6,
    requestedFieldScopes: ['age', 'districtName', 'annualIncomeCategory', 'socialCategory'],
    designatedProcessor: DATA_PROCESSOR_ENTITY.LOCAL_BROWSER_ENGINE,
    retentionPolicy: RETENTION_POLICY_TIER.SESSION_ONLY_EPHEMERAL,
    retentionDays: 0,
    isOptional: true,
    defaultGranted: false,
    version: '1.0.0',
  },
  [CONSENT_PURPOSE_KEY.OFFICE_VISIT_PREPARATION]: {
    purposeId: CONSENT_PURPOSE_KEY.OFFICE_VISIT_PREPARATION,
    title: 'Facilitation Counter Packing List & Calendar Sync',
    plainLanguageSummary: 'Organizes required physical photocopies and creates calendar reminder events for government office visits.',
    lawfulBasis: LAWFUL_BASIS_TIER.CONSENT_EXPLICIT_DPDP_SEC_6,
    requestedFieldScopes: ['appointmentDateTime', 'governmentOfficeName', 'requiredDocumentTypes'],
    designatedProcessor: DATA_PROCESSOR_ENTITY.LOCAL_ENCRYPTED_VAULT,
    retentionPolicy: RETENTION_POLICY_TIER.DAYS_30_POST_VISIT,
    retentionDays: 30,
    isOptional: true,
    defaultGranted: false,
    version: '1.0.0',
  },
  [CONSENT_PURPOSE_KEY.DOCUMENT_OCR_PRE_SCRUTINY]: {
    purposeId: CONSENT_PURPOSE_KEY.DOCUMENT_OCR_PRE_SCRUTINY,
    title: 'Client-Side Document Scrutiny & Field Extraction',
    plainLanguageSummary: 'Performs on-device text parsing to pre-fill application numbers and verify document legibility.',
    lawfulBasis: LAWFUL_BASIS_TIER.CONSENT_EXPLICIT_DPDP_SEC_6,
    requestedFieldScopes: ['documentPreviewBuffer', 'extractedCertificateNumber', 'issuingAuthorityTitle'],
    designatedProcessor: DATA_PROCESSOR_ENTITY.CLIENT_SIDE_WEBCRYPTO_WORKER,
    retentionPolicy: RETENTION_POLICY_TIER.PURGED_IMMEDIATELY_AFTER_PARSING,
    retentionDays: 0,
    isOptional: true,
    defaultGranted: false,
    version: '1.0.0',
  },
  [CONSENT_PURPOSE_KEY.STATUTORY_NOTICES_SMS_ALERTS]: {
    purposeId: CONSENT_PURPOSE_KEY.STATUTORY_NOTICES_SMS_ALERTS,
    title: 'Statutory SLA Expiry & Local Notice Alerts',
    plainLanguageSummary: 'Sends SMS or email updates when application deadlines, statutory hearings, or municipal notices occur.',
    lawfulBasis: LAWFUL_BASIS_TIER.CONSENT_EXPLICIT_DPDP_SEC_6,
    requestedFieldScopes: ['contactPhoneNumber', 'wardNumber', 'monitoredApplicationReference'],
    designatedProcessor: DATA_PROCESSOR_ENTITY.TRAI_COMPLIANT_TELECOM_GATEWAY,
    retentionPolicy: RETENTION_POLICY_TIER.DURATION_OF_TRACKED_APPLICATION,
    retentionDays: 180,
    isOptional: true,
    defaultGranted: false,
    version: '1.0.0',
  },
  [CONSENT_PURPOSE_KEY.ANONYMOUS_COMMUNITY_ANALYTICS]: {
    purposeId: CONSENT_PURPOSE_KEY.ANONYMOUS_COMMUNITY_ANALYTICS,
    title: 'Anonymous Portal Reliability & Accessibility Metrics',
    plainLanguageSummary: 'Aggregates non-identifiable latency and error statistics to diagnose broken municipal endpoints.',
    lawfulBasis: LAWFUL_BASIS_TIER.LEGITIMATE_OPERATIONAL_PURPOSE,
    requestedFieldScopes: ['anonymizedLatencyMs', 'routePath', 'generalStateScope'],
    designatedProcessor: DATA_PROCESSOR_ENTITY.INTERNAL_METRICS_AGGREGATOR,
    retentionPolicy: RETENTION_POLICY_TIER.DAYS_90_AGGREGATE,
    retentionDays: 90,
    isOptional: true,
    defaultGranted: false,
    version: '1.0.0',
  },
};

// In-memory consent storage
const citizenConsentStore = new Map();
const consentAuditLog = [];

/**
 * Initializes or retrieves a citizen consent dossier.
 *
 * @param {string} ownerId Authenticated citizen ID
 * @returns {Object} Consent dossier
 */
export function initializeCitizenConsentDossier(ownerId) {
  if (!ownerId || typeof ownerId !== 'string') {
    throw new Error('Valid ownerId is required to initialize consent dossier');
  }

  if (citizenConsentStore.has(ownerId)) {
    return citizenConsentStore.get(ownerId);
  }

  const grants = {};
  Object.values(REGISTERED_CONSENT_PURPOSES).forEach((p) => {
    grants[p.purposeId] = {
      purposeId: p.purposeId,
      status: CONSENT_STATUS.UNSPECIFIED,
      grantedAt: null,
      revokedAt: null,
      revocationJustification: null,
      consentVersion: p.version,
      expiryDate: null,
    };
  });

  const dossier = {
    dossierId: `csnt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ownerId,
    grants,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    statutoryNotice: STATUTORY_DPDP_CONSENT_NOTICE,
  };

  citizenConsentStore.set(ownerId, dossier);
  return dossier;
}

/**
 * Retrieves a citizen consent dossier with authorization enforcement.
 *
 * @param {string} ownerId
 * @param {string} authenticatedUserId
 * @returns {Object} Dossier
 */
export function getCitizenConsentDossier(ownerId, authenticatedUserId) {
  if (!ownerId || !authenticatedUserId) return null;
  if (ownerId !== authenticatedUserId) {
    throw new Error('Access Denied: You cannot inspect another citizen consent records');
  }
  return initializeCitizenConsentDossier(ownerId);
}

/**
 * Grants explicit consent for a specific purpose.
 *
 * @param {string} ownerId
 * @param {string} purposeId
 * @param {Object} [options]
 * @returns {Object} Updated dossier
 */
export function grantPurposeConsent(ownerId, purposeId, options = {}) {
  const dossier = initializeCitizenConsentDossier(ownerId);
  const spec = REGISTERED_CONSENT_PURPOSES[purposeId];

  if (!spec) {
    throw new Error(`Unknown consent purpose: '${purposeId}'`);
  }

  const now = new Date();
  const expiryDate = spec.retentionDays > 0
    ? new Date(now.getTime() + spec.retentionDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  dossier.grants[purposeId] = {
    purposeId,
    status: CONSENT_STATUS.GRANTED,
    grantedAt: now.toISOString(),
    revokedAt: null,
    revocationJustification: null,
    consentVersion: spec.version,
    expiryDate,
    capturedIpScope: options.capturedIpScope || 'CLIENT_LOCAL',
  };

  dossier.updatedAt = now.toISOString();
  citizenConsentStore.set(ownerId, dossier);

  consentAuditLog.push({
    auditId: `aud_grant_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ownerId,
    purposeId,
    action: 'CONSENT_GRANTED',
    timestamp: now.toISOString(),
  });

  return dossier;
}

/**
 * Explicitly denies consent for a purpose.
 *
 * @param {string} ownerId
 * @param {string} purposeId
 * @returns {Object} Updated dossier
 */
export function denyPurposeConsent(ownerId, purposeId) {
  const dossier = initializeCitizenConsentDossier(ownerId);
  const spec = REGISTERED_CONSENT_PURPOSES[purposeId];

  if (!spec) {
    throw new Error(`Unknown consent purpose: '${purposeId}'`);
  }

  const now = new Date();
  dossier.grants[purposeId] = {
    purposeId,
    status: CONSENT_STATUS.DENIED,
    grantedAt: null,
    revokedAt: now.toISOString(),
    revocationJustification: 'Explicit citizen pre-consent denial',
    consentVersion: spec.version,
    expiryDate: null,
  };

  dossier.updatedAt = now.toISOString();
  citizenConsentStore.set(ownerId, dossier);

  consentAuditLog.push({
    auditId: `aud_deny_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ownerId,
    purposeId,
    action: 'CONSENT_DENIED',
    timestamp: now.toISOString(),
  });

  return dossier;
}

/**
 * Revokes previously granted consent for a purpose and returns downstream restriction directives.
 *
 * @param {string} ownerId
 * @param {string} purposeId
 * @param {string} [justification] Reason for revocation
 * @returns {Object} Result with updated dossier and restriction directives
 */
export function revokePurposeConsent(ownerId, purposeId, justification = 'Citizen voluntary withdrawal') {
  const dossier = initializeCitizenConsentDossier(ownerId);
  const spec = REGISTERED_CONSENT_PURPOSES[purposeId];

  if (!spec) {
    throw new Error(`Unknown consent purpose: '${purposeId}'`);
  }

  const now = new Date();
  const grant = dossier.grants[purposeId];
  grant.status = CONSENT_STATUS.REVOKED;
  grant.revokedAt = now.toISOString();
  grant.revocationJustification = justification;

  dossier.updatedAt = now.toISOString();
  citizenConsentStore.set(ownerId, dossier);

  consentAuditLog.push({
    auditId: `aud_rev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ownerId,
    purposeId,
    action: 'CONSENT_REVOKED',
    justification,
    timestamp: now.toISOString(),
  });

  // Downstream restriction and purge directives
  const restrictionDirectives = {
    purposeId,
    terminatedProcessor: spec.designatedProcessor,
    purgeFieldScopes: spec.requestedFieldScopes,
    enforcementAction: spec.retentionPolicy === RETENTION_POLICY_TIER.SESSION_ONLY_EPHEMERAL
      ? 'PURGE_IMMEDIATELY_FROM_MEMORY'
      : 'RESTRICT_AND_FLAG_FOR_EXPIRY_CASCADE',
    timestamp: now.toISOString(),
    status: 'DOWNSTREAM_PROCESSING_TERMINATED',
  };

  return {
    dossier,
    restrictionDirectives,
  };
}

/**
 * Gates downstream processing. Checks whether a feature is permitted to process citizen fields.
 *
 * @param {string} ownerId
 * @param {string} purposeId
 * @returns {boolean} True if explicitly granted and unexpired
 */
export function verifyDownstreamProcessingAllowed(ownerId, purposeId) {
  if (!ownerId || !purposeId) return false;
  if (!citizenConsentStore.has(ownerId)) return false;

  const dossier = citizenConsentStore.get(ownerId);
  const grant = dossier.grants[purposeId];
  if (!grant) return false;

  if (grant.status !== CONSENT_STATUS.GRANTED) return false;

  // Check expiry if configured
  if (grant.expiryDate && new Date(grant.expiryDate) < new Date()) {
    grant.status = CONSENT_STATUS.EXPIRED;
    return false;
  }

  return true;
}

/**
 * Generates an interactive directed data-flow graph for visualization.
 * Maps: Citizen Field Nodes -> Purpose Nodes -> Processor Nodes -> Retention State Nodes.
 *
 * @param {string} ownerId
 * @returns {Object} Graph nodes and edges
 */
export function generateDataFlowGraph(ownerId) {
  const dossier = initializeCitizenConsentDossier(ownerId);
  const nodes = [];
  const edges = [];
  const seenNodeIds = new Set();

  function addNode(id, type, label, metadata = {}) {
    if (!seenNodeIds.has(id)) {
      seenNodeIds.add(id);
      nodes.push({ id, type, label, ...metadata });
    }
  }

  Object.values(REGISTERED_CONSENT_PURPOSES).forEach((p) => {
    const grant = dossier.grants[p.purposeId];
    const isGranted = grant && grant.status === CONSENT_STATUS.GRANTED;

    const purposeNodeId = `purpose_${p.purposeId}`;
    addNode(purposeNodeId, 'PURPOSE_NODE', p.title, {
      purposeId: p.purposeId,
      status: grant.status,
      lawfulBasis: p.lawfulBasis,
      isActive: isGranted,
    });

    const processorNodeId = `proc_${p.designatedProcessor}`;
    addNode(processorNodeId, 'PROCESSOR_NODE', p.designatedProcessor, {
      processor: p.designatedProcessor,
    });

    const retentionNodeId = `ret_${p.retentionPolicy}`;
    addNode(retentionNodeId, 'RETENTION_NODE', p.retentionPolicy, {
      retentionDays: p.retentionDays,
    });

    // Edges between Purpose -> Processor -> Retention
    edges.push({
      id: `edge_${purposeNodeId}_${processorNodeId}`,
      source: purposeNodeId,
      target: processorNodeId,
      relationship: 'DISPATCHES_TO',
      active: isGranted,
    });

    edges.push({
      id: `edge_${processorNodeId}_${retentionNodeId}`,
      source: processorNodeId,
      target: retentionNodeId,
      relationship: 'RETAINS_UNDER',
      active: isGranted,
    });

    // Field nodes connecting to purpose
    p.requestedFieldScopes.forEach((field) => {
      const fieldNodeId = `field_${field}`;
      addNode(fieldNodeId, 'CITIZEN_DATA_FIELD', field, {
        fieldName: field,
      });

      edges.push({
        id: `edge_${fieldNodeId}_${purposeNodeId}`,
        source: fieldNodeId,
        target: purposeNodeId,
        relationship: 'INCORPORATED_FOR_PURPOSE',
        active: isGranted,
      });
    });
  });

  return {
    ownerId,
    nodes,
    edges,
    totalNodes: nodes.length,
    totalEdges: edges.length,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generates an accessible, non-visual table summary for assistive technologies.
 *
 * @param {string} ownerId
 * @returns {Array<Object>} Accessible rows
 */
export function getAccessiblePurposeSummary(ownerId) {
  const dossier = initializeCitizenConsentDossier(ownerId);

  return Object.values(REGISTERED_CONSENT_PURPOSES).map((p) => {
    const grant = dossier.grants[p.purposeId];
    return {
      purposeId: p.purposeId,
      title: p.title,
      summary: p.plainLanguageSummary,
      status: grant.status,
      fieldsList: p.requestedFieldScopes.join(', '),
      processor: p.designatedProcessor,
      retentionRule: `${p.retentionPolicy} (${p.retentionDays === 0 ? 'Instant purge' : `${p.retentionDays} days`})`,
      canRevoke: grant.status === CONSENT_STATUS.GRANTED,
      grantedAt: grant.grantedAt || 'Not granted',
    };
  });
}

/**
 * Sanitizes consent dossier for privacy-safe audit exports and compliance verification.
 *
 * @param {Object} dossier
 * @returns {Object} Sanitized object
 */
export function sanitizeConsentExportForAudit(dossier) {
  if (!dossier || typeof dossier !== 'object') return null;

  const sanitized = JSON.parse(JSON.stringify(dossier));
  sanitized.ownerId = 'REDACTED_CITIZEN_ID';
  sanitized.dossierId = 'CSNT_AUDIT_VERIFIED';

  return sanitized;
}

/**
 * Retrieves append-only audit trail.
 *
 * @returns {Array<Object>}
 */
export function getConsentAuditTrail() {
  return [...consentAuditLog];
}

/**
 * Resets internal test stores.
 */
export function _resetConsentStore() {
  citizenConsentStore.clear();
  consentAuditLog.length = 0;
}
