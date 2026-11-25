import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeAuditDigest,
  minimizeForExternal,
  verifyAuditIntegrity,
  listSolidWasteAudits,
  getSolidWasteAudit,
  saveSolidWasteAudit,
  deleteSolidWasteAudit,
  exportAuditDossierJson,
  exportAuditTextSlip,
} from './solidWasteStorage.js';

class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, val) {
    this.store[key] = String(val);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

describe('Solid Waste Storage Service (#878)', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
  });

  const sampleAudit = {
    auditType: 'RULE_15_NOTICE',
    location: {
      address: 'Survey No. 48, Kothrud',
      ward: 'Ward 28',
      city: 'Pune',
      state: 'Maharashtra',
    },
    complainant: {
      name: 'Rajesh Kulkarni',
      address: 'A-201, Green Meadows, Pune',
      contact: '9823012345',
    },
    dumpDimensions: {
      lengthM: 25,
      widthM: 12,
      avgDepthM: 2.5,
    },
    wasteCategory: 'UNCOMPACTED_MIXED_MSW',
    defaultDays: 45,
    estimatedTonnage: 337.5,
    environmentalCompensationInr: 1080000,
    activeBurningObserved: true,
  };

  it('computes deterministic SHA-256 digest', () => {
    const d1 = computeAuditDigest(sampleAudit);
    const d2 = computeAuditDigest(sampleAudit);
    expect(d1).toBe(d2);
    expect(d1).toMatch(/^[a-f0-9]{64}$/);

    const modified = { ...sampleAudit, estimatedTonnage: 400 };
    const dModified = computeAuditDigest(modified);
    expect(dModified).not.toBe(d1);
  });

  it('masks sensitive personal identifiers for external export', () => {
    const redacted = minimizeForExternal(sampleAudit);
    expect(redacted.complainant.name).toBe('R*** (Citizen Rep)');
    expect(redacted.complainant.contact).toBe('XXXXXX2345');
    expect(redacted.complainant.address).toContain('Masked Locality');
    expect(redacted.isRedacted).toBe(true);
  });

  it('saves and retrieves audits with valid digital seal', () => {
    const saved = saveSolidWasteAudit(sampleAudit, mockStorage);
    expect(saved.id).toBeDefined();
    expect(saved.digest).toBeDefined();
    expect(verifyAuditIntegrity(saved)).toBe(true);

    const retrieved = getSolidWasteAudit(saved.id, mockStorage);
    expect(retrieved).not.toBeNull();
    expect(retrieved.location.city).toBe('Pune');

    const all = listSolidWasteAudits(mockStorage);
    expect(all.length).toBe(1);
  });

  it('detects tampering when audit content is modified', () => {
    const saved = saveSolidWasteAudit(sampleAudit, mockStorage);
    expect(verifyAuditIntegrity(saved)).toBe(true);

    const tampered = { ...saved, estimatedTonnage: 9999 };
    expect(verifyAuditIntegrity(tampered)).toBe(false);
  });

  it('deletes an audit by ID', () => {
    const saved = saveSolidWasteAudit(sampleAudit, mockStorage);
    expect(listSolidWasteAudits(mockStorage).length).toBe(1);

    const deleted = deleteSolidWasteAudit(saved.id, mockStorage);
    expect(deleted).toBe(true);
    expect(listSolidWasteAudits(mockStorage).length).toBe(0);
  });

  it('exports audit as signed JSON and legal text slip', () => {
    const saved = saveSolidWasteAudit(sampleAudit, mockStorage);

    const json = exportAuditDossierJson(saved, { redact: true });
    expect(json).toContain('XXXXXX2345');

    const slip = exportAuditTextSlip(saved);
    expect(slip).toContain('FORMAL STATUTORY NOTICE');
    expect(slip).toContain('337.5 METRIC TONNES');
  });
});
