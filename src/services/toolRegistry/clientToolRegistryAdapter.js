/**
 * Browser-safe adapter connecting Assistant & Admin UIs to the Governed Tool Registry (#1146).
 *
 * Uses `/api/agent-tool-registry` when a verified backend bearer token is available,
 * and falls back to an isolated in-memory local sandbox registry (ephemeral session secret,
 * never a hardcoded production key) when running offline or in static demo mode.
 */

import { civicAgentIncidentResponse } from '../incidentResponse/civicAgentIncidentResponseService.js';
import { generateNonceId } from './capabilityService.js';
import { createGovernedToolRegistry } from './governedToolRegistry.js';
import { KNOWN_VALID_SERVICE_IDS } from './toolContracts.js';

let localSandboxRegistry = null;

export function getLocalSandboxToolRegistry() {
  if (!localSandboxRegistry) {
    const ephemeralSecret = `sandbox-only-${generateNonceId('key')}`;
    localSandboxRegistry = createGovernedToolRegistry({
      secret: ephemeralSecret,
      incidentResponse: civicAgentIncidentResponse,
    });
  }
  return localSandboxRegistry;
}

export function resetLocalSandboxToolRegistryForTests() {
  localSandboxRegistry = null;
}

/**
 * Builds candidate governed tool proposals for a grounded assistant response.
 */
export function buildGovernedToolProposals({ serviceId, title, officialSources = [] } = {}) {
  const validServiceId = KNOWN_VALID_SERVICE_IDS.includes(serviceId) ? serviceId : null;
  const primarySource = Array.isArray(officialSources) && officialSources.length > 0
    ? officialSources[0]
    : { name: 'National Government Services Portal', url: 'https://services.india.gov.in', verified: true };

  const proposals = [];
  if (validServiceId) {
    proposals.push({
      id: `prop-lookup-${validServiceId}`,
      toolName: 'lookupServiceDetails',
      label: `Verify Official Checklist (${title || validServiceId})`,
      riskTier: 'LOW',
      requiresCitizenConfirmation: false,
      args: { serviceId: validServiceId },
      provenance: { sources: [primarySource] },
    });
    proposals.push({
      id: `prop-draft-${validServiceId}`,
      toolName: 'saveApplicationDraft',
      label: `Stage Preparation Draft (${title || validServiceId})`,
      riskTier: 'MEDIUM',
      requiresCitizenConfirmation: true,
      args: {
        serviceId: validServiceId,
        caseId: `case-${validServiceId}`,
        formData: {
          applicantLabel: 'Citizen Draft Session',
          checklistCompleted: false,
          notes: 'Prepared via Civic Help Setu Assistant (requires citizen review).',
        },
      },
      provenance: { sources: [primarySource] },
    });
  }
  return proposals;
}

/**
 * Issues a short-lived capability and executes a governed tool proposal either via
 * the serverless API (when authToken is provided) or the local sandbox registry.
 */
export async function executeGovernedToolProposal({
  proposal,
  actorUserId = 'local-citizen-session',
  actorRole = 'citizen',
  sessionId = 'assistant-session',
  citizenConfirmed = false,
  authToken = null,
  fetchImpl = typeof fetch === 'function' ? fetch : null,
}) {
  if (!proposal || !proposal.toolName) {
    return { ok: false, code: 'UNKNOWN_TOOL', error: 'No governed tool proposal selected.' };
  }

  if (authToken && fetchImpl) {
    try {
      const capRes = await fetchImpl('/api/agent-tool-registry/capabilities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          toolName: proposal.toolName,
          sessionId,
          citizenConfirmed,
          provenanceRef: proposal.provenance?.sources?.[0]?.url || null,
          boundArgs: proposal.args,
        }),
      });
      const capBody = await capRes.json();
      if (!capRes.ok || !capBody.capabilityToken) {
        return {
          ok: false,
          code: capBody.code || 'CAPABILITY_DENIED',
          error: capBody.error || 'Capability request denied by server policy.',
        };
      }

      const invRes = await fetchImpl('/api/agent-tool-registry/invoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          capabilityToken: capBody.capabilityToken,
          toolName: proposal.toolName,
          args: proposal.args,
          sessionId,
          citizenConfirmed,
          provenance: proposal.provenance || null,
        }),
      });
      return await invRes.json();
    } catch {
      // Fall through cleanly if offline
    }
  }

  const registry = getLocalSandboxToolRegistry();
  const cap = registry.issueCapability({
    actorUserId,
    actorRole,
    sessionId,
    toolName: proposal.toolName,
    citizenConfirmed,
    provenanceRef: proposal.provenance?.sources?.[0]?.url || null,
    boundArgs: proposal.args,
    correlationId: `ui-${proposal.id || proposal.toolName}`,
  });

  if (!cap.ok) {
    return { ok: false, code: cap.code, error: cap.reason };
  }

  return registry.invokeTool({
    capabilityToken: cap.capabilityToken,
    toolName: proposal.toolName,
    args: proposal.args,
    actorUserId,
    actorRole,
    sessionId,
    citizenConfirmed,
    provenance: proposal.provenance || null,
    correlationId: `ui-${proposal.id || proposal.toolName}`,
  });
}
