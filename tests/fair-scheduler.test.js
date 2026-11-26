import { describe, it, expect, beforeEach } from 'vitest';
import {
  PRIORITY_CLASSES,
  BOOKING_STATUS,
  POLICY_VERSION,
  createMemoryStorageAdapter,
  createSchedulerStorageAdapter,
  createFirestoreSchedulerStorageAdapter,
  createFairScheduler,
  createFairSchedulerHandler,
  isAdminRole,
} from '../api/_lib/fairScheduler.js';

describe('Fair Scheduling Engine (#1268)', () => {
  let currentTime;
  let mockNow;
  let designatedEmergencies;

  beforeEach(() => {
    currentTime = 1700000000000;
    mockNow = () => currentTime;
    designatedEmergencies = new Set(['srv_emergency_ambulance', 'srv_disaster_shelter']);
  });

  describe('Storage Adapter & Configuration', () => {
    it('creates an in-memory storage adapter with clone isolation', async () => {
      const adapter = createMemoryStorageAdapter();
      const val = { slot: 1 };
      await adapter.write('key', val);
      val.slot = 999;
      expect(await adapter.read('key')).toEqual({ slot: 1 });
      await adapter.remove('key');
      expect(await adapter.read('key')).toBeNull();
    });

    it('validates custom storage adapter functions', () => {
      expect(() => createSchedulerStorageAdapter({})).toThrow(TypeError);
      const adapter = createSchedulerStorageAdapter({
        read: async () => null,
        write: async () => true,
      });
      expect(typeof adapter.read).toBe('function');
      expect(typeof adapter.write).toBe('function');
      expect(typeof adapter.remove).toBe('function');
    });

    it('verifies admin role predicates', () => {
      expect(isAdminRole('admin')).toBe(true);
      expect(isAdminRole('reviewer')).toBe(true);
      expect(isAdminRole('official')).toBe(true);
      expect(isAdminRole('citizen')).toBe(false);
      expect(isAdminRole('guest')).toBe(false);
    });
  });

  describe('Slot Allocation, Concurrency & Idempotency', () => {
    it('allocates slot when capacity is available and assigns policyVersion', async () => {
      const scheduler = createFairScheduler({ now: mockNow });
      const res = await scheduler.reserveSlot({
        citizenId: 'cit_1',
        serviceId: 'srv_passport',
        windowId: 'win_10am',
        slotCapacity: 1,
      });

      expect(res.ok).toBe(true);
      expect(res.status).toBe(201);
      expect(res.isWaitlisted).toBe(false);
      expect(res.booking).toMatchObject({
        citizenId: 'cit_1',
        serviceId: 'srv_passport',
        windowId: 'win_10am',
        status: BOOKING_STATUS.RESERVED,
        priorityClass: PRIORITY_CLASSES.P3,
        policyVersion: POLICY_VERSION,
        reasonCodes: ['P3_STANDARD_ALLOCATION'],
      });
    });

    it('prevents double allocation when concurrent reservation requests arrive for limited slots', async () => {
      const scheduler = createFairScheduler({ now: mockNow });

      // Run 3 simultaneous requests for a single slot (slotCapacity: 1)
      const results = await Promise.all([
        scheduler.reserveSlot({ citizenId: 'cit_a', serviceId: 'srv_rto', windowId: 'win_11am', slotCapacity: 1 }),
        scheduler.reserveSlot({ citizenId: 'cit_b', serviceId: 'srv_rto', windowId: 'win_11am', slotCapacity: 1 }),
        scheduler.reserveSlot({ citizenId: 'cit_c', serviceId: 'srv_rto', windowId: 'win_11am', slotCapacity: 1 }),
      ]);

      const reserved = results.filter((r) => r.booking.status === BOOKING_STATUS.RESERVED);
      const waitlisted = results.filter((r) => r.booking.status === BOOKING_STATUS.WAITLISTED);

      expect(reserved).toHaveLength(1);
      expect(waitlisted).toHaveLength(2);
    });

    it('returns existing booking idempotently on duplicate reservation attempts', async () => {
      const scheduler = createFairScheduler({ now: mockNow });
      const first = await scheduler.reserveSlot({
        citizenId: 'cit_repeat',
        serviceId: 'srv_aadhaar',
        windowId: 'win_2pm',
      });
      expect(first.isExisting).toBeUndefined();

      const second = await scheduler.reserveSlot({
        citizenId: 'cit_repeat',
        serviceId: 'srv_aadhaar',
        windowId: 'win_2pm',
      });
      expect(second.ok).toBe(true);
      expect(second.isExisting).toBe(true);
      expect(second.booking.bookingId).toBe(first.booking.bookingId);
    });
  });

  describe('Priority Policy (P0–P3) & Guardrails', () => {
    it('rejects P0 emergency request if service is not officially designated as emergency', async () => {
      const scheduler = createFairScheduler({
        designatedEmergencyServices: designatedEmergencies,
        now: mockNow,
      });

      const res = await scheduler.reserveSlot({
        citizenId: 'cit_fraud',
        serviceId: 'srv_regular_license',
        windowId: 'win_9am',
        requestedPriority: PRIORITY_CLASSES.P0,
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(400);
      expect(res.error).toBe('unauthorized_emergency_priority');
      expect(res.reasonCodes).toContain('REJECT_UNAUTHORIZED_EMERGENCY');
    });

    it('accepts P0 emergency priority on designated emergency services', async () => {
      const scheduler = createFairScheduler({
        designatedEmergencyServices: designatedEmergencies,
        now: mockNow,
      });

      const res = await scheduler.reserveSlot({
        citizenId: 'cit_urgent',
        serviceId: 'srv_emergency_ambulance',
        windowId: 'win_now',
        requestedPriority: PRIORITY_CLASSES.P0,
      });

      expect(res.ok).toBe(true);
      expect(res.booking.priorityClass).toBe(PRIORITY_CLASSES.P0);
      expect(res.booking.reasonCodes).toContain('P0_EMERGENCY_DESIGNATED');
    });

    it('assigns P1 for statutory deadlines and time-critical needs', async () => {
      const scheduler = createFairScheduler({ now: mockNow });
      const res = await scheduler.reserveSlot({
        citizenId: 'cit_deadline',
        serviceId: 'srv_tax_appeal',
        windowId: 'win_noon',
        hasStatutoryDeadline: true,
      });

      expect(res.ok).toBe(true);
      expect(res.booking.priorityClass).toBe(PRIORITY_CLASSES.P1);
      expect(res.booking.reasonCodes).toContain('P1_STATUTORY_DEADLINE');
    });

    it('models P2 as accessibility accommodation without medical diagnosis disclosure', async () => {
      const scheduler = createFairScheduler({ now: mockNow });
      const res = await scheduler.reserveSlot({
        citizenId: 'cit_access',
        serviceId: 'srv_pension',
        windowId: 'win_morning',
        accommodationRequirement: 'step_free_access_wheelchair',
      });

      expect(res.ok).toBe(true);
      expect(res.booking.priorityClass).toBe(PRIORITY_CLASSES.P2);
      expect(res.booking.reasonCodes).toContain('P2_ACCOMMODATION_MATCHED');
      expect(res.booking.hasAccommodation).toBe(true);
      expect(res.booking.accommodationRequirement).toBe('step_free_access_wheelchair');

      // Public queue projection strictly hides accommodation and citizen identity
      const projection = await scheduler.getPublicQueueProjection({
        serviceId: 'srv_pension',
        windowId: 'win_morning',
      });
      expect(projection).toHaveLength(1);
      expect(projection[0]).toHaveProperty('tokenId');
      expect(projection[0]).not.toHaveProperty('accommodationRequirement');
      expect(projection[0]).not.toHaveProperty('hasAccommodation');
      expect(projection[0]).not.toHaveProperty('citizenId');
    });
  });

  describe('Deterministic Tie-Breaking & Aging Anti-Starvation', () => {
    it('applies deterministic tie-breaking based on requestedAt and citizenId', async () => {
      const scheduler = createFairScheduler({ now: mockNow });

      // Fill slot
      await scheduler.reserveSlot({
        citizenId: 'cit_holder',
        serviceId: 'srv_counter',
        windowId: 'win_1',
        slotCapacity: 1,
      });

      // Enqueue two waitlist requests at different times
      currentTime = 1700000010000;
      await scheduler.reserveSlot({
        citizenId: 'cit_second',
        serviceId: 'srv_counter',
        windowId: 'win_1',
        slotCapacity: 1,
      });

      currentTime = 1700000005000;
      await scheduler.reserveSlot({
        citizenId: 'cit_first',
        serviceId: 'srv_counter',
        windowId: 'win_1',
        slotCapacity: 1,
      });

      // Cancel holder to trigger promotion
      const cancelRes = await scheduler.cancelReservation({
        bookingId: (await scheduler.reserveSlot({ citizenId: 'cit_holder', serviceId: 'srv_counter', windowId: 'win_1' })).booking.bookingId,
      });

      // cit_first requested earlier, so it must be promoted ahead of cit_second
      expect(cancelRes.promotedBooking.citizenId).toBe('cit_first');
    });

    it('promotes aged waitlist requests to prevent starvation', async () => {
      const agingWindowMs = 60 * 60 * 1000; // 1 hour per aging step
      const scheduler = createFairScheduler({
        now: mockNow,
        agingWindowMs,
      });

      // Fill slot
      const initial = await scheduler.reserveSlot({
        citizenId: 'cit_active',
        serviceId: 'srv_ration',
        windowId: 'win_batch',
        slotCapacity: 1,
      });

      // Enqueue P3 request at T0
      await scheduler.reserveSlot({
        citizenId: 'cit_patient_p3',
        serviceId: 'srv_ration',
        windowId: 'win_batch',
        slotCapacity: 1,
      });

      // Advance time by 2 hours (aging boosts P3 by 2 steps: P3 -> P1)
      currentTime += 2 * agingWindowMs + 1000;

      // New P2 request arrives now
      await scheduler.reserveSlot({
        citizenId: 'cit_new_p2',
        serviceId: 'srv_ration',
        windowId: 'win_batch',
        accommodationRequirement: 'large_print_display',
        slotCapacity: 1,
      });

      // Cancel the active holder
      const cancelRes = await scheduler.cancelReservation({ bookingId: initial.booking.bookingId });

      // Even though cit_new_p2 has base priority P2, cit_patient_p3 aged 2 hours and was boosted to P1
      expect(cancelRes.promotedBooking.citizenId).toBe('cit_patient_p3');
      expect(cancelRes.promotedBooking.reasonCodes).toContain('AGING_BOOST_APPLIED');
      expect(cancelRes.promotedBooking.reasonCodes).toContain('WAITLIST_PROMOTED');
    });
  });

  describe('Cancellations, Check-Ins & No-Shows', () => {
    it('allows citizens to check in for their reserved slot', async () => {
      const scheduler = createFairScheduler({ now: mockNow });
      const res = await scheduler.reserveSlot({ citizenId: 'cit_check', serviceId: 'srv_land', windowId: 'win_10' });

      const checkInRes = await scheduler.checkIn({ bookingId: res.booking.bookingId });
      expect(checkInRes.ok).toBe(true);
      expect(checkInRes.booking.status).toBe(BOOKING_STATUS.CHECKED_IN);
    });

    it('rejects no-show before grace period expires', async () => {
      const gracePeriodMs = 15 * 60 * 1000;
      const scheduler = createFairScheduler({ now: mockNow, gracePeriodMs });
      const res = await scheduler.reserveSlot({ citizenId: 'cit_early', serviceId: 'srv_water', windowId: 'win_1' });

      // Try marking no-show 5 minutes after slot start (within 15 min grace period)
      const noShowRes = await scheduler.recordNoShow({
        bookingId: res.booking.bookingId,
        slotStartTimeMs: currentTime - (5 * 60 * 1000),
      });

      expect(noShowRes.ok).toBe(false);
      expect(noShowRes.error).toBe('grace_period_active');
    });

    it('releases slot and promotes waitlist when grace period has expired', async () => {
      const gracePeriodMs = 15 * 60 * 1000;
      const scheduler = createFairScheduler({ now: mockNow, gracePeriodMs });
      const res1 = await scheduler.reserveSlot({ citizenId: 'cit_noshow', serviceId: 'srv_water', windowId: 'win_1', slotCapacity: 1 });
      const res2 = await scheduler.reserveSlot({ citizenId: 'cit_waiting', serviceId: 'srv_water', windowId: 'win_1', slotCapacity: 1 });
      expect(res2.isWaitlisted).toBe(true);

      // Mark no-show 20 minutes after slot start (grace period expired)
      const noShowRes = await scheduler.recordNoShow({
        bookingId: res1.booking.bookingId,
        slotStartTimeMs: currentTime - (20 * 60 * 1000),
      });

      expect(noShowRes.ok).toBe(true);
      expect(noShowRes.booking.status).toBe(BOOKING_STATUS.NO_SHOW);
      expect(noShowRes.promotedBooking.citizenId).toBe('cit_waiting');
      expect(noShowRes.promotedBooking.status).toBe(BOOKING_STATUS.RESERVED);
    });
  });

  describe('Admin Manual Overrides & Audit Trail', () => {
    it('restricts manual override to administrative roles and requires a reason', async () => {
      const scheduler = createFairScheduler({ now: mockNow });
      const res = await scheduler.reserveSlot({ citizenId: 'cit_admin_test', serviceId: 'srv_cert', windowId: 'win_1' });

      // Citizen forbidden
      const forbidden = await scheduler.applyAdminOverride({
        bookingId: res.booking.bookingId,
        newStatus: BOOKING_STATUS.CHECKED_IN,
        reason: 'Counter verified physical presence',
        actorRole: 'citizen',
      });
      expect(forbidden.ok).toBe(false);
      expect(forbidden.status).toBe(403);

      // Empty reason rejected
      const noReason = await scheduler.applyAdminOverride({
        bookingId: res.booking.bookingId,
        newStatus: BOOKING_STATUS.CHECKED_IN,
        reason: '   ',
        actorRole: 'admin',
      });
      expect(noReason.ok).toBe(false);
      expect(noReason.status).toBe(400);

      // Admin with valid reason succeeds and logs audit entry
      const auditEntries = [];
      const auditedScheduler = createFairScheduler({
        now: mockNow,
        audit: (e) => auditEntries.push(e),
      });
      const auditedBooking = await auditedScheduler.reserveSlot({ citizenId: 'cit_audit', serviceId: 'srv_cert', windowId: 'win_1' });

      const overrideRes = await auditedScheduler.applyAdminOverride({
        bookingId: auditedBooking.booking.bookingId,
        newStatus: BOOKING_STATUS.CHECKED_IN,
        newPriority: PRIORITY_CLASSES.P1,
        reason: 'Authorized expedited statutory review',
        actorRole: 'reviewer',
      });

      expect(overrideRes.ok).toBe(true);
      expect(overrideRes.booking.status).toBe(BOOKING_STATUS.CHECKED_IN);
      expect(overrideRes.booking.priorityClass).toBe(PRIORITY_CLASSES.P1);
      expect(overrideRes.booking.reasonCodes).toContain('ADMIN_OVERRIDE');

      expect(auditEntries).toContainEqual(
        expect.objectContaining({
          action: 'SCHEDULER_OVERRIDE_APPLIED',
          actorRole: 'reviewer',
          reason: 'Authorized expedited statutory review',
        })
      );
    });
  });

  describe('Observability Metrics & Resilience', () => {
    it('computes metrics and waitlist duration accurately', async () => {
      const scheduler = createFairScheduler({ now: mockNow });
      await scheduler.reserveSlot({ citizenId: 'c1', serviceId: 's1', windowId: 'w1', slotCapacity: 1 });
      await scheduler.reserveSlot({ citizenId: 'c2', serviceId: 's1', windowId: 'w1', slotCapacity: 1 });

      currentTime += 30000;
      const metrics = await scheduler.getMetrics();
      expect(metrics.total).toBe(2);
      expect(metrics.reserved).toBe(1);
      expect(metrics.waitlisted).toBe(1);
      expect(metrics.avgWaitlistDurationMs).toBe(30000);
      expect(metrics.byPriority.P3).toBe(2);
    });

    it('recovers safely from degraded storage read/write errors', async () => {
      const badStorage = {
        read: async () => { throw new Error('Disk read failure'); },
        write: async () => { throw new Error('Disk write failure'); },
      };
      const scheduler = createFairScheduler({ storage: badStorage });

      // Should not throw unhandled exceptions
      const metrics = await scheduler.getMetrics();
      expect(metrics.total).toBe(0);

      const res = await scheduler.reserveSlot({ citizenId: 'c_deg', serviceId: 's_deg', windowId: 'w_deg' });
      expect(res.ok).toBe(true);
    });
  });

  describe('Firestore Storage Adapter & Graceful Fallback', () => {
    it('reads, writes, and removes records using a synthetic Firestore client', async () => {
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

      const adapter = createFirestoreSchedulerStorageAdapter({ db: mockDb });
      await adapter.write('test_sched_key', { quota: 50 });
      const readVal = await adapter.read('test_sched_key');
      expect(readVal).toEqual({ quota: 50 });

      await adapter.remove('test_sched_key');
      expect(await adapter.read('test_sched_key')).toBeNull();
    });

    it('falls back to memory adapter when Firestore is unconfigured or returns null', async () => {
      const fallback = createMemoryStorageAdapter();
      const adapter = createFirestoreSchedulerStorageAdapter({
        getDb: async () => null,
        fallback,
      });

      await adapter.write('unconf_key', { saved: true });
      expect(await adapter.read('unconf_key')).toEqual({ saved: true });
      await adapter.remove('unconf_key');
      expect(await adapter.read('unconf_key')).toBeNull();
    });

    it('falls back safely to memory adapter when Firestore operations throw', async () => {
      const failingDb = {
        collection: () => ({
          doc: () => ({
            async get() { throw new Error('Firestore connection timeout'); },
            async set() { throw new Error('Firestore write quota exceeded'); },
            async delete() { throw new Error('Firestore delete error'); },
          }),
        }),
      };

      const fallback = createMemoryStorageAdapter();
      const adapter = createFirestoreSchedulerStorageAdapter({
        db: failingDb,
        fallback,
      });

      await adapter.write('fail_key', { resilient: true });
      expect(await adapter.read('fail_key')).toEqual({ resilient: true });
      await adapter.remove('fail_key');
      expect(await adapter.read('fail_key')).toBeNull();
    });
  });

  describe('End-to-End Restart Persistence over Shared Storage', () => {
    it('persists reservations and waitlists across scheduler restarts', async () => {
      const sharedStorage = createMemoryStorageAdapter();

      // Instance 1: reserves a slot and waitlists another
      const scheduler1 = createFairScheduler({ storage: sharedStorage, now: mockNow });
      const res1 = await scheduler1.reserveSlot({
        citizenId: 'cit_holder',
        serviceId: 'srv_passport',
        windowId: 'win_10am',
        slotCapacity: 1,
      });
      await scheduler1.reserveSlot({
        citizenId: 'cit_waitlist',
        serviceId: 'srv_passport',
        windowId: 'win_10am',
        slotCapacity: 1,
      });

      // Restart: create brand new scheduler instance over the same storage
      const scheduler2 = createFairScheduler({ storage: sharedStorage, now: mockNow });
      const metrics = await scheduler2.getMetrics();
      expect(metrics.reserved).toBe(1);
      expect(metrics.waitlisted).toBe(1);

      // Cancel holder on instance 2 -> promotes waitlisted booking
      const cancelRes = await scheduler2.cancelReservation({
        bookingId: res1.booking.bookingId,
      });
      expect(cancelRes.ok).toBe(true);
      expect(cancelRes.promotedBooking.citizenId).toBe('cit_waitlist');
      expect(cancelRes.promotedBooking.status).toBe(BOOKING_STATUS.RESERVED);
    });
  });

  describe('Fair Scheduler HTTP Handler & Access Control', () => {
    const makeHandler = (overrides = {}) => {
      const scheduler = createFairScheduler({ now: mockNow });
      const verifySession = async (token) => {
        if (token === 'admin-token') return { userId: 'admin_usr', role: 'admin' };
        if (token === 'reviewer-token') return { userId: 'rev_usr', role: 'reviewer' };
        if (token === 'citizen-token') return { userId: 'cit_usr', role: 'citizen' };
        throw new Error('invalid');
      };
      return createFairSchedulerHandler({
        scheduler,
        verifySession,
        ...overrides,
      });
    };

    it('rejects unsupported HTTP methods with 405 Method Not Allowed', async () => {
      const handler = makeHandler();
      const res = await handler({ method: 'PUT' });
      expect(res.status).toBe(405);
      expect(res.body.error).toBe('method_not_allowed');
    });

    it('serves public queue projection without authentication and sanitizes PII/accommodations', async () => {
      const scheduler = createFairScheduler({ now: mockNow });
      await scheduler.reserveSlot({
        citizenId: 'secret_citizen_123',
        serviceId: 'srv_license',
        windowId: 'win_morning',
        accommodationRequirement: 'sensory_quiet_counter',
      });

      const handler = createFairSchedulerHandler({ scheduler });
      const res = await handler({
        method: 'GET',
        query: { action: 'projection', serviceId: 'srv_license', windowId: 'win_morning' },
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.projection).toHaveLength(1);
      const item = res.body.projection[0];
      expect(item).toHaveProperty('tokenId');
      expect(item).toHaveProperty('windowId', 'win_morning');
      expect(item).toHaveProperty('status', BOOKING_STATUS.RESERVED);
      // Strict privacy checks
      expect(item).not.toHaveProperty('citizenId');
      expect(item).not.toHaveProperty('accommodationRequirement');
      expect(item).not.toHaveProperty('hasAccommodation');
    });

    it('gates metrics endpoint to administrative roles', async () => {
      const handler = makeHandler();

      // Missing token
      const noAuth = await handler({ method: 'GET', query: { action: 'metrics' } });
      expect(noAuth.status).toBe(401);

      // Citizen forbidden
      const citizenRes = await handler({
        method: 'GET',
        headers: { authorization: 'Bearer citizen-token' },
        query: { action: 'metrics' },
      });
      expect(citizenRes.status).toBe(403);

      // Admin allowed
      const adminRes = await handler({
        method: 'GET',
        headers: { authorization: 'Bearer admin-token' },
        query: { action: 'metrics' },
      });
      expect(adminRes.status).toBe(200);
      expect(adminRes.body.ok).toBe(true);
      expect(adminRes.body.metrics).toHaveProperty('total');
    });

    it('processes reservation, check-in, and cancellation via POST actions', async () => {
      const handler = makeHandler();

      // Reserve slot
      const reserveRes = await handler({
        method: 'POST',
        headers: { authorization: 'Bearer citizen-token' },
        body: {
          action: 'reserve',
          serviceId: 'srv_rto',
          windowId: 'win_10',
          slotCapacity: 1,
        },
      });
      expect(reserveRes.status).toBe(201);
      const bookingId = reserveRes.body.booking.bookingId;

      // Check-in
      const checkinRes = await handler({
        method: 'POST',
        headers: { authorization: 'Bearer citizen-token' },
        body: { action: 'checkin', bookingId },
      });
      expect(checkinRes.status).toBe(200);
      expect(checkinRes.body.booking.status).toBe(BOOKING_STATUS.CHECKED_IN);

      // Cancel
      const cancelRes = await handler({
        method: 'POST',
        headers: { authorization: 'Bearer citizen-token' },
        body: { action: 'cancel', bookingId },
      });
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.booking.status).toBe(BOOKING_STATUS.CANCELLED);
    });

    it('enforces admin-only access for no-show registration and overrides', async () => {
      const handler = makeHandler();
      const reserveRes = await handler({
        method: 'POST',
        headers: { authorization: 'Bearer citizen-token' },
        body: { action: 'reserve', serviceId: 'srv_welfare', windowId: 'win_20' },
      });
      const bookingId = reserveRes.body.booking.bookingId;

      // Citizen trying admin override -> 403
      const citOverride = await handler({
        method: 'POST',
        headers: { authorization: 'Bearer citizen-token' },
        body: { action: 'override', bookingId, newPriority: PRIORITY_CLASSES.P0, reason: 'Self-escalation' },
      });
      expect(citOverride.status).toBe(403);

      // Reviewer applying override with reason -> 200
      const revOverride = await handler({
        method: 'POST',
        headers: { authorization: 'Bearer reviewer-token' },
        body: { action: 'override', bookingId, newPriority: PRIORITY_CLASSES.P1, reason: 'Official priority documentation' },
      });
      expect(revOverride.status).toBe(200);
      expect(revOverride.body.booking.priorityClass).toBe(PRIORITY_CLASSES.P1);
      expect(revOverride.body.auditEntry).toHaveProperty('action', 'SCHEDULER_OVERRIDE_APPLIED');

      // Citizen trying no-show -> 403
      const citNoShow = await handler({
        method: 'POST',
        headers: { authorization: 'Bearer citizen-token' },
        body: { action: 'noshow', bookingId },
      });
      expect(citNoShow.status).toBe(403);
    });
  });
});
