import { describe, it, expect } from 'vitest';
import { jurisdictionFromFormFields, validateJurisdiction } from './jurisdictionService';

describe('jurisdictionFromFormFields', () => {
  const stale = { states: ['Kerala'], district: 'Kochi', localBody: 'Ward 4' };

  it('ignores a stale district and local body once the level is national or state', () => {
    expect(validateJurisdiction(jurisdictionFromFormFields({ level: 'national', ...stale }))).toEqual([]);
    expect(validateJurisdiction(jurisdictionFromFormFields({ level: 'state', ...stale }))).toEqual([]);
  });

  it('ignores a stale local body for a district service', () => {
    const j = jurisdictionFromFormFields({ level: 'district', ...stale });
    expect(j.localBody).toBe('');
    expect(validateJurisdiction(j)).toEqual([]);
  });

  it('keeps district and local body for a local service', () => {
    const j = jurisdictionFromFormFields({ level: 'local', ...stale });
    expect(j).toEqual({ level: 'local', states: ['Kerala'], districts: ['Kochi'], localBody: 'Ward 4' });
    expect(validateJurisdiction(j)).toEqual([]);
  });
});
