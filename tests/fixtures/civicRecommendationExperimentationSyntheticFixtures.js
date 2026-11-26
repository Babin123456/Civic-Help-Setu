/**
 * tests/fixtures/civicRecommendationExperimentationSyntheticFixtures.js
 *
 * Synthetic test fixtures for the Civic Service Recommendation Experimentation
 * Platform (#1193).
 *
 * Privacy & Safety Guarantee:
 * Strictly non-citizen fixtures. Contains no real citizen records, credentials,
 * phone numbers, addresses, Aadhaar numbers, PAN cards, or sensitive prompts.
 */

export const SYNTHETIC_EXPERIMENTS = Object.freeze([
  {
    id: 'exp-document-readiness-boost',
    name: 'Document Readiness Prioritization',
    description: 'Compares document readiness weight 0.25 vs 0.40 to evaluate application completion rates.',
    status: 'active',
    variants: [
      {
        id: 'control',
        name: 'Standard Document Weight',
        weight: 50,
        strategyConfig: { documentWeight: 0.25, intentWeight: 0.35 }
      },
      {
        id: 'treatment-doc-heavy',
        name: 'High Document Weight',
        weight: 50,
        strategyConfig: { documentWeight: 0.40, intentWeight: 0.20 }
      }
    ],
    guardrails: {
      minRelevanceScore: 0.65,
      minLanguageCoverage: 0.85,
      maxErrorRate: 0.03,
      minCohortSize: 25
    },
    audienceCriteria: {
      preferredLanguage: 'hi',
      deviceType: 'mobile'
    },
    optInRequired: true,
    salt: 'synthetic-salt-alpha'
  },
  {
    id: 'exp-distance-decay-test',
    name: 'Ward Distance Decay Strategy',
    description: 'Evaluates distance penalization on urban civic services.',
    status: 'draft',
    variants: [
      { id: 'control', name: 'Zero Distance Decay', weight: 50 },
      { id: 'treatment-decay', name: 'Linear Distance Decay', weight: 50 }
    ],
    guardrails: {
      minRelevanceScore: 0.60,
      minLanguageCoverage: 0.80,
      maxErrorRate: 0.05,
      minCohortSize: 20
    },
    audienceCriteria: {
      regionCode: 'UP-LKO'
    },
    optInRequired: true,
    salt: 'synthetic-salt-beta'
  }
]);

export const SYNTHETIC_SAFE_CONTEXTS = Object.freeze([
  { preferredLanguage: 'en', deviceType: 'desktop', regionCode: 'UP-CNB' },
  { preferredLanguage: 'hi', deviceType: 'mobile', regionCode: 'UP-LKO' },
  { preferredLanguage: 'ur', deviceType: 'mobile', regionCode: 'UP-VNS' }
]);

export const SYNTHETIC_PROHIBITED_CONTEXTS = Object.freeze([
  { caste: 'sc', regionCode: 'UP-LKO' },
  { religion: 'hindu', deviceType: 'mobile' },
  { aadhaarNumber: '9999-9999-9999' },
  { gender: 'female', userIncome: 'below_poverty_line' }
]);

export const SYNTHETIC_CITIZEN_IDS = Object.freeze([
  'synthetic-citizen-001',
  'synthetic-citizen-002',
  'synthetic-citizen-003',
  'synthetic-citizen-004',
  'synthetic-citizen-005'
]);
