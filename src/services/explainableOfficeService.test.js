import { describe, it, expect } from 'vitest';
import {
  evaluateOfficeServiceMatch,
  rankAndExplainOffices,
  getGpsDeniedOfficeFallback,
  checkDepartmentMatch,
  checkJurisdictionMatch,
  OFFICE_MATCH_STATUS,
} from './explainableOfficeService';

describe('explainableOfficeService (#399)', () => {
  const service = {
    id: 'food-ration-card',
    title: 'Priority Household Ration Card',
    department: 'Department of Food Civil Supplies',
    jurisdiction: 'Karnataka',
  };

  describe('department and jurisdiction checking', () => {
    it('matches departments with exact and token overlap', () => {
      expect(checkDepartmentMatch('Department of Food Civil Supplies', 'Department of Food Civil Supplies').matched).toBe(true);
      expect(checkDepartmentMatch('Food & Civil Supplies Office', 'Department of Food Civil Supplies').matched).toBe(true);
      expect(checkDepartmentMatch('Regional Transport Office', 'Department of Food Civil Supplies').matched).toBe(false);
    });

    it('matches jurisdiction and identifies unverified boundaries', () => {
      const officeInState = { state: 'Karnataka', district: 'Bengaluru Urban' };
      const nationalService = { jurisdiction: 'National' };
      const missingJurService = { jurisdiction: '' };

      expect(checkJurisdictionMatch(officeInState, nationalService).matched).toBe(true);
      expect(checkJurisdictionMatch(officeInState, service).matched).toBe(true);
      expect(checkJurisdictionMatch(officeInState, missingJurService).unverified).toBe(true);
      expect(checkJurisdictionMatch({ state: 'Kerala' }, service).matched).toBe(false);
    });
  });

  describe('evaluateOfficeServiceMatch', () => {
    it('classifies confirmed responsible office with verified intake capability', () => {
      const responsibleOffice = {
        id: 'off-1',
        name: 'Assistant Director Food & Civil Supplies',
        department: 'Department of Food Civil Supplies',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        servicesOffered: ['Priority Household Ration Card', 'Antyodaya Card'],
      };

      const result = evaluateOfficeServiceMatch(responsibleOffice, service);
      expect(result.status).toBe(OFFICE_MATCH_STATUS.CONFIRMED_RESPONSIBLE_OFFICE);
      expect(result.isResponsibleOffice).toBe(true);
      expect(result.isUnverified).toBe(false);
      expect(result.reasons.some((r) => r.includes('verified intake center') || r.includes('Official administrative center'))).toBe(true);
    });

    it('classifies civic facilitation center in same jurisdiction as JURISDICTION_MATCH', () => {
      const facilitationCenter = {
        id: 'off-csc',
        name: 'Karnataka Bengaluru-One Citizen Service Center',
        type: 'Citizen Service Center (CSC)',
        department: 'e-Governance Directorate',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
      };

      const result = evaluateOfficeServiceMatch(facilitationCenter, service);
      expect(result.status).toBe(OFFICE_MATCH_STATUS.JURISDICTION_MATCH);
      expect(result.isResponsibleOffice).toBe(false);
      expect(result.reasons.some((r) => r.includes('General citizen service center'))).toBe(true);
    });

    it('classifies nearby facility with non-matching department as NEARBY_FACILITY_ONLY', () => {
      const rtoOffice = {
        id: 'off-rto',
        name: 'Regional Transport Office (RTO) East',
        department: 'Transport Department',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        distanceKm: 1.2,
      };

      const result = evaluateOfficeServiceMatch(rtoOffice, service);
      expect(result.status).toBe(OFFICE_MATCH_STATUS.NEARBY_FACILITY_ONLY);
      expect(result.isResponsibleOffice).toBe(false);
      expect(result.reasons[0]).toContain('primary department does not match');
    });

    it('flags recommendation as UNVERIFIED_MATCH when jurisdiction is missing', () => {
      const ambiguousOffice = {
        id: 'off-ambiguous',
        name: 'Welfare Scheme Information Counter',
        department: 'Department of Food Civil Supplies',
        state: '',
        district: '',
      };

      const result = evaluateOfficeServiceMatch(ambiguousOffice, service);
      expect(result.status).toBe(OFFICE_MATCH_STATUS.UNVERIFIED_MATCH);
      expect(result.isUnverified).toBe(true);
      expect(result.reasons.some((r) => r.includes('Jurisdiction boundary not stated'))).toBe(true);
    });

    it('classifies incompatible office in a different state as UNMATCHED', () => {
      const outOfStateOffice = {
        id: 'off-delhi',
        name: 'Delhi Food & Supply Inspector Office',
        department: 'Department of Food Civil Supplies',
        state: 'Delhi',
        district: 'Central Delhi',
      };

      const result = evaluateOfficeServiceMatch(outOfStateOffice, service);
      expect(result.status).toBe(OFFICE_MATCH_STATUS.UNMATCHED);
      expect(result.reasons[0]).toContain('differs from office region');
    });
  });

  describe('rankAndExplainOffices and GPS-denied fallback', () => {
    it('ranks confirmed responsible offices higher than generic facilities', () => {
      const offices = [
        {
          id: 'o-rto',
          name: 'RTO Office',
          department: 'Transport',
          state: 'Karnataka',
          distanceKm: 0.5,
        },
        {
          id: 'o-resp',
          name: 'Food & Civil Supplies Inspectorate',
          department: 'Department of Food Civil Supplies',
          state: 'Karnataka',
          distanceKm: 4.2,
        },
      ];

      const ranked = rankAndExplainOffices(offices, service);
      expect(ranked[0].id).toBe('o-resp');
      expect(ranked[0].matchExplanation.status).toBe(OFFICE_MATCH_STATUS.CONFIRMED_RESPONSIBLE_OFFICE);
      expect(ranked[1].id).toBe('o-rto');
      expect(ranked[1].matchExplanation.status).toBe(OFFICE_MATCH_STATUS.NEARBY_FACILITY_ONLY);
    });

    it('returns structured explainable fallback offices for GPS-denied scenarios', () => {
      const fallbacks = getGpsDeniedOfficeFallback(service, { state: 'Karnataka', district: 'Bengaluru' });
      expect(fallbacks.length).toBeGreaterThanOrEqual(2);
      expect(fallbacks[0].isFallbackRecord).toBe(true);
      expect(fallbacks[0].matchExplanation).toBeDefined();
      expect(fallbacks[0].matchExplanation.status).toBe(OFFICE_MATCH_STATUS.CONFIRMED_RESPONSIBLE_OFFICE);
    });
  });
});
