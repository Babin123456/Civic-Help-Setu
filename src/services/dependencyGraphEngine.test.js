import { describe, it, expect } from 'vitest';
import {
  detectDependencyCycles,
  calculateRecoverySequence,
  calculateCascadingBlastRadius,
  generateExplainableRecommendations,
  RULESET_VERSION,
  RECOMMENDATION_TYPES,
  RECOMMENDATION_STATUS,
} from './dependencyGraphEngine';

describe('Dependency Graph Analysis Engine (#780)', () => {
  const sampleServices = [
    { id: 'svc_water', name: 'Water Pumping', criticality: 'TIER_1_CRITICAL', estimatedRestorationHours: 3 },
    { id: 'svc_power', name: 'Substation Grid', criticality: 'TIER_1_CRITICAL', estimatedRestorationHours: 6 },
    { id: 'svc_scada', name: 'SCADA Telemetry', criticality: 'TIER_2_ESSENTIAL', estimatedRestorationHours: 2 },
    { id: 'svc_tax', name: 'Property Tax Portal', criticality: 'TIER_3_DEFERRED', estimatedRestorationHours: 1 },
  ];

  const sampleDependencies = [
    {
      serviceId: 'svc_water',
      upstreamDependencies: ['svc_power', 'svc_scada'],
      redundantAlternative: null,
      manualFallbackProcedure: 'Manual valve bypass',
      estimatedRestorationHours: 3,
    },
    {
      serviceId: 'svc_scada',
      upstreamDependencies: ['svc_power'],
      redundantAlternative: 'Analog dial gauges',
      manualFallbackProcedure: 'Physical logbook recording',
      estimatedRestorationHours: 2,
    },
    {
      serviceId: 'svc_power',
      upstreamDependencies: [],
      redundantAlternative: null, // SPOF
      manualFallbackProcedure: '', // Missing fallback!
      estimatedRestorationHours: 6, // Exceeds 4h RTO
    },
    {
      serviceId: 'svc_tax',
      upstreamDependencies: [],
      redundantAlternative: null,
      manualFallbackProcedure: 'Paper receipts',
      estimatedRestorationHours: 1,
    },
  ];

  describe('Cycle Detection (DFS 3-color)', () => {
    it('detects no cycle in an acyclic directed graph', () => {
      const result = detectDependencyCycles(sampleServices, sampleDependencies);
      expect(result.hasCycle).toBe(false);
      expect(result.cyclePath).toEqual([]);
      expect(result.cycleDescription).toBeNull();
    });

    it('detects circular dependency and extracts full cycle path', () => {
      const cyclicalDeps = [
        ...sampleDependencies,
        {
          serviceId: 'svc_power',
          upstreamDependencies: ['svc_water'], // Introduces cycle: water -> power -> water
        },
      ];

      const result = detectDependencyCycles(sampleServices, cyclicalDeps);
      expect(result.hasCycle).toBe(true);
      expect(result.cyclePath.length).toBeGreaterThan(1);
      expect(result.cycleDescription).toContain('➔');
    });
  });

  describe('Topological Recovery Sequencing', () => {
    it('schedules upstream dependencies before downstream dependent services', () => {
      const sequence = calculateRecoverySequence(sampleServices, sampleDependencies);
      expect(sequence.length).toBe(sampleServices.length);

      const powerPhase = sequence.find((s) => s.serviceId === 'svc_power').phase;
      const scadaPhase = sequence.find((s) => s.serviceId === 'svc_scada').phase;
      const waterPhase = sequence.find((s) => s.serviceId === 'svc_water').phase;

      expect(powerPhase).toBeLessThanOrEqual(scadaPhase);
      expect(scadaPhase).toBeLessThanOrEqual(waterPhase);
      expect(powerPhase).toBeLessThan(waterPhase);
    });

    it('falls back deterministically when a cycle is present', () => {
      const cyclicalDeps = [
        ...sampleDependencies,
        { serviceId: 'svc_power', upstreamDependencies: ['svc_water'] },
      ];

      const sequence = calculateRecoverySequence(sampleServices, cyclicalDeps);
      expect(sequence.length).toBe(sampleServices.length);
      // Tier 1 critical services appear first in deterministic fallback
      expect(sequence[0].criticality).toBe('TIER_1_CRITICAL');
    });
  });

  describe('Cascading Blast Radius Analysis', () => {
    it('identifies all downstream services impacted by an upstream node failure', () => {
      const blast = calculateCascadingBlastRadius('svc_power', sampleServices, sampleDependencies);
      expect(blast.impactedCount).toBe(2);
      expect(blast.impactedServiceIds).toContain('svc_water');
      expect(blast.impactedServiceIds).toContain('svc_scada');
      expect(blast.affectedCriticalCount).toBe(1); // svc_water is TIER_1_CRITICAL
    });

    it('returns empty blast radius for leaf node with 0 dependents', () => {
      const blast = calculateCascadingBlastRadius('svc_water', sampleServices, sampleDependencies);
      expect(blast.impactedCount).toBe(0);
      expect(blast.impactedServiceIds).toEqual([]);
    });
  });

  describe('Explainable Recommendation Generation', () => {
    it('flags Single Point of Failure (SPOF) with explainable rationales and contributing fields', () => {
      const recs = generateExplainableRecommendations({
        services: sampleServices,
        dependencies: sampleDependencies,
        recoveryObjectives: { rtoHours: 4, rpoHours: 1 },
      });

      const spofRec = recs.find(
        (r) => r.type === RECOMMENDATION_TYPES.SINGLE_POINT_OF_FAILURE && r.targetServiceId === 'svc_power'
      );

      expect(spofRec).toBeDefined();
      expect(spofRec.rulesetVersion).toBe(RULESET_VERSION);
      expect(spofRec.severity).toBe('HIGH');
      expect(spofRec.rationale).toContain('Substation Grid');
      expect(spofRec.contributingFields).toEqual(
        expect.arrayContaining(['dependentsCount', 'criticality', 'redundantAlternative'])
      );
      expect(spofRec.status).toBe(RECOMMENDATION_STATUS.PENDING);
      expect(spofRec.requiresHumanSignoff).toBe(true);
    });

    it('flags recovery gap when estimated restoration time exceeds target RTO', () => {
      const recs = generateExplainableRecommendations({
        services: sampleServices,
        dependencies: sampleDependencies,
        recoveryObjectives: { rtoHours: 4, rpoHours: 1 },
      });

      const gapRec = recs.find(
        (r) => r.type === RECOMMENDATION_TYPES.RECOVERY_GAP_EXCEEDED && r.targetServiceId === 'svc_power'
      );

      expect(gapRec).toBeDefined();
      expect(gapRec.rationale).toContain('exceeds the designated plan Recovery Time Objective');
      expect(gapRec.contributingFields).toContain('recoveryObjectives.rtoHours');
    });

    it('flags missing manual offline fallback procedure for critical services', () => {
      const recs = generateExplainableRecommendations({
        services: sampleServices,
        dependencies: sampleDependencies,
        recoveryObjectives: { rtoHours: 4, rpoHours: 1 },
      });

      const fallbackRec = recs.find(
        (r) => r.type === RECOMMENDATION_TYPES.MISSING_MANUAL_FALLBACK && r.targetServiceId === 'svc_power'
      );

      expect(fallbackRec).toBeDefined();
      expect(fallbackRec.rationale).toContain('does not have a documented manual paper-based or offline fallback');
      expect(fallbackRec.contributingFields).toContain('manualFallbackProcedure');
    });
  });
});
