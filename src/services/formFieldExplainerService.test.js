import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAllCataloguedForms,
  getFormById,
  getFormFields,
  getFieldExplanation,
  validateFieldFormat,
  evaluateConditionalField,
  detectFormVersionChange,
  getPendingReviewQueue,
  approveRevisedFormVersion,
  submitOfficialForm,
  resetFormCatalogue,
} from './formFieldExplainerService';
import { FORM_STATUS } from '../data/upFormFieldExplainerCatalogue';

describe('Multilingual Government Form Field Explainer Service (#1001)', () => {
  beforeEach(() => {
    resetFormCatalogue();
  });

  // =========================================================================
  // 1. Five High-Volume UP Forms Scope & Catalogue Metadata
  // =========================================================================
  describe('Scope & Catalogue Verification (5 UP Forms)', () => {
    it('catalogues exactly five high-volume UP forms with verified department sources', () => {
      const forms = getAllCataloguedForms();
      expect(forms.length).toBe(5);

      const formIds = forms.map((f) => f.formId);
      expect(formIds).toContain('up_income_certificate_v1');
      expect(formIds).toContain('up_domicile_certificate_v1');
      expect(formIds).toContain('up_caste_certificate_v1');
      expect(formIds).toContain('up_old_age_pension_v1');
      expect(formIds).toContain('up_jan_sunwai_grievance_v1');
    });

    it('asserts every catalogued form has verified issuer, jurisdiction, version, and source URL', () => {
      const forms = getAllCataloguedForms();
      forms.forEach((form) => {
        expect(form.jurisdiction).toBe('Uttar Pradesh');
        expect(form.departmentIssuer).toBeTruthy();
        expect(form.version).toBeTruthy();
        expect(form.sourceUrl).toMatch(/^https:\/\/[a-z0-9-]+\.(up\.)?gov\.in/);
        expect(form.lastVerifiedDate).toBeTruthy();
        expect(form.status).toBe(FORM_STATUS.ACTIVE);
        expect(form.fields.length).toBeGreaterThanOrEqual(7);
      });
    });

    it('retrieves form fields accurately by formId', () => {
      const fields = getFormFields('up_income_certificate_v1');
      expect(fields.length).toBeGreaterThan(0);
      const fieldIds = fields.map((f) => f.fieldId);
      expect(fieldIds).toContain('applicant_name_hi');
      expect(fieldIds).toContain('total_annual_family_income');
      expect(fieldIds).toContain('pincode');
      expect(fieldIds).toContain('aadhaar_number');
    });

    it('returns empty array when querying non-existent formId', () => {
      expect(getFormFields('non_existent_form')).toEqual([]);
    });
  });

  // =========================================================================
  // 2. Acceptance Criterion: Every explanation is linked to official version & source
  // =========================================================================
  describe('Explanation Traceability & Non-Autofill Boundaries', () => {
    it('links explanation directly to form version, department, and source URL', () => {
      const explanation = getFieldExplanation(
        'up_income_certificate_v1',
        'total_annual_family_income',
        'en'
      );

      expect(explanation.formId).toBe('up_income_certificate_v1');
      expect(explanation.formVersion).toBe('2024.1');
      expect(explanation.departmentIssuer).toContain('Department of Revenue');
      expect(explanation.sourceUrl).toBe('https://edistrict.up.gov.in/edistrictup/');
      expect(explanation.submissionBoundaryNotice).toContain('Civic Help Setu never autofills or submits');
    });

    it('strictly forbids form submissions and throws educational safety error', () => {
      expect(() => submitOfficialForm()).toThrowError(/Submission Denied/);
    });

    it('returns error when requesting an unknown field or form', () => {
      const invalidForm = getFieldExplanation('unknown_form', 'name');
      expect(invalidForm.isRecognized).toBe(false);
      expect(invalidForm.error).toContain('not found');

      const invalidField = getFieldExplanation('up_income_certificate_v1', 'random_field');
      expect(invalidField.isRecognized).toBe(false);
      expect(invalidField.error).toContain('not found in form');
    });
  });

  // =========================================================================
  // 3. Acceptance Criterion: Examples NEVER contain real citizen data
  // =========================================================================
  describe('Synthetic Fictional Data Invariant', () => {
    it('ensures all field examples are explicitly tagged as fictional samples', () => {
      const forms = getAllCataloguedForms();
      forms.forEach((form) => {
        form.fields.forEach((field) => {
          if (field.fictionalExample) {
            expect(field.fictionalExample).toContain('Fictional Sample');
            // Ensure no real live mobile number or real Aadhaar
            expect(field.fictionalExample).not.toMatch(/^(\+91|91)?[6-9]\d{9}$/);
          }
        });
      });
    });

    it('getFieldExplanation always preserves the fictional data marker', () => {
      const explanation = getFieldExplanation(
        'up_old_age_pension_v1',
        'beneficiary_name',
        'hi'
      );
      expect(explanation.fictionalExample).toContain('Fictional Sample - Do not copy');
    });
  });

  // =========================================================================
  // 4. Acceptance Criterion: Sensitive fields are clearly identified
  // =========================================================================
  describe('Sensitive Fields & Security Demarcation', () => {
    it('flags Aadhaar, bank account, income, and mobile fields as sensitive', () => {
      const pensionFields = getFormFields('up_old_age_pension_v1');

      const aadhaarField = pensionFields.find((f) => f.fieldId === 'aadhaar_number');
      expect(aadhaarField.isSensitive).toBe(true);
      expect(aadhaarField.sensitivityWarning).toContain('Enter only on official');

      const bankField = pensionFields.find((f) => f.fieldId === 'bank_account_number');
      expect(bankField.isSensitive).toBe(true);
      expect(bankField.sensitivityWarning).toContain('Financial credential');

      const mobileField = pensionFields.find((f) => f.fieldId === 'mobile_number');
      expect(mobileField.isSensitive).toBe(true);
      expect(mobileField.sensitivityWarning).toContain('confidential');
    });

    it('attaches sensitivity warning in getFieldExplanation for sensitive fields', () => {
      const explanation = getFieldExplanation(
        'up_income_certificate_v1',
        'aadhaar_number',
        'en'
      );
      expect(explanation.isSensitive).toBe(true);
      expect(explanation.sensitivityWarning).toBeTruthy();
      expect(explanation.sensitivityWarning).toContain('CRITICAL');
    });

    it('leaves non-sensitive fields without sensitivity warnings', () => {
      const explanation = getFieldExplanation(
        'up_income_certificate_v1',
        'tehsil_name',
        'en'
      );
      expect(explanation.isSensitive).toBe(false);
      expect(explanation.sensitivityWarning).toBeNull();
    });
  });

  // =========================================================================
  // 5. Acceptance Criterion: Multilingual & Language Fallback
  // =========================================================================
  describe('Multilingual Translation & Fallback Hierarchy', () => {
    it('returns Hindi translation when Hindi is requested', () => {
      const explanation = getFieldExplanation(
        'up_income_certificate_v1',
        'parent_spouse_name',
        'hi'
      );
      expect(explanation.resolvedLanguage).toBe('hi');
      expect(explanation.label).toBe('पिता या पति का नाम');
    });

    it('returns Tamil translation when Tamil is requested and available', () => {
      const explanation = getFieldExplanation(
        'up_income_certificate_v1',
        'pincode',
        'ta'
      );
      expect(explanation.resolvedLanguage).toBe('ta');
      expect(explanation.label).toBe('அஞ்சல் குறியீட்டு எண்');
    });

    it('returns Bengali translation when Bengali is requested and available', () => {
      const explanation = getFieldExplanation(
        'up_income_certificate_v1',
        'pincode',
        'bn'
      );
      expect(explanation.resolvedLanguage).toBe('bn');
      expect(explanation.label).toBe('পোস্টাল পিন কোড');
    });

    it('gracefully falls back to English when requested language is unsupported or missing', () => {
      const explanation = getFieldExplanation(
        'up_income_certificate_v1',
        'parent_spouse_name',
        'fr' // French not explicitly defined
      );
      expect(explanation.resolvedLanguage).toBe('en');
      expect(explanation.label).toBe("Father's / Husband's Full Name");
    });
  });

  // =========================================================================
  // 6. Acceptance Criterion: Conditional Fields & Dependency Rules
  // =========================================================================
  describe('Conditional Fields & Dynamic Evaluation', () => {
    it('marks non-conditional fields as universally applicable', () => {
      const field = getFormFields('up_income_certificate_v1').find(
        (f) => f.fieldId === 'applicant_name_en'
      );
      const evalResult = evaluateConditionalField(field, {});
      expect(evalResult.isApplicable).toBe(true);
      expect(evalResult.isConditional).toBe(false);
    });

    it('activates agricultural land field when applicant occupation is AGRICULTURE', () => {
      const field = getFormFields('up_income_certificate_v1').find(
        (f) => f.fieldId === 'agricultural_land_khasra'
      );

      // Inactive when salaried
      const inactiveResult = evaluateConditionalField(field, {
        applicant_occupation: 'SALARIED',
      });
      expect(inactiveResult.isApplicable).toBe(false);
      expect(inactiveResult.reason).toContain('Hidden / Not Applicable');

      // Active when agriculture
      const activeResult = evaluateConditionalField(field, {
        applicant_occupation: 'AGRICULTURE',
      });
      expect(activeResult.isApplicable).toBe(true);
      expect(activeResult.reason).toContain('Active: Required by Lekhpal');
      expect(activeResult.officialSourceCitation).toContain('UP Bhulekh');
    });

    it('evaluates urban ward vs rural gram panchayat in UP Domicile form', () => {
      const fields = getFormFields('up_domicile_certificate_v1');
      const gramPanchayat = fields.find((f) => f.fieldId === 'gram_panchayat_name');
      const urbanWard = fields.find((f) => f.fieldId === 'urban_ward_name');

      // Test RURAL context
      expect(evaluateConditionalField(gramPanchayat, { area_type: 'RURAL' }).isApplicable).toBe(true);
      expect(evaluateConditionalField(urbanWard, { area_type: 'RURAL' }).isApplicable).toBe(false);

      // Test URBAN context
      expect(evaluateConditionalField(gramPanchayat, { area_type: 'URBAN' }).isApplicable).toBe(false);
      expect(evaluateConditionalField(urbanWard, { area_type: 'URBAN' }).isApplicable).toBe(true);
    });

    it('evaluates minor domicile certificate linkage when applicant stay is under 18', () => {
      const field = getFormFields('up_domicile_certificate_v1').find(
        (f) => f.fieldId === 'minor_guardian_domicile_ref'
      );

      // Adult applicant
      expect(evaluateConditionalField(field, { stay_duration_years: 25 }).isApplicable).toBe(false);

      // Minor applicant (<18)
      const minorEval = evaluateConditionalField(field, { stay_duration_years: 12 });
      expect(minorEval.isApplicable).toBe(true);
      expect(minorEval.reason).toContain('minor');
    });

    it('evaluates OBC creamy layer condition in UP Caste Certificate form', () => {
      const field = getFormFields('up_caste_certificate_v1').find(
        (f) => f.fieldId === 'creamy_layer_exclusion_declaration'
      );

      // SC applicant: NCL not applicable
      expect(evaluateConditionalField(field, { caste_category: 'SC' }).isApplicable).toBe(false);

      // OBC applicant: NCL declaration mandatory
      const obcEval = evaluateConditionalField(field, { caste_category: 'OBC' });
      expect(obcEval.isApplicable).toBe(true);
      expect(obcEval.reason).toContain('Indra Sawhney');
    });

    it('evaluates land dispute khasra requirement in UP Jan Sunwai form', () => {
      const field = getFormFields('up_jan_sunwai_grievance_v1').find(
        (f) => f.fieldId === 'land_khasra_number'
      );

      // Electricity complaint: Khasra not applicable
      expect(
        evaluateConditionalField(field, {
          grievance_department_category: 'ELECTRICITY_POWER',
        }).isApplicable
      ).toBe(false);

      // Land dispute: Khasra mandatory
      expect(
        evaluateConditionalField(field, {
          grievance_department_category: 'REVENUE_LAND_DISPUTE',
        }).isApplicable
      ).toBe(true);
    });
  });

  // =========================================================================
  // 7. Acceptance Criterion: Deterministic Format Validation
  // =========================================================================
  describe('Deterministic Format Validation', () => {
    describe('PIN Code (UP Circle 20xxxx to 28xxxx)', () => {
      const pincodeField = {
        formatValidation: {
          type: 'PINCODE_UP',
          errorMessage: 'Invalid UP PIN code.',
          tip: 'UP pincodes start with 20xxxx-28xxxx.',
        },
      };

      it('accepts valid UP PIN codes', () => {
        expect(validateFieldFormat(pincodeField, '226001').isValid).toBe(true); // Lucknow
        expect(validateFieldFormat(pincodeField, '208001').isValid).toBe(true); // Kanpur
        expect(validateFieldFormat(pincodeField, '282001').isValid).toBe(true); // Agra
      });

      it('rejects invalid PIN codes or non-UP postal circles', () => {
        expect(validateFieldFormat(pincodeField, '110001').isValid).toBe(false); // Delhi (11)
        expect(validateFieldFormat(pincodeField, '560001').isValid).toBe(false); // Bengaluru (56)
        expect(validateFieldFormat(pincodeField, '2260').isValid).toBe(false); // Too short
        expect(validateFieldFormat(pincodeField, '2260001').isValid).toBe(false); // Too long
        expect(validateFieldFormat(pincodeField, 'ABCDEF').isValid).toBe(false); // Letters
      });
    });

    describe('Aadhaar Number (12 numeric digits, not starting with 0 or 1)', () => {
      const aadhaarField = {
        formatValidation: {
          type: 'AADHAAR',
          errorMessage: 'Aadhaar must be 12 digits.',
        },
      };

      it('accepts valid 12-digit Aadhaar formats', () => {
        expect(validateFieldFormat(aadhaarField, '234567890123').isValid).toBe(true);
        expect(validateFieldFormat(aadhaarField, '9999 8888 7777').isValid).toBe(true); // spaces ignored
      });

      it('rejects invalid Aadhaar numbers', () => {
        expect(validateFieldFormat(aadhaarField, '012345678901').isValid).toBe(false); // Starts with 0
        expect(validateFieldFormat(aadhaarField, '123456789012').isValid).toBe(false); // Starts with 1
        expect(validateFieldFormat(aadhaarField, '23456789012').isValid).toBe(false); // 11 digits
        expect(validateFieldFormat(aadhaarField, '2345678901234').isValid).toBe(false); // 13 digits
      });
    });

    describe('Bank Account & Bank IFSC', () => {
      const bankAccountField = { formatValidation: { type: 'BANK_ACCOUNT' } };
      const ifscField = { formatValidation: { type: 'IFSC' } };

      it('validates bank accounts correctly', () => {
        expect(validateFieldFormat(bankAccountField, '123456789').isValid).toBe(true);
        expect(validateFieldFormat(bankAccountField, '123456789012345678').isValid).toBe(true);
        expect(validateFieldFormat(bankAccountField, '12345678').isValid).toBe(false); // 8 digits (too short)
        expect(validateFieldFormat(bankAccountField, '1234567890123456789').isValid).toBe(false); // 19 digits (too long)
      });

      it('validates bank IFSC codes accurately', () => {
        expect(validateFieldFormat(ifscField, 'SBIN0000123').isValid).toBe(true);
        expect(validateFieldFormat(ifscField, 'PUNB0029300').isValid).toBe(true);
        expect(validateFieldFormat(ifscField, 'SBINO000123').isValid).toBe(false); // Letter O instead of 0
        expect(validateFieldFormat(ifscField, 'SBI000123').isValid).toBe(false); // Too short
      });
    });

    describe('Date of Birth & Minimum Age (Old Age Pension >= 60 years)', () => {
      const minAgeField = {
        formatValidation: {
          type: 'MIN_AGE',
          minAgeYears: 60,
          errorMessage: 'Must be 60 years or older.',
        },
      };

      it('accepts birth date meeting the 60 years age threshold', () => {
        expect(validateFieldFormat(minAgeField, '01/01/1950').isValid).toBe(true);
        expect(validateFieldFormat(minAgeField, '15/08/1960').isValid).toBe(true);
      });

      it('rejects birth date younger than 60 years or in the future', () => {
        expect(validateFieldFormat(minAgeField, '01/01/2000').isValid).toBe(false); // Age ~26
        expect(validateFieldFormat(minAgeField, '01/01/2030').isValid).toBe(false); // Future date
        expect(validateFieldFormat(minAgeField, '1960-01-01').isValid).toBe(false); // Wrong format (requires DD/MM/YYYY)
      });
    });

    describe('Mobile Number (10 digits starting with 6-9)', () => {
      const mobileField = { formatValidation: { type: 'MOBILE' } };

      it('accepts valid Indian mobile numbers', () => {
        expect(validateFieldFormat(mobileField, '9876543210').isValid).toBe(true);
        expect(validateFieldFormat(mobileField, '6390123456').isValid).toBe(true);
      });

      it('rejects invalid mobile numbers', () => {
        expect(validateFieldFormat(mobileField, '5555555555').isValid).toBe(false); // Starts with 5
        expect(validateFieldFormat(mobileField, '987654321').isValid).toBe(false); // 9 digits
        expect(validateFieldFormat(mobileField, '98765432100').isValid).toBe(false); // 11 digits
      });
    });
  });

  // =========================================================================
  // 8. Acceptance Criterion: Version Drift & Change Detection Workflow
  // =========================================================================
  describe('Form Version Change Detection & Outdated Guidance Withdrawal', () => {
    it('detects when downloaded form version matches catalogued version', () => {
      const result = detectFormVersionChange('up_income_certificate_v1', '2024.1');
      expect(result.detected).toBe(false);
      expect(result.message).toContain('remains verified');
    });

    it('detects when official form version drifts, withdraws active guidance, and queues for review', () => {
      // Government rolls out v2025.1
      const driftResult = detectFormVersionChange(
        'up_income_certificate_v1',
        '2025.1',
        { detectedOn: 'https://edistrict.up.gov.in/portal/revised_forms.pdf' }
      );

      expect(driftResult.detected).toBe(true);
      expect(driftResult.formStatus).toBe(FORM_STATUS.OUTDATED_UNDER_REVIEW);
      expect(driftResult.reviewQueueId).toBeTruthy();

      // Check form status updated in catalogue
      const form = getFormById('up_income_certificate_v1');
      expect(form.status).toBe(FORM_STATUS.OUTDATED_UNDER_REVIEW);

      // Verify item added to human review queue
      const queue = getPendingReviewQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].formId).toBe('up_income_certificate_v1');
      expect(queue[0].detectedVersion).toBe('2025.1');
      expect(queue[0].status).toBe('PENDING_HUMAN_REVIEW');

      // Verify getFieldExplanation now indicates guidance is outdated
      const explanation = getFieldExplanation(
        'up_income_certificate_v1',
        'total_annual_family_income',
        'en'
      );
      expect(explanation.isGuidanceOutdated).toBe(true);
      expect(explanation.outdatedNotice).toContain('pending department review');
    });

    it('allows human reviewer to approve revised version and restore ACTIVE status', () => {
      // Trigger drift first
      detectFormVersionChange('up_income_certificate_v1', '2025.1');

      // Reviewer reviews and approves
      const approveResult = approveRevisedFormVersion(
        'up_income_certificate_v1',
        '2025.1',
        null,
        'lead_reviewer_up'
      );

      expect(approveResult.success).toBe(true);
      const form = getFormById('up_income_certificate_v1');
      expect(form.status).toBe(FORM_STATUS.ACTIVE);
      expect(form.version).toBe('2025.1');

      // Explanation is no longer outdated
      const explanation = getFieldExplanation(
        'up_income_certificate_v1',
        'total_annual_family_income',
        'en'
      );
      expect(explanation.isGuidanceOutdated).toBe(false);
      expect(explanation.formVersion).toBe('2025.1');
    });
  });
});
