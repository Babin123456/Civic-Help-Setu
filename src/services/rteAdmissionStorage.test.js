import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveRteGrievanceRecord,
  listRteGrievanceRecords,
  getRteGrievanceById,
  deleteRteGrievanceRecord,
  clearAllRteGrievanceRecords,
  computeRteGrievanceDigest,
  verifyRteGrievanceIntegrity,
  minimizeRteGrievanceForExternal,
  exportRteGrievanceDossierJson,
  exportRteGrievanceTextSlip,
} from './rteAdmissionStorage.js';

describe('rteAdmissionStorage', () => {
  beforeEach(() => {
    clearAllRteGrievanceRecords();
  });

  const sampleRecord = {
    childName: 'Priya Sharma',
    guardianName: 'Sunita Sharma',
    contactPhone: '9876543210',
    residentialAddress: 'Flat 12, Vikas Nagar',
    allotmentSlipId: 'RTE-DEL-2026-778',
    category: 'Economically Weaker Section (EWS)',
    targetGrade: 'Class 1',
    schoolName: 'Greenwood High School',
    schoolAddress: 'Sector 4, Rohini',
    blockName: 'North Zone',
    districtName: 'North Delhi',
    stateName: 'Delhi',
    eligibility: {
      isEligible: true,
      statutoryScore: 90,
    },
    screeningAnalysis: {
      hasViolations: true,
      screeningViolationCount: 1,
      capitationDemandedInr: 15000,
      totalStatutoryPenalLiabilityInr: 175000,
    },
    billingAnalysis: {
      hasOvercharges: true,
      totalIllegalOverchargeInr: 6500,
    },
    denialReason: 'Refused admission without paying Rs 15,000 building development fund',
  };

  it('persists an RTE grievance and computes an immutable SHA-256 seal', async () => {
    const seal = await computeRteGrievanceDigest(sampleRecord);
    expect(seal).toBeDefined();

    const saved = await saveRteGrievanceRecord(sampleRecord);
    expect(saved.id).toBeDefined();
    expect(saved.sha256Seal).toBeDefined();
    expect(saved.schoolName).toBe('Greenwood High School');

    const records = listRteGrievanceRecords();
    expect(records.length).toBe(1);
    expect(records[0].id).toBe(saved.id);
  });

  it('verifies the digital integrity of an untouched record and detects tampering', async () => {
    const saved = await saveRteGrievanceRecord(sampleRecord);
    const isValid = await verifyRteGrievanceIntegrity(saved);
    expect(isValid).toBe(true);

    const tampered = { ...saved, schoolName: 'Altered School Name' };
    const isTamperedValid = await verifyRteGrievanceIntegrity(tampered);
    expect(isTamperedValid).toBe(false);
  });

  it('retrieves and deletes a record by id', async () => {
    const saved = await saveRteGrievanceRecord(sampleRecord);
    const found = getRteGrievanceById(saved.id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(saved.id);

    const deleted = deleteRteGrievanceRecord(saved.id);
    expect(deleted).toBe(true);
    expect(getRteGrievanceById(saved.id)).toBeNull();
  });

  it('anonymizes and scrubs PII under DPDP Act 2023', () => {
    const minimized = minimizeRteGrievanceForExternal(sampleRecord);
    expect(minimized.childNameRedacted).toContain('***');
    expect(minimized.guardianNameRedacted).toContain('***');
    expect(minimized.contactPhoneRedacted).toBe('XXXXXX3210');
    expect(minimized.complianceStatus).toBe('DPDP-2023-MINIMIZED-CIVIC-RECORD');
  });

  it('exports valid JSON dossier and printable petition text slip', async () => {
    const saved = await saveRteGrievanceRecord(sampleRecord);
    const jsonStr = exportRteGrievanceDossierJson(saved, true);
    expect(jsonStr).toContain('DPDP-2023-MINIMIZED-CIVIC-RECORD');

    const textSlip = exportRteGrievanceTextSlip(saved);
    expect(textSlip).toContain('FORMAL STATUTORY COMPLAINT UNDER SECTION 32 OF THE RIGHT OF CHILDREN');
    expect(textSlip).toContain('Greenwood High School');
    expect(textSlip).toContain('Priya Sharma');
  });
});
