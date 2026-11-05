import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  REMINDER_CADENCE,
  saveDeadlineReminderConfig,
  getDeadlineReminderConfigs,
  cancelDeadlineReminder,
  calculateDaysRemaining,
  evaluateReminderEligibility,
  generateDeadlineReminderEmail,
  sendDeadlineReminder,
  getDeadlineReminderLogs
} from './deadlineReminderEmailService';

describe('deadlineReminderEmailService (#460)', () => {
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
      })
    });
  });

  const sampleConfig = {
    applicationId: 'APP-DEADLINE-101',
    serviceTitle: 'OBC Certificate Renewal',
    recipientEmail: 'applicant@example.com',
    deadlineDate: '2026-12-01',
    cadenceDays: [7, 3, 1],
    actionRequired: 'Submit revenue verification documents at Tahsil office',
    active: true,
    currentStatus: 'Pending Verification'
  };

  it('saves and retrieves deadline reminder configurations', () => {
    const res = saveDeadlineReminderConfig(sampleConfig);
    expect(res.success).toBe(true);

    const configs = getDeadlineReminderConfigs();
    expect(configs).toHaveLength(1);
    expect(configs[0].applicationId).toBe('APP-DEADLINE-101');
  });

  it('cancels reminder for an application', () => {
    saveDeadlineReminderConfig(sampleConfig);
    const cancelRes = cancelDeadlineReminder('APP-DEADLINE-101');
    expect(cancelRes.success).toBe(true);

    const configs = getDeadlineReminderConfigs();
    expect(configs).toHaveLength(0);
  });

  it('evaluates reminder eligibility based on cadence and terminal status', () => {
    // Eligible when matching 3 days cadence
    const eligibleRes = evaluateReminderEligibility(sampleConfig, 'Under Review', 3);
    expect(eligibleRes.eligible).toBe(true);
    expect(eligibleRes.matchedCadence).toBe(3);

    // Ineligible when days do not match cadence
    const ineligibleRes = evaluateReminderEligibility(sampleConfig, 'Under Review', 5);
    expect(ineligibleRes.eligible).toBe(false);
    expect(ineligibleRes.reason).toContain('No cadence scheduled');

    // Automatically stops if application is completed
    const completedRes = evaluateReminderEligibility(sampleConfig, 'COMPLETED', 3);
    expect(completedRes.eligible).toBe(false);
    expect(completedRes.reason).toContain('terminal status');
  });

  it('generates email body with urgent callouts and plain-text alternatives', () => {
    const email = generateDeadlineReminderEmail({
      applicationId: 'APP-DEADLINE-101',
      serviceTitle: 'OBC Certificate Renewal',
      deadlineDate: '2026-12-01',
      daysRemaining: 1,
      actionRequired: 'Submit revenue verification'
    });

    expect(email.subject).toContain('TOMORROW');
    expect(email.subject).toContain('OBC Certificate Renewal');
    expect(email.plainTextBody).toContain('TOMORROW');
    expect(email.plainTextBody).toContain('Submit revenue verification');
    expect(email.htmlBody).toContain('Action Window Closes TOMORROW');
  });

  it('sends reminder, writes logs, and avoids duplicates on rerun', async () => {
    const sendRes = await sendDeadlineReminder({
      config: sampleConfig,
      recipientEmail: 'applicant@example.com',
      daysRemainingOverride: 7
    });

    expect(sendRes.success).toBe(true);
    const logs = getDeadlineReminderLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].applicationId).toBe('APP-DEADLINE-101');

    // Attempting same send without force should be skipped
    const dupRes = await sendDeadlineReminder({
      config: sampleConfig,
      recipientEmail: 'applicant@example.com',
      daysRemainingOverride: 7
    });

    expect(dupRes.success).toBe(false);
    expect(dupRes.skipped).toBe(true);
    expect(dupRes.reason).toContain('already dispatched');
  });
});
