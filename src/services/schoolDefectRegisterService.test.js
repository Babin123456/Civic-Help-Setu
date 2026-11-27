import { describe, it, expect } from 'vitest';
import {
  DEFECT_DEPARTMENT_ROUTING,
  aggregateSchoolAndWardDefects,
  createSchoolDefectReport,
  getBuiltInSchoolDefectReports,
  migrateSchoolDefectStoreState,
  moderateSchoolDefectEvidence,
  updateSchoolDefectStatus,
} from './schoolDefectRegisterService.js';

describe('Public School Infrastructure Defect & Follow-Up Register (#1437)', () => {
  it('routes defects by facility category and computes school/ward aggregates', () => {
    const reports = getBuiltInSchoolDefectReports();
    const summary = aggregateSchoolAndWardDefects(reports, { wardId: 'ward-14' });
    expect(summary.totalReports).toBe(1);
    expect(summary.openCount).toBe(1);
    expect(summary.reports[0].routedDepartment).toBe(DEFECT_DEPARTMENT_ROUTING.DRINKING_WATER);
  });

  it('blocks student names, student faces, minor photos, unstripped EXIF, and PII', () => {
    const withStudentName = createSchoolDefectReport({
      schoolId: 'UDISE-1',
      schoolName: 'Primary School',
      wardId: 'ward-1',
      category: 'BOYS_GIRLS_TOILETS',
      summary: 'Toilet door broken.',
      studentName: 'Student X',
    });
    expect(withStudentName.valid).toBe(false);

    const withFaces = createSchoolDefectReport({
      schoolId: 'UDISE-1',
      schoolName: 'Primary School',
      wardId: 'ward-1',
      category: 'BOYS_GIRLS_TOILETS',
      summary: 'Toilet door broken.',
      containsStudentFacesOrMinors: true,
    });
    expect(withFaces.valid).toBe(false);

    const withUnstrippedExif = createSchoolDefectReport({
      schoolId: 'UDISE-1',
      schoolName: 'Primary School',
      wardId: 'ward-1',
      category: 'DRINKING_WATER',
      summary: 'Tap broken.',
      evidencePhotoRef: 'photo-1',
      exifStripped: false,
    });
    expect(withUnstrippedExif.valid).toBe(false);
  });

  it('moderates evidence, updates status history with provenance, and migrates legacy state', () => {
    const { valid, report } = createSchoolDefectReport({
      schoolId: 'UDISE-9',
      schoolName: 'Composite School',
      wardId: 'ward-9',
      category: 'RAMP_ACCESSIBILITY',
      summary: 'Wheelchair ramp railing loose.',
      evidencePhotoRef: 'photo-ramp-9',
      exifStripped: true,
    });
    expect(valid).toBe(true);
    expect(report.moderationStatus).toBe('pending_moderation');

    const moderated = moderateSchoolDefectEvidence(report, {
      decision: 'approve',
      actorId: 'admin-1',
      role: 'admin',
      officialProvenance: {
        source: 'BEO Inspection #4',
        jurisdiction: 'IN-UP',
        effectiveDate: '2026-11-27',
        lastVerifiedAt: '2026-11-27T00:00:00.000Z',
      },
    });
    expect(moderated.moderationStatus).toBe('approved');
    expect(moderated.defectStatus).toBe('routed_to_department');

    const resolved = updateSchoolDefectStatus(moderated, {
      defectStatus: 'verified_resolved',
      actorId: 'admin-1',
      role: 'admin',
      note: 'Railing welded and inspected.',
      officialProvenance: {
        source: 'BEO Completion #4',
        jurisdiction: 'IN-UP',
        effectiveDate: '2026-11-27',
        lastVerifiedAt: '2026-11-27T00:00:00.000Z',
      },
    });
    expect(resolved.defectStatus).toBe('verified_resolved');
    expect(resolved.statusHistory).toHaveLength(3);

    const migrated = migrateSchoolDefectStoreState({});
    expect(migrated.schemaVersion).toBe('1.0.0');
  });
});
