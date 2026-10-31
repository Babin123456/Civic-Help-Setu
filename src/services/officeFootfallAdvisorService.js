/**
 * Facilitation Center Peak Hours & Queue Wait Time Advisory Service.
 *
 * Provides civic office congestion analysis, hourly footfall curves,
 * estimated counter queue wait times, and recommended low-wait visit slots.
 */

export const OPERATING_HOURS = [
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '01:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
];

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Base hourly traffic distribution factor (0.0 to 1.0)
 * Civic offices typically experience peak rush before lunch (10am-1pm) and lighter afternoons.
 */
const BASE_HOURLY_CURVE = [
  0.4,  // 09:00 AM (opening, early queue)
  0.85, // 10:00 AM (peak morning rush)
  0.95, // 11:00 AM (highest congestion)
  0.75, // 12:00 PM (moderately busy)
  0.45, // 01:00 PM (lunch transition)
  0.35, // 02:00 PM (lowest wait period)
  0.4,  // 03:00 PM (steady low traffic)
  0.65, // 04:00 PM (late afternoon rush before cutoff)
  0.3,  // 05:00 PM (closing / collection only)
];

const DAY_MULTIPLIERS = {
  Monday: 1.2,    // Monday post-weekend surge
  Tuesday: 0.95,
  Wednesday: 0.9, // Wednesday mid-week lowest
  Thursday: 0.95,
  Friday: 1.15,   // Friday pre-weekend surge
  Saturday: 1.25, // Saturday public holiday rush
};

/**
 * Returns hourly footfall projections and estimated wait times (in minutes) for an office.
 */
export function getHourlyFootfallForecast(office = {}, dayOfWeek = 'Wednesday') {
  const officeName = office.name || 'Civic Center';
  const category = (office.type || office.channel || office.category || '').toLowerCase();

  // Higher base wait for RTO and Sub-Registrar compared to CSC / Kendra
  let baseWaitMinutes = 35;
  if (category.includes('rto') || category.includes('transport') || category.includes('sub-registrar')) {
    baseWaitMinutes = 55;
  } else if (category.includes('aadhaar') || category.includes('passport')) {
    baseWaitMinutes = 45;
  } else if (category.includes('csc') || category.includes('kendra')) {
    baseWaitMinutes = 25;
  }

  const dayFactor = DAY_MULTIPLIERS[dayOfWeek] || 1.0;

  const hourlyData = OPERATING_HOURS.map((hour, idx) => {
    const intensity = Math.min(1.0, BASE_HOURLY_CURVE[idx] * dayFactor);
    const estimatedWaitMinutes = Math.round(baseWaitMinutes * intensity);

    let congestionLevel = 'LOW';
    if (intensity >= 0.8) {
      congestionLevel = 'HIGH';
    } else if (intensity >= 0.5) {
      congestionLevel = 'MODERATE';
    }

    return {
      hour,
      intensityPercent: Math.round(intensity * 100),
      estimatedWaitMinutes,
      congestionLevel,
    };
  });

  return {
    officeName,
    dayOfWeek,
    hourlyData,
  };
}

/**
 * Recommends optimal low-wait visit slots.
 */
export function getRecommendedVisitWindows(office = {}, dayOfWeek = 'Wednesday') {
  const forecast = getHourlyFootfallForecast(office, dayOfWeek);
  const slots = forecast.hourlyData;

  // Find slot with lowest wait time
  const lowestSlot = [...slots].sort((a, b) => a.estimatedWaitMinutes - b.estimatedWaitMinutes)[0];
  const peakSlot = [...slots].sort((a, b) => b.estimatedWaitMinutes - a.estimatedWaitMinutes)[0];

  return {
    bestTimeSlot: `${lowestSlot.hour} (Est. wait: ~${lowestSlot.estimatedWaitMinutes} mins)`,
    peakTimeSlot: `${peakSlot.hour} (Est. wait: ~${peakSlot.estimatedWaitMinutes} mins)`,
    recommendedWindow: '02:00 PM - 03:30 PM (Post-lunch lull period)',
    tokenAvailabilityNote: 'Daily walk-in intake tokens are typically exhausted by 11:30 AM on high-rush days. Prioritize early arrival or online token pre-booking.',
  };
}
