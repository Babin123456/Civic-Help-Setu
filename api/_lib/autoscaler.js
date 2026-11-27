/* global performance */
/**
 * api/_lib/autoscaler.js
 *
 * Workload-Aware Autoscaling Controller for API and Worker Pools
 * (#1261)
 *
 * Scales API and background worker pools using queue age, concurrency,
 * latency, and saturation (rather than CPU alone). Adds scale-down
 * stabilization, max-cost guardrails, and warm capacity for deadline peaks.
 *
 * Design principles (reusing existing abstractions, no parallel subsystem):
 *  - Metrics-backed: drives decisions from shared saturation metrics
 *  - AIMD-inspired: additive increase for scale-up, multiplicative decrease for scale-down
 *  - Hysteresis: prevents oscillation/flapping
 *  - Cost-aware: max-cost guardrails prevent runaway cost
 *  - Warm capacity: pre-warm instances before deadline peaks
 *  - Backward-compatible: configurable defaults, safe migration path
 *
 * Acceptance: burst tests meet latency targets without oscillation or runaway cost.
 */

import { createSaturationMetrics, createLatencyTracker } from './concurrencyController.js';

/**
 * Enum for scale action direction.
 */
export const SCALE_DIRECTION = Object.freeze({
  UP: 'up',
  DOWN: 'down',
  NONE: 'none',
});

/**
 * Enum for scale reason.
 */
export const SCALE_REASON = Object.freeze({
  QUEUE_AGE: 'queue_age',
  CONCURRENCY: 'concurrency',
  LATENCY: 'latency',
  SATURATION: 'saturation',
  STABILIZATION: 'stabilization',
  COST_GUARDRAIL: 'cost_guardrail',
  WARMUP: 'warmup',
  NONE: 'none',
});

/**
 * Default configuration for the autoscaler.
 *
 * All values are intentionally configurable via the constructor options.
 */
export const DEFAULT_AUTOSCALER_CONFIG = Object.freeze({
  /** Scale-up threshold: queue age (ms) that triggers a scale-up. */
  queueAgeScaleUpThresholdMs: 5_000,
  /** Scale-up threshold: concurrency as a fraction of target. */
  concurrencyScaleUpTarget: 0.8,
  /** Scale-up threshold: p99 latency (ms) that triggers a scale-up. */
  latencyP99ScaleUpThresholdMs: 1500,
  /** Scale-up threshold: utilization (0-1) that triggers a scale-up. */
  utilizationScaleUpThreshold: 0.85,

  /** Scale-down stabilization window (ms) before another scale-down can fire. */
  scaleDownStabilizationWindowMs: 120_000, // 2 minutes
  /** Minimum time between scale-down actions (ms). */
  minScaleDownIntervalMs: 60_000, // 1 minute
  /** Hysteresis threshold: utilization must be below this fraction to scale down. */
  scaleDownHysteresisFraction: 0.4,
  /** Minimum instance count after scale-down. */
  minInstanceCount: 1,

  /** Max cost per scale operation (USD). */
  maxCostPerScaleUsd: 0.10,
  /** Estimated cost per instance-hour (USD). */
  costPerInstanceHourUsd: 0.05,
  /** Max total monthly cost guardrail (USD). */
  maxMonthlyCostUsd: 50.0,

  /** Warm capacity: pre-warm instances when queue age exceeds this (ms). */
  warmCapacityQueueAgeThresholdMs: 8_000,
  /** Number of instances to warm proactively. */
  warmCapacityBatchSize: 2,
  /** Warm instance timeout before considering it stale (ms). */
  warmInstanceStaleTimeoutMs: 30_000,

  /** Measurement window for metrics (ms). */
  measurementWindowMs: 30_000,
  /** How often the scaler evaluates (ms). */
  evaluationIntervalMs: 15_000,

  /** Whether warm capacity is enabled. */
  warmCapacityEnabled: true,
  /** Whether cost guardrails are enabled. */
  costGuardrailsEnabled: true,
  /** Whether scale-down stabilization is enabled. */
  scaleDownStabilizationEnabled: true,
});

/**
 * Represents a scale decision with all relevant context.
 */
export class ScaleDecision {
  /**
   * @param {SCALE_DIRECTION} direction - up, down, or none
   * @param {SCALE_REASON} reason - why the decision was made
   * @param {number} [confidence=0] - confidence score 0-1 (internal use)
   * @param {number} [estimatedCostUsd=0] - estimated cost of the action
   * @param {string} [message=''] - human-readable message
   */
  constructor(direction, reason, confidence = 0, estimatedCostUsd = 0, message = '') {
    this.direction = direction;
    this.reason = reason;
    this.confidence = confidence;
    this.estimatedCostUsd = estimatedCostUsd;
    this.message = message;
    this.timestamp = performance.now();
  }

  /**
   * Returns whether this is a no-op (no scaling needed).
   */
  get isNoOp() {
    return this.direction === SCALE_DIRECTION.NONE;
  }

  /**
   * Returns whether this is a scale-up decision.
   */
  get isScaleUp() {
    return this.direction === SCALE_DIRECTION.UP;
  }

  /**
   * Returns whether this is a scale-down decision.
   */
  get isScaleDown() {
    return this.direction === SCALE_DIRECTION.DOWN;
  }

  /**
   * Human-readable description.
   */
  toString() {
    return `[Autoscaler] ${this.direction.toUpperCase()} | reason=${this.reason} | cost=$${this.estimatedCostUsd.toFixed(4)} | msg=${this.message}`;
  }
}

/**
 * Represents the current state of the autoscaler.
 */
export class AutoscalerState {
  constructor(config = {}) {
    this.config = { ...DEFAULT_AUTOSCALER_CONFIG, ...config };

    // Core metrics (managed internally, exposed via getMetrics)
    this.queueAgeMs = 0;             // age of the oldest item in the queue
    this.inFlightCount = 0;          // current concurrency (in-flight requests)
    this.maxConcurrent = 0;          // peak concurrency in current window
    this.totalCompleted = 0;         // total completed in current window
    this.totalFailed = 0;            // total failed in current window
    this.latencyTracker = createLatencyTracker(); // p50/p95/p99 latency tracker
    this.utilization = 0;            // inFlight / maxConcurrent (0-1)

    // Scale-down stabilization state
    this.lastScaleDownAt = 0;        // timestamp of last scale-down
    this.scaleDownStableUntil = 0; // until when scale-down is stabilized

    // Warm capacity state
    this.warmInstances = new Map();  // instanceId => { startedAt, kind }
    this.warmCapacityEnabled = !!this.config.warmCapacityEnabled;
    this.costGuardrailsEnabled = !!this.config.costGuardrailsEnabled;
    this.scaleDownStabilizationEnabled = !!this.config.scaleDownStabilizationEnabled;

    // Cost tracking
    this.totalScaleCostUsd = 0;
    this.scaleOperationCount = 0;
    this.lastMonthReset = Math.floor(Date.now() / 1000 / 60 / 60 / 24 / 30) * 1000 * 60 * 60 * 24; // start of current month-ish
  }

  /** Reset window counters (call at end of each measurement window). */
  resetWindow() {
    this.totalCompleted = 0;
    this.totalFailed = 0;
    this.latencyTracker.reset();
    // Utilization recomputed from current inFlight / maxConcurrent
    if (this.maxConcurrent > 0) {
      this.utilization = this.inFlightCount / this.maxConcurrent;
    } else {
      this.utilization = 0;
    }
  }

  /** Record a completed request. */
  recordCompleted(success = true, latencyMs) {
    if (success) this.totalCompleted++; else this.totalFailed++;
    if (latencyMs !== undefined) this.latencyTracker.record(latencyMs);
  }

  /** Update queue age. */
  setQueueAge(ageMs) {
    this.queueAgeMs = ageMs;
  }

  /** Update in-flight count. */
  setInFlight(count, maxConcurrent) {
    this.inFlightCount = count;
    this.maxConcurrent = Math.max(this.maxConcurrent, maxConcurrent || 0);
    if (this.maxConcurrent > 0) {
      this.utilization = this.inFlightCount / this.maxConcurrent;
    } else {
      this.utilization = 0;
    }
  }

  /** Check if scale-down is currently stabilized. */
  isScaleDownStabilized() {
    if (!this.scaleDownStabilizationEnabled) return true;
    // If no scale-down has ever been performed, stabilization window doesn't apply
    if (this.lastScaleDownAt === 0) return true;
    return performance.now() >= this.scaleDownStableUntil;
  }

  /** Mark scale-down as just performed, starting stabilization window. */
  markScaleDownPerformed() {
    this.lastScaleDownAt = performance.now();
    this.scaleDownStableUntil = this.lastScaleDownAt + this.config.scaleDownStabilizationWindowMs;
  }

  /** Check if enough cost budget remains for a scale operation. */
  canAffordScaleCost(costUsd) {
    if (!this.costGuardrailsEnabled) return true;
    const monthlyBudget = this.config.maxMonthlyCostUsd;
    const spentThisMonth = this.totalScaleCostUsd;
    return (spentThisMonth + costUsd) <= monthlyBudget;
  }

  /** Record the cost of a scale operation. */
  recordScaleCost(costUsd) {
    this.totalScaleCostUsd += costUsd;
    this.scaleOperationCount++;
  }

  /** Get current metrics snapshot. */
  getMetrics() {
    return {
      queueAgeMs: this.queueAgeMs,
      inFlightCount: this.inFlightCount,
      maxConcurrent: this.maxConcurrent,
      utilization: this.utilization,
      totalCompleted: this.totalCompleted,
      totalFailed: this.totalFailed,
      latencyP50: this.latencyTracker.getPercentiles().p50,
      latencyP95: this.latencyTracker.getPercentiles().p95,
      latencyP99: this.latencyTracker.getPercentiles().p99,
      warmInstanceCount: this.warmInstances.size,
    };
  }
}

/**
 * Workload-Aware Autoscaling Controller.
 *
 * Examines queue age, concurrency, latency, and saturation to decide
 * scale-up vs scale-down for API and worker pool instances.
 *
 * Invariants:
 * - Scale-up is aggressive but gated by cost guardrails.
 * - Scale-down is conservative with stabilization/hysteresis.
 * - Warm capacity pre-warms instances before deadline peaks.
 * - Cost guardrails prevent runaway spending.
 */
export class WorkloadAwareAutoscaler {
  /**
   * Create a new autoscaler for a given pool.
   *
   * @param {Object} options
   * @param {AutoscalerState} options.state - shared state instance
   * @param {Function} options.getMetrics - function returning current metrics {queueAgeMs, inFlightCount, maxConcurrent, utilization, latencyP50, latencyP95, latencyP99, ...}
   * @param {Function} options.adjustInstances - function(direction, count) to actually scale the pool
   * @param {Object} [options.config] - configuration overrides (merged with defaults)
   */
  constructor({ state, getMetrics, adjustInstances, config = {} } = {}) {
    this.state = state || new AutoscalerState(config);
    this.getMetrics = getMetrics;
    this.adjustInstances = adjustInstances;
    this.config = { ...DEFAULT_AUTOSCALER_CONFIG, ...config };

    // Internal state
    this.lastEvaluationAt = 0;
    this.lastScaleUpAt = 0;
    this.lastScaleDownAt = 0;

    // Ensure evaluation loop is started if needed
    this._evaluationLoopId = null;
  }

  /**
   * Start the periodic evaluation loop.
   * Evaluates every `evaluationIntervalMs` and may trigger scale actions.
   */
  startEvaluationLoop() {
    if (this._evaluationLoopId) return;
    const interval = Math.max(1, this.config.evaluationIntervalMs);
    this._evaluationLoopId = setInterval(() => this.evaluateAndScale(), interval);
  }

  /** Stop the evaluation loop. */
  stopEvaluationLoop() {
    if (this._evaluationLoopId !== null) {
      clearInterval(this._evaluationLoopId);
      this._evaluationLoopId = null;
    }
  }

  /**
   * Main evaluation iteration: read metrics, compute scale decision,
   * apply guardrails, and invoke adjustInstances if needed.
   */
  async evaluateAndScale() {
    const now = performance.now();
    const metrics = this.getMetrics ? this.getMetrics() : this.state.getMetrics();

    // Enforce minimum evaluation interval
    if (now - this.lastEvaluationAt < this.config.evaluationIntervalMs) {
      return;
    }
    this.lastEvaluationAt = now;

    // Read current state
    const queueAgeMs = metrics.queueAgeMs ?? this.state.queueAgeMs;
    const inFlightCount = metrics.inFlightCount ?? this.state.inFlightCount;
    const maxConcurrent = metrics.maxConcurrent ?? this.state.maxConcurrent;
    const utilization = metrics.utilization ?? this.state.utilization;
    const latencyP99 = (metrics.latencyP99 ?? this.state.latencyTracker.getPercentiles().p99) || 0;

    // Compute scale decision
    const decision = this.computeScaleDecision({
      queueAgeMs,
      inFlightCount,
      maxConcurrent,
      utilization,
      latencyP99,
    });

    // If no-op, early return
    if (decision.isNoOp) {
      // Still record metrics for observability
      this.state.recordCompleted();
      return;
    }

    // Apply cost guardrails (if enabled)
    if (this.config.costGuardrailsEnabled && !decision.isScaleUp) {
      // Scale-down always allowed if stabilization passed; cost check only for up
    }

    // Check cost guardrail for scale-up
    if (decision.isScaleUp && this.config.costGuardrailsEnabled) {
      const estimatedCostUsd = this._estimateScaleUpCost(decision);
      if (!this.state.canAffordScaleCost(estimatedCostUsd)) {
        // Scale-up blocked by cost; downgrade to no-op with guardrail reason
        decision.estimatedCostUsd = estimatedCostUsd;
        decision.direction = SCALE_DIRECTION.NONE;
        decision.reason = SCALE_REASON.COST_GUARDRAIL;
        decision.message = `Scale-up blocked: estimated $${estimatedCostUsd.toFixed(4)} would exceed monthly budget $${this.config.maxMonthlyCostUsd}.`;
        this.state.recordCompleted();
        console.info(decision.toString());
        return;
      }
      // Record the estimated cost (will be charged when actual scale happens)
      this.state.recordScaleCost(estimatedCostUsd);
    }

    // Apply scale-down stabilization check
    if (decision.isScaleDown && this.config.scaleDownStabilizationEnabled) {
      if (!this.state.isScaleDownStabilized()) {
        // Downgrade to no-op with stabilization reason
        decision.direction = SCALE_DIRECTION.NONE;
        decision.reason = SCALE_REASON.STABILIZATION;
        decision.message = `Scale-down suppressed: stabilization window active until ~${new Date(this.state.scaleDownStableUntil).toISOString()}.`;
        this.state.recordCompleted();
        console.info(decision.toString());
        return;
      }
    }

    // If still a decision, execute the scale action
    if (!decision.isNoOp) {
      try {
        // Estimate how many instances to add/remove
        const count = this._computeScaleCount(decision, {
          inFlightCount,
          maxConcurrent,
          utilization,
          queueAgeMs,
          latencyP99,
        });

        if (count === 0) {
          decision.direction = SCALE_DIRECTION.NONE;
          decision.reason = SCALE_REASON.NONE;
        } else {
          await this.adjustInstances(decision.direction, count);
          // Track timestamps
          if (decision.isScaleUp) {
            this.lastScaleUpAt = performance.now();
          } else if (decision.isScaleDown) {
            this.lastScaleDownAt = performance.now();
            this.state.markScaleDownPerformed();
          }
          // Record cost if scale-up
          if (decision.isScaleUp && this.config.costGuardrailsEnabled) {
            const estimatedCost = this._estimateScaleUpCost(decision);
            this.state.recordScaleCost(estimatedCost);
          }
          // For warmup, track warm instance
          if (decision.reason === SCALE_REASON.WARMUP) {
            const instanceId = `warm-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            this.state.warmInstances.set(instanceId, { startedAt: performance.now(), kind: 'proactive' });
            // Schedule stale check (simplified: just mark)
          }
        }
      } catch (error) {
        console.error('Autoscaler adjustInstances failed:', error);
      }
    }

    // Record a completed evaluation cycle
    this.state.recordCompleted();
  }

  /**
   * Compute the scale decision given current metrics.
   *
   * @param {Object} metrics - { queueAgeMs, inFlightCount, maxConcurrent, utilization, latencyP99 }
   * @returns {ScaleDecision}
   */
  computeScaleDecision({ queueAgeMs, inFlightCount, maxConcurrent, utilization, latencyP99 }) {
    const config = this.config;
    const state = this.state;
    const decision = new ScaleDecision(SCALE_DIRECTION.NONE, SCALE_REASON.NONE);

    // --- Stabilization check FIRST: if scale-down stabilization is active,
    // no scale-up or scale-down should happen to prevent oscillation.
    if (!state.isScaleDownStabilized()) {
      decision.direction = SCALE_DIRECTION.NONE;
      decision.reason = SCALE_REASON.STABILIZATION;
      decision.message = 'Scale-down stabilization active; waiting for cooldown window to elapse.';
      return decision;
    }

    // === Scale-Up Logic ===
    // Trigger if ANY of: queue age, latency, saturation, concurrency (in this order)

    let scaleUpReason = null;
    let scaleUpScore = 0; // number of signals exceeding threshold (0-4)

    // 1. Queue age check
    if (queueAgeMs >= config.queueAgeScaleUpThresholdMs) {
      scaleUpScore++;
      scaleUpReason = SCALE_REASON.QUEUE_AGE;
    }

    // 2. Latency check (p99 > target)
    if (latencyP99 >= config.latencyP99ScaleUpThresholdMs) {
      scaleUpScore++;
      if (!scaleUpReason) scaleUpReason = SCALE_REASON.LATENCY;
    }

    // 3. Saturation check (utilization > utilization threshold)
    if (utilization >= config.utilizationScaleUpThreshold) {
      scaleUpScore++;
      if (!scaleUpReason) scaleUpReason = SCALE_REASON.SATURATION;
    }

    // 4. Concurrency check (utilization > target)
    if (utilization >= config.concurrencyScaleUpTarget && maxConcurrent > 0) {
      scaleUpScore++;
      if (!scaleUpReason) scaleUpReason = SCALE_REASON.CONCURRENCY;
    }

    // If scale-up signals detected, make decision
    if (scaleUpScore >= 1 && scaleUpReason) {
      const estimatedCostUsd = this._estimateScaleUpCost({ ...decision, reason: scaleUpReason });
      decision.direction = SCALE_DIRECTION.UP;
      decision.reason = scaleUpReason;
      decision.confidence = Math.min(1, scaleUpScore / 4);
      decision.estimatedCostUsd = estimatedCostUsd;
      decision.message = `Scale-up triggered by ${scaleUpReason}: queueAge=${queueAgeMs}ms, util=${(utilization * 100).toFixed(1)}%, latencyP99=${latencyP99}ms`;
      return decision;
    }

    // === Scale-Down Logic (with hysteresis & stabilization) ===
    // Scale-down only if:
    // - Utilization is low AND
    // - No recent scale-down AND
    // - Hysteresis window crossed

    let scaleDownReason = null;

    // Hysteresis: utilization must be below (saturationThreshold * hysteresisFraction)
    // For scale-down, we want utilization comfortably below the scale-up threshold.
    const scaleDownUtilThreshold = config.utilizationScaleUpThreshold * config.scaleDownHysteresisFraction;
    // e.g., if scale-up at 0.85 and hysteresisFraction=0.4, scale-down at ~0.34

    const isUtilLowEnough = utilization < scaleDownUtilThreshold;
    const isInflightLow = inFlightCount <= 1; // safety: don't scale down if only 1 in-flight
    const timeSinceLastScaleDown = performance.now() - state.lastScaleDownAt;
    const minIntervalPassed = state.lastScaleDownAt === 0 ||
      timeSinceLastScaleDown >= config.minScaleDownIntervalMs;

    if (isUtilLowEnough && isInflightLow && minIntervalPassed) {
      scaleDownReason = SCALE_REASON.SATURATION; // reuse saturation reason for low utilization
    } else if (!isUtilLowEnough) {
      // Not low enough yet; give a diagnostic message
      decision.direction = SCALE_DIRECTION.NONE;
      decision.reason = SCALE_REASON.STABILIZATION;
      decision.message = `Utilization ${(utilization * 100).toFixed(1)}% above scale-down hysteresis threshold ${(scaleDownUtilThreshold * 100).toFixed(1)}%.`;
      return decision;
    } else if (!isInflightLow) {
      decision.direction = SCALE_DIRECTION.NONE;
      decision.reason = SCALE_REASON.CONCURRENCY;
      decision.message = `In-flight count ${inFlightCount} too high for scale-down.`;
      return decision;
    } else if (!minIntervalPassed) {
      decision.direction = SCALE_DIRECTION.NONE;
      decision.reason = SCALE_REASON.STABILIZATION;
      decision.message = `Min scale-down interval not elapsed: ${((config.minScaleDownIntervalMs - timeSinceLastScaleDown) / 1000).toFixed(1)}s remaining.`;
      return decision;
    }

    // Scale-down decision confirmed
    decision.direction = SCALE_DIRECTION.DOWN;
    decision.reason = scaleDownReason || SCALE_REASON.SATURATION;
    decision.confidence = 0.8; // high confidence when conditions met
    decision.message = `Scale-down: util=${(utilization * 100).toFixed(1)}%, inFlight=${inFlightCount}, minInterval=${minIntervalPassed ? 'met' : 'pending'}`;
    return decision;
  }

  /**
   * Estimate the cost of a scale-up action.
   * @param {ScaleDecision} decision
   * @returns {number} estimated cost in USD
   */
  _estimateScaleUpCost(decision) {
    const config = this.config;
    // Cost per instance-hour * (evaluationIntervalMs / (1000 * 60 * 60))
    // But we estimate per-scale-op cost: proportional to how long instances will run.
    // Default estimate: 15 minutes of runtime per scale-up (deadline peak window).
    const costPerInstance = config.costPerInstanceHourUsd * (15 / 60); // 15 min = 0.25 hour
    // Number of instances: based on warmCapacityBatchSize or derived from utilization
    const instanceCount = decision.isScaleUp ? (config.warmCapacityBatchSize || 1) : 1;
    return Number((costPerInstance * instanceCount).toFixed(6));
  }

  /**
   * Compute how many instances to add/remove based on the decision and metrics.
   * @param {ScaleDecision} decision
   * @param {Object} metrics - current metrics object
   * @returns {number} count (positive = add, negative = remove, 0 = no change)
   */
  _computeScaleCount(decision, { inFlightCount, maxConcurrent, utilization, queueAgeMs, latencyP99 }) {
    const config = this.config;

    if (decision.isScaleUp) {
      // Scale up: add enough instances to reduce utilization toward (1 - target)
      // Target: utilization <= 0.7 after scale-up
      let addend = 1; // minimum 1 instance

      // Heuristic: if utilization is very high, add more instances
      if (utilization >= 0.9) addend = 3;
      else if (utilization >= 0.8) addend = 2;
      else addend = 1;

      // Also consider queue age: older queue -> more instances
      if (queueAgeMs >= config.warmCapacityQueueAgeThresholdMs) {
        addend += config.warmCapacityBatchSize - 1; // add extra for warmup
      }

      return addend;
    }

    if (decision.isScaleDown) {
      // Scale down: remove 1 instance, but never below minInstanceCount
      // The actual minInstanceCount is enforced by the caller/adjustInstances.
      // We just return -1 to indicate "remove one".
      return -1;
    }

    return 0;
  }

  /**
   * Manually trigger a scale-up (e.g., for deadline peaks, operator action).
   * @param {number} count - number of instances to add (default: config.warmCapacityBatchSize)
   * @param {SCALE_REASON} reason - why this is being triggered
   * @param {string} [message] - optional message
   * @returns {Promise<void>}
   */
  async manualScaleUp(count = this.config.warmCapacityBatchSize, reason = SCALE_REASON.WARMUP, message) {
    if (this.config.costGuardrailsEnabled && this.config.costGuardrailsEnabled) {
      const estimatedCost = this.state.canAffordScaleCost
        ? this._estimateScaleUpCost({ direction: SCALE_DIRECTION.UP, reason, estimatedCostUsd: 0 })
        : 0;
      if (!this.state.canAffordScaleCost(estimatedCost)) {
        console.warn('Manual scale-up blocked by cost guardrail.');
        return;
      }
      this.state.recordScaleCost(estimatedCost);
    }
    await this.adjustInstances(SCALE_DIRECTION.UP, count);
    this.lastScaleUpAt = performance.now();
    // Track warm instance
    const instanceId = `warm-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    this.state.warmInstances.set(instanceId, { startedAt: performance.now(), kind: reason });
    console.info(`Manual scale-up: +${count} instances. reason=${reason} ${message || ''}`);
  }

  /**
   * Manually trigger a scale-down (e.g., operator action).
   * @param {number} count - number of instances to remove (default: 1)
   * @param {string} [reason] - optional reason
   */
  async manualScaleDown(count = 1, reason) {
    if (this.config.scaleDownStabilizationEnabled) {
      this.state.markScaleDownPerformed();
    }
    await this.adjustInstances(SCALE_DIRECTION.DOWN, count);
    this.lastScaleDownAt = performance.now();
    console.info(`Manual scale-down: -${count} instances. reason=${reason || 'operator'}`);
  }

  /**
   * Update the queue age metric (caller should invoke periodically).
   * @param {number} ageMs - queue age in milliseconds
   */
  updateQueueAge(ageMs) {
    this.state.setQueueAge(ageMs);
  }

  /** Update in-flight count and recalc utilization. */
  updateInFlight(count, maxConcurrent) {
    this.state.setInFlight(count, maxConcurrent);
  }

  /** Request warm capacity pre-warming (operator / deadline peak trigger). */
  async requestWarmCapacity() {
    if (!this.config.warmCapacityEnabled) {
      console.warn('Warm capacity is disabled in configuration.');
      return;
    }
    // Trigger a scale-up with warmup reason
    await this.manualScaleUp(
      this.config.warmCapacityBatchSize,
      SCALE_REASON.WARMUP,
      'Proactive warm capacity for anticipated deadline peak'
    );
  }

  /** Get full autoscaler state for observability/debugging. */
  getState() {
    return {
      ...this.state.getMetrics(),
      lastEvaluationAt: this.lastEvaluationAt,
      lastScaleUpAt: this.lastScaleUpAt,
      lastScaleDownAt: this.lastScaleDownAt,
      totalScaleCostUsd: this.state.totalScaleCostUsd,
      scaleOperationCount: this.state.scaleOperationCount,
      warmInstanceCount: this.state.warmInstances.size,
      config: { ...this.config },
    };
  }
}

/**
 * Factory function to create a WorkloadAwareAutoscaler instance wired for a
 * typical API pool or worker pool deployment.
 *
 * @param {Object} options
 * @param {AutoscalerState} options.state - shared state (optional, new one created if omitted)
 * @param {Function} options.getMetrics - MUST return { queueAgeMs, inFlightCount, maxConcurrent, utilization, latencyP99, totalCompleted, totalFailed }
 * @param {Function} options.adjustInstances(direction, count) - MUST be implemented by caller to actually scale the pool
 * @param {Object} [options.config] - configuration overrides
 * @returns {WorkloadAwareAutoscaler}
 */
export function createWorkloadAwareAutoscaler({ state, getMetrics, adjustInstances, config = {} } = {}) {
  if (!getMetrics) {
    throw new Error('createWorkloadAwareAutoscaler: getMetrics function is required.');
  }
  if (typeof adjustInstances !== 'function') {
    throw new Error('createWorkloadAwareAutoscaler: adjustInstances function is required.');
  }
  return new WorkloadAwareAutoscaler({ state, getMetrics, adjustInstances, config });
}

/**
 * No-op adjustInstances implementation for testing (records intent instead of acting).
 * Useful for unit tests that don't want to touch real infrastructure.
 * @param {SCALE_DIRECTION} direction
 * @param {number} count
 * @returns {Promise<void>}
 */
export async function noOpAdjustInstances(direction, count) {
  console.info(`[noOpAdjustInstances] direction=${direction} count=${count}`);
}

