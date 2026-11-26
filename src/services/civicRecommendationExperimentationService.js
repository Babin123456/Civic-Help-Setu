/**
 * src/services/civicRecommendationExperimentationService.js
 *
 * Client-facing service for the Civic Service Recommendation Experimentation
 * Platform with Guardrails (#1193). Wraps the local experimentation engine
 * (in-memory / localStorage-backed store) so the workspace operates fully in the browser.
 * When server endpoints are available, these can map to /api/civic-recommendation-experimentation.
 *
 * Persists only experiment metadata, variant weights, guardrail thresholds,
 * privacy-safe aggregate counters, and audit logs. No citizen records or prompts
 * are stored or logged. Prohibited sensitive attributes are blocked.
 */

import {
  createRecommendationExperimentationEngine,
  recommendationExperimentationEngine
} from './civicRecommendationExperimentationEngine.js';

const engine = recommendationExperimentationEngine;

export async function upsertExperiment(experimentData = {}) {
  return engine.upsertExperiment(experimentData);
}

export async function getExperiment(experimentId) {
  return engine.getExperiment(experimentId);
}

export async function listExperiments() {
  return engine.listExperiments();
}

export async function assignVariant(input = {}) {
  return engine.assignVariant(input);
}

export async function recordMetric(input = {}) {
  return engine.recordMetric(input);
}

export async function rollbackExperiment(input = {}) {
  return engine.rollbackExperiment(input);
}

export async function getExperimentMetrics(experimentId) {
  return engine.getExperimentMetrics(experimentId);
}

export async function getAuditLog(input = {}) {
  return engine.getAuditLog(input);
}

export { engine, createRecommendationExperimentationEngine };

export {
  CIVIC_EXPERIMENTATION_SCHEMA_VERSION,
  CIVIC_EXPERIMENTATION_STORAGE_KEY,
  CIVIC_EXPERIMENTATION_DISCLAIMER,
  EXPERIMENT_STATUS,
  EXPERIMENTATION_ERRORS,
  GUARDRAIL_METRIC_TYPE,
  PROHIBITED_TARGETING_ATTRIBUTES,
  DEFAULT_GUARDRAILS,
  DEFAULT_VARIANT,
  DEFAULT_EXPERIMENT
} from '../data/civicRecommendationExperimentationConstants.js';

export default {
  upsertExperiment,
  getExperiment,
  listExperiments,
  assignVariant,
  recordMetric,
  rollbackExperiment,
  getExperimentMetrics,
  getAuditLog
};
