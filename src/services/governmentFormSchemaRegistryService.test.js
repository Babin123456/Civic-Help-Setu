import { describe, it, expect, beforeEach } from 'vitest';
import { GovernmentFormSchemaRegistryService } from './governmentFormSchemaRegistryService.js';

describe('GovernmentFormSchemaRegistryService (#1450)', () => {
  let registry;

  beforeEach(() => {
    registry = new GovernmentFormSchemaRegistryService();
  });

  it('registers form schemas with official source references and validates submissions', () => {
    registry.registerSchema({
      formId: 'UP_RATION_CARD_V1',
      version: 1,
      jurisdiction: 'UP',
      officialSourceReference: 'UP Food & Civil Supplies Circular 2026-B',
      fields: [
        { name: 'applicantName', label: 'Applicant Name', type: 'string', required: true },
        { name: 'familyIncomeAnnual', label: 'Annual Income', type: 'number', required: true }
      ]
    });

    const validSubmission = {
      applicantName: 'Suman Devi',
      familyIncomeAnnual: 48000
    };

    const result = registry.validateSubmission('UP_RATION_CARD_V1', validSubmission);
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('prohibits raw Aadhaar or biometric fields under privacy-by-design policy', () => {
    registry.registerSchema({
      formId: 'INCOME_CERT',
      version: 1,
      officialSourceReference: 'Revenue Department Notification 14',
      fields: [
        { name: 'aadhaarNumber', label: 'Aadhaar', type: 'string', required: true }
      ]
    });

    const result = registry.validateSubmission('INCOME_CERT', { aadhaarNumber: '123456789012' });
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('violates privacy-by-design policy');
  });

  it('supports rollback to previous approved version', () => {
    registry.registerSchema({
      formId: 'BIRTH_CERT',
      version: 1,
      officialSourceReference: 'Births & Deaths Act Circular A',
      fields: [{ name: 'childName', required: true }]
    });

    registry.registerSchema({
      formId: 'BIRTH_CERT',
      version: 2,
      officialSourceReference: 'Births & Deaths Act Circular B',
      fields: [{ name: 'childName', required: true }, { name: 'hospitalCode', required: true }]
    });

    const rollback = registry.rollbackToVersion('BIRTH_CERT', 1);
    expect(rollback.activeVersion).toBe(1);
  });
});
