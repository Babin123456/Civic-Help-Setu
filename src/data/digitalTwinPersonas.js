/**
 * src/data/digitalTwinPersonas.js
 * Synthetic Persona Fixtures for the Civic Workflow Digital Twin (#1157).
 *
 * PRIVACY GUARANTEE:
 * All personas in this file are 100% synthetic models designed for simulation
 * stress-testing. They contain NO real citizen records, government credentials,
 * Aadhaar/PAN numbers, live phone numbers, or private documents.
 */

import { PERSONA_ARCHETYPES } from './digitalTwinContract.js';

export const SYNTHETIC_PERSONAS = [
  {
    id: 'synth-persona-standard',
    archetype: PERSONA_ARCHETYPES.STANDARD_CITIZEN,
    name: 'Synthetic Citizen: Priya Sharma',
    isSynthetic: true,
    description: 'Long-term resident with standard civil records, bank passbook, salary slip, and mobile-linked identity.',
    attributes: {
      age: 34,
      isSeniorCitizen: false,
      isBPL: false,
      annualHouseholdIncome: 450000,
      hasLocalPropertyTaxReceipt: true,
      hasRegisteredRentAgreement: false,
      hasSmartphoneAndInternet: true,
      biometricReliabilityScore: 0.95,
      requiresWheelchairAccess: false,
      preferredChannel: 'ONLINE_PORTAL',
    },
    availableDocuments: [
      'DOC_AADHAAR_SYNTHETIC',
      'DOC_PAN_SYNTHETIC',
      'DOC_ELECTRICITY_BILL_LOCAL',
      'DOC_SALARY_SLIP_CURRENT',
      'DOC_BANK_PASSBOOK_6M',
      'DOC_PASSPORT_SYNTHETIC',
    ],
  },
  {
    id: 'synth-persona-migrant-tenant',
    archetype: PERSONA_ARCHETYPES.MIGRANT_TENANT,
    name: 'Synthetic Citizen: Rajesh Mahto',
    isSynthetic: true,
    description: 'Interstate migrant tenant worker living on monthly informal lease; lacks local utility bills or property deeds.',
    attributes: {
      age: 28,
      isSeniorCitizen: false,
      isBPL: true,
      annualHouseholdIncome: 140000,
      hasLocalPropertyTaxReceipt: false,
      hasRegisteredRentAgreement: true,
      hasSmartphoneAndInternet: true,
      biometricReliabilityScore: 0.88,
      requiresWheelchairAccess: false,
      preferredChannel: 'CSC_FACILITATED',
    },
    availableDocuments: [
      'DOC_AADHAAR_SYNTHETIC',
      'DOC_VOTER_ID_ORIGIN_STATE',
      'DOC_RENT_AGREEMENT_CURRENT',
      'DOC_EMPLOYER_ATTESTATION_LETTER',
      'DOC_BPL_RATION_CARD_SYNTHETIC',
    ],
  },
  {
    id: 'synth-persona-senior-citizen',
    archetype: PERSONA_ARCHETYPES.SENIOR_CITIZEN_BIOMETRIC_FAIL,
    name: 'Synthetic Citizen: Devaki Amma',
    isSynthetic: true,
    description: '76-year-old pensioner living alone. Degraded epidermal ridge fingerprint biometrics causing POS/UIDAI scanner retries.',
    attributes: {
      age: 76,
      isSeniorCitizen: true,
      isBPL: true,
      annualHouseholdIncome: 96000,
      hasLocalPropertyTaxReceipt: true,
      hasRegisteredRentAgreement: false,
      hasSmartphoneAndInternet: false,
      biometricReliabilityScore: 0.15, // High likelihood of biometric sensor failure
      requiresWheelchairAccess: false,
      requiresGroundFloorDesk: true,
      preferredChannel: 'PHYSICAL_COUNTER_WITH_ASSISTANCE',
    },
    availableDocuments: [
      'DOC_AADHAAR_SYNTHETIC',
      'DOC_PENSION_PAYMENT_ORDER',
      'DOC_SENIOR_CITIZEN_ID',
      'DOC_MUNICIPAL_PROPERTY_RECEIPT',
    ],
  },
  {
    id: 'synth-persona-low-income-student',
    archetype: PERSONA_ARCHETYPES.LOW_INCOME_STUDENT,
    name: 'Synthetic Citizen: Pooja Meena',
    isSynthetic: true,
    description: 'First-generation college applicant from disadvantaged background seeking statutory fee waiver or scholarship.',
    attributes: {
      age: 19,
      isSeniorCitizen: false,
      isBPL: true,
      annualHouseholdIncome: 75000,
      hasLocalPropertyTaxReceipt: false,
      hasRegisteredRentAgreement: false,
      hasSmartphoneAndInternet: true,
      biometricReliabilityScore: 0.92,
      requiresWheelchairAccess: false,
      preferredChannel: 'ONLINE_PORTAL',
    },
    availableDocuments: [
      'DOC_AADHAAR_SYNTHETIC',
      'DOC_STUDENT_ID_COLLEGE',
      'DOC_INCOME_DECLARATION_SELF',
      'DOC_CASTE_CERTIFICATE_SYNTHETIC',
      'DOC_PREVIOUS_YEAR_MARKSHEET',
    ],
  },
  {
    id: 'synth-persona-pwd-access',
    archetype: PERSONA_ARCHETYPES.ACCESSIBILITY_CONSTRAINED,
    name: 'Synthetic Citizen: Karthik Sundaram',
    isSynthetic: true,
    description: 'Wheelchair user requiring barrier-free ramps, ground-floor counters, or dedicated digital representative filing.',
    attributes: {
      age: 41,
      isSeniorCitizen: false,
      isBPL: false,
      annualHouseholdIncome: 380000,
      hasLocalPropertyTaxReceipt: true,
      hasRegisteredRentAgreement: false,
      hasSmartphoneAndInternet: true,
      biometricReliabilityScore: 0.90,
      requiresWheelchairAccess: true,
      requiresGroundFloorDesk: true,
      preferredChannel: 'HYBRID_DIGITAL_REPRESENTATIVE',
    },
    availableDocuments: [
      'DOC_AADHAAR_SYNTHETIC',
      'DOC_PAN_SYNTHETIC',
      'DOC_UDID_DISABILITY_CARD',
      'DOC_ELECTRICITY_BILL_LOCAL',
    ],
  },
];
