/**
 * api/_lib/heatReliefDirectoryStore.js
 *
 * Bounded in-memory store for the Heatwave Public Cooling-Centre and Water-Point Directory (#1436).
 * Maintains verified municipal/DDMA facilities, moderated condition reports, and redacted audit logs.
 */

import { SEED_HEATWAVE_FACILITIES } from '../../src/data/upHeatwaveReliefSeed.js';
import { isTemporaryFacilityExpired, isVerifiedMunicipalOrDisasterSource } from '../../src/data/upHeatwaveReliefContract.js';

const MAX_FACILITIES = 250;
const MAX_OBSERVATIONS = 500;
const MAX_AUDIT_LOGS = 500;

export class InMemoryHeatReliefDirectoryStore {
  constructor(initialFacilities = SEED_HEATWAVE_FACILITIES) {
    this.facilities = JSON.parse(JSON.stringify(initialFacilities));
    this.observations = [];
    this.auditLog = [];
  }

  listFacilities({ includeExpired = false, referenceDate = new Date() } = {}) {
    return this.facilities.filter((facility) => {
      if (!isVerifiedMunicipalOrDisasterSource(facility)) return false;
      if (!includeExpired && isTemporaryFacilityExpired(facility, referenceDate)) return false;
      return true;
    });
  }

  getFacilityById(id) {
    return this.facilities.find((f) => f.id === id) || null;
  }

  addFacility(record, actorId = 'system') {
    if (this.facilities.length >= MAX_FACILITIES) {
      this.facilities.pop();
    }
    this.facilities.unshift(record);
    this.appendAudit({
      action: 'REGISTER_VERIFIED_FACILITY',
      targetId: record.id,
      jurisdiction: record.jurisdiction || record.district,
      actorId,
      timestamp: new Date().toISOString(),
    });
    return record;
  }

  listObservations() {
    return [...this.observations];
  }

  addObservation(record) {
    if (this.observations.length >= MAX_OBSERVATIONS) {
      this.observations.pop();
    }
    this.observations.unshift(record);
    return record;
  }

  moderateObservation(observationId, decision, actorId = 'admin', note = '') {
    const idx = this.observations.findIndex((o) => o.id === observationId);
    if (idx === -1) return null;
    const status = decision === 'approve' ? 'approved' : 'rejected';
    const updated = {
      ...this.observations[idx],
      status,
      moderatedBy: actorId,
      moderatedAt: new Date().toISOString(),
      moderationNote: note || '',
    };
    this.observations[idx] = updated;
    this.appendAudit({
      action: status === 'approved' ? 'APPROVE_CONDITION_REPORT' : 'REJECT_CONDITION_REPORT',
      targetId: observationId,
      facilityId: updated.facilityId,
      actorId,
      timestamp: updated.moderatedAt,
    });
    return updated;
  }

  appendAudit(entry) {
    if (this.auditLog.length >= MAX_AUDIT_LOGS) {
      this.auditLog.pop();
    }
    this.auditLog.unshift(entry);
  }

  getAuditLog() {
    return [...this.auditLog];
  }
}

let productionStore = null;

export function getProductionHeatReliefDirectoryStore() {
  if (!productionStore) {
    productionStore = new InMemoryHeatReliefDirectoryStore();
  }
  return productionStore;
}
