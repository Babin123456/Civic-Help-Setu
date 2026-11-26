import { describe, it, expect, vi } from 'vitest';
import {
  scrubPii,
  scrubString,
  createScrubbingLogger,
  REDACTED_VALUE,
  CIRCULAR_VALUE,
  MAX_DEPTH_VALUE,
} from '../api/_lib/piiScrubber.js';
import { withApiErrorContract } from '../api/_lib/errorContract.js';

describe('Centralized PII Redaction & Log-Scrubbing Pipeline (#1348)', () => {
  it('masks Aadhaar, PAN, phone, email, JWT, and API keys in strings', () => {
    const raw = 'User test.user@example.com phone +91 9876543210 PAN ABCDE1234F Aadhaar 2345 6789 0123 Bearer abcdef123456';
    const scrubbed = scrubString(raw);
    expect(scrubbed).toContain('[REDACTED:EMAIL]');
    expect(scrubbed).toContain('[REDACTED:PHONE]');
    expect(scrubbed).toContain('[REDACTED:PAN]');
    expect(scrubbed).toContain('[REDACTED:AADHAAR]');
    expect(scrubbed).toContain('[REDACTED:TOKEN]');
    expect(scrubbed).not.toContain('9876543210');
    expect(scrubbed).not.toContain('ABCDE1234F');
  });

  it('redacts sensitive keys recursively while preserving allowlisted diagnostic keys', () => {
    const payload = {
      correlationId: 'corr-123',
      route: 'public-toilets',
      user: {
        email: 'citizen@gov.in',
        phoneNumber: '9876543210',
        ward: 12,
      },
      headers: {
        authorization: 'Bearer secret-token-value',
        'x-real-ip': '203.0.113.5',
      },
    };

    const scrubbed = scrubPii(payload);
    expect(scrubbed.correlationId).toBe('corr-123');
    expect(scrubbed.route).toBe('public-toilets');
    expect(scrubbed.user.ward).toBe(12);
    expect(scrubbed.user.email).toBe(REDACTED_VALUE);
    expect(scrubbed.user.phoneNumber).toBe(REDACTED_VALUE);
    expect(scrubbed.headers.authorization).toBe(REDACTED_VALUE);
    expect(scrubbed.headers['x-real-ip']).toBe(REDACTED_VALUE);
  });

  it('handles circular references, deep nesting, and Error objects safely', () => {
    const circular = { name: 'root' };
    circular.self = circular;
    const scrubbedCircular = scrubPii(circular);
    expect(scrubbedCircular.self).toBe(CIRCULAR_VALUE);

    const deep = { a: { b: { c: { d: 'too-deep' } } } };
    const scrubbedDeep = scrubPii(deep, { maxDepth: 2 });
    expect(scrubbedDeep.a.b).toBe(MAX_DEPTH_VALUE);

    const err = new Error('Failed for citizen@example.com');
    const scrubbedErr = scrubPii(err);
    expect(scrubbedErr.message).toBe('Failed for [REDACTED:EMAIL]');
  });

  it('processes adversarial long strings without ReDoS delay', () => {
    const start = Date.now();
    const longInput = 'a'.repeat(5000) + '@invalid ' + '1'.repeat(5000);
    const out = scrubString(longInput);
    expect(out.length).toBeLessThanOrEqual(8192);
    expect(Date.now() - start).toBeLessThan(100);
  });

  it('scrubs logs emitted via createScrubbingLogger and integrates with withApiErrorContract', async () => {
    const sink = vi.fn();
    const logger = createScrubbingLogger(sink);
    logger({ event: 'auth_fail', token: 'secret123', message: 'Email user@test.org failed' });

    expect(sink).toHaveBeenCalledWith({
      event: 'auth_fail',
      token: REDACTED_VALUE,
      message: 'Email [REDACTED:EMAIL] failed',
    });

    const failingHandler = withApiErrorContract(async () => {
      throw new Error('boom');
    });
    const res = {
      statusCode: 200,
      writableEnded: false,
      headersSent: false,
      setHeader() { return res; },
      getHeader() { return undefined; },
      removeHeader() {},
      status(c) { res.statusCode = c; return res; },
      json(b) { res.body = b; res.writableEnded = true; return res; },
    };
    await failingHandler({}, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });
});
