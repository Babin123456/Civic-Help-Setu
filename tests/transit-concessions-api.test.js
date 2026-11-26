import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTransitConcessionsHandler,
  validateTransitCorrection,
} from '../api/_lib/handlers/transit-concessions.js';

const validPayload = {
  recordId: 'karnataka-bmtc-bus',
  mode: 'bus',
  proposedChange: 'The official concession policy was updated in this dated notice.',
  officialSourceUrl: 'https://mybmtc.karnataka.gov.in/notice',
  sourceDate: '2026-11-20',
  effectiveDate: '2026-12-01',
  website_trap: '',
};

function makeResponse() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
  };
}

describe('transit concession correction validation', () => {
  it('accepts a source-dated correction for the selected operator', () => {
    expect(validateTransitCorrection(validPayload, '2026-11-23')).toEqual([]);
  });

  it('rejects mismatched modes, unofficial URLs, missing dates, and personal identifiers', () => {
    expect(validateTransitCorrection({ ...validPayload, mode: 'metro' })).toContain('Select a listed operator and its transport type.');
    expect(validateTransitCorrection({ ...validPayload, officialSourceUrl: 'https://example.com/rule' })).toContain('Source URL must use HTTPS and belong to the selected operator’s official website.');
    expect(validateTransitCorrection({ ...validPayload, sourceDate: '' })).toContain('A valid official source publication date is required.');
    expect(validateTransitCorrection({ ...validPayload, sourceDate: '2026-12-01' }, '2026-11-23')).toContain('A valid official source publication date is required.');
    expect(validateTransitCorrection({ ...validPayload, proposedChange: 'Updated rule; contact 9876543210 for support.' })).toContain('Personal identifiers and phone numbers are not accepted.');
    expect(validateTransitCorrection({ ...validPayload, extra: 'unexpected' })).toContain('Unexpected submission fields are not accepted.');
  });
});

describe('transit concession correction endpoint', () => {
  let documents;
  let db;

  beforeEach(() => {
    documents = new Map();
    const collection = {
      doc(id = `submission-${documents.size + 1}`) {
        return {
          id,
          async create(data) {
            documents.set(id, { ...data });
          },
        };
      },
      where() { return this; },
      orderBy() { return this; },
      limit() { return this; },
      async get() {
        return { docs: [...documents].filter(([, item]) => item.status === 'pending_review').map(([id, data]) => ({ id, data: () => data })) };
      },
    };
    db = {
      collection: vi.fn(() => collection),
      async runTransaction(work) {
        const transaction = {
          async get(reference) {
            const data = documents.get(reference.id);
            return { exists: Boolean(data), data: () => data };
          },
          update(reference, patch) {
            documents.set(reference.id, { ...documents.get(reference.id), ...patch });
          },
        };
        return work(transaction);
      },
    };
  });

  it('stores corrections for moderation without publishing them', async () => {
    const handler = createTransitConcessionsHandler({
      getDatabase: async () => db,
      now: () => new Date('2026-11-23T00:00:00.000Z'),
      rateLimiter: { take: () => ({ allowed: true }) },
    });
    const response = makeResponse();
    await handler({ method: 'POST', headers: {}, body: validPayload }, response);
    expect(response.statusCode).toBe(201);
    expect([...documents.values()][0]).toMatchObject({
      status: 'pending_review',
      sourceDate: '2026-11-20',
      recordId: 'karnataka-bmtc-bus',
    });
  });

  it('requires verified administrator authorization for queue access and review', async () => {
    const denied = createTransitConcessionsHandler({
      getDatabase: async () => db,
      authorizeModerator: async () => ({ status: 403 }),
    });
    const queueResponse = makeResponse();
    await denied({ method: 'GET', query: { view: 'moderation' } }, queueResponse);
    expect(queueResponse.statusCode).toBe(403);

    const handler = createTransitConcessionsHandler({
      getDatabase: async () => db,
      authorizeModerator: async () => ({ userId: 'admin-1' }),
      now: () => new Date('2026-11-23T00:00:00.000Z'),
      rateLimiter: { take: () => ({ allowed: true }) },
    });
    const submitResponse = makeResponse();
    await handler({ method: 'POST', headers: {}, body: validPayload }, submitResponse);
    const queueResponseAuthorized = makeResponse();
    await handler({ method: 'GET', query: { view: 'moderation' } }, queueResponseAuthorized);
    expect(queueResponseAuthorized.data.items).toHaveLength(1);

    const [id] = documents.keys();
    const reviewResponse = makeResponse();
    await handler({ method: 'PATCH', body: { id, decision: 'approved' } }, reviewResponse);
    expect(reviewResponse.statusCode).toBe(200);
    expect(documents.get(id)).toMatchObject({ status: 'approved', reviewedBy: 'admin-1' });
  });
});
