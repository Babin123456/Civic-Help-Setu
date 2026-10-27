import { redactSecrets } from './dataMinimization';

/**
 * Turns whatever a provider (Clerk, a browser API) throws into text that is safe
 * to show and to log.
 *
 * describeProviderError  fixed wording picked from the error code. The provider's
 *                        own message, ids, trace ids and meta are never copied.
 * logProviderError       production: one line with the label, nothing else.
 *                        development: code, status and a redacted message only.
 *
 * Sign-in redirect failures already go through utils/authFailure.js; this covers
 * the forms (sign up, profile save) that used to print err.errors[0].message.
 */

const MESSAGES = {
  form_identifier_exists: 'An account with these details already exists. Try signing in instead.',
  form_password_pwned: 'That password has appeared in a known data breach. Please choose a different one.',
  form_password_length_too_short: 'That password is too short. Please use a longer one.',
  form_password_not_strong_enough: 'That password is too easy to guess. Please choose a stronger one.',
  form_password_size_in_bytes_exceeded: 'That password is too long.',
  form_param_format_invalid: 'One of the fields is not in the right format. Please check it and try again.',
  form_param_nil: 'Please fill in all the required fields.',
  form_param_value_invalid: 'One of the fields has a value that is not allowed.',
  form_username_invalid_length: 'That username has the wrong length.',
  form_username_invalid_character: 'That username has characters that are not allowed.',
  session_exists: 'You are already signed in.',
  too_many_requests: 'Too many attempts. Please wait a few minutes and try again.',
  rate_limit_exceeded: 'Too many attempts. Please wait a few minutes and try again.',
  network_error: 'We could not reach the service. Check your connection and try again.',
};

const NETWORK_TEXT = /network ?error|failed to fetch|load failed|network request failed/i;

const codeOf = (error) => {
  const code = error?.errors?.[0]?.code ?? error?.code;
  return typeof code === 'string' ? code : '';
};

const statusOf = (error) => {
  const status = error?.status ?? error?.statusCode;
  return Number.isInteger(status) ? status : null;
};

export const describeProviderError = (error, fallback = 'Something went wrong. Please try again.') => {
  const code = codeOf(error);
  if (Object.hasOwn(MESSAGES, code)) return MESSAGES[code];
  if (statusOf(error) === 429) return MESSAGES.too_many_requests;
  if (typeof error?.message === 'string' && NETWORK_TEXT.test(`${error.name || ''} ${error.message}`)) {
    return MESSAGES.network_error;
  }
  return fallback;
};

const isDev = () => Boolean(import.meta.env?.DEV);

/**
 * @param {string} label short fixed text, e.g. 'Sign-up failed'
 * @param {unknown} error whatever was thrown
 * @param {{dev?: boolean, log?: Function}} [options] overridable for tests
 */
export const logProviderError = (label, error, { dev = isDev(), log = console.error } = {}) => {
  if (!dev) {
    log(label);
    return;
  }
  log(label, {
    code: codeOf(error) || undefined,
    status: statusOf(error) ?? undefined,
    message: redactSecrets(typeof error?.message === 'string' ? error.message : ''),
  });
};
