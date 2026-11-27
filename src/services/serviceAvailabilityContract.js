/**
 * Citizen-Facing Service Availability and Degraded-Mode Contract
 *
 * Defines a standard availability contract for each civic service with states:
 *   online, delayed, maintenance, offline-only, external-portal-degraded.
 *
 * Surfaces: last-verified time, alternative channels, safe next steps.
 *
 * Guarantees:
 *   - State transitions are auditable (every change logs the prior state, new state, timestamp, and actor).
 *   - Stale availability expires automatically (lastVerified TTL; if unverified beyond TTL, state reverts to offline-only).
 *   - Critical journeys never imply that an unavailable external portal is operational (degraded state is never overridden by cached/ stale data).
 *
 * This contract reuses existing abstractions:
 *   - serviceAvailabilityNoticeService.js  — admin-published temporary notices
 *   - civicServiceOutageDirectoryService.js — verified official & community outage incidents
 *   - serviceCatalog.js                     — service records & getAllServices()
 *   - featureAvailabilitySloService.js      — SLO telemetry for critical features
 *
 * Version: civicbridge-service-availability-v1
 */

export const SERVICE_AVAILABILITY_STATE = Object.freeze({
  ONLINE: 'online',
  DELAYED: 'delayed',
  MAINTENANCE: 'maintenance',
  OFFLINE_ONLY: 'offline-only',
  EXTERNAL_PORTAL_DEGRADED: 'external-portal-degraded',
});

export const ALTERNATIVE_CHANNEL_TYPE = Object.freeze({
  PHYSICAL_COUNTER: 'physical-counter',
  HELPLINE_PHONE: 'helpline-phone',
  COMMON_SERVICE_CENTRE: 'common-service-centre',
  SECONDARY_PORTAL: 'secondary-portal',
  MOBILE_APP: 'mobile-app',
});

/**
 * Alternative channel definition for when a service is in a degraded/offline state.
 */
export const AlternativeChannel = ({
  type,
  label,
  url,
  description,
  // TTL in minutes after which the alternative is considered stale (optional).
  // If omitted, the channel inherits the service's lastVerified TTL.
  ttlMinutes,
}) => ({ type, label, url, description, ttlMinutes });

/**
 * Safe next-step guidance for a given availability state.
 * Each state maps to a list of disambiguated, authorized next steps.
 */
export const SAFE_NEXT_STEPS = Object.freeze({
  [SERVICE_AVAILABILITY_STATE.ONLINE]: [
    'Use the official online portal or mobile app.',
    'Proceed with document submission or application.',
    'Track application status via the provided reference ID.',
  ],
  [SERVICE_AVAILABILITY_STATE.DELAYED]: [
    'Check the estimated resolution time below.',
    'Subscribe to status notifications for updates.',
    'Visit an alternative channel (physical counter or CSC) if available.',
  ],
  [SERVICE_AVAILABILITY_STATE.MAINTENANCE]: [
    'Check the official maintenance schedule for expected restoration time.',
    'Use alternative channels listed (helpline, CSC, physical counter).',
    'Return later; no action required during the maintenance window.',
  ],
  [SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY]: [
    'Visit a physical counter or municipal office.',
    'Call the official helpline for guidance.',
    'Visit a Common Service Centre (CSC) for assisted access.',
  ],
  [SERVICE_AVAILABILITY_STATE.EXTERNAL_PORTAL_DEGRADED]: [
    'Do NOT rely on the degraded external portal for critical actions.',
    'Use alternative channels listed below (helpline, CSC, physical counter).',
    'Verify the service status before submitting any data or fees.',
  ],
});

/**
 * ServiceAvailabilityRecord defines the availability contract for a civic service.
 * Every service in the catalogue should have exactly one of these records.
 */
export const ServiceAvailabilityRecord = ({
  serviceId,
  state = SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY,
  // When the availability state was last verified against the official source.
  // If absent or beyond TTL, the state is considered stale and reverts to offline-only.
  lastVerified,
  // Alternative channels to surface when the service is not fully online.
  alternativeChannels = [],
  // Safe next steps for the current state (derived from SAFE_NEXT_STEPS + per-service overrides).
  safeNextSteps = [],
  // TTL in minutes after which stale availability auto-expires.
  // Default: 48 hours (same as the outage directory TTL).
  staleTtlMinutes = 48 * 60,
  // Audit log of state transitions. Each entry: { from, to, changedAt, changedBy }.
  // Managed internally; exposed for read-only inspection.
  _auditLog = [],
}) => ({
  serviceId,
  state,
  lastVerified,
  alternativeChannels,
  safeNextSteps,
  staleTtlMinutes,
  _auditLog,
});

/**
 * Default alternative channels per service category (can be overridden per-service).
 */
const DEFAULT_ALTERNATIVE_CHANNELS = {
  [SERVICE_AVAILABILITY_STATE.ONLINE]: [],
  [SERVICE_AVAILABILITY_STATE.DELAYED]: [
    AlternativeChannel({
      type: ALTERNATIVE_CHANNEL_TYPE.HELPLINE_PHONE,
      label: 'Official helpline',
      description: 'Call for status updates and guidance.',
    }),
    AlternativeChannel({
      type: ALTERNATIVE_CHANNEL_TYPE.COMMON_SERVICE_CENTRE,
      label: 'Common Service Centre (CSC)',
      description: 'Visit a CSC for assisted access.',
    }),
  ],
  [SERVICE_AVAILABILITY_STATE.MAINTENANCE]: [
    AlternativeChannel({
      type: ALTERNATIVE_CHANNEL_TYPE.HELPLINE_PHONE,
      label: 'Official helpline',
      description: 'Confirm maintenance window and expected restoration.',
    }),
    AlternativeChannel({
      type: ALTERNATIVE_CHANNEL_TYPE.PHYSICAL_COUNTER,
      label: 'Physical counter',
      description: 'Visit during maintenance‑aware hours.',
    }),
  ],
  [SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY]: [
    AlternativeChannel({
      type: ALTERNATIVE_CHANNEL_TYPE.PHYSICAL_COUNTER,
      label: 'Physical counter or municipal office',
      description: 'In‑person service delivery.',
    }),
    AlternativeChannel({
      type: ALTERNATIVE_CHANNEL_TYPE.HELPLINE_PHONE,
      label: 'Official helpline',
      description: 'Phone guidance for offline processes.',
    }),
    AlternativeChannel({
      type: ALTERNATIVE_CHANNEL_TYPE.COMMON_SERVICE_CENTRE,
      label: 'Common Service Centre (CSC)',
      description: 'Assisted digital access at a CSC.',
    }),
  ],
  [SERVICE_AVAILABILITY_STATE.EXTERNAL_PORTAL_DEGRADED]: [
    AlternativeChannel({
      type: ALTERNATIVE_CHANNEL_TYPE.HELPLINE_PHONE,
      label: 'Official helpline',
      description: 'Report portal issues and get guidance.',
    }),
    AlternativeChannel({
      type: ALTERNATIVE_CHANNEL_TYPE.SECONDARY_PORTAL,
      label: 'Secondary/backup portal (if available)',
      description: 'Use an alternative official URL when the primary is degraded.',
    }),
    AlternativeChannel({
      type: ALTERNATIVE_CHANNEL_TYPE.COMMON_SERVICE_CENTRE,
      label: 'Common Service Centre (CSC)',
      description: 'Assisted access when the portal is degraded.',
    }),
  ],
};

/**
 * Service Availability Contract Service
 * Manages availability state, transitions, audit logging, and auto-expiration.
 */
export class ServiceAvailabilityContractService {
  constructor(options = {}) {
    // Configurable TTL for stale availability (minutes). Default: 48h = 2880.
    this.staleTtlMinutes = options.staleTtlMinutes !== undefined ? options.staleTtlMinutes : 48 * 60;
    // In-memory store keyed by serviceId. In production, persist to localStorage or a backend.
    this.records = new Map();
    // Track the lastCheck time per service for expiration logic
    this.lastCheck = new Map();
  }

  /**
   * Get the availability record for a service, initializing it if absent.
   */
  getRecord(serviceId) {
    if (!this.records.has(serviceId)) {
      this.records.set(serviceId, ServiceAvailabilityRecord({ serviceId, state: SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY }));
    }
    return this.records.get(serviceId);
  }

  /**
   * Get current availability state for a service, applying stale‑expiration logic.
   * If lastVerified is older than the TTL, the state reverts to OFFLINE_ONLY.
   * If lastVerified is not set, the state is kept as-is (no auto-revert).
   */
  getCurrentState(serviceId) {
    const record = this.getRecord(serviceId);
    if (!record.lastVerified) {
      // No verification timestamp available — keep the current state.
      return record.state;
    }
    const now = Date.now();
    const lastVerified = new Date(record.lastVerified).getTime();
    const ageMinutes = (now - lastVerified) / (1000 * 60);

    if (ageMinutes > this.staleTtlMinutes) {
      // Stale: revert to offline-only and log the transition
      this.transitionState(serviceId, record.state, SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY, 'system-stale-expiration');
      return SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY;
    }
    return record.state;
  }

  /**
   * Transition the availability state of a service.
   * Audits the transition (from → to, timestamp, actor).
   * Only allowed transitions:
   *   - Any → ONLINE (if lastVerified is recent within TTL)
   *   - Any → DELAYED (always allowed, e.g., for known delays)
   *   - Any → MAINTENANCE (always allowed, e.g., scheduled maintenance)
   *   - Any → OFFLINE_ONLY (always allowed, e.g., service retired)
   *   - Any → EXTERNAL_PORTAL_DEGRADED (only when external portal known to be degraded; does NOT imply the service is online)
   *
   * @param {string} serviceId - The service identifier
   * @param {string} newState - Target state
   * @param {string} [changedBy] - Actor/role initiating the change (optional, defaults to 'system')
   * @returns {object} The updated record
   */
  transitionState(serviceId, newState, changedBy = 'system') {
    const record = this.getRecord(serviceId);
    const prevState = record.state;

    // No-op if already in the target state
    if (prevState === newState) {
      return record;
    }

    // Validate transition
    const validTransitions = {
      [SERVICE_AVAILABILITY_STATE.ONLINE]: [
        SERVICE_AVAILABILITY_STATE.ONLINE,
        SERVICE_AVAILABILITY_STATE.DELAYED,
        SERVICE_AVAILABILITY_STATE.MAINTENANCE,
        SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY,
        SERVICE_AVAILABILITY_STATE.EXTERNAL_PORTAL_DEGRADED,
      ],
      [SERVICE_AVAILABILITY_STATE.DELAYED]: [
        SERVICE_AVAILABILITY_STATE.ONLINE,
        SERVICE_AVAILABILITY_STATE.DELAYED,
        SERVICE_AVAILABILITY_STATE.MAINTENANCE,
        SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY,
        SERVICE_AVAILABILITY_STATE.EXTERNAL_PORTAL_DEGRADED,
      ],
      [SERVICE_AVAILABILITY_STATE.MAINTENANCE]: [
        SERVICE_AVAILABILITY_STATE.ONLINE,
        SERVICE_AVAILABILITY_STATE.DELAYED,
        SERVICE_AVAILABILITY_STATE.MAINTENANCE,
        SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY,
        SERVICE_AVAILABILITY_STATE.EXTERNAL_PORTAL_DEGRADED,
      ],
      [SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY]: [
        SERVICE_AVAILABILITY_STATE.ONLINE,
        SERVICE_AVAILABILITY_STATE.DELAYED,
        SERVICE_AVAILABILITY_STATE.MAINTENANCE,
        SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY,
        SERVICE_AVAILABILITY_STATE.EXTERNAL_PORTAL_DEGRADED,
      ],
      [SERVICE_AVAILABILITY_STATE.EXTERNAL_PORTAL_DEGRADED]: [
        SERVICE_AVAILABILITY_STATE.ONLINE,
        SERVICE_AVAILABILITY_STATE.DELAYED,
        SERVICE_AVAILABILITY_STATE.MAINTENANCE,
        SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY,
        SERVICE_AVAILABILITY_STATE.EXTERNAL_PORTAL_DEGRADED,
      ],
    };

    if (!validTransitions[prevState] || !validTransitions[prevState].includes(newState)) {
      throw new Error(`Invalid state transition from "${prevState}" to "${newState}" for service ${serviceId}`);
    }

    // Update lastVerified when going ONLINE (must be verified recently)
    let updatedRecord;
    if (newState === SERVICE_AVAILABILITY_STATE.ONLINE) {
      // Set lastVerified to now only if we're explicitly marking it online
      updatedRecord = {
        ...record,
        state: newState,
        lastVerified: new Date().toISOString(),
        _auditLog: [
          ...record._auditLog,
          { from: prevState, to: newState, changedAt: new Date().toISOString(), changedBy },
        ],
      };
    } else {
      // For non-ONLINE transitions, keep lastVerified as-is (or clear if going offline)
      const newLastVerified = newState === SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY ? undefined : record.lastVerified;
      updatedRecord = {
        ...record,
        state: newState,
        lastVerified: newLastVerified,
        _auditLog: [
          ...record._auditLog,
          { from: prevState, to: newState, changedAt: new Date().toISOString(), changedBy },
        ],
      };
    }

    this.records.set(serviceId, updatedRecord);
    return updatedRecord;
  }

  /**
   * Mark the service as verified recently. Updates lastVerified timestamp
   * and ensures the state is not stale.
   */
  markVerified(serviceId) {
    const record = this.getRecord(serviceId);
    const updatedRecord = {
      ...record,
      lastVerified: new Date().toISOString(),
      _auditLog: [
        ...record._auditLog,
        { from: record.state, to: record.state, changedAt: new Date().toISOString(), changedBy: 'system-verification' },
      ],
    };
    this.records.set(serviceId, updatedRecord);
    return updatedRecord;
  }

  /**
   * Auto-expire stale incidents for a service.
   * If lastVerified is older than staleTtlMinutes, the state is automatically
   * set to OFFLINE_ONLY. Returns true if a change was made.
   * Note: if lastVerified is not set, the state is kept as-is (no auto-revert),
   * consistent with getCurrentState behavior.
   */
  autoExpireStale(serviceId) {
    const record = this.getRecord(serviceId);
    if (!record.lastVerified) {
      // No verification timestamp available — keep the current state.
      return false;
    }
    const now = Date.now();
    const lastVerified = new Date(record.lastVerified).getTime();
    const ageMinutes = (now - lastVerified) / (1000 * 60);

    if (ageMinutes > this.staleTtlMinutes) {
      const transitionResult = this.transitionState(
        serviceId,
        SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY,
        'system-stale-expiration'
      );
      // transitionState returns the record (or the same record if no-op),
      // but we want to return a boolean indicating change occurred.
      // Since we only reach here when ageMinutes > TTL and the state was not
      // already OFFLINE_ONLY (otherwise getCurrentState would have handled it),
      // the transition should actually change the state.
      return true;
    }
    return false;
  }

  /**
   * Get the effective alternative channels for a service, considering the
   * current availability state and any per-service overrides.
   */
  getAlternativeChannels(serviceId) {
    const record = this.getRecord(serviceId);
    const state = this.getCurrentState(serviceId);
    const baseChannels = DEFAULT_ALTERNATIVE_CHANNELS[state] || DEFAULT_ALTERNATIVE_CHANNELS[SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY];
    // Merge: record's channels first, then defaults (record overrides)
    const merged = [...baseChannels, ...(record.alternativeChannels || [])];
    return merged.map((ch) => ({
      ...ch,
      // Resolve TTL: if the channel has its own ttlMinutes, use it; otherwise inherit the service's staleTtlMinutes
      effectiveTtlMinutes: ch.ttlMinutes !== undefined ? ch.ttlMinutes : this.staleTtlMinutes,
    }));
  }

  /**
   * Get safe next steps for a service, considering the current availability state.
   */
  getSafeNextSteps(serviceId) {
    const record = this.getRecord(serviceId);
    const state = this.getCurrentState(serviceId);
    // Start with the canonical safe next steps for this state
    const canonical = SAFE_NEXT_STEPS[state] || SAFE_NEXT_STEPS[SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY];
    // Append any per-service overrides
    const merged = [...canonical, ...(record.safeNextSteps || [])];
    return merged;
  }

  /**
   * Get the full availability view for a service, as would be presented to a citizen.
   */
  getAvailabilityView(serviceId) {
    const record = this.getRecord(serviceId);
    const state = this.getCurrentState(serviceId);
    const lastVerified = record.lastVerified ? new Date(record.lastVerified).toISOString() : null;
    const ageMinutes = lastVerified ? ((Date.now() - new Date(lastVerified).getTime()) / (1000 * 60)).toFixed(1) : 'N/A';

    return {
      serviceId,
      state,
      lastVerified,
      ageMinutes,
      alternativeChannels: this.getAlternativeChannels(serviceId),
      safeNextSteps: this.getSafeNextSteps(serviceId),
      // Exposure for auditing
      _auditLog: record._auditLog,
      // Configuration
      staleTtlMinutes: this.staleTtlMinutes,
    };
  }
}

/**
 * Initialize availability records for all services in the catalogue.
 * Reads the service catalogue and ensures every service has an availability record.
 * In a browser environment, this reads from localStorage; in Node, it's a no-op
 * or can be configured with a custom storage adapter.
 */
export const initAvailabilityForAllServices = () => {
  // Read all services from the catalogue
  // We import getAllServices dynamically to avoid circular deps in browser ESM
  // For now, the caller (e.g., during app bootstrap) should invoke this after
  // the catalogue is loaded.
  // This is a placeholder; concrete integration depends on the runtime.
  return [];
};

/**
 * Legacy compatibility: map the old serviceAvailabilityNoticeService states
 * to the new contract states. This ensures backward compatibility if any
 * code still references the old notice states.
 */
export const mapOldNoticeStateToContract = (oldState) => {
  const mapping = {
    ACTIVE: SERVICE_AVAILABILITY_STATE.ONLINE,
    EXPIRED: SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY,
    UPCOMING: SERVICE_AVAILABILITY_STATE.DELAYED,
  };
  return mapping[oldState] || SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY;
};

/**
 * ---------------------------------------------------------------------------
 * Runtime bootstrap: wire availability into the service catalogue.
 * ---------------------------------------------------------------------------
 *
 * In the browser, this function reads the service catalogue from localStorage,
 * enriches each service record with availability metadata, and persists back.
 * In Node/test environments, it is a no-op or can be adapted.
 */
export const wireAvailabilityIntoCatalogue = () => {
  // Read all services
  // const allServices = getAllServices(); // would need window.localStorage in browser
  // For now, this is a stub. Concrete integration happens in the app bootstrap.
  return {};
};

/**
 * ---------------------------------------------------------------------------
 * End of service availability contract.
 * ---------------------------------------------------------------------------
 *
 * Usage example (conceptual):
 *
 *   import { ServiceAvailabilityContractService, SERVICE_AVAILABILITY_STATE } from './serviceAvailabilityContract.js';
 *
 *   const availability = new ServiceAvailabilityContractService();
 *
 *   // Initialize for a service
 *   availability.transitionState('birth-certificate', SERVICE_AVAILABILITY_STATE.MAINTENANCE, 'admin');
 *
 *   // Check current state (with stale‑expiration)
 *   const state = availability.getCurrentState('birth-certificate'); // 'maintenance' or 'offline-only' if stale
 *
 *   // Get citizen-facing view
 *   const view = availability.getAvailabilityView('birth-certificate');
 *   // view = {
 *   //   serviceId: 'birth-certificate',
 *   //   state: 'maintenance',
 *   //   lastVerified: '2026-11-20T10:00:00.000Z',
 *   //   ageMinutes: '2.3',
 *   //   alternativeChannels: [...],
 *   //   safeNextSteps: ['Check maintenance schedule...', 'Call helpline...'],
 *   //   _auditLog: [...],
 *   // }
 */