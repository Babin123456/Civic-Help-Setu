import { describe, it, expect } from 'vitest';
import {
  CONFIRM_WITH_DEPARTMENT,
  cleanItemText,
  isAmbiguousRequirement,
  isOfficiallyMandatory,
  extractConditionClause,
  classifyItemText,
  extractChecklistFromBulletList,
  extractChecklistFromParagraphs,
  extractChecklistFromIncompleteText,
  convertRequirementTextToChecklist,
  generateFallbackChecklist,
  generateServiceChecklist,
  readServiceChecklist,
  saveServiceChecklist,
  clearServiceChecklist,
} from './makeChecklistService';
import { REQUIREMENT_TYPES } from './requirementTypes';

describe('makeChecklistService', () => {
  describe('cleanItemText', () => {
    it('strips markdown bullets, numbering, and intro tags', () => {
      expect(cleanItemText('- Aadhaar Card')).toBe('Aadhaar Card');
      expect(cleanItemText('* 2 Passport Photos')).toBe('2 Passport Photos');
      expect(cleanItemText('• Birth Certificate')).toBe('Birth Certificate');
      expect(cleanItemText('1. Voter ID')).toBe('Voter ID');
      expect(cleanItemText('2) Ration Card')).toBe('Ration Card');
      expect(cleanItemText('[ ] Electric Bill')).toBe('Electric Bill');
      expect(cleanItemText('Docs needed: Driving License')).toBe('Driving License');
      expect(cleanItemText('Documents: PAN Card')).toBe('PAN Card');
    });

    it('returns empty string for non-string input', () => {
      expect(cleanItemText(null)).toBe('');
      expect(cleanItemText(undefined)).toBe('');
      expect(cleanItemText(123)).toBe('');
    });
  });

  describe('isAmbiguousRequirement', () => {
    it('detects ambiguous language', () => {
      expect(isAmbiguousRequirement('Affidavit maybe required in some cases')).toBe(true);
      expect(isAmbiguousRequirement('Rent agreement might be asked')).toBe(true);
      expect(isAmbiguousRequirement('Depending on municipal rules, submit Form B')).toBe(true);
      expect(isAmbiguousRequirement('Electricity bill?')).toBe(true);
      expect(isAmbiguousRequirement('Check with the local registrar')).toBe(true);
      expect(isAmbiguousRequirement('In some regions, parents marriage certificate')).toBe(true);
    });

    it('returns false for clear requirements', () => {
      expect(isAmbiguousRequirement('Valid Passport')).toBe(false);
      expect(isAmbiguousRequirement('Original Birth Certificate')).toBe(false);
    });
  });

  describe('isOfficiallyMandatory', () => {
    it('detects explicit mandatory phrasing', () => {
      expect(isOfficiallyMandatory('Aadhaar card is mandatory')).toBe(true);
      expect(isOfficiallyMandatory('Applicants must submit age proof')).toBe(true);
      expect(isOfficiallyMandatory('Compulsory hospital certificate')).toBe(true);
      expect(isOfficiallyMandatory('Form 49A is strictly required')).toBe(true);
    });

    it('returns false when conditional or ambiguous qualifiers exist', () => {
      expect(isOfficiallyMandatory('Must provide rent agreement if residing outside')).toBe(false);
      expect(isOfficiallyMandatory('Affidavit is mandatory maybe?')).toBe(false);
      expect(isOfficiallyMandatory('Optional submission of PAN')).toBe(false);
    });
  });

  describe('extractConditionClause', () => {
    it('extracts conditional clauses accurately', () => {
      expect(extractConditionClause('Submit hospital record if born in a hospital.')).toBe('if born in a hospital');
      expect(extractConditionClause('Rent agreement when residing as a tenant')).toBe('when residing as a tenant');
      expect(extractConditionClause('Medical cert where applicable')).toBe('where applicable');
      expect(extractConditionClause('Plain document with no conditions')).toBeNull();
    });
  });

  describe('classifyItemText', () => {
    it('prioritizes catalogue documentRequirements when present', () => {
      const serviceContext = {
        documentRequirements: {
          'Hospital Discharge': {
            type: REQUIREMENT_TYPES.CONDITIONAL,
            condition: 'Born in hospital',
            source: { name: 'Health Dept' },
          },
        },
      };

      const result = classifyItemText('Hospital Discharge', serviceContext);
      expect(result.type).toBe(REQUIREMENT_TYPES.CONDITIONAL);
      expect(result.condition).toBe('Born in hospital');
    });

    it('labels ambiguous items as Confirm with the department', () => {
      const result = classifyItemText('Affidavit might be required in some jurisdictions');
      expect(result.type).toBe(REQUIREMENT_TYPES.UNVERIFIED);
      expect(result.condition).toBe(CONFIRM_WITH_DEPARTMENT);
      expect(result.isAmbiguous).toBe(true);
    });

    it('does not mark document as mandatory without explicit official mandate', () => {
      const result = classifyItemText('Recent utility bill or electricity invoice');
      expect(result.type).not.toBe(REQUIREMENT_TYPES.REQUIRED);
      expect(result.type).toBe(REQUIREMENT_TYPES.UNVERIFIED);
    });
  });

  describe('extractChecklistFromBulletList', () => {
    it('converts bullet lists into structured checklist items', () => {
      const bulletText = `
        - Aadhaar Card (Must submit original)
        * Proof of address (e.g. electricity bill)
        • Passport size photo x2
        - Notarized affidavit (maybe required depending on local authority)
      `;

      const { items, requirements } = extractChecklistFromBulletList(bulletText);

      expect(items).toHaveLength(4);
      expect(items[0]).toContain('Aadhaar Card');
      expect(requirements[items[0]].type).toBe(REQUIREMENT_TYPES.REQUIRED);

      // Ambiguous item preserved with Confirm with the department label
      const ambiguousItem = items.find((i) => i.includes('affidavit'));
      expect(ambiguousItem).toContain(CONFIRM_WITH_DEPARTMENT);
      expect(requirements[ambiguousItem].condition).toBe(CONFIRM_WITH_DEPARTMENT);
      expect(requirements[ambiguousItem].type).toBe(REQUIREMENT_TYPES.UNVERIFIED);
    });

    it('handles string arrays from service.documents', () => {
      const docs = [
        'Proof of Identity',
        'Proof of Address',
        'Marriage certificate (maybe in some states)',
      ];

      const { items, requirements } = extractChecklistFromBulletList(docs);
      expect(items).toHaveLength(3);
      expect(items[2]).toContain(CONFIRM_WITH_DEPARTMENT);
      expect(requirements[items[2]].isAmbiguous).toBe(true);
    });
  });

  describe('extractChecklistFromParagraphs', () => {
    it('converts long requirement paragraphs into structured checklist items', () => {
      const paragraph = `
        Applicants must provide a valid Proof of Identity such as an Aadhaar Card or Voter ID.
        For age verification, a Birth Certificate is compulsory.
        If living in rented accommodation, a registered rent agreement is required.
        An affidavit may be needed depending on municipal rules.
        Two passport-size photographs should also be submitted.
      `;

      const { items, requirements } = extractChecklistFromParagraphs(paragraph);

      expect(items.length).toBeGreaterThanOrEqual(4);

      // Mandatory items
      const idItem = items.find((i) => i.includes('Proof of Identity'));
      expect(idItem).toBeDefined();
      expect(requirements[idItem].type).toBe(REQUIREMENT_TYPES.REQUIRED);

      const birthItem = items.find((i) => i.includes('Birth Certificate'));
      expect(birthItem).toBeDefined();
      expect(requirements[birthItem].type).toBe(REQUIREMENT_TYPES.REQUIRED);

      // Conditional item
      const rentItem = items.find((i) => i.includes('rent agreement'));
      expect(rentItem).toBeDefined();
      expect(requirements[rentItem].type).toBe(REQUIREMENT_TYPES.CONDITIONAL);

      // Ambiguous item
      const affidavitItem = items.find((i) => i.includes('affidavit'));
      expect(affidavitItem).toBeDefined();
      expect(affidavitItem).toContain(CONFIRM_WITH_DEPARTMENT);
      expect(requirements[affidavitItem].condition).toBe(CONFIRM_WITH_DEPARTMENT);
      expect(requirements[affidavitItem].type).toBe(REQUIREMENT_TYPES.UNVERIFIED);
    });
  });

  describe('extractChecklistFromIncompleteText', () => {
    it('converts incomplete source text and fragments safely', () => {
      const incomplete = `Docs: ID proof, address proof; maybe electricity bill? Note: confirm exact seal with authority. Fee challan copy.`;

      const { items, requirements } = extractChecklistFromIncompleteText(incomplete);

      expect(items.length).toBeGreaterThanOrEqual(3);

      const billItem = items.find((i) => i.includes('electricity bill'));
      expect(billItem).toBeDefined();
      expect(billItem).toContain(CONFIRM_WITH_DEPARTMENT);
      expect(requirements[billItem].isAmbiguous).toBe(true);
      expect(requirements[billItem].type).toBe(REQUIREMENT_TYPES.UNVERIFIED);
    });

    it('handles trailing question marks as uncertainty signals', () => {
      const incomplete = `PAN card, Bank statement?, Passport photo`;
      const { items, requirements } = extractChecklistFromIncompleteText(incomplete);

      const bankItem = items.find((i) => i.includes('Bank statement'));
      expect(bankItem).toContain(CONFIRM_WITH_DEPARTMENT);
      expect(requirements[bankItem].condition).toBe(CONFIRM_WITH_DEPARTMENT);
    });
  });

  describe('convertRequirementTextToChecklist', () => {
    it('adapts parsing based on detected text format', () => {
      const bulletRes = convertRequirementTextToChecklist('- Item 1\n- Item 2');
      expect(bulletRes.items).toHaveLength(2);

      const incompleteRes = convertRequirementTextToChecklist('Docs: Doc A, Doc B?');
      expect(incompleteRes.items.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('generateFallbackChecklist & AI failure handling', () => {
    it('falls back to original service catalogue requirements when AI fails', async () => {
      const mockService = {
        id: 'test-service',
        name: 'Test Civic Service',
        documents: [
          'Original Passport',
          'Utility Bill (Electricity or Gas)',
          'Community Certificate (inquire with tehsildar if required)',
        ],
        documentRequirements: {
          'Original Passport': { type: REQUIREMENT_TYPES.REQUIRED },
        },
      };

      const result = await generateServiceChecklist(mockService, {
        simulateAiFailure: true,
        immediate: true,
      });

      expect(result.isFallback).toBe(true);
      expect(result.fallbackReason).toContain('AI service unavailable');
      expect(result.items).toHaveLength(3);
      expect(result.items[0]).toBe('Original Passport');
      expect(result.requirements['Original Passport'].type).toBe(REQUIREMENT_TYPES.REQUIRED);

      // Uncertainty in catalogue is preserved in fallback
      const communityDoc = result.items.find((i) => i.includes('Community Certificate'));
      expect(communityDoc).toContain(CONFIRM_WITH_DEPARTMENT);
    });

    it('falls back safely when input text is corrupted or empty', () => {
      const result = generateFallbackChecklist(null);
      expect(result.isFallback).toBe(true);
      expect(result.items).toEqual([]);
    });
  });

  describe('Storage persistence', () => {
    const mockStorage = (() => {
      let store = {};
      return {
        getItem: (k) => store[k] || null,
        setItem: (k, v) => {
          store[k] = String(v);
        },
        removeItem: (k) => {
          delete store[k];
        },
        clear: () => {
          store = {};
        },
      };
    })();

    it('saves and reads customized service checklists', () => {
      const serviceId = 'birth-cert-test';
      const checklistData = {
        items: ['Proof of birth', 'Parents ID'],
        requirements: {
          'Proof of birth': { type: 'required' },
          'Parents ID': { type: 'unverified' },
        },
      };

      const saveOk = saveServiceChecklist(serviceId, checklistData, mockStorage);
      expect(saveOk).toBe(true);

      const loaded = readServiceChecklist(serviceId, mockStorage);
      expect(loaded).toBeDefined();
      expect(loaded.items).toEqual(['Proof of birth', 'Parents ID']);
      expect(loaded.requirements['Proof of birth'].type).toBe('required');

      clearServiceChecklist(serviceId, mockStorage);
      const afterClear = readServiceChecklist(serviceId, mockStorage);
      expect(afterClear).toBeNull();
    });
  });
});
