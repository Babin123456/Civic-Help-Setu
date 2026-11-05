import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  sendTransactionalEmail,
  renderEmailTemplate,
  getEmailDeliveryLogs,
  EMAIL_TYPES,
  DELIVERY_STATUS,
} from './transactionalEmailDeliveryService';

describe('transactionalEmailDeliveryService (#462)', () => {
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
  });

  it('renders application receipt email with responsive HTML and plain text fallback', () => {
    const { subject, html, plainText } = renderEmailTemplate(EMAIL_TYPES.APPLICATION_RECEIPT, {
      serviceName: 'Aadhaar Address Update',
      referenceId: 'AADHAAR-9988',
      trackingUrl: 'https://civichelpsetu.gov.in/track?ref=AADHAAR-9988',
    });

    expect(subject).toContain('Submission Receipt: Aadhaar Address Update');
    expect(html).toContain('Application Submission Received');
    expect(html).toContain('AADHAAR-9988');
    expect(html).toContain('<!doctype html>');
    expect(plainText).toContain('AADHAAR-9988');
  });

  it('renders deadline reminder template with action callout', () => {
    const { subject, html } = renderEmailTemplate(EMAIL_TYPES.DEADLINE_REMINDER, {
      serviceName: 'Scholarship Biometric Verification',
      actionRequired: 'Visit District Welfare Office for Biometrics',
      dueDate: '15 Nov 2026',
    });

    expect(subject).toContain('Urgent Reminder');
    expect(html).toContain('Visit District Welfare Office for Biometrics');
    expect(html).toContain('15 Nov 2026');
  });

  it('simulates dispatch in test/sandbox mode without crashing and records masked log', async () => {
    const res = await sendTransactionalEmail({
      to: 'citizen.test@example.com',
      type: EMAIL_TYPES.APPLICATION_RECEIPT,
      payload: {
        serviceName: 'Birth Certificate',
        referenceId: 'BC-1234',
      },
    });

    expect(res.success).toBe(true);
    expect(res.isSandbox).toBe(true);
    expect(res.status).toBe(DELIVERY_STATUS.SIMULATED);

    const logs = getEmailDeliveryLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe(EMAIL_TYPES.APPLICATION_RECEIPT);
    // Recipient email is masked for privacy
    expect(logs[0].to).toContain('ci***@example.com');
  });

  it('safely rejects delivery when recipient email is invalid', async () => {
    const res = await sendTransactionalEmail({
      to: 'invalid-email-address',
      type: EMAIL_TYPES.APPLICATION_RECEIPT,
    });

    expect(res.success).toBe(false);
    expect(res.status).toBe(DELIVERY_STATUS.FAILED);
    expect(res.error).toContain('Invalid recipient');
  });

  it('prevents duplicate sends using idempotencyKey', async () => {
    const key = 'idempotent-key-123';
    // Artificially store an existing DELIVERED entry
    const existing = [
      {
        id: 'del-1',
        idempotencyKey: key,
        status: DELIVERY_STATUS.DELIVERED,
        messageId: 'msg-delivered-already',
      },
    ];
    localStorage.setItem('civicbridge_transactional_delivery_logs', JSON.stringify(existing));

    const res = await sendTransactionalEmail({
      to: 'citizen@example.com',
      type: EMAIL_TYPES.APPLICATION_RECEIPT,
      idempotencyKey: key,
    });

    expect(res.success).toBe(true);
    expect(res.duplicateSkipped).toBe(true);
  });
});
