import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateChecklistEmailContent,
  sendServiceChecklistEmail,
  checkRateLimit,
  getChecklistEmailLogs,
  clearChecklistEmailLogs
} from './checklistEmailService';

describe('checklistEmailService (#461)', () => {
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
    vi.stubGlobal('window', {
      location: { origin: 'https://civichelpsetu.gov.in' }
    });
    clearChecklistEmailLogs();
  });

  const mockService = {
    id: 'srv-ration-01',
    title: 'New Ration Card Application',
    category: 'Food & Civil Supplies',
    department: 'Department of Food, Civil Supplies & Consumer Affairs',
    fees: 'Rs. 50 (Nominal stamp duty)',
    turnaroundTime: '30 working days',
    prerequisites: ['Resident of State for at least 3 years', 'Family income below cap'],
    documents: [
      { name: 'Aadhaar Card of all family members', copies: 1, optional: false },
      { name: 'Proof of Residence (Electricity bill or Rent agreement)', copies: 1, optional: false },
      { name: 'Income Certificate from Tahsildar', copies: 1, optional: false },
      { name: 'LPG Connection Gas Book', copies: 1, optional: true }
    ]
  };

  it('generates structured email content with documents, prerequisites, and plain text fallback', () => {
    const content = generateChecklistEmailContent({
      service: mockService,
      senderName: 'Rajesh Sharma',
      isHelper: false,
      personalNote: 'Need this for the upcoming inspection'
    });

    expect(content.subject).toContain('[Your Checklist]');
    expect(content.subject).toContain('New Ration Card Application');
    expect(content.plainTextBody).toContain('Aadhaar Card of all family members');
    expect(content.plainTextBody).toContain('Need this for the upcoming inspection');
    expect(content.htmlBody).toContain('Department of Food, Civil Supplies & Consumer Affairs');
    expect(content.htmlBody).toContain('Rs. 50');
  });

  it('customizes subject line when sending to a helper', () => {
    const content = generateChecklistEmailContent({
      service: mockService,
      senderName: 'Priya Verma',
      isHelper: true
    });

    expect(content.subject).toContain('Priya Verma shared requirements for "New Ration Card Application"');
  });

  it('requires explicit consent confirmation when sending to a third-party helper', async () => {
    const res = await sendServiceChecklistEmail({
      service: mockService,
      recipientEmail: 'helper@example.com',
      senderName: 'Priya Verma',
      isHelper: true,
      helperConsentConfirmed: false
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('explicitly confirm consent');
  });

  it('successfully dispatches email when consent is provided', async () => {
    const res = await sendServiceChecklistEmail({
      service: mockService,
      recipientEmail: 'helper@example.com',
      senderName: 'Priya Verma',
      isHelper: true,
      helperConsentConfirmed: true
    });

    expect(res.success).toBe(true);
    expect(res.record.recipientEmail).toBe('helper@example.com');

    const logs = getChecklistEmailLogs();
    expect(logs).toHaveLength(1);
  });

  it('enforces rate limits per recipient email', async () => {
    const email = 'spamtest@example.com';

    for (let i = 0; i < 3; i++) {
      const sendRes = await sendServiceChecklistEmail({
        service: mockService,
        recipientEmail: email,
        isHelper: false
      });
      expect(sendRes.success).toBe(true);
    }

    // 4th send within the minute should fail
    const blockedRes = await sendServiceChecklistEmail({
      service: mockService,
      recipientEmail: email,
      isHelper: false
    });

    expect(blockedRes.success).toBe(false);
    expect(blockedRes.error).toContain('Rate limit exceeded');
  });
});
