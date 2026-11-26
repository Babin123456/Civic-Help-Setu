/**
 * Simulation Contracts & Input Validation at Service Boundaries
 * Issue #1156: Explainable Eligibility Simulation Engine with Counterfactuals
 *
 * Enforces typed, validated schemas for rule graphs, input payloads,
 * and condition outcomes while preventing PII exposure.
 */

import { FORBIDDEN_FIELDS } from '../data/serviceContract.js';

export const SIMULATION_SCHEMA_VERSION = '1.0.0';

export const CONDITION_TYPES = Object.freeze([
  'THRESHOLD',
  'BOOLEAN',
  'CHOICE',
  'DATE_BOUNDARY',
  'DOCUMENT_PREREQUISITE',
]);

export const CONDITION_STATES = Object.freeze([
  'satisfied',
  'unsatisfied',
  'unknown',
  'conflicting',
  'needs_official_verification',
]);

export const SIMULATION_STATUSES = Object.freeze([
  'ELIGIBLE',
  'CONDITIONAL',
  'INELIGIBLE',
  'INCONCLUSIVE',
]);

/** Specification for allowed simulation input attributes */
export const ALLOWED_SIMULATION_FIELDS = Object.freeze({
  age: { type: 'number', min: 0, max: 120, mutable: false },
  annualIncome: { type: 'number', min: 0, max: 100000000, mutable: true },
  employment: {
    type: 'choice',
    options: ['salaried', 'self-employed', 'farmer', 'student', 'unemployed', 'homemaker', 'informal_worker'],
    mutable: true,
  },
  category: {
    type: 'choice',
    options: ['General', 'EWS', 'OBC', 'SC', 'ST'],
    mutable: false,
  },
  state: { type: 'string', maxLength: 80, mutable: false },
  isStudent: { type: 'boolean', mutable: true },
  ownsAgriculturalLand: { type: 'boolean', mutable: true },
  landholdingHectares: { type: 'number', min: 0, max: 1000, mutable: true },
  ownsPuccaHouse: { type: 'boolean', mutable: true },
  hasBplCard: { type: 'boolean', mutable: true },
  hasAadhaar: { type: 'boolean', mutable: true },
  hasPan: { type: 'boolean', mutable: true },
  hasIncomeCertificate: { type: 'boolean', mutable: true },
  hasCasteCertificate: { type: 'boolean', mutable: true },
  hasLearnerLicense: { type: 'boolean', mutable: true },
  hasHospitalBirthSlip: { type: 'boolean', mutable: true },
  birthRegistrationDays: { type: 'number', min: 0, max: 36500, mutable: true },
  disabilityPercentage: { type: 'number', min: 0, max: 100, mutable: false },
});

/**
 * Validates and sanitizes untrusted input before it reaches the simulation engine.
 * Rejects any presence of personal identifiers (Aadhaar, phone, etc.).
 *
 * @param {Object} input - Raw user or hypothetical input
 * @returns {Object} Cleaned, type-coerced simulation profile
 * @throws {Error} If forbidden fields are present or validation strictly fails
 */
export function sanitizeSimulationInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  // 1. Strict PII & Forbidden Fields Guard (Threat Model T-SIM-02 & T7)
  const inputKeys = Object.keys(input);
  const detectedForbidden = inputKeys.filter((key) =>
    FORBIDDEN_FIELDS.includes(key) ||
    /^(aadhaar|pan|phone|email|mobile|token|password|secret|voter|dob|birthDate)/i.test(key)
  );

  if (detectedForbidden.length > 0) {
    throw new Error(
      `Untrusted input contains forbidden identity fields: [${detectedForbidden.join(', ')}]. Simulation requires strictly synthetic or anonymized criteria.`
    );
  }

  // 2. Allow-list filtering and type coercion
  const sanitized = {};
  for (const [key, spec] of Object.entries(ALLOWED_SIMULATION_FIELDS)) {
    if (!(key in input)) {
      continue;
    }

    const rawVal = input[key];
    if (rawVal === '' || rawVal === null || rawVal === undefined) {
      sanitized[key] = null;
      continue;
    }

    if (spec.type === 'number') {
      const num = Number(rawVal);
      if (!Number.isFinite(num)) {
        sanitized[key] = null;
      } else {
        sanitized[key] = Math.min(Math.max(num, spec.min), spec.max);
      }
    } else if (spec.type === 'boolean') {
      sanitized[key] = Boolean(rawVal);
    } else if (spec.type === 'choice') {
      const strVal = String(rawVal).trim();
      sanitized[key] = spec.options.includes(strVal) ? strVal : null;
    } else if (spec.type === 'string') {
      sanitized[key] = String(rawVal).trim().slice(0, spec.maxLength);
    }
  }

  return sanitized;
}

/**
 * Validates the schema and acyclic structure of a versioned RuleGraph.
 *
 * @param {Object} graph - The RuleGraph to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRuleGraph(graph) {
  const errors = [];

  if (!graph || typeof graph !== 'object') {
    return { valid: false, errors: ['Rule graph must be a non-null object.'] };
  }

  if (!graph.id || typeof graph.id !== 'string') {
    errors.push('Rule graph requires a valid string id.');
  }

  if (!graph.version || typeof graph.version !== 'string') {
    errors.push('Rule graph requires a semver version string.');
  }

  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    errors.push('Rule graph must contain at least one condition node.');
    return { valid: false, errors };
  }

  const nodeMap = new Map();
  for (const node of graph.nodes) {
    if (!node.id || typeof node.id !== 'string') {
      errors.push(`Invalid node missing string id: ${JSON.stringify(node)}`);
      continue;
    }
    if (nodeMap.has(node.id)) {
      errors.push(`Duplicate node id: "${node.id}".`);
    }
    nodeMap.set(node.id, node);

    if (!CONDITION_TYPES.includes(node.type)) {
      errors.push(`Node "${node.id}" has invalid type "${node.type}".`);
    }

    if (typeof node.evaluate !== 'function') {
      errors.push(`Node "${node.id}" must provide an evaluate(profile) function.`);
    }

    if (!node.citation || typeof node.citation !== 'object') {
      errors.push(`Node "${node.id}" must include a statutory citation object.`);
    } else if (!node.citation.authority || !node.citation.orderNo) {
      errors.push(`Node "${node.id}" citation must include authority and orderNo.`);
    }
  }

  // 3. Cycle Detection (DAG check)
  const visited = new Set();
  const recursionStack = new Set();

  function checkCycle(nodeId) {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const node = nodeMap.get(nodeId);
    const deps = Array.isArray(node?.dependsOn) ? node.dependsOn : [];

    for (const depId of deps) {
      if (!nodeMap.has(depId)) {
        errors.push(`Node "${nodeId}" depends on non-existent node "${depId}".`);
        continue;
      }
      if (!visited.has(depId)) {
        if (checkCycle(depId)) return true;
      } else if (recursionStack.has(depId)) {
        errors.push(`Cyclic dependency detected involving node "${nodeId}" and "${depId}".`);
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const nodeId of nodeMap.keys()) {
    if (!visited.has(nodeId)) {
      checkCycle(nodeId);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
