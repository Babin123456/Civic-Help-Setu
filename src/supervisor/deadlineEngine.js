/**
 * Supervisor-Agent Architecture - Deadline Enforcement
 * #1145: Complex Multi-Department Grievances
 *
 * Enforces task deadlines with escalation chains. Each supervisor task has
 * a `deadlineAt` timestamp. When deadlines are approached or missed, the
 * supervisor triggers notifications and auto-escalation to human reassignment.
 *
 * Version: v1.0.0-deadline-engine
 */

import { SupervisorTaskStatus, TaskPriority } from './domainModel.js';

// ---------------------------------------------------------------------------
// Deadline Escalation Levels
// ---------------------------------------------------------------------------

export const DeadlineEscalationLevel = {
  NONE: 'none',           // No escalation active
  WARNING_24H: 'warning_24h', // 24 hours remaining - agent notification
  WARNING_12H: 'warning_12h', // 12 hours remaining - supervisor ops notification
  CRITICAL: 'critical',   // Deadline missed or about to be missed - human reassignment
  MISSED: 'missed',       // Deadline passed - auto-escalation triggered
};

// ---------------------------------------------------------------------------
// SupervisorDeadlineEngine Class
// ---------------------------------------------------------------------------

/**
 * Enforces deadlines for supervisor tasks with escalation chains.
// Monitors task deadlines and triggers appropriate actions when deadlines
 * approach or are missed. Integrates with the conflict detector and agent
 * registry for holistic task management.
 */
export class SupervisorDeadlineEngine {
  constructor(config = {}) {
    // Merge config with defaults
    this.config = {
      deadlineGracePeriodMs: SupervisorConfig.deadlineGracePeriodMs,
      deadlineCheckIntervalMs: SupervisorConfig.deadlineCheckIntervalMs,
      ...config,
    };

    // Active timers for monitoring
    this._activeTimers = new Map(); // taskId -> timeout ID reference

    // Track escalation state per task
    this._escalationState = new Map(); // taskId -> escalation level

    // Reference to conflict detector for integrated handling
    this.conflictDetector = null;
  }

  /**
   * Start monitoring a task's deadline.
   * Schedules checks at the configured interval until the deadline passes
   * or the task reaches a terminal state.
   * @param {object} task - The supervisor task to monitor
   * @param {Function} onEscalation - Callback invoked when escalation level changes
   * @param {Function} onDeadlineMissed - Callback invoked when deadline is missed
   */
  startMonitoring(task, onEscalation, onDeadlineMissed) {
    const taskId = task.id;
    const deadlineAt = task.deadlineAt;

    if (!deadlineAt) {
      console.warn(`Task ${taskId} has no deadlineAt; not starting monitoring`);
      return;
    }

    const deadlineTime = new Date(deadlineAt).getTime();
    const now = Date.now();

    // If deadline already passed
    if (deadlineTime <= now) {
      // Immediately trigger missed deadline handling
      this._handleDeadlineMissed(task, onDeadlineMissed);
      return;
    }

    // Calculate initial wait time until first check
    const firstCheckAt = now + this.config.deadlineCheckIntervalMs;
    const initialWait = Math.max(0, firstCheckAt - deadlineTime);

    // If the first check is past the deadline, handle immediately
    if (initialWait >= Math.abs(deadlineTime - now) && now >= deadlineTime - 1000) {
      // Deadline already passed at time of starting monitoring
      this._handleDeadlineMissed(task, onDeadlineMissed);
      return;
    }

    // Schedule the first check
    const checkCallback = () => this._checkDeadline(task, onEscalation, onDeadlineMissed);

    // Set initial timeout
    const timeoutId = setTimeout(checkCallback, Math.max(1, initialWait));

    this._activeTimers.set(taskId, timeoutId);
  }

  /**
   * Check the deadline status for a task and determine if escalation is needed.
   * @param {object} task - The supervisor task
   * @param {Function} onEscalation - Callback for escalation level changes
   * @param {Function} onDeadlineMissed - Callback for deadline missed
   * @private
   */
  _checkDeadline(task, onEscalation, onDeadlineMissed) {
    const taskId = task.id;
    const deadlineAt = task.deadlineAt;
    const now = Date.now();

    if (!deadlineAt) {
      // No deadline; stop monitoring
      this._stopMonitoring(taskId);
      return;
    }

    const deadlineTime = new Date(deadlineAt).getTime();
    const timeRemaining = deadlineTime - now;

    // Terminal case: deadline already passed or within grace period
    if (timeRemaining <= 0) {
      this._handleDeadlineMissed(task, onDeadlineMissed);
      return;
    }

    // Determine escalation level based on time remaining
    let escalationLevel = DeadlineEscalationLevel.NONE;

    // 24 hours remaining
    if (timeRemaining <= 24 * 60 * 60 * 1000 && timeRemaining > 12 * 60 * 60 * 1000) {
      escalationLevel = DeadlineEscalationLevel.WARNING_24H;
    }
    // 12 hours remaining
    else if (timeRemaining <= 12 * 60 * 60 * 1000 && timeRemaining > 6 * 60 * 60 * 1000) {
      escalationLevel = DeadlineEscalationLevel.WARNING_12H;
    }
    // Within grace period (next 15 minutes) - critical
    else if (timeRemaining <= this.config.deadlineGracePeriodMs) {
      escalationLevel = DeadlineEscalationLevel.CRITICAL;
    }

    // Check if escalation level changed
    const previousLevel = this._escalationState.get(taskId);
    if (previousLevel !== escalationLevel) {
      // Escalation level changed - notify
      this._escalationState.set(taskId, escalationLevel);
      onEscalation(taskId, escalationLevel, timeRemaining);
    }

    // Schedule next check
    const nextCheckTimeout = setTimeout(
      () => this._checkDeadline(task, onEscalation, onDeadlineMissed),
      this.config.deadlineCheckIntervalMs
    );

    this._activeTimers.set(taskId, nextCheckTimeout);
  }

  /**
   * Handle a missed deadline - triggers auto-escalation.
   * @param {object} task - The task whose deadline was missed
   * @param {Function} onDeadlineMissed - Callback
   * @private
   */
  _handleDeadlineMissed(task, onDeadlineMissed) {
    const taskId = task.id;

    // Update escalation state to MISSED
    this._escalationState.set(taskId, DeadlineEscalationLevel.MISSED);

    // Stop further monitoring
    this._stopMonitoring(taskId);

    // Trigger the onDeadlineMissed callback
    if (onDeadlineMissed) {
      onDeadlineMissed(task);
    }

    // Emit event: deadline missed - auto-revert to human reassignment
    // In a real system, this would publish to an event bus
    // this._emitEvent({
    //   type: 'deadline_missed',
    //   taskId,
    //   taskType: task.type,
    //   assignedAgent: task.agentId,
    //   timestamp: new Date().toISOString(),
    // });
  }

  /**
   * Stop monitoring a task's deadline.
   * @param {string} taskId - The task to stop monitoring
   */
  _stopMonitoring(taskId) {
    const timeoutId = this._activeTimers.get(taskId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this._activeTimers.delete(taskId);
    }
  }

  /**
   * Stop monitoring all tasks.
   */
  stopAllMonitoring() {
    for (const taskId of this._activeTimers.keys()) {
      this._stopMonitoring(taskId);
    }
    this._activeTimers.clear();
  }

  /**
   * Update a task's deadline.
   * @param {string} taskId - The task ID
   * @param {string} newDeadlineAt - New deadline ISO timestamp
   * @returns {boolean} Whether the deadline was updated
   */
  updateDeadline(taskId, newDeadlineAt) {
    // Validate the new deadline
    if (typeof newDeadlineAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2/.test(newDeadlineAt)) {
      throw new TypeError('newDeadlineAt must be a valid ISO timestamp string');
    }

    const deadlineTime = new Date(newDeadlineAt).getTime();
    const now = Date.now();

    // Can't set a deadline in the past (without going through missed handling)
    if (deadlineTime <= now) {
      // Deadline is in the past; this would trigger immediate missed handling
      // For now, reject or allow with warning
      console.warn(`Attempting to set deadline in the past for task ${taskId}`);
      return false;
    }

    // Update the timer
    this._stopMonitoring(taskId);
    this.startMonitoring({ id: taskId, deadlineAt: newDeadlineAt }, () => {}, () => {});

    return true;
  }

  /**
   * Get the current escalation state for a task.
   * @param {string} taskId - The task ID
   * @returns {string} The current escalation level
   */
  getEscalationLevel(taskId) {
    return this._escalationState.get(taskId) || DeadlineEscalationLevel.NONE;
  }

  /**
   * Get all tasks currently under deadline monitoring.
   * @returns {Map<string, object>} Map of taskId -> timeout info
   */
  getMonitoredTasks() {
    return new Map(this._activeTimers);
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default SupervisorDeadlineEngine;