/**
 * Provider-neutral AI adapter for Durable Civic Agent Workflows (ADR-1149).
 * Separates model/retrieval execution from state commits, enforces timeouts,
 * scrubs PII before inference, and validates proposals against scope boundaries.
 */

import { runPreInferenceGuardrails, GUARDRAIL_DECISION } from '../ai/aiGuardrailPipeline.js';
import { WORKFLOW_LIMITS, validateProposalScope } from './workflowContracts.js';

export function createCivicWorkflowAdapter({
  invokeProvider,
  timeoutMs = WORKFLOW_LIMITS.DEFAULT_TIMEOUT_MS,
} = {}) {
  if (typeof invokeProvider !== 'function') {
    throw new TypeError('createCivicWorkflowAdapter requires an invokeProvider function');
  }

  return {
    async proposeStep({ workflowType, query, serviceId, signal }) {
      const guardrail = runPreInferenceGuardrails(query);
      if (guardrail.decision === GUARDRAIL_DECISION.BLOCK) {
        return {
          ok: false,
          retryable: false,
          code: 'guardrail_blocked',
          sanitizedReason: 'Input blocked by safety guardrail.',
        };
      }

      const safeQuery = guardrail.sanitizedQuery || query;
      let timerId;
      const timeoutPromise = new Promise((_, reject) => {
        timerId = setTimeout(() => {
          const err = new Error('Provider call timed out');
          err.code = 'provider_timeout';
          reject(err);
        }, timeoutMs);
      });

      try {
        const raw = await Promise.race([
          invokeProvider({ workflowType, query: safeQuery, serviceId, signal }),
          timeoutPromise,
        ]);

        const proposal = {
          summary: raw?.summary ?? '',
          citations: Array.isArray(raw?.citations) ? raw.citations : [],
          provenance: raw?.provenance ?? 'provider_adapter',
          untrustedProposal: true,
        };

        const scopeCheck = validateProposalScope(proposal);
        if (!scopeCheck.valid) {
          return {
            ok: false,
            retryable: false,
            code: scopeCheck.reason,
            sanitizedReason: `Proposal rejected by scope boundary (${scopeCheck.reason}).`,
          };
        }

        return { ok: true, proposal };
      } catch (err) {
        const code = err?.code === 'provider_timeout' ? 'provider_timeout' : 'provider_unavailable';
        return {
          ok: false,
          retryable: true,
          code,
          sanitizedReason: code === 'provider_timeout'
            ? `Provider exceeded ${timeoutMs}ms timeout.`
            : 'Model provider temporarily unavailable.',
        };
      } finally {
        clearTimeout(timerId);
      }
    },
  };
}

/**
 * Deterministic local grounded provider using verified civic catalogue entries.
 * Suitable as the default provider when no external LLM is configured.
 */
export function createGroundedLocalProvider(services = []) {
  return async ({ workflowType, query, serviceId }) => {
    const lower = String(query || '').toLowerCase();
    const matched =
      services.find((s) => s.id === serviceId) ||
      services.find((s) =>
        (s.title || '').toLowerCase().includes(lower) ||
        (s.category || '').toLowerCase().includes(lower)
      ) ||
      services[0];

    const title = matched?.title || 'General Civic Service Guidance';
    const sourceUrl = matched?.officialPortalUrl || 'https://services.india.gov.in';

    return {
      summary: `Prepared ${workflowType.replace(/_/g, ' ')} draft for "${title}" based on verified catalogue guidance. Human review is required before taking any external action.`,
      citations: [
        {
          id: matched?.id || 'national-portal',
          title,
          url: sourceUrl,
          verified: true,
        },
      ],
      provenance: 'local_grounded_catalogue',
    };
  };
}
