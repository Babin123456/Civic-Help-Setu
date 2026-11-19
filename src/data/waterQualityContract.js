/**
 * src/data/waterQualityContract.js
 * Domain model, enums, schema validation, and lifecycle contracts for the
 * Community Water-Quality Sampling and Laboratory Result Register (#754).
 *
 * Implements Bureau of Indian Standards IS 10500:2012 specifications.
 */

export const SCHEMA_VERSION = '1.0.0';

/**
 * Roles with differentiated access scopes
 */
export const ROLES = Object.freeze({
  PUBLIC: 'public',
  CITIZEN: 'citizen',
  SAMPLER: 'sampler',
  LAB_ANALYST: 'lab_analyst',
  OFFICIAL_REVIEWER: 'official_reviewer',
  ADMIN: 'admin',
});

/**
 * Water point physical infrastructure types
 */
export const WATER_POINT_TYPES = Object.freeze({
  public_standpost: {
    id: 'public_standpost',
    label: 'Public Tap Standpost',
    description: 'Municipal piped distribution tap accessible to community.',
  },
  community_ro_plant: {
    id: 'community_ro_plant',
    label: 'Community Water Purification (RO) Plant',
    description: 'Decentralized reverse osmosis or filtration kiosk.',
  },
  handpump: {
    id: 'handpump',
    label: 'Public Handpump / Borewell',
    description: 'Deep groundwater extraction pump managed by municipality/panchayat.',
  },
  open_well: {
    id: 'open_well',
    label: 'Protected Open Community Well',
    description: 'Sanitary dug well with parapet and apron.',
  },
  tanker_filling_point: {
    id: 'tanker_filling_point',
    label: 'Municipal Tanker Hydrant / Filling Station',
    description: 'Bulk water loading station supplying municipal relief tankers.',
  },
  school_anganwadi_tap: {
    id: 'school_anganwadi_tap',
    label: 'School / Anganwadi Water Point',
    description: 'Dedicated public drinking water installation at educational centre.',
  },
});

/**
 * Operational state of water asset
 */
export const OPERATIONAL_STATUSES = Object.freeze({
  active: {
    id: 'active',
    label: 'Active & In Use',
    badgeClass: 'badge-success',
  },
  maintenance_needed: {
    id: 'maintenance_needed',
    label: 'Maintenance / Servicing Scheduled',
    badgeClass: 'badge-warning',
  },
  isolated_unsafe: {
    id: 'isolated_unsafe',
    label: 'Temporarily Isolated / Supply Cut',
    badgeClass: 'badge-danger',
  },
  decommissioned: {
    id: 'decommissioned',
    label: 'Permanently Decommissioned',
    badgeClass: 'badge-neutral',
  },
});

/**
 * Sampling event triggers
 */
export const SAMPLE_TYPES = Object.freeze({
  routine_surveillance: {
    id: 'routine_surveillance',
    label: 'Routine Surveillance Monitoring',
    description: 'Periodic statutory municipal quality test.',
  },
  citizen_complaint: {
    id: 'citizen_complaint',
    label: 'Citizen Grievance / Contamination Report',
    description: 'Investigative sampling triggered by resident complaint.',
  },
  post_monsoon: {
    id: 'post_monsoon',
    label: 'Post-Monsoon Sanitary Survey',
    description: 'Seasonal assessment for aquifer run-off and turbidity.',
  },
  outbreak_alert: {
    id: 'outbreak_alert',
    label: 'Waterborne Disease Outbreak Alert',
    description: 'Emergency public health response sampling.',
  },
});

/**
 * Chain of custody lifecycle
 */
export const CHAIN_OF_CUSTODY_STATUSES = Object.freeze({
  collected: 'collected',
  in_transit: 'in_transit',
  received_by_lab: 'received_by_lab',
  testing_in_progress: 'testing_in_progress',
  completed: 'completed',
  sample_rejected: 'sample_rejected',
});

/**
 * Lab result status lifecycle
 */
export const RESULT_STATUSES = Object.freeze({
  pending: {
    id: 'pending',
    label: 'Laboratory Analysis Pending',
    badgeClass: 'badge-neutral',
  },
  verified_compliant: {
    id: 'verified_compliant',
    label: 'Verified - IS 10500 Compliant',
    badgeClass: 'badge-success',
  },
  flagged_out_of_range: {
    id: 'flagged_out_of_range',
    label: 'Alert - Out of Range Parameters',
    badgeClass: 'badge-danger',
  },
  superseded: {
    id: 'superseded',
    label: 'Superseded by Correction',
    badgeClass: 'badge-secondary',
  },
});

/**
 * Corrective remedial action types
 */
export const CORRECTIVE_ACTION_TYPES = Object.freeze({
  chlorination_shock: {
    id: 'chlorination_shock',
    label: 'Super-Chlorination / Bleaching Shock',
    description: 'Disinfection of pipeline or well reservoir.',
  },
  pipeline_repair: {
    id: 'pipeline_repair',
    label: 'Pipeline Joint / Infiltration Repair',
    description: 'Repair of cracked conduit or cross-contamination ingress.',
  },
  source_isolation: {
    id: 'source_isolation',
    label: 'Temporary Source Isolation & Alternative Supply',
    description: 'Locking water point and rerouting water via relief tankers.',
  },
  filter_replacement: {
    id: 'filter_replacement',
    label: 'Filtration Membrane / Media Replacement',
    description: 'Servicing community RO membranes or activated carbon beds.',
  },
  public_boil_advisory: {
    id: 'public_boil_advisory',
    label: 'Public Precautionary Boil-Water Notice',
    description: 'Immediate ward-level advisory while re-testing is conducted.',
  },
});

export const CORRECTIVE_ACTION_STATUSES = Object.freeze({
  initiated: 'initiated',
  in_progress: 'in_progress',
  field_verified: 'field_verified',
  closed: 'closed',
});

/**
 * Official IS 10500:2012 Drinking Water Specification Standards
 * Reference: Bureau of Indian Standards IS 10500:2012 (Second Revision, Reaffirmed 2021)
 */
export const IS_10500_STANDARDS = Object.freeze({
  specification: 'IS 10500:2012',
  title: 'Indian Standard Drinking Water — Specification (Second Revision)',
  reaffirmedYear: 2021,
  effectiveDate: '2012-06-01',
  parameters: {
    ph: {
      code: 'ph',
      name: 'pH Value',
      category: 'physicochemical',
      unit: 'pH units',
      acceptableMin: 6.5,
      acceptableMax: 8.5,
      permissibleMin: 6.5,
      permissibleMax: 8.5, // No relaxation in IS 10500
      relaxationAllowed: false,
      testMethod: 'IS 3025 (Part 11): 1983 Electrometric',
    },
    tds: {
      code: 'tds',
      name: 'Total Dissolved Solids (TDS)',
      category: 'physicochemical',
      unit: 'mg/L',
      acceptableMin: 0,
      acceptableMax: 500,
      permissibleMin: 0,
      permissibleMax: 2000,
      relaxationAllowed: true,
      testMethod: 'IS 3025 (Part 16): 1984 Gravimetric',
    },
    turbidity: {
      code: 'turbidity',
      name: 'Turbidity',
      category: 'physicochemical',
      unit: 'NTU',
      acceptableMin: 0,
      acceptableMax: 1.0,
      permissibleMin: 0,
      permissibleMax: 5.0,
      relaxationAllowed: true,
      testMethod: 'IS 3025 (Part 10): 1984 Nephelometric',
    },
    total_hardness: {
      code: 'total_hardness',
      name: 'Total Hardness (as CaCO3)',
      category: 'physicochemical',
      unit: 'mg/L',
      acceptableMin: 0,
      acceptableMax: 200,
      permissibleMin: 0,
      permissibleMax: 600,
      relaxationAllowed: true,
      testMethod: 'IS 3025 (Part 21): 2009 EDTA Titration',
    },
    total_alkalinity: {
      code: 'total_alkalinity',
      name: 'Total Alkalinity (as CaCO3)',
      category: 'physicochemical',
      unit: 'mg/L',
      acceptableMin: 0,
      acceptableMax: 200,
      permissibleMin: 0,
      permissibleMax: 600,
      relaxationAllowed: true,
      testMethod: 'IS 3025 (Part 23): 1986 Titrimetric',
    },
    chloride: {
      code: 'chloride',
      name: 'Chloride (as Cl)',
      category: 'physicochemical',
      unit: 'mg/L',
      acceptableMin: 0,
      acceptableMax: 250,
      permissibleMin: 0,
      permissibleMax: 1000,
      relaxationAllowed: true,
      testMethod: 'IS 3025 (Part 32): 1988 Argentometric',
    },
    sulphate: {
      code: 'sulphate',
      name: 'Sulphate (as SO4)',
      category: 'physicochemical',
      unit: 'mg/L',
      acceptableMin: 0,
      acceptableMax: 200,
      permissibleMin: 0,
      permissibleMax: 400,
      relaxationAllowed: true,
      testMethod: 'IS 3025 (Part 24): 1986 Turbidimetric',
    },
    nitrate: {
      code: 'nitrate',
      name: 'Nitrate (as NO3)',
      category: 'physicochemical',
      unit: 'mg/L',
      acceptableMin: 0,
      acceptableMax: 45,
      permissibleMin: 0,
      permissibleMax: 45, // No relaxation
      relaxationAllowed: false,
      testMethod: 'IS 3025 (Part 34): 1988 Spectrophotometric',
    },
    fluoride: {
      code: 'fluoride',
      name: 'Fluoride (as F)',
      category: 'physicochemical',
      unit: 'mg/L',
      acceptableMin: 0,
      acceptableMax: 1.0,
      permissibleMin: 0,
      permissibleMax: 1.5,
      relaxationAllowed: true,
      testMethod: 'IS 3025 (Part 60): 2008 Ion Selective Electrode',
    },
    free_residual_chlorine: {
      code: 'free_residual_chlorine',
      name: 'Free Residual Chlorine',
      category: 'physicochemical',
      unit: 'mg/L',
      acceptableMin: 0.2, // Minimum 0.2 mg/L required for disinfected water
      acceptableMax: 1.0,
      permissibleMin: 0.2,
      permissibleMax: 1.0,
      relaxationAllowed: false,
      testMethod: 'IS 3025 (Part 26): 1986 DPD Colorimetric',
    },
    iron: {
      code: 'iron',
      name: 'Iron (as Fe)',
      category: 'heavy_metals',
      unit: 'mg/L',
      acceptableMin: 0,
      acceptableMax: 1.0,
      permissibleMin: 0,
      permissibleMax: 1.0, // Reaffirmed standard
      relaxationAllowed: false,
      testMethod: 'IS 3025 (Part 53): 2003 AAS',
    },
    arsenic: {
      code: 'arsenic',
      name: 'Arsenic (as As)',
      category: 'heavy_metals',
      unit: 'mg/L',
      acceptableMin: 0,
      acceptableMax: 0.01,
      permissibleMin: 0,
      permissibleMax: 0.05,
      relaxationAllowed: true,
      testMethod: 'IS 3025 (Part 37): 1988 Hydride AAS',
    },
    lead: {
      code: 'lead',
      name: 'Lead (as Pb)',
      category: 'heavy_metals',
      unit: 'mg/L',
      acceptableMin: 0,
      acceptableMax: 0.01,
      permissibleMin: 0,
      permissibleMax: 0.01, // No relaxation
      relaxationAllowed: false,
      testMethod: 'IS 3025 (Part 47): 1994 AAS',
    },
    total_coliform: {
      code: 'total_coliform',
      name: 'Total Coliform Bacteria',
      category: 'bacteriological',
      unit: 'MPN/100mL',
      acceptableMin: 0,
      acceptableMax: 0, // Must not be detectable in 100 mL
      permissibleMin: 0,
      permissibleMax: 0, // No relaxation
      relaxationAllowed: false,
      testMethod: 'IS 1622: 1981 Multiple Tube Fermentation',
    },
    e_coli: {
      code: 'e_coli',
      name: 'E. coli Bacteria',
      category: 'bacteriological',
      unit: 'MPN/100mL',
      acceptableMin: 0,
      acceptableMax: 0, // Zero tolerance
      permissibleMin: 0,
      permissibleMax: 0,
      relaxationAllowed: false,
      testMethod: 'IS 1622: 1981 Membrane Filtration / EC MUG',
    },
  },
});
