/**
 * src/data/civicPolicySimulationData.js
 *
 * Versioned, privacy-safe synthetic dataset for the Agent-Based Civic Policy
 * Scenario Simulator (#1176).
 *
 * All records are synthetic fixtures with zero production PII. Personas are
 * statistical archetypes, not real citizens. No credentials, raw documents,
 * Aadhaar/PAN numbers, phone numbers, or sensitive prompts are stored here.
 *
 * Schema version: civic-policy-simulation-v1
 */

export const CIVIC_POLICY_SIMULATION_SCHEMA_VERSION = 'civic-policy-simulation-v1';
export const CIVIC_POLICY_SIMULATION_REVIEW_DATE = '2026-11-20';
export const CIVIC_POLICY_SIMULATION_STALE_AFTER_DAYS = 365;
export const CIVIC_POLICY_SIMULATION_DISCLAIMER =
  'Illustrative agent-based scenario output. Synthetic personas only. Does not predict individual outcomes, ' +
  'claim official verification, or autonomously file or deny any application. Confirm policy changes with ' +
  'the relevant authority before rollout.';

/**
 * Persona archetypes. Each persona is a statistical archetype with travel,
 * document, language and service-usage attributes. None are identifiable.
 */
export const SIMULATION_PERSONAS = [
  {
    id: 'persona-elderly-senior-citizen',
    label: 'Elderly citizen (limited mobility)',
    archetype: 'elderly',
    travelBurden: 'high',
    documentReadiness: 'low',
    languagePreference: ['en', 'hi'],
    digitalLiteracy: 'low',
    officeVisitPreference: 'in-person',
    baseServiceDemandMultiplier: 1.0,
    documentRequirements: ['aadhaar', 'age-proof', 'address-proof'],
    notes: 'Prefers in-person service; higher document-gathering burden.',
  },
  {
    id: 'persona-working-adult',
    label: 'Working adult (full-time)',
    archetype: 'working-adult',
    travelBurden: 'medium',
    documentReadiness: 'medium',
    languagePreference: ['en'],
    digitalLiteracy: 'medium',
    officeVisitPreference: 'online-first',
    baseServiceDemandMultiplier: 1.2,
    documentRequirements: ['aadhaar', 'pan', 'address-proof'],
    notes: 'Prefers online channels; constrained by office hours.',
  },
  {
    id: 'persona-daily-wage-worker',
    label: 'Daily-wage worker',
    archetype: 'daily-wage-worker',
    travelBurden: 'very-high',
    documentReadiness: 'low',
    languagePreference: ['hi', 'en'],
    digitalLiteracy: 'low',
    officeVisitPreference: 'in-person',
    baseServiceDemandMultiplier: 0.8,
    documentRequirements: ['aadhaar', 'ration-card', 'address-proof'],
    notes: 'Cannot afford lost wages; travel burden is the dominant blocker.',
  },
  {
    id: 'persona-student',
    label: 'Student / young adult',
    archetype: 'student',
    travelBurden: 'low',
    documentReadiness: 'medium',
    languagePreference: ['en'],
    digitalLiteracy: 'high',
    officeVisitPreference: 'online-first',
    baseServiceDemandMultiplier: 1.5,
    documentRequirements: ['aadhaar', 'student-id', 'address-proof'],
    notes: 'High digital comfort; low document burden.',
  },
  {
    id: 'persona-rural-migrant',
    label: 'Rural migrant worker',
    archetype: 'rural-migrant',
    travelBurden: 'very-high',
    documentReadiness: 'low',
    languagePreference: ['hi', 'mr', 'en'],
    digitalLiteracy: 'low',
    officeVisitPreference: 'in-person',
    baseServiceDemandMultiplier: 0.6,
    documentRequirements: ['aadhaar', 'domicile-certificate', 'ration-card', 'address-proof'],
    notes: 'Highest travel burden; domicile documentation is a recurring blocker.',
  },
];

/**
 * Civic services used in scenarios. serviceId must match references elsewhere.
 */
export const SIMULATION_SERVICES = [
  {
    id: 'service-income-certificate',
    name: 'Income Certificate',
    department: 'Revenue Department',
    category: 'certificate',
    statutoryDays: 30,
    fee: 15,
    feeType: 'fixed',
    baseDailyDemand: 40,
    documentRequirements: ['aadhaar', 'income-proof', 'address-proof'],
    travelToOfficeRequired: true,
    onlineAvailable: false,
    isSynthetic: true,
  },
  {
    id: 'service-caste-certificate',
    name: 'Caste Certificate',
    department: 'Revenue Department',
    category: 'certificate',
    statutoryDays: 30,
    fee: 20,
    feeType: 'fixed',
    baseDailyDemand: 35,
    documentRequirements: ['aadhaar', 'caste-attestation', 'address-proof'],
    travelToOfficeRequired: true,
    onlineAvailable: false,
    isSynthetic: true,
  },
  {
    id: 'service-domicile-certificate',
    name: 'Domicile Certificate',
    department: 'Revenue Department',
    category: 'certificate',
    statutoryDays: 15,
    fee: 10,
    feeType: 'fixed',
    baseDailyDemand: 50,
    documentRequirements: ['aadhaar', 'domicile-certificate', 'address-proof'],
    travelToOfficeRequired: true,
    onlineAvailable: false,
    isSynthetic: true,
  },
  {
    id: 'service-ration-card',
    name: 'Ration Card',
    department: 'Food & Civil Supplies',
    category: 'entitlement',
    statutoryDays: 60,
    fee: 5,
    feeType: 'fixed',
    baseDailyDemand: 60,
    documentRequirements: ['aadhaar', 'ration-card', 'income-proof', 'address-proof'],
    travelToOfficeRequired: true,
    onlineAvailable: true,
    isSynthetic: true,
  },
  {
    id: 'service-pension',
    name: 'Senior Citizen Pension',
    department: 'Social Welfare',
    category: 'pension',
    statutoryDays: 45,
    fee: 0,
    feeType: 'waived',
    baseDailyDemand: 30,
    documentRequirements: ['aadhaar', 'age-proof', 'bank-passbook', 'address-proof'],
    travelToOfficeRequired: true,
    onlineAvailable: false,
    isSynthetic: true,
  },
  {
    id: 'service-trade-licence',
    name: 'Trade Licence',
    department: 'Municipal Corporation',
    category: 'licence',
    statutoryDays: 60,
    fee: 500,
    feeType: 'fixed',
    baseDailyDemand: 25,
    documentRequirements: ['aadhaar', 'pan', 'address-proof', 'noc'],
    travelToOfficeRequired: true,
    onlineAvailable: false,
    isSynthetic: true,
  },
];

/**
 * Offices / facilitation centres referenced by scenarios.
 */
export const SIMULATION_OFFICES = [
  {
    id: 'office-district-hq-south',
    name: 'District Headquarters - South',
    state: 'Maharashtra',
    district: 'Pune',
    ward: 'Ward 3 - Shivajinagar-Ghole Road',
    pincode: '411005',
    officeType: 'District HQ',
    isSynthetic: true,
    averageWaitMinutes: 45,
    counterCount: 6,
  },
  {
    id: 'office-taluka-office-west',
    name: 'Taluka Office - West',
    state: 'Maharashtra',
    district: 'Pune',
    ward: 'Ward 7 - Kothrud',
    pincode: '411038',
    officeType: 'Taluka Office',
    isSynthetic: true,
    averageWaitMinutes: 60,
    counterCount: 4,
  },
  {
    id: 'office-csc-kiosk-central',
    name: 'Common Service Centre - Central',
    state: 'Maharashtra',
    district: 'Pune',
    ward: 'Ward 1 - Camp',
    pincode: '411001',
    officeType: 'CSC Kiosk',
    isSynthetic: true,
    averageWaitMinutes: 20,
    counterCount: 2,
  },
  {
    id: 'office-urban-local-body-north',
    name: 'Urban Local Body - North',
    state: 'Maharashtra',
    district: 'Pune',
    ward: 'Ward 5 - Aundh',
    pincode: '411007',
    officeType: 'ULB',
    isSynthetic: true,
    averageWaitMinutes: 50,
    counterCount: 5,
  },
];

/**
 * Travel burden assumptions per office (minutes, one way), keyed by office id.
 * Deterministic planning figures, not live traffic data.
 */
export const TRAVEL_BURDEN_MINUTES = {
  'office-district-hq-south': 45,
  'office-taluka-office-west': 60,
  'office-csc-kiosk-central': 20,
  'office-urban-local-body-north': 50,
};

/**
 * Aggregate public statistics used only for validation (never individual
 * records). Values are illustrative synthetic aggregates.
 */
export const AGGREGATE_PUBLIC_STATS = [
  {
    id: 'stat-daily-service-demand-pune-south',
    label: 'Daily service demand (Pune South)',
    metric: 'applications_per_day',
    value: 210,
    source: 'Synthetic aggregate - Civic Help Setu demo data',
    reviewedAt: '2026-11-20',
    confidence: 'medium',
  },
  {
    id: 'stat-average-travel-minutes-pune',
    label: 'Average one-way travel minutes (Pune)',
    metric: 'travel_minutes_one_way',
    value: 44,
    source: 'Synthetic aggregate - Civic Help Setu demo data',
    reviewedAt: '2026-11-20',
    confidence: 'medium',
  },
  {
    id: 'stat-online-adoption-rate',
    label: 'Online channel adoption rate',
    metric: 'share_0_to_1',
    value: 0.38,
    source: 'Synthetic aggregate - Civic Help Setu demo data',
    reviewedAt: '2026-11-20',
    confidence: 'low',
  },
];

/**
 * Policy levers that scenario authors can toggle. Each lever is a deterministic
 * rule applied to the persona/service model.
 */
export const POLICY_LEVERS = [
  {
    id: 'lever-online-ration-card',
    label: 'Enable online Ration Card applications',
    description: 'Shifts eligible ration-card demand from in-person to online channel.',
    appliesToServiceIds: ['service-ration-card'],
    effect: {
      type: 'channel_shift',
      serviceId: 'service-ration-card',
      onlineShareIncrease: 0.40,
      travelReductionForShifted: 1.0,
    },
    defaultEnabled: false,
    riskNote: 'Requires digital-literacy support for low-digital-literacy personas.',
  },
  {
    id: 'lever-mobile-csc-ward-3',
    label: 'Deploy mobile CSC kiosk in Ward 3',
    description: 'Brings a facilitation centre closer to high-burden personas in Ward 3.',
    appliesToOfficeIds: ['office-district-hq-south', 'office-taluka-office-west'],
    effect: {
      type: 'travel_reduction',
      officeId: 'office-district-hq-south',
      travelMinutesReduction: 25,
    },
    defaultEnabled: false,
    riskNote: 'Staffing and recurring cost not modelled here.',
  },
  {
    id: 'lever-document-bundle-income-caste',
    label: 'Bundle Income + Caste document requirements',
    description: 'Allows one attested document bundle to satisfy both income and caste certificate needs.',
    appliesToServiceIds: ['service-income-certificate', 'service-caste-certificate'],
    effect: {
      type: 'document_bundle',
      documentRequirementReduction: 1,
    },
    defaultEnabled: false,
    riskNote: 'Needs inter-departmental attestation agreement.',
  },
  {
    id: 'lever-extended-office-hours',
    label: 'Extend office hours (10:00-18:00)',
    description: 'Reduces same-day demand concentration by spreading visits across longer hours.',
    appliesToOfficeIds: ['office-district-hq-south', 'office-taluka-office-west'],
    effect: {
      type: 'capacity_increase',
      officeId: 'office-district-hq-south',
      dailyCapacityMultiplier: 1.25,
    },
    defaultEnabled: false,
    riskNote: 'Staff overtime cost not modelled here.',
  },
];

/**
 * Predefined reusable scenarios. Each references policy levers and expected
 * directional effects (not precise predictions).
 */
export const SIMULATION_SCENARIOS = [
  {
    id: 'scenario-baseline',
    title: 'Baseline (no policy change)',
    description: 'Current-state simulation with all levers disabled. Reference point for sensitivity analysis.',
    leverIds: [],
    personaIds: SIMULATION_PERSONAS.map((p) => p.id),
    serviceIds: SIMULATION_SERVICES.map((s) => s.id),
    officeIds: SIMULATION_OFFICES.map((o) => o.id),
    expectedDirectionalEffects: ['baseline reference'],
  },
  {
    id: 'scenario-digital-ration-card',
    title: 'Digital Ration Card rollout',
    description: 'Enable online Ration Card applications; measure demand shift and travel-burden reduction.',
    leverIds: ['lever-online-ration-card'],
    personaIds: SIMULATION_PERSONAS.map((p) => p.id),
    serviceIds: SIMULATION_SERVICES.map((s) => s.id),
    officeIds: SIMULATION_OFFICES.map((o) => o.id),
    expectedDirectionalEffects: [
      'ration-card in-person demand decreases',
      'online adoption for ration card rises',
      'travel burden for ration-card seekers decreases',
    ],
  },
  {
    id: 'scenario-mobile-csc-ward-3',
    title: 'Mobile CSC kiosk in Ward 3',
    description: 'Deploy a mobile CSC kiosk to reduce travel burden for Ward 3 residents.',
    leverIds: ['lever-mobile-csc-ward-3'],
    personaIds: SIMULATION_PERSONAS.map((p) => p.id),
    serviceIds: SIMULATION_SERVICES.map((s) => s.id),
    officeIds: SIMULATION_OFFICES.map((o) => o.id),
    expectedDirectionalEffects: [
      'travel minutes to Ward 3-serving offices decrease',
      'in-person demand at mobile kiosk rises',
    ],
  },
  {
    id: 'scenario-document-bundle',
    title: 'Income + Caste document bundle',
    description: 'Bundle document requirements to reduce document-gathering burden.',
    leverIds: ['lever-document-bundle-income-caste'],
    personaIds: SIMULATION_PERSONAS.map((p) => p.id),
    serviceIds: ['service-income-certificate', 'service-caste-certificate'],
    officeIds: SIMULATION_OFFICES.map((o) => o.id),
    expectedDirectionalEffects: [
      'document requirements per application decrease',
      'document-readiness barrier lowers',
    ],
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getPersona(id) {
  return SIMULATION_PERSONAS.find((p) => p.id === id) || null;
}

export function getService(id) {
  return SIMULATION_SERVICES.find((s) => s.id === id) || null;
}

export function getOffice(id) {
  return SIMULATION_OFFICES.find((o) => o.id === id) || null;
}

export function getLever(id) {
  return POLICY_LEVERS.find((l) => l.id === id) || null;
}

export function getScenario(id) {
  return SIMULATION_SCENARIOS.find((s) => s.id === id) || null;
}

export function listPersonas() {
  return SIMULATION_PERSONAS;
}

export function listServices() {
  return SIMULATION_SERVICES;
}

export function listOffices() {
  return SIMULATION_OFFICES;
}

export function listLevers() {
  return POLICY_LEVERS;
}

export function listScenarios() {
  return SIMULATION_SCENARIOS;
}

export function listAggregateStats() {
  return AGGREGATE_PUBLIC_STATS;
}

export const SIMULATION_TESTABLES = {
  getPersona,
  getService,
  getOffice,
  getLever,
  getScenario,
  listPersonas,
  listServices,
  listOffices,
  listLevers,
  listScenarios,
  listAggregateStats,
};
