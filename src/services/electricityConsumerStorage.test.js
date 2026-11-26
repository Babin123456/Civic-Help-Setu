import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveElectricityGrievanceRecord,
  listElectricityGrievanceRecords,
  getElectricityGrievanceById,
  deleteElectricityGrievanceRecord,
  clearAllElectricityGrievanceRecords,
  computeElectricityGrievanceDigest,
  verifyElectricityGrievanceIntegrity,
  minimizeElectricityGrievanceForExternal,
  exportElectricityGrievanceDossierJson,
  exportElectricityGrievanceTextSlip,
} from './electricityConsumerStorage.js';

describe('electricityConsumerStorage', () => {
  beforeEach(() => {
    clearAllElectricityGrievanceRecords();
  });

  const sampleRecord = {
    consumerName: 'Rajesh Mehra',
    caNumber: 'CA-10293847',
    meterNumber: 'MTR-77665',
    sanctionedLoadKw: '4 kW Commercial',
    consumerAddress: 'Shop 14, Commercial Complex, Sector 18',
    contactPhone: '9811223344',
    discomName: 'TPDDL (Tata Power Delhi Distribution Ltd)',
    divisionOffice: 'Civil Lines Division',
    districtName: 'North Delhi',
    stateName: 'Delhi',
    sopAnalysis: {
      hasClaim: true,
      totalCompensationInr: 1450,
    },
    disconnectionAnalysis: {
      isIllegalDisconnection: true,
      severity: 'HIGHLY_ILLEGAL',
    },
    meterAnalysis: {
      isErraticSpike: true,
      estimatedRefundInr: 4200,
    },
    grievanceDescription: 'Power outage lasting 3 days with burnt transformer and illegal disconnection',
  };

  it('saves an electricity grievance and generates a valid SHA-256 seal', async () => {
    const seal = await computeElectricityGrievanceDigest(sampleRecord);
    expect(seal).toBeDefined();

    const saved = await saveElectricityGrievanceRecord(sampleRecord);
    expect(saved.id).toBeDefined();
    expect(saved.sha256Seal).toBeDefined();
    expect(saved.discomName).toContain('TPDDL');

    const records = listElectricityGrievanceRecords();
    expect(records.length).toBe(1);
    expect(records[0].id).toBe(saved.id);
  });

  it('verifies seal integrity and detects any record tampering', async () => {
    const saved = await saveElectricityGrievanceRecord(sampleRecord);
    const isValid = await verifyElectricityGrievanceIntegrity(saved);
    expect(isValid).toBe(true);

    const tampered = { ...saved, caNumber: 'CA-ALTERED-9999' };
    const isTamperedValid = await verifyElectricityGrievanceIntegrity(tampered);
    expect(isTamperedValid).toBe(false);
  });

  it('retrieves and deletes an electricity record by id', async () => {
    const saved = await saveElectricityGrievanceRecord(sampleRecord);
    const found = getElectricityGrievanceById(saved.id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(saved.id);

    const deleted = deleteElectricityGrievanceRecord(saved.id);
    expect(deleted).toBe(true);
    expect(getElectricityGrievanceById(saved.id)).toBeNull();
  });

  it('anonymizes sensitive consumer PII under DPDP Act 2023', () => {
    const scrubbed = minimizeElectricityGrievanceForExternal(sampleRecord);
    expect(scrubbed.consumerNameRedacted).toContain('***');
    expect(scrubbed.caNumberRedacted).toContain('XXXXXX');
    expect(scrubbed.meterNumberRedacted).toContain('MTR-***');
    expect(scrubbed.contactPhoneRedacted).toBe('XXXXXX3344');
    expect(scrubbed.complianceStatus).toBe('DPDP-2023-MINIMIZED-CIVIC-RECORD');
  });

  it('exports valid JSON dossier and printable CGRF petition text slip', async () => {
    const saved = await saveElectricityGrievanceRecord(sampleRecord);
    const jsonStr = exportElectricityGrievanceDossierJson(saved, true);
    expect(jsonStr).toContain('DPDP-2023-MINIMIZED-CIVIC-RECORD');

    const textSlip = exportElectricityGrievanceTextSlip(saved);
    expect(textSlip).toContain('FORMAL STATUTORY GRIEVANCE PETITION UNDER SECTION 42(5)');
    expect(textSlip).toContain('Rajesh Mehra');
    expect(textSlip).toContain('TPDDL');
  });
});
