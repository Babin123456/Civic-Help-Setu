/**
 * src/services/civicSourceFreshnessPredictionService.js
 *
 * Client-facing service for the Civic Information Freshness Prediction and
 * Review Prioritization Engine (#1189). Wraps the local prediction engine
 * (in-memory / localStorage-backed store) so the workspace operates fully in
 * the browser. When a server backend is added, these functions can be switched
 * to fetch /api/civic-source-freshness-prediction endpoints without changing
 * the UI.
 *
 * Persists only service-level feature aggregates, priority scores and review
 * audit records. No citizen records, credentials, raw documents or sensitive
 * prompts are sent or stored.
 */

import { createFreshnessPredictionEngine } from './civicSourceFreshnessPredictionEngine.js';
import {
  FRESHNESS_PREDICTION_STATUS,
  PRIORITY_BAND,
  PRIORITY_THRESHOLDS,
  DEFAULT_FEATURE_WEIGHTS
} from '../data/civicSourceFreshnessPredictionConstants.js';

const engine = createFreshnessPredictionEngine();

export async function predict(input = {}) {
  return engine.predict(input);
}

export async function reviewPrediction(input = {}) {
  return engine.reviewPrediction(input);
}

export async function getPrediction(serviceId) {
  return engine.getPrediction(serviceId);
}

export async function listPredictions(input = {}) {
  return engine.listPredictions(input);
}

export async function getReviewAudit(input = {}) {
  return engine.getReviewAudit(input);
}

export async function getDriftEvents(input = {}) {
  return engine.getDriftEvents(input);
}

export async function recordDriftEvent(input = {}) {
  return engine.recordDriftEvent(input);
}

export async function listFeatureWeights() {
  return engine.listFeatureWeights();
}

export { engine, createFreshnessPredictionEngine };

export {
  FRESHNESS_PREDICTION_STATUS,
  PRIORITY_BAND,
  PRIORITY_THRESHOLDS,
  DEFAULT_FEATURE_WEIGHTS
};

export default {
  predict,
  reviewPrediction,
  getPrediction,
  listPredictions,
  getReviewAudit,
  getDriftEvents,
  recordDriftEvent,
  listFeatureWeights
};
