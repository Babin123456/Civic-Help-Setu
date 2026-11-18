/**
 * Civic Incident Response Drill & Public Service Continuity Planner Service (#780)
 *
 * Dedicated domain service layer for managing continuity plans, service dependencies,
 * incident drill exercises, after-action reports (AAR), and corrective action items.
 *
 * Separates all domain state machines, validation rules, privacy masking, and audit
 * integration from UI presentation components.
 */

import { getCurrentActor, requirePermission } from './accessControl';
import { sanitizeTextFields } from '../utils/safeContent';
import { appendContinuityAuditLog } from './continuityAuditService';
import {
  generateExplainableRecommendations,
  detectDependencyCycles,
} from './dependencyGraphEngine';

// ---------------------------------------------------------------------------
// STORAGE KEYS & CONSTANTS
// ---------------------------------------------------------------------------

export const STORAGE_KEYS = {
  PLANS: 'civicbridge_continuity_plans_v1',
  SCENARIOS: 'civicbridge_incident_scenarios_v1',
  DEPENDENCIES: 'civicbridge_service_dependencies_v1',
  EXERCISES: 'civicbridge_exercise_runs_v1',
  ACTION_ITEMS: 'civicbridge_action_items_v1',
  RECOMMENDATIONS: 'civicbridge_continuity_recommendations_v1',
};

export const SCHEMA_VERSION = 1;

export const ERROR_CODES = {
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_IDEMPOTENCY: 'DUPLICATE_IDEMPOTENCY',
  CYCLE_DETECTED: 'CYCLE_DETECTED',
  STORAGE_ERROR: 'STORAGE_ERROR',
};

export class ContinuityServiceError extends Error {
  constructor(message, code = ERROR_CODES.VALIDATION_ERROR, details = null) {
    super(message);
    this.name = 'ContinuityServiceError';
    this.code = code;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// DOMAIN STATES & ALLOWED TRANSITIONS
// ---------------------------------------------------------------------------

export const PLAN_STATES = {
  DRAFT: 'DRAFT',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  ACTIVE: 'ACTIVE',
  SUPERSEDED: 'SUPERSEDED',
  ARCHIVED: 'ARCHIVED',
};

export const ALLOWED_PLAN_TRANSITIONS = {
  [PLAN_STATES.DRAFT]: [PLAN_STATES.IN_REVIEW, PLAN_STATES.ARCHIVED],
  [PLAN_STATES.IN_REVIEW]: [PLAN_STATES.APPROVED, PLAN_STATES.DRAFT, PLAN_STATES.ARCHIVED],
  [PLAN_STATES.APPROVED]: [PLAN_STATES.ACTIVE, PLAN_STATES.IN_REVIEW, PLAN_STATES.ARCHIVED],
  [PLAN_STATES.ACTIVE]: [PLAN_STATES.SUPERSEDED, PLAN_STATES.ARCHIVED],
  [PLAN_STATES.SUPERSEDED]: [PLAN_STATES.ARCHIVED, PLAN_STATES.ACTIVE],
  [PLAN_STATES.ARCHIVED]: [], // Terminal state
};

export const EXERCISE_STATES = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  PAUSED: 'PAUSED',
  AAR_REVIEW: 'AAR_REVIEW',
  CLOSED: 'CLOSED',
};

export const ALLOWED_EXERCISE_TRANSITIONS = {
  [EXERCISE_STATES.SCHEDULED]: [EXERCISE_STATES.IN_PROGRESS, EXERCISE_STATES.CLOSED],
  [EXERCISE_STATES.IN_PROGRESS]: [EXERCISE_STATES.PAUSED, EXERCISE_STATES.AAR_REVIEW],
  [EXERCISE_STATES.PAUSED]: [EXERCISE_STATES.IN_PROGRESS, EXERCISE_STATES.AAR_REVIEW],
  [EXERCISE_STATES.AAR_REVIEW]: [EXERCISE_STATES.CLOSED, EXERCISE_STATES.IN_PROGRESS],
  [EXERCISE_STATES.CLOSED]: [], // Immutable after closure
};

export const ACTION_ITEM_STATES = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  IMPLEMENTED: 'IMPLEMENTED',
  VERIFIED: 'VERIFIED',
};

export const ALLOWED_ACTION_TRANSITIONS = {
  [ACTION_ITEM_STATES.OPEN]: [ACTION_ITEM_STATES.IN_PROGRESS],
  [ACTION_ITEM_STATES.IN_PROGRESS]: [ACTION_ITEM_STATES.IMPLEMENTED, ACTION_ITEM_STATES.OPEN],
  [ACTION_ITEM_STATES.IMPLEMENTED]: [ACTION_ITEM_STATES.VERIFIED, ACTION_ITEM_STATES.IN_PROGRESS],
  [ACTION_ITEM_STATES.VERIFIED]: [ACTION_ITEM_STATES.IN_PROGRESS], // Re-openable if audit fails
};

export const CRITICALITY_TIERS = {
  TIER_1_CRITICAL: 'TIER_1_CRITICAL', // Must recover <= 4 hours
  TIER_2_ESSENTIAL: 'TIER_2_ESSENTIAL', // Must recover <= 24 hours
  TIER_3_DEFERRED: 'TIER_3_DEFERRED', // Can defer > 24 hours
};

export const SCENARIO_CATEGORIES = {
  CYBER_ATTACK: 'CYBER_ATTACK',
  INFRASTRUCTURE_FAILURE: 'INFRASTRUCTURE_FAILURE',
  SEVERE_WEATHER: 'SEVERE_WEATHER',
  OFFICE_SYSTEM_OUTAGE: 'OFFICE_SYSTEM_OUTAGE',
};

// ---------------------------------------------------------------------------
// DATA MINIMIZATION & PII REDACTION
// ---------------------------------------------------------------------------

export const maskPhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return '';
  const cleaned = phone.trim();
  if (cleaned.length <= 4) return cleaned;
  return `XXXXXX${cleaned.slice(-4)}`;
};

export const maskEmailAddress = (email) => {
  if (!email || typeof email !== 'string') return '';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return 'xxx@xxx.gov';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? `${name[0]}***${name.slice(-1)}` : '***';
  return `${maskedName}@${domain}`;
};

export const sanitizeContactTree = (contactTree = [], isPrivileged = false) => {
  return (contactTree || []).map((contact) => ({
    role: contact.role || 'Duty Officer',
    officerName: contact.officerName || 'Designated Official',
    phone: isPrivileged ? contact.phone : maskPhoneNumber(contact.phone),
    email: isPrivileged ? contact.email : maskEmailAddress(contact.email),
    priorityOrder: Number(contact.priorityOrder) || 1,
  }));
};

// ---------------------------------------------------------------------------
// LOW-LEVEL STORAGE WRAPPERS & IDEMPOTENCY
// ---------------------------------------------------------------------------

let customStorage = null;
const memoryStore = new Map();

export const setContinuityStorage = (storage) => {
  customStorage = storage;
};

export const clearContinuityMemoryStore = () => {
  memoryStore.clear();
  processedIdempotencyKeys.clear();
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      Object.values(STORAGE_KEYS).forEach((k) => globalThis.localStorage.removeItem(k));
    }
  } catch {
    // ignore
  }
};

const getStorage = () => {
  if (customStorage) return customStorage;
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    // fallback
  }
  return {
    getItem: (k) => memoryStore.get(k) ?? null,
    setItem: (k, v) => memoryStore.set(k, String(v)),
    removeItem: (k) => memoryStore.delete(k),
    clear: () => memoryStore.clear(),
  };
};

const processedIdempotencyKeys = new Set();

export const readStore = (key, fallback = []) => {
  try {
    const raw = getStorage().getItem(key);
    if (!raw) return Array.isArray(fallback) ? [...fallback] : fallback;
    return JSON.parse(raw);
  } catch {
    return Array.isArray(fallback) ? [...fallback] : fallback;
  }
};

export const writeStore = (key, data) => {
  try {
    getStorage().setItem(key, JSON.stringify(data));
  } catch (err) {
    throw new ContinuityServiceError('Local storage write quota exceeded', ERROR_CODES.STORAGE_ERROR, err);
  }
};

export const generateUUID = () => {
  return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
};

// ---------------------------------------------------------------------------
// SEED DATA FOR OUT-OF-THE-BOX READINESS
// ---------------------------------------------------------------------------

export const DEFAULT_INCIDENT_SCENARIOS = [
  {
    id: 'scen_ransomware_civic_portal',
    title: 'Municipal Central Data Center Ransomware Outage',
    category: SCENARIO_CATEGORIES.CYBER_ATTACK,
    severity: 'CATASTROPHIC',
    narrative: 'At 03:00 AM, key database storage arrays hosting property tax, grievance registration, and civil registry systems are encrypted by ransomware. Active Directory authentication is offline.',
    timelineInjects: [
      {
        timeOffsetMinutes: 0,
        title: 'Initial Detection & Containment',
        eventDescription: 'Network operations center detects unauthorized mass file encryption on primary NAS storage.',
        expectedDecisions: ['Isolate municipal subnet from state WAN', 'Invoke Incident Command Team', 'Switch critical offices to offline local register'],
        requiredPersonnel: ['Chief Information Security Officer', 'Municipal Commissioner', 'IT Operations Lead'],
      },
      {
        timeOffsetMinutes: 30,
        title: 'Public Helplines Flooded',
        eventDescription: 'Citizens unable to generate birth certificates or lodge emergency water tanker requests begin reporting service blackout.',
        expectedDecisions: ['Issue public continuity statement on emergency radio/SMS', 'Deploy standalone paper-based token slips at ward offices'],
        requiredPersonnel: ['Public Relations Officer', 'Ward Administrative Officers'],
      },
      {
        timeOffsetMinutes: 90,
        title: 'Air-Gapped Backup Restoration Assessment',
        eventDescription: 'Storage engineering confirms integrity of 24-hour-old immutable cold storage backup.',
        expectedDecisions: ['Authorize bare-metal server reimaging', 'Verify RPO data gap window (24 hours)', 'Initiate manual transaction reconstruction'],
        requiredPersonnel: ['Database Administrator', 'Disaster Recovery Lead'],
      },
    ],
  },
  {
    id: 'scen_monsoon_flash_flood',
    title: 'Severe Urban Inundation & Substation Power Failure',
    category: SCENARIO_CATEGORIES.SEVERE_WEATHER,
    severity: 'HIGH',
    narrative: 'Torrential rainfall exceeding 180mm in 4 hours leads to flash flooding of Ward 8 & 9 substations, knocking out grid power to municipal pumping stations and primary health clinics.',
    timelineInjects: [
      {
        timeOffsetMinutes: 0,
        title: 'Substation Inundation Alert',
        eventDescription: 'Electricity board shuts down 33kV main transformer supplying water intake plant to prevent electrocution.',
        expectedDecisions: ['Dispatch diesel generator mobile trucks', 'Activate auxiliary stormwater pumping protocols'],
        requiredPersonnel: ['Superintending Engineer (Water Supply)', 'Disaster Response Force Coordinator'],
      },
      {
        timeOffsetMinutes: 45,
        title: 'Hospital Oxygen & Clean Water Threat',
        eventDescription: 'Sub-district civil hospital reports secondary water tank level below 15% with road access waterlogged.',
        expectedDecisions: ['Deploy high-clearance water tankers with police escort', 'Initiate emergency patient diversion if necessary'],
        requiredPersonnel: ['District Health Officer', 'Traffic Police Liaison Officer'],
      },
    ],
  },
];

export const DEFAULT_CONTINUITY_PLANS = [
  {
    id: 'plan_pune_ward_12',
    title: 'Ward 12 Essential Public Services Continuity Plan',
    jurisdictionId: 'ward-12-pune',
    department: 'Municipal Administration & Public Health',
    version: '1.0',
    status: PLAN_STATES.ACTIVE,
    recoveryObjectives: {
      rtoHours: 4,
      rpoHours: 1,
      criticalOperations: ['Drinking Water Distribution', 'Emergency Grievance Dispatch', 'Primary Health Immunization'],
      alternateFacilities: ['Bhavan Ward Community Hall (Generator Equipped)', 'Zilla Parishad IT Lab'],
    },
    contactTree: [
      {
        role: 'Incident Commander',
        officerName: 'Anil Kulkarni',
        phone: '9822012345',
        email: 'a.kulkarni@pcmc.gov.in',
        priorityOrder: 1,
      },
      {
        role: 'Chief Medical Officer',
        officerName: 'Dr. Sunita Deshmukh',
        phone: '9822054321',
        email: 'dr.deshmukh@pcmc.gov.in',
        priorityOrder: 2,
      },
      {
        role: 'Water Works Superintendent',
        officerName: 'Ramesh Patil',
        phone: '9822098765',
        email: 'r.patil@pcmc.gov.in',
        priorityOrder: 3,
      },
    ],
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    createdBy: 'admin_sys',
    schemaVersion: SCHEMA_VERSION,
  },
];

export const DEFAULT_SERVICE_DEPENDENCIES = [
  {
    id: 'dep_water_pumping',
    planId: 'plan_pune_ward_12',
    serviceId: 'svc_water_distribution',
    serviceName: 'Municipal Drinking Water Supply',
    criticality: CRITICALITY_TIERS.TIER_1_CRITICAL,
    upstreamDependencies: ['svc_power_substation', 'svc_scada_telemetry'],
    redundantAlternative: 'Standby 500kVA Diesel Generator at Sector 4 Intake',
    manualFallbackProcedure: 'Manual valve opening schedule executed by zone line inspectors per paper map chart.',
    estimatedRestorationHours: 3,
  },
  {
    id: 'dep_power_substation',
    planId: 'plan_pune_ward_12',
    serviceId: 'svc_power_substation',
    serviceName: '33kV Ward Substation Main Grid',
    criticality: CRITICALITY_TIERS.TIER_1_CRITICAL,
    upstreamDependencies: [],
    redundantAlternative: null, // Single point of failure!
    manualFallbackProcedure: 'Manual feeder bypass line to neighboring Ward 11 distribution hub.',
    estimatedRestorationHours: 6, // Exceeds 4h RTO
  },
  {
    id: 'dep_scada_telemetry',
    planId: 'plan_pune_ward_12',
    serviceId: 'svc_scada_telemetry',
    serviceName: 'SCADA Pressure & Level Telemetry',
    criticality: CRITICALITY_TIERS.TIER_2_ESSENTIAL,
    upstreamDependencies: ['svc_cloud_iot_gateway'],
    redundantAlternative: 'Analog dial gauges installed at reservoir tower base',
    manualFallbackProcedure: 'Hourly manual dip-stick measurement recorded in physical logbook.',
    estimatedRestorationHours: 2,
  },
  {
    id: 'dep_cloud_gateway',
    planId: 'plan_pune_ward_12',
    serviceId: 'svc_cloud_iot_gateway',
    serviceName: 'Cloud IoT Telemetry Gateway',
    criticality: CRITICALITY_TIERS.TIER_3_DEFERRED,
    upstreamDependencies: [],
    redundantAlternative: null,
    manualFallbackProcedure: 'Cellular SMS alert modem fallback to control room.',
    estimatedRestorationHours: 1,
  },
];

// Initialize seed data on module evaluation if storage is empty
const initializeDefaultData = () => {
  try {
    const store = getStorage();
    if (!store.getItem(STORAGE_KEYS.SCENARIOS)) {
      writeStore(STORAGE_KEYS.SCENARIOS, DEFAULT_INCIDENT_SCENARIOS);
    }
    if (!store.getItem(STORAGE_KEYS.PLANS)) {
      writeStore(STORAGE_KEYS.PLANS, DEFAULT_CONTINUITY_PLANS);
    }
    if (!store.getItem(STORAGE_KEYS.DEPENDENCIES)) {
      writeStore(STORAGE_KEYS.DEPENDENCIES, DEFAULT_SERVICE_DEPENDENCIES);
    }
  } catch {
    // Graceful fallback for non-browser or test runner environments
  }
};
initializeDefaultData();

// ---------------------------------------------------------------------------
// CONTINUITY PLANS API
// ---------------------------------------------------------------------------

export const listContinuityPlans = ({ jurisdictionId, status, actor = getCurrentActor() } = {}) => {
  let plans = readStore(STORAGE_KEYS.PLANS, DEFAULT_CONTINUITY_PLANS);

  if (jurisdictionId && jurisdictionId !== 'all') {
    plans = plans.filter((p) => p.jurisdictionId === jurisdictionId);
  }
  if (status && status !== 'all') {
    plans = plans.filter((p) => p.status === status);
  }

  const isPrivileged = actor?.role === 'admin' || actor?.role === 'operator';

  return plans.map((plan) => ({
    ...plan,
    contactTree: sanitizeContactTree(plan.contactTree, isPrivileged),
  }));
};

export const getContinuityPlanById = (id, { actor = getCurrentActor() } = {}) => {
  const plans = readStore(STORAGE_KEYS.PLANS, DEFAULT_CONTINUITY_PLANS);
  const plan = plans.find((p) => p.id === id);
  if (!plan) {
    throw new ContinuityServiceError(`Continuity Plan with ID "${id}" not found`, ERROR_CODES.NOT_FOUND);
  }

  const isPrivileged = actor?.role === 'admin' || actor?.role === 'operator';
  return {
    ...plan,
    contactTree: sanitizeContactTree(plan.contactTree, isPrivileged),
  };
};

/**
 * Packages a complete continuity plan, its service dependencies, fallback protocols,
 * and emergency contact trees for offline field execution during grid/network collapse.
 *
 * Scopes contact details according to actor permissions (data minimization).
 */
export const exportContinuityPlanOfflinePackage = (planId, { actor = getCurrentActor() } = {}) => {
  const plan = getContinuityPlanById(planId, { actor });
  const allDeps = readStore(STORAGE_KEYS.DEPENDENCIES, DEFAULT_SERVICE_DEPENDENCIES);
  const planDeps = allDeps.filter((d) => d.planId === planId);
  const scenarios = readStore(STORAGE_KEYS.SCENARIOS, DEFAULT_INCIDENT_SCENARIOS);

  const isPrivileged = actor?.role === 'admin' || actor?.role === 'operator';

  return {
    exportMetadata: {
      packageType: 'CIVIC_CONTINUITY_OFFLINE_RUNBOOK',
      packageVersion: '1.0.0',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      exportedBy: actor?.id || 'anonymous_officer',
      isPrivilegedAccess: isPrivileged,
      environment: 'OFFLINE_DISASTER_RECOVERY',
    },
    plan: {
      ...plan,
      contactTree: sanitizeContactTree(plan.contactTree, isPrivileged),
    },
    dependencies: planDeps,
    scenarios,
    offlineExecutionInstructions: [
      '1. In the event of telecommunication or power grid loss, verify standby diesel generator fuel levels.',
      '2. Refer to Section 2 (Service Dependency Matrix) for manual valve/bypass operational procedures.',
      '3. Assemble the Emergency Response Team per priority order in the Contact Tree.',
      '4. Maintain written paper event log until municipal command servers are restored.',
    ],
  };
};

export const saveContinuityPlan = (planData, { actor = getCurrentActor(), idempotencyKey = null } = {}) => {
  requirePermission('continuity.write');
  if (idempotencyKey && processedIdempotencyKeys.has(idempotencyKey)) {
    throw new ContinuityServiceError('Duplicate transaction prevented by idempotency key', ERROR_CODES.DUPLICATE_IDEMPOTENCY);
  }

  const sanitized = sanitizeTextFields(planData || {});
  if (!sanitized.title || sanitized.title.trim().length < 3) {
    throw new ContinuityServiceError('Plan title must be at least 3 characters long', ERROR_CODES.VALIDATION_ERROR);
  }

  const plans = readStore(STORAGE_KEYS.PLANS, DEFAULT_CONTINUITY_PLANS);
  const now = new Date().toISOString();
  const planId = sanitized.id || generateUUID();
  const existingIdx = plans.findIndex((p) => p.id === planId);

  const newRecord = {
    id: planId,
    title: sanitized.title.trim(),
    jurisdictionId: sanitized.jurisdictionId || 'general-jurisdiction',
    department: sanitized.department || 'Public Administration',
    version: sanitized.version || '1.0',
    status: sanitized.status || PLAN_STATES.DRAFT,
    recoveryObjectives: {
      rtoHours: Number(sanitized.recoveryObjectives?.rtoHours) || 4,
      rpoHours: Number(sanitized.recoveryObjectives?.rpoHours) || 1,
      criticalOperations: Array.isArray(sanitized.recoveryObjectives?.criticalOperations)
        ? sanitized.recoveryObjectives.criticalOperations
        : ['Emergency Operations Dispatch'],
      alternateFacilities: Array.isArray(sanitized.recoveryObjectives?.alternateFacilities)
        ? sanitized.recoveryObjectives.alternateFacilities
        : ['Civic Center Backup Facility'],
    },
    contactTree: Array.isArray(sanitized.contactTree)
      ? sanitized.contactTree.map((c, i) => ({
          role: String(c.role || 'Officer'),
          officerName: String(c.officerName || 'Official'),
          phone: String(c.phone || ''),
          email: String(c.email || ''),
          priorityOrder: Number(c.priorityOrder) || i + 1,
        }))
      : [],
    createdAt: existingIdx >= 0 ? plans[existingIdx].createdAt : now,
    updatedAt: now,
    createdBy: existingIdx >= 0 ? plans[existingIdx].createdBy : (actor?.id || 'admin'),
    schemaVersion: SCHEMA_VERSION,
  };

  if (existingIdx >= 0) {
    plans[existingIdx] = newRecord;
  } else {
    plans.push(newRecord);
  }

  writeStore(STORAGE_KEYS.PLANS, plans);
  if (idempotencyKey) processedIdempotencyKeys.add(idempotencyKey);

  appendContinuityAuditLog({
    entityType: 'ContinuityPlan',
    entityId: planId,
    action: existingIdx >= 0 ? 'PLAN_UPDATED' : 'PLAN_CREATED',
    actor,
    nextState: newRecord.status,
    reason: sanitized.reason || 'Plan details saved',
  });

  return newRecord;
};

export const transitionPlanState = (planId, nextState, { actor = getCurrentActor(), reason = '' } = {}) => {
  if (nextState === PLAN_STATES.APPROVED) {
    requirePermission('continuity.approve');
  }

  const plans = readStore(STORAGE_KEYS.PLANS, DEFAULT_CONTINUITY_PLANS);
  const plan = plans.find((p) => p.id === planId);
  if (!plan) {
    throw new ContinuityServiceError(`Plan "${planId}" not found`, ERROR_CODES.NOT_FOUND);
  }

  const currentState = plan.status;
  if (currentState === nextState) return plan;

  const allowed = ALLOWED_PLAN_TRANSITIONS[currentState] || [];
  if (!allowed.includes(nextState)) {
    throw new ContinuityServiceError(
      `Cannot transition Continuity Plan from ${currentState} to ${nextState}. Allowed transitions: ${allowed.join(', ') || 'None (Terminal State)'}`,
      ERROR_CODES.INVALID_TRANSITION
    );
  }

  // Active Invariant: If a plan becomes ACTIVE, supersede other ACTIVE plans in the same jurisdiction
  if (nextState === PLAN_STATES.ACTIVE) {
    plans.forEach((p) => {
      if (p.jurisdictionId === plan.jurisdictionId && p.id !== planId && p.status === PLAN_STATES.ACTIVE) {
        p.status = PLAN_STATES.SUPERSEDED;
        p.updatedAt = new Date().toISOString();
        appendContinuityAuditLog({
          entityType: 'ContinuityPlan',
          entityId: p.id,
          action: 'PLAN_SUPERSEDED',
          actor,
          previousState: PLAN_STATES.ACTIVE,
          nextState: PLAN_STATES.SUPERSEDED,
          reason: `Superseded by newer active plan ${planId}`,
        });
      }
    });
  }

  const now = new Date().toISOString();
  plan.status = nextState;
  plan.updatedAt = now;

  writeStore(STORAGE_KEYS.PLANS, plans);

  appendContinuityAuditLog({
    entityType: 'ContinuityPlan',
    entityId: planId,
    action: 'PLAN_STATE_TRANSITION',
    actor,
    previousState: currentState,
    nextState,
    reason,
  });

  return plan;
};

// ---------------------------------------------------------------------------
// SERVICE DEPENDENCIES API
// ---------------------------------------------------------------------------

export const listDependencies = (planId) => {
  const deps = readStore(STORAGE_KEYS.DEPENDENCIES, DEFAULT_SERVICE_DEPENDENCIES);
  if (!planId || planId === 'all') return deps;
  return deps.filter((d) => d.planId === planId);
};

export const saveDependency = (depData, { actor = getCurrentActor() } = {}) => {
  requirePermission('continuity.write');

  const sanitized = sanitizeTextFields(depData || {});
  if (!sanitized.serviceName || sanitized.serviceName.trim().length < 2) {
    throw new ContinuityServiceError('Service name is required', ERROR_CODES.VALIDATION_ERROR);
  }

  const deps = readStore(STORAGE_KEYS.DEPENDENCIES, DEFAULT_SERVICE_DEPENDENCIES);
  const depId = sanitized.id || generateUUID();
  const serviceId = sanitized.serviceId || `svc_${sanitized.serviceName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  const newRecord = {
    id: depId,
    planId: sanitized.planId || 'plan_general',
    serviceId,
    serviceName: sanitized.serviceName.trim(),
    criticality: sanitized.criticality || CRITICALITY_TIERS.TIER_2_ESSENTIAL,
    upstreamDependencies: Array.isArray(sanitized.upstreamDependencies) ? sanitized.upstreamDependencies : [],
    redundantAlternative: sanitized.redundantAlternative ? sanitized.redundantAlternative.trim() : null,
    manualFallbackProcedure: sanitized.manualFallbackProcedure ? sanitized.manualFallbackProcedure.trim() : '',
    estimatedRestorationHours: Number(sanitized.estimatedRestorationHours) || 2,
  };

  // Pre-validate cycle detection before committing
  const testList = [...deps.filter((d) => d.id !== depId), newRecord];
  const testServices = testList.map((d) => ({
    id: d.serviceId,
    name: d.serviceName,
    criticality: d.criticality,
  }));
  const cycle = detectDependencyCycles(testServices, testList);
  if (cycle.hasCycle) {
    throw new ContinuityServiceError(
      `Saving this dependency introduces a circular dependency cycle: ${cycle.cycleDescription}`,
      ERROR_CODES.CYCLE_DETECTED,
      cycle
    );
  }

  const existingIdx = deps.findIndex((d) => d.id === depId);
  if (existingIdx >= 0) {
    deps[existingIdx] = newRecord;
  } else {
    deps.push(newRecord);
  }

  writeStore(STORAGE_KEYS.DEPENDENCIES, deps);

  appendContinuityAuditLog({
    entityType: 'ServiceDependency',
    entityId: depId,
    action: existingIdx >= 0 ? 'DEPENDENCY_UPDATED' : 'DEPENDENCY_CREATED',
    actor,
    reason: `Dependency mapped for ${newRecord.serviceName}`,
  });

  return newRecord;
};

export const deleteDependency = (id, { actor = getCurrentActor() } = {}) => {
  if (actor && actor.role !== 'admin') {
    throw new ContinuityServiceError('Only administrators can remove service dependencies', ERROR_CODES.PERMISSION_DENIED);
  }
  const deps = readStore(STORAGE_KEYS.DEPENDENCIES, DEFAULT_SERVICE_DEPENDENCIES);
  const filtered = deps.filter((d) => d.id !== id);
  writeStore(STORAGE_KEYS.DEPENDENCIES, filtered);
  return true;
};

// ---------------------------------------------------------------------------
// INCIDENT SCENARIOS API
// ---------------------------------------------------------------------------

export const listScenarios = ({ category } = {}) => {
  const scenarios = readStore(STORAGE_KEYS.SCENARIOS, DEFAULT_INCIDENT_SCENARIOS);
  if (category && category !== 'all') {
    return scenarios.filter((s) => s.category === category);
  }
  return scenarios;
};

export const saveScenario = (scenarioData, { actor = getCurrentActor() } = {}) => {
  if (actor && actor.role !== 'admin' && actor.role !== 'operator') {
    throw new ContinuityServiceError('Unauthorized to create scenarios', ERROR_CODES.PERMISSION_DENIED);
  }
  const sanitized = sanitizeTextFields(scenarioData || {});
  if (!sanitized.title || sanitized.title.trim().length < 3) {
    throw new ContinuityServiceError('Scenario title must be at least 3 characters', ERROR_CODES.VALIDATION_ERROR);
  }

  const scenarios = readStore(STORAGE_KEYS.SCENARIOS, DEFAULT_INCIDENT_SCENARIOS);
  const scenarioId = sanitized.id || generateUUID();
  const record = {
    id: scenarioId,
    title: sanitized.title.trim(),
    category: sanitized.category || SCENARIO_CATEGORIES.INFRASTRUCTURE_FAILURE,
    severity: sanitized.severity || 'MEDIUM',
    narrative: sanitized.narrative || '',
    timelineInjects: Array.isArray(sanitized.timelineInjects) ? sanitized.timelineInjects : [],
  };

  const idx = scenarios.findIndex((s) => s.id === scenarioId);
  if (idx >= 0) scenarios[idx] = record;
  else scenarios.push(record);

  writeStore(STORAGE_KEYS.SCENARIOS, scenarios);
  return record;
};

// ---------------------------------------------------------------------------
// TABLETOP DRILL EXERCISES API
// ---------------------------------------------------------------------------

export const listExerciseRuns = ({ planId, status } = {}) => {
  let runs = readStore(STORAGE_KEYS.EXERCISES, []);
  if (planId && planId !== 'all') {
    runs = runs.filter((r) => r.planId === planId);
  }
  if (status && status !== 'all') {
    runs = runs.filter((r) => r.status === status);
  }
  return runs;
};

export const createExerciseRun = (runData, { actor = getCurrentActor(), idempotencyKey = null } = {}) => {
  requirePermission('continuity.drill');
  if (idempotencyKey && processedIdempotencyKeys.has(idempotencyKey)) {
    throw new ContinuityServiceError('Duplicate drill run prevented by idempotency key', ERROR_CODES.DUPLICATE_IDEMPOTENCY);
  }

  const sanitized = sanitizeTextFields(runData || {});
  const now = new Date().toISOString();
  const runId = generateUUID();

  const scenarios = listScenarios();
  const scenario = scenarios.find((s) => s.id === sanitized.scenarioId) || scenarios[0];

  const runs = readStore(STORAGE_KEYS.EXERCISES, []);
  const newRun = {
    id: runId,
    title: sanitized.title || `Tabletop Drill - ${scenario?.title || 'Civic Scenario'}`,
    planId: sanitized.planId || 'plan_pune_ward_12',
    scenarioId: scenario?.id || 'unknown_scenario',
    drillType: sanitized.drillType || 'TABLETOP',
    status: EXERCISE_STATES.SCHEDULED,
    leadFacilitator: sanitized.leadFacilitator || actor?.name || 'Lead Officer',
    participants: Array.isArray(sanitized.participants) ? sanitized.participants : [],
    decisionLogs: [],
    recoveryMetrics: {
      targetRTOHours: Number(sanitized.targetRTOHours) || 4,
      actualEstimatedRTOHours: 0,
      gapHours: 0,
      serviceResilienceScore: 100,
    },
    afterActionSummary: {
      strengths: [],
      vulnerabilities: [],
      recommendations: [],
      completedAt: null,
    },
    createdAt: now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION,
  };

  runs.push(newRun);
  writeStore(STORAGE_KEYS.EXERCISES, runs);
  if (idempotencyKey) processedIdempotencyKeys.add(idempotencyKey);

  appendContinuityAuditLog({
    entityType: 'ExerciseRun',
    entityId: runId,
    action: 'DRILL_SCHEDULED',
    actor,
    nextState: EXERCISE_STATES.SCHEDULED,
    reason: `Tabletop drill initialized for scenario ${newRun.scenarioId}`,
  });

  return newRun;
};

export const recordInjectDecision = (
  runId,
  { injectIndex, recordedDecision, responsibleOfficer, delayMinutes = 0 },
  { actor = getCurrentActor() } = {}
) => {
  const runs = readStore(STORAGE_KEYS.EXERCISES, []);
  const run = runs.find((r) => r.id === runId);
  if (!run) throw new ContinuityServiceError(`Exercise run "${runId}" not found`, ERROR_CODES.NOT_FOUND);

  if (run.status !== EXERCISE_STATES.IN_PROGRESS) {
    throw new ContinuityServiceError('Decisions can only be logged during an active IN_PROGRESS exercise', ERROR_CODES.INVALID_TRANSITION);
  }

  const sanitized = sanitizeTextFields({
    recordedDecision: String(recordedDecision || '').trim(),
    responsibleOfficer: String(responsibleOfficer || actor?.name || 'Officer').trim(),
  });

  const decisionEntry = {
    id: `dec_${Date.now()}_${injectIndex}`,
    timestamp: new Date().toISOString(),
    injectIndex: Number(injectIndex),
    recordedDecision: sanitized.recordedDecision,
    responsibleOfficer: sanitized.responsibleOfficer,
    delayMinutes: Number(delayMinutes) || 0,
  };

  run.decisionLogs.push(decisionEntry);
  run.updatedAt = new Date().toISOString();

  // Recalculate metrics on the fly
  const totalDelays = run.decisionLogs.reduce((acc, d) => acc + (d.delayMinutes || 0), 0);
  const additionalHours = totalDelays / 60;
  const actualEst = run.recoveryMetrics.targetRTOHours + additionalHours;
  const gap = actualEst - run.recoveryMetrics.targetRTOHours;
  const resilienceScore = Math.max(10, Math.min(100, Math.round(100 - gap * 15)));

  run.recoveryMetrics.actualEstimatedRTOHours = Number(actualEst.toFixed(1));
  run.recoveryMetrics.gapHours = Number(gap.toFixed(1));
  run.recoveryMetrics.serviceResilienceScore = resilienceScore;

  writeStore(STORAGE_KEYS.EXERCISES, runs);
  return run;
};

export const transitionExerciseState = (
  runId,
  nextState,
  { actor = getCurrentActor(), reason = '', afterActionSummary = null } = {}
) => {
  const runs = readStore(STORAGE_KEYS.EXERCISES, []);
  const run = runs.find((r) => r.id === runId);
  if (!run) throw new ContinuityServiceError(`Exercise run "${runId}" not found`, ERROR_CODES.NOT_FOUND);

  const currentState = run.status;
  if (currentState === nextState) return run;

  const allowed = ALLOWED_EXERCISE_TRANSITIONS[currentState] || [];
  if (!allowed.includes(nextState)) {
    throw new ContinuityServiceError(
      `Cannot transition Exercise from ${currentState} to ${nextState}. Allowed: ${allowed.join(', ') || 'None (Closed)'}`,
      ERROR_CODES.INVALID_TRANSITION
    );
  }

  if (nextState === EXERCISE_STATES.CLOSED && afterActionSummary) {
    run.afterActionSummary = {
      strengths: Array.isArray(afterActionSummary.strengths) ? afterActionSummary.strengths : [],
      vulnerabilities: Array.isArray(afterActionSummary.vulnerabilities) ? afterActionSummary.vulnerabilities : [],
      recommendations: Array.isArray(afterActionSummary.recommendations) ? afterActionSummary.recommendations : [],
      completedAt: new Date().toISOString(),
    };

    if (Array.isArray(afterActionSummary.recommendations)) {
      afterActionSummary.recommendations.forEach((recText) => {
        if (recText && typeof recText === 'string' && recText.trim().length >= 3) {
          saveActionItem(
            {
              exerciseRunId: runId,
              title: recText.trim(),
              ownerDepartment: 'Emergency Operations & Response',
              priority: 'HIGH',
              status: ACTION_ITEM_STATES.OPEN,
            },
            { actor }
          );
        }
      });
    }
  }

  run.status = nextState;
  run.updatedAt = new Date().toISOString();

  writeStore(STORAGE_KEYS.EXERCISES, runs);

  appendContinuityAuditLog({
    entityType: 'ExerciseRun',
    entityId: runId,
    action: 'DRILL_STATE_TRANSITION',
    actor,
    previousState: currentState,
    nextState,
    reason,
  });

  return run;
};

// ---------------------------------------------------------------------------
// CORRECTIVE ACTION ITEMS API
// ---------------------------------------------------------------------------

export const listActionItems = ({ exerciseRunId, status } = {}) => {
  let items = readStore(STORAGE_KEYS.ACTION_ITEMS, []);
  if (exerciseRunId && exerciseRunId !== 'all') {
    items = items.filter((i) => i.exerciseRunId === exerciseRunId);
  }
  if (status && status !== 'all') {
    items = items.filter((i) => i.status === status);
  }
  return items;
};

export function saveActionItem(itemData, { actor = getCurrentActor() } = {}) {
  const sanitized = sanitizeTextFields(itemData || {});
  if (!sanitized.title || sanitized.title.trim().length < 3) {
    throw new ContinuityServiceError('Action item title must be at least 3 characters', ERROR_CODES.VALIDATION_ERROR);
  }

  const items = readStore(STORAGE_KEYS.ACTION_ITEMS, []);
  const itemId = sanitized.id || generateUUID();
  const now = new Date().toISOString();

  const record = {
    id: itemId,
    exerciseRunId: sanitized.exerciseRunId || 'general_exercise',
    title: sanitized.title.trim(),
    ownerDepartment: sanitized.ownerDepartment || 'Operations',
    assignee: sanitized.assignee || 'Assigned Officer',
    priority: sanitized.priority || 'HIGH',
    dueDate: sanitized.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    status: sanitized.status || ACTION_ITEM_STATES.OPEN,
    closureNotes: sanitized.closureNotes || '',
    updatedAt: now,
  };

  const idx = items.findIndex((i) => i.id === itemId);
  if (idx >= 0) items[idx] = record;
  else items.push(record);

  writeStore(STORAGE_KEYS.ACTION_ITEMS, items);

  appendContinuityAuditLog({
    entityType: 'ActionItem',
    entityId: itemId,
    action: idx >= 0 ? 'ACTION_ITEM_UPDATED' : 'ACTION_ITEM_CREATED',
    actor,
    nextState: record.status,
    reason: record.title,
  });

  return record;
};

export const transitionActionItemState = (itemId, nextState, { actor = getCurrentActor(), closureNotes = '' } = {}) => {
  const items = readStore(STORAGE_KEYS.ACTION_ITEMS, []);
  const item = items.find((i) => i.id === itemId);
  if (!item) throw new ContinuityServiceError(`Action item "${itemId}" not found`, ERROR_CODES.NOT_FOUND);

  const currentState = item.status;
  if (currentState === nextState) return item;

  const allowed = ALLOWED_ACTION_TRANSITIONS[currentState] || [];
  if (!allowed.includes(nextState)) {
    throw new ContinuityServiceError(
      `Cannot transition Action Item from ${currentState} to ${nextState}. Allowed: ${allowed.join(', ')}`,
      ERROR_CODES.INVALID_TRANSITION
    );
  }

  item.status = nextState;
  if (closureNotes) item.closureNotes = String(closureNotes).trim();
  item.updatedAt = new Date().toISOString();

  writeStore(STORAGE_KEYS.ACTION_ITEMS, items);

  appendContinuityAuditLog({
    entityType: 'ActionItem',
    entityId: itemId,
    action: 'ACTION_ITEM_TRANSITION',
    actor,
    previousState: currentState,
    nextState,
    reason: closureNotes || `Status updated to ${nextState}`,
  });

  return item;
};

// ---------------------------------------------------------------------------
// HUMAN-IN-THE-LOOP RECOMMENDATIONS MANAGEMENT
// ---------------------------------------------------------------------------

export const getPlanRecommendations = (planId) => {
  const plan = getContinuityPlanById(planId);
  const dependencies = listDependencies(planId);
  const services = dependencies.map((d) => ({
    id: d.serviceId,
    name: d.serviceName,
    criticality: d.criticality,
    estimatedRestorationHours: d.estimatedRestorationHours,
    manualFallbackProcedure: d.manualFallbackProcedure,
  }));

  // Fetch persisted decisions
  const persistedDecisions = readStore(STORAGE_KEYS.RECOMMENDATIONS, []);

  const rawRecs = generateExplainableRecommendations({
    services,
    dependencies,
    recoveryObjectives: plan.recoveryObjectives,
    jurisdictionId: plan.jurisdictionId,
  });

  // Merge with any human decisions (accepted/rejected/modified)
  return rawRecs.map((rec) => {
    const decision = persistedDecisions.find((d) => d.id === rec.id);
    if (decision) {
      return { ...rec, ...decision };
    }
    return rec;
  });
};

export const recordRecommendationDecision = (
  recommendationId,
  decision, // 'ACCEPTED' | 'REJECTED' | 'MODIFIED'
  { actor = getCurrentActor(), reason = '', modifiedRemediation = '' } = {}
) => {
  if (actor && actor.role !== 'admin' && actor.role !== 'operator') {
    throw new ContinuityServiceError('Only authorized officers may sign off on recommendations', ERROR_CODES.PERMISSION_DENIED);
  }

  const persisted = readStore(STORAGE_KEYS.RECOMMENDATIONS, []);
  const now = new Date().toISOString();

  const decisionRecord = {
    id: recommendationId,
    status: decision,
    decidedBy: actor?.name || actor?.id || 'Authorized Officer',
    decidedAt: now,
    reason: String(reason || '').trim(),
    modifiedRemediation: String(modifiedRemediation || '').trim(),
  };

  const idx = persisted.findIndex((p) => p.id === recommendationId);
  if (idx >= 0) persisted[idx] = decisionRecord;
  else persisted.push(decisionRecord);

  writeStore(STORAGE_KEYS.RECOMMENDATIONS, persisted);

  appendContinuityAuditLog({
    entityType: 'Recommendation',
    entityId: recommendationId,
    action: `RECOMMENDATION_${decision}`,
    actor,
    nextState: decision,
    reason: reason || `Recommendation ${decision.toLowerCase()} by officer`,
    metadata: { modifiedRemediation },
  });

  return decisionRecord;
};

// ---------------------------------------------------------------------------
// SCHEMA MIGRATION & ROLLBACK STRATEGY
// ---------------------------------------------------------------------------

/**
 * Creates a complete immutable backup snapshot of all continuity stores
 * for atomic migration rollback protection.
 */
export const createContinuityBackupSnapshot = () => {
  return {
    snapshotAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    stores: {
      [STORAGE_KEYS.PLANS]: readStore(STORAGE_KEYS.PLANS, []),
      [STORAGE_KEYS.SCENARIOS]: readStore(STORAGE_KEYS.SCENARIOS, []),
      [STORAGE_KEYS.DEPENDENCIES]: readStore(STORAGE_KEYS.DEPENDENCIES, []),
      [STORAGE_KEYS.EXERCISES]: readStore(STORAGE_KEYS.EXERCISES, []),
      [STORAGE_KEYS.ACTION_ITEMS]: readStore(STORAGE_KEYS.ACTION_ITEMS, []),
      [STORAGE_KEYS.RECOMMENDATIONS]: readStore(STORAGE_KEYS.RECOMMENDATIONS, []),
    },
  };
};

/**
 * Rolls back continuity stores to a previously captured backup snapshot.
 */
export const rollbackContinuityStores = (snapshot) => {
  if (!snapshot || !snapshot.stores) {
    throw new ContinuityServiceError('Invalid backup snapshot supplied for rollback', ERROR_CODES.VALIDATION_ERROR);
  }
  for (const [key, value] of Object.entries(snapshot.stores)) {
    writeStore(key, value);
  }
  return { rolledBackAt: new Date().toISOString(), restoredStores: Object.keys(snapshot.stores) };
};

/**
 * Executes idempotent forward schema migrations across all continuity data stores.
 * Handles both pristine/empty databases and representative legacy datasets lacking schemaVersion.
 */
export const migrateContinuityStores = ({ targetVersion = SCHEMA_VERSION } = {}) => {
  let migratedCount = 0;
  let skippedCount = 0;

  // 1. Migrate Continuity Plans
  const plans = readStore(STORAGE_KEYS.PLANS, []);
  const updatedPlans = plans.map((p) => {
    if (!p.schemaVersion || p.schemaVersion < targetVersion) {
      migratedCount++;
      return {
        ...p,
        schemaVersion: targetVersion,
        version: p.version || 1,
        status: p.status || PLAN_STATES.DRAFT,
        jurisdictionId: p.jurisdictionId || 'ward-general',
        contactTree: Array.isArray(p.contactTree) ? p.contactTree : [],
        recoveryObjectives: p.recoveryObjectives || { rtoHours: 4, rpoHours: 2 },
        updatedAt: p.updatedAt || new Date().toISOString(),
      };
    }
    skippedCount++;
    return p;
  });
  if (plans.length > 0) writeStore(STORAGE_KEYS.PLANS, updatedPlans);

  // 2. Migrate Service Dependencies
  const deps = readStore(STORAGE_KEYS.DEPENDENCIES, []);
  const updatedDeps = deps.map((d) => {
    if (!d.schemaVersion || d.schemaVersion < targetVersion) {
      migratedCount++;
      return {
        ...d,
        schemaVersion: targetVersion,
        criticality: d.criticality || CRITICALITY_TIERS.TIER_2_ESSENTIAL,
        upstreamDependencies: Array.isArray(d.upstreamDependencies) ? d.upstreamDependencies : [],
        estimatedRestorationHours: Number(d.estimatedRestorationHours) || 2,
      };
    }
    skippedCount++;
    return d;
  });
  if (deps.length > 0) writeStore(STORAGE_KEYS.DEPENDENCIES, updatedDeps);

  // 3. Migrate Exercise Runs
  const exercises = readStore(STORAGE_KEYS.EXERCISES, []);
  const updatedExercises = exercises.map((e) => {
    if (!e.schemaVersion || e.schemaVersion < targetVersion) {
      migratedCount++;
      return {
        ...e,
        schemaVersion: targetVersion,
        status: e.status || EXERCISE_STATES.SCHEDULED,
        decisionLogs: Array.isArray(e.decisionLogs) ? e.decisionLogs : [],
        recoveryMetrics: e.recoveryMetrics || {
          targetRTOHours: 4,
          actualEstimatedRTOHours: 4,
          gapHours: 0,
          serviceResilienceScore: 100,
        },
      };
    }
    skippedCount++;
    return e;
  });
  if (exercises.length > 0) writeStore(STORAGE_KEYS.EXERCISES, updatedExercises);

  // 4. Migrate Action Items
  const actions = readStore(STORAGE_KEYS.ACTION_ITEMS, []);
  const updatedActions = actions.map((a) => {
    if (!a.schemaVersion || a.schemaVersion < targetVersion) {
      migratedCount++;
      return {
        ...a,
        schemaVersion: targetVersion,
        status: a.status || ACTION_ITEM_STATES.OPEN,
        priority: a.priority || 'MEDIUM',
      };
    }
    skippedCount++;
    return a;
  });
  if (actions.length > 0) writeStore(STORAGE_KEYS.ACTION_ITEMS, updatedActions);

  return {
    migratedAt: new Date().toISOString(),
    currentVersion: targetVersion,
    migratedCount,
    skippedCount,
    totalInspected: migratedCount + skippedCount,
  };
};
