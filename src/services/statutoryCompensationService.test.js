import { describe, it, expect } from 'vitest';
import {
  calculateStatutoryCompensation,
  generateCompensationPetition,
  STATUTORY_COMPENSATION_DEFAULTS
} from './statutoryCompensationService';

describe('statutoryCompensationService', () => {
  it('handles null or missing application gracefully', () => {
    const result = calculateStatutoryCompensation(null);
    expect(result.isEligible).toBe(false);
    expect(result.claimAmount).toBe(0);
    expect(result.status).toBe('NOT_ELIGIBLE');
  });

  it('evaluates application within SLA as not eligible for delay compensation', () => {
    const app = {
      id: 'APP-101',
      serviceId: 'income-certificate',
      submissionDate: new Date().toISOString()
    };

    const result = calculateStatutoryCompensation(app);
    expect(result.isEligible).toBe(false);
    expect(result.claimAmount).toBe(0);
    expect(result.status).toBe('WITHIN_SLA');
  });

  it('calculates compensation accurately for breached SLA applications', () => {
    // 30 days ago for income certificate (statutory limit is 15 business days)
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30);

    const app = {
      id: 'APP-102',
      serviceId: 'income-certificate',
      submissionDate: pastDate.toISOString()
    };

    const result = calculateStatutoryCompensation(app);
    expect(result.isEligible).toBe(true);
    expect(result.delayedDays).toBeGreaterThan(0);
    expect(result.claimAmount).toBe(result.delayedDays * STATUTORY_COMPENSATION_DEFAULTS.dailyRate);
    expect(result.status).toBe('ELIGIBLE');
  });

  it('enforces maximum statutory compensation cap', () => {
    // 180 days ago produces large delay exceeding ₹5,000 maxCap
    const longPastDate = new Date();
    longPastDate.setDate(longPastDate.getDate() - 180);

    const app = {
      id: 'APP-103',
      serviceId: 'income-certificate',
      submissionDate: longPastDate.toISOString()
    };

    const result = calculateStatutoryCompensation(app);
    expect(result.isEligible).toBe(true);
    expect(result.rawAmount).toBeGreaterThan(5000);
    expect(result.claimAmount).toBe(5000);
    expect(result.isCapped).toBe(true);
  });

  it('respects custom overrides for daily rate and max cap', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30);

    const app = {
      id: 'APP-104',
      serviceId: 'income-certificate',
      submissionDate: pastDate.toISOString()
    };

    const result = calculateStatutoryCompensation(app, {
      dailyRate: 500,
      maxCap: 3000
    });

    expect(result.dailyRate).toBe(500);
    expect(result.maxCap).toBe(3000);
    expect(result.claimAmount).toBeLessThanOrEqual(3000);
  });

  it('generates a comprehensive legal compensation petition in markdown', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30);

    const app = {
      id: 'APP-2026-X99',
      serviceName: 'Income Certificate',
      serviceId: 'income-certificate',
      submissionDate: pastDate.toISOString(),
      appliedDate: '2026-09-01'
    };

    const citizen = {
      name: 'Ramesh Sharma',
      phone: '+91 9876543210',
      address: 'Plot 42, Civil Lines, Pune, Maharashtra'
    };

    const petition = generateCompensationPetition(app, citizen, {
      bankAccount: 'HDFC Bank - A/C 5010029384756 (IFSC: HDFC0001234)'
    });

    expect(petition).toContain('# PETITION FOR STATUTORY DELAY COMPENSATION');
    expect(petition).toContain('Ramesh Sharma');
    expect(petition).toContain('APP-2026-X99');
    expect(petition).toContain('Income Certificate');
    expect(petition).toContain('HDFC Bank');
    expect(petition).toContain('Net Entitlement Claimed:');
    expect(petition).toContain('VERIFICATION & DECLARATION');
  });
});
