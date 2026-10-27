import {
  buildIcsContent,
  escapeIcsText,
  formatIcsUtcTimestamp,
  parseIsoDate,
} from '../utils/icsText';

const DEFAULT_START_MINUTES = 10 * 60;
const DEFAULT_DURATION_MINUTES = 60;

// "02:00 PM" -> 840, "14:00" -> 840. Returns null for impossible times like 13:00 PM.
const toMinutes = ([, rawHour, rawMin, rawAmPm]) => {
  let hour = parseInt(rawHour, 10);
  const min = parseInt(rawMin, 10);
  const ampm = rawAmPm ? rawAmPm.toUpperCase() : '';
  if (min > 59) return null;
  if (ampm) {
    if (hour < 1 || hour > 12) return null;
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }
  return hour * 60 + min;
};

const pad = (n) => String(n).padStart(2, '0');

const formatLocalDateTime = (date) =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
  `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00`;

// Google and Outlook get the event through the URL, so the appointment token is left
// out of it. The downloaded .ics file is built on this device and still carries it.
const WEB_LINK_DETAILS = (appointment) =>
  `Appointment for ${appointment.serviceName || 'Civic Procedure'}. Carry required originals and photocopies. Your token is in Civic Help Setu.`;

export const calendarExportService = {
  /**
   * Turns an appointment date (YYYY-MM-DD) and slot ("10:00 AM - 11:30 AM (Morning)")
   * into floating local DTSTART / DTEND values. The end time comes from the slot when it
   * has one, otherwise it is start + 1 hour. Returns null when the date is missing or invalid.
   */
  formatDateToIcs(dateStr, timeStr = '10:00 AM') {
    const date = parseIsoDate(dateStr);
    if (!date) return null;

    const times = [...String(timeStr ?? '').matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)?/gi)];
    let startMinutes = times[0] ? toMinutes(times[0]) : null;
    let endMinutes = times[1] ? toMinutes(times[1]) : null;
    if (startMinutes === null) {
      startMinutes = DEFAULT_START_MINUTES;
      endMinutes = null;
    }

    let duration = DEFAULT_DURATION_MINUTES;
    if (endMinutes !== null) {
      duration = endMinutes - startMinutes;
      // A slot like "11:30 PM - 12:30 AM" ends on the next day.
      if (duration <= 0) duration += 24 * 60;
    }

    // The UTC fields are only used as a calendar here (no time zone shift), so the
    // date rolls over correctly at midnight, month end and year end.
    const start = new Date(Date.UTC(date.year, date.month - 1, date.day, 0, startMinutes));
    const end = new Date(start.getTime() + duration * 60 * 1000);

    return { startStr: formatLocalDateTime(start), endStr: formatLocalDateTime(end) };
  },

  generateIcsContent(appointment = {}) {
    const times = this.formatDateToIcs(appointment.date, appointment.timeSlot);
    if (!times) return null;
    const { startStr, endStr } = times;
    const title = `Civic Appointment: ${appointment.officeName || 'Public Service Center'}`;
    const location = appointment.address || 'Govt Facilitation Center';
    const description = `Appointment for ${appointment.serviceName || 'Civic Procedure'}. Token / Ref: ${appointment.token || appointment.id || 'N/A'}. Remember to carry original identity documents, self-attested photocopies, and exact fee change.`;

    return buildIcsContent([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Civic Help Setu//Appointment Scheduler//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:civic-${Date.now()}@civic-help-setu.org`,
      `DTSTAMP:${formatIcsUtcTimestamp()}`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `SUMMARY:${escapeIcsText(title)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `LOCATION:${escapeIcsText(location)}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder: Civic office appointment in 2 hours',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ]);
  },

  downloadIcsFile(appointment) {
    const icsData = this.generateIcsContent(appointment);
    if (!icsData) return false;
    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `civic-appointment-${appointment.date || 'schedule'}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  },

  getGoogleCalendarUrl(appointment) {
    const times = this.formatDateToIcs(appointment.date, appointment.timeSlot);
    if (!times) return null;
    const { startStr, endStr } = times;
    const title = encodeURIComponent(`Civic Appointment: ${appointment.officeName || 'Public Service Center'}`);
    const location = encodeURIComponent(appointment.address || 'Govt Facilitation Center');
    const details = encodeURIComponent(WEB_LINK_DETAILS(appointment));

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${location}`;
  },

  getOutlookCalendarUrl(appointment) {
    const times = this.formatDateToIcs(appointment.date, appointment.timeSlot);
    if (!times) return null;
    const { startStr, endStr } = times;
    const title = encodeURIComponent(`Civic Appointment: ${appointment.officeName || 'Public Service Center'}`);
    const location = encodeURIComponent(appointment.address || 'Govt Facilitation Center');
    const details = encodeURIComponent(WEB_LINK_DETAILS(appointment));

    return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startStr}&enddt=${endStr}&body=${details}&location=${location}`;
  }
};
