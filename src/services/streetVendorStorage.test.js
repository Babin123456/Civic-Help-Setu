import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveVendorRightsRecord,
  listVendorRightsRecords,
  getVendorRightsById,
  deleteVendorRightsRecord,
  clearAllVendorRightsRecords,
  computeVendorRightsDigest,
  verifyVendorRightsIntegrity,
  minimizeVendorRightsForExternal,
  exportVendorRightsDossierJson,
  exportVendorRightsTextSlip,
} from './streetVendorStorage.js';

describe('streetVendorStorage', () => {
  beforeEach(() => {
    clearAllVendorRightsRecords();
  });

  const sampleRecord = {
    vendorName: 'Shambhu Dayal',
    vendingCategory: 'Stationary Street Vendor (Fixed Pitch)',
    vendingPitchLocation: 'Opposite Metro Gate 2, Laxmi Nagar',
    yearsActive: 7,
    wardNumber: 'Ward 22',
    zoneName: 'East Zone',
    municipalityName: 'East Delhi Municipal Corporation',
    contactPhone: '9871234567',
    immunityAnalysis: {
      hasAbsoluteStatutoryImmunity: true,
      immunityStrength: 'ABSOLUTE',
    },
    seizureAnalysis: {
      isIllegalSeizure: true,
      totalSeizedAssetValueInr: 18000,
      totalRestitutionClaimInr: 5200,
      violations: [{ rule: 'Section 19', issue: 'No inventory memo' }],
    },
    relocationAnalysis: {
      isIllegalRelocation: true,
    },
    grievanceSummary: 'Seized juice counter and fruits without memo during survey freeze',
  };

  it('persists a vendor grievance and generates an immutable SHA-256 seal', async () => {
    const seal = await computeVendorRightsDigest(sampleRecord);
    expect(seal).toBeDefined();

    const saved = await saveVendorRightsRecord(sampleRecord);
    expect(saved.id).toBeDefined();
    expect(saved.sha256Seal).toBeDefined();
    expect(saved.vendorName).toBe('Shambhu Dayal');

    const records = listVendorRightsRecords();
    expect(records.length).toBe(1);
    expect(records[0].id).toBe(saved.id);
  });

  it('verifies seal integrity and detects any record alteration', async () => {
    const saved = await saveVendorRightsRecord(sampleRecord);
    const isValid = await verifyVendorRightsIntegrity(saved);
    expect(isValid).toBe(true);

    const tampered = { ...saved, vendingPitchLocation: 'Altered Location' };
    const isTamperedValid = await verifyVendorRightsIntegrity(tampered);
    expect(isTamperedValid).toBe(false);
  });

  it('retrieves and deletes a record by id', async () => {
    const saved = await saveVendorRightsRecord(sampleRecord);
    const found = getVendorRightsById(saved.id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(saved.id);

    const deleted = deleteVendorRightsRecord(saved.id);
    expect(deleted).toBe(true);
    expect(getVendorRightsById(saved.id)).toBeNull();
  });

  it('anonymizes sensitive vendor personal information under DPDP Act 2023', () => {
    const scrubbed = minimizeVendorRightsForExternal(sampleRecord);
    expect(scrubbed.vendorNameRedacted).toContain('***');
    expect(scrubbed.contactPhoneRedacted).toBe('XXXXXX4567');
    expect(scrubbed.vendingPitchLocationRedacted).toContain('***');
    expect(scrubbed.complianceStatus).toBe('DPDP-2023-MINIMIZED-CIVIC-RECORD');
  });

  it('exports valid JSON dossier and printable Section 20 legal appeal slip', async () => {
    const saved = await saveVendorRightsRecord(sampleRecord);
    const jsonStr = exportVendorRightsDossierJson(saved, true);
    expect(jsonStr).toContain('DPDP-2023-MINIMIZED-CIVIC-RECORD');

    const textSlip = exportVendorRightsTextSlip(saved);
    expect(textSlip).toContain('FORMAL STATUTORY APPEAL UNDER SECTION 20 OF THE STREET VENDORS');
    expect(textSlip).toContain('Shambhu Dayal');
    expect(textSlip).toContain('Maharashtra Ekta Hawkers Union');
  });
});
