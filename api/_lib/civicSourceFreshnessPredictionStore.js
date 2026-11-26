/**
 * api/_lib/civicSourceFreshnessPredictionStore.js
 *
 * Store contract for the Civic Information Freshness Prediction and Review
 * Prioritization Engine API. Implements an in-memory store by default (no
 * Firebase required) so the API is fully testable and degrades gracefully when
 * Firestore is not configured. Persists only service-level feature aggregates,
 * priority scores and review audit records — never citizen records, credentials,
 * raw documents or sensitive prompts.
 */

export class FreshnessStoreError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/** In-memory implementation of the store contract. */
export class InMemoryFreshnessStore {
  constructor() {
    this.predictions = new Map();
    this.predictionHistory = [];
    this.reviewAudit = [];
    this.driftEvents = [];
  }

  async getPrediction(serviceId) {
    return this.predictions.get(serviceId) || null;
  }

  async setPrediction(prediction) {
    this.predictions.set(prediction.serviceId, prediction);
    return prediction;
  }

  async listPredictions({ band, status, limit = 50, cursor } = {}) {
    let items = Array.from(this.predictions.values());
    if (band) items = items.filter((p) => p.priorityBand === band);
    if (status) items = items.filter((p) => p.status === status);
    items.sort((a, b) => b.priorityScore - a.priorityScore || new Date(b.computedAt) - new Date(a.computedAt));
    const start = cursor ? items.findIndex((p) => p.id === cursor) + 1 : 0;
    const page = items.slice(start, start + limit);
    return { predictions: page, nextCursor: page.length === limit ? page[page.length - 1].id : null };
  }

  async addPredictionHistory(event) {
    this.predictionHistory.push(event);
    return event;
  }

  async listPredictionHistory({ serviceId, limit = 50 } = {}) {
    let items = this.predictionHistory;
    if (serviceId) items = items.filter((e) => e.serviceId === serviceId);
    return items.slice(0, limit);
  }

  async addReviewAudit(event) {
    this.reviewAudit.push(event);
    return event;
  }

  async listReviewAudit({ serviceId, limit = 50 } = {}) {
    let items = this.reviewAudit;
    if (serviceId) items = items.filter((e) => e.details && e.details.serviceId === serviceId);
    return items.slice(0, limit);
  }

  async addDriftEvent(event) {
    this.driftEvents.push(event);
    return event;
  }

  async listDriftEvents({ serviceId, limit = 50 } = {}) {
    let items = this.driftEvents;
    if (serviceId) items = items.filter((e) => e.serviceId === serviceId);
    return items.slice(0, limit);
  }
}

let defaultStore = null;
export function getDefaultFreshnessStore() {
  if (!defaultStore) defaultStore = new InMemoryFreshnessStore();
  return defaultStore;
}
export function resetDefaultFreshnessStoreForTests() {
  defaultStore = null;
}

export async function getProductionFreshnessStore() {
  // No Firestore integration in this repo today; degrade to in-memory so the
  // API still functions. When Firestore is added, implement here.
  return getDefaultFreshnessStore();
}
export function resetProductionFreshnessStoreCacheForTests() {
  resetDefaultFreshnessStoreForTests();
}
