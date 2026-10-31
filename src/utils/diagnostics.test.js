import { describe, it, expect, vi, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROUTE_PATTERNS,
  UNKNOWN_ROUTE,
  SAFE_KEYS,
  REDACTED,
  routeOf,
  redactUrl,
  redactText,
  redactValue,
  buildErrorEvent,
  describeRequest,
  setDiagnosticsSink,
  reportError,
  logDiagnostic,
} from './diagnostics';

const ORIGIN = 'https://app.example';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcDEF123_-xyz';

afterEach(() => setDiagnosticsSink(null));

describe('routeOf', () => {
  it('names every route of the app by its pattern', () => {
    expect(routeOf('/')).toBe('/');
    expect(routeOf('/services')).toBe('/services');
    expect(routeOf('/track')).toBe('/track');
    expect(routeOf('/admin')).toBe('/admin');
  });

  it('replaces path parameters with their name, so ids and tokens are not kept', () => {
    expect(routeOf('/services/ration-card')).toBe('/services/:id');
    expect(routeOf('/shared-checklist/abc123SECRETtoken')).toBe('/shared-checklist/:token');
  });

  it('ignores the query string and fragment', () => {
    expect(routeOf('/track?id=SRV-98234710&ref=x#top')).toBe('/track');
    expect(routeOf(`${ORIGIN}/services?q=aadhaar+123456789012`)).toBe('/services');
  });

  it('does not echo paths it does not know', () => {
    expect(routeOf('/track/SRV-98234710')).toBe(UNKNOWN_ROUTE);
    expect(routeOf('/no/such/page/9876543210')).toBe(UNKNOWN_ROUTE);
    expect(routeOf('')).toBe('/');
    expect(routeOf(undefined)).toBe(UNKNOWN_ROUTE);
    expect(routeOf(null)).toBe(UNKNOWN_ROUTE);
  });

  it('lists the routes the app defines', () => {
    const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
    const defined = [...app.matchAll(/<Route path="([^"*]+?)(?:\/\*)?"/g)].map((m) => m[1]);
    for (const path of defined) expect(ROUTE_PATTERNS, path).toContain(path);
  });
});

describe('redactUrl', () => {
  it('reduces a URL on this site to its route pattern', () => {
    expect(redactUrl(`${ORIGIN}/track?id=SRV-98234710&token=${JWT}#x`, ORIGIN)).toBe('/track');
    expect(redactUrl('/services/pan-card?q=1', ORIGIN)).toBe('/services/:id');
  });

  it('reduces another site to its origin only', () => {
    expect(redactUrl('https://api.other.example/v1/users/42?email=a@b.in', ORIGIN)).toBe('https://api.other.example');
  });

  it('drops credentials and handles garbage', () => {
    expect(redactUrl('https://user:pw@api.other.example/x', ORIGIN)).toBe('https://api.other.example');
    expect(redactUrl('http://[bad', ORIGIN)).toBe('[OMITTED]');
  });
});

describe('redactText', () => {
  it('masks emails, phone numbers, Aadhaar, PAN, reference ids and tokens', () => {
    const text = `failed for asha@example.in phone 9876543210 aadhaar 1234 5678 9012 PAN ABCDE1234F ref SRV-98234710 token=${JWT}`;
    const out = redactText(text, 500);
    for (const secret of ['asha@example.in', '9876543210', '1234 5678 9012', 'ABCDE1234F', 'SRV-98234710', JWT]) {
      expect(out).not.toContain(secret);
    }
  });

  it('cuts URLs inside messages to their origin', () => {
    const out = redactText(`Failed to fetch https://api.example.org/track?id=SRV-98234710&k=1 (status 500)`);
    expect(out).toContain('https://api.example.org');
    expect(out).not.toContain('SRV-98234710');
    expect(out).not.toContain('?id=');
  });

  it('cuts relative paths with a query string', () => {
    const out = redactText('Could not load /services?q=my+secret+search');
    expect(out).toBe('Could not load /services');
  });

  it('bounds the length and collapses whitespace', () => {
    expect(redactText('a '.repeat(500))).toHaveLength(200);
    expect(redactText('one\n\n   two')).toBe('one two');
  });

  it('handles empty input', () => {
    expect(redactText(null)).toBe('');
    expect(redactText(undefined)).toBe('');
  });
});

describe('redactValue', () => {
  it('keeps only allow-listed keys and replaces everything else', () => {
    const state = {
      code: 'form_param_nil',
      status: 422,
      route: '/services',
      fullName: 'Asha Verma',
      email: 'asha@example.in',
      phone: '9876543210',
      aadhaar: '123456789012',
      applicationId: 'SRV-98234710',
      password: 'hunter2',
      sessionToken: JWT,
      formData: { notes: 'private complaint', dob: '1990-01-01' },
      requestBody: '{"email":"asha@example.in"}',
    };
    const out = redactValue(state);
    expect(out.code).toBe('form_param_nil');
    expect(out.status).toBe(422);
    expect(out.route).toBe('/services');
    for (const key of ['fullName', 'email', 'phone', 'aadhaar', 'applicationId', 'password', 'sessionToken', 'formData', 'requestBody']) {
      expect(out[key], key).toBe(REDACTED);
    }
    const json = JSON.stringify(out);
    for (const secret of ['Asha', 'asha@example.in', '9876543210', '123456789012', 'SRV-98234710', 'hunter2', 'private complaint', JWT]) {
      expect(json).not.toContain(secret);
    }
  });

  it('masks personal data inside allowed string values', () => {
    expect(redactValue({ reason: 'sent to asha@example.in' }).reason).not.toContain('asha@example.in');
  });

  it('handles arrays, nesting depth, cycles and odd types', () => {
    const cyclic = { code: 'x' };
    cyclic.code = cyclic;
    expect(() => redactValue(cyclic)).not.toThrow();
    expect(redactValue([{ code: 'a' }, { name: 'secret' }])).toEqual([{ code: 'a' }, { name: REDACTED }]);
    expect(redactValue(() => 1)).toBe('[OMITTED]');
    expect(redactValue(Symbol('s'))).toBe('[OMITTED]');
    expect(redactValue(null)).toBeNull();
    expect(redactValue(undefined)).toBeUndefined();
    expect(redactValue(7)).toBe(7);
    const deep = { code: { code: { code: { code: { code: 'deep' } } } } };
    expect(JSON.stringify(redactValue(deep))).toContain('[OMITTED]');
  });

  it('limits very large arrays', () => {
    expect(redactValue(Array.from({ length: 1000 }, () => 1))).toHaveLength(20);
  });

  it('turns an Error into a safe event', () => {
    const out = redactValue(new TypeError('bad value for asha@example.in'));
    expect(out.name).toBe('TypeError');
    expect(out.message).not.toContain('asha@example.in');
  });

  it('lists a small set of safe keys', () => {
    expect(SAFE_KEYS).not.toEqual(expect.arrayContaining(['email', 'name', 'body', 'password', 'token']));
  });
});

describe('buildErrorEvent', () => {
  it('keeps the error name, a safe code, the status, a redacted message and the route name', () => {
    const error = Object.assign(new Error('Could not save for asha@example.in'), { code: 'form_param_nil', status: 422 });
    const event = buildErrorEvent(error, { route: `${ORIGIN}/track?id=SRV-98234710` });
    expect(event).toEqual({
      type: 'error',
      name: 'Error',
      code: 'form_param_nil',
      status: 422,
      message: expect.any(String),
      route: '/track',
    });
    expect(event.message).not.toContain('asha@example.in');
    expect(event.message).toContain('Could not save');
  });

  it('reads the code Clerk puts in errors[0]', () => {
    expect(buildErrorEvent({ errors: [{ code: 'form_identifier_exists', longMessage: 'asha@example.in exists' }] }).code).toBe('form_identifier_exists');
  });

  it('never copies the stack, cause, response, request or other properties', () => {
    const error = Object.assign(new Error('x'), {
      response: { body: 'asha@example.in', headers: { authorization: `Bearer ${JWT}` } },
      request: { body: '{"aadhaar":"123456789012"}' },
      formState: { phone: '9876543210' },
      cause: new Error('inner asha@example.in'),
    });
    const json = JSON.stringify(buildErrorEvent(error));
    expect(json).not.toContain('stack');
    expect(json).not.toContain('asha@example.in');
    expect(json).not.toContain('9876543210');
    expect(json).not.toContain('123456789012');
    expect(json).not.toContain(JWT);
    expect(Object.keys(buildErrorEvent(error)).sort()).toEqual(['message', 'name', 'route', 'type']);
  });

  it('does not trust unusual names, codes or statuses', () => {
    const event = buildErrorEvent({ name: 'Asha Verma 9876543210', code: 'has spaces & junk', status: 'ok', message: 'm' });
    expect(event.name).toBe('Error');
    expect(event.code).toBeUndefined();
    expect(event.status).toBeUndefined();
  });

  it('accepts a thrown string or nothing at all', () => {
    expect(buildErrorEvent('plain asha@example.in').message).not.toContain('asha@example.in');
    expect(() => buildErrorEvent(undefined)).not.toThrow();
    expect(() => buildErrorEvent(null)).not.toThrow();
  });
});

describe('describeRequest', () => {
  it('reports the method, a redacted target and whether there was a body, never the body', () => {
    const request = describeRequest({
      method: 'post',
      url: 'https://api.other.example/apply?token=abc',
      body: JSON.stringify({ name: 'Asha Verma', aadhaar: '123456789012' }),
      headers: { Authorization: `Bearer ${JWT}` },
    });
    expect(request).toEqual({ type: 'request', method: 'POST', target: 'https://api.other.example', hasBody: true });
    const json = JSON.stringify(request);
    expect(json).not.toContain('Asha');
    expect(json).not.toContain('123456789012');
    expect(json).not.toContain(JWT);
  });

  it('copes with missing parts and odd methods', () => {
    expect(describeRequest()).toEqual({ type: 'request', method: 'GET', target: '[OMITTED]', hasBody: false });
    expect(describeRequest({ method: 'TRACE-ASHA', url: '/track?id=1' }).method).toBe('OTHER');
    expect(describeRequest({ url: '/track?id=1' }).target).toBe('/track');
  });
});

describe('reportError and the sink', () => {
  it('does nothing visible without a sink, and still returns the safe event', () => {
    const event = reportError(new Error('boom'), { route: '/vault' });
    expect(event.route).toBe('/vault');
  });

  it('gives a registered sink only the safe event', () => {
    const sink = vi.fn();
    setDiagnosticsSink(sink);
    reportError(Object.assign(new Error('for asha@example.in'), { formState: { phone: '9876543210' } }), { route: '/profile' });
    expect(sink).toHaveBeenCalledTimes(1);
    const json = JSON.stringify(sink.mock.calls[0][0]);
    expect(json).toContain('/profile');
    expect(json).not.toContain('asha@example.in');
    expect(json).not.toContain('9876543210');
  });

  it('survives a sink that throws, and a sink can be removed', () => {
    setDiagnosticsSink(() => {
      throw new Error('tracker down');
    });
    expect(() => reportError(new Error('x'))).not.toThrow();
    const sink = vi.fn();
    setDiagnosticsSink(sink);
    setDiagnosticsSink(null);
    reportError(new Error('x'));
    expect(sink).not.toHaveBeenCalled();
  });

  it('ignores a sink that is not a function', () => {
    setDiagnosticsSink('https://tracker.example');
    expect(() => reportError(new Error('x'))).not.toThrow();
  });
});

describe('logDiagnostic', () => {
  const jsonError = (() => {
    try {
      JSON.parse('{"email":"asha@example.in","applicationId":"SRV-98234710",');
    } catch (error) {
      return error;
    }
    return new Error('unreachable');
  })();

  it('in production logs the fixed label and nothing from the error', () => {
    const log = vi.fn();
    logDiagnostic('Failed to load saved items', jsonError, { dev: false, log });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Failed to load saved items');
  });

  it('in development adds only the safe fields', () => {
    const log = vi.fn();
    logDiagnostic('Failed to load saved items', jsonError, { dev: true, log });
    const [label, event] = log.mock.calls[0];
    expect(label).toBe('Failed to load saved items');
    expect(event.name).toBe('SyntaxError');
    expect(JSON.stringify(event)).not.toContain('asha@example.in');
    expect(JSON.stringify(event)).not.toContain('SRV-98234710');
  });

  it('logs just the label when there is no error', () => {
    const log = vi.fn();
    logDiagnostic('Something happened', undefined, { dev: true, log });
    expect(log).toHaveBeenCalledWith('Something happened');
  });

  it('writes to console.error by default', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logDiagnostic('Label', new Error('x'), { dev: false });
    expect(spy).toHaveBeenCalledWith('Label');
    spy.mockRestore();
  });
});

describe('the app does not log raw errors or send diagnostics anywhere', () => {
  const SRC = fileURLToPath(new URL('..', import.meta.url));
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(js|jsx)$/.test(name) && !/\.test\./.test(name)) files.push(full);
    }
  };
  walk(SRC);
  const read = (file) => readFileSync(file, 'utf8');
  const rel = (file) => relative(SRC, file).replace(/\\/g, '/');

  // Logging that is fixed text or a plain string (no error object) is allowed in these files.
  const CONSOLE_ALLOWED = new Set(['utils/diagnostics.js', 'utils/providerError.js', 'utils/a11yLandmarks.js', 'services/voiceCivicAssistantService.js', 'pages/Assistant.jsx', 'components/common/RouteErrorBoundary.jsx']);
  // RouteErrorBoundary logs the error to the console in development only and nothing in production (its own tests check both).

  it('uses logDiagnostic instead of console.error/console.warn with an error object', () => {
    const offenders = files
      .filter((file) => !CONSOLE_ALLOWED.has(rel(file)))
      .filter((file) => /console\.(error|warn)\(/.test(read(file)))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('keeps the one speech-error log in Assistant.jsx to a plain event code', () => {
    const lines = read(join(SRC, 'pages/Assistant.jsx')).split('\n').filter((line) => /console\.(error|warn)\(/.test(line));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('event.error');
  });

  it('has no network calls for telemetry or error tracking in the source', () => {
    const offenders = files
      .filter((file) => !/diagnostics\.js$/.test(file))
      .filter((file) => /\b(sendBeacon|sentry|bugsnag|datadog|rollbar|logrocket|posthog|mixpanel|amplitude)\b|\bgtag\(|\bga\(/i.test(read(file)))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
