/**
 * Notification Preference Service
 * Manages user email notification preferences for optional communications.
 * Essential account-security messages are always sent regardless of preferences.
 */

import { logDiagnostic } from '../utils/diagnostics';

const STORAGE_KEY = 'civicbridge_notification_preferences';

export const NOTIFICATION_CATEGORIES = {
  SERVICE_UPDATES: {
    id: 'service_updates',
    label: 'Service Updates',
    description: 'Notifications about new services, changes to existing services, and service availability in your area.',
    essential: false,
  },
  DEADLINE_REMINDERS: {
    id: 'deadline_reminders',
    label: 'Deadline Reminders',
    description: 'Reminders for upcoming application deadlines, renewal dates, and submission cutoffs.',
    essential: false,
  },
  PRODUCT_ANNOUNCEMENTS: {
    id: 'product_announcements',
    label: 'Product Announcements',
    description: 'Updates about new features, platform improvements, and Civic Help Setu product news.',
    essential: false,
  },
  NEWSLETTER_DIGEST: {
    id: 'newsletter_digest',
    label: 'Monthly Civic Digest',
    description: 'Personalised monthly email with new services, updates, deadlines, and official announcements based on your interests and location.',
    essential: false,
  },
  ACCOUNT_SECURITY: {
    id: 'account_security',
    label: 'Account Security',
    description: 'Critical security alerts, login notifications, and account changes. Cannot be disabled.',
    essential: true,
  },
  VERIFICATION_EMAILS: {
    id: 'verification_emails',
    label: 'Verification Emails',
    description: 'Email verification links and confirmation messages. Cannot be disabled.',
    essential: true,
  },
};

export const CATEGORY_IDS = Object.values(NOTIFICATION_CATEGORIES).map((c) => c.id);
export const OPTIONAL_CATEGORY_IDS = Object.values(NOTIFICATION_CATEGORIES)
  .filter((c) => !c.essential)
  .map((c) => c.id);
export const ESSENTIAL_CATEGORY_IDS = Object.values(NOTIFICATION_CATEGORIES)
  .filter((c) => c.essential)
  .map((c) => c.id);

const DEFAULT_PREFERENCES = {
  service_updates: true,
  deadline_reminders: true,
  product_announcements: false,
  newsletter_digest: false,
  account_security: true,
  verification_emails: true,
};

export function getNotificationPreferences(userId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const stored = JSON.parse(raw);
    return { ...DEFAULT_PREFERENCES, ...stored };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function saveNotificationPreferences(userId, preferences) {
  try {
    const validated = validatePreferences(preferences);
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(validated));
    return validated;
  } catch (err) {
    logDiagnostic('Failed to save notification preferences:', err);
    throw new Error('Failed to save notification preferences', { cause: err });
  }
}

export function validatePreferences(preferences) {
  const validated = { ...DEFAULT_PREFERENCES };
  for (const categoryId of CATEGORY_IDS) {
    if (preferences[categoryId] !== undefined) {
      validated[categoryId] = Boolean(preferences[categoryId]);
    }
  }
  for (const essentialId of ESSENTIAL_CATEGORY_IDS) {
    validated[essentialId] = true;
  }
  return validated;
}

export function isCategoryEnabled(userId, categoryId) {
  const prefs = getNotificationPreferences(userId);
  return prefs[categoryId] === true;
}

export function getEnabledCategories(userId) {
  const prefs = getNotificationPreferences(userId);
  return CATEGORY_IDS.filter((id) => prefs[id] === true);
}

export function getOptionalPreferences(userId) {
  const prefs = getNotificationPreferences(userId);
  const result = {};
  for (const id of OPTIONAL_CATEGORY_IDS) {
    result[id] = prefs[id];
  }
  return result;
}

export function updatePreference(userId, categoryId, enabled) {
  if (!CATEGORY_IDS.includes(categoryId)) {
    throw new Error(`Invalid category: ${categoryId}`);
  }
  if (ESSENTIAL_CATEGORY_IDS.includes(categoryId) && !enabled) {
    throw new Error(`Cannot disable essential category: ${categoryId}`);
  }
  const prefs = getNotificationPreferences(userId);
  prefs[categoryId] = enabled;
  return saveNotificationPreferences(userId, prefs);
}

export function resetToDefaults(userId) {
  return saveNotificationPreferences(userId, DEFAULT_PREFERENCES);
}

export function shouldSendEmail(userId, categoryId) {
  if (ESSENTIAL_CATEGORY_IDS.includes(categoryId)) {
    return true;
  }
  return isCategoryEnabled(userId, categoryId);
}

export function getPreferenceMetadata(categoryId) {
  return NOTIFICATION_CATEGORIES[categoryId.toUpperCase()] || null;
}

export function getAllCategories() {
  return Object.values(NOTIFICATION_CATEGORIES);
}

export function getCategoryChoices() {
  return Object.values(NOTIFICATION_CATEGORIES).map((cat) => ({
    id: cat.id,
    label: cat.label,
    description: cat.description,
    essential: cat.essential,
  }));
}