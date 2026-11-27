/**
 * api/_lib/disasterReliefBoardStore.js
 *
 * Bounded in-memory store for the Public Disaster Relief Entitlement & Camp Information Board (#1435).
 */

import {
  DEFAULT_VERIFIED_CAMPS,
  VERIFIED_RELIEF_ENTITLEMENTS,
  listVerifiedReliefCampsAndEntitlements,
  evaluateReliefRecordFreshness,
  ENTITLEMENT_STALE_DAYS,
} from '../../src/services/disasterReliefBoardService.js';

const MAX_CAMPS = 250;
const MAX_OBSERVATIONS = 500;
const MAX_AUDIT = 500;

export class InMemoryDisasterReliefBoardStore {
  constructor() {
    this.camps = JSON.parse(JSON.stringify(DEFAULT_VERIFIED_CAMPS));
    this.entitlements = JSON.parse(JSON.stringify(VERIFIED_RELIEF_ENTITLEMENTS));
    this.observations = [];
    this.auditLog = [];
  }

  listBoard({ includeExpired = false, referenceDate = new Date() } = {}) {
    const camps = listVerifiedReliefCampsAndEntitlements(this.camps, { includeExpired }, referenceDate);
    const entitlements = this.entitlements
      .map((ent) => ({
        ...ent,
        freshness: evaluateReliefRecordFreshness(ent, referenceDate, {
          staleHours: ENTITLEMENT_STALE_DAYS * 24,
        }),
      }))
      .filter((ent) => includeExpired || !ent.freshness.isExpired);

    return {
      camps,
      entitlements,
      observations: [...this.observations],
    };
  }

  getCampById(id) {
    return this.camps.find((c) => c.id === id) || null;
  }

  addCamp(camp, actorId = 'admin') {
    if (this.camps.length >= MAX_CAMPS) this.camps.pop();
    this.camps.unshift(camp);
    this.appendAudit({
      action: 'PUBLISH_OFFICIAL_CAMP',
      targetId: camp.id,
      jurisdiction: camp.jurisdiction,
      actorId,
      timestamp: new Date().toISOString(),
    });
    return camp;
  }

  addObservation(obs) {
    if (this.observations.length >= MAX_OBSERVATIONS) this.observations.pop();
    this.observations.unshift(obs);
    return obs;
  }

  moderateObservation(id, decision, actorId = 'admin', note = '') {
    const idx = this.observations.findIndex((o) => o.id === id);
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
      action: status === 'approved' ? 'APPROVE_CAMP_OBSERVATION' : 'REJECT_CAMP_OBSERVATION',
      targetId: id,
      campId: updated.campId,
      actorId,
      timestamp: updated.moderatedAt,
    });
    return updated;
  }

  appendAudit(entry) {
    if (this.auditLog.length >= MAX_AUDIT) this.auditLog.pop();
    this.auditLog.unshift(entry);
  }

  getAuditLog() {
    return [...this.auditLog];
  }
}

let productionStore = null;

export function getProductionDisasterReliefBoardStore() {
  if (!productionStore) {
    productionStore = new InMemoryDisasterReliefBoardStore();
  }
  return productionStore;
}
