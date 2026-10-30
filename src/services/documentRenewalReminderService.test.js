import { describe, it, expect } from 'vitest';
import {
  getFiscalYearEnd,
  evaluateDocumentRenewalNeeds,
} from './documentRenewalReminderService';

describe('documentRenewalReminderService', () => {
  it('correctly calculates the Indian financial year end (March 31)', () => {
    // In June 2026, financial year ends March 31, 2027
    const juneDate = new Date('2026-06-15');
    const fyEndJune = getFiscalYearEnd(juneDate);
    expect(fyEndJune.getFullYear()).toBe(2027);
    expect(fyEndJune.getMonth()).toBe(2); // March

    // In February 2027, financial year ends March 31, 2027
    const febDate = new Date('2027-02-10');
    const fyEndFeb = getFiscalYearEnd(febDate);
    expect(fyEndFeb.getFullYear()).toBe(2027);
    expect(fyEndFeb.getMonth()).toBe(2);
  });

  it('detects financial year expiration for income certificate issued in prior fiscal year', () => {
    const docs = [
      {
        id: 'inc-1',
        type: 'Income Certificate',
        number: 'XXXX 4512',
        issueDate: '2025-05-10', // Issued in FY 2025-26 (ended March 31, 2026)
      },
    ];
    // Evaluate in October 2026
    const now = new Date('2026-10-15');
    const reminders = evaluateDocumentRenewalNeeds(docs, now);
    expect(reminders.length).toBe(1);
    expect(reminders[0].renewalUrgency).toBe('EXPIRED');
    expect(reminders[0].headline).toContain('Financial Year Validity Lapsed');
  });

  it('warns when income certificate fiscal year end is approaching within 45 days', () => {
    const docs = [
      {
        id: 'inc-2',
        type: 'Income Certificate',
        number: 'XXXX 9912',
        issueDate: '2026-07-01', // FY 2026-27 (ends March 31, 2027)
      },
    ];
    // Evaluate on Feb 25, 2027 (approx 34 days to March 31, 2027)
    const now = new Date('2027-02-25');
    const reminders = evaluateDocumentRenewalNeeds(docs, now);
    expect(reminders.length).toBe(1);
    expect(reminders[0].renewalUrgency).toBe('UPCOMING');
    expect(reminders[0].headline).toContain('Fiscal Year Renewal');
  });

  it('identifies 30-day grace period for recently expired driving license', () => {
    const docs = [
      {
        id: 'dl-1',
        type: 'Driving License',
        number: 'XXXX 8821',
        expiryDate: '2026-10-10',
      },
    ];
    // Evaluate on October 20, 2026 (10 days expired, inside 30-day grace)
    const now = new Date('2026-10-20');
    const reminders = evaluateDocumentRenewalNeeds(docs, now);
    expect(reminders.length).toBe(1);
    expect(reminders[0].renewalUrgency).toBe('URGENT');
    expect(reminders[0].headline).toContain('30-Day Grace Period');
  });

  it('detects passport with under 6 months remaining validity', () => {
    const docs = [
      {
        id: 'pass-1',
        type: 'Passport',
        number: 'XXXX 1122',
        expiryDate: '2026-12-01',
      },
    ];
    // Evaluate in October 2026 (under 60 days left)
    const now = new Date('2026-10-15');
    const reminders = evaluateDocumentRenewalNeeds(docs, now);
    expect(reminders.length).toBe(1);
    expect(reminders[0].headline).toContain('Below 6-Month Validity');
  });
});
