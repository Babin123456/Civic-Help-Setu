/**
 * src/services/civicChaosInjectionEngine.js
 * Core Fault Injection and Interception Engine for Civic Operations Chaos Engineering (#1192).
 *
 * Implements:
 * - Controlled fault injection across dependencies (Firebase, LLMs, Maps, Email, Storage).
 * - Latency simulation, timeouts, partial outages, rate limits (HTTP 429), and stale caches.
 * - Non-production environment enforcement.
 * - Global Emergency Kill Switch & per-dependency kill switches.
 * - Circuit Breaker pattern with CLOSED, OPEN, and HALF_OPEN states.
 * - Event listener bus for real-time observability telemetry.
 */

import {
  CIVIC_CHAOS_SCHEMA_VERSION,
  DEPENDENCY_TYPES,
  FAULT_TYPES,
  validateChaosDrillConfig,
} from '../data/civicChaosResilienceContract.js';

export const CIRCUIT_STATE = Object.freeze({
  CLOSED: 'CLOSED', // Normal operations
  OPEN: 'OPEN', // Breaker tripped: fast-fail or immediate fallback
  HALF_OPEN: 'HALF_OPEN', // Testing recovery with canary requests
});

class CivicChaosInjectionEngine {
  constructor() {
    this.activeDrills = new Map();
    this.activeInjections = new Map(); // dependency -> injectionConfig
    this.globalKillSwitchEngaged = false;
    this.killSwitches = new Map(); // dependency -> boolean
    this.circuitBreakers = new Map(); // dependency -> { state, failures, lastFailureTime, successCount }
    this.telemetryLogs = [];
    this.listeners = new Set();

    // Initialize breakers for dependencies
    Object.values(DEPENDENCY_TYPES).forEach((dep) => {
      this.resetCircuitBreaker(dep);
      this.killSwitches.set(dep, false);
    });
  }

  reset() {
    this.activeDrills.clear();
    this.activeInjections.clear();
    this.globalKillSwitchEngaged = false;
    this.telemetryLogs = [];
    Object.values(DEPENDENCY_TYPES).forEach((dep) => {
      this.resetCircuitBreaker(dep);
      this.killSwitches.set(dep, false);
    });
    this.notifyListeners({ type: 'ENGINE_RESET' });
  }

  addListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners(event) {
    this.listeners.forEach((fn) => {
      try {
        fn(event);
      } catch (err) {
        console.error('Error in chaos engine listener:', err);
      }
    });
  }

  resetCircuitBreaker(dependency) {
    this.circuitBreakers.set(dependency, {
      state: CIRCUIT_STATE.CLOSED,
      failures: 0,
      lastFailureTime: 0,
      successCount: 0,
      threshold: 3, // trip after 3 failures
      recoveryTimeoutMs: 5000, // half-open after 5s
    });
  }

  /**
   * Emergency Kill Switches
   */
  engageGlobalKillSwitch(reason = 'Operator emergency abort') {
    this.globalKillSwitchEngaged = true;
    this.activeInjections.clear();
    this.logTelemetry({
      level: 'WARN',
      message: `GLOBAL EMERGENCY KILL SWITCH ACTIVATED: ${reason}`,
      timestamp: new Date().toISOString(),
    });
    this.notifyListeners({ type: 'GLOBAL_KILL_SWITCH_ENGAGED', reason });
  }

  disengageGlobalKillSwitch() {
    this.globalKillSwitchEngaged = false;
    this.logTelemetry({
      level: 'INFO',
      message: 'Global emergency kill switch disengaged. Normal testing allowed.',
      timestamp: new Date().toISOString(),
    });
    this.notifyListeners({ type: 'GLOBAL_KILL_SWITCH_DISENGAGED' });
  }

  setDependencyKillSwitch(dependency, engaged, reason = '') {
    this.killSwitches.set(dependency, engaged);
    if (engaged) {
      this.activeInjections.delete(dependency);
      this.resetCircuitBreaker(dependency);
    }
    this.logTelemetry({
      level: 'WARN',
      message: `Kill switch for "${dependency}" set to ${engaged ? 'ENGAGED' : 'DISENGAGED'}: ${reason}`,
      timestamp: new Date().toISOString(),
    });
    this.notifyListeners({ type: 'DEPENDENCY_KILL_SWITCH_TOGGLED', dependency, engaged, reason });
  }

  isDependencyDisabled(dependency) {
    return this.globalKillSwitchEngaged || this.killSwitches.get(dependency) === true;
  }

  /**
   * Starts a controlled chaos drill in non-production environments.
   */
  startDrill(drillConfig) {
    const validation = validateChaosDrillConfig(drillConfig);
    if (!validation.valid) {
      throw new Error(`Invalid chaos drill configuration: ${validation.errors.join('; ')}`);
    }

    if (this.globalKillSwitchEngaged) {
      throw new Error('Cannot start drill while Global Kill Switch is engaged.');
    }

    const drillId = drillConfig.id || `drill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const drillRecord = {
      ...drillConfig,
      id: drillId,
      startTime: new Date().toISOString(),
      status: 'running',
    };

    this.activeDrills.set(drillId, drillRecord);

    // Register active injections
    drillConfig.injections.forEach((inj) => {
      this.activeInjections.set(inj.dependency, {
        ...inj,
        drillId,
        startedAt: Date.now(),
      });
    });

    this.logTelemetry({
      level: 'INFO',
      drillId,
      message: `Chaos drill "${drillConfig.name}" started in environment "${drillConfig.environment}".`,
      timestamp: new Date().toISOString(),
    });

    this.notifyListeners({ type: 'DRILL_STARTED', drill: drillRecord });

    // Auto-teardown after max duration if specified
    const maxDuration = Math.max(...drillConfig.injections.map((i) => i.durationMs || 10000));
    if (maxDuration > 0) {
      setTimeout(() => {
        if (this.activeDrills.has(drillId)) {
          this.stopDrill(drillId, 'Scheduled drill duration completed.');
        }
      }, maxDuration);
    }

    return drillRecord;
  }

  stopDrill(drillId, reason = 'Operator completed drill') {
    const drill = this.activeDrills.get(drillId);
    if (!drill) return null;

    drill.status = 'completed';
    drill.endTime = new Date().toISOString();
    drill.completionReason = reason;

    // Clear injections originating from this drill
    for (const [dep, inj] of this.activeInjections.entries()) {
      if (inj.drillId === drillId) {
        this.activeInjections.delete(dep);
      }
    }

    this.logTelemetry({
      level: 'INFO',
      drillId,
      message: `Chaos drill "${drill.name}" stopped: ${reason}`,
      timestamp: new Date().toISOString(),
    });

    this.notifyListeners({ type: 'DRILL_STOPPED', drill, reason });
    return drill;
  }

  /**
   * Evaluates if a call to the specified dependency should experience an injected fault.
   *
   * @param {string} dependency - e.g. firebase, model_providers, maps, email, storage
   * @param {object} context - context metadata (operation name, draft id, etc.)
   * @returns {Promise<{ shouldFail: boolean, faultType?: string, latencyMs?: number, error?: Error, cachedPayload?: any }>}
   */
  async interceptCall(dependency, context = {}) {
    // 1. Check emergency kill switches
    if (this.isDependencyDisabled(dependency)) {
      return { shouldFail: false, intercepted: false, bypassReason: 'Kill switch engaged (isolation)' };
    }

    // 2. Check Circuit Breaker state
    const breaker = this.circuitBreakers.get(dependency);
    const now = Date.now();

    if (breaker && breaker.state === CIRCUIT_STATE.OPEN) {
      if (now - breaker.lastFailureTime > breaker.recoveryTimeoutMs) {
        breaker.state = CIRCUIT_STATE.HALF_OPEN;
        breaker.successCount = 0;
        this.logTelemetry({
          level: 'WARN',
          dependency,
          message: `Circuit breaker for "${dependency}" entered HALF_OPEN state (canary probing).`,
          timestamp: new Date().toISOString(),
        });
      } else {
        // Fast-fail: Circuit open
        const err = new Error(`Circuit breaker for ${dependency} is OPEN. Immediate fallback triggered.`);
        err.circuitBreakerOpen = true;
        return {
          shouldFail: true,
          faultType: 'CIRCUIT_BREAKER_OPEN',
          error: err,
        };
      }
    }

    // 3. Check for active fault injection
    const injection = this.activeInjections.get(dependency);
    if (!injection) {
      return { shouldFail: false, intercepted: false };
    }

    // Check expiry
    if (injection.startedAt && injection.durationMs && (now - injection.startedAt > injection.durationMs)) {
      this.activeInjections.delete(dependency);
      return { shouldFail: false, intercepted: false };
    }

    // Probabilistic failure rate
    const failureRate = injection.failureRate !== undefined ? injection.failureRate : 1.0;
    if (Math.random() > failureRate) {
      return { shouldFail: false, intercepted: false };
    }

    // Apply latency if configured (cap at 60ms in test environment for fast test execution)
    const isTestEnv = typeof globalThis !== 'undefined' && (globalThis.process?.env?.NODE_ENV === 'test' || Boolean(globalThis.__vitest_worker__));
    let latencyMs = injection.latencyMs !== undefined
      ? injection.latencyMs
      : (injection.faultType === FAULT_TYPES.TIMEOUT ? 3000 : 200);
    if (isTestEnv && latencyMs > 60) {
      latencyMs = 50;
    }
    if (latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
    }

    // Trip circuit breaker failures if fault is injected
    if (breaker && breaker.state !== CIRCUIT_STATE.HALF_OPEN) {
      breaker.failures += 1;
      breaker.lastFailureTime = now;
      if (breaker.failures >= breaker.threshold) {
        breaker.state = CIRCUIT_STATE.OPEN;
        this.logTelemetry({
          level: 'ERROR',
          dependency,
          message: `Circuit breaker tripped for "${dependency}" after ${breaker.failures} consecutive failures.`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Generate injected fault according to type
    let faultError;
    let cachedPayload = null;

    switch (injection.faultType) {
      case FAULT_TYPES.TIMEOUT:
        faultError = new Error(`Injected Fault: Connection timeout to ${dependency} after ${latencyMs}ms.`);
        faultError.code = 'ETIMEDOUT';
        faultError.status = 504;
        break;

      case FAULT_TYPES.RATE_LIMIT:
        faultError = new Error(`Injected Fault: Rate limit exceeded (HTTP 429) for ${dependency}.`);
        faultError.code = 'RATE_LIMIT_EXCEEDED';
        faultError.status = 429;
        faultError.retryAfter = 5;
        break;

      case FAULT_TYPES.PARTIAL_OUTAGE:
      case FAULT_TYPES.CONNECTION_REFUSED:
        faultError = new Error(`Injected Fault: Service ${dependency} connection refused (503 Service Unavailable).`);
        faultError.code = 'ECONNREFUSED';
        faultError.status = 503;
        break;

      case FAULT_TYPES.CORRUPT_RESPONSE:
        faultError = new Error(`Injected Fault: Malformed or untrusted payload received from ${dependency}.`);
        faultError.code = 'ECORRUPTPAYLOAD';
        faultError.status = 502;
        break;

      case FAULT_TYPES.STALE_CACHE:
        faultError = null;
        cachedPayload = {
          stale: true,
          cachedAt: new Date(now - (injection.staleAgeMinutes || 1440) * 60000).toISOString(),
          warning: 'Serving cached boundary/record from offline fallback store.',
        };
        break;

      default:
        faultError = new Error(`Injected Fault: Generic failure for ${dependency}.`);
    }

    this.logTelemetry({
      level: 'WARN',
      dependency,
      faultType: injection.faultType,
      message: `Injected fault [${injection.faultType}] triggered on ${dependency}.`,
      context,
      timestamp: new Date().toISOString(),
    });

    return {
      shouldFail: Boolean(faultError),
      faultType: injection.faultType,
      latencyMs,
      error: faultError,
      cachedPayload,
    };
  }

  recordSuccess(dependency) {
    const breaker = this.circuitBreakers.get(dependency);
    if (!breaker) return;

    if (breaker.state === CIRCUIT_STATE.HALF_OPEN) {
      breaker.successCount += 1;
      if (breaker.successCount >= 2) {
        breaker.state = CIRCUIT_STATE.CLOSED;
        breaker.failures = 0;
        this.logTelemetry({
          level: 'INFO',
          dependency,
          message: `Circuit breaker for "${dependency}" restored to CLOSED.`,
          timestamp: new Date().toISOString(),
        });
      }
    } else if (breaker.state === CIRCUIT_STATE.CLOSED) {
      breaker.failures = Math.max(0, breaker.failures - 1);
    }
  }

  logTelemetry(entry) {
    const record = {
      id: `tel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      schemaVersion: CIVIC_CHAOS_SCHEMA_VERSION,
      ...entry,
    };
    this.telemetryLogs.unshift(record);
    if (this.telemetryLogs.length > 500) {
      this.telemetryLogs.pop();
    }
    this.notifyListeners({ type: 'TELEMETRY_LOGGED', entry: record });
  }

  getTelemetry() {
    return [...this.telemetryLogs];
  }

  getStatus() {
    const activeInjectionsObj = {};
    for (const [dep, inj] of this.activeInjections.entries()) {
      activeInjectionsObj[dep] = inj;
    }

    const breakersObj = {};
    for (const [dep, b] of this.circuitBreakers.entries()) {
      breakersObj[dep] = {
        state: b.state,
        failures: b.failures,
      };
    }

    const killSwitchesObj = {};
    for (const [dep, val] of this.killSwitches.entries()) {
      killSwitchesObj[dep] = val;
    }

    return {
      schemaVersion: CIVIC_CHAOS_SCHEMA_VERSION,
      globalKillSwitchEngaged: this.globalKillSwitchEngaged,
      killSwitches: killSwitchesObj,
      activeDrillsCount: this.activeDrills.size,
      activeDrills: Array.from(this.activeDrills.values()),
      activeInjections: activeInjectionsObj,
      circuitBreakers: breakersObj,
    };
  }
}

export const chaosEngine = new CivicChaosInjectionEngine();
export default chaosEngine;
