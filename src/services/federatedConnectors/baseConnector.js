/**
 * src/services/federatedConnectors/baseConnector.js
 * Base Connector Adapter for Department-Owned Civic Datasets.
 *
 * Implements:
 * - Deterministic schema hashing for schema drift detection.
 * - Local push-down query execution (aggregation near data).
 * - Fault injection controls (simulated timeout, schema drift, latency) for testing resilience.
 */

export class BaseConnector {
  constructor({ id, name, code, category, schemaVersion = "1.0.0", schemaFields = [] }) {
    this.id = id;
    this.name = name;
    this.code = code;
    this.category = category;
    this.schemaVersion = schemaVersion;
    this.schemaFields = schemaFields;

    // Fault injection hooks for resilience testing
    this.simulatedLatencyMs = 0;
    this.shouldTimeout = false;
    this.shouldDriftSchema = false;
    this.shouldFail = false;
  }

  /**
   * Deterministic simple hash of schema fields to detect breaking structural drift.
   */
  getSchemaSignature() {
    const fields = this.shouldDriftSchema
      ? [...this.schemaFields, "unauthorized_drift_column_v2"]
      : this.schemaFields;

    const signatureRaw = `${this.id}:${this.schemaVersion}:${fields.sort().join(",")}`;
    let hash = 0x811c9dc5;
    for (let i = 0; i < signatureRaw.length; i += 1) {
      hash ^= signatureRaw.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return `SCHEMA-HASH-${(hash >>> 0).toString(16).toUpperCase()}`;
  }

  setFaultInjection({ latencyMs = 0, timeout = false, driftSchema = false, fail = false }) {
    this.simulatedLatencyMs = latencyMs;
    this.shouldTimeout = timeout;
    this.shouldDriftSchema = driftSchema;
    this.shouldFail = fail;
  }

  resetFaultInjection() {
    this.simulatedLatencyMs = 0;
    this.shouldTimeout = false;
    this.shouldDriftSchema = false;
    this.shouldFail = false;
  }

  /**
   * Abstract method to be implemented by department connectors.
   * Performs in-situ aggregation. Raw records are NEVER returned.
   */
  // eslint-disable-next-line no-unused-vars
  async executeLocalAggregate(filters, timeoutMs = 1500) {
    throw new Error(`executeLocalAggregate not implemented by connector ${this.id}`);
  }
}
