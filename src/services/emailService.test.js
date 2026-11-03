import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  sendEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendServiceUpdateEmail,
  sendDeadlineReminderEmail,
  sendProductAnnouncementEmail,
  sendAccountSecurityAlert,
  sendPasswordChangedEmail,
  sendEmailChangedEmail,
  sendLoginAlertEmail,
  canSendEmail,
  EMAIL_TEMPLATES,
  getCategoryForTemplate,
} from '../services/emailService.js';

const TEST_USER_ID = 'user_test_123';
const TEST_EMAIL = 'test@example.com';

const mockStorage = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key) => mockStorage[key] || null),
  setItem: vi.fn((key, value) => { mockStorage[key] = value; }),
  removeItem: vi.fn((key) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
});

let mockFetch;

const setupVerifiedEmail = (email = TEST_EMAIL) => {
  localStorage.setItem('civicbridge_verified_emails', JSON.stringify([email.toLowerCase()]));
};

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);
  setupVerifiedEmail();
});

describe('emailService', () => {
  describe('getCategoryForTemplate', () => {
    it('maps templates to correct categories', () => {
      expect(getCategoryForTemplate(EMAIL_TEMPLATES.VERIFICATION)).toBe('verification_emails');
      expect(getCategoryForTemplate(EMAIL_TEMPLATES.SERVICE_UPDATE)).toBe('service_updates');
      expect(getCategoryForTemplate(EMAIL_TEMPLATES.DEADLINE_REMINDER)).toBe('deadline_reminders');
      expect(getCategoryForTemplate(EMAIL_TEMPLATES.PRODUCT_ANNOUNCEMENT)).toBe('product_announcements');
      expect(getCategoryForTemplate(EMAIL_TEMPLATES.ACCOUNT_SECURITY_ALERT)).toBe('account_security');
      expect(getCategoryForTemplate(EMAIL_TEMPLATES.PASSWORD_CHANGED)).toBe('account_security');
      expect(getCategoryForTemplate(EMAIL_TEMPLATES.EMAIL_CHANGED)).toBe('account_security');
      expect(getCategoryForTemplate(EMAIL_TEMPLATES.LOGIN_ALERT)).toBe('account_security');
    });

    it('defaults to account_security for unknown template', () => {
      expect(getCategoryForTemplate('unknown_template')).toBe('account_security');
    });
  });

  describe('sendEmail', () => {
    it('sends email when preferences allow', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: 'msg_123' }),
      });

      const result = await sendEmail({
        to: TEST_EMAIL,
        template: EMAIL_TEMPLATES.SERVICE_UPDATE,
        data: { serviceName: 'Test Service' },
        userId: TEST_USER_ID,
      });

      expect(result.sent).toBe(true);
      expect(result.messageId).toBe('msg_123');
      expect(mockFetch).toHaveBeenCalledWith('/api/send-email', expect.any(Object));
    });

    it('blocks email when preferences disable category', async () => {
      // Disable service_updates for this user
      localStorage.setItem(`civicbridge_notification_preferences_${TEST_USER_ID}`, JSON.stringify({
        service_updates: false,
        deadline_reminders: true,
        product_announcements: false,
        account_security: true,
        verification_emails: true,
      }));

      const result = await sendEmail({
        to: TEST_EMAIL,
        template: EMAIL_TEMPLATES.SERVICE_UPDATE,
        data: {},
        userId: TEST_USER_ID,
      });

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('blocked_by_preferences');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('allows essential emails regardless of preferences', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: 'msg_123' }),
      });

      // Disable all optional, but essential should still work
      localStorage.setItem(`civicbridge_notification_preferences_${TEST_USER_ID}`, JSON.stringify({
        service_updates: false,
        deadline_reminders: false,
        product_announcements: false,
        account_security: true,
        verification_emails: true,
      }));

      const result = await sendEmail({
        to: TEST_EMAIL,
        template: EMAIL_TEMPLATES.ACCOUNT_SECURITY_ALERT,
        data: {},
        userId: TEST_USER_ID,
      });

      expect(result.sent).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('blocks email for unverified address (non-verification templates)', async () => {
      // Explicitly remove verified emails for this test
      localStorage.setItem('civicbridge_verified_emails', JSON.stringify([]));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: 'msg_123' }),
      });

      const result = await sendEmail({
        to: TEST_EMAIL,
        template: EMAIL_TEMPLATES.SERVICE_UPDATE,
        data: {},
        userId: TEST_USER_ID,
      });

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('email_not_verified');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('allows verification email for unverified address', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: 'msg_123' }),
      });

      const result = await sendEmail({
        to: TEST_EMAIL,
        template: EMAIL_TEMPLATES.VERIFICATION,
        data: { verificationUrl: 'http://test.com' },
        userId: TEST_USER_ID,
      });

      expect(result.sent).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await sendEmail({
        to: TEST_EMAIL,
        template: EMAIL_TEMPLATES.SERVICE_UPDATE,
        data: {},
        userId: TEST_USER_ID,
      });

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('network_error');
    });

    it('handles API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Rate limited' }),
      });

      const result = await sendEmail({
        to: TEST_EMAIL,
        template: EMAIL_TEMPLATES.SERVICE_UPDATE,
        data: {},
        userId: TEST_USER_ID,
      });

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('send_failed');
    });

    it('uses forceEssential to bypass preferences', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: 'msg_123' }),
      });

      localStorage.setItem(`civicbridge_notification_preferences_${TEST_USER_ID}`, JSON.stringify({
        service_updates: false,
        deadline_reminders: false,
        product_announcements: false,
        account_security: true,
        verification_emails: true,
      }));

      const result = await sendEmail({
        to: TEST_EMAIL,
        template: EMAIL_TEMPLATES.SERVICE_UPDATE,
        data: {},
        userId: TEST_USER_ID,
        forceEssential: true,
      });

      expect(result.sent).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('convenience functions', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: 'msg_123' }),
      });
      // Mark email as verified for these tests
      localStorage.setItem('civicbridge_verified_emails', JSON.stringify([TEST_EMAIL, 'old@example.com', 'new@example.com']));
      // Mock window.location.origin
      vi.stubGlobal('window', { location: { origin: 'http://localhost:3000' } });
    });

    it('sendVerificationEmail calls sendEmail with correct params', async () => {
      await sendVerificationEmail(TEST_EMAIL, 'token_123', TEST_USER_ID);
      expect(mockFetch).toHaveBeenCalledWith('/api/send-email', expect.objectContaining({
        body: expect.stringContaining('verification'),
      }));
    });

    it('sendWelcomeEmail calls sendEmail with correct params', async () => {
      await sendWelcomeEmail(TEST_EMAIL, 'John Doe', TEST_USER_ID);
      expect(mockFetch).toHaveBeenCalledWith('/api/send-email', expect.objectContaining({
        body: expect.stringContaining('welcome'),
      }));
    });

    it('sendServiceUpdateEmail calls sendEmail with correct params', async () => {
      await sendServiceUpdateEmail(TEST_EMAIL, { serviceName: 'Test' }, TEST_USER_ID);
      expect(mockFetch).toHaveBeenCalledWith('/api/send-email', expect.objectContaining({
        body: expect.stringContaining('service_update'),
      }));
    });

    it('sendDeadlineReminderEmail calls sendEmail with correct params', async () => {
      await sendDeadlineReminderEmail(TEST_EMAIL, { deadline: '2024-12-31' }, TEST_USER_ID);
      expect(mockFetch).toHaveBeenCalledWith('/api/send-email', expect.objectContaining({
        body: expect.stringContaining('deadline_reminder'),
      }));
    });

    it('sendProductAnnouncementEmail calls sendEmail with correct params', async () => {
      // Enable product_announcements for this test
      localStorage.setItem(`civicbridge_notification_preferences_${TEST_USER_ID}`, JSON.stringify({
        service_updates: true,
        deadline_reminders: true,
        product_announcements: true,
        account_security: true,
        verification_emails: true,
      }));
      await sendProductAnnouncementEmail(TEST_EMAIL, { title: 'New Feature' }, TEST_USER_ID);
      expect(mockFetch).toHaveBeenCalledWith('/api/send-email', expect.objectContaining({
        body: expect.stringContaining('product_announcement'),
      }));
    });

    it('sendAccountSecurityAlert calls sendEmail with forceEssential', async () => {
      await sendAccountSecurityAlert(TEST_EMAIL, { alert: 'Suspicious login' }, TEST_USER_ID);
      expect(mockFetch).toHaveBeenCalledWith('/api/send-email', expect.objectContaining({
        body: expect.stringContaining('account_security_alert'),
      }));
    });

    it('sendPasswordChangedEmail calls sendEmail with forceEssential', async () => {
      await sendPasswordChangedEmail(TEST_EMAIL, TEST_USER_ID);
      expect(mockFetch).toHaveBeenCalledWith('/api/send-email', expect.objectContaining({
        body: expect.stringContaining('password_changed'),
      }));
    });

    it('sendEmailChangedEmail sends to both old and new email', async () => {
      await sendEmailChangedEmail('old@example.com', 'new@example.com', TEST_USER_ID);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('sendLoginAlertEmail calls sendEmail with forceEssential', async () => {
      await sendLoginAlertEmail(TEST_EMAIL, { ip: '1.2.3.4' }, TEST_USER_ID);
      expect(mockFetch).toHaveBeenCalledWith('/api/send-email', expect.objectContaining({
        body: expect.stringContaining('login_alert'),
      }));
    });
  });

  describe('canSendEmail', () => {
    it('returns true when preferences allow', () => {
      localStorage.setItem(`civicbridge_notification_preferences_${TEST_USER_ID}`, JSON.stringify({
        service_updates: true,
      }));
      expect(canSendEmail(TEST_USER_ID, EMAIL_TEMPLATES.SERVICE_UPDATE)).toBe(true);
    });

    it('returns false when preferences block', () => {
      localStorage.setItem(`civicbridge_notification_preferences_${TEST_USER_ID}`, JSON.stringify({
        service_updates: false,
      }));
      expect(canSendEmail(TEST_USER_ID, EMAIL_TEMPLATES.SERVICE_UPDATE)).toBe(false);
    });

    it('returns true for essential templates', () => {
      localStorage.setItem(`civicbridge_notification_preferences_${TEST_USER_ID}`, JSON.stringify({
        service_updates: false,
      }));
      expect(canSendEmail(TEST_USER_ID, EMAIL_TEMPLATES.ACCOUNT_SECURITY_ALERT)).toBe(true);
    });
  });
});