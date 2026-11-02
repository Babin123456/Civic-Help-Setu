import { describe, it, expect } from 'vitest';
import {
  parseOfficialTimeline,
  isWeekend,
  getGazettedHoliday,
  addWorkingDays,
  inferDeliveryChannel,
  calculateServiceSlaForecast,
  DELIVERY_CHANNELS,
} from './serviceSlaReliabilityService.js';

describe('serviceSlaReliabilityService (#431)', () => {
  describe('parseOfficialTimeline', () => {
    it('parses day ranges like "15 to 30 days"', () => {
      const res = parseOfficialTimeline('15 to 30 days');
      expect(res.minDays).toBe(15);
      expect(res.maxDays).toBe(30);
    });

    it('identifies working days indicator', () => {
      const res = parseOfficialTimeline('7 to 10 working days');
      expect(res.minDays).toBe(7);
      expect(res.maxDays).toBe(10);
      expect(res.isWorkingDays).toBe(true);
    });

    it('parses weeks and converts to days', () => {
      const res = parseOfficialTimeline('2 to 4 weeks');
      expect(res.minDays).toBe(14);
      expect(res.maxDays).toBe(28);
    });

    it('handles immediate or same-day processing', () => {
      const res = parseOfficialTimeline('Instant download / Same day');
      expect(res.minDays).toBe(0);
      expect(res.maxDays).toBe(1);
    });

    it('handles raw number input', () => {
      const res = parseOfficialTimeline(21);
      expect(res.minDays).toBe(21);
      expect(res.maxDays).toBe(21);
    });

    it('falls back to standard duration for empty input', () => {
      const res = parseOfficialTimeline('');
      expect(res.minDays).toBe(15);
      expect(res.maxDays).toBe(30);
    });
  });

  describe('isWeekend & getGazettedHoliday', () => {
    it('identifies Saturdays and Sundays as weekends', () => {
      // 2026-11-07 is Saturday, 2026-11-08 is Sunday, 2026-11-09 is Monday
      const sat = new Date(2026, 10, 7);
      const sun = new Date(2026, 10, 8);
      const mon = new Date(2026, 10, 9);

      expect(isWeekend(sat)).toBe(true);
      expect(isWeekend(sun)).toBe(true);
      expect(isWeekend(mon)).toBe(false);
    });

    it('identifies national holidays like Republic Day and Independence Day', () => {
      const repDay = new Date(2026, 0, 26);
      const indDay = new Date(2026, 7, 15);
      const normalDay = new Date(2026, 4, 10);

      expect(getGazettedHoliday(repDay)).not.toBeNull();
      expect(getGazettedHoliday(repDay)?.name).toBe('Republic Day');
      expect(getGazettedHoliday(indDay)?.name).toBe('Independence Day');
      expect(getGazettedHoliday(normalDay)).toBeNull();
    });
  });

  describe('addWorkingDays', () => {
    it('skips weekends properly', () => {
      // Start on Friday 2026-11-06
      const friday = new Date(2026, 10, 6);
      // Adding 1 working day should jump to Monday 2026-11-09
      const result = addWorkingDays(friday, 1);
      expect(result.targetDate.getDay()).toBe(1); // Monday
      expect(result.weekendsSkipped).toBe(2); // Sat + Sun
    });

    it('skips gazetted public holidays falling on weekdays', () => {
      // 2026-10-01 is Thursday. Gandhi Jayanti is Oct 2 (Friday).
      const thurs = new Date(2026, 9, 1);
      // Adding 1 working day should skip Friday Oct 2 and jump across weekend to Monday Oct 5
      const result = addWorkingDays(thurs, 1);
      expect(result.holidaysSkipped.length).toBe(1);
      expect(result.holidaysSkipped[0].name).toBe('Gandhi Jayanti');
      expect(result.targetDate.getDate()).toBe(5);
    });
  });

  describe('inferDeliveryChannel', () => {
    it('infers postal delivery for physical cards and passports', () => {
      expect(inferDeliveryChannel({ name: 'Passport Renewal' })).toBe(DELIVERY_CHANNELS.POSTAL);
      expect(inferDeliveryChannel({ name: 'Driving License Issue' })).toBe(DELIVERY_CHANNELS.POSTAL);
      expect(inferDeliveryChannel({ name: 'New PAN Card' })).toBe(DELIVERY_CHANNELS.POSTAL);
    });

    it('infers digital delivery for certificates and digital schemes', () => {
      expect(inferDeliveryChannel({ name: 'Income Certificate' })).toBe(DELIVERY_CHANNELS.DIGITAL);
      expect(inferDeliveryChannel({ name: 'PM-Kisan Registration' })).toBe(DELIVERY_CHANNELS.DIGITAL);
    });
  });

  describe('calculateServiceSlaForecast', () => {
    it('produces a comprehensive delivery forecast', () => {
      const service = {
        id: 'income-certificate',
        name: 'Income Certificate',
        timeRequired: '15 to 21 working days',
      };
      const submissionDate = new Date(2026, 10, 2); // Monday Nov 2, 2026

      const forecast = calculateServiceSlaForecast({ service, submissionDate });
      expect(forecast.submissionDateIso).toBe('2026-11-02');
      expect(forecast.minWorkingDays).toBe(15);
      expect(forecast.maxWorkingDays).toBe(21);
      expect(forecast.expectedCompletionMinIso).toBeDefined();
      expect(forecast.expectedCompletionMaxIso).toBeDefined();
      expect(forecast.appellateEscalationDateIso).toBeDefined();
      expect(forecast.deliveryChannel).toBe(DELIVERY_CHANNELS.DIGITAL);
      expect(forecast.confidenceScore).toBeGreaterThanOrEqual(80);
      expect(forecast.confidenceRating).toBe('High');
    });

    it('factors postal transit buffer into physical services', () => {
      const service = {
        id: 'passport',
        name: 'Passport Re-issue',
        timeRequired: '10 to 15 days',
      };
      const forecast = calculateServiceSlaForecast({ service });
      expect(forecast.deliveryChannel).toBe(DELIVERY_CHANNELS.POSTAL);
      expect(forecast.transitBufferDays).toBeGreaterThan(0);
    });

    it('gracefully handles missing or malformed dates', () => {
      const forecast = calculateServiceSlaForecast({ service: null, submissionDate: 'invalid-date' });
      expect(forecast.submissionDateIso).toBeDefined();
      expect(forecast.expectedCompletionMaxIso).toBeDefined();
    });
  });
});
