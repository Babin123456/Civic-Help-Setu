import { describe, it, expect } from 'vitest';
import {
  calculateSlaStatus,
  getServiceSlaDays,
  generateEscalationNoticeDraft,
  getRecommendedEscalationChannel,
  DEFAULT_SLA_DAYS,
} from './grievanceEscalationService';

describe('grievanceEscalationService', () => {
  it('returns default SLA days when service is unknown', () => {
    expect(getServiceSlaDays('')).toBe(DEFAULT_SLA_DAYS);
    expect(getServiceSlaDays('unknown-mystery-service')).toBe(DEFAULT_SLA_DAYS);
  });

  it('matches known civic services to their statutory timelines', () => {
    expect(getServiceSlaDays('income-certificate')).toBe(15);
    expect(getServiceSlaDays('ration-card')).toBe(30);
    expect(getServiceSlaDays('driving-license')).toBe(14);
  });

  it('evaluates on-track application accurately', () => {
    const app = {
      id: 'APP-101',
      serviceName: 'Income Certificate',
      submissionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'In Progress',
    };
    const res = calculateSlaStatus(app);
    expect(res.urgencyLevel).toBe('ON_TRACK');
    expect(res.isOverdue).toBe(false);
    expect(res.remainingDays).toBeGreaterThan(5);
  });

  it('identifies imminent deadlines within 3 days', () => {
    const app = {
      id: 'APP-102',
      serviceName: 'Income Certificate', // 15 days SLA
      submissionDate: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'In Progress',
    };
    const res = calculateSlaStatus(app);
    expect(res.urgencyLevel).toBe('IMMINENT_DEADLINE');
    expect(res.isOverdue).toBe(false);
    expect(res.remainingDays).toBeLessThanOrEqual(3);
  });

  it('flags critical breach when SLA has lapsed', () => {
    const app = {
      id: 'APP-103',
      serviceName: 'Driving License', // 14 days SLA
      submissionDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'Under Verification',
    };
    const res = calculateSlaStatus(app);
    expect(res.urgencyLevel).toBe('CRITICAL_BREACH');
    expect(res.isOverdue).toBe(true);
    expect(res.overdueDays).toBe(6);
  });

  it('marks completed applications as completed without breach alerts', () => {
    const app = {
      id: 'APP-104',
      serviceName: 'Birth Certificate',
      submissionDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'Approved',
    };
    const res = calculateSlaStatus(app);
    expect(res.urgencyLevel).toBe('COMPLETED');
    expect(res.isOverdue).toBe(false);
  });

  it('generates statutory escalation notice with proper reference and acts', () => {
    const app = {
      id: 'DL-998822',
      serviceName: 'Driving License',
      submissionDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'Pending',
    };
    const draft = generateEscalationNoticeDraft(app, { citizenName: 'Aarav Sharma' });
    expect(draft).toContain('DL-998822');
    expect(draft).toContain('Right to Public Services');
    expect(draft).toContain('Aarav Sharma');
    expect(draft).toContain('RELIEF REQUESTED');
  });

  it('recommends central appellate authority for national schemes', () => {
    const central = getRecommendedEscalationChannel('Passport Renewal');
    expect(central.portalName).toContain('CPGRAMS');
    const state = getRecommendedEscalationChannel('Revenue Domicile');
    expect(state.authority).toContain('SDO');
  });
});
