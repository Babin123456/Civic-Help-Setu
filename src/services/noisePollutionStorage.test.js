import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveNoiseLog,
  getStoredNoiseLogs,
  getNoiseLogById,
  deleteNoiseLog,
  clearAllNoiseLogs,
  computeNoiseLogDigest,
  verifyNoiseLogIntegrity,
  minimizeForExternal,
  exportNoiseLogJsonSlip,
  exportNoiseLogTextSlip,
} from './noisePollutionStorage.js';

describe('noisePollutionStorage', () => {
  beforeEach(() => {
    clearAllNoiseLogs();
  });

  const sampleLog = {
    observedDbA: 72,
    zoneKey: 'RESIDENTIAL_AREA',
    exceedanceDbA: 27,
    sourceType: 'LOUDSPEAKER_OR_PA_SYSTEM',
    hourOfDay: 23,
    location: { incidentLocation: 'Near Central Park Gate 2' },
    complainant: { name: 'Kavita Iyer', contact: '9845012345' },
    evaluation: {
      observedDbA: 72,
      permissibleLimitDbA: 45,
      exceedanceDbA: 27,
      soundEnergyMultiplier: 512,
      zoneLabel: 'Residential Area',
      sourceLabel: 'Loudspeaker / Sound Amplifiers',
      estimatedCompoundingFineInr: 15000,
    },
  };

  it('saves a noise log and generates a digital seal', async () => {
    const seal = await computeNoiseLogDigest(sampleLog);
    expect(seal).toBeDefined();

    const saved = await saveNoiseLog(sampleLog);
    expect(saved.id).toBeDefined();
    expect(saved.digitalSeal).toBeDefined();
    expect(saved.observedDbA).toBe(72);

    const logs = getStoredNoiseLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].id).toBe(saved.id);
  });

  it('verifies integrity of untouched log and catches tampering', async () => {
    const saved = await saveNoiseLog(sampleLog);
    const valid = await verifyNoiseLogIntegrity(saved);
    expect(valid).toBe(true);

    const tampered = { ...saved, observedDbA: 50 };
    const tamperedValid = await verifyNoiseLogIntegrity(tampered);
    expect(tamperedValid).toBe(false);
  });

  it('retrieves and deletes a noise log by id', async () => {
    const saved = await saveNoiseLog(sampleLog);
    const found = getNoiseLogById(saved.id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(saved.id);

    const deleted = deleteNoiseLog(saved.id);
    expect(deleted).toBe(true);
    expect(getNoiseLogById(saved.id)).toBeNull();
  });

  it('minimizes PII in accordance with DPDP Act 2023', () => {
    const scrubbed = minimizeForExternal(sampleLog);
    expect(scrubbed.complainant.name).toContain('[REDACTED]');
    expect(scrubbed.complainant.contact).toBe('XXXXXX2345');
  });

  it('exports JSON and text slips', async () => {
    const saved = await saveNoiseLog(sampleLog);
    const jsonStr = exportNoiseLogJsonSlip(saved, true);
    expect(jsonStr).toContain('[REDACTED]');

    const textSlip = exportNoiseLogTextSlip(saved);
    expect(textSlip).toContain('FORMAL STATUTORY COMPLAINT MEMORANDUM UNDER RULE 7');
    expect(textSlip).toContain('72 dB(A)');
  });
});
