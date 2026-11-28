import { describe, it, expect, beforeEach } from 'vitest';
import {
  StreetlightReportingService,
  OUTAGE_PROBLEM_TYPE,
  REPORT_STATUS
} from './streetlightReportingService.js';

describe('StreetlightReportingService (#1079)', () => {
  let service;

  beforeEach(() => {
    service = new StreetlightReportingService();
  });

  it('creates an outage report with metadata stripped and marked as unverified', () => {
    const report = service.createReport({
      latitude: 28.6139,
      longitude: 77.2090,
      address: 'Near Central Bus Terminus, Connaught Place',
      problemType: OUTAGE_PROBLEM_TYPE.NOT_WORKING,
      landmark: 'Gate 4 Metro Station',
      photoPayload: 'fake_raw_binary_with_exif_metadata_content'
    });

    expect(report.referenceNumber).toMatch(/^STR-\d{4}-[A-F0-9]{8}$/);
    expect(report.status).toBe(REPORT_STATUS.UNVERIFIED);
    expect(report.sanitizedPhoto.isMetadataStripped).toBe(true);
    expect(report.sanitizedPhoto.checksum).toBeDefined();
  });

  it('detects nearby duplicates within proximity threshold', () => {
    service.createReport({
      latitude: 28.6139,
      longitude: 77.2090,
      address: 'Pole #12',
      problemType: OUTAGE_PROBLEM_TYPE.EXPOSED_WIRING
    });

    const duplicates = service.detectDuplicates(28.61392, 77.20902);
    expect(duplicates.length).toBe(1);
  });

  it('generates email-ready complaint summary', () => {
    const report = service.createReport({
      address: 'Sector 14 Main Road',
      problemType: OUTAGE_PROBLEM_TYPE.DAMAGED_POLE
    });

    const summary = service.generateComplaintSummary(report.referenceNumber);
    expect(summary.referenceNumber).toBe(report.referenceNumber);
    expect(summary.publicLabel).toBe('Unverified Community Submission');
    expect(summary.authorityNotice).toContain('Municipal Corporation');
  });
});
