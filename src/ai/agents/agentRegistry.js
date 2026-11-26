/**
 * Provider-Neutral Specialist Agent Adapters
 *
 * Wraps Civic Help Setu's guardrail, grounded retrieval/synthesis, and fallback
 * modules behind a uniform contract-validated adapter interface.
 */

import { runPreInferenceGuardrails } from '../aiGuardrailPipeline.js';
import { askGroundedCivicAssistant, MANDATORY_LEGAL_DISCLAIMER } from '../groundedCivicAssistant.js';
import { askCivicAssistant } from '../civicAssistant.js';
import { createMessageEnvelope, createErrorEnvelope } from '../contracts/messageContract.js';

/**
 * Guardrail specialist adapter: sanitizes PII and blocks prompt-injection attempts.
 */
export const guardrailAgentAdapter = {
  role: 'guardrail',
  async invoke(requestEnvelope) {
    const query = String(requestEnvelope.payload?.query || '');
    const pre = runPreInferenceGuardrails(query, {
      disclaimer: MANDATORY_LEGAL_DISCLAIMER,
    });

    return createMessageEnvelope({
      correlationId: requestEnvelope.correlationId,
      causationId: requestEnvelope.messageId,
      messageType: 'proposal',
      sender: 'guardrail',
      recipient: 'orchestrator',
      deadlineAt: requestEnvelope.deadlineAt,
      permissionScope: 'sanitize_query',
      requiresHumanApproval: false,
      provenance: {
        sources: [{ name: 'Civic-Help-Setu Pre-Inference Guardrail Policy', url: 'https://services.india.gov.in', verified: true }],
        unverified: false,
      },
      payload: {
        decision: pre.decision,
        sanitizedQuery: pre.sanitizedQuery,
        pii: pre.pii,
        injection: pre.injection,
        blockedResponse: pre.blockedResponse || null,
      },
    });
  },
};

/**
 * Grounded synthesis specialist adapter: retrieves verified chunks, checks entailment,
 * and returns a provenance-backed proposal.
 */
export const synthesizerAgentAdapter = {
  role: 'synthesizer',
  async invoke(requestEnvelope, context = {}) {
    const query = String(requestEnvelope.payload?.sanitizedQuery || requestEnvelope.payload?.query || '');
    const remainingMs = Math.max(0, Date.parse(requestEnvelope.deadlineAt) - Date.now());
    if (remainingMs <= 0) {
      return createErrorEnvelope({
        code: 'DEADLINE_EXCEEDED',
        category: 'timeout',
        message: 'Deadline expired before synthesis could start.',
        retryable: true,
        correlationId: requestEnvelope.correlationId,
        causationId: requestEnvelope.messageId,
        sender: 'synthesizer',
        recipient: 'orchestrator',
        failedAtStage: 'synthesizer',
      });
    }

    const response = await askGroundedCivicAssistant(query, {
      serviceContextId: context.serviceContextId || null,
    });

    const sources = Array.isArray(response.data?.officialSources) ? response.data.officialSources : [];
    const lowEntailment = response.entailment ? !response.entailment.overallSupported : false;

    return createMessageEnvelope({
      correlationId: requestEnvelope.correlationId,
      causationId: requestEnvelope.messageId,
      messageType: 'proposal',
      sender: 'synthesizer',
      recipient: 'orchestrator',
      deadlineAt: requestEnvelope.deadlineAt,
      criticalFields: ['schemaVersion', 'messageType', 'correlationId', 'deadlineAt', 'requiresHumanApproval', 'provenance'],
      permissionScope: 'propose_guidance',
      requiresHumanApproval: Boolean(lowEntailment || response.status === 'unsupported'),
      provenance: {
        sources,
        retrievedChunkIds: (response.retrievedChunks || []).map((c) => c.chunkId).filter(Boolean),
        unverified: sources.length === 0,
      },
      payload: response,
    });
  },
};

/**
 * Fallback specialist adapter: deterministic keyword/FAQ assistant when primary
 * synthesis fails with a retryable error and deadline budget remains.
 */
export const fallbackAgentAdapter = {
  role: 'fallback',
  async invoke(requestEnvelope) {
    const query = String(requestEnvelope.payload?.sanitizedQuery || requestEnvelope.payload?.query || '');
    const remainingMs = Math.max(250, Date.parse(requestEnvelope.deadlineAt) - Date.now());
    const response = await askCivicAssistant(query, { timeoutMs: remainingMs });
    const sources = Array.isArray(response.data?.officialSources) && response.data.officialSources.length > 0
      ? response.data.officialSources
      : [{ name: 'National Government Services Portal', url: 'https://services.india.gov.in', verified: true }];

    return createMessageEnvelope({
      correlationId: requestEnvelope.correlationId,
      causationId: requestEnvelope.messageId,
      messageType: 'proposal',
      sender: 'fallback',
      recipient: 'orchestrator',
      deadlineAt: requestEnvelope.deadlineAt,
      permissionScope: 'propose_guidance',
      requiresHumanApproval: true,
      provenance: {
        sources,
        unverified: true,
      },
      payload: {
        ...response,
        grounded: false,
        data: {
          ...(response.data || {}),
          officialSources: sources,
          disclaimer: MANDATORY_LEGAL_DISCLAIMER,
        },
      },
    });
  },
};

export function createDefaultAgentRegistry() {
  return {
    guardrail: guardrailAgentAdapter,
    synthesizer: synthesizerAgentAdapter,
    fallback: fallbackAgentAdapter,
  };
}
