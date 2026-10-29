import { describe, it, expect } from 'vitest';
import {
  getApplicabilityDetails,
  getApplicabilityLabel,
  getApplicabilityLevel,
  getDistrictOptions,
  matchesJurisdiction,
  parseJurisdictionFilters,
  validateJurisdiction,
} from './jurisdictionService';
import { rankAndFilterServices } from './searchRankingEngine';
import { MOCK_SERVICES } from '../data/services';

const national = { id: 'n', name: 'National', category: 'Identity', jurisdiction: { level: 'national' } };
const state = {
  id: 's',
  name: 'State',
  category: 'Certificates',
  jurisdiction: { level: 'state', states: ['Kerala', 'Tamil Nadu'] },
};
const district = {
  id: 'd',
  name: 'District',
  category: 'Certificates',
  jurisdiction: { level: 'district', states: ['Kerala'], districts: ['Ernakulam'] },
};
const local = {
  id: 'l',
  name: 'Local',
  category: 'Certificates',
  jurisdiction: { level: 'local', states: ['Kerala'], districts: ['Ernakulam'], localBody: 'Kochi Corporation' },
};
const unknown = { id: 'u', name: 'Unknown', category: 'Certificates' };
const all = [national, state, district, local, unknown];

describe('jurisdiction applicability (#260)', () => {
  describe('scope of each record', () => {
    it('detects national, state, district, local and unknown scope', () => {
      expect(all.map(getApplicabilityLevel)).toEqual(['national', 'state', 'district', 'local', 'unknown']);
    });

    it('treats an inconsistent record as unknown instead of guessing', () => {
      expect(getApplicabilityLevel({ jurisdiction: { level: 'district', states: [], districts: ['Ernakulam'] } })).toBe('unknown');
      expect(getApplicabilityLevel({ jurisdiction: { level: 'galaxy' } })).toBe('unknown');
      expect(getApplicabilityLevel({ jurisdiction: 'national' })).toBe('unknown');
    });

    it('labels unknown scope as unverified, not as nationwide', () => {
      expect(getApplicabilityLabel(unknown)).toBe('Jurisdiction unverified');
      expect(getApplicabilityLabel(unknown)).not.toMatch(/national|india/i);
      const details = getApplicabilityDetails(unknown);
      expect(details.levelLabel).toBe('Not specified');
      expect(details.summary).toMatch(/not been verified/i);
      expect(details.rows).toEqual([]);
    });

    it('builds labels and detail rows for each level', () => {
      expect(getApplicabilityLabel(national)).toBe('National');
      expect(getApplicabilityLabel(state)).toBe('Kerala, Tamil Nadu');
      expect(getApplicabilityLabel(district)).toBe('Ernakulam, Kerala');
      expect(getApplicabilityLabel(local)).toBe('Kochi Corporation, Ernakulam, Kerala');
      expect(getApplicabilityDetails(national).summary).toBe('Applies across India.');
      expect(getApplicabilityDetails(local).rows.map((r) => r.label)).toEqual(['State / UT', 'District', 'Local body']);
    });
  });

  describe('filtering', () => {
    it('matches everything when no state is selected', () => {
      expect(all.every((s) => matchesJurisdiction(s, {}))).toBe(true);
    });

    it('keeps national services and excludes unknown ones for a selected state', () => {
      const ids = all.filter((s) => matchesJurisdiction(s, { state: 'Kerala' })).map((s) => s.id);
      expect(ids).toEqual(['n', 's', 'd', 'l']);
      expect(matchesJurisdiction(unknown, { state: 'Kerala' })).toBe(false);
    });

    it('excludes services of other states', () => {
      const ids = all.filter((s) => matchesJurisdiction(s, { state: 'Tamil Nadu' })).map((s) => s.id);
      expect(ids).toEqual(['n', 's']);
    });

    it('narrows to a district and keeps national and state-wide services', () => {
      const ids = all.filter((s) => matchesJurisdiction(s, { state: 'Kerala', district: 'ernakulam' })).map((s) => s.id);
      expect(ids).toEqual(['n', 's', 'd', 'l']);
      expect(matchesJurisdiction(district, { state: 'Kerala', district: 'Thrissur' })).toBe(false);
    });

    it('combines with the existing catalogue filters', () => {
      const result = rankAndFilterServices(all, { state: 'Kerala', category: 'Certificates' });
      expect(result.map((s) => s.id)).toEqual(['s', 'd', 'l']);
      expect(rankAndFilterServices(all, { category: 'Certificates' }).map((s) => s.id)).toContain('u');
    });

    it('lists district options only for the chosen state', () => {
      expect(getDistrictOptions(all, 'Kerala')).toEqual(['Ernakulam']);
      expect(getDistrictOptions(all, 'Tamil Nadu')).toEqual([]);
      expect(getDistrictOptions(all, 'All')).toEqual([]);
    });

    it('validates the address-bar values', () => {
      const params = new URLSearchParams('state=kerala&district=Ernakulam');
      expect(parseJurisdictionFilters(params, all)).toMatchObject({ state: 'Kerala', district: 'Ernakulam' });
      expect(parseJurisdictionFilters(new URLSearchParams('state=Atlantis&district=x'), all)).toMatchObject({
        state: 'All',
        district: 'All',
      });
      expect(parseJurisdictionFilters(new URLSearchParams('state=Kerala&district=Nowhere'), all).district).toBe('All');
    });
  });

  describe('hierarchy validation', () => {
    it('accepts consistent records at every level', () => {
      [national, state, district, local].forEach((s) => expect(validateJurisdiction(s.jurisdiction)).toEqual([]));
    });

    it('rejects impossible combinations', () => {
      expect(validateJurisdiction(null)).not.toEqual([]);
      expect(validateJurisdiction({ level: 'national', states: ['Kerala'] })).not.toEqual([]);
      expect(validateJurisdiction({ level: 'state', states: [] })).not.toEqual([]);
      expect(validateJurisdiction({ level: 'state', states: ['Kerala'], districts: ['Ernakulam'] })).not.toEqual([]);
      expect(validateJurisdiction({ level: 'district', states: ['Kerala', 'Goa'], districts: ['Ernakulam'] })).not.toEqual([]);
      expect(validateJurisdiction({ level: 'district', states: ['Kerala'], districts: [] })).not.toEqual([]);
      expect(validateJurisdiction({ level: 'district', states: ['Kerala'], districts: ['Ernakulam'], localBody: 'Kochi' })).not.toEqual([]);
      expect(validateJurisdiction({ level: 'local', states: ['Kerala'], districts: ['Ernakulam'] })).not.toEqual([]);
      expect(validateJurisdiction({ level: 'state', states: ['Atlantis'] })).not.toEqual([]);
    });
  });

  describe('built-in catalogue', () => {
    it('only marks centrally run services as national and leaves the rest unverified', () => {
      const levels = Object.fromEntries(MOCK_SERVICES.map((s) => [s.id, getApplicabilityLevel(s)]));
      expect(levels['aadhaar-card']).toBe('national');
      expect(levels['ration-card']).toBe('unknown');
      expect(levels['birth-certificate']).toBe('unknown');
      MOCK_SERVICES.filter((s) => s.jurisdiction).forEach((s) => expect(validateJurisdiction(s.jurisdiction)).toEqual([]));
    });
  });
});
