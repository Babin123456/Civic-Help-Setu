/**
 * src/services/waterQualityValidation.test.js
 * Unit tests for input validation, sanitization, and PII protection (#754).
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  detectProhibitedPII,
  validateWaterPointPayload,
  validateSamplingEventPayload,
  validateLabResultPayload,
  validateCorrectionPayload,
  validateCorrectiveActionPayload,
} from './waterQualityValidation.js';

describe('Water Quality Validation & PII Detection (#754)', () => {
  describe('Sanitization & Anti-PII Screening', () => {
    it('sanitizes HTML tags and control characters', () => {
      const malicious = '<script>alert("hack")</script><b>Public Tap</b>\u0000';
      const clean = sanitizeString(malicious);
      expect(clean).toBe('alert("hack")Public Tap');
      expect(clean).not.toContain('<script>');
    });

    it('detects Aadhaar 12-digit number pattern', () => {
      const text = 'Collected near house of resident 5482 9182 3910 for testing';
      const pii = detectProhibitedPII(text);
      expect(pii).toContain('Aadhaar');
    });

    it('detects Indian mobile phone numbers', () => {
      const text = 'Call field technician on +91 9845012345 after taking sample';
      const pii = detectProhibitedPII(text);
      expect(pii).toContain('phone number');
    });

    it('detects residential flat or door numbers', () => {
      const text = 'Tap installed right outside Flat No. 402, Sunshine Apartments';
      const pii = detectProhibitedPII(text);
      expect(pii).toContain('residential flat or door number');
    });

    it('allows clean public landmark text without PII', () => {
      const text = 'Near Government Primary Health Centre, Main Bus Stop';
      const pii = detectProhibitedPII(text);
      expect(pii).toBeNull();
    });
  });

  describe('Water Point Payload Validation', () => {
    it('rejects payloads with missing name or invalid type', () => {
      const errors = validateWaterPointPayload({
        name: '',
        pointType: 'invalid_type',
        ward: 'Ward 10',
        city: 'Bengaluru',
      });
      expect(errors.length).toBeGreaterThanOrEqual(2);
      expect(errors.some((e) => e.includes('name'))).toBe(true);
      expect(errors.some((e) => e.includes('Invalid water point type'))).toBe(true);
    });

    it('rejects payloads containing PII in landmark', () => {
      const errors = validateWaterPointPayload({
        name: 'Public Tap Standpost',
        pointType: 'public_standpost',
        ward: 'Ward 150',
        city: 'Bengaluru',
        landmark: 'Door no. 12-A, resident phone 9845012345',
      });
      expect(errors.some((e) => e.includes('Landmark:'))).toBe(true);
    });

    it('accepts valid water point payload', () => {
      const errors = validateWaterPointPayload({
        name: 'Community Standpost Tap',
        pointType: 'public_standpost',
        ward: 'Ward 150 - Bellandur',
        city: 'Bengaluru',
        landmark: 'Near Government School Main Gate',
        operationalStatus: 'active',
      });
      expect(errors.length).toBe(0);
    });
  });

  describe('Sampling Event Payload Validation', () => {
    it('requires sealedContainerCode and valid collectionDate', () => {
      const errors = validateSamplingEventPayload({
        waterPointId: 'WP-01',
        sampleType: 'routine_surveillance',
        collectionDate: '',
        sealedContainerCode: '',
      });
      expect(errors.some((e) => e.includes('collection date'))).toBe(true);
      expect(errors.some((e) => e.includes('Sealed container bar code'))).toBe(true);
    });

    it('rejects future collection dates', () => {
      const futureDate = new Date(Date.now() + 5 * 86400000).toISOString();
      const errors = validateSamplingEventPayload({
        waterPointId: 'WP-01',
        sampleType: 'routine_surveillance',
        collectionDate: futureDate,
        sealedContainerCode: 'SEAL-99',
      });
      expect(errors.some((e) => e.includes('cannot be in the future'))).toBe(true);
    });
  });

  describe('Lab Results & Correction Payload Validation', () => {
    it('validates parameter results array and positive numbers', () => {
      const errors = validateLabResultPayload({
        sampleEventId: 'SMP-01',
        labId: 'LAB-01',
        results: [
          { parameterCode: 'ph', testedValue: -5 },
          { parameterCode: 'unknown_code', testedValue: 10 },
        ],
      });
      expect(errors.some((e) => e.includes('non-negative number'))).toBe(true);
      expect(errors.some((e) => e.includes('unsupported parameter code'))).toBe(true);
    });

    it('requires substantive reason for official result corrections', () => {
      const errors = validateCorrectionPayload({
        sampleEventId: 'SMP-01',
        correctionReason: 'Typo', // Too short (< 15 chars)
        correctedResults: [{ parameterCode: 'ph', testedValue: 7.2 }],
      });
      expect(errors.some((e) => e.includes('substantive correction reason'))).toBe(true);
    });

    it('validates corrective action payload requiring substantive description', () => {
      const errors = validateCorrectiveActionPayload({
        waterPointId: 'WP-01',
        actionType: 'chlorination_shock',
        description: 'Fix tap', // Too short (< 15 chars)
      });
      expect(errors.some((e) => e.includes('Action description must be at least 15 characters'))).toBe(true);
    });
  });
});
