/**
 * api/_lib/handlers/digital-twin-simulations.js
 * Serverless API endpoint for the Civic Workflow Digital Twin (#1157).
 *
 * Validates untrusted input at service boundaries, rejects real citizen credentials/PII,
 * executes deterministic simulation runs and version comparisons, and returns sealed scenario reports.
 */

import {
  checkForbiddenFields,
  sanitizeSimulationPayload,
  validateWorkflowGraph,
} from '../../../src/data/digitalTwinContract.js';
import {
  validateWorkflowGraphIntegrity,
  simulatePersonaJourney,
  simulateCohort,
  compareWorkflowVersions,
  sanitizeDigitalTwinExport,
} from '../../../src/services/civicWorkflowDigitalTwinService.js';
import { SYNTHETIC_PERSONAS } from '../../../src/data/digitalTwinPersonas.js';
import { SEED_WORKFLOWS } from '../../../src/data/digitalTwinSeed.js';

export const SIMULATION_AUDIT_QUEUE = [];

/**
 * Validates untrusted HTTP request payload at API boundary.
 *
 * @param {object} body
 * @returns {string[]} Validation errors
 */
export function validateSimulationApiRequest(body) {
  if (!body || typeof body !== 'object') {
    return ['Request body must be a valid JSON object'];
  }

  const errors = [];

  // Strict PII check
  const piiViolations = checkForbiddenFields(body, 'API request body');
  if (piiViolations.length > 0) {
    errors.push(...piiViolations);
  }

  const action = body.action || 'SIMULATE';
  if (!['SIMULATE', 'COMPARE', 'VALIDATE_ONLY'].includes(action)) {
    errors.push(`Invalid action "${action}". Expected one of: SIMULATE, COMPARE, VALIDATE_ONLY`);
  }

  if (action === 'COMPARE') {
    if (!body.baseWorkflow || typeof body.baseWorkflow !== 'object') {
      errors.push('Action "COMPARE" requires a valid "baseWorkflow" object');
    }
    if (!body.proposedWorkflow || typeof body.proposedWorkflow !== 'object') {
      errors.push('Action "COMPARE" requires a valid "proposedWorkflow" object');
    }
  } else {
    if (!body.workflow && !body.workflowId) {
      errors.push('Request must specify either "workflow" graph object or "workflowId" string');
    }
  }

  return errors;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    return res.status(200).json({
      service: 'civic-workflow-digital-twin',
      status: 'HEALTHY',
      availableWorkflows: SEED_WORKFLOWS.map((w) => ({
        id: w.id,
        title: w.title,
        version: w.version,
        serviceId: w.serviceId,
      })),
      availablePersonas: SYNTHETIC_PERSONAS.map((p) => ({
        id: p.id,
        name: p.name,
        archetype: p.archetype,
        isSynthetic: p.isSynthetic,
      })),
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const rawBody = req.body || {};
  const validationErrors = validateSimulationApiRequest(rawBody);

  if (validationErrors.length > 0) {
    return res.status(400).json({
      error: 'Invalid Simulation Request',
      details: validationErrors,
    });
  }

  const sanitizedBody = sanitizeSimulationPayload(rawBody);
  const action = sanitizedBody.action || 'SIMULATE';

  try {
    if (action === 'COMPARE') {
      const baseCheck = validateWorkflowGraph(sanitizedBody.baseWorkflow);
      const proposedCheck = validateWorkflowGraph(sanitizedBody.proposedWorkflow);

      if (!baseCheck.isValid || !proposedCheck.isValid) {
        return res.status(422).json({
          error: 'Unprocessable Workflow Schema',
          baseErrors: baseCheck.errors,
          proposedErrors: proposedCheck.errors,
        });
      }

      const personas = Array.isArray(sanitizedBody.personas) && sanitizedBody.personas.length > 0
        ? sanitizedBody.personas
        : SYNTHETIC_PERSONAS;

      const comparison = compareWorkflowVersions(
        sanitizedBody.baseWorkflow,
        sanitizedBody.proposedWorkflow,
        personas
      );

      return res.status(200).json({
        success: true,
        action: 'COMPARE',
        comparison: sanitizeDigitalTwinExport(comparison),
      });
    }

    // Resolve target workflow
    let workflow = sanitizedBody.workflow;
    if (!workflow && sanitizedBody.workflowId) {
      workflow = SEED_WORKFLOWS.find((w) => w.id === sanitizedBody.workflowId);
      if (!workflow) {
        return res.status(404).json({ error: `Workflow with ID "${sanitizedBody.workflowId}" not found` });
      }
    }

    const graphValidation = validateWorkflowGraph(workflow);
    if (!graphValidation.isValid) {
      return res.status(422).json({
        error: 'Unprocessable Workflow Definition',
        errors: graphValidation.errors,
      });
    }

    if (action === 'VALIDATE_ONLY') {
      const integrity = validateWorkflowGraphIntegrity(workflow);
      return res.status(200).json({
        success: true,
        integrity,
      });
    }

    // Default: SIMULATE
    if (sanitizedBody.personaId && sanitizedBody.personaId !== 'ALL_COHORT') {
      const targetPersona = SYNTHETIC_PERSONAS.find((p) => p.id === sanitizedBody.personaId);
      if (!targetPersona) {
        return res.status(404).json({ error: `Synthetic persona "${sanitizedBody.personaId}" not found` });
      }

      const singleResult = simulatePersonaJourney(workflow, targetPersona);
      return res.status(200).json({
        success: true,
        type: 'SINGLE_PERSONA',
        result: sanitizeDigitalTwinExport(singleResult),
      });
    }

    // Cohort simulation
    const cohortPersonas = Array.isArray(sanitizedBody.personas) && sanitizedBody.personas.length > 0
      ? sanitizedBody.personas
      : SYNTHETIC_PERSONAS;

    const cohortReport = simulateCohort(workflow, cohortPersonas);
    return res.status(200).json({
      success: true,
      type: 'COHORT',
      report: sanitizeDigitalTwinExport(cohortReport),
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Digital Twin Simulation Failed',
      message: err.message || 'Internal simulation error',
    });
  }
}
