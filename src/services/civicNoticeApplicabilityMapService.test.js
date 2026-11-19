import { describe, it, expect, beforeEach } from 'vitest';
import {
  APPLICABILITY_STATUS,
  LOCALITY_EXTRACTION_CONFIDENCE,
  NOTICE_CATEGORY,
  MUNICIPAL_PUBLIC_NOTICES,
  evaluateNoticeApplicability,
  getApplicableNoticesForLocality,
  generateNoticeCoverageMapLayers,
  getAccessibleNoticeApplicabilityTable,
  subscribeToLocalityNotices,
  getCitizenLocalitySubscriptions,
  sanitizeSubscriptionForExport,
  _resetLocalitySubscriptionStore,
} from './civicNoticeApplicabilityMapService.js';

describe('CivicNoticeApplicabilityMapService', () => {
  beforeEach(() => {
    _resetLocalitySubscriptionStore();
  });

  describe('evaluateNoticeApplicability', () => {
    const activeNotice = MUNICIPAL_PUBLIC_NOTICES.find(
      (n) => n.noticeId === 'NOT_WATER_SHUTDOWN_2026_11'
    );
    const futureNotice = MUNICIPAL_PUBLIC_NOTICES.find(
      (n) => n.noticeId === 'NOT_TRAFFIC_DIVERSION_DEC2026'
    );
    const expiredNotice = MUNICIPAL_PUBLIC_NOTICES.find(
      (n) => n.noticeId === 'NOT_PROPERTY_TAX_REBATE_2026'
    );

    it('throws error when notice or userLocalityId is missing', () => {
      expect(() => evaluateNoticeApplicability(null, 'WARD_1_CENTRAL')).toThrow(
        'Valid notice with effective start and end dates is required'
      );
      expect(() => evaluateNoticeApplicability(activeNotice, null)).toThrow(
        'userLocalityId is required'
      );
    });

    it('evaluates active notice as APPLICABLE_ACTIVE for affected ward', () => {
      const result = evaluateNoticeApplicability(activeNotice, 'WARD_1_CENTRAL', '2026-11-15T12:00:00Z');
      expect(result.applicabilityStatus).toBe(APPLICABILITY_STATUS.APPLICABLE_ACTIVE);
      expect(result.isTemporallyActive).toBe(true);
      expect(result.isLocalityMatch).toBe(true);
      expect(result.supportingPassage.text).toContain('Ward 1 (Central Zone)');
      expect(result.hasAbsentGeometry).toBe(false);
    });

    it('identifies future notice as FUTURE_EFFECTIVE', () => {
      const result = evaluateNoticeApplicability(futureNotice, 'WARD_4_NORTH', '2026-11-15T12:00:00Z');
      expect(result.applicabilityStatus).toBe(APPLICABILITY_STATUS.FUTURE_EFFECTIVE);
      expect(result.isTemporallyActive).toBe(false);
      expect(result.isLocalityMatch).toBe(true);
    });

    it('identifies past notice as TEMPORALLY_EXPIRED', () => {
      const result = evaluateNoticeApplicability(expiredNotice, 'WARD_1_CENTRAL', '2026-11-15T12:00:00Z');
      expect(result.applicabilityStatus).toBe(APPLICABILITY_STATUS.TEMPORALLY_EXPIRED);
      expect(result.isTemporallyActive).toBe(false);
      expect(result.isLocalityMatch).toBe(true);
    });

    it('labels ambiguous locality mentions as UNCERTAIN_AMBIGUOUS without guessing', () => {
      const result = evaluateNoticeApplicability(activeNotice, 'CANAL_ROAD_APPROX', '2026-11-15T12:00:00Z');
      expect(result.applicabilityStatus).toBe(APPLICABILITY_STATUS.UNCERTAIN_AMBIGUOUS);
      expect(result.matchedLocality.confidence).toBe(LOCALITY_EXTRACTION_CONFIDENCE.AMBIGUOUS_UNRESOLVED);
    });

    it('returns NOT_APPLICABLE for unaffected locality', () => {
      const result = evaluateNoticeApplicability(activeNotice, 'WARD_99_UNAFFECTED', '2026-11-15T12:00:00Z');
      expect(result.applicabilityStatus).toBe(APPLICABILITY_STATUS.NOT_APPLICABLE);
      expect(result.isLocalityMatch).toBe(false);
    });

    it('handles absent geometry gracefully for confirmed ward', () => {
      const result = evaluateNoticeApplicability(activeNotice, 'WARD_2_WEST', '2026-11-15T12:00:00Z');
      expect(result.applicabilityStatus).toBe(APPLICABILITY_STATUS.APPLICABLE_ACTIVE);
      expect(result.hasAbsentGeometry).toBe(true);
    });
  });

  describe('getApplicableNoticesForLocality', () => {
    it('retrieves active and future notices for a ward, excluding expired by default', () => {
      const list = getApplicableNoticesForLocality(MUNICIPAL_PUBLIC_NOTICES, 'WARD_1_CENTRAL', {
        evaluationDate: '2026-11-15T12:00:00Z',
        includeExpired: false,
      });

      expect(list.length).toBeGreaterThan(0);
      list.forEach((n) => {
        expect(n.applicabilityStatus).not.toBe(APPLICABILITY_STATUS.TEMPORALLY_EXPIRED);
        expect(n.applicabilityStatus).not.toBe(APPLICABILITY_STATUS.NOT_APPLICABLE);
      });
    });

    it('includes expired notices when includeExpired is true', () => {
      const list = getApplicableNoticesForLocality(MUNICIPAL_PUBLIC_NOTICES, 'WARD_1_CENTRAL', {
        evaluationDate: '2026-11-15T12:00:00Z',
        includeExpired: true,
      });

      const hasExpired = list.some((n) => n.applicabilityStatus === APPLICABILITY_STATUS.TEMPORALLY_EXPIRED);
      expect(hasExpired).toBe(true);
    });

    it('filters by notice category', () => {
      const waterNotices = getApplicableNoticesForLocality(MUNICIPAL_PUBLIC_NOTICES, 'WARD_1_CENTRAL', {
        category: NOTICE_CATEGORY.WATER_SUPPLY_SHUTDOWN,
      });

      waterNotices.forEach((n) => {
        expect(n.category).toBe(NOTICE_CATEGORY.WATER_SUPPLY_SHUTDOWN);
      });
    });

    it('throws error when userLocalityId is omitted', () => {
      expect(() => getApplicableNoticesForLocality(MUNICIPAL_PUBLIC_NOTICES, null)).toThrow(
        'userLocalityId is required'
      );
    });
  });

  describe('generateNoticeCoverageMapLayers', () => {
    it('separates vector map regions from text-only localities with absent geometry', () => {
      const notice = MUNICIPAL_PUBLIC_NOTICES.find((n) => n.noticeId === 'NOT_WATER_SHUTDOWN_2026_11');
      const layers = generateNoticeCoverageMapLayers(notice);

      expect(layers.noticeId).toBe('NOT_WATER_SHUTDOWN_2026_11');
      expect(layers.totalMappedRegions).toBe(1); // Ward 1 has polygon geometry
      expect(layers.totalTextLocalities).toBe(2); // Ward 2 and Canal Road have null geometry

      expect(layers.mapRegions[0].geometry.type).toBe('Polygon');
      expect(layers.textOnlyLocalities[0].geometryFallback).toBe('NO_GEOMETRY_AVAILABLE_TABULAR_ONLY');
    });

    it('throws error on invalid notice object', () => {
      expect(() => generateNoticeCoverageMapLayers(null)).toThrow('Valid notice with targetLocalities is required');
    });
  });

  describe('getAccessibleNoticeApplicabilityTable', () => {
    it('produces structured accessible rows with source citations', () => {
      const evaluated = getApplicableNoticesForLocality(MUNICIPAL_PUBLIC_NOTICES, 'WARD_1_CENTRAL', {
        includeExpired: true,
      });

      const table = getAccessibleNoticeApplicabilityTable(evaluated);
      expect(Array.isArray(table)).toBe(true);
      expect(table.length).toBe(evaluated.length);

      const firstRow = table[0];
      expect(firstRow.noticeId).toBeDefined();
      expect(firstRow.effectivePeriod).toBeDefined();
      expect(firstRow.supportingPassage).toBeDefined();
    });

    it('throws error when non-array is passed', () => {
      expect(() => getAccessibleNoticeApplicabilityTable(null)).toThrow('Array of evaluatedNotices is required');
    });
  });

  describe('Citizen Subscriptions & Privacy', () => {
    it('creates and retrieves localized notice alert subscriptions', () => {
      const sub = subscribeToLocalityNotices({
        citizenId: 'citizen_pune_44',
        localityId: 'WARD_1_CENTRAL',
        categoryFilter: NOTICE_CATEGORY.WATER_SUPPLY_SHUTDOWN,
      });

      expect(sub.subscriptionId).toBeDefined();
      expect(sub.localityId).toBe('WARD_1_CENTRAL');

      const citizenSubs = getCitizenLocalitySubscriptions('citizen_pune_44');
      expect(citizenSubs).toHaveLength(1);
      expect(citizenSubs[0].subscriptionId).toBe(sub.subscriptionId);
    });

    it('throws error if citizenId or localityId is missing', () => {
      expect(() => subscribeToLocalityNotices({})).toThrow('citizenId and localityId are required');
    });

    it('sanitizes subscription for compliance export', () => {
      const sub = subscribeToLocalityNotices({
        citizenId: 'citizen_pune_44',
        localityId: 'WARD_1_CENTRAL',
      });

      const exported = sanitizeSubscriptionForExport(sub);
      expect(exported.maskedCitizenId).toBe('cit_***__44');
      expect(exported.citizenId).toBeUndefined();
    });

    it('returns null when exporting invalid subscription object', () => {
      expect(sanitizeSubscriptionForExport(null)).toBeNull();
    });
  });
});
