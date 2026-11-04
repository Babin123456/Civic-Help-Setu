import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  validatePreferences,
  isCategoryEnabled,
  getEnabledCategories,
  getOptionalPreferences,
  updatePreference,
  resetToDefaults,
  shouldSendEmail,
  getPreferenceMetadata,
  getAllCategories,
  getCategoryChoices,
  NOTIFICATION_CATEGORIES,
  CATEGORY_IDS,
  OPTIONAL_CATEGORY_IDS,
  ESSENTIAL_CATEGORY_IDS,
} from '../services/notificationPreferenceService.js';

const TEST_USER_ID = 'user_test_123';

const mockStorage = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key) => mockStorage[key] || null),
  setItem: vi.fn((key, value) => { mockStorage[key] = value; }),
  removeItem: vi.fn((key) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
});

beforeEach(() => {
  localStorage.clear();
});

describe('notificationPreferenceService', () => {
  describe('DEFAULT_PREFERENCES', () => {
    it('has correct default values', () => {
      const prefs = getNotificationPreferences(TEST_USER_ID);
      expect(prefs.service_updates).toBe(true);
      expect(prefs.deadline_reminders).toBe(true);
      expect(prefs.product_announcements).toBe(false);
      expect(prefs.account_security).toBe(true);
      expect(prefs.verification_emails).toBe(true);
    });
  });

  describe('validatePreferences', () => {
    it('returns defaults when given empty object', () => {
      const validated = validatePreferences({});
      expect(validated.service_updates).toBe(true);
      expect(validated.deadline_reminders).toBe(true);
      expect(validated.product_announcements).toBe(false);
      expect(validated.account_security).toBe(true);
      expect(validated.verification_emails).toBe(true);
    });

    it('preserves valid optional preferences', () => {
      const validated = validatePreferences({
        service_updates: false,
        deadline_reminders: true,
        product_announcements: true,
      });
      expect(validated.service_updates).toBe(false);
      expect(validated.deadline_reminders).toBe(true);
      expect(validated.product_announcements).toBe(true);
    });

    it('forces essential categories to true', () => {
      const validated = validatePreferences({
        account_security: false,
        verification_emails: false,
      });
      expect(validated.account_security).toBe(true);
      expect(validated.verification_emails).toBe(true);
    });

    it('ignores unknown categories', () => {
      const validated = validatePreferences({
        unknown_category: true,
        service_updates: false,
      });
      expect(validated.service_updates).toBe(false);
      expect(validated.unknown_category).toBeUndefined();
    });

    it('coerces values to boolean', () => {
      const validated = validatePreferences({
        service_updates: 'true',
        deadline_reminders: 0,
        product_announcements: 'yes',
      });
      expect(validated.service_updates).toBe(true);
      expect(validated.deadline_reminders).toBe(false);
      expect(validated.product_announcements).toBe(true);
    });
  });

  describe('saveNotificationPreferences', () => {
    it('saves and retrieves preferences', () => {
      const prefs = { service_updates: false, deadline_reminders: true, product_announcements: true };
      const saved = saveNotificationPreferences(TEST_USER_ID, prefs);

      expect(saved.service_updates).toBe(false);
      expect(saved.deadline_reminders).toBe(true);
      expect(saved.product_announcements).toBe(true);
      expect(saved.account_security).toBe(true);
      expect(saved.verification_emails).toBe(true);
    });

    it('persists to localStorage', () => {
      saveNotificationPreferences(TEST_USER_ID, { service_updates: false });
      const stored = localStorage.getItem(`civicbridge_notification_preferences_${TEST_USER_ID}`);
      const parsed = JSON.parse(stored);
      expect(parsed.service_updates).toBe(false);
    });
  });

  describe('isCategoryEnabled', () => {
    it('returns true for enabled categories', () => {
      saveNotificationPreferences(TEST_USER_ID, { service_updates: true });
      expect(isCategoryEnabled(TEST_USER_ID, 'service_updates')).toBe(true);
    });

    it('returns false for disabled categories', () => {
      saveNotificationPreferences(TEST_USER_ID, { service_updates: false });
      expect(isCategoryEnabled(TEST_USER_ID, 'service_updates')).toBe(false);
    });

    it('returns true for essential categories even if set to false', () => {
      saveNotificationPreferences(TEST_USER_ID, { account_security: false });
      expect(isCategoryEnabled(TEST_USER_ID, 'account_security')).toBe(true);
    });

    it('returns default for unknown user', () => {
      expect(isCategoryEnabled('unknown_user', 'service_updates')).toBe(true);
    });
  });

  describe('getEnabledCategories', () => {
    it('returns only enabled categories', () => {
      saveNotificationPreferences(TEST_USER_ID, {
        service_updates: true,
        deadline_reminders: false,
        product_announcements: true,
      });
      const enabled = getEnabledCategories(TEST_USER_ID);

      expect(enabled).toContain('service_updates');
      expect(enabled).toContain('product_announcements');
      expect(enabled).toContain('account_security');
      expect(enabled).toContain('verification_emails');
      expect(enabled).not.toContain('deadline_reminders');
    });
  });

  describe('getOptionalPreferences', () => {
    it('returns only optional categories', () => {
      saveNotificationPreferences(TEST_USER_ID, {
        service_updates: true,
        deadline_reminders: false,
        product_announcements: true,
        account_security: true,
        verification_emails: true,
      });
      const optional = getOptionalPreferences(TEST_USER_ID);

      expect(optional.service_updates).toBe(true);
      expect(optional.deadline_reminders).toBe(false);
      expect(optional.product_announcements).toBe(true);
      expect(optional.account_security).toBeUndefined();
      expect(optional.verification_emails).toBeUndefined();
    });
  });

  describe('updatePreference', () => {
    it('updates a single preference', () => {
      updatePreference(TEST_USER_ID, 'service_updates', false);
      expect(isCategoryEnabled(TEST_USER_ID, 'service_updates')).toBe(false);
    });

    it('throws for invalid category', () => {
      expect(() => updatePreference(TEST_USER_ID, 'invalid_category', true))
        .toThrow('Invalid category: invalid_category');
    });

    it('throws when trying to disable essential category', () => {
      expect(() => updatePreference(TEST_USER_ID, 'account_security', false))
        .toThrow('Cannot disable essential category: account_security');
    });
  });

  describe('resetToDefaults', () => {
    it('resets all preferences to defaults', () => {
      saveNotificationPreferences(TEST_USER_ID, {
        service_updates: false,
        deadline_reminders: false,
        product_announcements: true,
      });
      resetToDefaults(TEST_USER_ID);

      const prefs = getNotificationPreferences(TEST_USER_ID);
      expect(prefs.service_updates).toBe(true);
      expect(prefs.deadline_reminders).toBe(true);
      expect(prefs.product_announcements).toBe(false);
    });
  });

  describe('shouldSendEmail', () => {
    it('returns true for essential categories', () => {
      saveNotificationPreferences(TEST_USER_ID, { account_security: false });
      expect(shouldSendEmail(TEST_USER_ID, 'account_security')).toBe(true);
      expect(shouldSendEmail(TEST_USER_ID, 'verification_emails')).toBe(true);
    });

    it('returns true for enabled optional categories', () => {
      saveNotificationPreferences(TEST_USER_ID, { service_updates: true });
      expect(shouldSendEmail(TEST_USER_ID, 'service_updates')).toBe(true);
    });

    it('returns false for disabled optional categories', () => {
      saveNotificationPreferences(TEST_USER_ID, { service_updates: false });
      expect(shouldSendEmail(TEST_USER_ID, 'service_updates')).toBe(false);
    });

    it('returns true for unknown users (defaults)', () => {
      expect(shouldSendEmail('unknown_user', 'service_updates')).toBe(true);
      expect(shouldSendEmail('unknown_user', 'product_announcements')).toBe(false);
    });
  });

  describe('getPreferenceMetadata', () => {
    it('returns metadata for valid category', () => {
      const meta = getPreferenceMetadata('service_updates');
      expect(meta).toBeDefined();
      expect(meta.id).toBe('service_updates');
      expect(meta.label).toBe('Service Updates');
      expect(meta.essential).toBe(false);
    });

    it('returns null for invalid category', () => {
      expect(getPreferenceMetadata('invalid')).toBeNull();
    });
  });

  describe('getAllCategories', () => {
    it('returns all categories with metadata', () => {
      const categories = getAllCategories();
      expect(categories).toHaveLength(6);
      expect(categories.map(c => c.id)).toEqual([
        'service_updates',
        'deadline_reminders',
        'product_announcements',
        'newsletter_digest',
        'account_security',
        'verification_emails',
      ]);
    });
  });

  describe('getCategoryChoices', () => {
    it('returns formatted choices for UI', () => {
      const choices = getCategoryChoices();
      expect(choices).toHaveLength(6);
      expect(choices[0]).toHaveProperty('id');
      expect(choices[0]).toHaveProperty('label');
      expect(choices[0]).toHaveProperty('description');
      expect(choices[0]).toHaveProperty('essential');
    });
  });

  describe('constants', () => {
    it('CATEGORY_IDS includes all categories', () => {
      expect(CATEGORY_IDS).toHaveLength(6);
    });

    it('OPTIONAL_CATEGORY_IDS includes only non-essential', () => {
      expect(OPTIONAL_CATEGORY_IDS).toEqual([
        'service_updates',
        'deadline_reminders',
        'product_announcements',
        'newsletter_digest',
      ]);
    });

    it('ESSENTIAL_CATEGORY_IDS includes only essential', () => {
      expect(ESSENTIAL_CATEGORY_IDS).toEqual([
        'account_security',
        'verification_emails',
      ]);
    });

    it('NOTIFICATION_CATEGORIES has correct structure', () => {
      expect(NOTIFICATION_CATEGORIES.SERVICE_UPDATES.essential).toBe(false);
      expect(NOTIFICATION_CATEGORIES.ACCOUNT_SECURITY.essential).toBe(true);
      expect(NOTIFICATION_CATEGORIES.VERIFICATION_EMAILS.essential).toBe(true);
    });
  });
});