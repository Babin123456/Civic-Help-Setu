import { describe, it, expect } from 'vitest';
import { calculateServiceRelevance, getSearchSuggestions } from './searchRankingEngine';

// Shape of the counter-demand-forecasting entry before it was fixed: `documents` is an object.
const malformed = {
  id: 'malformed',
  name: 'Malformed Record',
  documents: { 'Some document label': { type: 'mandatory' } },
  eligibility: { whoCanApply: ['Anyone'] },
};

describe('search ranking with a malformed record', () => {
  it('builds suggestions instead of throwing when documents is not an array', () => {
    expect(() => getSearchSuggestions([malformed], 'ab')).not.toThrow();
    expect(getSearchSuggestions([malformed], 'malformed').map((s) => s.label)).toContain('Malformed Record');
  });

  it('scores a record whose documents or eligibility is not an array', () => {
    expect(() => calculateServiceRelevance(malformed, 'document')).not.toThrow();
    expect(calculateServiceRelevance(malformed, 'malformed')).toBeGreaterThan(0);
  });
});
