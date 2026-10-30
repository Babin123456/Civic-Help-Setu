import { describe, it, expect } from 'vitest';
import {
  STATUTORY_CURE_WINDOW_DAYS,
  OBJECTION_CATEGORIES,
  calculateCureTimeline,
  generateRectificationNoticeDraft,
} from './deficiencyCureService';

describe('deficiencyCureService', () => {
  it('exposes statutory cure window of 15 days and objection categories', () => {
    expect(STATUTORY_CURE_WINDOW_DAYS).toBe(15);
    expect(OBJECTION_CATEGORIES.length).toBeGreaterThanOrEqual(5);
    const ids = OBJECTION_CATEGORIES.map((c) => c.id);
    expect(ids).toContain('DOCUMENT_ILLEGIBLE');
    expect(ids).toContain('NAME_MISMATCH');
    expect(ids).toContain('EXPIRED_PROOF');
  });

  it('calculates remaining days and urgency status correctly for recent objection', () => {
    const app = {
      id: 'APP-101',
      serviceName: 'Caste Certificate',
      actionRequiredDate: new Date().toISOString().slice(0, 10),
    };
    const timeline = calculateCureTimeline(app);
    expect(timeline.statutoryWindowDays).toBe(15);
    expect(timeline.daysRemaining).toBe(15);
    expect(timeline.isExpired).toBe(false);
    expect(timeline.urgencyLevel).toBe('NORMAL');
  });

  it('detects high urgency when deadline is nearing', () => {
    const tenDaysAgo = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const app = {
      id: 'APP-102',
      serviceName: 'Income Certificate',
      actionRequiredDate: tenDaysAgo,
    };
    const timeline = calculateCureTimeline(app);
    expect(timeline.daysRemaining).toBeLessThanOrEqual(3);
    expect(['HIGH_URGENCY', 'CRITICAL_EXPIRED']).toContain(timeline.urgencyLevel);
  });

  it('generates formal statutory rectification draft with citizen details and enclosures', () => {
    const app = {
      id: 'APP-999',
      serviceName: 'Ration Card Member Addition',
      actionRequiredDate: '2026-10-20',
    };
    const draft = generateRectificationNoticeDraft(app, {
      citizenName: 'Meera Deshmukh',
      objectionId: 'DOCUMENT_ILLEGIBLE',
      explanation: 'Scanned original birth certificate at 300 DPI.',
      rectifiedDocuments: ['Fresh High-Resolution Birth Certificate.pdf', 'Affidavit.pdf'],
    });

    expect(draft).toContain('STATUTORY COMPLIANCE & DEFICIENCY RECTIFICATION NOTICE');
    expect(draft).toContain('APP-999');
    expect(draft).toContain('Ration Card Member Addition');
    expect(draft).toContain('Illegible / Blurry Document Upload');
    expect(draft).toContain('Scanned original birth certificate at 300 DPI');
    expect(draft).toContain('Fresh High-Resolution Birth Certificate.pdf');
    expect(draft).toContain('Meera Deshmukh');
  });
});
