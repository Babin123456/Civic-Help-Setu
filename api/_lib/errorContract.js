import { randomUUID } from 'node:crypto';
import { API_ERROR_VERSION, describeApiFailure, boundedRetryDelay } from '../../src/utils/civicErrorContract.js';

/** Adapt the existing Node response boundary; authorization and successful payloads stay in the handler. */
export function withApiErrorContract(handler, { log = event => console.error(event) } = {}) {
  return async function contractedHandler(req, res) {
    const correlationId = randomUUID();
    res.setHeader('X-Correlation-ID', correlationId);
    let sent = false;
    let currentStatus = res.statusCode || 200;
    let emittedBody;
    let emittedStatus;
    const emit = (status, body) => {
      if (sent || res.writableEnded || res.headersSent) return undefined;
      const failure = status >= 400 || body?.ok === false || body?.success === false || (body && Object.hasOwn(body, 'error') && body.error != null);
      if (failure) {
        status = status >= 400 ? status : 400;
        const retryHeader = res.getHeader?.('Retry-After');
        const seconds = typeof retryHeader === 'string' && /^\d{1,4}$/.test(retryHeader) ? Number(retryHeader) : retryHeader;
        const retryAfterSeconds = boundedRetryDelay(body?.retryAfterSeconds) ?? boundedRetryDelay(seconds);
        const safe = describeApiFailure({ status, body: { ...body, ...(retryAfterSeconds === null ? {} : { retryAfterSeconds }) }, correlationId });
        res.setHeader('Cache-Control', 'no-store');
        if (safe.retryAfterSeconds !== undefined) res.setHeader('Retry-After', String(safe.retryAfterSeconds));
        else res.removeHeader?.('Retry-After');
        const publicError = body?.error && typeof body.error === 'object' && !Array.isArray(body.error) ? { code: safe.code, message: safe.message } : safe.message;
        body = { errorVersion: API_ERROR_VERSION, ok: false, success: false, error: publicError, message: safe.message, code: safe.code, retryable: safe.retryable, recoveryAction: safe.recoveryAction, correlationId, ...(safe.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: safe.retryAfterSeconds }) };
      }
      emittedBody = body;
      emittedStatus = status;
      const result = res.status(status).json(body);
      sent = true;
      return result;
    };
    const response = new Proxy(res, {
      set(target, property, value) {
        if (property === 'statusCode') currentStatus = value;
        return Reflect.set(target, property, value);
      },
      get(target, property) {
        if (property === 'status') return status => { target.status(status); currentStatus = status; return response; };
        if (property === 'json') return body => emit(currentStatus, body);
        if (property === 'setHeader') return (name, value) => {
          if (String(name).toLowerCase() !== 'x-correlation-id') target.setHeader(name, value);
          return response;
        };
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    try {
      const result = await handler(req, response);
      if (sent || res.writableEnded || res.headersSent) return result;
      if (result && typeof result.status === 'number' && Object.hasOwn(result, 'body') && !(result instanceof Response)) {
        for (const [name, value] of Object.entries(result.headers || {})) response.setHeader(name, value);
        emit(result.status, result.body);
        return { ...result, status: emittedStatus, body: emittedBody };
      }
      if (result instanceof Response && result.status >= 400) {
        for (const [name, value] of result.headers) response.setHeader(name, value);
        await result.body?.cancel();
        return emit(result.status, {});
      }
      return result;
    } catch {
      // Fixed schema only: raw exception, request URL, headers and body are never logged here.
      try { log({ event: 'api_failure', code: 'INTERNAL_ERROR', status: 500, correlationId }); } catch { /* Logging must not prevent a safe response. */ }
      return emit(500, {});
    }
  };
}
