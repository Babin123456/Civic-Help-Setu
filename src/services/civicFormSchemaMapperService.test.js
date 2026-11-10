import { describe, it, expect } from 'vitest';
import {
  prepareCivicForm,
  checkSchemaSuperSession,
  exportFormReviewSheet,
  FIELD_REQUIREMENT_TIER,
  VALUE_PROVENANCE,
  FORM_PREPARATION_DISCLAIMER,
} from './civicFormSchemaMapperService.js';

describe('Civic Form Schema Mapper and Guided Preparation Service', () => {
  const mockSchema = {
    formId: 'FORM-8-EPIC',
    formName: 'Form 8 - Shifting of Residence / EPIC Correction',
    authority: 'Election Commission of India',
    jurisdiction: 'ALL_INDIA',
    versionNumber: 2,
    effectiveDate: '2024-01-01',
    fields: [
      {
        key: 'epicNumber',
        label: 'Existing EPIC / Voter ID Number',
        tier: FIELD_REQUIREMENT_TIER.REQUIRED,
        plainExplanation: 'Enter your 10-character alphanumeric Voter ID printed on the front of your card.',
        statutoryCitation: 'Registration of Electors Rules 1960, Rule 26',
        validationRegex: '^[A-Z]{3}[0-9]{7}$',
        validationError: 'EPIC number must follow the 3 letters + 7 numbers format (e.g. ABC1234567).',
      },
      {
        key: 'aadhaarNumber',
        label: 'Aadhaar Number (Voluntary Authentication)',
        tier: FIELD_REQUIREMENT_TIER.OPTIONAL,
        plainExplanation: 'Voluntarily provided for authentication under Section 23(6).',
        statutoryCitation: 'Election Laws (Amendment) Act 2021',
      },
      {
        key: 'hasDisability',
        label: 'Person with Disability Marking',
        tier: FIELD_REQUIREMENT_TIER.OPTIONAL,
      },
      {
        key: 'disabilityCategory',
        label: 'Disability Category',
        tier: FIELD_REQUIREMENT_TIER.CONDITIONAL,
        condition: { key: 'hasDisability' },
        plainExplanation: 'Specify visual, locomotive, or hearing assistance if required at polling station.',
      },
    ],
  };

  it('maps fields, checks required inputs, and validates regex patterns', () => {
    const applicantData = {
      epicNumber: 'INVALID_EPIC_1', // Fails 3 letters + 7 digits regex
      hasDisability: true,
      // disabilityCategory is conditionally required now but omitted
    };

    const result = prepareCivicForm({
      schema: mockSchema,
      applicantData,
      provenanceMap: {
        epicNumber: VALUE_PROVENANCE.USER_MANUAL_ENTRY,
      },
    });

    expect(result.isComplete).toBe(false);
    expect(result.validationErrors.length).toBe(1);
    expect(result.validationErrors[0].key).toBe('epicNumber');

    expect(result.missingRequired.length).toBe(1);
    expect(result.missingRequired[0].key).toBe('disabilityCategory');
  });

  it('successfully validates completed form and tracks field provenance', () => {
    const applicantData = {
      epicNumber: 'XYZ1234567',
      hasDisability: false,
    };

    const provenanceMap = {
      epicNumber: VALUE_PROVENANCE.VAULT_PREFILLED,
    };

    const result = prepareCivicForm({
      schema: mockSchema,
      applicantData,
      provenanceMap,
    });

    expect(result.isComplete).toBe(true);
    expect(result.missingRequired.length).toBe(0);
    expect(result.validationErrors.length).toBe(0);

    const epicField = result.fields.find((f) => f.key === 'epicNumber');
    expect(epicField.provenance).toBe(VALUE_PROVENANCE.VAULT_PREFILLED);
    expect(epicField.statutoryCitation).toContain('Registration of Electors Rules');
  });

  it('detects superseded form schema versions', () => {
    const allSchemas = [
      mockSchema,
      {
        formId: 'FORM-8-EPIC',
        jurisdiction: 'ALL_INDIA',
        versionNumber: 3,
        effectiveDate: '2025-01-01',
      },
    ];

    const check = checkSchemaSuperSession(mockSchema, allSchemas);
    expect(check.isSuperseded).toBe(true);
    expect(check.notice).toContain('has been superseded by v3');
  });

  it('exports formatted review sheet without automated submission risk', () => {
    const prepared = prepareCivicForm({
      schema: mockSchema,
      applicantData: { epicNumber: 'XYZ1234567' },
    });

    const sheet = exportFormReviewSheet(prepared);
    expect(sheet).toContain('Guided Preparation Sheet');
    expect(sheet).toContain(FORM_PREPARATION_DISCLAIMER);
    expect(sheet).toContain('PREPARED_FOR_USER_REVIEW_ONLY');
  });
});
