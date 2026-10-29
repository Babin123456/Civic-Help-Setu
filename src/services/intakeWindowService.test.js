import { describe, it, expect } from 'vitest';
import {
  getOfficeIntakeSchedule,
  getCurrentIntakeStatus,
  formatIntakeTimeRemaining,
  INTAKE_PHASES,
} from './intakeWindowService';

describe('Intake Window Service (#256)', () => {
  const sampleOffice = {
    id: 'test-office-delhi',
    name: 'Tehsil Office',
    type: 'Tehsil / Collectorate',
    tokensPerDay: 150,
    officeHours: {
      openSaturdays: false,
    },
  };

  it('generates expected intake schedule with tokens, scrutiny, lunch, and dispatch', () => {
    const schedule = getOfficeIntakeSchedule(sampleOffice);
    expect(schedule.length).toBeGreaterThanOrEqual(4);

    const phases = schedule.map((s) => s.phase);
    expect(phases).toContain(INTAKE_PHASES.TOKEN_ISSUANCE);
    expect(phases).toContain(INTAKE_PHASES.DOCUMENT_SCRUTINY);
    expect(phases).toContain(INTAKE_PHASES.LUNCH_RECESS);
    expect(phases).toContain(INTAKE_PHASES.DISPATCH_ONLY);
  });

  it('marks office closed on Sundays', () => {
    // Sunday date: 2026-11-01 (Sunday)
    const sunday = new Date('2026-11-01T11:00:00');
    const status = getCurrentIntakeStatus(sampleOffice, sunday);

    expect(status.phase).toBe(INTAKE_PHASES.CLOSED);
    expect(status.isAcceptingTokens).toBe(false);
    expect(status.label).toContain('Closed on Weekends');
  });

  it('identifies early morning before opening', () => {
    // Monday 08:30 AM
    const earlyMorning = new Date('2026-11-02T08:30:00');
    const status = getCurrentIntakeStatus(sampleOffice, earlyMorning);

    expect(status.phase).toBe(INTAKE_PHASES.CLOSED);
    expect(status.label).toContain('Opens at 09:30');
    expect(status.minutesRemaining).toBe(60);
  });

  it('identifies morning token issuance window', () => {
    // Monday 10:30 AM
    const tokenTime = new Date('2026-11-02T10:30:00');
    const status = getCurrentIntakeStatus(sampleOffice, tokenTime);

    expect(status.phase).toBe(INTAKE_PHASES.TOKEN_ISSUANCE);
    expect(status.isAcceptingTokens).toBe(true);
    expect(status.tokenQuota).toBe(150);
    expect(status.label).toContain('Tokens Open');
  });

  it('accurately detects mandatory lunch recess', () => {
    // Monday 01:45 PM (13:45)
    const lunchTime = new Date('2026-11-02T13:45:00');
    const status = getCurrentIntakeStatus(sampleOffice, lunchTime);

    expect(status.phase).toBe(INTAKE_PHASES.LUNCH_RECESS);
    expect(status.isAcceptingTokens).toBe(false);
    expect(status.label).toContain('Lunch Break (Resumes 14:15)');
  });

  it('reports closed after daily intake concludes', () => {
    // Monday 06:00 PM (18:00)
    const eveningTime = new Date('2026-11-02T18:00:00');
    const status = getCurrentIntakeStatus(sampleOffice, eveningTime);

    expect(status.phase).toBe(INTAKE_PHASES.CLOSED);
    expect(status.label).toBe('Intake Closed for Today');
  });

  it('formats intake minutes properly', () => {
    expect(formatIntakeTimeRemaining(45)).toBe('45m');
    expect(formatIntakeTimeRemaining(75)).toBe('1h 15m');
    expect(formatIntakeTimeRemaining(120)).toBe('2h');
    expect(formatIntakeTimeRemaining(0)).toBe('0m');
  });
});
