import { logDiagnostic } from '../../src/utils/diagnostics.js';

export const POLICY_VERSION = 'fair_scheduling_v1';

export const PRIORITY_CLASSES = Object.freeze({
  P0: 'P0', // Emergency (designated services only)
  P1: 'P1', // Time-critical / statutory deadline
  P2: 'P2', // Accessibility accommodation
  P3: 'P3', // Standard
});

export const BOOKING_STATUS = Object.freeze({
  RESERVED: 'reserved',
  WAITLISTED: 'waitlisted',
  CHECKED_IN: 'checked_in',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
});

const PRIORITY_RANKS = Object.freeze({
  [PRIORITY_CLASSES.P0]: 0,
  [PRIORITY_CLASSES.P1]: 1,
  [PRIORITY_CLASSES.P2]: 2,
  [PRIORITY_CLASSES.P3]: 3,
});

const RANK_TO_PRIORITY = Object.freeze(['P0', 'P1', 'P2', 'P3']);

const adminRoles = new Set(['admin', 'reviewer', 'official']);
export const isAdminRole = (role) => adminRoles.has(role);

export const createMemoryStorageAdapter = (state = new Map()) => ({
  read: async (key) => (state.has(key) ? JSON.parse(JSON.stringify(state.get(key))) : null),
  write: async (key, val) => {
    state.set(key, JSON.parse(JSON.stringify(val)));
    return true;
  },
  remove: async (key) => state.delete(key),
  raw: state,
});

export const createSchedulerStorageAdapter = ({ read, write, remove }) => {
  if (typeof read !== 'function' || typeof write !== 'function') {
    throw new TypeError('A scheduler storage adapter requires read and write functions.');
  }
  return {
    read,
    write,
    remove: typeof remove === 'function' ? remove : async () => {},
  };
};

/**
 * Fair Scheduling & Allocation Engine for Token & Appointment Demand Peaks.
 */
export const createFairScheduler = ({
  storage = createMemoryStorageAdapter(),
  storageKey = 'civic_fair_scheduler',
  designatedEmergencyServices = new Set(),
  agingWindowMs = 60 * 60 * 1000, // 1 hour per aging step
  gracePeriodMs = 15 * 60 * 1000, // 15 minutes grace period
  audit = () => {},
  now = () => Date.now(),
} = {}) => {
  let queue = Promise.resolve();
  const withLock = (fn) => {
    const next = queue.then(fn, fn);
    queue = next.catch(() => {});
    return next;
  };

  const getStore = async () => {
    try {
      const data = await storage.read(storageKey);
      return data && typeof data === 'object' && !Array.isArray(data)
        ? data
        : { bookings: {}, auditLog: [], overridesCount: 0 };
    } catch (err) {
      logDiagnostic('Failed reading scheduler store', err);
      return { bookings: {}, auditLog: [], overridesCount: 0 };
    }
  };

  const saveStore = async (store) => {
    try {
      await storage.write(storageKey, store);
      return true;
    } catch (err) {
      logDiagnostic('Failed saving scheduler store', err);
      return false;
    }
  };

  const emergencySet = designatedEmergencyServices instanceof Set
    ? designatedEmergencyServices
    : new Set(Array.isArray(designatedEmergencyServices) ? designatedEmergencyServices : []);

  /**
   * Computes effective rank and applies anti-starvation aging boost.
   */
  const computeEffectivePriority = (booking, currentTime) => {
    const baseRank = PRIORITY_RANKS[booking.priorityClass] ?? 3;
    if (booking.status !== BOOKING_STATUS.WAITLISTED || !booking.waitlistedAt) {
      return { rank: baseRank, priorityClass: booking.priorityClass, aged: false };
    }
    const waitTime = Math.max(0, currentTime - Date.parse(booking.waitlistedAt));
    const ageSteps = Math.floor(waitTime / agingWindowMs);
    const effectiveRank = Math.max(0, baseRank - ageSteps);
    return {
      rank: effectiveRank,
      priorityClass: RANK_TO_PRIORITY[effectiveRank],
      aged: effectiveRank < baseRank,
    };
  };

  /**
   * Deterministic sorting comparator for waitlisted requests:
   * 1. Effective priority rank ascending (0 is highest).
   * 2. requestedAt ascending (earlier request wins).
   * 3. Deterministic citizenId comparison.
   */
  const compareWaitlist = (a, b, currentTime) => {
    const aEff = computeEffectivePriority(a, currentTime);
    const bEff = computeEffectivePriority(b, currentTime);
    if (aEff.rank !== bEff.rank) return aEff.rank - bEff.rank;
    const aReq = Date.parse(a.requestedAt);
    const bReq = Date.parse(b.requestedAt);
    if (aReq !== bReq) return aReq - bReq;
    return String(a.citizenId || '').localeCompare(String(b.citizenId || ''));
  };

  /**
   * Promotes the top eligible waitlisted request for a given service and window.
   */
  const promoteWaitlistSlot = (store, serviceId, windowId, currentTime) => {
    const waitlisted = Object.values(store.bookings).filter(
      (b) =>
        b.serviceId === serviceId &&
        b.windowId === windowId &&
        b.status === BOOKING_STATUS.WAITLISTED
    );
    if (waitlisted.length === 0) return null;

    waitlisted.sort((a, b) => compareWaitlist(a, b, currentTime));
    const top = waitlisted[0];
    const { aged } = computeEffectivePriority(top, currentTime);

    top.status = BOOKING_STATUS.RESERVED;
    top.promotedAt = new Date(currentTime).toISOString();
    if (!top.reasonCodes.includes('WAITLIST_PROMOTED')) {
      top.reasonCodes.push('WAITLIST_PROMOTED');
    }
    if (aged && !top.reasonCodes.includes('AGING_BOOST_APPLIED')) {
      top.reasonCodes.push('AGING_BOOST_APPLIED');
    }

    store.bookings[top.bookingId] = top;
    return top;
  };

  return {
    /**
     * Reserve a slot or enqueue on the fair waitlist.
     */
    async reserveSlot({
      citizenId,
      serviceId,
      windowId,
      requestedPriority,
      hasStatutoryDeadline = false,
      accommodationRequirement = null,
      slotCapacity = 1,
      idempotencyKey,
    } = {}) {
      if (!citizenId || !serviceId || !windowId) {
        return { ok: false, status: 400, error: 'validation_failed', message: 'citizenId, serviceId, and windowId are required.' };
      }

      const key = idempotencyKey || `${citizenId}:${serviceId}:${windowId}`;
      const currentTime = now();

      return withLock(async () => {
        const store = await getStore();

        // Idempotency check: return existing booking if already processed
        const existing = Object.values(store.bookings).find((b) => b.idempotencyKey === key);
        if (existing) {
          return { ok: true, status: 200, booking: existing, isExisting: true };
        }

        // P0 Emergency Designation Guard
        if (requestedPriority === PRIORITY_CLASSES.P0 && !emergencySet.has(serviceId)) {
          return {
            ok: false,
            status: 400,
            error: 'unauthorized_emergency_priority',
            reasonCodes: ['REJECT_UNAUTHORIZED_EMERGENCY'],
            message: 'Emergency priority (P0) is restricted to officially designated emergency services.',
          };
        }

        // Priority Classification
        let priorityClass;
        const reasonCodes = [];

        if (requestedPriority === PRIORITY_CLASSES.P0 && emergencySet.has(serviceId)) {
          priorityClass = PRIORITY_CLASSES.P0;
          reasonCodes.push('P0_EMERGENCY_DESIGNATED');
        } else if (hasStatutoryDeadline || requestedPriority === PRIORITY_CLASSES.P1) {
          priorityClass = PRIORITY_CLASSES.P1;
          reasonCodes.push('P1_STATUTORY_DEADLINE');
        } else if (accommodationRequirement || requestedPriority === PRIORITY_CLASSES.P2) {
          priorityClass = PRIORITY_CLASSES.P2;
          reasonCodes.push('P2_ACCOMMODATION_MATCHED');
        } else {
          priorityClass = PRIORITY_CLASSES.P3;
          reasonCodes.push('P3_STANDARD_ALLOCATION');
        }

        // Count current active reservations
        const activeReservations = Object.values(store.bookings).filter(
          (b) =>
            b.serviceId === serviceId &&
            b.windowId === windowId &&
            [BOOKING_STATUS.RESERVED, BOOKING_STATUS.CHECKED_IN].includes(b.status)
        );

        const isoNow = new Date(currentTime).toISOString();
        const bookingId = `bk_${currentTime.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const isReserved = activeReservations.length < slotCapacity;
        const status = isReserved ? BOOKING_STATUS.RESERVED : BOOKING_STATUS.WAITLISTED;

        const booking = {
          bookingId,
          tokenId: `TK-${Math.floor(1000 + Math.random() * 9000)}`,
          idempotencyKey: key,
          citizenId,
          serviceId,
          windowId,
          status,
          priorityClass,
          policyVersion: POLICY_VERSION,
          reasonCodes,
          hasAccommodation: Boolean(accommodationRequirement),
          // Accommodation requirement recorded without requiring sensitive medical diagnosis
          accommodationRequirement: accommodationRequirement ? String(accommodationRequirement) : null,
          requestedAt: isoNow,
          waitlistedAt: status === BOOKING_STATUS.WAITLISTED ? isoNow : null,
          promotedAt: null,
          checkedInAt: null,
          cancelledAt: null,
        };

        store.bookings[bookingId] = booking;
        await saveStore(store);

        return {
          ok: true,
          status: isReserved ? 201 : 202,
          booking,
          isWaitlisted: status === BOOKING_STATUS.WAITLISTED,
        };
      });
    },

    /**
     * Cancel a booking and automatically promote the highest-priority waitlisted request.
     */
    async cancelReservation({ bookingId, citizenId, actorRole } = {}) {
      if (!bookingId) {
        return { ok: false, status: 400, error: 'booking_id_required' };
      }
      const currentTime = now();

      return withLock(async () => {
        const store = await getStore();
        const booking = store.bookings[bookingId];
        if (!booking) {
          return { ok: false, status: 404, error: 'booking_not_found' };
        }

        if (citizenId && booking.citizenId !== citizenId && !isAdminRole(actorRole)) {
          return { ok: false, status: 403, error: 'forbidden' };
        }

        const wasReserved = [BOOKING_STATUS.RESERVED, BOOKING_STATUS.CHECKED_IN].includes(booking.status);
        booking.status = BOOKING_STATUS.CANCELLED;
        booking.cancelledAt = new Date(currentTime).toISOString();
        store.bookings[bookingId] = booking;

        let promoted = null;
        if (wasReserved) {
          promoted = promoteWaitlistSlot(store, booking.serviceId, booking.windowId, currentTime);
        }

        await saveStore(store);
        return { ok: true, booking, promotedBooking: promoted };
      });
    },

    /**
     * Check in for a reserved slot within the valid window/grace period.
     */
    async checkIn({ bookingId } = {}) {
      const currentTime = now();
      return withLock(async () => {
        const store = await getStore();
        const booking = store.bookings[bookingId];
        if (!booking) {
          return { ok: false, status: 404, error: 'booking_not_found' };
        }
        if (booking.status !== BOOKING_STATUS.RESERVED) {
          return { ok: false, status: 400, error: 'invalid_status_for_checkin', currentStatus: booking.status };
        }

        booking.status = BOOKING_STATUS.CHECKED_IN;
        booking.checkedInAt = new Date(currentTime).toISOString();
        store.bookings[bookingId] = booking;
        await saveStore(store);

        return { ok: true, booking };
      });
    },

    /**
     * Releases slots when a citizen fails to check in after slotStartTime + gracePeriodMs.
     */
    async recordNoShow({ bookingId, slotStartTimeMs } = {}) {
      const currentTime = now();
      return withLock(async () => {
        const store = await getStore();
        const booking = store.bookings[bookingId];
        if (!booking) {
          return { ok: false, status: 404, error: 'booking_not_found' };
        }
        if (booking.status !== BOOKING_STATUS.RESERVED) {
          return { ok: false, status: 400, error: 'not_reserved', currentStatus: booking.status };
        }

        // Grace period verification
        if (slotStartTimeMs && currentTime < slotStartTimeMs + gracePeriodMs) {
          return { ok: false, status: 400, error: 'grace_period_active', message: 'Grace period has not yet expired.' };
        }

        booking.status = BOOKING_STATUS.NO_SHOW;
        store.bookings[bookingId] = booking;

        const promoted = promoteWaitlistSlot(store, booking.serviceId, booking.windowId, currentTime);
        await saveStore(store);

        return { ok: true, booking, promotedBooking: promoted };
      });
    },

    /**
     * Admin-only manual override with mandatory audit trail.
     */
    async applyAdminOverride({
      bookingId,
      newStatus,
      newPriority,
      reason,
      actorRole,
    } = {}) {
      if (!isAdminRole(actorRole)) {
        return { ok: false, status: 403, error: 'forbidden', message: 'Admin role required for override.' };
      }
      if (!reason || typeof reason !== 'string' || !reason.trim()) {
        return { ok: false, status: 400, error: 'reason_required', message: 'A non-empty override reason is required.' };
      }

      const currentTime = now();
      return withLock(async () => {
        const store = await getStore();
        const booking = store.bookings[bookingId];
        if (!booking) {
          return { ok: false, status: 404, error: 'booking_not_found' };
        }

        const auditEntry = {
          action: 'SCHEDULER_OVERRIDE_APPLIED',
          bookingId,
          actorRole,
          reason: reason.trim(),
          previousStatus: booking.status,
          newStatus: newStatus || booking.status,
          previousPriority: booking.priorityClass,
          newPriority: newPriority || booking.priorityClass,
          recordedAt: new Date(currentTime).toISOString(),
        };

        if (newStatus && Object.values(BOOKING_STATUS).includes(newStatus)) {
          booking.status = newStatus;
        }
        if (newPriority && Object.values(PRIORITY_CLASSES).includes(newPriority)) {
          booking.priorityClass = newPriority;
        }
        booking.reasonCodes.push('ADMIN_OVERRIDE');

        store.bookings[bookingId] = booking;
        store.auditLog.push(auditEntry);
        store.overridesCount = (store.overridesCount || 0) + 1;

        audit(auditEntry);
        await saveStore(store);

        return { ok: true, booking, auditEntry };
      });
    },

    /**
     * Public, privacy-preserving queue projection.
     * Sanitizes sensitive accommodation details, diagnoses, and citizen IDs.
     */
    async getPublicQueueProjection({ serviceId, windowId } = {}) {
      const store = await getStore();
      const relevant = Object.values(store.bookings).filter(
        (b) =>
          (!serviceId || b.serviceId === serviceId) &&
          (!windowId || b.windowId === windowId) &&
          [BOOKING_STATUS.RESERVED, BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.WAITLISTED].includes(b.status)
      );

      return relevant.map((b, index) => ({
        position: index + 1,
        tokenId: b.tokenId,
        windowId: b.windowId,
        status: b.status,
        isWaitlisted: b.status === BOOKING_STATUS.WAITLISTED,
        policyVersion: b.policyVersion,
        // Strict privacy sanitization: sensitive accommodation details & PII are omitted
      }));
    },

    /**
     * Observability snapshot helper.
     */
    async getMetrics() {
      const store = await getStore();
      const all = Object.values(store.bookings);

      const counts = {
        total: all.length,
        reserved: 0,
        waitlisted: 0,
        checkedIn: 0,
        cancelled: 0,
        noShow: 0,
        byPriority: {
          [PRIORITY_CLASSES.P0]: 0,
          [PRIORITY_CLASSES.P1]: 0,
          [PRIORITY_CLASSES.P2]: 0,
          [PRIORITY_CLASSES.P3]: 0,
        },
      };

      let totalWaitMs = 0;
      let waitCount = 0;

      for (const b of all) {
        if (b.status === BOOKING_STATUS.RESERVED) counts.reserved += 1;
        else if (b.status === BOOKING_STATUS.WAITLISTED) counts.waitlisted += 1;
        else if (b.status === BOOKING_STATUS.CHECKED_IN) counts.checkedIn += 1;
        else if (b.status === BOOKING_STATUS.CANCELLED) counts.cancelled += 1;
        else if (b.status === BOOKING_STATUS.NO_SHOW) counts.noShow += 1;

        if (counts.byPriority[b.priorityClass] !== undefined) {
          counts.byPriority[b.priorityClass] += 1;
        }

        if (b.waitlistedAt) {
          const end = b.promotedAt ? Date.parse(b.promotedAt) : now();
          const duration = Math.max(0, end - Date.parse(b.waitlistedAt));
          totalWaitMs += duration;
          waitCount += 1;
        }
      }

      return {
        ...counts,
        overridesCount: store.overridesCount || 0,
        avgWaitlistDurationMs: waitCount > 0 ? Math.round(totalWaitMs / waitCount) : 0,
      };
    },

    /**
     * Reset / clear store.
     */
    async reset() {
      await storage.remove(storageKey);
    },
  };
};
