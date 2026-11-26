import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  RELIEF_PUBLIC_QUEUE,
  validateReliefSubmissionPayload,
  generateReliefReceiptId,
  detectPii,
  ALLOWED_CATEGORIES,
} from '../api/_lib/handlers/relief-operations.js';

const validPayload = {
  category: 'water',
  locality: 'Bellandur',
  jurisdictionId: 'ward-150',
  description: 'Drinking water for families sheltering in the community hall after the drain overflow.',
  quantity: 400,
  peopleAffected: 160,
  urgency: 'high',
};

const makeRes = () => {
  const result = { statusCode: null, body: null, headers: {} };
  return {
    result,
    status(code) {
      result.statusCode = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
    setHeader(name, value) {
      result.headers[name] = value;
    },
  };
};

const makeReq = (overrides = {}) => ({
  method: 'POST',
  headers: { 'x-real-ip': '203.0.113.10' },
  query: {},
  body: validPayload,
  ...overrides,
});

describe('api/relief-operations (#747)', () => {
  beforeEach(() => {
    RELIEF_PUBLIC_QUEUE.length = 0;
  });

  it('validates a compliant public need report', () => {
    const { errors, value } = validateReliefSubmissionPayload(validPayload);
    expect(errors).toEqual([]);
    expect(value.jurisdictionId).toBe('WARD-150');
    expect(value.category).toBe('water');
  });

  it('rejects invalid category, quantities and short descriptions', () => {
    const { errors } = validateReliefSubmissionPayload({
      ...validPayload,
      category: 'luxury_items',
      quantity: 0,
      peopleAffected: 999999,
      description: 'short',
    });
    expect(errors.some((error) => error.includes('Category must be one of'))).toBe(true);
    expect(errors.some((error) => error.includes('Quantity must be'))).toBe(true);
    expect(errors.some((error) => error.includes('People affected must be'))).toBe(true);
    expect(errors.some((error) => error.includes('Description must be at least'))).toBe(true);
  });

  it('rejects personal identifiers rather than storing them', () => {
    const { errors } = validateReliefSubmissionPayload({
      ...validPayload,
      description:
        'Contact me on 9876543210 or user@example.com. Aadhaar 4321 8765 2109 belongs to the shelter lead.',
    });
    expect(errors.some((error) => error.includes('Personal identifiers detected'))).toBe(true);
    expect(detectPii('9876543210')).toContain('phone');
    expect(detectPii('ABCDE1234F')).toContain('pan');
  });

  it('accepts a report, returns a safe receipt and records it once', async () => {
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res.result.statusCode).toBe(201);
    expect(res.result.body.success).toBe(true);
    const { record } = res.result.body;
    expect(record.trackingToken).toMatch(/^TRK-RLF-\d{6}$/);
    expect(record.receiptId).toMatch(/^RLF-RCPT-[0-9A-F]{8}$/);
    expect(record).not.toHaveProperty('internalId');
    expect(record).not.toHaveProperty('description');
    expect(record).not.toHaveProperty('idempotencyKey');
    expect(RELIEF_PUBLIC_QUEUE).toHaveLength(1);
    expect(RELIEF_PUBLIC_QUEUE[0].description).toBe(validPayload.description);
  });

  it('deduplicates a repeated report and excludes it from aggregates', async () => {
    const first = makeRes();
    await handler(makeReq({ headers: { 'x-real-ip': '203.0.113.11' } }), first);
    const second = makeRes();
    await handler(makeReq({ headers: { 'x-real-ip': '203.0.113.12' } }), second);

    expect(second.result.statusCode).toBe(201);
    expect(second.result.body.record.deduplicated).toBe(true);
    expect(second.result.body.record.status).toBe('duplicate');
    expect(second.result.body.record.receiptId).not.toBe(first.result.body.record.receiptId);

    const summary = makeRes();
    await handler(makeReq({ method: 'GET' }), summary);
    expect(summary.result.statusCode).toBe(200);
    expect(summary.result.body.openNeedCount).toBe(1);
    expect(summary.result.body.peopleAffected).toBe(validPayload.peopleAffected);
  });

  it('replays a request with the same idempotency key and rejects a conflicting payload', async () => {
    const keyed = { ...validPayload, idempotencyKey: 'relief-test-key-0001' };

    const first = makeRes();
    await handler(makeReq({ headers: { 'x-real-ip': '203.0.113.13' }, body: keyed }), first);
    expect(first.result.statusCode).toBe(201);

    const replay = makeRes();
    await handler(makeReq({ headers: { 'x-real-ip': '203.0.113.14' }, body: keyed }), replay);
    expect(replay.result.statusCode).toBe(200);
    expect(replay.result.body.idempotentReplay).toBe(true);
    expect(replay.result.body.record.trackingToken).toBe(first.result.body.record.trackingToken);

    const conflict = makeRes();
    await handler(
      makeReq({
        headers: { 'x-real-ip': '203.0.113.15' },
        body: { ...keyed, description: 'A different need entirely for another street in the same locality.' },
      }),
      conflict
    );
    expect(conflict.result.statusCode).toBe(409);
    expect(conflict.result.body.code).toBe('RELIEF_IDEMPOTENCY_CONFLICT');
  });

  it('returns a safe aggregate view with no personal or internal data', async () => {
    await handler(makeReq({ headers: { 'x-real-ip': '203.0.113.16' } }), makeRes());
    const res = makeRes();
    await handler(makeReq({ method: 'GET', query: { jurisdictionId: 'WARD-150' } }), res);

    expect(res.result.statusCode).toBe(200);
    const serialized = JSON.stringify(res.result.body);
    expect(serialized).not.toContain(validPayload.description);
    expect(serialized).not.toContain('TRK-RLF-');
    expect(serialized).not.toContain('RLF-RCPT-');
    expect(serialized).not.toContain('internalId');
    expect(res.result.body.byCategory[0].category).toBe('water');
    expect(res.result.body.scopeNote).toMatch(/never exposed/i);
  });

  it('rate-limits repeated public submissions from one address', async () => {
    let lastResponse;
    for (let index = 0; index < 11; index += 1) {
      lastResponse = makeRes();
      await handler(
        makeReq({
          headers: { 'x-real-ip': '203.0.113.250' },
          body: {
            ...validPayload,
            locality: `Rate Ward ${index}`,
            description: `Drinking water needed at shelter point number ${index} after the flood water receded.`,
          },
        }),
        lastResponse
      );
    }
    expect(lastResponse.result.statusCode).toBe(429);
    expect(lastResponse.result.body.code).toBe('RELIEF_RATE_LIMITED');
    expect(lastResponse.result.headers['Retry-After']).toBeGreaterThan(0);
  });

  it('rejects unsupported methods with guidance', async () => {
    const res = makeRes();
    await handler(makeReq({ method: 'DELETE' }), res);
    expect(res.result.statusCode).toBe(405);
    expect(res.result.body.code).toBe('RELIEF_METHOD_NOT_ALLOWED');
    expect(res.result.headers.Allow).toBe('GET, POST');
  });

  it('generates a deterministic receipt id and exposes the category allow-list', () => {
    const a = generateReliefReceiptId('water', 'Bellandur', '2026-11-19T08:00:00.000Z');
    const b = generateReliefReceiptId('water', 'Bellandur', '2026-11-19T08:00:00.000Z');
    expect(a).toBe(b);
    expect(a).toMatch(/^RLF-RCPT-[0-9A-F]{8}$/);
    expect(ALLOWED_CATEGORIES.has('medicine')).toBe(true);
    expect(ALLOWED_CATEGORIES.has('luxury_items')).toBe(false);
  });
});
