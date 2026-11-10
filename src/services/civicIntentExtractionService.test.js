import { describe, it, expect } from 'vitest';
import {
  CIVIC_INTENTS,
  classifyCivicIntents,
  extractCivicSlots,
  decomposeMultiIntentQuery,
} from './civicIntentExtractionService';

describe('Civic Query Intent and Slot Extraction (#609)', () => {
  it('correctly classifies single intent for documents inquiry', () => {
    const res = classifyCivicIntents('what documents are needed for permanent driving licence');
    expect(res.primaryIntent).toBe(CIVIC_INTENTS.DOCUMENTS);
    expect(res.isMultiIntent).toBe(false);
    expect(res.confidence).toBeGreaterThan(0.8);
  });

  it('correctly identifies multi-intent inquiries (fees + procedure + eligibility)', () => {
    const res = classifyCivicIntents(
      'who is eligible for old age pension, what is the fee, and how to apply'
    );
    expect(res.primaryIntent).toBe(CIVIC_INTENTS.MULTI_INTENT);
    expect(res.isMultiIntent).toBe(true);
    expect(res.detectedIntents).toContain(CIVIC_INTENTS.ELIGIBILITY);
    expect(res.detectedIntents).toContain(CIVIC_INTENTS.FEES);
    expect(res.detectedIntents).toContain(CIVIC_INTENTS.PROCEDURE);
  });

  it('extracts state jurisdiction, document type, and service slots', () => {
    const slots = extractCivicSlots(
      'how to get ews caste certificate in Maharashtra with ration card'
    );
    expect(slots.slots.stateUt).toBe('Maharashtra');
    expect(slots.slots.applicantCategory).toBe('EWS');
    expect(slots.slots.documentType).toContain('ration card');
    expect(slots.confidence).toBeGreaterThan(0.7);
  });

  it('detects conflicting jurisdictions and flags ambiguity', () => {
    const slots = extractCivicSlots('land mutation process in Delhi and Haryana');
    expect(slots.ambiguities.length).toBeGreaterThan(0);
    expect(slots.needsClarification).toBe(true);
  });

  it('decomposes multi-intent question into dedicated retrieval sub-queries', () => {
    const decomposition = decomposeMultiIntentQuery(
      'what are the documents and fee for driving licence in Karnataka'
    );
    expect(decomposition.isMultiIntent).toBe(true);
    expect(decomposition.subQueries.length).toBe(2);
    const intents = decomposition.subQueries.map((sq) => sq.intent);
    expect(intents).toContain(CIVIC_INTENTS.DOCUMENTS);
    expect(intents).toContain(CIVIC_INTENTS.FEES);
  });

  it('handles empty query gracefully', () => {
    const res = classifyCivicIntents('   ');
    expect(res.primaryIntent).toBe(CIVIC_INTENTS.GENERAL);
    expect(res.confidence).toBe(0);
  });
});
