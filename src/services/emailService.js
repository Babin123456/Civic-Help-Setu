/**
 * Shared Email Service
 * Central service for sending emails that enforces notification preferences.
 * All email sending in the app should go through this service.
 */

import { logDiagnostic } from '../utils/diagnostics';
import { shouldSendEmail } from './notificationPreferenceService';
import { isEmailVerified } from './emailVerificationService';

export const EMAIL_TEMPLATES = {
  VERIFICATION: 'verification',
  WELCOME: 'welcome',
  SERVICE_UPDATE: 'service_update',
  DEADLINE_REMINDER: 'deadline_reminder',
  PRODUCT_ANNOUNCEMENT: 'product_announcement',
  ACCOUNT_SECURITY_ALERT: 'account_security_alert',
  PASSWORD_CHANGED: 'password_changed',
  EMAIL_CHANGED: 'email_changed',
  LOGIN_ALERT: 'login_alert',
  SERVICE_SHARE: 'service_share',
  NEWSLETTER_DIGEST: 'newsletter_digest',
};

const TEMPLATE_CATEGORY_MAP = {
  [EMAIL_TEMPLATES.VERIFICATION]: 'verification_emails',
  [EMAIL_TEMPLATES.WELCOME]: 'verification_emails',
  [EMAIL_TEMPLATES.SERVICE_UPDATE]: 'service_updates',
  [EMAIL_TEMPLATES.DEADLINE_REMINDER]: 'deadline_reminders',
  [EMAIL_TEMPLATES.PRODUCT_ANNOUNCEMENT]: 'product_announcements',
  [EMAIL_TEMPLATES.ACCOUNT_SECURITY_ALERT]: 'account_security',
  [EMAIL_TEMPLATES.PASSWORD_CHANGED]: 'account_security',
  [EMAIL_TEMPLATES.EMAIL_CHANGED]: 'account_security',
  [EMAIL_TEMPLATES.LOGIN_ALERT]: 'account_security',
  [EMAIL_TEMPLATES.SERVICE_SHARE]: 'service_shares',
  [EMAIL_TEMPLATES.NEWSLETTER_DIGEST]: 'newsletter_digest',
};

export function getCategoryForTemplate(template) {
  return TEMPLATE_CATEGORY_MAP[template] || 'account_security';
}

export async function sendEmail({ to, template, data, userId, forceEssential = false }) {
  const category = getCategoryForTemplate(template);

  if (!forceEssential && userId) {
    const allowed = shouldSendEmail(userId, category);
    if (!allowed) {
      logDiagnostic(`Email blocked by preferences: ${template} for user ${userId}`);
      return { sent: false, reason: 'blocked_by_preferences', category };
    }
  }

  if (template !== EMAIL_TEMPLATES.VERIFICATION && userId) {
    const verified = isEmailVerified(to);
    if (!verified) {
      logDiagnostic(`Email blocked: unverified email ${to} for template ${template}`);
      return { sent: false, reason: 'email_not_verified', category };
    }
  }

  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, template, data }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'unknown' }));
      logDiagnostic(`Email send failed: ${template}`, error);
      return { sent: false, reason: 'send_failed', error, category };
    }

    const result = await response.json();
    logDiagnostic(`Email sent: ${template} to ${to}`);
    return { sent: true, messageId: result.messageId, category };
  } catch (err) {
    logDiagnostic(`Email send error: ${template}`, err);
    return { sent: false, reason: 'network_error', error: err.message, category };
  }
}

export async function sendVerificationEmail(email, token, userId) {
  const verificationUrl = `${window.location.origin}/verify-email?token=${token}`;
  return sendEmail({
    to: email,
    template: EMAIL_TEMPLATES.VERIFICATION,
    data: { verificationUrl, expiryHours: 24 },
    userId,
    forceEssential: true,
  });
}

export async function sendWelcomeEmail(email, userName, userId) {
  return sendEmail({
    to: email,
    template: EMAIL_TEMPLATES.WELCOME,
    data: { userName },
    userId,
    forceEssential: true,
  });
}

export async function sendServiceUpdateEmail(email, serviceData, userId) {
  return sendEmail({
    to: email,
    template: EMAIL_TEMPLATES.SERVICE_UPDATE,
    data: serviceData,
    userId,
  });
}

export async function sendDeadlineReminderEmail(email, reminderData, userId) {
  return sendEmail({
    to: email,
    template: EMAIL_TEMPLATES.DEADLINE_REMINDER,
    data: reminderData,
    userId,
  });
}

export async function sendProductAnnouncementEmail(email, announcementData, userId) {
  return sendEmail({
    to: email,
    template: EMAIL_TEMPLATES.PRODUCT_ANNOUNCEMENT,
    data: announcementData,
    userId,
  });
}

export async function sendAccountSecurityAlert(email, alertData, userId) {
  return sendEmail({
    to: email,
    template: EMAIL_TEMPLATES.ACCOUNT_SECURITY_ALERT,
    data: alertData,
    userId,
    forceEssential: true,
  });
}

export async function sendPasswordChangedEmail(email, userId) {
  return sendEmail({
    to: email,
    template: EMAIL_TEMPLATES.PASSWORD_CHANGED,
    data: { changedAt: new Date().toISOString() },
    userId,
    forceEssential: true,
  });
}

export async function sendEmailChangedEmail(oldEmail, newEmail, userId) {
  const promises = [];
  if (oldEmail) {
    promises.push(
      sendEmail({
        to: oldEmail,
        template: EMAIL_TEMPLATES.EMAIL_CHANGED,
        data: { newEmail, changedAt: new Date().toISOString() },
        userId,
        forceEssential: true,
      })
    );
  }
  promises.push(
    sendEmail({
      to: newEmail,
      template: EMAIL_TEMPLATES.EMAIL_CHANGED,
      data: { oldEmail, changedAt: new Date().toISOString() },
      userId,
      forceEssential: true,
    })
  );
  return Promise.all(promises);
}

export async function sendLoginAlertEmail(email, loginData, userId) {
  return sendEmail({
    to: email,
    template: EMAIL_TEMPLATES.LOGIN_ALERT,
    data: loginData,
    userId,
    forceEssential: true,
  });
}

export async function sendServiceShareEmail(email, shareData, userId) {
  return sendEmail({
    to: email,
    template: EMAIL_TEMPLATES.SERVICE_SHARE,
    data: shareData,
    userId,
  });
}

export async function sendNewsletterDigestEmail(email, digestData, userId) {
  return sendEmail({
    to: email,
    template: EMAIL_TEMPLATES.NEWSLETTER_DIGEST,
    data: digestData,
    userId,
  });
}

export function canSendEmail(userId, template) {
  const category = getCategoryForTemplate(template);
  return shouldSendEmail(userId, category);
}