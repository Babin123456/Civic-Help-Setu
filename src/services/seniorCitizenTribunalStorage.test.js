import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  STORAGE_KEY,
  computePetitionDigest,
  verifyPetitionIntegrity,
  savePetition,
  getPetitions,
  getPetitionById,
  deletePetition,
  clearPetitions,
  exportSignedPetitionDossier,
  downloadPetitionTextFile,
  downloadPetitionJsonDossier,
} from './seniorCitizenTribunalStorage.js';

describe('seniorCitizenTribunalStorage (#858)', () => {
  let mockStorage;

  beforeEach(() => {
    const store = new Map();
    mockStorage = {
      getItem: vi.fn((key) => store.get(key) || null),
      setItem: vi.fn((key, val) => store.set(key, String(val))),
      removeItem: vi.fn((key) => store.delete(key)),
      clear: vi.fn(() => store.clear()),
    };
  });

  const samplePetition = {
    caseType: 'MAINTENANCE_AND_EXPENSES',
    formCode: 'FORM-A',
    tribunalTitle: 'BEFORE THE MAINTENANCE TRIBUNAL, PATNA, BIHAR',
    filingReference: 'MWPSC-PAT-102934',
    petitioner: {
      name: 'Kamla Devi',
      age: 68,
      address: 'Kankarbagh, Patna',
      phone: '9876543210',
    },
    respondents: [
      {
        name: 'Rajesh Kumar',
        relationship: 'Son',
        address: 'Boring Road, Patna',
        monthlyIncome: 50000,
        hasInheritedProperty: false,
      },
    ],
    monthlyClaim: 8000,
    propertyDescription: '',
    narrative: 'Petitioner has arthritis and cannot afford medicines.',
  };

  describe('computePetitionDigest and verifyPetitionIntegrity', () => {
    it('computes consistent SHA-256 digest', () => {
      const digest1 = computePetitionDigest(samplePetition);
      const digest2 = computePetitionDigest(samplePetition);

      expect(digest1).toBe(digest2);
      expect(digest1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('verifies genuine petition as VALID', () => {
      const digest = computePetitionDigest(samplePetition);
      const signed = { ...samplePetition, sha256Digest: digest };

      const verdict = verifyPetitionIntegrity(signed);
      expect(verdict.valid).toBe(true);
      expect(verdict.status).toBe('VALID');
      expect(verdict.digest).toBe(digest);
    });

    it('detects tampering when narrative or claims are modified', () => {
      const digest = computePetitionDigest(samplePetition);
      const tampered = { ...samplePetition, monthlyClaim: 50000, sha256Digest: digest };

      const verdict = verifyPetitionIntegrity(tampered);
      expect(verdict.valid).toBe(false);
      expect(verdict.status).toBe('TAMPERED');
      expect(verdict.reason).toContain('Cryptographic digest mismatch');
    });

    it('handles null and unsealed objects safely', () => {
      expect(verifyPetitionIntegrity(null).status).toBe('INVALID');
      expect(verifyPetitionIntegrity(samplePetition).status).toBe('UNSEALED');
      expect(computePetitionDigest(null)).toBe('0'.repeat(64));
    });
  });

  describe('savePetition, getPetitions, getPetitionById, and deletePetition', () => {
    it('saves, retrieves, and updates petitions with digital seals in storage', () => {
      const saved = savePetition(samplePetition, mockStorage);
      expect(saved.id).toBe('MWPSC-PAT-102934');
      expect(saved.sha256Digest).toBeDefined();

      const list = getPetitions(mockStorage);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('MWPSC-PAT-102934');

      const found = getPetitionById('MWPSC-PAT-102934', mockStorage);
      expect(found).not.toBeNull();
      expect(found.petitioner.name).toBe('Kamla Devi');

      // Update petition
      const updated = savePetition({ ...saved, monthlyClaim: 9500 }, mockStorage);
      expect(updated.monthlyClaim).toBe(9500);
      const updatedList = getPetitions(mockStorage);
      expect(updatedList).toHaveLength(1);
      expect(updatedList[0].monthlyClaim).toBe(9500);
    });

    it('deletes an existing petition and handles clearing', () => {
      savePetition(samplePetition, mockStorage);
      expect(getPetitions(mockStorage)).toHaveLength(1);

      const deleted = deletePetition('MWPSC-PAT-102934', mockStorage);
      expect(deleted).toBe(true);
      expect(getPetitions(mockStorage)).toHaveLength(0);

      // Deleting non-existent returns false
      expect(deletePetition('NON_EXISTENT', mockStorage)).toBe(false);

      // Clear
      savePetition(samplePetition, mockStorage);
      clearPetitions(mockStorage);
      expect(mockStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('returns empty array when storage is empty or corrupted', () => {
      expect(getPetitions(mockStorage)).toEqual([]);
      mockStorage.getItem.mockReturnValueOnce('{invalid_json');
      expect(getPetitions(mockStorage)).toEqual([]);
    });

    it('throws error when saving invalid petition', () => {
      expect(() => savePetition(null, mockStorage)).toThrow('Invalid petition payload');
    });
  });

  describe('exportSignedPetitionDossier', () => {
    it('creates exportable signed JSON dossier with signature metadata', () => {
      const dossier = exportSignedPetitionDossier(samplePetition);

      expect(dossier).not.toBeNull();
      expect(dossier.exportType).toBe('SENIOR_CITIZEN_TRIBUNAL_STATUTORY_PETITION');
      expect(dossier.signatureMetadata.algorithm).toBe('SHA-256');
      expect(dossier.signatureMetadata.canonicalDigest).toBe(dossier.petition.sha256Digest);
      expect(dossier.signatureMetadata.statutoryAct).toContain('56 of 2007');
    });

    it('returns null for empty petition', () => {
      expect(exportSignedPetitionDossier(null)).toBeNull();
    });
  });

  describe('DOM downloads', () => {
    const originalDocument = globalThis.document;
    const originalURL = globalThis.URL;

    afterEach(() => {
      globalThis.document = originalDocument;
      globalThis.URL = originalURL;
    });

    it('downloads text file and JSON dossier in DOM environment safely', () => {
      const mockClick = vi.fn();
      const mockCreateObjectUrl = vi.fn().mockReturnValue('blob:mock-url');
      const mockRevokeObjectUrl = vi.fn();

      globalThis.document = {
        createElement: vi.fn().mockReturnValue({
          href: '',
          download: '',
          click: mockClick,
        }),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
      };

      globalThis.URL = {
        createObjectURL: mockCreateObjectUrl,
        revokeObjectURL: mockRevokeObjectUrl,
      };

      downloadPetitionTextFile(samplePetition);
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectUrl).toHaveBeenCalledWith('blob:mock-url');

      mockClick.mockClear();
      downloadPetitionJsonDossier(samplePetition);
      expect(mockClick).toHaveBeenCalled();
    });

    it('handles missing document safely', () => {
      delete globalThis.document;
      expect(() => downloadPetitionTextFile(samplePetition)).not.toThrow();
      expect(() => downloadPetitionJsonDossier(samplePetition)).not.toThrow();
    });
  });
});
