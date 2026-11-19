import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeComplaintDigest,
  minimizeForExternal,
  verifyComplaintIntegrity,
  listReraComplaints,
  getReraComplaint,
  saveReraComplaint,
  deleteReraComplaint,
  exportComplaintDossierJson,
  exportComplaintTextSlip,
} from './reraDisputeStorage.js';

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

describe('RERA Dispute Storage Service (#858 follow-up)', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
  });

  const sampleComplaint = {
    formType: 'FORM_M',
    jurisdiction: 'KARNATAKA',
    complainant: {
      name: 'Priya Sharma',
      address: 'Flat 101, Indiranagar, Bengaluru, Karnataka',
      contact: '9845012345',
    },
    promoter: {
      name: 'Adarsh Developers',
      projectName: 'Adarsh Palm Meadows',
      reraRegNo: 'PRM/KA/RERA/1251/310/PR/170915/000100',
      projectLocation: 'Varthur, Bengaluru',
    },
    unitDetails: {
      unitNo: 'Tower C - 504',
    },
    committedPossessionDate: '2023-06-30',
    gracePeriodMonths: 3,
    totalPaidInr: 6500000,
    totalAgreementCostInr: 7500000,
    annualInterestRate: 10.75,
    reliefType: 'WITHDRAWAL_REFUND',
    interimReliefs: ['Restrain third-party alienation.'],
  };

  it('computes deterministic SHA-256 digest', () => {
    const digest1 = computeComplaintDigest(sampleComplaint);
    const digest2 = computeComplaintDigest(sampleComplaint);
    expect(digest1).toBe(digest2);
    expect(digest1).toMatch(/^[a-f0-9]{64}$/);

    const modified = { ...sampleComplaint, totalPaidInr: 7000000 };
    const digestModified = computeComplaintDigest(modified);
    expect(digestModified).not.toBe(digest1);
  });

  it('masks sensitive personal identifiers for external export', () => {
    const redacted = minimizeForExternal(sampleComplaint);
    expect(redacted.complainant.name).toBe('P*** (Masked)');
    expect(redacted.complainant.contact).toBe('XXXXXX2345');
    expect(redacted.complainant.address).toContain('[Masked Ward/Street], Karnataka');
    expect(redacted.unitDetails.unitNo).toBe('[Masked Unit Number]');
    expect(redacted.isRedacted).toBe(true);
  });

  it('saves and retrieves complaints with digital integrity seal', () => {
    const saved = saveReraComplaint(sampleComplaint, mockStorage);
    expect(saved.id).toBeDefined();
    expect(saved.digest).toBeDefined();
    expect(verifyComplaintIntegrity(saved)).toBe(true);

    const list = listReraComplaints(mockStorage);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(saved.id);

    const fetched = getReraComplaint(saved.id, mockStorage);
    expect(fetched.complainant.name).toBe('Priya Sharma');
  });

  it('detects tampering when fields are modified post-save', () => {
    const saved = saveReraComplaint(sampleComplaint, mockStorage);
    expect(verifyComplaintIntegrity(saved)).toBe(true);

    const tampered = { ...saved, totalPaidInr: 9999999 };
    expect(verifyComplaintIntegrity(tampered)).toBe(false);
  });

  it('updates existing complaints without creating duplicates', () => {
    const saved = saveReraComplaint(sampleComplaint, mockStorage);
    const updated = saveReraComplaint(
      { ...saved, totalPaidInr: 7000000 },
      mockStorage
    );

    expect(updated.id).toBe(saved.id);
    const list = listReraComplaints(mockStorage);
    expect(list.length).toBe(1);
    expect(list[0].totalPaidInr).toBe(7000000);
    expect(verifyComplaintIntegrity(updated)).toBe(true);
  });

  it('deletes complaints by id', () => {
    const saved = saveReraComplaint(sampleComplaint, mockStorage);
    expect(listReraComplaints(mockStorage).length).toBe(1);

    const deleted = deleteReraComplaint(saved.id, mockStorage);
    expect(deleted).toBe(true);
    expect(listReraComplaints(mockStorage).length).toBe(0);

    // Deleting non-existent returns false
    expect(deleteReraComplaint('non-existent', mockStorage)).toBe(false);
  });

  it('exports JSON dossier and plain text legal slip', () => {
    const saved = saveReraComplaint(sampleComplaint, mockStorage);
    const jsonDossier = exportComplaintDossierJson(saved);
    expect(jsonDossier).toContain('Priya Sharma');
    expect(jsonDossier).toContain(saved.digest);

    const redactedJson = exportComplaintDossierJson(saved, { redact: true });
    expect(redactedJson).not.toContain('9845012345');
    expect(redactedJson).toContain('XXXXXX2345');

    const textSlip = exportComplaintTextSlip(saved);
    expect(textSlip).toContain('BEFORE THE REAL ESTATE REGULATORY AUTHORITY, KARNATAKA');
    expect(textSlip).toContain('Priya Sharma');
  });
});
