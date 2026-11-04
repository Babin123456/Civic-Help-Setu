import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LIFECYCLE_EVENT_TYPES,
  saveNotificationPreferences,
  sanitizeApplicationForNotification,
  generateLifecycleEmailContent,
  sendApplicationLifecycleNotification,
  getLifecycleEmailLogs,
  clearLifecycleEmailLogs
} from './applicationLifecycleEmailService';

describe('applicationLifecycleEmailService', () => {
  beforeEach(() => {
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k) => store[k] || null),
      setItem: vi.fn((k, v) => {
        store[k] = String(v);
      }),
      removeItem: vi.fn((k) => {
        delete store[k];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach((k) => delete store[k]);
      }),
    });
    vi.stubGlobal('window', {
      location: { origin: 'https://civichelpsetu.gov.in' }
    });
    clearLifecycleEmailLogs();
  });

  const mockApp = {
    id: 'APP-10293',
    serviceTitle: 'Senior Citizen Health Card',
    category: 'Healthcare',
    status: 'In Review',
    submittedAt: '2026-11-01T10:00:00Z',
    applicantEmail: 'citizen@example.gov.in',
    assignedOfficer: {
      name: 'Dr. Sarah Connor',
      department: 'Directorate of Health'
    },
    correctionNotes: 'Please upload a clearer copy of birth certificate'
  };

  it('sanitizes application object and excludes arbitrary private fields', () => {
    const raw = {
      ...mockApp,
      bankAccountSecret: '123456789',
      internalStaffMemo: 'Double check fraud flags'
    };
    const sanitized = sanitizeApplicationForNotification(raw);

    expect(sanitized.applicationId).toBe('APP-10293');
    expect(sanitized.serviceTitle).toBe('Senior Citizen Health Card');
    expect(sanitized.bankAccountSecret).toBeUndefined();
    expect(sanitized.internalStaffMemo).toBeUndefined();
  });

  it('generates distinct email contents for different lifecycle events', () => {
    const sanitized = sanitizeApplicationForNotification(mockApp);

    const submissionEmail = generateLifecycleEmailContent(LIFECYCLE_EVENT_TYPES.SUBMITTED, sanitized);
    expect(submissionEmail.subject).toContain('[Received]');
    expect(submissionEmail.plainTextBody).toContain('Senior Citizen Health Card');

    const correctionEmail = generateLifecycleEmailContent(LIFECYCLE_EVENT_TYPES.CORRECTION_REQUIRED, sanitized);
    expect(correctionEmail.subject).toContain('[Action Required]');
    expect(correctionEmail.plainTextBody).toContain('clearer copy of birth certificate');

    const completedEmail = generateLifecycleEmailContent(LIFECYCLE_EVENT_TYPES.COMPLETED, sanitized);
    expect(completedEmail.subject).toContain('[Completed]');
  });

  it('dispatches lifecycle notification and logs it in storage', async () => {
    const result = await sendApplicationLifecycleNotification({
      application: mockApp,
      eventType: LIFECYCLE_EVENT_TYPES.SUBMITTED,
      recipientEmail: 'citizen@example.gov.in'
    });

    expect(result.success).toBe(true);
    expect(result.dispatchRecord.eventType).toBe(LIFECYCLE_EVENT_TYPES.SUBMITTED);

    const logs = getLifecycleEmailLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].applicationId).toBe('APP-10293');
  });

  it('skips duplicate dispatch for identical idempotency key unless forced', async () => {
    await sendApplicationLifecycleNotification({
      application: mockApp,
      eventType: LIFECYCLE_EVENT_TYPES.SUBMITTED,
      recipientEmail: 'citizen@example.gov.in'
    });

    const secondTry = await sendApplicationLifecycleNotification({
      application: mockApp,
      eventType: LIFECYCLE_EVENT_TYPES.SUBMITTED,
      recipientEmail: 'citizen@example.gov.in'
    });

    expect(secondTry.success).toBe(false);
    expect(secondTry.skipped).toBe(true);
    expect(secondTry.reason).toContain('already dispatched');

    // Force send should bypass deduplication
    const forced = await sendApplicationLifecycleNotification({
      application: mockApp,
      eventType: LIFECYCLE_EVENT_TYPES.SUBMITTED,
      recipientEmail: 'citizen@example.gov.in',
      force: true
    });
    expect(forced.success).toBe(true);
  });

  it('respects notification preferences when disabled', async () => {
    saveNotificationPreferences({
      emailNotificationsEnabled: true,
      notifyOnCorrections: false
    });

    const result = await sendApplicationLifecycleNotification({
      application: mockApp,
      eventType: LIFECYCLE_EVENT_TYPES.CORRECTION_REQUIRED,
      recipientEmail: 'citizen@example.gov.in'
    });

    expect(result.success).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain('disabled in user preferences');
  });
});
