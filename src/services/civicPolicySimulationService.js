/**
 * src/services/civicPolicySimulationService.js
 *
 * Deterministic agent-based simulation engine for the Civic Policy Scenario
 * Simulator (#1176).
 *
 * Design rules:
 * - All simulation, ordering, aggregation and sensitivity math is plain code,
 *   never delegated to an AI model. AI may only label suggested scenario
 *   levers as untrusted suggestions with full provenance.
 * - Outputs are aggregate only. No individual persona is ever singled out,
 *   tracked across runs, or used to predict an individual citizen outcome.
 * - Synthetic personas and fixtures only. Zero production PII, credentials,
 *   raw documents or sensitive prompts are logged or returned.
 * - Explicit human approval is required for any high-impact action. The
 *   simulator never files applications, denies benefits or claims official
 *   verification.
 * - All results carry schema version, data version, review date and a
 *   reproducibility digest.
 */

import {
  CIVIC_POLICY_SIMULATION_SCHEMA_VERSION,
  CIVIC_POLICY_SIMULATION_REVIEW_DATE,
  CIVIC_POLICY_SIMULATION_STALE_AFTER_DAYS,
  CIVIC_POLICY_SIMULATION_DISCLAIMER,
  AGGREGATE_PUBLIC_STATS,
  TRAVEL_BURDEN_MINUTES,
  getPersona,
  getService,
  getOffice,
  getLever,
  getScenario,
} from '../data/civicPolicySimulationData.js';

export const POLICY_SIMULATION_STORAGE_KEY = 'civicbridge_policy_simulation_scenario_v1';

export const SIMULATION_STATUS = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETE: 'complete',
  ERROR: 'error',
  STALE: 'stale',
});

export const CONFIDENCE = Object.freeze({
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
});

export const ERROR_CODES = Object.freeze({
  INVALID_REQUEST: 'PS_INVALID_REQUEST',
  INVALID_TYPE: 'PS_INVALID_TYPE',
  SCENARIO_NOT_FOUND: 'PS_SCENARIO_NOT_FOUND',
  LEVER_NOT_FOUND: 'PS_LEVER_NOT_FOUND',
  PERSONA_NOT_FOUND: 'PS_PERSONA_NOT_FOUND',
  SERVICE_NOT_FOUND: 'PS_SERVICE_NOT_FOUND',
  OFFICE_NOT_FOUND: 'PS_OFFICE_NOT_FOUND',
  VALIDATION_FAILED: 'PS_VALIDATION_FAILED',
  SENSITIVE_FIELD: 'PS_SENSITIVE_FIELD',
  SENSITIVE_VALUE: 'PS_SENSITIVE_VALUE',
  STALE_DATA: 'PS_STALE_DATA',
  CONCURRENT_WRITE: 'PS_CONCURRENT_WRITE',
  STORAGE_UNAVAILABLE: 'PS_STORAGE_UNAVAILABLE',
});

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|otp|one.?time|token|secret|credential|api.?key|private.?key|aadhaar.?number|aadhaar.?no|pan.?number|document.?content|file.?content|file.?data|base64|biometric|passphrase|authorization|salary|income.?amount|mobile.?number|phone.?number)/i;

const AADHAAR_NUMBER_PATTERN = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_NUMBER_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;
const OTP_PATTERN = /\b(?:otp|one[- ]time password)\b\s*[:#-]?\s*\d{4,8}\b/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PERSONAS = 200;
const MAX_SERVICES = 100;
const MAX_OFFICES = 100;
const MAX_LEVERS = 50;
const MAX_SCENARIO_NAME = 200;
const MAX_DESCRIPTION = 2000;
const AGGREGATE_TOLERANCE_PCT = 0.25; // 25% tolerance for aggregate validation

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isSlug = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 120 && SLUG_PATTERN.test(value);

const unique = (items) => Array.from(new Set(items));

function findSensitiveKeys(value, path = '', depth = 0, found = []) {
  if (depth > 8) return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => findSensitiveKeys(item, `${path}[${index}]`, depth + 1, found));
    return found;
  }
  if (!isObject(value)) return found;
  for (const [key, child] of Object.entries(value)) {
    const where = path ? `${path}.${key}` : key;
    if (SENSITIVE_KEY_PATTERN.test(key)) found.push(where);
    findSensitiveKeys(child, where, depth + 1, found);
  }
  return found;
}

function collectSensitiveText(value, path = '', depth = 0, found = []) {
  if (depth > 8) return found;
  if (typeof value === 'string') {
    if (AADHAAR_NUMBER_PATTERN.test(value)) found.push(`${path}: Aadhaar-like number`);
    else if (PAN_NUMBER_PATTERN.test(value)) found.push(`${path}: PAN-like number`);
    else if (OTP_PATTERN.test(value)) found.push(`${path}: OTP-like value`);
    return found;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectSensitiveText(item, `${path}[${index}]`, depth + 1, found));
    return found;
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      collectSensitiveText(child, path ? `${path}.${key}` : key, depth + 1, found);
    }
  }
  return found;
}

/**
 * Validate a simulation request at the trust boundary. Both client and server
 * call this so malformed or unsafe requests fail identically.
 */
export function validateSimulationRequest(input = {}, { requireScenario = false } = {}) {
  const errors = [];
  const fail = (field, code, message) => errors.push({ field, code, message });

  if (!isObject(input)) {
    return {
      valid: false,
      errors: [{ field: '(request)', code: ERROR_CODES.INVALID_TYPE, message: 'Request must be a JSON object.' }],
    };
  }

  const sensitiveKeys = findSensitiveKeys(input);
  for (const where of sensitiveKeys) {
    fail(where, ERROR_CODES.SENSITIVE_FIELD, 'Do not send passwords, OTPs, document numbers, income amounts or phone numbers.');
  }
  const sensitiveText = collectSensitiveText(input);
  for (const where of sensitiveText) {
    fail(where, ERROR_CODES.SENSITIVE_VALUE, 'Remove identity numbers, OTPs, income amounts and phone numbers from the request.');
  }

  if (input.scenarioId !== undefined && !isSlug(input.scenarioId)) {
    fail('scenarioId', ERROR_CODES.INVALID_TYPE, 'scenarioId must be a lowercase slug.');
  }
  if (requireScenario && input.scenarioId && !getScenario(input.scenarioId)) {
    fail('scenarioId', ERROR_CODES.SCENARIO_NOT_FOUND, 'No reviewed scenario exists for this scenario id.');
  }

  if (input.name !== undefined) {
    if (typeof input.name !== 'string' || input.name.trim().length === 0 || input.name.length > MAX_SCENARIO_NAME) {
      fail('name', ERROR_CODES.INVALID_TYPE, `name must be a non-empty string up to ${MAX_SCENARIO_NAME} characters.`);
    }
  }

  if (input.description !== undefined) {
    if (typeof input.description !== 'string' || input.description.length > MAX_DESCRIPTION) {
      fail('description', ERROR_CODES.INVALID_TYPE, `description must be a string up to ${MAX_DESCRIPTION} characters.`);
    }
  }

  if (input.personaIds !== undefined) {
    if (!Array.isArray(input.personaIds) || input.personaIds.length === 0 || input.personaIds.length > MAX_PERSONAS) {
      fail('personaIds', ERROR_CODES.INVALID_TYPE, `personaIds must be an array of 1 to ${MAX_PERSONAS} persona ids.`);
    } else {
      input.personaIds.forEach((id, index) => {
        if (!isSlug(id) || !getPersona(id)) {
          fail(`personaIds[${index}]`, ERROR_CODES.PERSONA_NOT_FOUND, `Unknown persona id "${id}".`);
        }
      });
    }
  }

  if (input.serviceIds !== undefined) {
    if (!Array.isArray(input.serviceIds) || input.serviceIds.length === 0 || input.serviceIds.length > MAX_SERVICES) {
      fail('serviceIds', ERROR_CODES.INVALID_TYPE, `serviceIds must be an array of 1 to ${MAX_SERVICES} service ids.`);
    } else {
      input.serviceIds.forEach((id, index) => {
        if (!isSlug(id) || !getService(id)) {
          fail(`serviceIds[${index}]`, ERROR_CODES.SERVICE_NOT_FOUND, `Unknown service id "${id}".`);
        }
      });
    }
  }

  if (input.officeIds !== undefined) {
    if (!Array.isArray(input.officeIds) || input.officeIds.length === 0 || input.officeIds.length > MAX_OFFICES) {
      fail('officeIds', ERROR_CODES.INVALID_TYPE, `officeIds must be an array of 1 to ${MAX_OFFICES} office ids.`);
    } else {
      input.officeIds.forEach((id, index) => {
        if (!isSlug(id) || !getOffice(id)) {
          fail(`officeIds[${index}]`, ERROR_CODES.OFFICE_NOT_FOUND, `Unknown office id "${id}".`);
        }
      });
    }
  }

  if (input.leverIds !== undefined) {
    if (!Array.isArray(input.leverIds) || input.leverIds.length > MAX_LEVERS) {
      fail('leverIds', ERROR_CODES.INVALID_TYPE, `leverIds must be an array of up to ${MAX_LEVERS} lever ids.`);
    } else {
      input.leverIds.forEach((id, index) => {
        if (!isSlug(id) || !getLever(id)) {
          fail(`leverIds[${index}]`, ERROR_CODES.LEVER_NOT_FOUND, `Unknown lever id "${id}".`);
        }
      });
    }
  }

  if (input.dayCount !== undefined) {
    if (!Number.isInteger(input.dayCount) || input.dayCount < 1 || input.dayCount > 365) {
      fail('dayCount', ERROR_CODES.INVALID_TYPE, 'dayCount must be an integer between 1 and 365.');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Deterministic pseudo-random generator seeded by scenario id + seed, so the
 * same inputs always produce the same simulation outputs.
 */
function seededRandom(seed) {
  let state = ((seed >>> 0) || 0) + 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state >>> 0) / 0xffffffff;
  };
}

/**
 * Baseline per-persona service demand probability (0-1), derived only from
 * archetype attributes and service properties. Pure rule, no AI.
 */
function personServiceDemand(persona, service) {
  let p = 0.05; // floor
  if (service.category === 'certificate') p += 0.10;
  if (service.category === 'entitlement') p += 0.15;
  if (service.category === 'pension' && persona.archetype === 'elderly') p += 0.20;
  if (service.category === 'licence' && persona.archetype === 'working-adult') p += 0.10;
  if (service.onlineAvailable && persona.digitalLiteracy === 'high') p += 0.10;
  if (!service.onlineAvailable && persona.digitalLiteracy === 'low') p += 0.05;
  if (service.travelToOfficeRequired && persona.officeVisitPreference === 'in-person') p += 0.10;
  if (service.travelToOfficeRequired && persona.travelBurden === 'very-high') p -= 0.10;
  if (persona.documentReadiness === 'low' && service.documentRequirements.length > 2) p -= 0.05;
  return Math.min(0.95, Math.max(0.01, p));
}

/**
 * Document burden score for a persona on a service (0-1, higher = harder).
 */
function personDocumentBurden(persona, service) {
  const required = service.documentRequirements.length;
  const ready = persona.documentReadiness;
  let score = required / 6; // normalise to 0-1
  if (ready === 'low') score += 0.2;
  if (ready === 'medium') score += 0.1;
  return Math.min(1, Math.max(0, score));
}

/**
 * Travel burden minutes for a persona at an office (one way).
 */
function personTravelMinutes(persona, office) {
  const base = TRAVEL_BURDEN_MINUTES[office.id] ?? 40;
  let minutes = base;
  if (persona.travelBurden === 'very-high') minutes *= 1.25;
  if (persona.travelBurden === 'high') minutes *= 1.1;
  if (persona.travelBurden === 'low') minutes *= 0.8;
  return Math.round(minutes);
}

/**
 * Apply policy levers deterministically to a scenario state. Returns mutated
 * service demand multipliers, travel adjustments and document adjustments.
 */
function applyLevers(state, leverIds) {
  const levers = leverIds.map((id) => getLever(id)).filter(Boolean);
  const travelAdjustment = new Map(); // officeId -> minutes reduction
  const capacityAdjustment = new Map(); // officeId -> multiplier
  const documentAdjustment = new Map(); // serviceId -> requirement reduction
  const channelShift = new Map(); // serviceId -> online share increase

  for (const lever of levers) {
    const effect = lever.effect;
    switch (effect.type) {
      case 'travel_reduction':
        if (effect.officeId && travelAdjustment.has(effect.officeId)) {
          travelAdjustment.set(effect.officeId, travelAdjustment.get(effect.officeId) + effect.travelMinutesReduction);
        } else if (effect.officeId) {
          travelAdjustment.set(effect.officeId, effect.travelMinutesReduction);
        }
        break;
      case 'capacity_increase':
        if (effect.officeId) {
          capacityAdjustment.set(effect.officeId, effect.dailyCapacityMultiplier ?? 1.0);
        }
        break;
      case 'document_bundle':
        if (effect.documentRequirementReduction) {
          (effect.appliesToServiceIds || []).forEach((sid) => {
            documentAdjustment.set(sid, (documentAdjustment.get(sid) || 0) + effect.documentRequirementReduction);
          });
        }
        break;
      case 'channel_shift':
        if (effect.serviceId) {
          channelShift.set(effect.serviceId, effect.onlineShareIncrease ?? 0);
        }
        break;
      default:
        // Unknown lever types are ignored rather than guessed at.
        break;
    }
  }

  return { levers, travelAdjustment, capacityAdjustment, documentAdjustment, channelShift };
}

/**
 * Core deterministic simulation. Produces aggregate results only.
 */
export function simulateScenario({
  scenarioId,
  personaIds,
  serviceIds,
  officeIds,
  leverIds = [],
  dayCount = 30,
  seed = null,
  today = new Date(),
} = {}) {
  const validation = validateSimulationRequest(
    { scenarioId, personaIds, serviceIds, officeIds, leverIds, dayCount },
    { requireScenario: true }
  );
  if (!validation.valid) {
    return {
      ok: false,
      error: { code: ERROR_CODES.VALIDATION_FAILED, message: 'The simulation request is not valid.' },
      errors: validation.errors,
    };
  }

  const scenario = getScenario(scenarioId);
  if (!scenario) {
    return {
      ok: false,
      error: { code: ERROR_CODES.SCENARIO_NOT_FOUND, message: 'Unknown scenario id.' },
      errors: [{ field: 'scenarioId', code: ERROR_CODES.SCENARIO_NOT_FOUND, message: 'Unknown scenario id.' }],
    };
  }

  const effectivePersonaIds = unique(personaIds || scenario.personaIds);
  const effectiveServiceIds = unique(serviceIds || scenario.serviceIds);
  const effectiveOfficeIds = unique(officeIds || scenario.officeIds);

  const personas = effectivePersonaIds.map(getPersona).filter(Boolean);
  const services = effectiveServiceIds.map(getService).filter(Boolean);
  const offices = effectiveOfficeIds.map(getOffice).filter(Boolean);

  const usedSeed = seed != null ? Number(seed) : scenario.defaultSeed ?? 20261120;
  const rand = seededRandom(String(usedSeed) + scenarioId);

  const { levers, travelAdjustment, capacityAdjustment, channelShift } = applyLevers({}, leverIds);

  // Per-service aggregate results.
  const serviceResults = [];
  let totalTravelMinutes = 0;
  let totalInPersonVisits = 0;
  let totalOnlineDemand = 0;
  let totalDocumentBurden = 0;

  for (const service of services) {
    let serviceDemand = 0;
    let serviceInPerson = 0;
    let serviceOnline = 0;
    let serviceTravelMinutes = 0;
    let serviceDocumentBurdenSum = 0;

    const onlineShareBoost = channelShift.get(service.id) ?? 0;

    for (const persona of personas) {
      const baseProb = personServiceDemand(persona, service);
      // Deterministic jitter so identical archetypes still vary slightly.
      const jitter = (rand() - 0.5) * 0.04;
      let demandProb = Math.min(0.98, Math.max(0.01, baseProb + jitter));

      // Channel shift: online-available services move some demand online.
      let onlineProb = 0;
      if (service.onlineAvailable) {
        onlineProb = Math.min(0.9, 0.25 + onlineShareBoost + (persona.digitalLiteracy === 'high' ? 0.3 : 0));
      }

      const inPersonProb = demandProb * (1 - onlineProb);
      const onlineProbAdj = demandProb * onlineProb;

      serviceDemand += demandProb;
      serviceInPerson += inPersonProb;
      serviceOnline += onlineProbAdj;

      // Travel burden only for in-person visits at travel-required services.
      if (service.travelToOfficeRequired && inPersonProb > 0) {
        // Assign persona to the nearest configured office for this service.
        const office = offices[0] || null;
        if (office) {
          let minutes = personTravelMinutes(persona, office);
          const reduction = travelAdjustment.get(office.id) ?? 0;
          minutes = Math.max(0, minutes - reduction);
          serviceTravelMinutes += minutes * inPersonProb;
          totalTravelMinutes += minutes * inPersonProb;
        }
        totalInPersonVisits += inPersonProb;
      }

      totalOnlineDemand += onlineProbAdj;
      serviceDocumentBurdenSum += personDocumentBurden(persona, service);
      totalDocumentBurden += personDocumentBurden(persona, service);
    }

    const capacityMultiplier = capacityAdjustment.get(service.id) ?? 1.0;
    serviceResults.push({
      serviceId: service.id,
      serviceName: service.name,
      category: service.category,
      estimatedDailyDemand: Number(serviceDemand.toFixed(2)),
      estimatedDailyInPersonVisits: Number(serviceInPerson.toFixed(2)),
      estimatedDailyOnlineDemand: Number(serviceOnline.toFixed(2)),
      estimatedDailyTravelMinutes: Number(serviceTravelMinutes.toFixed(2)),
      averageDocumentBurden: Number((serviceDocumentBurdenSum / Math.max(1, personas.length)).toFixed(3)),
      onlineShare: serviceDemand > 0 ? Number(((serviceOnline / serviceDemand) * 100).toFixed(1)) : 0,
      capacityMultiplier,
    });
  }

  const officeResults = offices.map((office) => {
    const reduction = travelAdjustment.get(office.id) ?? 0;
    const capacity = capacityAdjustment.get(office.id) ?? 1.0;
    return {
      officeId: office.id,
      officeName: office.name,
      baseTravelMinutes: TRAVEL_BURDEN_MINUTES[office.id] ?? 40,
      adjustedTravelMinutes: Math.max(0, (TRAVEL_BURDEN_MINUTES[office.id] ?? 40) - reduction),
      travelMinutesReduction: reduction,
      capacityMultiplier: capacity,
    };
  });

  const personaResults = personas.map((persona) => {
    // Aggregate-only persona summary: no individual prediction, no tracking id.
    let demand = 0;
    let travel = 0;
    let docs = 0;
    for (const service of services) {
      demand += personServiceDemand(persona, service);
      docs += personDocumentBurden(persona, service);
    }
    const office = offices[0] || null;
    if (office) {
      travel = Math.max(0, personTravelMinutes(persona, office) - (travelAdjustment.get(office.id) ?? 0));
    }
    return {
      personaId: persona.id,
      archetype: persona.archetype,
      label: persona.label,
      estimatedDemand: Number(demand.toFixed(2)),
      averageTravelMinutes: Number(travel.toFixed(1)),
      averageDocumentBurden: Number((docs / Math.max(1, services.length)).toFixed(3)),
    };
  });

  const totalEstimatedDailyDemand = serviceResults.reduce((s, r) => s + r.estimatedDailyDemand, 0);
  const totalEstimatedDailyTravelMinutes = serviceResults.reduce((s, r) => s + r.estimatedDailyTravelMinutes, 0);

  // Sensitivity analysis: toggle each enabled lever off one at a time and measure delta.
  const sensitivity = [];
  for (const lever of levers) {
    const without = simulateScenario({
      scenarioId,
      personaIds: effectivePersonaIds,
      serviceIds: effectiveServiceIds,
      officeIds: effectiveOfficeIds,
      leverIds: leverIds.filter((id) => id !== lever.id),
      dayCount,
      seed: usedSeed,
      today,
    });
    if (!without.ok) continue;
    const baselineTravel = totalEstimatedDailyTravelMinutes;
    const withoutTravel = without.result.totalEstimatedDailyTravelMinutes ?? 0;
    const baselineDemand = totalEstimatedDailyDemand;
    const withoutDemand = without.result.totalEstimatedDailyDemand ?? 0;
    sensitivity.push({
      leverId: lever.id,
      leverLabel: lever.label,
      travelMinutesDelta: Number((baselineTravel - withoutTravel).toFixed(2)),
      demandDelta: Number((baselineDemand - withoutDemand).toFixed(2)),
      note: lever.riskNote,
    });
  }

  // Uncertainty band based on data staleness and source confidence.
  const isStale = isScenarioDataStale(today);
  const aggregateConfidence = AGGREGATE_PUBLIC_STATS.reduce(
    (acc, s) => (s.confidence === 'low' ? acc + 1 : acc),
    0
  );
  const uncertainty = isStale
    ? CONFIDENCE.LOW
    : aggregateConfidence > 0
      ? CONFIDENCE.MEDIUM
      : CONFIDENCE.HIGH;

  // Validate against aggregate public stats (directional only, tolerance-based).
  const aggregateValidationResult = validateAgainstAggregateStats(totalEstimatedDailyDemand, totalTravelMinutes / Math.max(1, dayCount));

  const result = {
    schemaVersion: CIVIC_POLICY_SIMULATION_SCHEMA_VERSION,
    dataVersion: CIVIC_POLICY_SIMULATION_REVIEW_DATE,
    reviewDate: CIVIC_POLICY_SIMULATION_REVIEW_DATE,
    staleAfterDays: CIVIC_POLICY_SIMULATION_STALE_AFTER_DAYS,
    isStale,
    scenario: {
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      expectedDirectionalEffects: scenario.expectedDirectionalEffects,
    },
    parameters: {
      personaIds: effectivePersonaIds,
      serviceIds: effectiveServiceIds,
      officeIds: effectiveOfficeIds,
      leverIds: levers.map((l) => l.id),
      dayCount,
      seed: usedSeed,
    },
    reproducibilityDigest: computeDigest({
      scenarioId,
      personaIds: effectivePersonaIds,
      serviceIds: effectiveServiceIds,
      officeIds: effectiveOfficeIds,
      leverIds: levers.map((l) => l.id),
      dayCount,
      seed: usedSeed,
    }),
    totals: {
      estimatedDailyDemand: Number(totalEstimatedDailyDemand.toFixed(2)),
      estimatedDailyInPersonVisits: Number(totalInPersonVisits.toFixed(2)),
      estimatedDailyOnlineDemand: Number(totalOnlineDemand.toFixed(2)),
      estimatedDailyTravelMinutes: Number(totalEstimatedDailyTravelMinutes.toFixed(2)),
      averageDocumentBurden: Number((totalDocumentBurden / Math.max(1, personas.length)).toFixed(3)),
    },
    byService: serviceResults,
    byOffice: officeResults,
    byPersona: personaResults,
    sensitivity,
    uncertainty: {
      level: uncertainty,
      isStale,
      lowConfidenceStatCount: aggregateConfidence,
      message: uncertaintyMessage(uncertainty, isStale),
    },
    aggregateValidation: aggregateValidationResult,
    disclaimer: CIVIC_POLICY_SIMULATION_DISCLAIMER,
    illustrative: true,
    noIndividualPrediction: true,
  };

  return { ok: true, result };
}

/**
 * Compare simulated totals against aggregate public stats within tolerance.
 * Directional only; never treats the sim as authoritative.
 */
function validateAgainstAggregateStats(simulatedDailyDemand, simulatedAvgTravelMinutes) {
  const checks = [];
  let passed = 0;

  for (const stat of AGGREGATE_PUBLIC_STATS) {
    let simValue = null;
    if (stat.metric === 'applications_per_day') simValue = simulatedDailyDemand;
    if (stat.metric === 'travel_minutes_one_way') simValue = simulatedAvgTravelMinutes;
    if (simValue === null) continue;

    const tolerance = Math.abs(stat.value) * AGGREGATE_TOLERANCE_PCT;
    const diff = Math.abs(simValue - stat.value);
    const within = diff <= tolerance;
    if (within) passed += 1;
    checks.push({
      statId: stat.id,
      label: stat.label,
      metric: stat.metric,
      aggregateValue: stat.value,
      simulatedValue: Number(simValue.toFixed(2)),
      withinTolerance: within,
      tolerancePct: AGGREGATE_TOLERANCE_PCT * 100,
      confidence: stat.confidence,
      source: stat.source,
    });
  }

  return {
    checks,
    passed,
    total: checks.length,
    passRate: checks.length === 0 ? null : Number(((passed / checks.length) * 100).toFixed(1)),
    note:
      'Aggregate validation is directional and tolerance-based. It does not validate the simulator as an official forecast.',
  };
}

function uncertaintyMessage(level, isStale) {
  if (isStale) return 'Data is past its review window. Results are indicative only; confirm with the authority.';
  if (level === CONFIDENCE.LOW) return 'Low-confidence aggregate inputs. Treat results as exploratory, not authoritative.';
  if (level === CONFIDENCE.MEDIUM) return 'Mixed-confidence aggregate inputs. Results are indicative planning bands.';
  return 'Aggregate inputs are reasonably current. Results remain illustrative planning bands, not official forecasts.';
}

function isScenarioDataStale(today = new Date()) {
  const age = daysBetween(CIVIC_POLICY_SIMULATION_REVIEW_DATE, todayIso(today));
  return age !== null && age > CIVIC_POLICY_SIMULATION_STALE_AFTER_DAYS;
}

function daysBetween(fromIso, toIsoValue) {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIsoValue}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.floor((to - from) / 86400000);
}

function todayIso(today) {
  if (today instanceof Date && !Number.isNaN(today.getTime())) return today.toISOString().slice(0, 10);
  if (typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today)) return today;
  return new Date().toISOString().slice(0, 10);
}

/**
 * Stable reproducibility digest over the exact inputs used for a run.
 */
function computeDigest(inputs) {
  const canonical = JSON.stringify(inputs);
  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    const char = canonical.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // convert to 32bit integer
  }
  return `psim-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Save a named scenario configuration to browser storage (non-sensitive ids
 * only). Returns { ok } or { ok: false, errors }.
 */
export function saveScenarioConfiguration({ scenarioId, name, parameters } = {}) {
  const validation = validateSimulationRequest({ scenarioId, name });
  if (!validation.valid) return { ok: false, errors: validation.errors };
  if (!getScenario(scenarioId)) {
    return { ok: false, errors: [{ code: ERROR_CODES.SCENARIO_NOT_FOUND, message: 'Unknown scenario id.' }] };
  }
  if (typeof localStorage === 'undefined') {
    return { ok: false, errors: [{ code: ERROR_CODES.STORAGE_UNAVAILABLE, message: 'Browser storage is unavailable.' }] };
  }
  try {
    const stored = readConfigurations();
    stored[scenarioId] = {
      scenarioId,
      name: name || '',
      parameters,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(POLICY_SIMULATION_STORAGE_KEY, JSON.stringify(stored));
    return { ok: true };
  } catch {
    return { ok: false, errors: [{ code: ERROR_CODES.STORAGE_UNAVAILABLE, message: 'Configuration could not be saved.' }] };
  }
}

function readConfigurations() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(POLICY_SIMULATION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function loadScenarioConfiguration(scenarioId) {
  if (!isSlug(scenarioId)) return null;
  const stored = readConfigurations();
  return stored[scenarioId] || null;
}

export function listSavedConfigurations() {
  return Object.values(readConfigurations());
}

/**
 * Deterministic, human-readable impact summary (never a causal claim).
 */
export function buildImpactSummary(result) {
  if (!result || result.ok !== true) return 'No simulation result to summarise.';
  const { totals, sensitivity, uncertainty, aggregateValidation } = result.result;
  const lines = [];
  lines.push('POLICY SIMULATION IMPACT SUMMARY (illustrative, synthetic)');
  lines.push(`Scenario: ${result.result.scenario.title}`);
  lines.push(`Data version: ${result.result.dataVersion} | Reproducibility: ${result.result.reproducibilityDigest}`);
  lines.push('');
  lines.push('AGGREGATE TOTALS');
  lines.push(`- Estimated daily demand: ${totals.estimatedDailyDemand}`);
  lines.push(`- Estimated daily in-person visits: ${totals.estimatedDailyInPersonVisits}`);
  lines.push(`- Estimated daily online demand: ${totals.estimatedDailyOnlineDemand}`);
  lines.push(`- Estimated daily travel minutes: ${totals.estimatedDailyTravelMinutes}`);
  lines.push(`- Average document burden: ${totals.averageDocumentBurden}`);
  lines.push('');
  lines.push('UNCERTAINTY');
  lines.push(`- Level: ${uncertainty.level}`);
  lines.push(`- ${uncertainty.message}`);
  lines.push('');
  lines.push('SENSITIVITY (per lever toggled off)');
  if (sensitivity.length === 0) lines.push('- No levers enabled.');
  else {
    sensitivity.forEach((s) => {
      lines.push(`- ${s.leverLabel}: travel Δ ${s.travelMinutesDelta} min, demand Δ ${s.demandDelta}`);
    });
  }
  lines.push('');
  lines.push('AGGREGATE VALIDATION');
  lines.push(`- Checks passed: ${aggregateValidation.passed} of ${aggregateValidation.total}`);
  lines.push(`- Pass rate: ${aggregateValidation.passRate}%`);
  lines.push('');
  lines.push(result.result.disclaimer);
  return lines.join('\n');
}

export const __testables = {
  personServiceDemand,
  personDocumentBurden,
  personTravelMinutes,
  applyLevers,
  validateAgainstAggregateStats,
  computeDigest,
  isScenarioDataStale,
  ERROR_CODES,
  CONFIDENCE,
  SIMULATION_STATUS,
};
