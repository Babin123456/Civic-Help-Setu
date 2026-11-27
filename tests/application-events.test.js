import { describe, it, expect, beforeEach } from 'vitest';
import {
  createApplicationEventsHandler,
  createMemoryApplicationEventRepository,
} from '../api/_lib/applicationEvents.js';

const TOKEN = 'valid-token-1234567890';
const auth = { authorization: `Bearer ${TOKEN}` };

let repository;

const makeHandler = (session = { userId: 'user-1', role: 'citizen' }) =>
  createApplicationEventsHandler({
    verifySession: async (token) => {
      if (token !== TOKEN) throw new Error('invalid');
      return session;
    },
    repository,
  });

const noteBody = (overrides = {}) => ({
  applicationId: 'SRV-90000001',
  category: 'query',
  sourceType: 'citizen_note',
  sourceRef: 'Citizen note',
  sourceTimestamp: '2026-10-14T10:00:00.000Z',
  status: null,
  actorRole: 'citizen',
  payloadVersion: 1,
  payload: { text: 'Private reminder about my application.' },
  ...overrides,
});

beforeEach(() => {
  repository = createMemoryApplicationEventRepository();
});

describe('api application events authorization (#839)', () => {
  it('rejects missing and invalid bearer tokens', async () => {
    const handler = makeHandler();
    const missing = await handler({ method: 'GET', query: { applicationId: 'SRV-1' } });
    expect(missing.status).toBe(401);
    expect(missing.body.error).toBe('missing_token');

    const invalid = await handler({
      method: 'GET',
      headers: { authorization: 'Bearer wrong-token-1234567890' },
      query: { applicationId: 'SRV-1' },
    });
    expect(invalid.status).toBe(401);
    expect(invalid.body.error).toBe('invalid_token');
  });

  it('prevents citizens from appending official events', async () => {
    const handler = makeHandler();
    const response = await handler({
      method: 'POST',
      headers: auth,
      body: noteBody({ sourceType: 'official_portal', sourceRef: 'Portal' }),
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('forbidden');
    expect(repository.list({ applicationId: 'SRV-90000001' }).items).toHaveLength(0);
  });

  it('allows an authorised reviewer to append an official event', async () => {
    const handler = makeHandler({ userId: 'admin-1', role: 'admin' });
    const response = await handler({
      method: 'POST',
      headers: auth,
      body: noteBody({
        sourceType: 'official_portal',
        sourceRef: 'State services portal',
        status: 'in-progress',
        actorRole: 'reviewer',
      }),
    });

    expect(response.status).toBe(201);
    expect(response.body.event.isOfficial).toBe(true);
    expect(response.body.event.actorRole).toBe('admin');
    expect(response.body.event.ownerUserId).toBeUndefined();
    expect(repository.listAudit()).toEqual([
      expect.objectContaining({
        action: 'OFFICIAL_APPLICATION_EVENT_APPENDED',
        actorUserId: 'admin-1',
        actorRole: 'admin',
        eventId: response.body.event.eventId,
      }),
    ]);
    expect(JSON.stringify(repository.listAudit())).not.toContain('Private reminder');
  });

  it('prevents one citizen from reading another citizen timeline', async () => {
    const ownerHandler = makeHandler({ userId: 'user-1', role: 'citizen' });
    await ownerHandler({ method: 'POST', headers: auth, body: noteBody() });

    const otherHandler = makeHandler({ userId: 'user-2', role: 'citizen' });
    const response = await otherHandler({
      method: 'GET',
      headers: auth,
      query: { applicationId: 'SRV-90000001' },
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('forbidden');
  });

  it('lets an authorised reviewer read another citizen timeline', async () => {
    const ownerHandler = makeHandler({ userId: 'user-1', role: 'citizen' });
    await ownerHandler({ method: 'POST', headers: auth, body: noteBody() });

    const adminHandler = makeHandler({ userId: 'admin-1', role: 'admin' });
    const response = await adminHandler({
      method: 'GET',
      headers: auth,
      query: { applicationId: 'SRV-90000001' },
    });

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].ownerUserId).toBeUndefined();
  });
});

describe('api application events validation and edge cases (#839)', () => {
  it('returns structured validation errors for malformed input', async () => {
    const handler = makeHandler();
    const response = await handler({
      method: 'POST',
      headers: auth,
      body: { applicationId: '', category: 'unknown', sourceType: 'unknown' },
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_failed');
    expect(response.body.details.length).toBeGreaterThan(2);
  });

  it('rejects identity numbers in event payloads', async () => {
    const handler = makeHandler();
    const response = await handler({
      method: 'POST',
      headers: auth,
      body: noteBody({ payload: { text: 'Aadhaar 5544 3322 1100 attached.' } }),
    });

    expect(response.status).toBe(400);
    expect(response.body.details.join(' ')).toMatch(/Aadhaar/);
  });

  it('rejects sensitive payload fields and oversized payloads', async () => {
    const handler = makeHandler();
    const attachment = await handler({
      method: 'POST',
      headers: auth,
      body: noteBody({ payload: { attachment: 'document.pdf' } }),
    });
    expect(attachment.status).toBe(400);
    expect(attachment.body.details.join(' ')).toMatch(/sensitive field/);

    const oversized = await handler({
      method: 'POST',
      headers: auth,
      body: noteBody({ payload: { text: 'x'.repeat(4001) } }),
    });
    expect(oversized.status).toBe(400);
    expect(oversized.body.details.join(' ')).toMatch(/4000 characters/);
  });

  it('rejects unsafe source links and strips no server fields', async () => {
    const handler = makeHandler({ userId: 'admin-1', role: 'admin' });
    const response = await handler({
      method: 'POST',
      headers: auth,
      body: noteBody({
        sourceType: 'official_portal',
        sourceRef: 'Portal',
        sourceUrl: 'javascript:alert(1)',
        isOfficial: false,
      }),
    });

    expect(response.status).toBe(400);
    expect(response.body.details.join(' ')).toMatch(/sourceUrl/);
  });

  it('returns an empty page for an application with no events', async () => {
    const handler = makeHandler();
    const response = await handler({
      method: 'GET',
      headers: auth,
      query: { applicationId: 'SRV-NONE' },
    });

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.nextCursor).toBeNull();
    expect(response.body.total).toBe(0);
  });

  it('does not write an admin audit entry for citizen notes', async () => {
    const handler = makeHandler();
    await handler({ method: 'POST', headers: auth, body: noteBody() });
    expect(repository.listAudit()).toEqual([]);
  });

  it('never overwrites a duplicate event', async () => {
    const handler = makeHandler();
    const first = await handler({ method: 'POST', headers: auth, body: noteBody() });
    const second = await handler({ method: 'POST', headers: auth, body: noteBody() });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('duplicate_event');
    expect(repository.list({ applicationId: 'SRV-90000001' }).total).toBe(1);
  });

  it('paginates and aggregates instead of returning the full list', async () => {
    const handler = makeHandler();
    for (let index = 0; index < 3; index += 1) {
      await handler({
        method: 'POST',
        headers: auth,
        body: noteBody({
          eventId: `evt-${index}`,
          sourceTimestamp: `2026-10-${String(index + 10).padStart(2, '0')}T10:00:00.000Z`,
          payload: { text: `Note ${index}` },
        }),
      });
    }

    const first = await handler({
      method: 'GET',
      headers: auth,
      query: { applicationId: 'SRV-90000001', limit: '2' },
    });
    const second = await handler({
      method: 'GET',
      headers: auth,
      query: { applicationId: 'SRV-90000001', limit: '2', cursor: first.body.nextCursor },
    });

    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(2);
    expect(first.body.total).toBe(3);
    expect(first.body.nextCursor).toBe('2');
    expect(second.body.items).toHaveLength(1);
    expect(second.body.dataVersion).toBeTruthy();
  });

  it('rejects unsupported methods and invalid query parameters', async () => {
    const handler = makeHandler();
    const method = await handler({ method: 'DELETE', headers: auth });
    expect(method.status).toBe(405);

    const badLimit = await handler({
      method: 'GET',
      headers: auth,
      query: { applicationId: 'SRV-1', limit: '500' },
    });
    expect(badLimit.status).toBe(400);

    const badCursor = await handler({
      method: 'GET',
      headers: auth,
      query: { applicationId: 'SRV-1', cursor: '-1' },
    });
    expect(badCursor.status).toBe(400);
  });
});
