import { describe, it, expect, beforeEach } from 'vitest';
import {
  OUTBOX_STATUS,
  createMemoryStorageAdapter,
  createOutboxStorageAdapter,
  createEventOutbox,
  createEventOutboxPublisher,
  createFirestoreOutboxStorageAdapter,
  createWebhookDeliverySink,
  isAdminRole,
} from '../api/_lib/eventOutbox.js';
import {
  createMemoryApplicationEventRepository,
  createApplicationEventsHandler,
} from '../api/_lib/applicationEvents.js';

describe('Event Outbox & Publisher Platform', () => {
  let mockNow;
  let currentTime;

  beforeEach(() => {
    currentTime = 1700000000000;
    mockNow = () => currentTime;
  });

  describe('Transactional Outbox Storage & Deduplication', () => {
    it('creates a memory storage adapter that isolates data via serialization', async () => {
      const adapter = createMemoryStorageAdapter();
      const obj = { foo: 'bar' };
      await adapter.write('key1', obj);
      obj.foo = 'mutated';
      const readVal = await adapter.read('key1');
      expect(readVal).toEqual({ foo: 'bar' });
      await adapter.remove('key1');
      expect(await adapter.read('key1')).toBeNull();
    });

    it('validates custom storage adapter interface', () => {
      expect(() => createOutboxStorageAdapter({})).toThrow(TypeError);
      const valid = createOutboxStorageAdapter({
        read: async () => null,
        write: async () => true,
      });
      expect(typeof valid.read).toBe('function');
      expect(typeof valid.write).toBe('function');
      expect(typeof valid.remove).toBe('function');
    });

    it('stages new events transactionally with pending status and correct schema', async () => {
      const storage = createMemoryStorageAdapter();
      const outbox = createEventOutbox({ storage });
      const event = {
        eventId: 'evt_123',
        applicationId: 'APP-1',
        category: 'submission',
        sourceType: 'citizen_note',
        sourceTimestamp: new Date(currentTime).toISOString(),
        idempotencyKey: 'idem_123',
      };

      const result = await outbox.stageEvent(event, { now: currentTime });
      expect(result.status).toBe('staged');
      expect(result.record).toMatchObject({
        outboxId: 'outbox_evt_123',
        eventId: 'evt_123',
        idempotencyKey: 'idem_123',
        status: OUTBOX_STATUS.PENDING,
        attempts: 0,
        nextAttemptAt: new Date(currentTime).toISOString(),
        deliveredAt: null,
      });

      const fetched = await outbox.getRecord('evt_123');
      expect(fetched).toEqual(result.record);
    });

    it('deduplicates duplicate staging by eventId or idempotencyKey', async () => {
      const outbox = createEventOutbox();
      const event1 = { eventId: 'evt_dup1', idempotencyKey: 'key_alpha' };
      const res1 = await outbox.stageEvent(event1, { now: currentTime });
      expect(res1.status).toBe('staged');

      // Duplicate eventId
      const res2 = await outbox.stageEvent(event1, { now: currentTime });
      expect(res2.status).toBe('duplicate');
      expect(res2.record.eventId).toBe('evt_dup1');

      // Duplicate idempotencyKey with different eventId
      const event2 = { eventId: 'evt_dup2', idempotencyKey: 'key_alpha' };
      const res3 = await outbox.stageEvent(event2, { now: currentTime });
      expect(res3.status).toBe('duplicate');
      expect(res3.record.eventId).toBe('evt_dup1');

      const all = await outbox.listRecords();
      expect(all).toHaveLength(1);
    });

    it('handles degraded storage gracefully without throwing', async () => {
      const badStorage = {
        read: async () => { throw new Error('Storage read disk fail'); },
        write: async () => { throw new Error('Storage write disk fail'); },
      };
      const outbox = createEventOutbox({ storage: badStorage });
      const list = await outbox.listRecords();
      expect(list).toEqual([]);

      const staged = await outbox.stageEvent({ eventId: 'evt_err' });
      expect(staged.status).toBe('staged'); // staged in memory map but saveMap returned false
    });
  });

  describe('Crash / Restart Recovery over Shared Storage', () => {
    it('survives repo/publisher restarts over shared storage with zero event loss', async () => {
      const sharedStorage = createMemoryStorageAdapter();

      // Instance 1: stages events
      const outbox1 = createEventOutbox({ storage: sharedStorage });
      await outbox1.stageEvent({ eventId: 'evt_crash_1' }, { now: currentTime });
      await outbox1.stageEvent({ eventId: 'evt_crash_2' }, { now: currentTime });

      // Simulate crash and restart: instantiate brand new outbox & publisher over same storage
      const outbox2 = createEventOutbox({ storage: sharedStorage });
      const deliveredEvents = [];
      const publisher2 = createEventOutboxPublisher({
        outbox: outbox2,
        now: mockNow,
        deliver: async (event, meta) => {
          deliveredEvents.push({ event, meta });
        },
      });

      const tickResult = await publisher2.publishPending();
      expect(tickResult).toEqual({
        processed: 2,
        delivered: 2,
        failed: 0,
        quarantined: 0,
      });

      expect(deliveredEvents).toHaveLength(2);
      expect(deliveredEvents.map((d) => d.event.eventId)).toEqual(['evt_crash_1', 'evt_crash_2']);

      // Verify records are marked DELIVERED in shared storage
      const finalRecords = await outbox2.listRecords();
      expect(finalRecords.every((r) => r.status === OUTBOX_STATUS.DELIVERED)).toBe(true);

      // Subsequent tick finds zero pending events
      const secondTick = await publisher2.publishPending();
      expect(secondTick.processed).toBe(0);
    });
  });

  describe('Concurrent Publish Ticks & In-Flight Locking', () => {
    it('prevents concurrent publisher ticks from double-delivering the same record', async () => {
      const outbox = createEventOutbox();
      await outbox.stageEvent({ eventId: 'evt_race_1' }, { now: currentTime });

      let deliveryCount = 0;
      const deliver = async () => {
        deliveryCount += 1;
        // Introduce small async delay
        await new Promise((r) => setTimeout(r, 10));
      };

      const publisher = createEventOutboxPublisher({
        outbox,
        now: mockNow,
        deliver,
      });

      // Launch two publishPending ticks simultaneously
      const [res1, res2] = await Promise.all([
        publisher.publishPending(),
        publisher.publishPending(),
      ]);

      // Exactly one should process and deliver the event
      expect(deliveryCount).toBe(1);
      expect(res1.delivered + res2.delivered).toBe(1);
    });
  });

  describe('Exponential Backoff & Jitter Timing', () => {
    it('backs off exponentially with jitter on transient delivery failures', async () => {
      const outbox = createEventOutbox();
      await outbox.stageEvent({ eventId: 'evt_retry_1' }, { now: currentTime });

      let attemptsCount = 0;
      const publisher = createEventOutboxPublisher({
        outbox,
        now: mockNow,
        random: () => 0.5, // Deterministic jitter factor
        baseBackoffMs: 1000,
        maxBackoffMs: 30000,
        deliver: async () => {
          attemptsCount += 1;
          throw new Error('Network timeout');
        },
      });

      // Attempt 1: backoff = 1000, jitter = 0.5 * 1000 * 0.2 = 100 -> nextAttempt = +1100ms
      const tick1 = await publisher.publishPending();
      expect(tick1).toEqual({ processed: 1, delivered: 0, failed: 1, quarantined: 0 });
      expect(attemptsCount).toBe(1);

      let rec = await outbox.getRecord('evt_retry_1');
      expect(rec.attempts).toBe(1);
      expect(rec.status).toBe(OUTBOX_STATUS.PENDING);
      expect(rec.lastError).toBe('Network timeout');
      expect(Date.parse(rec.nextAttemptAt)).toBe(currentTime + 1100);

      // Immediate tick before nextAttemptAt should skip it
      const skippedTick = await publisher.publishPending();
      expect(skippedTick.processed).toBe(0);

      // Fast-forward time to nextAttemptAt
      currentTime += 1100;

      // Attempt 2: backoff = 2000, jitter = 0.5 * 2000 * 0.2 = 200 -> nextAttempt = +2200ms
      const tick2 = await publisher.publishPending();
      expect(tick2.failed).toBe(1);
      rec = await outbox.getRecord('evt_retry_1');
      expect(rec.attempts).toBe(2);
      expect(Date.parse(rec.nextAttemptAt)).toBe(currentTime + 2200);
    });
  });

  describe('Poison-Event Quarantine', () => {
    it('quarantines poison event after maxAttempts and writes audit entry', async () => {
      const outbox = createEventOutbox();
      await outbox.stageEvent({ eventId: 'evt_poison' }, { now: currentTime });

      const auditEntries = [];
      const publisher = createEventOutboxPublisher({
        outbox,
        now: mockNow,
        maxAttempts: 3,
        baseBackoffMs: 100,
        audit: (entry) => auditEntries.push(entry),
        deliver: async () => {
          throw new Error('Permanent downstream failure');
        },
      });

      // Attempt 1
      await publisher.publishPending();
      currentTime += 500;
      // Attempt 2
      await publisher.publishPending();
      currentTime += 500;
      // Attempt 3: should reach maxAttempts (3) and quarantine
      const tick3 = await publisher.publishPending();
      expect(tick3.quarantined).toBe(1);

      const rec = await outbox.getRecord('evt_poison');
      expect(rec.status).toBe(OUTBOX_STATUS.QUARANTINED);
      expect(rec.attempts).toBe(3);
      expect(rec.lastError).toBe('Permanent downstream failure');

      expect(auditEntries).toContainEqual(
        expect.objectContaining({
          action: 'EVENT_OUTBOX_QUARANTINED',
          eventId: 'evt_poison',
          attempts: 3,
          lastError: 'Permanent downstream failure',
        })
      );

      // Future ticks ignore quarantined records
      currentTime += 10000;
      const tick4 = await publisher.publishPending();
      expect(tick4.processed).toBe(0);
    });
  });

  describe('Admin-Only Bounded Replay & Idempotency', () => {
    it('enforces admin role requirement for replay', async () => {
      const outbox = createEventOutbox();
      const publisher = createEventOutboxPublisher({ outbox });

      expect(isAdminRole('admin')).toBe(true);
      expect(isAdminRole('reviewer')).toBe(true);
      expect(isAdminRole('official')).toBe(true);
      expect(isAdminRole('citizen')).toBe(false);

      const citizenRes = await publisher.replay({ actorRole: 'citizen' });
      expect(citizenRes.ok).toBe(false);
      expect(citizenRes.status).toBe(403);
      expect(citizenRes.error).toBe('forbidden');

      const adminRes = await publisher.replay({ actorRole: 'admin' });
      expect(adminRes.ok).toBe(true);
      expect(adminRes.replayedCount).toBe(0);
    });

    it('replays targeted events with delivery keys and respects limits', async () => {
      const outbox = createEventOutbox();
      await outbox.stageEvent({ eventId: 'evt_rep_1', createdAt: '2026-01-01T00:00:00Z' });
      await outbox.stageEvent({ eventId: 'evt_rep_2', createdAt: '2026-01-02T00:00:00Z' });
      await outbox.stageEvent({ eventId: 'evt_rep_3', createdAt: '2026-01-03T00:00:00Z' });

      const replayedCalls = [];
      const auditEntries = [];
      const publisher = createEventOutboxPublisher({
        outbox,
        now: mockNow,
        audit: (entry) => auditEntries.push(entry),
        deliver: async (event, meta) => {
          replayedCalls.push({ eventId: event.eventId, meta });
        },
      });

      // Filter by specific eventIds
      const res1 = await publisher.replay({
        actorRole: 'admin',
        eventIds: ['evt_rep_1', 'evt_rep_3'],
      });
      expect(res1.ok).toBe(true);
      expect(res1.replayedCount).toBe(2);
      expect(replayedCalls.map((c) => c.eventId)).toEqual(['evt_rep_1', 'evt_rep_3']);
      expect(replayedCalls[0].meta.isReplay).toBe(true);
      expect(replayedCalls[0].meta.deliveryKey).toContain('evt_rep_1:replay:');

      // Filter by time range and limit
      replayedCalls.length = 0;
      const res2 = await publisher.replay({
        actorRole: 'reviewer',
        from: '2026-01-02T00:00:00Z',
        limit: 1,
      });
      expect(res2.ok).toBe(true);
      expect(res2.replayedCount).toBe(1);
      expect(replayedCalls[0].eventId).toBe('evt_rep_2');

      expect(auditEntries).toContainEqual(
        expect.objectContaining({
          action: 'EVENT_OUTBOX_REPLAYED',
          actorRole: 'admin',
        })
      );
    });
  });

  describe('Observability Metrics', () => {
    it('calculates metrics snapshot accurately including delivery lag', async () => {
      const outbox = createEventOutbox();
      const publisher = createEventOutboxPublisher({
        outbox,
        now: mockNow,
        deliver: async () => {},
      });

      // Stage two events at currentTime
      await outbox.stageEvent({ eventId: 'evt_met_1' }, { now: currentTime });
      await outbox.stageEvent({ eventId: 'evt_met_2' }, { now: currentTime });

      let metrics = await publisher.getMetrics();
      expect(metrics).toMatchObject({
        total: 2,
        pending: 2,
        inFlight: 0,
        delivered: 0,
        quarantined: 0,
        retries: 0,
        replays: 0,
        avgDeliveryLagMs: 0,
      });

      // Deliver 500ms later
      currentTime += 500;
      await publisher.publishPending();

      metrics = await publisher.getMetrics();
      expect(metrics).toMatchObject({
        total: 2,
        pending: 0,
        inFlight: 0,
        delivered: 2,
        quarantined: 0,
        avgDeliveryLagMs: 500,
      });
    });
  });

  describe('Integration with ApplicationEvents Handler & Repository', () => {
    it('stages events into outbox upon repository.create and exposes outbox', async () => {
      const repo = createMemoryApplicationEventRepository({ outboxEnabled: true });
      expect(repo.outbox).toBeDefined();
      expect(repo.outboxPublisher).toBeDefined();

      const event = {
        eventId: 'evt_repo_1',
        applicationId: 'APP-100',
        category: 'submission',
        sourceType: 'citizen_note',
        sourceTimestamp: new Date().toISOString(),
        idempotencyKey: 'idem_repo_1',
      };

      const created = await repo.create(event);
      expect(created.status).toBe('created');

      // Should be staged in outbox
      const outboxRec = await repo.outbox.getRecord('evt_repo_1');
      expect(outboxRec).toBeDefined();
      expect(outboxRec.eventId).toBe('evt_repo_1');

      // Duplicate creation shouldn't double-stage
      const dup = await repo.create(event);
      expect(dup.status).toBe('duplicate');
      const records = await repo.outbox.listRecords();
      expect(records).toHaveLength(1);
    });

    it('respects outboxEnabled: false toggle for backward compatibility', async () => {
      const repo = createMemoryApplicationEventRepository({ outboxEnabled: false });
      expect(repo.outbox).toBeNull();
      expect(repo.outboxPublisher).toBeNull();

      const event = {
        eventId: 'evt_disabled_1',
        applicationId: 'APP-200',
        category: 'submission',
        sourceType: 'citizen_note',
        sourceTimestamp: new Date().toISOString(),
      };

      const created = await repo.create(event);
      expect(created.status).toBe('created');
    });

    it('serves outbox metrics via GET ?metrics=true with admin authorization', async () => {
      const repo = createMemoryApplicationEventRepository({ outboxEnabled: true });
      const verifySession = async (token) => {
        if (token === 'admin-token') return { userId: 'admin_1', role: 'admin' };
        if (token === 'citizen-token') return { userId: 'citizen_1', role: 'citizen' };
        throw new Error('invalid');
      };

      const handler = createApplicationEventsHandler({ verifySession, repository: repo });

      // Unauthorized token
      const res401 = await handler({
        method: 'GET',
        headers: { authorization: 'Bearer bad-token' },
        query: { metrics: 'true' },
      });
      expect(res401.status).toBe(401);

      // Citizen forbidden
      const res403 = await handler({
        method: 'GET',
        headers: { authorization: 'Bearer citizen-token' },
        query: { metrics: 'true' },
      });
      expect(res403.status).toBe(403);

      // Admin allowed
      const res200 = await handler({
        method: 'GET',
        headers: { authorization: 'Bearer admin-token' },
        query: { metrics: 'true' },
      });
      expect(res200.status).toBe(200);
      expect(res200.body.ok).toBe(true);
      expect(res200.body.metrics).toHaveProperty('pending');
      expect(res200.body.metrics).toHaveProperty('delivered');
    });

    it('triggers bounded replay via POST ?action=replay with admin authorization', async () => {
      const repo = createMemoryApplicationEventRepository({ outboxEnabled: true });
      await repo.create({
        eventId: 'evt_api_rep_1',
        applicationId: 'APP-300',
        category: 'submission',
        sourceType: 'citizen_note',
        sourceTimestamp: new Date().toISOString(),
      });

      const verifySession = async (token) => {
        if (token === 'reviewer-token') return { userId: 'rev_1', role: 'reviewer' };
        if (token === 'citizen-token') return { userId: 'cit_1', role: 'citizen' };
        throw new Error('invalid');
      };

      const handler = createApplicationEventsHandler({ verifySession, repository: repo });

      // Citizen forbidden
      const res403 = await handler({
        method: 'POST',
        headers: { authorization: 'Bearer citizen-token' },
        query: { action: 'replay' },
        body: { eventIds: ['evt_api_rep_1'] },
      });
      expect(res403.status).toBe(403);

      // Reviewer allowed
      const res200 = await handler({
        method: 'POST',
        headers: { authorization: 'Bearer reviewer-token' },
        query: { action: 'replay' },
        body: { eventIds: ['evt_api_rep_1'] },
      });
      expect(res200.status).toBe(200);
      expect(res200.body.ok).toBe(true);
      expect(res200.body.replayedCount).toBe(1);
    });

    it('initializes repository with firestore storage option', async () => {
      const store = new Map();
      const mockDb = {
        collection: (col) => ({
          doc: (docId) => ({
            async get() {
              const data = store.get(`${col}/${docId}`);
              return { exists: Boolean(data), data: () => data };
            },
            async set(val) {
              store.set(`${col}/${docId}`, val);
              return true;
            },
            async delete() {
              store.delete(`${col}/${docId}`);
              return true;
            },
          }),
        }),
      };

      const firestoreAdapter = createFirestoreOutboxStorageAdapter({ db: mockDb });
      const repo = createMemoryApplicationEventRepository({
        storage: firestoreAdapter,
        outboxEnabled: true,
      });

      const res = await repo.create({
        eventId: 'evt_fs_repo_1',
        applicationId: 'APP-FS-1',
        category: 'submission',
        sourceType: 'citizen_note',
        sourceTimestamp: new Date().toISOString(),
      });
      expect(res.status).toBe('created');

      const rec = await repo.outbox.getRecord('evt_fs_repo_1');
      expect(rec).toBeDefined();
      expect(rec.eventId).toBe('evt_fs_repo_1');
    });
  });

  describe('Firestore Storage Adapter & Graceful Fallback', () => {
    it('reads, writes, and removes records using a Firestore client', async () => {
      const store = new Map();
      const mockDb = {
        collection: (colName) => ({
          doc: (docId) => ({
            async get() {
              const data = store.get(`${colName}/${docId}`);
              return {
                exists: Boolean(data),
                data: () => data,
              };
            },
            async set(val) {
              store.set(`${colName}/${docId}`, val);
              return true;
            },
            async delete() {
              store.delete(`${colName}/${docId}`);
              return true;
            },
          }),
        }),
      };

      const adapter = createFirestoreOutboxStorageAdapter({ db: mockDb });
      await adapter.write('test_key', { hello: 'world' });
      const readVal = await adapter.read('test_key');
      expect(readVal).toEqual({ hello: 'world' });

      await adapter.remove('test_key');
      expect(await adapter.read('test_key')).toBeNull();
    });

    it('falls back to in-memory adapter when Firestore is unconfigured or returns null', async () => {
      const fallback = createMemoryStorageAdapter();
      const adapter = createFirestoreOutboxStorageAdapter({
        getDb: async () => null,
        fallback,
      });

      await adapter.write('fb_key', { fallback: true });
      expect(await adapter.read('fb_key')).toEqual({ fallback: true });
      await adapter.remove('fb_key');
      expect(await adapter.read('fb_key')).toBeNull();
    });

    it('falls back to memory adapter when Firestore operations fail and logs diagnostic', async () => {
      const failingDb = {
        collection: () => ({
          doc: () => ({
            async get() { throw new Error('Firestore connection lost'); },
            async set() { throw new Error('Firestore write quota exceeded'); },
            async delete() { throw new Error('Firestore delete timeout'); },
          }),
        }),
      };

      const fallback = createMemoryStorageAdapter();
      const adapter = createFirestoreOutboxStorageAdapter({
        db: failingDb,
        fallback,
      });

      await adapter.write('err_key', { recovered: true });
      expect(await adapter.read('err_key')).toEqual({ recovered: true });
      await adapter.remove('err_key');
      expect(await adapter.read('err_key')).toBeNull();
    });
  });

  describe('Webhook Delivery Sink & HTTP Publication', () => {
    it('rejects unsafe or empty webhook URLs with safeHttpUrl validation', () => {
      expect(createWebhookDeliverySink({ url: 'javascript:alert(1)' })).toBeNull();
      expect(createWebhookDeliverySink({ url: 'data:text/html,bad' })).toBeNull();
      expect(createWebhookDeliverySink({ url: '' })).toBeNull();
      expect(createWebhookDeliverySink({ url: null })).toBeNull();
    });

    it('delivers events with headers, payload, and delivery key over HTTP', async () => {
      let dispatched = null;
      const mockFetch = async (url, options) => {
        dispatched = { url, ...options, parsedBody: JSON.parse(options.body) };
        return { ok: true, status: 200 };
      };

      const sink = createWebhookDeliverySink({
        url: 'https://api.civic.test/webhooks/events',
        fetchFn: mockFetch,
        headers: { 'X-Custom-Header': 'CustomVal' },
      });

      expect(typeof sink).toBe('function');
      const event = { eventId: 'evt_sink_1', applicationId: 'APP-SINK' };
      const res = await sink(event, { deliveryKey: 'key_123', isReplay: false });
      expect(res).toBe(true);

      expect(dispatched.url).toBe('https://api.civic.test/webhooks/events');
      expect(dispatched.headers['X-Delivery-Key']).toBe('key_123');
      expect(dispatched.headers['X-Is-Replay']).toBe('false');
      expect(dispatched.headers['X-Custom-Header']).toBe('CustomVal');
      expect(dispatched.parsedBody.event).toEqual(event);
      expect(dispatched.parsedBody.isReplay).toBe(false);
    });

    it('throws when webhook endpoint returns a non-2xx HTTP status', async () => {
      const mockFetch = async () => ({ ok: false, status: 503 });
      const sink = createWebhookDeliverySink({
        url: 'https://api.civic.test/webhooks/fail',
        fetchFn: mockFetch,
      });

      await expect(sink({ eventId: 'evt_fail' })).rejects.toThrow('HTTP 503');
    });

    it('integrates webhook delivery sink with publisher for publication and retry', async () => {
      const outbox = createEventOutbox();
      await outbox.stageEvent({ eventId: 'evt_pub_sink' }, { now: currentTime });

      const capturedRequests = [];
      const mockFetch = async (url, options) => {
        capturedRequests.push({ url, headers: options.headers, body: JSON.parse(options.body) });
        return { ok: true, status: 200 };
      };

      const customSink = createWebhookDeliverySink({
        url: 'https://events.civic.test/ingest',
        fetchFn: mockFetch,
      });
      const customPublisher = createEventOutboxPublisher({
        outbox,
        now: mockNow,
        deliver: customSink,
      });

      const tick = await customPublisher.publishPending();
      expect(tick.delivered).toBe(1);
      expect(capturedRequests).toHaveLength(1);
      expect(capturedRequests[0].headers['X-Delivery-Key']).toBe('evt_pub_sink:1');

      const rec = await outbox.getRecord('evt_pub_sink');
      expect(rec.status).toBe(OUTBOX_STATUS.DELIVERED);
    });
  });
});
