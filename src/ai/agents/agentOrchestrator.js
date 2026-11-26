/**
 * Agent-to-Agent Contract Orchestrator
 *
 * Coordinates specialist agents using versioned typed envelopes, boundary
 * validation, correlation IDs, deadline budgets, bounded retries, and safe
 * fallback handling.
 */

import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_DEADLINE_MS,
  createErrorEnvelope,
  createMessageEnvelope,
} from '../contracts/messageContract.js';
import { validateAndAdaptMessage } from '../contracts/schemaEvolution.js';
import { recordContractEvent } from '../contracts/observability.js';
import { createDefaultAgentRegistry } from './agentRegistry.js';
import { MANDATORY_LEGAL_DISCLAIMER } from '../groundedCivicAssistant.js';

const MAX_RETRIES = 1;

function buildSafeFailureResponse(errorEnvelope, correlationId, hops) {
  return {
    status: 'error',
    grounded: false,
    confidenceScore: 0,
    serviceId: null,
    retrievedChunks: [],
    suggestions: [
      'How to apply for a Passport?',
      'What documents are needed for Birth Certificate?',
      'Aadhaar card update documents',
    ],
    data: {
      title: 'Unable to Verify Agent Response',
      summary:
        errorEnvelope?.payload?.message ||
        'The assistant could not validate the agent response within the safety contract.',
      officialSources: [
        {
          name: 'National Government Services Portal',
          url: 'https://services.india.gov.in',
          verified: true,
        },
      ],
      disclaimer: MANDATORY_LEGAL_DISCLAIMER,
    },
    contractMeta: {
      correlationId,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      hops,
      migratedCount: 0,
      requiresHumanApproval: true,
      errorEnvelope,
    },
  };
}

/**
 * Invokes an agent adapter with boundary validation and bounded retry on retryable errors.
 */
async function invokeWithContract({
  adapter,
  requestEnvelope,
  context,
  allowExpired = false,
  maxRetries = MAX_RETRIES,
}) {
  const reqCheck = validateAndAdaptMessage(requestEnvelope, { allowExpired });
  if (!reqCheck.ok) {
    recordContractEvent('contract_rejected', {
      code: reqCheck.errorEnvelope.payload.code,
      status: 'error',
      reason: 'outbound_request_invalid',
    });
    return { ok: false, envelope: reqCheck.errorEnvelope, migrated: false, attempts: 0 };
  }

  let migrated = Boolean(reqCheck.migratedFrom);
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    if (!allowExpired && Date.now() >= Date.parse(reqCheck.message.deadlineAt)) {
      lastError = createErrorEnvelope({
        code: 'DEADLINE_EXCEEDED',
        category: 'timeout',
        message: 'Agent invocation aborted because request deadline expired.',
        retryable: false,
        correlationId: reqCheck.message.correlationId,
        causationId: reqCheck.message.messageId,
        sender: adapter.role,
        recipient: 'orchestrator',
        failedAtStage: adapter.role,
      });
      recordContractEvent('contract_rejected', {
        code: 'DEADLINE_EXCEEDED',
        status: 'error',
        attempt,
      });
      break;
    }

    try {
      const rawResponse = await adapter.invoke(reqCheck.message, context);
      const resCheck = validateAndAdaptMessage(rawResponse, { allowExpired });

      if (resCheck.migratedFrom) {
        migrated = true;
        recordContractEvent('contract_migrated', {
          code: `MIGRATED_${resCheck.migratedFrom}_TO_${CURRENT_SCHEMA_VERSION}`,
          status: 'ok',
        });
      }

      if (!resCheck.ok) {
        lastError = resCheck.errorEnvelope;
        recordContractEvent('contract_rejected', {
          code: lastError.payload.code,
          status: 'error',
          attempt,
        });
        if (lastError.payload.retryable && attempt <= maxRetries) {
          recordContractEvent('agent_retry', { code: lastError.payload.code, status: 'ok', attempt });
          continue;
        }
        return { ok: false, envelope: lastError, migrated, attempts: attempt };
      }

      if (resCheck.message.messageType === 'error') {
        lastError = resCheck.message;
        if (lastError.payload?.retryable && attempt <= maxRetries) {
          recordContractEvent('agent_retry', { code: lastError.payload.code, status: 'ok', attempt });
          continue;
        }
        return { ok: false, envelope: lastError, migrated, attempts: attempt };
      }

      recordContractEvent('contract_validated', {
        code: 'VALID_ENVELOPE',
        status: 'ok',
        attempt,
      });
      return { ok: true, envelope: resCheck.message, migrated, attempts: attempt };
    } catch {
      lastError = createErrorEnvelope({
        code: 'AGENT_EXECUTION_ERROR',
        category: 'execution',
        message: `Agent "${adapter.role}" failed to complete within contract.`,
        retryable: attempt <= maxRetries,
        correlationId: reqCheck.message.correlationId,
        causationId: reqCheck.message.messageId,
        sender: adapter.role,
        recipient: 'orchestrator',
        failedAtStage: adapter.role,
      });
      recordContractEvent('contract_rejected', {
        code: lastError.payload.code,
        status: 'error',
        attempt,
      });
      if (attempt <= maxRetries) {
        recordContractEvent('agent_retry', { code: lastError.payload.code, status: 'ok', attempt });
        continue;
      }
    }
  }

  return { ok: false, envelope: lastError, migrated, attempts: maxRetries + 1 };
}

/**
 * Runs the end-to-end Civic Help Setu multi-agent pipeline under strict message contracts.
 *
 * @param {string} query
 * @param {Object} [options]
 * @param {string} [options.correlationId]
 * @param {number} [options.deadlineMs=5000]
 * @param {string|null} [options.serviceContextId]
 * @param {Object} [options.registry]
 * @param {boolean} [options.allowExpired=false]
 * @returns {Promise<Object>}
 */
export async function runCivicAgentPipeline(query, options = {}) {
  const {
    correlationId = `corr-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    deadlineMs = DEFAULT_DEADLINE_MS,
    serviceContextId = null,
    registry = createDefaultAgentRegistry(),
    allowExpired = false,
  } = options;

  const deadlineAt = new Date(Date.now() + deadlineMs).toISOString();
  const hops = [];
  let migratedCount = 0;

  // Hop 1: Guardrail Agent
  const guardrailReq = createMessageEnvelope({
    correlationId,
    messageType: 'request',
    sender: 'orchestrator',
    recipient: 'guardrail',
    deadlineAt,
    permissionScope: 'sanitize_query',
    payload: { query: String(query || '') },
  });

  const guardrailRes = await invokeWithContract({
    adapter: registry.guardrail,
    requestEnvelope: guardrailReq,
    context: { serviceContextId },
    allowExpired,
  });

  hops.push({
    agent: 'guardrail',
    ok: guardrailRes.ok,
    schemaVersion: guardrailRes.envelope?.schemaVersion || CURRENT_SCHEMA_VERSION,
    attempts: guardrailRes.attempts,
  });
  if (guardrailRes.migrated) migratedCount += 1;

  if (!guardrailRes.ok) {
    return buildSafeFailureResponse(guardrailRes.envelope, correlationId, hops);
  }

  const guardrailPayload = guardrailRes.envelope.payload;
  if (guardrailPayload.decision === 'block' && guardrailPayload.blockedResponse) {
    return {
      ...guardrailPayload.blockedResponse,
      guardrail: {
        decision: guardrailPayload.decision,
        pii: guardrailPayload.pii,
        injection: guardrailPayload.injection,
      },
      contractMeta: {
        correlationId,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        hops,
        migratedCount,
        requiresHumanApproval: false,
        errorEnvelope: null,
      },
    };
  }

  // Hop 2: Grounded Synthesizer Agent
  const synthReq = createMessageEnvelope({
    correlationId,
    causationId: guardrailRes.envelope.messageId,
    messageType: 'request',
    sender: 'orchestrator',
    recipient: 'synthesizer',
    deadlineAt,
    permissionScope: 'propose_guidance',
    payload: { sanitizedQuery: guardrailPayload.sanitizedQuery },
  });

  const synthRes = await invokeWithContract({
    adapter: registry.synthesizer,
    requestEnvelope: synthReq,
    context: { serviceContextId },
    allowExpired,
  });

  hops.push({
    agent: 'synthesizer',
    ok: synthRes.ok,
    schemaVersion: synthRes.envelope?.schemaVersion || CURRENT_SCHEMA_VERSION,
    attempts: synthRes.attempts,
  });
  if (synthRes.migrated) migratedCount += 1;

  if (synthRes.ok) {
    return {
      ...synthRes.envelope.payload,
      contractMeta: {
        correlationId,
        schemaVersion: synthRes.envelope.schemaVersion,
        hops,
        migratedCount,
        requiresHumanApproval: Boolean(synthRes.envelope.requiresHumanApproval),
        provenanceSourcesCount: synthRes.envelope.provenance?.sources?.length || 0,
        errorEnvelope: null,
      },
    };
  }

  // Hop 3: Fallback Agent (if primary failed and registry provides fallback)
  if (registry.fallback) {
    const fallbackReq = createMessageEnvelope({
      correlationId,
      causationId: synthRes.envelope?.messageId || guardrailRes.envelope.messageId,
      messageType: 'request',
      sender: 'orchestrator',
      recipient: 'fallback',
      deadlineAt: new Date(Date.now() + Math.max(1000, deadlineMs)).toISOString(),
      permissionScope: 'propose_guidance',
      payload: { sanitizedQuery: guardrailPayload.sanitizedQuery },
    });

    const fallbackRes = await invokeWithContract({
      adapter: registry.fallback,
      requestEnvelope: fallbackReq,
      context: { serviceContextId },
      allowExpired,
      maxRetries: 0,
    });

    hops.push({
      agent: 'fallback',
      ok: fallbackRes.ok,
      schemaVersion: fallbackRes.envelope?.schemaVersion || CURRENT_SCHEMA_VERSION,
      attempts: fallbackRes.attempts,
    });
    if (fallbackRes.migrated) migratedCount += 1;

    if (fallbackRes.ok) {
      return {
        ...fallbackRes.envelope.payload,
        contractMeta: {
          correlationId,
          schemaVersion: fallbackRes.envelope.schemaVersion,
          hops,
          migratedCount,
          requiresHumanApproval: true,
          degradedFromError: synthRes.envelope?.payload?.code || 'SYNTHESIS_FAILED',
          errorEnvelope: null,
        },
      };
    }
  }

  return buildSafeFailureResponse(synthRes.envelope, correlationId, hops);
}
