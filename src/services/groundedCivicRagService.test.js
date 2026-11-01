import { describe, it, expect } from 'vitest';
import {
  tokenize,
  isApprovedService,
  createServiceChunks,
  retrieveKnowledge,
  queryCivicKnowledge,
  RAG_CONFIDENCE_LEVELS,
} from './groundedCivicRagService';

describe('groundedCivicRagService (#400)', () => {
  const approvedService = {
    id: 'pm-kisan-scheme',
    title: 'PM Kisan Samman Nidhi Yojana',
    department: 'Ministry of Agriculture and Farmers Welfare',
    description: 'Income support of ₹6,000 per year in three equal installments to all landholding farmer families.',
    eligibility: [
      'Small and marginal landholder farmer family',
      'Valid cultivable land holding in applicant name',
    ],
    documents: [
      'Aadhaar card linked to bank account',
      'Land ownership records (Khasra/Khatauni)',
      'Active bank account passbook',
    ],
    process: [
      'Self-registration via PM-KISAN portal or Common Service Center (CSC)',
      'Biometric or OTP-based eKYC verification',
      'Approval by state nodal agriculture officer',
    ],
    fees: 'Free of Cost',
    officialUrl: 'https://pmkisan.gov.in',
    archived: false,
    status: 'approved',
  };

  const draftService = {
    id: 'draft-pension-yojana',
    title: 'Draft Unverified Universal Pension',
    department: 'Social Welfare',
    isDraft: true,
    status: 'pending',
    eligibility: ['Age 50+ (Draft rule)'],
  };

  describe('isApprovedService filter', () => {
    it('approves active published services and excludes drafts/archived/pending records', () => {
      expect(isApprovedService(approvedService)).toBe(true);
      expect(isApprovedService(draftService)).toBe(false);
      expect(isApprovedService({ ...approvedService, archived: true })).toBe(false);
      expect(isApprovedService({ ...approvedService, isDraft: true })).toBe(false);
      expect(isApprovedService({ ...approvedService, status: 'rejected' })).toBe(false);
    });
  });

  describe('createServiceChunks and retrieval', () => {
    it('creates structured semantic chunks for approved services with metadata', () => {
      const chunks = createServiceChunks(approvedService);
      expect(chunks.length).toBeGreaterThanOrEqual(4); // general, elig, docs, process, fees
      expect(chunks.some((c) => c.field === 'eligibility')).toBe(true);
      expect(chunks.some((c) => c.field === 'documents')).toBe(true);
      expect(chunks[0].serviceId).toBe('pm-kisan-scheme');
      expect(chunks[0].officialUrl).toBe('https://pmkisan.gov.in');
    });

    it('returns empty chunks for unapproved draft records', () => {
      const chunks = createServiceChunks(draftService);
      expect(chunks.length).toBe(0);
    });
  });

  describe('queryCivicKnowledge', () => {
    const catalog = [approvedService, draftService];

    it('returns a grounded answer with traceable citations for a supported query', () => {
      const query = 'What documents are required for PM Kisan Samman Nidhi?';
      const result = queryCivicKnowledge(query, catalog);

      expect(result.status).toBe('SUPPORTED');
      expect(result.confidenceLevel).toBe(RAG_CONFIDENCE_LEVELS.HIGH);
      expect(result.coverageScore).toBeGreaterThanOrEqual(50);
      expect(result.answer).toContain('PM Kisan Samman Nidhi Yojana');
      expect(result.answer).toContain('Aadhaar card linked to bank account');
      expect(result.citations.length).toBeGreaterThan(0);
      expect(result.citations[0].serviceId).toBe('pm-kisan-scheme');
      expect(result.citations[0].officialUrl).toBe('https://pmkisan.gov.in');
    });

    it('returns partially supported answer with uncertainty notice for broad queries', () => {
      const query = 'What are the land limits and solar subsidy for PM Kisan farmers?';
      const result = queryCivicKnowledge(query, catalog);

      expect(result.status).toBe('PARTIALLY_SUPPORTED');
      expect(result.confidenceLevel).toBe(RAG_CONFIDENCE_LEVELS.MEDIUM);
      expect(result.uncertaintyAcknowledged).toBe(true);
      expect(result.answer).toContain('Note: Some specific details or regional rules may not be fully covered');
      expect(result.citations.length).toBeGreaterThan(0);
    });

    it('explicitly declines to guess for unsupported queries and states no source was found', () => {
      const query = 'How do I renew my commercial rocket propulsion launch permit in California?';
      const result = queryCivicKnowledge(query, catalog);

      expect(result.status).toBe('UNSUPPORTED');
      expect(result.confidenceLevel).toBe(RAG_CONFIDENCE_LEVELS.UNSUPPORTED);
      expect(result.answer).toContain('No verified catalogue sources found matching this inquiry');
      expect(result.answer).toContain('cannot confirm the requirements without verified documentation');
      expect(result.citations.length).toBe(0);
      expect(result.uncertaintyAcknowledged).toBe(true);
    });

    it('never retrieves or cites unapproved draft services', () => {
      const query = 'Draft Unverified Universal Pension age criteria';
      const result = queryCivicKnowledge(query, catalog);

      // Draft service was excluded from index, so result must be unsupported or not cite the draft
      expect(result.citations.some((c) => c.serviceId === 'draft-pension-yojana')).toBe(false);
    });
  });
});
