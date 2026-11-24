import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveGrievance,
  getStoredGrievances,
  getGrievanceById,
  deleteGrievance,
  clearAllGrievances,
  computeGrievanceDigest,
  verifyGrievanceIntegrity,
  minimizeForExternal,
  exportGrievanceJsonSlip,
  exportGrievanceTextSlip,
} from './clinicalEstablishmentStorage.js';

describe('clinicalEstablishmentStorage', () => {
  beforeEach(() => {
    clearAllGrievances();
  });

  const sampleGrievance = {
    hospitalName: 'CareMax Superspecialty Hospital',
    district: 'Bengaluru Urban',
    emergencyType: 'Acute Cardiac Arrest',
    patient: { name: 'Sunil Rao', contact: '9845012345', address: '4th Block, Koramangala' },
    ipdNumber: 'IPD-49021',
    billingAnalysis: {
      totalInvoicedInr: 150000,
      totalStatutoryCeilingInr: 80000,
      totalOverchargeInr: 70000,
      overchargePercent: 87.5,
    },
    compliance: {
      severityScore: 70,
      violations: [
        { rule: 'Section 56 CEA 2010', violation: 'Demand of advance deposit before ICU admission', legalImpact: 'License cancellation' },
      ],
    },
  };

  it('saves a patient grievance and generates a digital seal', async () => {
    const seal = await computeGrievanceDigest(sampleGrievance);
    expect(seal).toBeDefined();

    const saved = await saveGrievance(sampleGrievance);
    expect(saved.id).toBeDefined();
    expect(saved.digitalSeal).toBeDefined();
    expect(saved.hospitalName).toBe('CareMax Superspecialty Hospital');

    const list = getStoredGrievances();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(saved.id);
  });

  it('verifies integrity of untouched grievance and catches tampering', async () => {
    const saved = await saveGrievance(sampleGrievance);
    const valid = await verifyGrievanceIntegrity(saved);
    expect(valid).toBe(true);

    const tampered = { ...saved, hospitalName: 'Different Hospital' };
    const tamperedValid = await verifyGrievanceIntegrity(tampered);
    expect(tamperedValid).toBe(false);
  });

  it('retrieves and deletes a grievance by id', async () => {
    const saved = await saveGrievance(sampleGrievance);
    const found = getGrievanceById(saved.id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(saved.id);

    const deleted = deleteGrievance(saved.id);
    expect(deleted).toBe(true);
    expect(getGrievanceById(saved.id)).toBeNull();
  });

  it('minimizes PII in accordance with DPDP Act 2023', () => {
    const scrubbed = minimizeForExternal(sampleGrievance);
    expect(scrubbed.patient.name).toContain('[REDACTED]');
    expect(scrubbed.patient.contact).toBe('XXXXXX2345');
    expect(scrubbed.ipdNumber).toBe('IPD-REDACTED-XXXX');
  });

  it('exports JSON and text slips', async () => {
    const saved = await saveGrievance(sampleGrievance);
    const jsonStr = exportGrievanceJsonSlip(saved, true);
    expect(jsonStr).toContain('[REDACTED]');

    const textSlip = exportGrievanceTextSlip(saved);
    expect(textSlip).toContain('FORMAL STATUTORY COMPLAINT UNDER SECTION 41 & 42');
    expect(textSlip).toContain('CareMax Superspecialty Hospital');
  });
});
