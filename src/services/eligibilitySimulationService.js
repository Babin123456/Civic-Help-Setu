/**
 * Explainable Eligibility Simulation Engine
 * Issue #1156: Explainable Eligibility Simulation Engine with Counterfactuals
 *
 * Implements a pure, deterministic simulation engine that evaluates citizen
 * profiles against versioned statutory Rule Graphs, performs boundary date
 * calculations, detects conflicting documentation, and generates actionable
 * counterfactuals for what-if scenarios.
 */

import { sanitizeSimulationInput } from './simulationContracts.js';
import { getRuleGraph, listRegisteredGraphs } from './ruleGraphRegistry.js';
import { generateCounterfactuals } from './counterfactualEngine.js';
import { logDiagnostic } from '../utils/diagnostics.js';

export { listRegisteredGraphs, getRuleGraph };

export const OFFICIAL_DETERMINATION_DISCLAIMER = Object.freeze(
  'STATUTORY NOTICE: This eligibility simulation is an educational guidance tool grounded strictly in published scheme guidelines and hypothetical profile inputs. It does NOT constitute an official legal determination, benefit sanction, or administrative rejection. Official determinations rest exclusively with the designated competent government authority upon verification of original records.'
);

/**
 * Pure evaluator for a single rule graph without counterfactual generation overhead.
 * Used internally by the counterfactual search engine for rapid what-if permutations.
 *
 * @param {Object} graph - The RuleGraph definition
 * @param {Object} profile - Sanitized profile
 * @returns {{ status: string, criteria: Array<Object>, hasConflicts: boolean }}
 */
export function evaluateGraphDirect(graph, profile) {
  const criteria = [];
  let hasUnsatisfied = false;
  let hasUnknown = false;
  let hasConflicting = false;
  let hasNeedsVerification = false;

  for (const node of graph.nodes) {
    let outcome;
    try {
      outcome = node.evaluate(profile);
    } catch (err) {
      outcome = {
        state: 'unknown',
        detail: `Evaluator error on node "${node.id}": ${err.message}`,
      };
    }

    const state = outcome.state || 'unknown';
    if (state === 'unsatisfied') hasUnsatisfied = true;
    if (state === 'unknown') hasUnknown = true;
    if (state === 'conflicting') hasConflicting = true;
    if (state === 'needs_official_verification') hasNeedsVerification = true;

    criteria.push({
      id: node.id,
      label: node.label,
      type: node.type,
      field: node.field,
      state,
      detail: outcome.detail || '',
      isBoundary: Boolean(outcome.isBoundary),
      boundaryNotice: outcome.boundaryNotice || null,
      conflict: outcome.conflict || null,
      citation: node.citation,
    });
  }

  let status = 'ELIGIBLE';
  if (hasUnsatisfied) {
    status = 'INELIGIBLE';
  } else if (hasConflicting) {
    status = 'INCONCLUSIVE';
  } else if (hasUnknown) {
    status = 'INCONCLUSIVE';
  } else if (hasNeedsVerification) {
    status = 'CONDITIONAL';
  }

  return {
    status,
    criteria,
    hasConflicts: hasConflicting,
  };
}

/**
 * Runs a complete explainable eligibility simulation for a specific scheme.
 *
 * @param {string} schemeId - The unique identifier of the scheme (e.g., 'pm-kisan')
 * @param {Object} rawProfile - Citizen input or hypothetical what-if parameters
 * @param {Object} [options] - Options (includeCounterfactuals: boolean, timeBudgetMs: number)
 * @returns {Object} Structured explainable simulation report
 */
export function simulateEligibility(schemeId, rawProfile, options = {}) {
  const includeCounterfactuals = options.includeCounterfactuals ?? true;

  try {
    const graph = getRuleGraph(schemeId);
    if (!graph) {
      return createErrorSimulationResult(schemeId, `Rule graph for scheme "${schemeId}" not found in registry.`);
    }

    // 1. Validate & sanitize input at boundary (Threat Model T-SIM-02)
    const sanitizedProfile = sanitizeSimulationInput(rawProfile);

    // 2. Evaluate criteria nodes
    const evaluation = evaluateGraphDirect(graph, sanitizedProfile);

    // 3. Extract boundary warnings and conflicting evidence
    const boundaryWarnings = evaluation.criteria
      .filter((c) => c.isBoundary && c.boundaryNotice)
      .map((c) => ({ id: c.id, label: c.label, notice: c.boundaryNotice }));

    const conflicts = evaluation.criteria
      .filter((c) => c.conflict)
      .map((c) => ({ id: c.id, label: c.label, conflict: c.conflict }));

    // 4. Compute counterfactuals for non-eligible states
    let counterfactuals = [];
    if (includeCounterfactuals && evaluation.status !== 'ELIGIBLE') {
      try {
        counterfactuals = generateCounterfactuals(
          graph,
          sanitizedProfile,
          (hypothetical) => evaluateGraphDirect(graph, hypothetical),
          { timeBudgetMs: options.timeBudgetMs ?? 25 }
        );
      } catch (cfErr) {
        logDiagnostic('counterfactual_generation_failed', cfErr);
      }
    }

    // 5. Build summary explanation
    const satisfiedCount = evaluation.criteria.filter((c) => c.state === 'satisfied').length;
    const totalCount = evaluation.criteria.length;

    return {
      success: true,
      schemeId: graph.id,
      schemeTitle: graph.title,
      version: graph.version,
      ministry: graph.ministry,
      benefitSummary: graph.benefitSummary,
      status: evaluation.status,
      timestamp: new Date().toISOString(),
      score: {
        satisfied: satisfiedCount,
        total: totalCount,
        percentage: Math.round((satisfiedCount / totalCount) * 100),
      },
      criteria: evaluation.criteria,
      boundaryWarnings,
      conflicts,
      counterfactuals,
      evaluatedProfile: sanitizedProfile,
      disclaimer: OFFICIAL_DETERMINATION_DISCLAIMER,
    };
  } catch (error) {
    logDiagnostic('eligibility_simulation_error', error);
    return createErrorSimulationResult(schemeId, error.message);
  }
}

/**
 * Runs simulations across all registered schemes.
 *
 * @param {Object} rawProfile - Citizen input profile
 * @param {Object} [options]
 * @returns {Array<Object>} List of simulation results
 */
export function simulateAllRegisteredSchemes(rawProfile, options = {}) {
  const registered = listRegisteredGraphs();
  return registered.map((meta) => simulateEligibility(meta.id, rawProfile, options));
}

function createErrorSimulationResult(schemeId, message) {
  return {
    success: false,
    schemeId,
    schemeTitle: schemeId,
    version: '0.0.0',
    status: 'INCONCLUSIVE',
    timestamp: new Date().toISOString(),
    error: message,
    criteria: [],
    boundaryWarnings: [],
    conflicts: [],
    counterfactuals: [],
    disclaimer: OFFICIAL_DETERMINATION_DISCLAIMER,
  };
}
