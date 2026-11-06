/**
 * authErrorSanitizer.js
 *
 * Security & Privacy Sanitizer for Authentication & Identity Providers (#209).
 * Guarantees that raw provider exceptions, credentials, stack traces, internal IDs,
 * session cookies, tokens, and sensitive runtime configuration variables NEVER leak
 * to production user interfaces.
 *
 * Requirements & Acceptance Criteria:
 * 1. Zero Leakage: No tokens, stack traces, environment keys, or raw provider objects
 *    appear in production UI.
 * 2. Missing Auth Config: Explicit, safe fallback states for missing or corrupt auth setup.
 * 3. Safe Recovery: Unknown errors map to friendly, generic recovery actions.
 * 4. Development Diagnostics: Safe, redacted debug diagnostics available exclusively
 *    in development mode.
 */

import { redactSecrets } from './dataMinimization';

export const AUTH_ERROR_CODES = {
  // Configuration failures
  MISSING_CONFIG: 'auth_missing_configuration',
  INVALID_KEY: 'auth_invalid_publishable_key',
  PROVIDER_UNREACHABLE: 'auth_provider_unreachable',

  // Credential & account states
  INVALID_CREDENTIALS: 'auth_invalid_credentials',
  ACCOUNT_LOCKED: 'auth_account_locked',
  SESSION_EXPIRED: 'auth_session_expired',
  USER_EXISTS: 'auth_user_already_exists',
  PASSWORD_COMPROMISED: 'auth_password_breached',
  PASSWORD_TOO_WEAK: 'auth_password_weak',
  RATE_LIMITED: 'auth_rate_limit_exceeded',

  // Network & Service
  NETWORK_DISCONNECTED: 'auth_network_disconnected',
  SERVICE_UNAVAILABLE: 'auth_service_unavailable',
  UNKNOWN_ERROR: 'auth_unknown_error',
};

const SAFE_USER_MESSAGES = {
  [AUTH_ERROR_CODES.MISSING_CONFIG]: {
    title: 'Authentication Not Configured',
    message: 'The identity service is running in local demonstration mode or configuration is incomplete.',
    action: 'You can continue using the portal in demonstration mode without creating an account.',
    retryable: false,
  },
  [AUTH_ERROR_CODES.INVALID_KEY]: {
    title: 'Authentication Service Unavailable',
    message: 'The portal cannot connect to the identity provider due to a configuration mismatch.',
    action: 'Please browse available civic services as a guest or contact the system administrator.',
    retryable: false,
  },
  [AUTH_ERROR_CODES.PROVIDER_UNREACHABLE]: {
    title: 'Service Temporarily Unreachable',
    message: 'We could not establish a secure connection to the authentication provider.',
    action: 'Please check your internet connection and try again in a few moments.',
    retryable: true,
  },
  [AUTH_ERROR_CODES.INVALID_CREDENTIALS]: {
    title: 'Incorrect Details',
    message: 'The email or password you entered does not match our records.',
    action: 'Please double-check your credentials or use the password recovery option.',
    retryable: true,
  },
  [AUTH_ERROR_CODES.ACCOUNT_LOCKED]: {
    title: 'Account Temporarily Locked',
    message: 'Your account has been temporarily protected after several unsuccessful attempts.',
    action: 'Please wait 15 minutes before attempting to sign in again.',
    retryable: false,
  },
  [AUTH_ERROR_CODES.SESSION_EXPIRED]: {
    title: 'Session Expired',
    message: 'For your security, your previous session has ended.',
    action: 'Please sign in again to continue with your application.',
    retryable: true,
  },
  [AUTH_ERROR_CODES.USER_EXISTS]: {
    title: 'Account Already Exists',
    message: 'An account is already registered with this email address.',
    action: 'Try signing in with your existing account instead.',
    retryable: true,
  },
  [AUTH_ERROR_CODES.PASSWORD_COMPROMISED]: {
    title: 'Insecure Password Detected',
    message: 'This password has appeared in public security breach databases.',
    action: 'For your protection, please select a distinct and stronger password.',
    retryable: true,
  },
  [AUTH_ERROR_CODES.PASSWORD_TOO_WEAK]: {
    title: 'Password Requirements Not Met',
    message: 'Please choose a password with at least 8 characters, including numbers and symbols.',
    action: 'Update your password according to the security guidelines.',
    retryable: true,
  },
  [AUTH_ERROR_CODES.RATE_LIMITED]: {
    title: 'Too Many Requests',
    message: 'We have received too many requests from your device in a short time.',
    action: 'Please wait a moment before trying again.',
    retryable: true,
  },
  [AUTH_ERROR_CODES.NETWORK_DISCONNECTED]: {
    title: 'Connection Lost',
    message: 'You appear to be offline. Network requests cannot be completed.',
    action: 'Check your network settings and reconnect.',
    retryable: true,
  },
  [AUTH_ERROR_CODES.SERVICE_UNAVAILABLE]: {
    title: 'Identity Service Maintenance',
    message: 'The identity provider is currently performing scheduled maintenance.',
    action: 'Please try again shortly.',
    retryable: true,
  },
  [AUTH_ERROR_CODES.UNKNOWN_ERROR]: {
    title: 'Unable to Complete Request',
    message: 'An unexpected issue occurred while communicating with the authentication service.',
    action: 'Please refresh the page and try again. Your account remains secure.',
    retryable: true,
  },
};

/**
 * Normalizes any error object, string, or status code into an AUTH_ERROR_CODES key.
 */
export function classifyAuthError(error, context = {}) {
  if (context.online === false) {
    return AUTH_ERROR_CODES.NETWORK_DISCONNECTED;
  }

  if (!error) {
    return AUTH_ERROR_CODES.UNKNOWN_ERROR;
  }

  // Check for configuration errors
  const errStr = typeof error === 'string' ? error : `${error.name || ''} ${error.message || ''}`;
  if (/missing clerk|publishable key|vite_clerk/i.test(errStr)) {
    return AUTH_ERROR_CODES.MISSING_CONFIG;
  }
  if (/invalid publishable key|pk_test_|pk_live_/i.test(errStr)) {
    return AUTH_ERROR_CODES.INVALID_KEY;
  }

  // Code checks from Clerk / OAuth exceptions
  const code = error?.code || error?.errors?.[0]?.code || '';
  const status = error?.status || error?.statusCode;

  if (code === 'form_identifier_exists' || code === 'user_exists') {
    return AUTH_ERROR_CODES.USER_EXISTS;
  }
  if (code === 'form_password_pwned') {
    return AUTH_ERROR_CODES.PASSWORD_COMPROMISED;
  }
  if (code === 'form_password_length_too_short' || code === 'form_password_not_strong_enough') {
    return AUTH_ERROR_CODES.PASSWORD_TOO_WEAK;
  }
  if (code === 'session_exists' || code === 'authentication_invalid' || status === 401) {
    return AUTH_ERROR_CODES.SESSION_EXPIRED;
  }
  if (code === 'too_many_requests' || code === 'rate_limit_exceeded' || status === 429) {
    return AUTH_ERROR_CODES.RATE_LIMITED;
  }
  if (/network ?error|failed to fetch|load failed/i.test(errStr)) {
    return AUTH_ERROR_CODES.PROVIDER_UNREACHABLE;
  }
  if (status === 403) {
    return AUTH_ERROR_CODES.ACCOUNT_LOCKED;
  }
  if (status >= 500) {
    return AUTH_ERROR_CODES.SERVICE_UNAVAILABLE;
  }

  return AUTH_ERROR_CODES.UNKNOWN_ERROR;
}

/**
 * Sanitizes any raw error into safe, user-friendly UI presentation object.
 * Guaranteed to never expose raw tokens, stack traces, or environment variables.
 *
 * @param {unknown} error - Raw thrown error
 * @param {Object} [context={}] - Contextual flags (e.g. online status)
 * @returns {{ code: string, title: string, message: string, action: string, retryable: boolean }}
 */
export function getSafeAuthErrorMessage(error, context = {}) {
  const code = classifyAuthError(error, context);
  const safe = SAFE_USER_MESSAGES[code] || SAFE_USER_MESSAGES[AUTH_ERROR_CODES.UNKNOWN_ERROR];

  return {
    code,
    title: safe.title,
    message: safe.message,
    action: safe.action,
    retryable: safe.retryable,
  };
}

/**
 * Formats development-only diagnostic details without secrets.
 * In production environments, strictly returns null.
 *
 * @param {unknown} error
 * @param {boolean} [isDevelopment=false]
 * @returns {Object|null}
 */
export function getDevAuthDiagnostics(error, isDevelopment = false) {
  if (!isDevelopment) {
    return null;
  }

  if (!error || typeof error !== 'object') {
    return { errorType: typeof error, rawValue: String(error) };
  }

  return {
    name: error.name || 'Error',
    code: error.code || error.errors?.[0]?.code || 'N/A',
    status: error.status || error.statusCode || null,
    sanitizedMessage: redactSecrets(error.message || ''),
    hasStackTrace: Boolean(error.stack),
    diagnosticsExcludedSecrets: true,
  };
}
