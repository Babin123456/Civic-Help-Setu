/**
 * Circuit Breaker for Model Gateway
 * Protects application from cascading provider failures, 429 rate-limits, and slow timeouts.
 */

import { CIRCUIT_STATE, GATEWAY_ERROR_CODES } from './gatewayTypes.js';

class ProviderCircuitBreaker {
  constructor({
    failureThreshold = 3,
    cooldownPeriodMs = 30000,
    defaultTimeoutMs = 4500,
  } = {}) {
    this.failureThreshold = failureThreshold;
    this.cooldownPeriodMs = cooldownPeriodMs;
    this.defaultTimeoutMs = defaultTimeoutMs;
    this.circuits = new Map();
  }

  _getOrCreateCircuit(providerId) {
    if (!this.circuits.has(providerId)) {
      this.circuits.set(providerId, {
        state: CIRCUIT_STATE.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastFailureTime: null,
        lastTestedTime: null,
        lastError: null,
      });
    }
    return this.circuits.get(providerId);
  }

  /**
   * Returns current state of the circuit for a provider.
   *
   * @param {string} providerId
   * @returns {string} One of CIRCUIT_STATE
   */
  getState(providerId) {
    const circuit = this._getOrCreateCircuit(providerId);

    if (circuit.state === CIRCUIT_STATE.OPEN) {
      const now = Date.now();
      if (circuit.lastFailureTime && now - circuit.lastFailureTime >= this.cooldownPeriodMs) {
        circuit.state = CIRCUIT_STATE.HALF_OPEN;
        circuit.successCount = 0;
      }
    }

    return circuit.state;
  }

  /**
   * Records a successful execution.
   *
   * @param {string} providerId
   */
  recordSuccess(providerId) {
    const circuit = this._getOrCreateCircuit(providerId);

    if (circuit.state === CIRCUIT_STATE.HALF_OPEN) {
      // In half-open, a successful response closes the circuit
      circuit.state = CIRCUIT_STATE.CLOSED;
      circuit.failureCount = 0;
      circuit.lastError = null;
    } else if (circuit.state === CIRCUIT_STATE.CLOSED) {
      circuit.failureCount = 0;
    }
  }

  /**
   * Records a failure (network error, timeout, 5xx, or 429).
   *
   * @param {string} providerId
   * @param {Error|Object} error
   */
  recordFailure(providerId, error = null) {
    const circuit = this._getOrCreateCircuit(providerId);
    circuit.failureCount += 1;
    circuit.lastFailureTime = Date.now();
    circuit.lastError = error ? (error.message || String(error)) : 'Unknown error';

    if (circuit.failureCount >= this.failureThreshold || circuit.state === CIRCUIT_STATE.HALF_OPEN) {
      circuit.state = CIRCUIT_STATE.OPEN;
    }
  }

  /**
   * Checks if execution can proceed for a provider.
   *
   * @param {string} providerId
   * @returns {boolean}
   */
  canExecute(providerId) {
    const state = this.getState(providerId);
    return state === CIRCUIT_STATE.CLOSED || state === CIRCUIT_STATE.HALF_OPEN;
  }

  /**
   * Executes an asynchronous task with timeout control and circuit protection.
   * If the circuit is OPEN or the task fails/times out, calls fallbackFn.
   *
   * @param {string} providerId - Adapter or provider identifier
   * @param {Function} asyncFn - Async function to execute
   * @param {Function} fallbackFn - Deterministic fallback function
   * @param {Object} [options]
   * @param {number} [options.timeoutMs]
   * @returns {Promise<Object>}
   */
  async execute(providerId, asyncFn, fallbackFn, options = {}) {
    const state = this.getState(providerId);
    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;
    const maxRetries = typeof options.maxRetries === 'number' ? options.maxRetries : 0;
    const retryDelayMs = options.retryDelayMs || 25;

    if (!this.canExecute(providerId)) {
      // Fast failover directly to fallback without waiting
      return await fallbackFn({
        fallbackTriggered: true,
        fallbackReason: `${GATEWAY_ERROR_CODES.CIRCUIT_BREAKER_OPEN}: Provider "${providerId}" circuit is ${state}`,
      });
    }

    let attempt = 0;
    let lastError = null;

    while (attempt <= maxRetries) {
      try {
        const result = await Promise.race([
          asyncFn(),
          new Promise((_, reject) =>
            setTimeout(() => {
              const err = new Error(`Request to provider "${providerId}" timed out after ${timeoutMs}ms`);
              err.code = GATEWAY_ERROR_CODES.TIMEOUT_EXCEEDED;
              reject(err);
            }, timeoutMs)
          ),
        ]);

        this.recordSuccess(providerId);
        return result;
      } catch (err) {
        lastError = err;
        attempt += 1;
        if (attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
        }
      }
    }

    this.recordFailure(providerId, lastError);

    return await fallbackFn({
      fallbackTriggered: true,
      fallbackReason: `${lastError?.code || GATEWAY_ERROR_CODES.ADAPTER_FAILURE}: ${lastError?.message || 'Unknown failure'}`,
      retriesExhausted: attempt > 1,
    });
  }

  /**
   * Resets all or specific provider circuits.
   *
   * @param {string} [providerId]
   */
  reset(providerId = null) {
    if (providerId) {
      this.circuits.delete(providerId);
    } else {
      this.circuits.clear();
    }
  }

  /**
   * Snapshot of all tracked provider circuits.
   *
   * @returns {Object}
   */
  getSnapshot() {
    const snapshot = {};
    for (const [id, c] of this.circuits.entries()) {
      snapshot[id] = {
        state: this.getState(id),
        failureCount: c.failureCount,
        lastFailureTime: c.lastFailureTime,
        lastError: c.lastError,
      };
    }
    return snapshot;
  }
}

export const circuitBreaker = new ProviderCircuitBreaker();
export { ProviderCircuitBreaker };
