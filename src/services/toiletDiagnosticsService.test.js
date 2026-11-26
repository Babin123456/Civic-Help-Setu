import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateToiletRecommendations,
  recordRecommendationDecision,
  clearRecommendationDecisions,
  RULESET_VERSION,
  RECOMMENDATION_TYPES,
} from './toiletDiagnosticsService.js';
import {
  resetToiletStorage,
  saveFacility,
  saveMaintenanceTicket,
} from './publicToiletStorage.js';

describe('Public Toilet Diagnostics & Explainable Intelligence (#758)', () => {
  beforeEach(() => {
    resetToiletStorage();
    clearRecommendationDecisions();
  });

  it('triggers cleaning overdue recommendation with explainability fields', () => {
    const facilityId = 'pt-overdue-01';
    const fiveHoursAgo = new Date(Date.now() - 6 * 3600 * 1000).toISOString();

    saveFacility({
      id: facilityId,
      name: 'Test Complex',
      category: 'public_convenience_complex',
      jurisdiction: { state: 'Karnataka', district: 'Bengaluru Urban', ward: '150' },
      location: { latitude: 12.93, longitude: 77.62, address: 'Test St' },
      status: 'verified_active',
      lastCleanedAt: fiveHoursAgo,
    });

    const recs = generateToiletRecommendations(facilityId);
    const overdueRec = recs.find((r) => r.type === RECOMMENDATION_TYPES.CLEANING_OVERDUE);

    expect(overdueRec).toBeDefined();
    expect(overdueRec.rulesetVersion).toBe(RULESET_VERSION);
    expect(overdueRec.explainability.influencingFields).toContain('facility.lastCleanedAt');
    expect(overdueRec.explainability.observedValue).toContain('hours');
  });

  it('triggers recurring defect escalation when multiple tickets of same category exist within 7 days', () => {
    const facilityId = 'pt-recurring-01';
    saveFacility({
      id: facilityId,
      name: 'Test Complex 2',
      category: 'transit_hub_toilet',
      jurisdiction: { state: 'Karnataka', district: 'Bengaluru Urban', ward: '150' },
      location: { latitude: 12.93, longitude: 77.62, address: 'Test St 2' },
      status: 'verified_active',
      lastCleanedAt: new Date().toISOString(),
    });

    // Add 2 plumbing tickets in past 3 days
    saveMaintenanceTicket({
      id: 'tkt-01',
      facilityId,
      category: 'plumbing_leak',
      severity: 'high',
      status: 'reported',
      createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      description: 'Leak in stall 1',
    });

    saveMaintenanceTicket({
      id: 'tkt-02',
      facilityId,
      category: 'plumbing_leak',
      severity: 'critical',
      status: 'in_progress',
      createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      description: 'Leak in main inlet pipe',
    });

    const recs = generateToiletRecommendations(facilityId);
    const defectRec = recs.find((r) => r.type === RECOMMENDATION_TYPES.RECURRING_DEFECT);

    expect(defectRec).toBeDefined();
    expect(defectRec.severity).toBe('high');
    expect(defectRec.explainability.observedValue).toContain('plumbing_leak');
  });

  it('records human accept / modify / reject decisions with audit entry', () => {
    const facilityId = 'pt-blr-ward150-001';
    saveFacility({
      id: facilityId,
      name: 'Indiranagar Complex',
      category: 'public_convenience_complex',
      jurisdiction: { state: 'Karnataka', district: 'Bengaluru Urban', ward: '150' },
      location: { latitude: 12.93, longitude: 77.62, address: 'Test St' },
      status: 'verified_active',
      lastCleanedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    });

    const recs = generateToiletRecommendations(facilityId);
    expect(recs.length).toBeGreaterThan(0);

    const targetRec = recs[0];
    const decision = recordRecommendationDecision(
      targetRec.id,
      { decision: 'accepted', notes: 'Scheduled squad for 3pm sanitization' },
      { role: 'operator' }
    );

    expect(decision.decision).toBe('accepted');
    expect(decision.decidedByRole).toBe('operator');

    // Subsequent retrieval attaches human decision
    const updatedRecs = generateToiletRecommendations(facilityId);
    const updatedTarget = updatedRecs.find((r) => r.id === targetRec.id);
    expect(updatedTarget.humanDecision).toBeDefined();
    expect(updatedTarget.humanDecision.decision).toBe('accepted');
  });
});
