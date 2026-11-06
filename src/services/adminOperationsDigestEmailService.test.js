import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getDigestConfig,
  saveDigestConfig,
  aggregateOperationsData,
  generateDigestEmailContent,
  sendAdminOperationsDigest,
  getDigestLogs,
  clearDigestLogs
} from './adminOperationsDigestEmailService';

describe('adminOperationsDigestEmailService (#464)', () => {
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
    clearDigestLogs();
  });

  it('retrieves default digest configuration and allows updates', () => {
    const config = getDigestConfig();
    expect(config.enabled).toBe(true);
    expect(config.deliveryHour).toBe(8);

    saveDigestConfig({ deliveryHour: 9, adminEmails: ['lead@civic.gov.in'] });
    const updated = getDigestConfig();
    expect(updated.deliveryHour).toBe(9);
    expect(updated.adminEmails).toContain('lead@civic.gov.in');
  });

  it('aggregates operational queue data and formats readable subject and HTML body', () => {
    const opsData = aggregateOperationsData({
      pendingApplicationsCount: 25,
      slaBreachedApplicationsCount: 4
    });

    const email = generateDigestEmailContent(opsData);
    expect(email.subject).toContain('4 SLA Alerts');
    expect(email.plainTextBody).toContain('Pending Applications: 25');
    expect(email.htmlBody).toContain('Urgent Operational Alerts');
    expect(email.htmlBody).toContain('Income & Asset Certificate');
  });

  it('dispatches digest email and logs transmission', async () => {
    const res = await sendAdminOperationsDigest({
      targetEmail: 'admin.duty@civic.gov.in'
    });

    expect(res.success).toBe(true);
    expect(res.dispatchRecord.recipients).toContain('admin.duty@civic.gov.in');

    const logs = getDigestLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].idempotencyKey).toBe(`digest_${res.dispatchRecord.digestDate}`);
  });

  it('skips duplicate sends for the same date unless forced', async () => {
    await sendAdminOperationsDigest({ targetEmail: 'admin@civic.gov.in' });

    const duplicateRes = await sendAdminOperationsDigest({ targetEmail: 'admin@civic.gov.in' });
    expect(duplicateRes.success).toBe(false);
    expect(duplicateRes.skipped).toBe(true);
    expect(duplicateRes.reason).toContain('already been dispatched');

    const forcedRes = await sendAdminOperationsDigest({
      targetEmail: 'admin@civic.gov.in',
      force: true
    });
    expect(forcedRes.success).toBe(true);
  });
});
