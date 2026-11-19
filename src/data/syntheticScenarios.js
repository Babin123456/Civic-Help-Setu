/**
 * src/data/syntheticScenarios.js
 *
 * Predefined, reproducible scenarios and default profile configurations
 * for generating synthetic civic test datasets (#778).
 */

export const SYNTHETIC_SCENARIOS = [
  {
    id: 'scen-pune-grievance-surge',
    title: 'Ward Grievance Backlog & Escalation Surge',
    badge: 'High Stress',
    description: 'Simulates a sudden monsoon surge in municipal complaints (waterlogging, contaminated tap water, road potholes) with 25% statutory delay breaches and high escalation rates.',
    jurisdiction: {
      state: 'Maharashtra',
      district: 'Pune',
      ward: 'Ward 3 - Shivajinagar-Ghole Road',
    },
    defaultSeed: 20260714,
    scaleConfig: {
      servicesCount: 6,
      officesCount: 4,
      applicationsCount: 40,
      grievancesCount: 30,
    },
    edgeCaseRates: {
      statutoryDeadlineOverduePct: 0.35,
      queryDeficiencyPct: 0.20,
      malformedOptionalFieldsPct: 0.08,
      multiScriptNamesPct: 0.40,
    },
    languageDistribution: {
      en: 0.30,
      mr: 0.60,
      hi: 0.10,
    },
  },
  {
    id: 'scen-maha-rts-compliance-audit',
    title: 'Right to Services (RTS) Statutory Compliance Audit',
    badge: 'Compliance & SLA',
    description: 'Generates applications across certificates, caste attestations, and fire NOCs with full multi-stage Markov status histories to evaluate SLA tracking, cure window timers, and appeals.',
    jurisdiction: {
      state: 'Maharashtra',
      district: 'Mumbai Suburban',
      ward: 'Ward K-East (Andheri East)',
    },
    defaultSeed: 4294967,
    scaleConfig: {
      servicesCount: 8,
      officesCount: 3,
      applicationsCount: 60,
      grievancesCount: 15,
    },
    edgeCaseRates: {
      statutoryDeadlineOverduePct: 0.15,
      queryDeficiencyPct: 0.25,
      malformedOptionalFieldsPct: 0.05,
      multiScriptNamesPct: 0.30,
    },
    languageDistribution: {
      en: 0.50,
      mr: 0.35,
      hi: 0.15,
    },
  },
  {
    id: 'scen-delhi-welfare-onboarding',
    title: 'Multi-Lingual Welfare & Registration Pipeline',
    badge: 'Diversity & i18n',
    description: 'Optimized for front-end rendering and screen-reader tests with dense bilingual Hindi/English records, extreme ages, and diverse document checklists.',
    jurisdiction: {
      state: 'Delhi',
      district: 'Central Delhi',
      ward: 'Civil Lines Ward',
    },
    defaultSeed: 98765432,
    scaleConfig: {
      servicesCount: 5,
      officesCount: 2,
      applicationsCount: 50,
      grievancesCount: 10,
    },
    edgeCaseRates: {
      statutoryDeadlineOverduePct: 0.10,
      queryDeficiencyPct: 0.12,
      malformedOptionalFieldsPct: 0.04,
      multiScriptNamesPct: 0.55,
    },
    languageDistribution: {
      en: 0.40,
      hi: 0.60,
    },
  },
  {
    id: 'scen-bengaluru-utility-emergencies',
    title: 'Urban Water & Municipal Utility Disruptions',
    badge: 'Fast Lifecycle',
    description: 'Models fast turnaround emergency services (such as municipal water tanker deliveries, road cutting permits, tree fall hazard clearings) with tight 24-48 hour resolution cycles.',
    jurisdiction: {
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      ward: 'Ward 150 - Bellandur',
    },
    defaultSeed: 55443322,
    scaleConfig: {
      servicesCount: 4,
      officesCount: 2,
      applicationsCount: 35,
      grievancesCount: 20,
    },
    edgeCaseRates: {
      statutoryDeadlineOverduePct: 0.20,
      queryDeficiencyPct: 0.08,
      malformedOptionalFieldsPct: 0.02,
      multiScriptNamesPct: 0.25,
    },
    languageDistribution: {
      en: 0.70,
      ta: 0.15,
      hi: 0.15,
    },
  },
  {
    id: 'scen-custom-configurable',
    title: 'Custom Contributor Configurator',
    badge: 'Fully Configurable',
    description: 'Start with a clean slate to manually configure volume, seeds, failure rates, and localized jurisdictions for targeted unit, integration, or visual testing.',
    jurisdiction: {
      state: 'Maharashtra',
      district: 'Pune',
      ward: 'All Wards',
    },
    defaultSeed: 1010101,
    scaleConfig: {
      servicesCount: 5,
      officesCount: 3,
      applicationsCount: 25,
      grievancesCount: 10,
    },
    edgeCaseRates: {
      statutoryDeadlineOverduePct: 0.10,
      queryDeficiencyPct: 0.10,
      malformedOptionalFieldsPct: 0.05,
      multiScriptNamesPct: 0.20,
    },
    languageDistribution: {
      en: 0.50,
      mr: 0.35,
      hi: 0.15,
    },
  },
];

export const SCHEMA_DEFINITIONS = {
  version: '1.0.0',
  entities: {
    SyntheticService: {
      idPrefix: 'SYN-SRV-',
      requiredFields: ['id', 'name', 'category', 'department', 'statutoryDays', 'fee', 'feeType', 'isSynthetic'],
      foreignKeys: [],
    },
    SyntheticOffice: {
      idPrefix: 'SYN-OFF-',
      requiredFields: ['id', 'name', 'type', 'state', 'district', 'pincode', 'address', 'isSynthetic'],
      foreignKeys: [],
    },
    SyntheticApplication: {
      idPrefix: 'SYN-APP-',
      requiredFields: ['id', 'serviceId', 'officeId', 'applicantPseudonym', 'status', 'appliedDate', 'timeline', 'isSynthetic'],
      foreignKeys: [
        { field: 'serviceId', targetEntity: 'SyntheticService' },
        { field: 'officeId', targetEntity: 'SyntheticOffice' },
      ],
    },
    SyntheticGrievance: {
      idPrefix: 'SYN-GRV-',
      requiredFields: ['id', 'serviceId', 'categoryCode', 'title', 'severity', 'status', 'filedDate', 'isSynthetic'],
      foreignKeys: [
        { field: 'serviceId', targetEntity: 'SyntheticService' },
        { field: 'applicationId', targetEntity: 'SyntheticApplication', optional: true },
      ],
    },
  },
};
