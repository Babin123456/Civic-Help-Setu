import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateDenseEmbedding,
  cosineSimilarity,
  computeBM25Score,
  reciprocalRankFusion,
  hybridIndexStore,
  computeContentHash,
} from './hybridRetrievalService';

const MOCK_SERVICES = [
  {
    id: 'aadhaar-update',
    title: 'Aadhaar Address Update',
    department: 'UIDAI',
    description: 'Online demographic update portal for changing residential address on Aadhaar card.',
    officialUrl: 'https://myaadhaar.uidai.gov.in',
    status: 'published',
    eligibility: ['Indian citizen holding valid Aadhaar', 'Valid address proof document'],
    documents: ['Utility bill or passport or bank passbook'],
    process: ['Login with OTP', 'Upload supporting document', 'Pay fee of 50 rupees'],
    fees: { amount: 50, currency: 'INR' },
  },
  {
    id: 'driving-licence-renewal',
    title: 'Driving Licence Renewal',
    department: 'Ministry of Road Transport and Highways',
    description: 'Procedure to renew expired permanent motor vehicle driving licence via Parivahan Sewa.',
    officialUrl: 'https://parivahan.gov.in',
    status: 'published',
    eligibility: ['Expired licence holder within grace period'],
    documents: ['Form 9', 'Medical Certificate Form 1A', 'Current driving licence'],
    process: ['Submit application online', 'Book biometric slot', 'Collect renewed DL card'],
    fees: { amount: 200, currency: 'INR' },
  },
  {
    id: 'draft-pension-scheme',
    title: 'Draft Old Age Pension Scheme',
    department: 'Social Welfare Department',
    description: 'Unpublished scheme draft.',
    isDraft: true,
    status: 'pending',
  },
  {
    id: 'archived-covid-pass',
    title: 'COVID-19 Curfew E-Pass',
    department: 'Disaster Management Authority',
    description: 'Historical pandemic curfew pass.',
    archived: true,
  },
];

describe('Hybrid Dense-Sparse Retrieval with RRF (#606)', () => {
  beforeEach(() => {
    hybridIndexStore.buildIndex(MOCK_SERVICES);
  });

  it('excludes draft, pending, or archived services from hybrid index', () => {
    const indexedServiceIds = new Set(hybridIndexStore.chunks.map((c) => c.serviceId));
    expect(indexedServiceIds.has('aadhaar-update')).toBe(true);
    expect(indexedServiceIds.has('driving-licence-renewal')).toBe(true);
    expect(indexedServiceIds.has('draft-pension-scheme')).toBe(false);
    expect(indexedServiceIds.has('archived-covid-pass')).toBe(false);
  });

  it('stores content hash and model metadata with each vector', () => {
    for (const [chunkId, meta] of hybridIndexStore.vectors.entries()) {
      expect(meta.vector).toBeDefined();
      expect(meta.vector.length).toBe(64);
      expect(meta.contentHash).toMatch(/^h_/);
      expect(meta.modelName).toBe('civic-multilingual-hash-v1');
      expect(meta.modelVersion).toBe('1.0.0');
    }
  });

  it('performs sparse exact token matching for acronyms and statutory terms', () => {
    const res = hybridIndexStore.retrieve({
      query: 'UIDAI OTP verification',
      services: MOCK_SERVICES,
    });

    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].serviceId).toBe('aadhaar-update');
    expect(res.results[0].sparseRank).toBeDefined();
    expect(res.diagnostics.sparseCandidates).toBeGreaterThan(0);
  });

  it('performs dense semantic matching for citizen paraphrases', () => {
    // Paraphrase without exact keywords "Aadhaar" or "UIDAI"
    const res = hybridIndexStore.retrieve({
      query: 'change residence location on identity card',
      services: MOCK_SERVICES,
    });

    expect(res.results.length).toBeGreaterThan(0);
    const topResult = res.results.find((r) => r.serviceId === 'aadhaar-update');
    expect(topResult).toBeDefined();
    expect(topResult.denseRank).toBeDefined();
  });

  it('combines rankings via Reciprocal Rank Fusion (RRF)', () => {
    const res = hybridIndexStore.retrieve({
      query: 'parivahan renew motor vehicle licence Form 1A',
      services: MOCK_SERVICES,
    });

    expect(res.results.length).toBeGreaterThan(0);
    const dlResult = res.results[0];
    expect(dlResult.serviceId).toBe('driving-licence-renewal');
    expect(dlResult.fusedScore).toBeGreaterThan(0);
    expect(dlResult.sparseRank).toBeDefined();
  });

  it('safely handles empty queries without throwing', () => {
    const res = hybridIndexStore.retrieve({
      query: '   ',
      services: MOCK_SERVICES,
    });

    expect(res.results).toEqual([]);
    expect(res.diagnostics.query).toBe('');
  });

  it('supports incremental re-indexing when published service is updated', () => {
    const updatedAadhaar = {
      ...MOCK_SERVICES[0],
      description: 'Updated biometric e-KYC service with instant iris verification',
    };

    hybridIndexStore.indexService(updatedAadhaar);
    const res = hybridIndexStore.retrieve({
      query: 'instant iris verification',
      services: [updatedAadhaar],
    });

    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].serviceId).toBe('aadhaar-update');
  });

  it('removes vectors immediately when service is removed', () => {
    hybridIndexStore.removeService('driving-licence-renewal');
    const res = hybridIndexStore.retrieve({
      query: 'parivahan licence',
      services: [],
    });

    const hasDl = res.results.some((r) => r.serviceId === 'driving-licence-renewal');
    expect(hasDl).toBe(false);
  });
});
