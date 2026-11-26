import { describe, it, expect } from 'vitest';
import {
  fetchSlotFeed,
  validateSlotFeedPayload,
  getSupportedOfficeServiceCombos,
} from '../services/slotFeedService';
import { CIVIC_OFFICES } from '../data/locationOffices';
import { MOCK_SERVICES } from '../data/services';

describe('Slot Feed Service', () => {
  describe('validateSlotFeedPayload', () => {
    it('returns empty array for valid payload', () => {
      const validPayload = {
        officeId: 'delhi-rto-sarai-kale-khan',
        serviceId: 'driving-license',
        dates: {
          '2024-01-20': {
            slotCount: 5,
            status: 'available',
            slotDescription: '5 slots available',
            fromLiveFeed: true,
          },
        },
        sourceTimestamp: new Date().toISOString(),
        officialBookingUrl: 'https://example.com',
      };
      const errors = validateSlotFeedPayload(validPayload);
      expect(errors).toEqual([]);
    });

    it('returns error for missing payload', () => {
      const errors = validateSlotFeedPayload(undefined);
      expect(errors.includes('Payload is required')).toBe(true);
    });

    it('rejects empty officeId', () => {
      const errors = validateSlotFeedPayload({
        officeId: '',
        serviceId: 'driving-license',
      });
      expect(errors.includes('officeId must be a non-empty string')).toBe(true);
    });

    it('rejects empty serviceId', () => {
      const errors = validateSlotFeedPayload({
        officeId: 'delhi-rto-sarai-kale-khan',
        serviceId: '',
      });
      expect(errors.includes('serviceId must be a non-empty string')).toBe(true);
    });

    it('rejects unauthorized office+service combo', () => {
      const errors = validateSlotFeedPayload({
        officeId: 'nonexistent-office',
        serviceId: 'nonexistent-service',
      });
      expect(
        errors.some(
          (e) =>
            e.includes('not authorized') || e.includes('not verified')
        )
      ).toBe(true);
    });

    it('rejects invalid date format', () => {
      const errors = validateSlotFeedPayload({
        officeId: 'delhi-rto-sarai-kale-khan',
        serviceId: 'driving-license',
        dates: {
          'invalid-date': {
            slotCount: 5,
            status: 'available',
            slotDescription: 'test',
            fromLiveFeed: true,
          },
        },
        sourceTimestamp: new Date().toISOString(),
        officialBookingUrl: 'https://example.com',
      });
      expect(errors.some((e) => e.includes('Invalid date format'))).toBe(true);
    });

    it('rejects invalid status value', () => {
      const errors = validateSlotFeedPayload({
        officeId: 'delhi-rto-sarai-kale-khan',
        serviceId: 'driving-license',
        dates: {
          '2024-01-20': {
            slotCount: 5,
            status: 'invalid-status',
            slotDescription: 'test',
            fromLiveFeed: true,
          },
        },
        sourceTimestamp: new Date().toISOString(),
        officialBookingUrl: 'https://example.com',
      });
      expect(errors.some((e) => e.includes('Invalid status value'))).toBe(true);
    });

    it('rejects non-numeric slotCount', () => {
      const errors = validateSlotFeedPayload({
        officeId: 'delhi-rto-sarai-kale-khan',
        serviceId: 'driving-license',
        dates: {
          '2024-01-20': {
            slotCount: 'five',
            status: 'available',
            slotDescription: 'test',
            fromLiveFeed: true,
          },
        },
        sourceTimestamp: new Date().toISOString(),
        officialBookingUrl: 'https://example.com',
      });
      expect(errors.some((e) => e.includes('slotCount must be a number or null'))).toBe(true);
    });

    it('accepts valid sourceTimestamp', () => {
      const errors = validateSlotFeedPayload({
        officeId: 'delhi-rto-sarai-kale-khan',
        serviceId: 'driving-license',
        dates: {
          '2024-01-20': {
            slotCount: 5,
            status: 'available',
            slotDescription: 'test',
            fromLiveFeed: true,
          },
        },
        sourceTimestamp: '2024-01-20T10:30:00Z',
        officialBookingUrl: 'https://example.com',
      });
      expect(errors.filter((e) => e.includes('sourceTimestamp')).length).toBe(0);
    });
  });

  describe('getSupportedOfficeServiceCombos', () => {
    it('returns an array of supported combos', () => {
      const combos = getSupportedOfficeServiceCombos();
      expect(Array.isArray(combos)).toBe(true);
      // Should have at least some known combos
      expect(combos.length).toBeGreaterThan(0);
    });

    it('includes Delhi RTO driving license combo', () => {
      const combos = getSupportedOfficeServiceCombos();
      const hasDelhiRTO = combos.some(
        (c) => c.includes('delhi-rto') && c.includes('driving-license')
      );
      expect(hasDelhiRTO).toBe(true);
    });
  });

  describe('fetchSlotFeed', () => {
    it('validates payload structure', () => {
      // Test that validation works
      const validPayload = {
        officeId: 'delhi-rto-sarai-kale-khan',
        serviceId: 'driving-license',
      };
      const errors = validateSlotFeedPayload(validPayload);
      // Should have error about missing dates or unauthorized combo
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});