import { describe, it, expect, beforeEach } from 'vitest';
import {
  VALIDITY_STATUS,
  VALIDITY_TYPE,
  documentValidityStore,
  evaluateDocumentValidity,
  exportValidityCalendarSummary,
} from './civicDocumentValidityCalendarService.js';

describe('civicDocumentValidityCalendarService', () => {
  const citizenId = 'usr_citizen_444';

  beforeEach(() => {
    documentValidityStore.reset();
  });

  it('evaluates non-expiring lifetime documents correctly with official source citation', () => {
    const result = evaluateDocumentValidity({
      category: 'COMMUNITY_CERTIFICATE',
      stateKey: 'TAMIL_NADU',
    });

    expect(result.validityType).toBe(VALIDITY_TYPE.NON_EXPIRING);
    expect(result.status).toBe(VALIDITY_STATUS.PERMANENT_VALID);
    expect(result.expiryDate).toBeNull();
    expect(result.officialSource).toContain('Adi Dravidar and Tribal Welfare Dept');
  });

  it('differentiates state-dependent validity without generalizing nationally', () => {
    // Tamil Nadu Income Certificate = 12 months
    const tnResult = evaluateDocumentValidity({
      category: 'INCOME_CERTIFICATE',
      stateKey: 'TAMIL_NADU',
      issueDate: '2026-01-01',
    });
    expect(tnResult.expiryDate).toBe('2027-01-01');

    // Maharashtra Income Certificate = 36 months (3 years)
    const mhResult = evaluateDocumentValidity({
      category: 'INCOME_CERTIFICATE',
      stateKey: 'MAHARASHTRA',
      issueDate: '2026-01-01',
    });
    expect(mhResult.expiryDate).toBe('2029-01-01');
  });

  it('detects expired documents and expiring-soon alerts accurately', () => {
    // Expired document
    const expiredResult = evaluateDocumentValidity({
      expiryDate: '2025-01-01',
    });
    expect(expiredResult.status).toBe(VALIDITY_STATUS.EXPIRED);
    expect(expiredResult.daysRemaining).toBeLessThan(0);

    // Expiring soon (10 days from now)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const expiringSoon = evaluateDocumentValidity({
      expiryDate: futureDate.toISOString().slice(0, 10),
    });
    expect(expiringSoon.status).toBe(VALIDITY_STATUS.EXPIRING_SOON);
    expect(expiringSoon.daysRemaining).toBeGreaterThan(0);
    expect(expiringSoon.daysRemaining).toBeLessThanOrEqual(45);
  });

  it('allows citizens to configure, disable, and delete validity reminders', () => {
    const record = documentValidityStore.create(
      {
        documentTitle: 'Passport Renewal Reminder',
        category: 'PASSPORT_ADULT',
        stateKey: 'CENTRAL',
        expiryDate: '2026-12-31',
        remindersEnabled: true,
        reminderPreferences: {
          optInInApp: true,
          optInEmail: true,
          advanceDays: [60, 30],
        },
      },
      citizenId
    );

    expect(record.id).toBeDefined();
    expect(record.remindersEnabled).toBe(true);

    // Disable reminder
    const disabled = documentValidityStore.disableReminder(record.id, citizenId);
    expect(disabled.remindersEnabled).toBe(false);

    // Delete record
    const deleted = documentValidityStore.delete(record.id, citizenId);
    expect(deleted).toBe(true);
    expect(documentValidityStore.get(record.id, citizenId)).toBeNull();
  });

  it('exports calendar summary strictly omitting document file contents and scans', () => {
    const rec1 = documentValidityStore.create(
      {
        documentTitle: 'Vehicle PUC',
        expiryDate: '2026-06-30',
      },
      citizenId
    );

    const exportData = exportValidityCalendarSummary([rec1]);
    expect(exportData.totalTrackedDocuments).toBe(1);
    expect(exportData.schedule[0].documentTitle).toBe('Vehicle PUC');
    expect(exportData.schedule[0].expiryDate).toBe('2026-06-30');

    // Confirm no file payload exists
    const stringified = JSON.stringify(exportData);
    expect(stringified).not.toContain('fileContent');
    expect(stringified).not.toContain('blob');
    expect(stringified).not.toContain('base64');
  });
});
