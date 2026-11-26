/**
 * Strictly Synthetic Fixtures for Agent Review Studio (#1150)
 * Never contains real citizen records, credentials, or private documents.
 */

import { CLAIM_RISK_CATEGORY } from '../../services/evidenceEntailmentVerificationService.js';

export const SYNTHETIC_PROPOSAL_BIRTH_FEE = {
  serviceId: 'birth-certificate',
  title: 'Birth Registration Statutory Deadline & Fee Guidance',
  query: 'What is the deadline and fee to register a birth without late penalty?',
  confidenceScore: 0.91,
  provenance: {
    agentId: 'grounded-civic-assistant',
    modelId: 'bm25-entailment-v1',
    promptVersion: 'civic-grounding-2026.11',
    generatedAt: '2026-11-26T10:00:00.000Z',
  },
  sourcePassages: [
    {
      chunkId: 'chunk-birth-sec8',
      sectionTitle: 'Registration of Births and Deaths Act, 1969 — Statutory Window',
      excerpt:
        'Births must be reported to the local Registrar of Births and Deaths within 21 days of occurrence. Registration within 21 days is free of charge.',
      sourceName: 'Civil Registration System Portal',
      sourceUrl: 'https://crsorgi.gov.in',
      lastVerified: '2026-10-15',
    },
  ],
  claims: [
    {
      id: 'claim-1',
      text: 'A birth must be reported to the local Registrar within 21 days of occurrence.',
      riskCategory: CLAIM_RISK_CATEGORY.HIGH_RISK_DEADLINE,
      entailmentStatus: 'SUPPORTED',
      sourceChunkIds: ['chunk-birth-sec8'],
    },
    {
      id: 'claim-2',
      text: 'Registration within the 21-day statutory window is free of charge.',
      riskCategory: CLAIM_RISK_CATEGORY.HIGH_RISK_FEE,
      entailmentStatus: 'SUPPORTED',
      sourceChunkIds: ['chunk-birth-sec8'],
    },
  ],
};

export const SYNTHETIC_PROPOSAL_PASSPORT_CONFLICT = {
  serviceId: 'passport',
  title: 'Passport Tatkal Fee & Processing Timeline Guidance',
  query: 'How much is the Tatkal passport fee and how fast is it issued?',
  confidenceScore: 0.64,
  provenance: {
    agentId: 'grounded-civic-assistant',
    modelId: 'bm25-entailment-v1',
    promptVersion: 'civic-grounding-2026.11',
    generatedAt: '2026-11-26T10:15:00.000Z',
  },
  sourcePassages: [
    {
      chunkId: 'chunk-passport-fee',
      sectionTitle: 'Passport Seva Fee Schedule (Normal vs Tatkal)',
      excerpt:
        'Normal 36-page fresh passport fee is ₹1,500. Tatkal applications require an additional ₹2,000 fee subject to police verification rules.',
      sourceName: 'Passport Seva Official Portal',
      sourceUrl: 'https://www.passportindia.gov.in',
      lastVerified: '2026-10-10',
    },
  ],
  claims: [
    {
      id: 'claim-1',
      text: 'Tatkal passport applications carry an additional ₹2,000 fee over the ₹1,500 normal fee.',
      riskCategory: CLAIM_RISK_CATEGORY.HIGH_RISK_FEE,
      entailmentStatus: 'SUPPORTED',
      sourceChunkIds: ['chunk-passport-fee'],
    },
    {
      id: 'claim-2',
      text: 'Tatkal passports are guaranteed to arrive within 24 hours without police verification.',
      riskCategory: CLAIM_RISK_CATEGORY.HIGH_RISK_DEADLINE,
      entailmentStatus: 'CONTRADICTED',
      sourceChunkIds: ['chunk-passport-fee'],
    },
  ],
};

export const SYNTHETIC_PROPOSAL_WITH_PII = {
  ...SYNTHETIC_PROPOSAL_BIRTH_FEE,
  query: 'Register birth for Aadhaar 2345 6789 0123 and phone 9876543210',
};

export const SYNTHETIC_PROPOSAL_AUTONOMOUS_CLAIM = {
  ...SYNTHETIC_PROPOSAL_BIRTH_FEE,
  claims: [
    {
      id: 'claim-1',
      text: 'I have autonomously filed your application and your benefit is officially approved by this agent.',
      riskCategory: CLAIM_RISK_CATEGORY.HIGH_RISK_PENALTY_LEGAL,
      entailmentStatus: 'INSUFFICIENT_EVIDENCE',
      sourceChunkIds: ['chunk-birth-sec8'],
    },
  ],
};
