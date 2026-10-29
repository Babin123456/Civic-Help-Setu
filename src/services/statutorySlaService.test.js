import { describe, it, expect } from 'vitest';
import {
  calculateBusinessDays,
  evaluateApplicationSla,
  generateFirstAppealNotice,
  getAppellateEscalationHierarchy,
  evaluateEscalationLadder,
} from './statutorySlaService';

describe('statutorySlaService - Business Days & Breach Detection', () => {
  it('calculates business days excluding weekends', () => {
    // 2026-06-01 is Monday, 2026-06-07 is Sunday (5 business days)
    const start = '2026-06-01';
    const end = '2026-06-07';
    expect(calculateBusinessDays(start, end)).toBe(5);
  });

  it('detects SLA_BREACHED when elapsed days exceed statutory limit', () => {
    // 40 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 40);

    const app = {
      id: 'APP-1001',
      serviceId: 'income-certificate',
      submissionDate: pastDate.toISOString()
    };

    const res = evaluateApplicationSla(app);
    expect(res.status).toBe('SLA_BREACHED');
    expect(res.overdueDays).toBeGreaterThan(0);
    expect(res.firstAppellateAuthority).toContain('Sub-Divisional Magistrate');
  });

  it('detects WITHIN_SLA for freshly submitted application', () => {
    const app = {
      id: 'APP-1002',
      serviceId: 'driving-license',
      submissionDate: new Date().toISOString()
    };

    const res = evaluateApplicationSla(app);
    expect(res.status).toBe('WITHIN_SLA');
    expect(res.overdueDays).toBe(0);
    expect(res.daysRemaining).toBeGreaterThanOrEqual(13);
  });

  it('generates well-formatted legal appeal petition', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 25);

    const app = {
      id: 'APP-1003',
      serviceId: 'income-certificate',
      submissionDate: pastDate.toISOString()
    };

    const notice = generateFirstAppealNotice(app, 'Sunita Devi');
    expect(notice).toContain('FIRST APPEAL PETITION');
    expect(notice).toContain('Sunita Devi');
    expect(notice).toContain('APP-1003');
    expect(notice).toContain('Sub-Divisional Magistrate');
  });

  describe('Appellate Hierarchy & Escalation Ladder', () => {
    it('returns standard 3-tier hierarchy for ration-card', () => {
      const hierarchy = getAppellateEscalationHierarchy('ration-card');
      expect(hierarchy).toHaveLength(3);
      expect(hierarchy[0].tier).toBe(1);
      expect(hierarchy[1].tier).toBe(2);
      expect(hierarchy[1].authority).toContain('District Supply Officer');
      expect(hierarchy[2].tier).toBe(3);
      expect(hierarchy[2].authority).toContain('State Food & Civil Supplies Director');
    });

    it('evaluates active escalation tier based on overdue delay', () => {
      // 50 business days ago on a 15-day SLA service
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 75);

      const app = {
        id: 'APP-OVERDUE-50',
        serviceId: 'income-certificate',
        submissionDate: pastDate.toISOString()
      };

      const res = evaluateEscalationLadder(app);
      expect(res.status).toBe('SLA_BREACHED');
      expect(res.activeTier).toBe(3);
      expect(res.tierStatus).toBe('ELIGIBLE_FOR_SECOND_APPEAL');
      expect(res.ladder).toHaveLength(3);
    });

    it('stays on Tier 1 when application is within statutory limits', () => {
      const app = {
        id: 'APP-NEW',
        serviceId: 'caste-certificate',
        submissionDate: new Date().toISOString()
      };

      const res = evaluateEscalationLadder(app);
      expect(res.status).toBe('WITHIN_SLA');
      expect(res.activeTier).toBe(1);
      expect(res.tierStatus).toBe('WITHIN_TIER_1');
    });
  });
});
