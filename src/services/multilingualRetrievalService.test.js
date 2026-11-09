import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectQueryLanguage,
  normalizeTransliteratedQuery,
  generateMultilingualEmbedding,
  multilingualRetrievalEngine,
} from './multilingualRetrievalService';

const MOCK_SERVICES = [
  {
    id: 'birth-certificate',
    title: 'Birth Certificate Issuance',
    department: 'Municipal Corporation',
    description: 'Procedure to obtain official birth certificate and register new born child.',
    officialUrl: 'https://crsorgi.gov.in',
    status: 'published',
  },
  {
    id: 'land-mutation',
    title: 'Land Mutation and Transfer',
    department: 'Revenue Department',
    description: 'Application for land mutation, dakhil kharij, and recording transfer of rights.',
    officialUrl: 'https://landrecords.gov.in',
    status: 'published',
  },
  {
    id: 'disability-udid',
    title: 'UDID Disability Certificate',
    department: 'Department of Empowerment of Persons with Disabilities',
    description: 'Unique Disability ID (UDID) card registration and medical certificate.',
    officialUrl: 'https://swavlambancard.gov.in',
    status: 'published',
  },
];

describe('Multilingual Embedding and Transliteration Retrieval (#607)', () => {
  beforeEach(() => {
    multilingualRetrievalEngine.indexServices(MOCK_SERVICES);
  });

  it('detects Devanagari script accurately', () => {
    const info = detectQueryLanguage('जन्म प्रमाण पत्र कैसे बनाएं');
    expect(info.script).toBe('devanagari');
    expect(info.language).toBe('hi');
    expect(info.isIndic).toBe(true);
  });

  it('detects Hinglish / Latin script transliteration keywords', () => {
    const info = detectQueryLanguage('dakhil kharij online aavedan');
    expect(info.script).toBe('latin');
    expect(info.language).toBe('hinglish');
    expect(info.isIndic).toBe(true);
  });

  it('normalizes Unicode NFC and expands transliteration dictionary tokens', () => {
    const norm = normalizeTransliteratedQuery('divyang pramanpatra apply');
    expect(norm.normalized).toBe('divyang pramanpatra apply');
    expect(norm.expandedTokens).toContain('disability');
    expect(norm.expandedTokens).toContain('udid');
    expect(norm.expandedTokens).toContain('certificate');
  });

  it('retrieves correct service for Hinglish query', () => {
    const res = multilingualRetrievalEngine.retrieve({
      query: 'dakhil kharij zameen aavedan',
      topK: 2,
    });

    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].serviceId).toBe('land-mutation');
    expect(res.results[0].isTranslation).toBe(true);
    expect(res.results[0].quotationNotice).toContain('not a verbatim statutory quotation');
  });

  it('retrieves correct service for disability query in transliterated Latin', () => {
    const res = multilingualRetrievalEngine.retrieve({
      query: 'divyang viklang card form',
      topK: 2,
    });

    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].serviceId).toBe('disability-udid');
  });

  it('handles empty and whitespace queries gracefully', () => {
    const res = multilingualRetrievalEngine.retrieve({ query: '   ' });
    expect(res.results).toEqual([]);
    expect(res.diagnostics.detectedLanguage).toBe('unknown');
  });

  it('provides complete diagnostic metadata in retrieval response', () => {
    const res = multilingualRetrievalEngine.retrieve({ query: 'birth certificate process' });
    expect(res.diagnostics.modelName).toBe('civic-indic-multilingual-v1');
    expect(res.diagnostics.modelVersion).toBe('1.0.0');
    expect(res.diagnostics.originalQuery).toBe('birth certificate process');
  });
});
