import { describe, it, expect } from 'vitest';
import {
  runNeedsForecast,
  buildDeterministicFallback,
  clusterNeeds,
  summarizeUnmetNeeds,
  isNeedStale,
  remainingQuantity,
  haversineDistanceMeters,
} from './reliefForecastEngine';

const NOW = Date.parse('2026-11-19T08:00:00.000Z');
const hours = (n) => n * 60 * 60 * 1000;
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();

const needs = [
  {
    id: 'N-TEST-1',
    category: 'water',
    locality: 'Bellandur',
    jurisdictionId: 'WARD-150',
    quantity: 100,
    fulfilledQuantity: 20,
    peopleAffected: 80,
    urgency: 'immediate',
    status: 'verified',
    coordinates: { lat: 12.9279, lng: 77.6834 },
    createdAt: iso(hours(6)),
    updatedAt: iso(hours(1)),
  },
  {
    id: 'N-TEST-2',
    category: 'water',
    locality: 'Bellandur',
    jurisdictionId: 'WARD-150',
    quantity: 50,
    fulfilledQuantity: 0,
    peopleAffected: 40,
    urgency: 'high',
    status: 'triaged',
    coordinates: { lat: 12.9282, lng: 77.6839 },
    createdAt: iso(hours(4)),
    updatedAt: iso(hours(2)),
  },
  {
    id: 'N-TEST-3',
    category: 'medicine',
    locality: 'Bellandur',
    jurisdictionId: 'WARD-150',
    quantity: 30,
    fulfilledQuantity: 0,
    peopleAffected: 30,
    urgency: 'high',
    status: 'verified',
    coordinates: null,
    createdAt: iso(hours(3)),
    updatedAt: iso(hours(3)),
  },
  {
    id: 'N-TEST-DUPLICATE',
    category: 'water',
    locality: 'Bellandur',
    jurisdictionId: 'WARD-150',
    quantity: 999,
    fulfilledQuantity: 0,
    peopleAffected: 999,
    urgency: 'immediate',
    status: 'duplicate',
    createdAt: iso(hours(1)),
    updatedAt: iso(hours(1)),
  },
];

describe('reliefForecastEngine (#747)', () => {
  it('groups open needs by jurisdiction, locality and category', () => {
    const clusters = clusterNeeds(needs, { now: NOW, windowDays: 7 });
    expect(clusters).toHaveLength(2);
    const water = clusters.find((cluster) => cluster.category === 'water');
    expect(water.needs).toHaveLength(2);
    expect(water.centroid).toBeTruthy();
    expect(water.spreadMeters).toBeGreaterThanOrEqual(0);
    expect(clusters.some((cluster) => cluster.category === 'medicine')).toBe(true);
  });

  it('is deterministic for the same inputs, ruleset and clock', () => {
    const a = runNeedsForecast(needs, { now: NOW, windowDays: 7 });
    const b = runNeedsForecast(needs, { now: NOW, windowDays: 7 });
    expect(b).toEqual(a);
    expect(a.runId).toBe(b.runId);
  });

  it('records model version, feature window, execution time and evidence', () => {
    const run = runNeedsForecast(needs, { now: NOW, windowDays: 7 });
    expect(run.modelVersion).toBe('relief-forecast-rules-v1.0.0');
    expect(run.rulesetVersion).toBe(run.modelVersion);
    expect(run.executedAt).toBe(new Date(NOW).toISOString());
    expect(run.featureWindow).toEqual({
      from: new Date(NOW - 7 * 24 * 60 * 60 * 1000).toISOString(),
      to: new Date(NOW).toISOString(),
      days: 7,
    });

    const water = run.recommendations.find((rec) => rec.category === 'water');
    expect(water.evidence.reportCount).toBe(2);
    expect(water.evidence.verifiedCount).toBe(2);
    expect(water.evidence.reportIds).toEqual(['N-TEST-1', 'N-TEST-2']);
    expect(water.evidence.sourceFields).toContain('peopleAffected');
    expect(water.evidence.centroid).toBeTruthy();
    expect(water.freshness.isStale).toBe(false);
    expect(water.requiresHumanApproval).toBe(true);
    expect(water.explanation.join(' ')).toMatch(/open reports/i);
  });

  it('never makes medical triage decisions and flags medicine for review', () => {
    const run = runNeedsForecast(needs, { now: NOW, windowDays: 7 });
    const medicine = run.recommendations.find((rec) => rec.category === 'medicine');
    expect(medicine.requiresMedicalReview).toBe(true);
    expect(medicine.triageDecisionMade).toBe(false);
    expect(medicine.medicalReviewNotice).toMatch(/does not triage/i);
    expect(medicine).not.toHaveProperty('triageDecision');
    expect(medicine).not.toHaveProperty('diagnosis');
  });

  it('does not use inferred sensitive attributes', () => {
    const run = runNeedsForecast(needs, { now: NOW, windowDays: 7 });
    const serialized = JSON.stringify(run);
    for (const field of ['caste', 'religion', 'gender', 'disability', 'sexualOrientation', 'healthStatus']) {
      expect(serialized).not.toContain(field);
    }
  });

  it('excludes duplicate reports from demand and priority', () => {
    const run = runNeedsForecast(needs, { now: NOW, windowDays: 7 });
    const water = run.recommendations.find((rec) => rec.category === 'water');
    expect(water.evidence.reportIds).not.toContain('N-TEST-DUPLICATE');
    expect(water.requestedRemainingQuantity).toBe(130);
    expect(water.peopleAffected).toBe(120);
  });

  it('produces a deterministic low-confidence fallback', () => {
    const fallback = buildDeterministicFallback(needs, { now: NOW, windowDays: 7 });
    expect(fallback.fallbackMode).toBe(true);
    expect(fallback.engineAvailable).toBe(false);
    expect(fallback.rulesetVersion).toContain('deterministic-fallback');
    expect(fallback.recommendations.every((rec) => rec.confidence === 'low')).toBe(true);
    expect(fallback.recommendations.every((rec) => rec.requiresHumanApproval)).toBe(true);
    expect(fallback.limitations.join(' ')).toMatch(/human review/i);
  });

  it('marks stale reports and lowers confidence', () => {
    const staleNow = NOW + 2 * 24 * 60 * 60 * 1000;
    const run = runNeedsForecast(needs, { now: staleNow, windowDays: 7 });
    expect(run.recommendations.every((rec) => rec.freshness.isStale)).toBe(true);
    expect(run.recommendations.every((rec) => rec.confidence === 'low')).toBe(true);
    expect(run.dataFreshness.isStale).toBe(true);
  });

  it('summarizes unmet needs by category and locality', () => {
    const summary = summarizeUnmetNeeds(needs, { now: NOW });
    expect(summary.totalOpenReports).toBe(3);
    expect(summary.totalRemainingQuantity).toBe(160);
    expect(summary.byCategory.find((item) => item.category === 'water').remainingQuantity).toBe(130);
    expect(summary.byLocality[0].locality).toBe('Bellandur');
  });

  it('computes remaining quantity and freshness helpers defensively', () => {
    expect(remainingQuantity({ quantity: 10, fulfilledQuantity: 4 })).toBe(6);
    expect(remainingQuantity({ quantity: 5, fulfilledQuantity: 9 })).toBe(0);
    expect(isNeedStale({ updatedAt: iso(hours(30)) }, NOW)).toBe(true);
    expect(isNeedStale({ updatedAt: iso(hours(1)) }, NOW)).toBe(false);
    expect(haversineDistanceMeters({ lat: 12.9279, lng: 77.6834 }, { lat: 12.9279, lng: 77.6834 })).toBe(0);
  });
});
