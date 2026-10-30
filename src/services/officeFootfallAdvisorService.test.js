import { describe, it, expect } from 'vitest';
import {
  OPERATING_HOURS,
  DAYS_OF_WEEK,
  getHourlyFootfallForecast,
  getRecommendedVisitWindows,
} from './officeFootfallAdvisorService';

describe('officeFootfallAdvisorService', () => {
  it('exposes 9 operational hourly slots and days of the week', () => {
    expect(OPERATING_HOURS.length).toBe(9);
    expect(DAYS_OF_WEEK.length).toBe(6);
  });

  it('computes hourly forecast with congestion levels and estimated wait minutes', () => {
    const office = { name: 'Koramangala Bangalore One Center', type: 'csc' };
    const forecast = getHourlyFootfallForecast(office, 'Wednesday');

    expect(forecast.officeName).toBe('Koramangala Bangalore One Center');
    expect(forecast.dayOfWeek).toBe('Wednesday');
    expect(forecast.hourlyData.length).toBe(9);

    const peak11am = forecast.hourlyData.find((h) => h.hour === '11:00 AM');
    expect(peak11am.congestionLevel).toBe('HIGH');
    expect(peak11am.estimatedWaitMinutes).toBeGreaterThan(15);

    const afternoon2pm = forecast.hourlyData.find((h) => h.hour === '02:00 PM');
    expect(['LOW', 'MODERATE']).toContain(afternoon2pm.congestionLevel);
    expect(afternoon2pm.estimatedWaitMinutes).toBeLessThan(peak11am.estimatedWaitMinutes);
  });

  it('adjusts wait times higher for RTO and Sub-Registrar offices', () => {
    const rto = { name: 'RTO Office Indiranagar', type: 'rto' };
    const csc = { name: 'Kendra Mini Kiosk', type: 'csc' };

    const rtoForecast = getHourlyFootfallForecast(rto, 'Monday');
    const cscForecast = getHourlyFootfallForecast(csc, 'Monday');

    const rtoPeak = rtoForecast.hourlyData.find((h) => h.hour === '11:00 AM');
    const cscPeak = cscForecast.hourlyData.find((h) => h.hour === '11:00 AM');

    expect(rtoPeak.estimatedWaitMinutes).toBeGreaterThan(cscPeak.estimatedWaitMinutes);
  });

  it('provides recommended visit windows and peak alerts', () => {
    const office = { name: 'Passport Seva Kendra' };
    const recommendation = getRecommendedVisitWindows(office, 'Thursday');

    expect(recommendation.bestTimeSlot).toContain('mins');
    expect(recommendation.peakTimeSlot).toContain('mins');
    expect(recommendation.recommendedWindow).toContain('02:00 PM');
    expect(recommendation.tokenAvailabilityNote).toContain('tokens');
  });
});
