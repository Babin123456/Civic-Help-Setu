import { describe, it, expect } from 'vitest';
import {
  SCHEMA_VERSION,
  CIVIC_ISSUE_CATEGORIES,
  VALID_TIME_WINDOWS,
  PRIVACY_LIMITS,
  validateAnalyticsQuery,
  validateRawCivicReport,
  sanitizeText,
} from './wardAnalyticsContract';

describe('wardAnalyticsContract', () => {
  it('exposes valid schema constants and categories', () => {
    expect(SCHEMA_VERSION).toBe('1.0.0');
    expect(Object.keys(CIVIC_ISSUE_CATEGORIES)).toContain('potholes_roads');
    expect(Object.keys(CIVIC_ISSUE_CATEGORIES)).toContain('water_supply');
    expect(VALID_TIME_WINDOWS).toEqual(['7d', '14d', '30d', '90d']);
    expect(PRIVACY_LIMITS.DEFAULT_EPSILON).toBe(0.5);
    expect(PRIVACY_LIMITS.DEFAULT_SPARSE_THRESHOLD).toBe(5);
  });

  describe('sanitizeText', () => {
    it('strips dangerous characters and trims length', () => {
      const dirty = '  <script>alert("hack")</script>;DROP TABLE; ';
      const cleaned = sanitizeText(dirty, 20);
      expect(cleaned).not.toContain('<');
      expect(cleaned).not.toContain('>');
      expect(cleaned).not.toContain(';');
      expect(cleaned.length).toBeLessThanOrEqual(20);
    });

    it('handles non-string inputs safely', () => {
      expect(sanitizeText(null)).toBe('');
      expect(sanitizeText(undefined)).toBe('');
      expect(sanitizeText(12345)).toBe('');
    });
  });

  describe('validateAnalyticsQuery', () => {
    it('accepts valid empty or standard query params', () => {
      const res1 = validateAnalyticsQuery({});
      expect(res1.valid).toBe(true);
      expect(res1.errors).toHaveLength(0);

      const res2 = validateAnalyticsQuery({
        wardId: 'WARD-104',
        category: 'potholes_roads',
        timeWindow: '14d',
        epsilon: 0.8,
        sparseThreshold: 5,
      });
      expect(res2.valid).toBe(true);
      expect(res2.errors).toHaveLength(0);
    });

    it('rejects invalid time window', () => {
      const res = validateAnalyticsQuery({ timeWindow: '365d' });
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('timeWindow must be one of');
    });

    it('rejects out-of-bounds epsilon', () => {
      const resTooLow = validateAnalyticsQuery({ epsilon: 0.05 });
      expect(resTooLow.valid).toBe(false);
      expect(resTooLow.errors[0]).toContain('epsilon must be a number between');

      const resTooHigh = validateAnalyticsQuery({ epsilon: 5.0 });
      expect(resTooHigh.valid).toBe(false);

      const resNaN = validateAnalyticsQuery({ epsilon: 'not-a-number' });
      expect(resNaN.valid).toBe(false);
    });

    it('rejects out-of-bounds sparse threshold', () => {
      const resLow = validateAnalyticsQuery({ sparseThreshold: 1 });
      expect(resLow.valid).toBe(false);
      expect(resLow.errors[0]).toContain('sparseThreshold must be an integer');

      const resHigh = validateAnalyticsQuery({ sparseThreshold: 50 });
      expect(resHigh.valid).toBe(false);
    });

    it('rejects malformed wardId', () => {
      const res = validateAnalyticsQuery({ wardId: 'WARD-;;-DROP' });
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('wardId must be a valid identifier');
    });
  });

  describe('validateRawCivicReport', () => {
    it('accepts a valid civic report', () => {
      const validRecord = {
        id: 'CR-101-001',
        wardId: 'WARD-101',
        category: 'sanitation_garbage',
        timestamp: new Date().toISOString(),
      };
      const res = validateRawCivicReport(validRecord);
      expect(res.valid).toBe(true);
    });

    it('rejects invalid or missing attributes', () => {
      const res = validateRawCivicReport({
        id: '',
        wardId: 'WARD-101',
        category: 'invalid_cat',
        timestamp: 'invalid-date',
      });
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});
