/**
 * Governed Agent Tool Registry & Capability Enforcer (#1146)
 *
 * Central deterministic policy & execution boundary for AI agent tools:
 * - Default-deny for unregistered tools
 * - Short-lived scoped capability tokens bound to verified actor + session
 * - Server-side JSON Schema & prototype-pollution validation
 * - Single-use replay protection (consumed atomically before side effects)
 * - Risk-tier approval & provenance gating (no autonomous filing/benefit denial)
 * - Real-time admin revocation synced with incident response
 * - PII-scrubbed audit logging & observability metrics
 */

import { MOCK_SERVICES } from '../../data/services.js';
import {
  APPROVAL_REQUIREMENTS,
  ERROR_CODES,
  REGISTERED_TOOLS,
  RISK_TIERS,
  TOOL_REGISTRY_CONTRACT_VERSION,
  inspectSensitiveArguments,
  validateAgainstJsonSchema,
} from './toolContracts.js';
import {
  computeArgsDigest,
  createCapabilityAuthority,
  createReplayNonceStore,
  createRevocationRegistry,
  resolveAuthorizedScopes,
} from './capabilityService.js';
import { createToolAuditLogger, scrubSafeAuditString } from './toolAuditLogger.js';

export function createDefaultToolAdapters({ services = MOCK_SERVICES } = {}) {
  const findService = (serviceId) => services.find((s) => s.id === serviceId) || null;

  return {
    async lookupServiceDetails(args) {
      const svc = findService(args.serviceId);
      const portalLinks = Array.isArray(svc?.officialLinks)
        ? svc.officialLinks
        : [{ name: 'National Government Services Portal', url: 'https://services.india.gov.in' }];
      return {
        serviceId: args.serviceId,
        title: svc?.name || args.serviceId,
        department: svc?.department || 'Jurisdictional Civic Authority',
        shortDescription: svc?.shortDescription || 'Guidance summary from Civic Help Setu catalog.',
        documents: Array.isArray(svc?.documents) ? svc.documents.slice(0, 6) : [],
        stepsCount: Array.isArray(svc?.steps) ? svc.steps.length : 0,
        officialSources: portalLinks,
        advisoryNotice: 'Informational guidance only; verify final requirements on the official portal.',
      };
    },

    async searchCivicFaq(args) {
      const term = args.query.trim().toLowerCase();
      const limit = args.limit || 5;
      const matches = services
        .filter((svc) => {
          const hay = `${svc.name || ''} ${svc.shortDescription || ''} ${svc.category || ''}`.toLowerCase();
          return hay.includes(term);
        })
        .slice(0, limit)
        .map((svc) => ({
          serviceId: svc.id,
          name: svc.name,
          category: svc.category,
          summary: svc.shortDescription,
        }));

      return {
        query: scrubSafeAuditString(args.query, 120),
        matchCount: matches.length,
        matches,
        advisoryNotice: 'Public guide search only; does not access personal citizen records.',
      };
    },

    async generateCivicChecklist(args) {
      const svc = findService(args.serviceId);
      const docs = Array.isArray(svc?.documents) && svc.documents.length > 0
        ? svc.documents
        : ['Identity proof requested by jurisdictional desk', 'Address proof requested by jurisdictional desk'];
      return {
        serviceId: args.serviceId,
        applicantCategory: args.applicantCategory || 'general',
        checklistItems: docs.slice(0, 8).map((label, idx) => ({
          id: `item-${idx + 1}`,
          label,
          checked: false,
        })),
        nonBinding: true,
      };
    },

    async saveApplicationDraft(args, context) {
      return {
        draftId: `draft-${args.serviceId}-${context.jti || 'local'}`,
        serviceId: args.serviceId,
        caseId: args.caseId || `case-${args.serviceId}`,
        status: 'STAGED_LOCAL_PROPOSAL',
        savedKeys: Object.keys(args.formData || {}),
        autonomousFilingPermitted: false,
        advisoryNotice: 'Draft staged for citizen review only. No official government application was filed.',
      };
    },

    async scheduleGrievanceFollowUp(args, context) {
      return {
        reminderId: `rem-${args.grievanceId}-${context.jti || 'local'}`,
        grievanceId: args.grievanceId,
        reminderDate: args.reminderDate,
        status: 'PROPOSAL_SCHEDULED_WITH_APPROVAL',
        autonomousActionPermitted: false,
        advisoryNotice: 'Follow-up reminder recorded locally after human review; verify portal status manually.',
      };
    },
  };
}

function withTimeout(promise, timeoutMs, toolName) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Tool "${toolName}" exceeded execution timeout (${timeoutMs}ms).`);
      err.code = ERROR_CODES.EXECUTION_TIMEOUT;
      reject(err);
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

export function createGovernedToolRegistry({
  secret,
  tools = REGISTERED_TOOLS,
  adapters = createDefaultToolAdapters(),
  authority,
  replayStore,
  revocationRegistry,
  auditLogger,
  incidentResponse = null,
  now = Date.now,
} = {}) {
  const capAuthority = authority || createCapabilityAuthority({ secret, now });
  const nonces = replayStore || createReplayNonceStore({ now });
  const revocations = revocationRegistry || createRevocationRegistry({ now });
  const logger = auditLogger || createToolAuditLogger({ now });
  const registry = new Map(Object.entries(tools));
  const toolAdapters = new Map(Object.entries(adapters));
  const callWindows = new Map(); // `${actorUserId}:${toolName}` -> timestamps[]

  function checkRateLimit(actorUserId, tool) {
    const maxPerMin = tool.maxCallsPerMinute || 30;
    const key = `${actorUserId}:${tool.name}`;
    const cutoff = now() - 60_000;
    const recent = (callWindows.get(key) || []).filter((ts) => ts > cutoff);
    if (recent.length >= maxPerMin) {
      return false;
    }
    recent.push(now());
    callWindows.set(key, recent);
    return true;
  }

  function listTools({ includeSchemas = true } = {}) {
    return Array.from(registry.values()).map((tool) => {
      const revCheck = revocations.check({ toolName: tool.name });
      const incidentBlocked = incidentResponse
        ? !incidentResponse.checkExecutionPermission('policy-controlled-tool-router', { toolName: tool.name }).permitted
        : false;
      return {
        name: tool.name,
        version: tool.version,
        description: tool.description,
        riskTier: tool.riskTier,
        scopes: [...tool.scopes],
        approvalRequirement: tool.approvalRequirement,
        requiresProvenance: tool.requiresProvenance,
        timeoutMs: tool.timeoutMs,
        maxCallsPerMinute: tool.maxCallsPerMinute,
        owner: tool.owner,
        revoked: revCheck.revoked || incidentBlocked,
        ...(includeSchemas ? { inputSchema: tool.inputSchema } : {}),
      };
    });
  }

  function registerTool(toolDef, adapterFn) {
    if (!toolDef || typeof toolDef.name !== 'string' || !toolDef.inputSchema) {
      throw new Error('Tool registration requires name and inputSchema.');
    }
    registry.set(toolDef.name, Object.freeze({ ...toolDef }));
    if (typeof adapterFn === 'function') {
      toolAdapters.set(toolDef.name, adapterFn);
    }
  }

  function issueCapability({
    actorUserId,
    actorRole = 'citizen',
    sessionId = 'default-session',
    toolName,
    requestedScopes = [],
    ttlSeconds = 120,
    singleUse = true,
    citizenConfirmed = false,
    humanApproved = false,
    provenanceRef = null,
    boundArgs = null,
    correlationId = 'cap-issue',
  }) {
    if (!actorUserId || typeof actorUserId !== 'string') {
      return {
        ok: false,
        status: 401,
        code: ERROR_CODES.CAPABILITY_REQUIRED,
        reason: 'Verified actor identity is required to issue a capability.',
      };
    }

    // 1. Default-deny unknown tools
    const tool = registry.get(toolName);
    if (!tool) {
      logger.record({
        correlationId,
        actorId: actorUserId,
        actorRole,
        toolName,
        decision: 'DENIED',
        errorCode: ERROR_CODES.UNKNOWN_TOOL,
        reason: 'Attempted capability issuance for unknown tool.',
      });
      return {
        ok: false,
        status: 404,
        code: ERROR_CODES.UNKNOWN_TOOL,
        reason: `Unknown tool "${toolName}" denied by default.`,
      };
    }

    // 2. Check revocation & incident kill switch
    const rev = revocations.check({ userId: actorUserId, toolName });
    if (rev.revoked) {
      logger.record({
        correlationId,
        actorId: actorUserId,
        actorRole,
        toolName,
        riskTier: tool.riskTier,
        decision: 'DENIED',
        errorCode: rev.code,
        reason: rev.reason,
      });
      return { ok: false, status: 403, code: rev.code, reason: rev.reason };
    }

    if (incidentResponse) {
      const ir = incidentResponse.checkExecutionPermission('policy-controlled-tool-router', { toolName });
      if (!ir.permitted) {
        logger.record({
          correlationId,
          actorId: actorUserId,
          actorRole,
          toolName,
          riskTier: tool.riskTier,
          decision: 'DENIED',
          errorCode: ERROR_CODES.TOOL_REVOKED,
          reason: ir.reason,
        });
        return { ok: false, status: 403, code: ERROR_CODES.TOOL_REVOKED, reason: ir.reason };
      }
    }

    // 3. Enforce role-scope ceiling (prevents privilege escalation)
    const scopeCheck = resolveAuthorizedScopes(actorRole, requestedScopes, tool.scopes);
    if (!scopeCheck.ok) {
      logger.record({
        correlationId,
        actorId: actorUserId,
        actorRole,
        toolName,
        riskTier: tool.riskTier,
        scopes: requestedScopes,
        decision: 'DENIED',
        errorCode: scopeCheck.code,
        reason: scopeCheck.reason,
      });
      return { ok: false, status: 403, code: scopeCheck.code, reason: scopeCheck.reason };
    }

    // 4. If boundArgs supplied, validate them before minting digest
    let argDigest = null;
    if (boundArgs !== null && boundArgs !== undefined) {
      const sensitiveCheck = inspectSensitiveArguments(boundArgs);
      if (!sensitiveCheck.safe) {
        return {
          ok: false,
          status: 400,
          code: ERROR_CODES.SENSITIVE_DATA_DENIED,
          reason: sensitiveCheck.reason,
        };
      }
      const schemaCheck = validateAgainstJsonSchema(tool.inputSchema, boundArgs);
      if (!schemaCheck.valid) {
        return {
          ok: false,
          status: 400,
          code: ERROR_CODES.INVALID_SCHEMA,
          reason: schemaCheck.errors.join('; '),
        };
      }
      argDigest = computeArgsDigest(boundArgs);
    }

    const { token, claims } = capAuthority.issue({
      actorUserId,
      actorRole,
      sessionId,
      toolName,
      scopes: scopeCheck.scopes,
      riskTier: tool.riskTier,
      ttlSeconds,
      singleUse,
      citizenConfirmed,
      humanApproved,
      provenanceRef,
      argDigest,
    });

    logger.record({
      correlationId,
      actorId: actorUserId,
      actorRole,
      toolName,
      riskTier: tool.riskTier,
      scopes: claims.scopes,
      jti: claims.jti,
      decision: 'CAPABILITY_ISSUED',
      provenanceVerified: Boolean(provenanceRef),
    });

    return {
      ok: true,
      status: 201,
      contractVersion: TOOL_REGISTRY_CONTRACT_VERSION,
      capabilityToken: token,
      claims: {
        jti: claims.jti,
        sub: claims.sub,
        toolName: claims.toolName,
        scopes: claims.scopes,
        riskTier: claims.riskTier,
        singleUse: claims.singleUse,
        iat: claims.iat,
        exp: claims.exp,
      },
    };
  }

  async function invokeTool({
    capabilityToken,
    toolName,
    args,
    actorUserId,
    actorRole = 'citizen',
    sessionId = 'default-session',
    correlationId = 'tool-invoke',
    citizenConfirmed = false,
    humanApproved = false,
    provenance = null,
  }) {
    const startMs = now();

    const deny = (status, code, reason, extra = {}) => {
      logger.record({
        correlationId,
        actorId: actorUserId || 'anonymous',
        actorRole,
        toolName: toolName || 'unknown',
        riskTier: extra.riskTier || 'UNKNOWN',
        scopes: extra.scopes || [],
        jti: extra.jti || null,
        decision: 'DENIED',
        errorCode: code,
        args,
        provenanceVerified: Boolean(extra.provenanceVerified),
        latencyMs: now() - startMs,
        reason,
      });
      return {
        ok: false,
        status,
        contractVersion: TOOL_REGISTRY_CONTRACT_VERSION,
        code,
        error: reason,
        correlationId,
      };
    };

    // 0. Incident kill-switch & tool revocation check
    if (incidentResponse) {
      const ir = incidentResponse.checkExecutionPermission('policy-controlled-tool-router', { toolName });
      if (!ir.permitted) {
        return deny(403, ERROR_CODES.TOOL_REVOKED, ir.reason);
      }
    }

    // 1. Default-deny unknown tools
    const tool = registry.get(toolName);
    if (!tool) {
      return deny(404, ERROR_CODES.UNKNOWN_TOOL, `Unknown or unregistered tool "${toolName}" denied by default.`);
    }

    // 2. Require and verify capability token
    if (!capabilityToken) {
      return deny(401, ERROR_CODES.CAPABILITY_REQUIRED, 'Scoped capability token is required.', {
        riskTier: tool.riskTier,
      });
    }

    const verified = capAuthority.verify(capabilityToken);
    if (!verified.ok) {
      return deny(
        verified.code === ERROR_CODES.CAPABILITY_EXPIRED ? 401 : 403,
        verified.code,
        verified.reason,
        { riskTier: tool.riskTier, jti: verified.claims?.jti }
      );
    }

    const claims = verified.claims;

    // 3. Cross-user & session isolation check
    if (!actorUserId || claims.sub !== actorUserId) {
      return deny(
        403,
        ERROR_CODES.CROSS_USER_DENIED,
        'Capability token subject does not match verified caller identity.',
        { riskTier: tool.riskTier, jti: claims.jti, scopes: claims.scopes }
      );
    }
    if (claims.sessionId && sessionId && claims.sessionId !== sessionId) {
      return deny(
        403,
        ERROR_CODES.CROSS_USER_DENIED,
        'Capability token session binding mismatch.',
        { riskTier: tool.riskTier, jti: claims.jti, scopes: claims.scopes }
      );
    }

    // 4. Revocation check (tool, user, jti)
    const rev = revocations.check({ jti: claims.jti, userId: actorUserId, toolName });
    if (rev.revoked) {
      return deny(403, rev.code, rev.reason, {
        riskTier: tool.riskTier,
        jti: claims.jti,
        scopes: claims.scopes,
      });
    }

    // 5. Tool & scope match check
    if (claims.toolName !== toolName) {
      return deny(
        403,
        ERROR_CODES.SCOPE_DENIED,
        `Capability issued for "${claims.toolName}" cannot invoke "${toolName}".`,
        { riskTier: tool.riskTier, jti: claims.jti, scopes: claims.scopes }
      );
    }

    const hasAllScopes = tool.scopes.every((s) => Array.isArray(claims.scopes) && claims.scopes.includes(s));
    if (!hasAllScopes) {
      return deny(
        403,
        ERROR_CODES.SCOPE_DENIED,
        `Capability lacks required scope(s) for "${toolName}".`,
        { riskTier: tool.riskTier, jti: claims.jti, scopes: claims.scopes }
      );
    }

    // 6. Sensitive payload & JSON Schema validation (server-side boundary)
    const sensitiveCheck = inspectSensitiveArguments(args);
    if (!sensitiveCheck.safe) {
      return deny(400, ERROR_CODES.SENSITIVE_DATA_DENIED, sensitiveCheck.reason, {
        riskTier: tool.riskTier,
        jti: claims.jti,
        scopes: claims.scopes,
      });
    }

    const schemaCheck = validateAgainstJsonSchema(tool.inputSchema, args);
    if (!schemaCheck.valid) {
      return deny(
        400,
        ERROR_CODES.INVALID_SCHEMA,
        `Argument schema validation failed: ${schemaCheck.errors.join('; ')}`,
        { riskTier: tool.riskTier, jti: claims.jti, scopes: claims.scopes }
      );
    }

    if (claims.argDigest && computeArgsDigest(args) !== claims.argDigest) {
      return deny(
        403,
        ERROR_CODES.ARGUMENT_DIGEST_MISMATCH,
        'Invocation arguments do not match capability-bound digest.',
        { riskTier: tool.riskTier, jti: claims.jti, scopes: claims.scopes }
      );
    }

    // 7. Approval & provenance requirements by risk tier
    if (tool.approvalRequirement === APPROVAL_REQUIREMENTS.CITIZEN_CONFIRMATION) {
      if (!(citizenConfirmed && claims.citizenConfirmed)) {
        return deny(
          403,
          ERROR_CODES.APPROVAL_REQUIRED,
          `Tool "${toolName}" requires explicit citizen confirmation in both capability and request.`,
          { riskTier: tool.riskTier, jti: claims.jti, scopes: claims.scopes }
        );
      }
    }

    if (tool.approvalRequirement === APPROVAL_REQUIREMENTS.HUMAN_REVIEWER_APPROVAL) {
      if (!(humanApproved && claims.humanApproved)) {
        return deny(
          403,
          ERROR_CODES.APPROVAL_REQUIRED,
          `High-risk tool "${toolName}" requires human reviewer approval.`,
          { riskTier: tool.riskTier, jti: claims.jti, scopes: claims.scopes }
        );
      }
    }

    const sources = Array.isArray(provenance?.sources) ? provenance.sources : [];
    const hasVerifiedCitation = sources.some((s) => s && typeof s.url === 'string' && s.url.startsWith('https://'));
    if (tool.requiresProvenance && tool.riskTier !== RISK_TIERS.LOW && !hasVerifiedCitation && !claims.provenanceRef) {
      return deny(
        400,
        ERROR_CODES.PROVENANCE_REQUIRED,
        `Tool "${toolName}" requires verified provenance citations before execution.`,
        { riskTier: tool.riskTier, jti: claims.jti, scopes: claims.scopes }
      );
    }

    // 8. Per-user sliding-window rate limit
    if (!checkRateLimit(actorUserId, tool)) {
      return deny(429, ERROR_CODES.RATE_LIMITED, `Rate limit exceeded for tool "${toolName}".`, {
        riskTier: tool.riskTier,
        jti: claims.jti,
        scopes: claims.scopes,
      });
    }

    // 9. Atomic single-use replay consumption BEFORE executing side effects
    if (claims.singleUse) {
      const nonceResult = nonces.consume(claims.jti, claims.exp);
      if (!nonceResult.ok) {
        return deny(409, nonceResult.code, nonceResult.reason, {
          riskTier: tool.riskTier,
          jti: claims.jti,
          scopes: claims.scopes,
        });
      }
    }

    // 10. Execute deterministic adapter with bounded timeout
    const adapter = toolAdapters.get(toolName);
    if (typeof adapter !== 'function') {
      return deny(500, ERROR_CODES.INTERNAL_ERROR, `No adapter registered for tool "${toolName}".`, {
        riskTier: tool.riskTier,
        jti: claims.jti,
        scopes: claims.scopes,
      });
    }

    try {
      const output = await withTimeout(
        Promise.resolve(adapter(args, { actorUserId, actorRole, sessionId, jti: claims.jti, correlationId })),
        tool.timeoutMs || 5000,
        toolName
      );

      const latencyMs = now() - startMs;
      logger.record({
        correlationId,
        actorId: actorUserId,
        actorRole,
        toolName,
        riskTier: tool.riskTier,
        scopes: claims.scopes,
        jti: claims.jti,
        decision: 'ALLOWED',
        args,
        provenanceVerified: hasVerifiedCitation || Boolean(claims.provenanceRef),
        latencyMs,
      });

      return {
        ok: true,
        status: 200,
        contractVersion: TOOL_REGISTRY_CONTRACT_VERSION,
        toolName,
        riskTier: tool.riskTier,
        correlationId,
        jti: claims.jti,
        latencyMs,
        output,
      };
    } catch (err) {
      const code = err?.code === ERROR_CODES.EXECUTION_TIMEOUT
        ? ERROR_CODES.EXECUTION_TIMEOUT
        : ERROR_CODES.INTERNAL_ERROR;
      return deny(code === ERROR_CODES.EXECUTION_TIMEOUT ? 504 : 500, code, err?.message || 'Tool execution failed.', {
        riskTier: tool.riskTier,
        jti: claims.jti,
        scopes: claims.scopes,
        provenanceVerified: hasVerifiedCitation || Boolean(claims.provenanceRef),
      });
    }
  }

  return {
    listTools,
    registerTool,
    issueCapability,
    invokeTool,
    revokeCapability: (jti, meta) => revocations.revokeCapability(jti, meta),
    revokeUser: (userId, meta) => revocations.revokeUser(userId, meta),
    restoreUser: (userId) => revocations.restoreUser(userId),
    revokeTool: (toolName, meta) => {
      if (incidentResponse && typeof incidentResponse.revokeTool === 'function') {
        incidentResponse.revokeTool({ toolName, actorId: meta?.actorId || 'admin', reason: meta?.reason || 'Admin revocation' });
      }
      return revocations.revokeTool(toolName, meta);
    },
    restoreTool: (toolName, meta) => {
      if (incidentResponse && typeof incidentResponse.restoreTool === 'function') {
        incidentResponse.restoreTool({ toolName, actorId: meta?.actorId || 'admin', reason: meta?.reason || 'Admin restore' });
      }
      return revocations.restoreTool(toolName);
    },
    getRevocationSnapshot: () => revocations.getSnapshot(),
    getAuditEvents: (query) => logger.list(query),
    getMetrics: () => logger.getMetrics(),
  };
}
