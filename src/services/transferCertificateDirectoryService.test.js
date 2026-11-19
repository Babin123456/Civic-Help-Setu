import { describe, it, expect } from 'vitest';
import {
  assessTransferCertificateRequest,
  getCertificateProcedureSteps,
  exportTransferCertificateSummary,
  verifyCertificateFields,
  CERTIFICATE_TYPES,
  APPLICATION_ROUTES,
  RTE_TC_PROTECTION
} from './transferCertificateDirectoryService';

describe('transferCertificateDirectoryService', () => {
  it('should define statutory certificate categories and authorities', () => {
    expect(CERTIFICATE_TYPES.SCHOOL_TC.code).toBe('SCHOOL_TC');
    expect(CERTIFICATE_TYPES.BOARD_MIGRATION.code).toBe('BOARD_MIGRATION');
    expect(CERTIFICATE_TYPES.COLLEGE_MIGRATION.code).toBe('COLLEGE_MIGRATION');
    expect(RTE_TC_PROTECTION.statute).toContain('2009');
  });

  it('should assess regular school TC application accurately', () => {
    const request = {
      studentName: 'Rohan Mehra',
      institutionName: 'Kendriya Vidyalaya No. 1',
      certificateType: 'SCHOOL_TC',
      route: 'FRESH_PASS_OUT',
      pendingDues: false
    };

    const res = assessTransferCertificateRequest(request);
    expect(res.isReady).toBe(true);
    expect(res.certificate.tatDays).toBe(7);
    expect(res.statutoryProtection).not.toBeNull();
    expect(res.errors).toHaveLength(0);
  });

  it('should validate duplicate request and flag missing police report/affidavit', () => {
    const request = {
      studentName: 'Priya Iyer',
      certificateType: 'SCHOOL_TC',
      route: 'DUPLICATE_LOST',
      documents: []
    };

    const res = assessTransferCertificateRequest(request);
    expect(res.isReady).toBe(true); // structurally ready, but warnings issued
    expect(res.warnings.some(w => w.includes('Police Lost Article Report'))).toBe(true);
    expect(res.warnings.some(w => w.includes('Notarized affidavit'))).toBe(true);
  });

  it('should safeguard students facing fee-related TC withholding under RTE Act', () => {
    const request = {
      studentName: 'Amit Verma',
      certificateType: 'SCHOOL_TC',
      route: 'FRESH_PASS_OUT',
      pendingDues: true
    };

    const res = assessTransferCertificateRequest(request);
    expect(res.warnings.some(w => w.includes('cannot withhold or deny TC due to fee disputes'))).toBe(true);
  });

  it('should return board migration specific procedures', () => {
    const steps = getCertificateProcedureSteps('BOARD_MIGRATION', 'FRESH');
    expect(steps.length).toBeGreaterThanOrEqual(4);
    expect(steps.some(s => s.includes('DigiLocker') || s.includes('Pariksha Sangam'))).toBe(true);
  });

  it('should verify essential certificate fields', () => {
    const verified = verifyCertificateFields({
      student: 'Valid',
      accurate: 'Valid',
      date: 'Valid',
      school: 'Valid'
    });
    expect(verified.totalChecked).toBe(6);
    expect(verified.isFullyVerified).toBe(true);
  });

  it('should export formatted markdown dossier', () => {
    const request = {
      studentName: 'Anil Sengupta',
      institutionName: 'Delhi Public School',
      certificateType: 'BOARD_MIGRATION',
      route: 'FRESH_PASS_OUT'
    };

    const doc = exportTransferCertificateSummary(request);
    expect(doc).toContain('# Educational Transfer Certificate (TC) & Migration Dossier');
    expect(doc).toContain('Anil Sengupta');
    expect(doc).toContain('Board Migration Certificate');
    expect(doc).toContain('Examination Board');
  });
});
