/**
 * Application Deadline Reminder Email Service
 *
 * Implements requirement #460:
 * - Configurable email reminders for application deadlines and action windows.
 * - Preset intervals: 7 days, 3 days, 1 day before due date, plus custom days.
 * - Timezone-aware calculation of due dates and cutoffs.
 * - Automatic cancellation when application reaches terminal or completed milestone.
 * - Deduplication via unique reminder keys to prevent redundant notifications.
 * - Simulation & test dispatch for user peace-of-mind.
 */

const REMINDER_CONFIGS_KEY = 'civic_application_deadline_reminder_configs';
const REMINDER_LOGS_KEY = 'civic_application_deadline_reminder_logs';

export const REMINDER_CADENCE = {
  SEVEN_DAYS: 7,
  THREE_DAYS: 3,
  ONE_DAY: 1,
  DAY_OF_DEADLINE: 0
};

export const TERMINAL_STATUSES = [
  'COMPLETED',
  'RESOLVED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'CLOSED'
];

/**
 * Retrieves all registered deadline reminder rules
 */
export function getDeadlineReminderConfigs() {
  try {
    const raw = localStorage.getItem(REMINDER_CONFIGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves a deadline reminder configuration
 */
export function saveDeadlineReminderConfig(config) {
  try {
    const existing = getDeadlineReminderConfigs();
    const configId = config.id || `remcfg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const updatedRecord = {
      ...config,
      id: configId,
      createdAt: config.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      active: config.active !== false
    };

    const filtered = existing.filter((c) => c.id !== configId && c.applicationId !== config.applicationId);
    const updatedList = [updatedRecord, ...filtered];
    localStorage.setItem(REMINDER_CONFIGS_KEY, JSON.stringify(updatedList));

    return { success: true, config: updatedRecord };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Removes or deactivates a deadline reminder rule
 */
export function cancelDeadlineReminder(applicationId) {
  try {
    const existing = getDeadlineReminderConfigs();
    const updated = existing.filter((c) => c.applicationId !== applicationId);
    localStorage.setItem(REMINDER_CONFIGS_KEY, JSON.stringify(updated));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Retrieves reminder dispatch logs
 */
export function getDeadlineReminderLogs() {
  try {
    const raw = localStorage.getItem(REMINDER_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Checks remaining days between now and target date, considering user timezone
 */
export function calculateDaysRemaining(targetDateStr, timeZone = 'Asia/Kolkata') {
  if (!targetDateStr) return null;

  try {
    const target = new Date(targetDateStr);
    const now = new Date();

    // Normalizing to date boundaries in specified timezone
    const nowParts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).formatToParts(now);

    const targetParts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).formatToParts(target);

    const nowFormatted = new Date(`${nowParts.find(p => p.type === 'year').value}-${nowParts.find(p => p.type === 'month').value.padStart(2, '0')}-${nowParts.find(p => p.type === 'day').value.padStart(2, '0')}T00:00:00Z`);
    const targetFormatted = new Date(`${targetParts.find(p => p.type === 'year').value}-${targetParts.find(p => p.type === 'month').value.padStart(2, '0')}-${targetParts.find(p => p.type === 'day').value.padStart(2, '0')}T00:00:00Z`);

    const diffMs = targetFormatted - nowFormatted;
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

/**
 * Determines whether a reminder is eligible to be triggered
 */
export function evaluateReminderEligibility(config, currentAppStatus, nowDaysRemaining) {
  if (!config.active) {
    return { eligible: false, reason: 'Reminder is paused or deactivated' };
  }

  // Automatic cancellation upon terminal completion
  if (TERMINAL_STATUSES.includes(currentAppStatus?.toUpperCase())) {
    return {
      eligible: false,
      reason: `Application has reached terminal status (${currentAppStatus}). Reminder automatically cancelled.`
    };
  }

  const daysRemaining = nowDaysRemaining !== undefined ? nowDaysRemaining : calculateDaysRemaining(config.deadlineDate, config.timeZone);

  if (daysRemaining === null || daysRemaining < 0) {
    return { eligible: false, reason: 'Deadline has already elapsed' };
  }

  const enabledCadences = config.cadenceDays || [7, 3, 1];
  const matchedCadence = enabledCadences.find((days) => days === daysRemaining);

  if (matchedCadence === undefined) {
    return {
      eligible: false,
      reason: `No cadence scheduled for ${daysRemaining} days remaining (enabled: ${enabledCadences.join(', ')})`
    };
  }

  // Check deduplication
  const reminderKey = `${config.applicationId}_cadence_${matchedCadence}`;
  const logs = getDeadlineReminderLogs();
  const alreadySent = logs.some((l) => l.reminderKey === reminderKey);

  if (alreadySent) {
    return {
      eligible: false,
      reason: `Reminder for ${matchedCadence} days prior was already dispatched`
    };
  }

  return {
    eligible: true,
    matchedCadence,
    daysRemaining,
    reminderKey
  };
}

/**
 * Generates email content for deadline reminder
 */
export function generateDeadlineReminderEmail({
  applicationId,
  serviceTitle,
  deadlineDate,
  daysRemaining,
  actionRequired,
  trackingUrl
}) {
  const urgencyLabel = daysRemaining === 0 ? 'TODAY' : daysRemaining === 1 ? 'TOMORROW' : `in ${daysRemaining} days`;
  const subject = `[Action Required] Deadline approaching ${urgencyLabel}: ${serviceTitle} (${applicationId})`;

  const plainTextBody = `
CIVIC HELP SETU - DEADLINE REMINDER
===================================

Attention: An important application deadline is approaching ${urgencyLabel}.

Application ID: ${applicationId}
Service: ${serviceTitle}
Deadline Date: ${deadlineDate}
Days Remaining: ${daysRemaining} days

ACTION REQUIRED:
${actionRequired || 'Complete all outstanding verification steps, biometric appointments, or correction uploads.'}

ACCESS APPLICATION:
${trackingUrl || `https://civichelpsetu.gov.in/track?ref=${applicationId}`}

Note: If you have already fulfilled this requirement, this notification can be ignored or deactivated in your tracking panel.
  `.trim();

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <div style="border-bottom: 2px solid #ea580c; padding-bottom: 12px; margin-bottom: 20px;">
        <span style="font-size: 18px; font-weight: bold; color: #9a3412;">Civic Help Setu</span>
        <span style="font-size: 12px; color: #64748b; margin-left: 10px;">Deadline Alert</span>
      </div>

      <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
        <h2 style="color: #9a3412; margin: 0 0 8px 0; font-size: 18px;">
          Action Window Closes ${urgencyLabel} (${daysRemaining} Days Left)
        </h2>
        <p style="margin: 0; color: #7c2d12; font-size: 14px;">
          Your pending civic action requires attention before the official cut-off on <strong>${deadlineDate}</strong>.
        </p>
      </div>

      <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Application ID:</strong> <span style="font-family: monospace;">${applicationId}</span></p>
        <p style="margin: 4px 0;"><strong>Service Name:</strong> ${serviceTitle}</p>
        <p style="margin: 4px 0;"><strong>Required Action:</strong> ${actionRequired || 'Submit outstanding documents or complete verification.'}</p>
      </div>

      <div style="margin: 28px 0; text-align: center;">
        <a href="${trackingUrl || `https://civichelpsetu.gov.in/track?ref=${applicationId}`}" style="background-color: #ea580c; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; display: inline-block;">
          Open Application & Take Action
        </a>
      </div>

      <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center;">
        <p>This automated reminder was configured for application ${applicationId}. No passwords or unredacted identity numbers are included in this transmission.</p>
      </div>
    </div>
  `.trim();

  return { subject, plainTextBody, htmlBody };
}

/**
 * Triggers dispatch of a deadline reminder
 */
export async function sendDeadlineReminder({
  config,
  recipientEmail,
  daysRemainingOverride,
  force = false
}) {
  const targetEmail = recipientEmail || config.recipientEmail;
  if (!targetEmail || !targetEmail.includes('@')) {
    return { success: false, error: 'Invalid or missing recipient email' };
  }

  const daysRemaining = daysRemainingOverride !== undefined
    ? daysRemainingOverride
    : calculateDaysRemaining(config.deadlineDate, config.timeZone);

  const eligibility = evaluateReminderEligibility(config, config.currentStatus, daysRemaining);

  if (!eligibility.eligible && !force) {
    return {
      success: false,
      skipped: true,
      reason: eligibility.reason
    };
  }

  const reminderKey = eligibility.reminderKey || `${config.applicationId}_cadence_manual_${Date.now()}`;
  const emailContent = generateDeadlineReminderEmail({
    applicationId: config.applicationId,
    serviceTitle: config.serviceTitle,
    deadlineDate: config.deadlineDate,
    daysRemaining: daysRemaining ?? 0,
    actionRequired: config.actionRequired,
    trackingUrl: config.trackingUrl
  });

  const record = {
    id: `rem_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    reminderKey,
    applicationId: config.applicationId,
    recipientEmail: targetEmail,
    subject: emailContent.subject,
    daysRemaining,
    dispatchedAt: new Date().toISOString(),
    status: 'DELIVERED'
  };

  try {
    const existingLogs = getDeadlineReminderLogs();
    const updatedLogs = [record, ...existingLogs.slice(0, 99)];
    localStorage.setItem(REMINDER_LOGS_KEY, JSON.stringify(updatedLogs));

    return {
      success: true,
      record,
      emailContent
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
