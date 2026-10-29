/**
 * Service to manage citizen reminders, renewal deadlines, browser notification alerts,
 * and standard iCalendar (.ics) export for Saved Services.
 */

import {
  buildIcsContent,
  escapeIcsText,
  formatIcsUtcTimestamp,
  parseIsoDate,
} from '../utils/icsText';
import { logDiagnostic } from '../utils/diagnostics';

const REMINDERS_STORAGE_KEY = 'civicbridge_reminders';
const NOTIFICATION_SETTINGS_KEY = 'civicbridge_notification_settings';

export const getNotificationSettings = () => {
  try {
    const raw = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    return raw
      ? JSON.parse(raw)
      : {
          enableBrowserNotifications: false,
          leadDays: 7, // Alert 7 days before
          soundEnabled: true,
        };
  } catch {
    return { enableBrowserNotifications: false, leadDays: 7, soundEnabled: true };
  }
};

export const saveNotificationSettings = (settings) => {
  try {
    localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    logDiagnostic('Failed to save notification settings:', err);
  }
};

export const requestBrowserNotificationPermission = async () => {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    const settings = getNotificationSettings();
    saveNotificationSettings({
      ...settings,
      enableBrowserNotifications: permission === 'granted',
    });
    return permission;
  } catch (err) {
    logDiagnostic('Failed to request notification permission:', err);
    return 'denied';
  }
};

export const getAllReminders = () => {
  try {
    const raw = localStorage.getItem(REMINDERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveReminder = ({
  serviceId,
  serviceName,
  reminderType = 'renewal', // 'renewal' | 'submission' | 'document_expiry'
  deadlineDate,
  reminderNote = '',
  leadDays = 7,
}) => {
  const reminders = getAllReminders();
  const existingIdx = reminders.findIndex((r) => r.serviceId === serviceId);

  const reminderItem = {
    id: `rem_${Date.now()}`,
    serviceId,
    serviceName,
    reminderType,
    deadlineDate,
    reminderNote,
    leadDays: Number(leadDays),
    status: 'active', // 'active' | 'completed' | 'dismissed'
    createdAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    reminders[existingIdx] = { ...reminders[existingIdx], ...reminderItem };
  } else {
    reminders.push(reminderItem);
  }

  try {
    localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders));
  } catch (err) {
    logDiagnostic('Failed to save reminder:', err);
  }

  return reminderItem;
};

export const deleteReminder = (serviceId) => {
  const reminders = getAllReminders().filter((r) => r.serviceId !== serviceId);
  try {
    localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders));
  } catch (err) {
    logDiagnostic('Failed to delete reminder:', err);
  }
  return reminders;
};

export const getReminderByServiceId = (serviceId) => {
  const reminders = getAllReminders();
  return reminders.find((r) => r.serviceId === serviceId) || null;
};

/**
 * Calculates remaining days until deadline.
 * Positive = upcoming days, Negative = overdue.
 */
export const calculateDaysRemaining = (deadlineDate) => {
  if (!deadlineDate) return null;
  const target = new Date(deadlineDate);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Generates an RFC 5545 compliant iCalendar (.ics) string for a service reminder.
 * Returns null when the deadline is missing or not a real YYYY-MM-DD date.
 */
export const generateICalendarEvent = ({
  serviceName,
  deadlineDate,
  reminderNote = '',
}) => {
  const date = parseIsoDate(deadlineDate);
  if (!date) return null;

  // All-day events end on the next day (DTEND is exclusive in RFC 5545).
  const toIcsDate = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const start = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const end = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));
  const dateStr = toIcsDate(start);
  const endDateStr = toIcsDate(end);
  const nowStr = formatIcsUtcTimestamp();

  return buildIcsContent([
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CivicBridge//Citizen Service Reminders//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@civicbridge.setu`,
    `DTSTAMP:${nowStr}`,
    `DTSTART;VALUE=DATE:${dateStr}`,
    `DTEND;VALUE=DATE:${endDateStr}`,
    `SUMMARY:${escapeIcsText(`CivicBridge Deadline: ${serviceName}`)}`,
    `DESCRIPTION:${escapeIcsText(reminderNote || 'Civic procedure submission / renewal deadline reminder via CivicBridge Setu.')}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(`Reminder: ${serviceName} is due tomorrow!`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]);
};

/**
 * Triggers a browser download of an .ics calendar file.
 */
export const downloadCalendarFile = (serviceName, deadlineDate, reminderNote) => {
  const icsData = generateICalendarEvent({ serviceName, deadlineDate, reminderNote });
  if (!icsData) return false;
  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${serviceName.toLowerCase().replace(/\s+/g, '_')}_deadline.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
