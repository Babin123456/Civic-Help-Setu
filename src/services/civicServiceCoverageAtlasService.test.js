import { describe, it, expect, beforeEach } from 'vitest';
import {
  FRESHNESS_STATUS,
  ATLAS_VIEWER_STATE,
  SERVICE_CATEGORY,
  STATUTORY_ATLAS_DISCLAIMER,
  calculateDataFreshness,
  compareLocalities,
  generateCoverageAtlasMapLayers,
  getAccessibleCoverageTable,
  reportOutdatedCoverageInfo,
  getCoverageReports,
  sanitizeCoverageReportForExport,
  _resetCoverageReportStore,
} from './civicServiceCoverageAtlasService.js';

describe('CivicServiceCoverageAtlasService', () => {
  beforeEach(() => {
    _resetCoverageReportStore();
  });

  describe('calculateDataFreshness', () => {
    it('returns UNSURVEYED for null or missing verification date', () => {
      const freshness = calculateDataFreshness(null);
      expect(freshness.status).toBe(FRESHNESS_STATUS.UNSURVEYED);
      expect(freshness.isStale).toBe(true);
      expect(freshness.ageDays).toBeNull();
    });

    it('identifies recent records within 90 days as RECENT_VERIFIED', () => {
      const recent = calculateDataFreshness('2026-10-25T10:00:00Z');
      expect(recent.status).toBe(FRESHNESS_STATUS.RECENT_VERIFIED);
      expect(recent.isStale).toBe(false);
      expect(recent.ageDays).toBeLessThanOrEqual(90);
    });

    it('identifies records older than 180 days as STALE_WARNING', () => {
      const stale = calculateDataFreshness('2025-11-01T10:00:00Z');
      expect(stale.status).toBe(FRESHNESS_STATUS.STALE_WARNING);
      expect(stale.isStale).toBe(true);
      expect(stale.message).toContain('Stale Data Warning');
    });
  });

  describe('compareLocalities', () => {
    it('throws error when localityIds is empty or invalid', () => {
      expect(() => compareLocalities([])).toThrow('At least one localityId is required');
      expect(() => compareLocalities(null)).toThrow('At least one localityId is required');
    });

    it('throws error when unknown locality ID is requested', () => {
      expect(() => compareLocalities(['UNKNOWN_LOC_999'])).toThrow('Localities not found: UNKNOWN_LOC_999');
    });

    it('compares multi-channel coverage across urban and rural localities', () => {
      const result = compareLocalities(['LOC_CENTRAL_WARD_1', 'LOC_RURAL_TALUKA_7']);

      expect(result.totalLocalitiesCompared).toBe(2);
      expect(result.aggregatedChannels.grandTotal).toBeGreaterThan(0);
      expect(result.hasStaleData).toBe(true); // LOC_RURAL_TALUKA_7 is stale
      expect(result.status).toBe(ATLAS_VIEWER_STATE.STALE_DATA_WARNING);
      expect(result.statutoryNotice).toBe(STATUTORY_ATLAS_DISCLAIMER);

      const central = result.localities.find((l) => l.localityId === 'LOC_CENTRAL_WARD_1');
      expect(central.accessibility.hasWheelchairRamp).toBe(true);
      expect(central.accessibility.hasBrailleSignage).toBe(true);
      expect(central.channels.physicalCount).toBe(2);
      expect(central.channels.digitalCount).toBe(1);

      const rural = result.localities.find((l) => l.localityId === 'LOC_RURAL_TALUKA_7');
      expect(rural.channels.mobileCount).toBe(1);
    });

    it('filters facilities accurately by service category', () => {
      const result = compareLocalities(
        ['LOC_CENTRAL_WARD_1'],
        SERVICE_CATEGORY.MUNICIPAL_PERMITS
      );

      expect(result.selectedCategory).toBe(SERVICE_CATEGORY.MUNICIPAL_PERMITS);
      const loc = result.localities[0];
      loc.facilities.forEach((fac) => {
        expect(fac.categories).toContain(SERVICE_CATEGORY.MUNICIPAL_PERMITS);
      });
    });

    it('distinguishes unsurveyed gap from zero verified coverage', () => {
      const result = compareLocalities(['LOC_UNSURVEYED_HAMLET_12']);
      const hamlet = result.localities[0];
      expect(hamlet.coverageStatus).toBe('UNSURVEYED_GAP');
      expect(hamlet.channels.totalChannels).toBe(0);
    });
  });

  describe('Map & Table Parity (generateCoverageAtlasMapLayers & getAccessibleCoverageTable)', () => {
    it('guarantees map layer points and comparison table totals strictly agree', () => {
      const comparison = compareLocalities([
        'LOC_CENTRAL_WARD_1',
        'LOC_NORTH_SUBURB_WARD_4',
        'LOC_RURAL_TALUKA_7',
      ]);

      const mapPoints = generateCoverageAtlasMapLayers(comparison);
      const tableRows = getAccessibleCoverageTable(comparison);

      expect(mapPoints.length).toBe(comparison.aggregatedChannels.grandTotal);
      expect(tableRows.length).toBe(comparison.totalLocalitiesCompared);

      const totalChannelsInTable = tableRows.reduce((acc, row) => acc + row.totalChannels, 0);
      expect(totalChannelsInTable).toBe(mapPoints.length);

      // Verify map point coordinates and metadata
      const firstPoint = mapPoints[0];
      expect(firstPoint.centroid).toBeDefined();
      expect(firstPoint.channelType).toBeDefined();
      expect(firstPoint.facilityName).toBeDefined();

      // Verify accessible table format
      const firstRow = tableRows[0];
      expect(firstRow.localityName).toBeDefined();
      expect(firstRow.wheelchairRamp).toMatch(/YES|NO/);
      expect(firstRow.coverageDiagnosis).toBeDefined();
    });

    it('throws error when invalid comparison object is passed to map generator', () => {
      expect(() => generateCoverageAtlasMapLayers(null)).toThrow('Valid comparisonResult is required');
      expect(() => getAccessibleCoverageTable(null)).toThrow('Valid comparisonResult is required');
    });
  });

  describe('Citizen Reporting & Data Privacy', () => {
    it('records citizen feedback on outdated coverage data safely without sensitive location tracking', () => {
      const report = reportOutdatedCoverageInfo({
        localityId: 'LOC_NORTH_SUBURB_WARD_4',
        facilityId: 'FAC_05_NORTH_SUB_OFFICE',
        reportCategory: 'LACKS_WHEELCHAIR_RAMP',
        description: 'Office has steep entrance steps without ramp or ground floor lift.',
        reporterContact: 'citizen@example.com',
      });

      expect(report.reportId).toBeDefined();
      expect(report.reporterMasked).toBe('CITIZEN_PROVIDED');
      expect(report.status).toBe('PENDING_ADMIN_VERIFICATION');

      const allReports = getCoverageReports();
      expect(allReports.length).toBe(1);

      const filtered = getCoverageReports('LOC_NORTH_SUBURB_WARD_4');
      expect(filtered.length).toBe(1);
    });

    it('throws error when required report fields are missing', () => {
      expect(() => reportOutdatedCoverageInfo({})).toThrow('Mandatory report fields missing');
    });

    it('sanitizes report for public export', () => {
      const report = reportOutdatedCoverageInfo({
        localityId: 'LOC_RURAL_TALUKA_7',
        reportCategory: 'INACCURATE_HOURS',
        description: 'Samiti desk opens only until 13:00 on Fridays.',
      });

      const exported = sanitizeCoverageReportForExport(report);
      expect(exported.reportId).toBe(report.reportId);
      expect(exported.localityId).toBe('LOC_RURAL_TALUKA_7');
      expect(exported.reporterMasked).toBeUndefined();
    });

    it('returns null when exporting invalid report object', () => {
      expect(sanitizeCoverageReportForExport(null)).toBeNull();
    });
  });
});
