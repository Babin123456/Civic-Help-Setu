/**
 * src/data/digitalTwinContract.js
 * Domain model, enums, schema validation, forbidden PII protection,
 * and contract integrity checks for the Civic Workflow Digital Twin (#1157).
 */

export const DIGITAL_TWIN_SCHEMA_VERSION = '1.0.0';

/**
 * Node categories within a civic workflow graph.
 */
export const NODE_TYPES = Object.freeze({
  SERVICE_STEP: 'SERVICE_STEP',
  DOCUMENT_REQUIREMENT: 'DOCUMENT_REQUIREMENT',
  OFFICE_DESK: 'OFFICE_DESK',
  DECISION_GATEWAY: 'DECISION_GATEWAY',
  TERMINAL_STATE: 'TERMINAL_STATE',
});

/**
 * Terminal statuses for journeys through a workflow.
 */
export const TERMINAL_STATUSES = Object.freeze({
  APPROVED: {
    id: 'APPROVED',
    label: 'Journey Completed / Service Delivered',
    badgeClass: 'badge-success',
    isSuccess: true,
  },
  REJECTED_WITH_REMEDY: {
    id: 'REJECTED_WITH_REMEDY',
    label: 'Deficiency Notice with Remedy Guidance',
    badgeClass: 'badge-warning',
    isSuccess: false,
  },
  DEAD_END_TERMINATION: {
    id: 'DEAD_END_TERMINATION',
    label: 'Dead-End Termination (No Exit / Impossible Step)',
    badgeClass: 'badge-danger',
    isSuccess: false,
  },
  SLA_EXCEEDED: {
    id: 'SLA_EXCEEDED',
    label: 'Statutory SLA Exceeded / Abandoned',
    badgeClass: 'badge-secondary',
    isSuccess: false,
  },
});

/**
 * Edge connection types between workflow nodes.
 */
export const EDGE_TYPES = Object.freeze({
  SEQUENTIAL_STEP: 'SEQUENTIAL_STEP',
  REQUIRES_DOCUMENT: 'REQUIRES_DOCUMENT',
  PROCEEDS_TO_OFFICE: 'PROCEEDS_TO_OFFICE',
  CONDITIONAL_BRANCH: 'CONDITIONAL_BRANCH',
  REMEDY_FALLBACK: 'REMEDY_FALLBACK',
});

/**
 * Synthetic Persona Archetypes for Stress Testing.
 */
export const PERSONA_ARCHETYPES = Object.freeze({
  STANDARD_CITIZEN: 'STANDARD_CITIZEN',
  MIGRANT_TENANT: 'MIGRANT_TENANT',
  SENIOR_CITIZEN_BIOMETRIC_FAIL: 'SENIOR_CITIZEN_BIOMETRIC_FAIL',
  LOW_INCOME_STUDENT: 'LOW_INCOME_STUDENT',
  ACCESSIBILITY_CONSTRAINED: 'ACCESSIBILITY_CONSTRAINED',
});

/**
 * Simulation Run Outcome Codes.
 */
export const SIMULATION_OUTCOMES = Object.freeze({
  SUCCESS: 'SUCCESS',
  FAILED_REQUISITE: 'FAILED_REQUISITE',
  DEAD_END: 'DEAD_END',
  SLA_BREACH: 'SLA_BREACH',
  UNREACHABLE_STEP: 'UNREACHABLE_STEP',
});

/**
 * Severity levels for workflow changes comparing vOld and vNew.
 */
export const WORKFLOW_CHANGE_SEVERITY = Object.freeze({
  BREAKING_DEAD_END: {
    level: 'CRITICAL',
    label: 'Breaking Dead End Detected',
    description: 'Introduces unreachable steps or unresolvable prerequisites.',
  },
  REGRESSION_EXCLUSION: {
    level: 'HIGH',
    label: 'Persona Cohort Excluded',
    description: 'A persona that previously completed the service now fails.',
  },
  SLA_INFLATION: {
    level: 'MEDIUM',
    label: 'SLA / Journey Duration Increase',
    description: 'Adds extra counter visits or significantly prolongs processing.',
  },
  BENIGN_RESTRUCTURING: {
    level: 'LOW',
    label: 'Benign Flow Improvement',
    description: 'Non-breaking changes, digitizations, or documentation updates.',
  },
});

/**
 * Forbidden fields that MUST NEVER appear in synthetic persona records,
 * simulation traces, or workflow definitions. This enforces strict privacy
 * boundaries and prevents real citizen PII or credentials from entering the Digital Twin.
 */
export const FORBIDDEN_SIMULATION_FIELDS = Object.freeze([
  'aadhaarNumber',
  'aadhaar',
  'panNumber',
  'pan',
  'passportNumber',
  'voterId',
  'epicNumber',
  'bankAccount',
  'accountNumber',
  'ifsc',
  'biometricPayload',
  'fingerprintTemplate',
  'irisScan',
  'otp',
  'password',
  'secret',
  'apiKey',
  'token',
  'creditCard',
  'cvv',
  'ssn',
]);

/**
 * Validates that an object does not contain any forbidden PII or credential fields.
 *
 * @param {object} obj - Object to check
 * @param {string} context - Context string for error reporting
 * @returns {string[]} List of violation errors
 */
export function checkForbiddenFields(obj, context = 'record') {
  if (!obj || typeof obj !== 'object') return [];
  const errors = [];
  const lowerForbidden = new Set(FORBIDDEN_SIMULATION_FIELDS.map((f) => f.toLowerCase()));

  function recurse(current, path) {
    if (!current || typeof current !== 'object') return;
    for (const [key, val] of Object.entries(current)) {
      const fullPath = path ? `${path}.${key}` : key;
      if (lowerForbidden.has(key.toLowerCase())) {
        errors.push(`Forbidden citizen PII/credential field "${fullPath}" is prohibited in ${context}`);
      }
      if (val && typeof val === 'object') {
        recurse(val, fullPath);
      }
    }
  }

  recurse(obj, '');
  return errors;
}

/**
 * Validates a single node in the workflow graph.
 *
 * @param {object} node
 * @returns {string[]} List of validation error strings
 */
export function validateWorkflowNode(node) {
  if (!node || typeof node !== 'object') {
    return ['Node must be a non-null object'];
  }
  const errors = [];

  if (!node.id || typeof node.id !== 'string' || !node.id.trim()) {
    errors.push('Node must have a valid non-empty string "id"');
  }
  if (!node.label || typeof node.label !== 'string' || !node.label.trim()) {
    errors.push(`Node "${node.id || 'unknown'}" must have a non-empty string "label"`);
  }
  if (!node.type || !Object.values(NODE_TYPES).includes(node.type)) {
    errors.push(`Node "${node.id || 'unknown'}" has invalid type "${node.type}". Expected one of: ${Object.values(NODE_TYPES).join(', ')}`);
  }

  // Type-specific requirements
  if (node.type === NODE_TYPES.SERVICE_STEP) {
    if (typeof node.estimatedDays !== 'number' || node.estimatedDays < 0) {
      errors.push(`SERVICE_STEP node "${node.id}" must specify numeric estimatedDays >= 0`);
    }
  }

  if (node.type === NODE_TYPES.TERMINAL_STATE) {
    if (!node.terminalStatus || !Object.values(TERMINAL_STATUSES).some((s) => s.id === node.terminalStatus)) {
      errors.push(`TERMINAL_STATE node "${node.id}" must have a valid terminalStatus`);
    }
  }

  // Ensure no forbidden PII
  errors.push(...checkForbiddenFields(node, `node "${node.id || 'unknown'}"`));

  return errors;
}

/**
 * Validates a single edge in the workflow graph.
 *
 * @param {object} edge
 * @param {Set<string>} existingNodeIds
 * @returns {string[]} List of validation error strings
 */
export function validateWorkflowEdge(edge, existingNodeIds) {
  if (!edge || typeof edge !== 'object') {
    return ['Edge must be a non-null object'];
  }
  const errors = [];

  if (!edge.id || typeof edge.id !== 'string') {
    errors.push('Edge must have a non-empty string "id"');
  }
  if (!edge.source || !existingNodeIds.has(edge.source)) {
    errors.push(`Edge "${edge.id || 'unknown'}" references non-existent source node "${edge.source}"`);
  }
  if (!edge.target || !existingNodeIds.has(edge.target)) {
    errors.push(`Edge "${edge.id || 'unknown'}" references non-existent target node "${edge.target}"`);
  }
  if (edge.source === edge.target) {
    errors.push(`Edge "${edge.id || 'unknown'}" cannot connect a node to itself (self-loop "${edge.source}")`);
  }
  if (!edge.type || !Object.values(EDGE_TYPES).includes(edge.type)) {
    errors.push(`Edge "${edge.id || 'unknown'}" has invalid type "${edge.type}". Expected one of: ${Object.values(EDGE_TYPES).join(', ')}`);
  }

  return errors;
}

/**
 * Validates an entire workflow definition.
 *
 * @param {object} workflow
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateWorkflowGraph(workflow) {
  if (!workflow || typeof workflow !== 'object') {
    return { isValid: false, errors: ['Workflow definition must be a valid object'] };
  }

  const errors = [];

  if (!workflow.id || typeof workflow.id !== 'string') {
    errors.push('Workflow must have a valid string "id"');
  }
  if (!workflow.version || typeof workflow.version !== 'string') {
    errors.push('Workflow must specify a semver-compatible "version" (e.g. "1.0.0")');
  }
  if (!workflow.serviceId || typeof workflow.serviceId !== 'string') {
    errors.push('Workflow must specify the target "serviceId"');
  }
  if (!workflow.title || typeof workflow.title !== 'string') {
    errors.push('Workflow must specify a descriptive "title"');
  }

  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  const edges = Array.isArray(workflow.edges) ? workflow.edges : [];

  if (nodes.length === 0) {
    errors.push('Workflow must contain at least one node');
  }

  const nodeIds = new Set();
  for (const node of nodes) {
    if (node && node.id) {
      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID detected: "${node.id}"`);
      }
      nodeIds.add(node.id);
    }
    errors.push(...validateWorkflowNode(node));
  }

  const edgeIds = new Set();
  for (const edge of edges) {
    if (edge && edge.id) {
      if (edgeIds.has(edge.id)) {
        errors.push(`Duplicate edge ID detected: "${edge.id}"`);
      }
      edgeIds.add(edge.id);
    }
    errors.push(...validateWorkflowEdge(edge, nodeIds));
  }

  // Ensure initial entry node exists
  if (!workflow.initialStepId || !nodeIds.has(workflow.initialStepId)) {
    errors.push(`Workflow initialStepId "${workflow.initialStepId}" is missing or does not match any node`);
  }

  // Check forbidden fields across the whole workflow
  errors.push(...checkForbiddenFields(workflow, 'workflow'));

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a synthetic persona fixture.
 *
 * @param {object} persona
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateSyntheticPersona(persona) {
  if (!persona || typeof persona !== 'object') {
    return { isValid: false, errors: ['Persona must be a non-null object'] };
  }

  const errors = [];

  if (!persona.id || typeof persona.id !== 'string') {
    errors.push('Persona must have a string "id"');
  }
  if (!persona.archetype || !Object.values(PERSONA_ARCHETYPES).includes(persona.archetype)) {
    errors.push(`Persona must specify a valid archetype. Received: "${persona.archetype}"`);
  }
  if (!persona.name || typeof persona.name !== 'string') {
    errors.push('Persona must have a synthetic string "name"');
  }
  if (!persona.isSynthetic) {
    errors.push('Persona must explicitly set "isSynthetic: true" to guarantee non-real test status');
  }
  if (!Array.isArray(persona.availableDocuments)) {
    errors.push('Persona must define an "availableDocuments" array of string keys');
  }
  if (typeof persona.attributes !== 'object' || persona.attributes === null) {
    errors.push('Persona must define an "attributes" object');
  }

  // Strictly enforce zero PII
  errors.push(...checkForbiddenFields(persona, `synthetic persona "${persona.id || 'unknown'}"`));

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitizes untrusted payload at service boundaries.
 *
 * @param {object} rawInput
 * @returns {object} Clean copy with forbidden keys stripped
 */
export function sanitizeSimulationPayload(rawInput) {
  if (!rawInput || typeof rawInput !== 'object') return {};
  const clean = JSON.parse(JSON.stringify(rawInput));

  function cleanObj(current) {
    if (!current || typeof current !== 'object') return;
    for (const key of Object.keys(current)) {
      if (FORBIDDEN_SIMULATION_FIELDS.some((f) => f.toLowerCase() === key.toLowerCase())) {
        delete current[key];
      } else if (current[key] && typeof current[key] === 'object') {
        cleanObj(current[key]);
      }
    }
  }

  cleanObj(clean);
  return clean;
}
