/**
 * Session Inactivity and Vault Protection Service
 * Provides automated client-side inactivity monitoring, countdown warnings,
 * and automatic privacy locks for public kiosks and shared terminals.
 */

const DEFAULT_TIMEOUT_SECONDS = 300; // 5 minutes
const DEFAULT_WARNING_SECONDS = 30; // 30 seconds countdown

let activityTimeoutId = null;
let warningIntervalId = null;
let currentRemainingSeconds = 0;
let isActive = false;
let registeredCallbacks = {
  onWarning: null,
  onTimeout: null,
  onActivity: null,
};

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];

function clearAllTimers() {
  if (activityTimeoutId) {
    clearTimeout(activityTimeoutId);
    activityTimeoutId = null;
  }
  if (warningIntervalId) {
    clearInterval(warningIntervalId);
    warningIntervalId = null;
  }
}

/**
 * Handles user interaction events by resetting the timer
 */
function handleUserActivity() {
  if (!isActive) return;

  if (registeredCallbacks.onActivity) {
    registeredCallbacks.onActivity();
  }

  // If a warning is currently showing, clear the warning interval and restart
  if (warningIntervalId) {
    clearInterval(warningIntervalId);
    warningIntervalId = null;
  }

  scheduleTimers();
}

let activeTimeoutDuration = DEFAULT_TIMEOUT_SECONDS;
let activeWarningDuration = DEFAULT_WARNING_SECONDS;

function scheduleTimers() {
  clearAllTimers();

  const warningLeadTime = Math.max(0, activeTimeoutDuration - activeWarningDuration);

  // Phase 1: Wait until the warning threshold
  activityTimeoutId = setTimeout(() => {
    currentRemainingSeconds = activeWarningDuration;
    if (registeredCallbacks.onWarning) {
      registeredCallbacks.onWarning(currentRemainingSeconds);
    }

    // Phase 2: Tick down each second during the warning phase
    warningIntervalId = setInterval(() => {
      currentRemainingSeconds -= 1;

      if (currentRemainingSeconds <= 0) {
        clearAllTimers();
        isActive = false;
        detachListeners();
        if (registeredCallbacks.onTimeout) {
          registeredCallbacks.onTimeout();
        }
      } else if (registeredCallbacks.onWarning) {
        registeredCallbacks.onWarning(currentRemainingSeconds);
      }
    }, 1000);
  }, warningLeadTime * 1000);
}

function attachListeners() {
  if (typeof window === 'undefined') return;
  ACTIVITY_EVENTS.forEach((event) => {
    window.addEventListener(event, handleUserActivity, { passive: true });
  });
}

function detachListeners() {
  if (typeof window === 'undefined') return;
  ACTIVITY_EVENTS.forEach((event) => {
    window.removeEventListener(event, handleUserActivity);
  });
}

/**
 * Starts inactivity monitoring
 *
 * @param {Object} options
 * @param {Function} options.onWarning - Called each second during warning countdown with seconds remaining
 * @param {Function} options.onTimeout - Called when full timeout expires
 * @param {Function} [options.onActivity] - Called whenever user interaction occurs
 * @param {number} [options.timeoutSeconds=300] - Total inactivity threshold in seconds
 * @param {number} [options.warningSeconds=30] - Warning countdown window in seconds
 */
export function startInactivityTracker({
  onWarning,
  onTimeout,
  onActivity,
  timeoutSeconds = DEFAULT_TIMEOUT_SECONDS,
  warningSeconds = DEFAULT_WARNING_SECONDS,
} = {}) {
  stopInactivityTracker();

  activeTimeoutDuration = Math.max(10, timeoutSeconds);
  activeWarningDuration = Math.min(activeTimeoutDuration - 1, Math.max(5, warningSeconds));
  registeredCallbacks = { onWarning, onTimeout, onActivity };
  isActive = true;

  attachListeners();
  scheduleTimers();
}

/**
 * Resets the inactivity timer (e.g. when user clicks "Extend Session")
 */
export function resetInactivityTracker() {
  if (!isActive) return;
  handleUserActivity();
}

/**
 * Stops monitoring and cleans up all listeners and timers
 */
export function stopInactivityTracker() {
  clearAllTimers();
  detachListeners();
  isActive = false;
  currentRemainingSeconds = 0;
  registeredCallbacks = {
    onWarning: null,
    onTimeout: null,
    onActivity: null,
  };
}

/**
 * Returns whether inactivity tracking is currently active
 */
export function isTrackerActive() {
  return isActive;
}
