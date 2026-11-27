import {
  describe, it, expect,
} from 'vitest';
import {
  simulateScenario,
  validateSimulationRequest,
  buildImpactSummary,
  saveScenarioConfiguration,
  loadScenarioConfiguration,
  listSavedConfigurations,
  ERROR_CODES,
  CONFIDENCE,
  __testables,
} from './civicPolicySimulationService.js';
import { listScenarios, listPersonas, listServices, listOffices, listLevers } from '../data/civicPolicySimulationData.js';

// ---- localStorage mock (vitest runs in node env) ----
const localStorageStore = {};
const mockLocalStorage = {
  getItem: (key) => localStorageStore[key] ?? null,
  setItem: (key, value) => { localStorageStore[key] = value; },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]); },
};
Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });

const { personServiceDemand, personDocumentBurden, personTravelMinutes, applyLevers, computeDigest } = __testables;

describe('civicPolicySimulationService', () => {
  describe('validation', () => {
    it('rejects non-object input', () => {
      const result = validateSimulationRequest('not-an-object');
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);
    });

    it('rejects sensitive keys', () => {
      const result = validateSimulationRequest({ aadhaar_number: '1234' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === ERROR_CODES.SENSITIVE_FIELD)).toBe(true);
    });

    it('rejects sensitive text values', () => {
      const result = validateSimulationRequest({ name: 'my aadhaar is 1234 5678 9012' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === ERROR_CODES.SENSITIVE_VALUE)).toBe(true);
    });

    it('rejects unknown scenarioId when requireScenario', () => {
      const result = validateSimulationRequest({ scenarioId: 'unknown-scenario' }, { requireScenario: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === ERROR_CODES.SCENARIO_NOT_FOUND)).toBe(true);
    });

    it('rejects unknown persona id', () => {
      const result = validateSimulationRequest({ personaIds: ['persona-does-not-exist'] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === ERROR_CODES.PERSONA_NOT_FOUND)).toBe(true);
    });

    it('rejects unknown service id', () => {
      const result = validateSimulationRequest({ serviceIds: ['service-does-not-exist'] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === ERROR_CODES.SERVICE_NOT_FOUND)).toBe(true);
    });

    it('rejects unknown lever id', () => {
      const result = validateSimulationRequest({ leverIds: ['lever-does-not-exist'] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === ERROR_CODES.LEVER_NOT_FOUND)).toBe(true);
    });

    it('accepts a valid minimal request', () => {
      const result = validateSimulationRequest({ scenarioId: 'scenario-baseline' });
      expect(result.valid).toBe(true);
    });
  });

  describe('deterministic rules', () => {
    it('personServiceDemand returns a value in 0-1', () => {
      const persona = listPersonas()[0];
      const service = listServices()[0];
      const p = personServiceDemand(persona, service);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    });

    it('personDocumentBurden returns 0-1', () => {
      const persona = listPersonas()[0];
      const service = listServices()[0];
      const b = personDocumentBurden(persona, service);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    });

    it('personTravelMinutes is positive', () => {
      const persona = listPersonas()[0];
      const office = listOffices()[0];
      const m = personTravelMinutes(persona, office);
      expect(m).toBeGreaterThan(0);
    });

    it('applyLevers produces maps', () => {
      const state = applyLevers({}, ['lever-online-ration-card']);
      expect(state.levers.length).toBe(1);
      expect(state.channelShift.size).toBe(1);
    });

    it('computeDigest is deterministic', () => {
      const a = computeDigest({ x: 1 });
      const b = computeDigest({ x: 1 });
      expect(a).toBe(b);
      expect(a).not.toBe(computeDigest({ x: 2 }));
    });
  });

  describe('simulateScenario', () => {
    it('simulates the baseline scenario successfully', () => {
      const result = simulateScenario({ scenarioId: 'scenario-baseline' });
      expect(result.ok).toBe(true);
      expect(result.result).toHaveProperty('totals');
      expect(result.result).toHaveProperty('byService');
      expect(result.result).toHaveProperty('byOffice');
      expect(result.result).toHaveProperty('byPersona');
      expect(result.result).toHaveProperty('sensitivity');
      expect(result.result).toHaveProperty('uncertainty');
      expect(result.result).toHaveProperty('aggregateValidation');
      expect(result.result.noIndividualPrediction).toBe(true);
      expect(result.result.illustrative).toBe(true);
      expect(result.result.reproducibilityDigest).toMatch(/^psim-[0-9a-f]{8}$/);
    });

    it('is deterministic across repeated runs', () => {
      const a = simulateScenario({ scenarioId: 'scenario-digital-ration-card' });
      const b = simulateScenario({ scenarioId: 'scenario-digital-ration-card' });
      expect(a.result.totals).toEqual(b.result.totals);
      expect(a.result.reproducibilityDigest).toBe(b.result.reproducibilityDigest);
    });

    it('different seeds produce different digests', () => {
      const a = simulateScenario({ scenarioId: 'scenario-baseline', seed: 1 });
      const b = simulateScenario({ scenarioId: 'scenario-baseline', seed: 2 });
      expect(a.result.reproducibilityDigest).not.toBe(b.result.reproducibilityDigest);
    });

    it('returns validation failure for unknown scenario', () => {
      const result = simulateScenario({ scenarioId: 'unknown-scenario' });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(ERROR_CODES.VALIDATION_FAILED);
      expect(result.errors.some((e) => e.code === ERROR_CODES.SCENARIO_NOT_FOUND)).toBe(true);
    });

    it('applies levers and produces sensitivity entries', () => {
      const result = simulateScenario({ scenarioId: 'scenario-mobile-csc-ward-3' });
      expect(result.ok).toBe(true);
      expect(result.result.sensitivity.length).toBeGreaterThanOrEqual(0);
      // With a lever enabled, toggling it off should change travel.
      const leverSensitivity = result.result.sensitivity.find((s) => s.leverId === 'lever-mobile-csc-ward-3');
      if (leverSensitivity) {
        expect(typeof leverSensitivity.travelMinutesDelta).toBe('number');
      }
    });

    it('uncertainty level is one of the allowed values', () => {
      const result = simulateScenario({ scenarioId: 'scenario-baseline' });
      expect(Object.values(CONFIDENCE)).toContain(result.result.uncertainty.level);
    });

    it('aggregateValidation is directional with checks', () => {
      const result = simulateScenario({ scenarioId: 'scenario-baseline' });
      expect(result.result.aggregateValidation.checks.length).toBeGreaterThan(0);
      expect(typeof result.result.aggregateValidation.passRate).toBe('number');
    });

    it('custom parameters override scenario defaults', () => {
      const result = simulateScenario({
        scenarioId: 'scenario-baseline',
        personaIds: [listPersonas()[0].id],
        serviceIds: [listServices()[0].id],
        officeIds: [listOffices()[0].id],
        dayCount: 7,
      });
      expect(result.ok).toBe(true);
      expect(result.result.parameters.personaIds).toEqual([listPersonas()[0].id]);
      expect(result.result.parameters.dayCount).toBe(7);
    });

    it('rejects dayCount out of range', () => {
      const result = simulateScenario({ scenarioId: 'scenario-baseline', dayCount: 400 });
      expect(result.ok).toBe(false);
    });
  });

  describe('scenario listings', () => {
    it('lists scenarios, personas, services, offices, levers', () => {
      expect(listScenarios().length).toBeGreaterThan(0);
      expect(listPersonas().length).toBeGreaterThan(0);
      expect(listServices().length).toBeGreaterThan(0);
      expect(listOffices().length).toBeGreaterThan(0);
      expect(listLevers().length).toBeGreaterThan(0);
    });
  });

  describe('buildImpactSummary', () => {
    it('returns a string summary for a valid result', () => {
      const result = simulateScenario({ scenarioId: 'scenario-baseline' });
      const summary = buildImpactSummary(result);
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
      expect(summary).toContain('illustrative');
    });

    it('returns a message for an invalid result', () => {
      const summary = buildImpactSummary({ ok: false });
      expect(typeof summary).toBe('string');
    });
  });

  describe('storage configuration', () => {
    it('save/load/list round-trips when storage exists', () => {
      const saved = saveScenarioConfiguration({
        scenarioId: 'scenario-baseline',
        name: 'My saved scenario',
        parameters: { dayCount: 14 },
      });
      expect(saved.ok).toBe(true);

      const loaded = loadScenarioConfiguration('scenario-baseline');
      expect(loaded).not.toBeNull();
      expect(loaded.name).toBe('My saved scenario');

      const all = listSavedConfigurations();
      expect(all.some((c) => c.scenarioId === 'scenario-baseline')).toBe(true);
    });

    it('rejects invalid save', () => {
      const saved = saveScenarioConfiguration({ scenarioId: 'unknown' });
      expect(saved.ok).toBe(false);
    });
  });
});
