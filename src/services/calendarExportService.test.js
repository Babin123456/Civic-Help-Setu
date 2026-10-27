import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calendarExportService } from './calendarExportService';
import { generateICalendarEvent } from './reminderNotificationService';
import { escapeIcsText, foldIcsLine, parseIsoDate } from '../utils/icsText';

const utf8Bytes = (s) => new TextEncoder().encode(s).length;

// Undo line folding (CRLF followed by a space) and split into content lines.
const unfoldLines = (ics) => ics.replace(/\r\n[ \t]/g, '').split('\r\n');

const prop = (ics, name) => {
  const line = unfoldLines(ics).find((l) => l.startsWith(`${name}:`) || l.startsWith(`${name};`));
  return line ? line.slice(line.indexOf(':') + 1) : undefined;
};

const baseAppointment = {
  officeName: 'Tahsil Office',
  address: 'Ward 5, Main Road',
  serviceName: 'Income Certificate',
  date: '2026-11-03',
  timeSlot: '10:00 AM - 11:30 AM (Morning)',
  token: 'TKN-123456',
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-24T06:30:15.123Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('escapeIcsText', () => {
  it('escapes backslash, semicolon, comma and newlines', () => {
    expect(escapeIcsText('a\\b;c,d\ne\r\nf\rg')).toBe('a\\\\b\\;c\\,d\\ne\\nf\\ng');
  });

  it('handles empty and missing values', () => {
    expect(escapeIcsText('')).toBe('');
    expect(escapeIcsText(undefined)).toBe('');
    expect(escapeIcsText(null)).toBe('');
  });
});

describe('foldIcsLine', () => {
  it('leaves short lines alone', () => {
    expect(foldIcsLine('SUMMARY:Short')).toBe('SUMMARY:Short');
  });

  it('folds long lines at 75 octets and unfolds back to the original', () => {
    const line = `DESCRIPTION:${'x'.repeat(200)}`;
    const folded = foldIcsLine(line);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    parts.forEach((p) => expect(utf8Bytes(p)).toBeLessThanOrEqual(75));
    parts.slice(1).forEach((p) => expect(p.startsWith(' ')).toBe(true));
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });

  it('counts UTF-8 bytes and never splits a multi-byte character', () => {
    const line = `LOCATION:${'तहसील कार्यालय '.repeat(10)}`;
    const folded = foldIcsLine(line);
    folded.split('\r\n').forEach((p) => {
      expect(utf8Bytes(p)).toBeLessThanOrEqual(75);
      expect(p).not.toContain('�');
    });
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });
});

describe('parseIsoDate', () => {
  it('accepts real dates and rejects impossible or malformed ones', () => {
    expect(parseIsoDate('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 });
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('2026-13-01')).toBeNull();
    expect(parseIsoDate('03/11/2026')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate(undefined)).toBeNull();
  });
});

describe('calendarExportService.formatDateToIcs', () => {
  it('uses the end time from the slot', () => {
    expect(calendarExportService.formatDateToIcs('2026-11-03', '10:00 AM - 11:30 AM (Morning)')).toEqual({
      startStr: '20261103T100000',
      endStr: '20261103T113000',
    });
    expect(calendarExportService.formatDateToIcs('2026-11-03', '11:00 AM - 12:30 PM (Mid-Day)')).toEqual({
      startStr: '20261103T110000',
      endStr: '20261103T123000',
    });
  });

  it('handles 12 AM and 12 PM', () => {
    expect(calendarExportService.formatDateToIcs('2026-11-03', '12:00 AM').startStr).toBe('20261103T000000');
    expect(calendarExportService.formatDateToIcs('2026-11-03', '12:00 PM').startStr).toBe('20261103T120000');
  });

  it('rolls a 23:30 start over to the next day when there is no end time', () => {
    expect(calendarExportService.formatDateToIcs('2026-11-03', '11:30 PM')).toEqual({
      startStr: '20261103T233000',
      endStr: '20261104T003000',
    });
  });

  it('rolls over at month and year end, and for a slot that ends after midnight', () => {
    expect(calendarExportService.formatDateToIcs('2026-12-31', '23:30').endStr).toBe('20270101T003000');
    expect(calendarExportService.formatDateToIcs('2026-11-30', '11:30 PM - 12:30 AM').endStr).toBe(
      '20261201T003000'
    );
  });

  it('falls back to 10:00 AM for a missing or unreadable time', () => {
    const expected = { startStr: '20261103T100000', endStr: '20261103T110000' };
    expect(calendarExportService.formatDateToIcs('2026-11-03')).toEqual(expected);
    expect(calendarExportService.formatDateToIcs('2026-11-03', null)).toEqual(expected);
    expect(calendarExportService.formatDateToIcs('2026-11-03', 'Morning')).toEqual(expected);
    expect(calendarExportService.formatDateToIcs('2026-11-03', '13:00 PM')).toEqual(expected);
  });

  it('returns null for a missing or invalid date', () => {
    expect(calendarExportService.formatDateToIcs(undefined, '10:00 AM')).toBeNull();
    expect(calendarExportService.formatDateToIcs('2026-02-30', '10:00 AM')).toBeNull();
  });
});

describe('calendarExportService.generateIcsContent', () => {
  it('writes the slot start and end and a UTC DTSTAMP of the current time', () => {
    const ics = calendarExportService.generateIcsContent(baseAppointment);
    expect(prop(ics, 'DTSTART')).toBe('20261103T100000');
    expect(prop(ics, 'DTEND')).toBe('20261103T113000');
    expect(prop(ics, 'DTSTAMP')).toBe('20261024T063015Z');
    expect(prop(ics, 'DTSTAMP')).toMatch(/^\d{8}T\d{6}Z$/);
  });

  it('ends a 23:30 appointment on the next day', () => {
    const ics = calendarExportService.generateIcsContent({ ...baseAppointment, timeSlot: '11:30 PM' });
    expect(prop(ics, 'DTSTART')).toBe('20261103T233000');
    expect(prop(ics, 'DTEND')).toBe('20261104T003000');
  });

  it('escapes commas, semicolons, backslashes and newlines in text fields', () => {
    const ics = calendarExportService.generateIcsContent({
      ...baseAppointment,
      officeName: 'Tahsil, Ward 5; Annex',
      address: 'Block C\\2, Ring Road\nNear Bus Stand; Gate 3',
      serviceName: 'Caste, Income; Domicile',
    });
    expect(prop(ics, 'SUMMARY')).toBe('Civic Appointment: Tahsil\\, Ward 5\\; Annex');
    expect(prop(ics, 'LOCATION')).toBe('Block C\\\\2\\, Ring Road\\nNear Bus Stand\\; Gate 3');
    expect(prop(ics, 'DESCRIPTION')).toContain('Appointment for Caste\\, Income\\; Domicile.');
    // The raw newline from the address must not create a line of its own.
    expect(ics).not.toMatch(/\r\nNear Bus Stand/);
  });

  it('folds every physical line to 75 octets and uses CRLF line endings', () => {
    const ics = calendarExportService.generateIcsContent({
      ...baseAppointment,
      address: 'Mini Secretariat, Sector 17, Opposite District Court, Near the Old Bus Stand, Chandigarh',
    });
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    ics
      .split('\r\n')
      .forEach((line) => expect(utf8Bytes(line)).toBeLessThanOrEqual(75));
    expect(prop(ics, 'LOCATION')).toBe(
      'Mini Secretariat\\, Sector 17\\, Opposite District Court\\, Near the Old Bus Stand\\, Chandigarh'
    );
  });

  it('returns null instead of throwing when the date is missing', () => {
    expect(() => calendarExportService.generateIcsContent({})).not.toThrow();
    expect(calendarExportService.generateIcsContent({})).toBeNull();
    expect(calendarExportService.generateIcsContent()).toBeNull();
  });

  it('gives the Google and Outlook links the same corrected end time', () => {
    const appointment = { ...baseAppointment, timeSlot: '11:30 PM' };
    expect(calendarExportService.getGoogleCalendarUrl(appointment)).toContain(
      'dates=20261103T233000/20261104T003000'
    );
    expect(calendarExportService.getOutlookCalendarUrl(appointment)).toContain(
      'startdt=20261103T233000&enddt=20261104T003000'
    );
    expect(calendarExportService.getGoogleCalendarUrl({})).toBeNull();
  });
});

describe('what the Google and Outlook links share', () => {
  it('leaves the appointment token out of both web links', () => {
    [calendarExportService.getGoogleCalendarUrl(baseAppointment), calendarExportService.getOutlookCalendarUrl(baseAppointment)].forEach(
      (url) => {
        const decoded = decodeURIComponent(url);
        expect(decoded).not.toContain('TKN-123456');
        expect(decoded).not.toContain('123456');
        expect(decoded).toContain('Tahsil Office');
        expect(decoded).toContain('Income Certificate');
      }
    );
  });

  it('leaves out the id fallback too', () => {
    const { token, ...noToken } = baseAppointment;
    void token;
    const url = calendarExportService.getGoogleCalendarUrl({ ...noToken, id: 'apt-secret-77' });
    expect(decodeURIComponent(url)).not.toContain('apt-secret-77');
  });

  it('still puts the token in the .ics file, which is built on this device', () => {
    const ics = calendarExportService.generateIcsContent(baseAppointment);
    expect(prop(ics, 'DESCRIPTION')).toContain('TKN-123456');
  });
});

describe('generateICalendarEvent (saved service reminders)', () => {
  it('ends an all-day event on the next day, including at month and year end', () => {
    let ics = generateICalendarEvent({ serviceName: 'Passport', deadlineDate: '2026-11-30' });
    expect(prop(ics, 'DTSTART;VALUE=DATE')).toBe('20261130');
    expect(prop(ics, 'DTEND;VALUE=DATE')).toBe('20261201');

    ics = generateICalendarEvent({ serviceName: 'Passport', deadlineDate: '2026-12-31' });
    expect(prop(ics, 'DTEND;VALUE=DATE')).toBe('20270101');
  });

  it('escapes the service name and note and keeps a UTC DTSTAMP', () => {
    const ics = generateICalendarEvent({
      serviceName: 'Ration Card, APL; Renewal',
      deadlineDate: '2026-11-30',
      reminderNote: 'Carry: Aadhaar, old card\nAsk at counter 4; not 5',
    });
    expect(prop(ics, 'SUMMARY')).toBe('CivicBridge Deadline: Ration Card\\, APL\\; Renewal');
    const descriptions = unfoldLines(ics).filter((l) => l.startsWith('DESCRIPTION:'));
    expect(descriptions).toEqual([
      'DESCRIPTION:Carry: Aadhaar\\, old card\\nAsk at counter 4\\; not 5',
      'DESCRIPTION:Reminder: Ration Card\\, APL\\; Renewal is due tomorrow!',
    ]);
    expect(prop(ics, 'DTSTAMP')).toBe('20261024T063015Z');
  });

  it('returns null instead of throwing for a missing or invalid deadline', () => {
    expect(generateICalendarEvent({ serviceName: 'Passport' })).toBeNull();
    expect(generateICalendarEvent({ serviceName: 'Passport', deadlineDate: '2026-02-30' })).toBeNull();
  });
});
