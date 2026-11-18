import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveRecord,
  getStoredRecords,
  getRecordById,
  deleteRecord,
  clearAllRecords,
  computeRecordDigest,
  verifyRecordIntegrity,
  minimizeForExternal,
  exportRecordJsonSlip,
  exportRecordTextSlip,
} from './strayAnimalStorage.js';

describe('strayAnimalStorage', () => {
  beforeEach(() => {
    clearAllRecords();
  });

  const sampleRecord = {
    recordType: 'pep_vaccination_log',
    patient: { name: 'Kavita Nair', contact: '9845012345', age: '32 / F', weightKg: 55 },
    category: 'CATEGORY_III',
    exposureDate: '2026-11-12',
    weightKg: 55,
    regimenKey: 'ESSEN_IM',
    rigType: 'HRIG',
    wardNumber: 'Ward 18',
  };

  it('saves a record and generates a digital seal', async () => {
    const seal = await computeRecordDigest(sampleRecord);
    expect(seal).toBeDefined();

    const saved = await saveRecord(sampleRecord);
    expect(saved.id).toBeDefined();
    expect(saved.digitalSeal).toBeDefined();
    expect(saved.patient.name).toBe('Kavita Nair');

    const list = getStoredRecords();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(saved.id);
  });

  it('verifies integrity of untouched record', async () => {
    const saved = await saveRecord(sampleRecord);
    const valid = await verifyRecordIntegrity(saved);
    expect(valid).toBe(true);

    const tampered = { ...saved, weightKg: 99 };
    const tamperedValid = await verifyRecordIntegrity(tampered);
    expect(tamperedValid).toBe(false);
  });

  it('retrieves record by id and deletes it', async () => {
    const saved = await saveRecord(sampleRecord);
    const found = getRecordById(saved.id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(saved.id);

    const deleted = deleteRecord(saved.id);
    expect(deleted).toBe(true);
    expect(getRecordById(saved.id)).toBeNull();
  });

  it('minimizes PII in accordance with DPDP Act 2023', () => {
    const scrubbed = minimizeForExternal(sampleRecord);
    expect(scrubbed.patient.name).toContain('[REDACTED]');
    expect(scrubbed.patient.contact).toBe('XXXXXX2345');
  });

  it('exports JSON and text slips', async () => {
    const saved = await saveRecord(sampleRecord);
    const jsonStr = exportRecordJsonSlip(saved, true);
    expect(jsonStr).toContain('[REDACTED]');

    const textSlip = exportRecordTextSlip(saved);
    expect(textSlip).toContain('RABIES POST-EXPOSURE PROPHYLAXIS (PEP) EMERGENCY MEDICAL PASSPORT');
  });
});
