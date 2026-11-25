import { describe, it, expect, beforeEach } from 'vitest';
import { TradeLicenceChecklistService } from './tradeLicenceChecklistService.js';

describe('TradeLicenceChecklistService', () => {
  let service;

  beforeEach(() => {
    service = new TradeLicenceChecklistService();
  });

  it('retrieves municipal trade licence guidelines and fee slabs for BBMP Bengaluru', () => {
    const guide = service.getMunicipalTradeLicenceGuide('IN-KA-BLR');
    expect(guide.isLocalRuleFound).toBe(true);
    expect(guide.city).toBe('Bengaluru');
    expect(guide.authority).toContain('BBMP');
    expect(guide.renewalDeadline).toContain('February 28');
    expect(guide.feeSlabs.length).toBeGreaterThanOrEqual(2);
    expect(guide.disclaimer).toContain('A Municipal Trade Licence does NOT substitute for FSSAI');
  });

  it('clearly explains distinct business registrations (Trade vs Shops Act vs FSSAI vs GST)', () => {
    const matrix = service.getDistinctRegistrationMatrix();
    expect(matrix.length).toBe(4);
    const fssai = matrix.find(m => m.registrationName.includes('FSSAI'));
    expect(fssai).toBeDefined();
    expect(fssai.statutoryAct).toContain('Food Safety and Standards Act');
  });

  it('generates an editable renewal reminder checklist with receipt verification advice', () => {
    const checklist = service.generateRenewalReminderChecklist('IN-DL-MCD', 'Sharma Sweets');
    expect(checklist.businessName).toBe('Sharma Sweets');
    expect(checklist.title).toContain('Delhi');
    expect(checklist.documentSteps.length).toBeGreaterThanOrEqual(3);
    expect(checklist.receiptVerificationInstructions.length).toBe(3);
    expect(checklist.legalComplianceWarning).toContain('sealing notices');
  });
});
