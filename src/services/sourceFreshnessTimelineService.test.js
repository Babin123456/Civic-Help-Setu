import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeValidityDate,
  evaluateSourceFreshness,
  SourceFreshnessTimelineService,
  SOURCE_FRESHNESS_STATUS
} from './sourceFreshnessTimelineService.js';

describe('sourceFreshnessTimelineService', () => {
  describe('normalizeValidityDate', () => {
    it('normalizes valid dates to YYYY-MM-DD format', () => {
      expect(normalizeValidityDate('2026-05-15T12:00:00Z')).toBe('2026-05-15');
      expect(normalizeValidityDate(new Date('2026-10-01'))).toBe('2026-10-01');
    });

    it('returns explicitly UNKNOWN for missing or invalid dates', () => {
      expect(normalizeValidityDate(null)).toBe('UNKNOWN');
      expect(normalizeValidityDate('')).toBe('UNKNOWN');
      expect(normalizeValidityDate('invalid-date')).toBe('UNKNOWN');
    });
  });

  describe('evaluateSourceFreshness', () => {
    const fixedNow = new Date('2026-11-23T12:00:00Z').getTime();

    it('identifies withdrawn and superseded sources immediately', () => {
      const withdrawn = evaluateSourceFreshness({
        sourceId: 'src_01',
        isWithdrawn: true
      }, fixedNow);
      expect(withdrawn.status).toBe(SOURCE_FRESHNESS_STATUS.WITHDRAWN);

      const superseded = evaluateSourceFreshness({
        sourceId: 'src_02',
        supersededBy: 'src_03'
      }, fixedNow);
      expect(superseded.status).toBe(SOURCE_FRESHNESS_STATUS.SUPERSEDED);
      expect(superseded.supersededBy).toBe('src_03');
    });

    it('detects legally expired sources based on effectiveTo date', () => {
      const expired = evaluateSourceFreshness({
        sourceId: 'src_04',
        publicationDate: '2024-01-01',
        effectiveTo: '2025-12-31',
        lastVerifiedDate: '2025-06-01'
      }, fixedNow);

      expect(expired.status).toBe(SOURCE_FRESHNESS_STATUS.EXPIRED);
      expect(expired.reason).toContain('Legal effective period ended');
    });

    it('flags sources as STALE_NEEDS_REVIEW if verified over 180 days ago', () => {
      const stale = evaluateSourceFreshness({
        sourceId: 'src_05',
        publicationDate: '2025-01-01',
        effectiveFrom: '2025-01-01',
        lastVerifiedDate: '2026-01-01' // ~320 days old relative to Nov 2026
      }, fixedNow);

      expect(stale.status).toBe(SOURCE_FRESHNESS_STATUS.STALE_NEEDS_REVIEW);
      expect(stale.reason).toContain('exceeds 180d ceiling');
    });

    it('evaluates clean, current sources as CURRENT', () => {
      const current = evaluateSourceFreshness({
        sourceId: 'src_06',
        publicationDate: '2026-06-01',
        effectiveFrom: '2026-06-01',
        lastVerifiedDate: '2026-10-15' // ~39 days old
      }, fixedNow);

      expect(current.status).toBe(SOURCE_FRESHNESS_STATUS.CURRENT);
    });
  });

  describe('SourceFreshnessTimelineService', () => {
    let service;

    beforeEach(() => {
      service = new SourceFreshnessTimelineService();
    });

    it('builds an ordered chronological timeline of sources for a service', () => {
      service.registerSource('ration-card', {
        sourceId: 'src_old',
        title: 'Original PDS Order 2020',
        publicationDate: '2020-04-01',
        supersededBy: 'src_new'
      });
      service.registerSource('ration-card', {
        sourceId: 'src_new',
        title: 'Revised NFSA Order 2026',
        publicationDate: '2026-01-15',
        lastVerifiedDate: '2026-10-01'
      });

      const timeline = service.getServiceTimeline('ration-card');
      expect(timeline.length).toBe(2);
      expect(timeline[0].sourceId).toBe('src_old');
      expect(timeline[0].freshness.status).toBe(SOURCE_FRESHNESS_STATUS.SUPERSEDED);
      expect(timeline[1].sourceId).toBe('src_new');
      expect(timeline[1].freshness.status).toBe(SOURCE_FRESHNESS_STATUS.CURRENT);
    });
  });
});
