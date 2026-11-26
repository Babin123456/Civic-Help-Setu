/** Shared, public API failures. Recovery never depends on a provider's message text. */
export const API_ERROR_VERSION = 1;
export const API_ERRORS = Object.freeze(Object.fromEntries(Object.entries({
  INVALID_REQUEST: { statuses: [400, 414, 415], message: 'Check the request and try again.', retryable: false, action: 'edit_request' },
  UNAUTHENTICATED: { statuses: [401], message: 'Sign in again to continue.', retryable: false, action: 'sign_in' },
  FORBIDDEN: { statuses: [403], message: 'You do not have permission for this action.', retryable: false, action: 'request_access' },
  NOT_FOUND: { statuses: [404], message: 'The requested item was not found.', retryable: false, action: 'refresh' },
  METHOD_NOT_ALLOWED: { statuses: [405], message: 'This action is not supported by this endpoint.', retryable: false, action: 'change_action' },
  CONFLICT: { statuses: [409, 412], message: 'The item changed. Refresh it before trying again.', retryable: false, action: 'refresh' },
  PAYLOAD_TOO_LARGE: { statuses: [413], message: 'The submitted data is too large.', retryable: false, action: 'reduce_payload' },
  VALIDATION_FAILED: { statuses: [422], message: 'Some submitted fields need correction.', retryable: false, action: 'edit_request' },
  SENSITIVE_DATA_REJECTED: { statuses: [422], message: 'Personal identifiers cannot be submitted here.', retryable: false, action: 'remove_private_data' },
  RATE_LIMITED: { statuses: [429], message: 'Too many requests. Wait before trying again.', retryable: true, action: 'wait' },
  DEPENDENCY_UNAVAILABLE: { statuses: [502, 503, 504], message: 'The service is temporarily unavailable.', retryable: true, action: 'retry_later' },
  INTERNAL_ERROR: { statuses: [500], message: 'The request could not be completed.', retryable: false, action: 'contact_support' },
  INVALID_RESPONSE: { statuses: [200], message: 'The service returned an unreadable response.', retryable: false, action: 'refresh' },
  NETWORK_ERROR: { statuses: [0], message: 'Check your connection before trying again.', retryable: true, action: 'check_connection' },
}).map(([code, value]) => [code, Object.freeze({ ...value, statuses: Object.freeze(value.statuses) })])));

export const validCorrelationId = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
export const codeForStatus = status => Object.keys(API_ERRORS).find(code => API_ERRORS[code].statuses.includes(status)) || (status >= 400 && status < 500 ? 'INVALID_REQUEST' : 'INTERNAL_ERROR');
export const boundedRetryDelay = value => Number.isInteger(value) && value >= 0 && value <= 3600 ? value : null;

/** Accept only the known contract and correlation format; never expose arbitrary response fields. */
export function describeApiFailure({ status = 0, body, correlationId } = {}) {
  const legacySensitive = body?.code === 'ERR_SYNTH_PII_SUSPECT' && body?.errorVersion === undefined;
  const candidate = legacySensitive ? 'SENSITIVE_DATA_REJECTED' : body?.errorVersion === API_ERROR_VERSION && typeof body.code === 'string' ? body.code : null;
  const code = Object.hasOwn(API_ERRORS, candidate) && API_ERRORS[candidate].statuses.includes(status) ? candidate : codeForStatus(status);
  const definition = API_ERRORS[code];
  const id = validCorrelationId(correlationId) ? correlationId : validCorrelationId(body?.correlationId) ? body.correlationId : null;
  const delay = definition.retryable ? boundedRetryDelay(body?.retryAfterSeconds) : null;
  return { code, status, message: definition.message, retryable: definition.retryable, recoveryAction: definition.action, correlationId: id, ...(delay === null ? {} : { retryAfterSeconds: delay }) };
}

export function apiFailureError(response, body) {
  const safe = describeApiFailure({ status: response?.status ?? 0, body, correlationId: response?.headers?.get?.('X-Correlation-ID') });
  return Object.assign(new Error(safe.message), safe, { name: 'CivicApiError' });
}
