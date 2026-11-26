import { describe, it, expect, beforeEach } from 'vitest';
import { RtiAppealPlannerService } from './rtiAppealPlannerService.js';
import { RTI_EVENT_TYPES } from '../data/rtiStatutoryTimelineData.js';

describe('RtiAppealPlannerService', () => {
  let planner;

  beforeEach(() => {
    planner = new RtiAppealPlannerService();
  });

  it('calculates standard 30-day PIO deadline and First Appeal limitation period', () => {
    const dates = planner.calculateFilingDeadlines('2026-01-01');

    expect(dates.filingDate).toBe('2026-01-01');
    expect(dates.statutoryPioDeadline).toBe('2026-01-31');
    expect(dates.deemedRefusalDate).toBe('2026-01-31');
    expect(dates.firstAppealLimitationDeadline).toBe('2026-03-02'); // 30 days after Jan 31
    expect(dates.citations.length).toBeGreaterThanOrEqual(3);
  });

  it('handles 48-hour life and liberty accelerated timeline', () => {
    const dates = planner.calculateFilingDeadlines('2026-01-01T10:00:00Z', { isLifeAndLiberty: true });
    expect(dates.isLifeAndLiberty).toBe(true);
    expect(dates.statutoryPioDeadline).toBe('2026-01-03');
  });

  it('plans next procedural steps for deemed refusal under Section 7(2)', () => {
    const plan = planner.planNextStep({
      eventType: RTI_EVENT_TYPES.NO_RESPONSE_DEEMED_REFUSAL
    });

    expect(plan.currentStatus).toContain('Deemed Refusal');
    expect(plan.actionRequired).toContain('Section 19(1)');
    expect(plan.freeOfCostBenefit).toContain('Section 7(6)');
    expect(plan.checklist.length).toBeGreaterThanOrEqual(3);
  });

  it('plans next step for transfer under Section 6(3)', () => {
    const plan = planner.planNextStep({
      eventType: RTI_EVENT_TYPES.APPLICATION_TRANSFERRED
    });

    expect(plan.currentStatus).toContain('Section 6(3)');
    expect(plan.statutoryRule).toContain('5 days');
  });

  it('generates a chronological table and appeal attachments summary', () => {
    const events = [
      { date: '2026-01-10', title: 'RTI Filed', description: 'Filed online with BBMP Town Planning' },
      { date: '2026-01-15', title: 'Transferred', description: 'Transferred under 6(3) to Assistant Executive Engineer' }
    ];

    const result = planner.generateAppealChronology(events);
    expect(result.totalMilestones).toBe(2);
    expect(result.chronologyText).toContain('RTI Filed');
    expect(result.mandatoryAttachments.length).toBeGreaterThanOrEqual(3);
    expect(result.disclaimer).toContain('informational');
  });
});
