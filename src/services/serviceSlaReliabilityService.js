/**
 * Service Turnaround (SLA) & Delivery Reliability Forecaster Service (#431)
 *
 * Provides realistic turnaround estimations for citizen services by analyzing
 * official service timelines, working days calendars (excluding weekends and
 * gazetted national holidays), delivery channel buffers (digital vs physical postal dispatch),
 * and statutory Right to Public Service (RPS) escalation deadlines.
 */

/**
 * Standard gazetted public holidays (recurring day/month format).
 * State-specific holidays are adjusted as additional buffer days.
 */
export const GAZETTED_HOLIDAYS_CATALOGUE = Object.freeze([
  { month: 1, day: 26, name: 'Republic Day' },
  { month: 8, day: 15, name: 'Independence Day' },
  { month: 10, day: 2, name: 'Gandhi Jayanti' },
  { month: 11, day: 1, name: 'Diwali (Deepavali)' },
  { month: 12, day: 25, name: 'Christmas Day' },
]);

/**
 * Delivery channels recognized for citizen service fulfillment.
 */
export const DELIVERY_CHANNELS = Object.freeze({
  DIGITAL: 'digital',
  POSTAL: 'postal',
  IN_PERSON: 'in_person',
});

/**
 * Metadata for delivery channels.
 */
export const DELIVERY_CHANNEL_CONFIG = Object.freeze({
  [DELIVERY_CHANNELS.DIGITAL]: {
    label: 'Digital Download / DigiLocker',
    transitBufferDays: 0,
    baseConfidence: 94,
    description: 'Instant or portal-based download once certified by officer.',
  },
  [DELIVERY_CHANNELS.POSTAL]: {
    label: 'Speed Post / Registered Dispatch',
    transitBufferDays: 4,
    baseConfidence: 86,
    description: 'Physical certificate or smart-card mailed via postal service.',
  },
  [DELIVERY_CHANNELS.IN_PERSON]: {
    label: 'In-Person Counter Collection',
    transitBufferDays: 1,
    baseConfidence: 89,
    description: 'Collection from municipal desk or center following SMS notification.',
  },
});

/**
 * Infer delivery channel based on service keywords.
 * @param {Object} service
 * @returns {'digital'|'postal'|'in_person'}
 */
export function inferDeliveryChannel(service) {
  if (!service) return DELIVERY_CHANNELS.DIGITAL;
  const text = `${service.name || ''} ${service.description || ''} ${service.category || ''}`.toLowerCase();

  if (text.includes('passport') || text.includes('driving license') || text.includes('pan card') || text.includes('voter id')) {
    return DELIVERY_CHANNELS.POSTAL;
  }
  if (text.includes('counter') || text.includes('in-person') || text.includes('office visit')) {
    return DELIVERY_CHANNELS.IN_PERSON;
  }
  return DELIVERY_CHANNELS.DIGITAL;
}

/**
 * Format a Date object into a local timezone-safe YYYY-MM-DD string.
 * @param {Date} date
 * @returns {string}
 */
export function toLocalIsoDate(date) {
  if (!date || isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses official turnaround text into minimum and maximum working or calendar days.
 * @param {string|number} rawTimeline
 * @returns {{ minDays: number, maxDays: number, isWorkingDays: boolean }}
 */
export function parseOfficialTimeline(rawTimeline) {
  if (typeof rawTimeline === 'number' && Number.isFinite(rawTimeline)) {
    const days = Math.max(1, Math.round(rawTimeline));
    return { minDays: days, maxDays: days, isWorkingDays: true };
  }

  const str = String(rawTimeline || '').toLowerCase().trim();
  if (!str) {
    return { minDays: 15, maxDays: 30, isWorkingDays: true };
  }

  const isWorkingDays = str.includes('working') || str.includes('business');

  // Check for immediate or same day
  if (str.includes('immediate') || str.includes('instant') || str.includes('same day')) {
    return { minDays: 0, maxDays: 1, isWorkingDays: true };
  }

  // Check for range like "7 to 10 days" or "15-30 days"
  const rangeMatch = str.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*(day|week|month)?/);
  if (rangeMatch) {
    let min = parseInt(rangeMatch[1], 10);
    let max = parseInt(rangeMatch[2], 10);
    const unit = rangeMatch[3] || 'day';

    if (unit.startsWith('week')) {
      min *= 7;
      max *= 7;
    } else if (unit.startsWith('month')) {
      min *= 30;
      max *= 30;
    }

    return { minDays: Math.min(min, max), maxDays: Math.max(min, max), isWorkingDays };
  }

  // Check for single number like "15 days" or "4 weeks"
  const singleMatch = str.match(/(\d+)\s*(day|week|month)?/);
  if (singleMatch) {
    let days = parseInt(singleMatch[1], 10);
    const unit = singleMatch[2] || 'day';

    if (unit.startsWith('week')) {
      days *= 7;
    } else if (unit.startsWith('month')) {
      days *= 30;
    }

    return { minDays: days, maxDays: days, isWorkingDays };
  }

  return { minDays: 15, maxDays: 30, isWorkingDays: true };
}

/**
 * Checks if a date falls on a weekend (Saturday or Sunday).
 * @param {Date} date
 * @returns {boolean}
 */
export function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Checks if a date falls on a recognized gazetted holiday.
 * @param {Date} date
 * @returns {Object|null} Matching holiday or null
 */
export function getGazettedHoliday(date) {
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();
  return GAZETTED_HOLIDAYS_CATALOGUE.find((h) => h.month === month && h.day === day) || null;
}

/**
 * Adds business working days to a starting date, skipping weekends and gazetted holidays.
 * @param {Date} startDate
 * @param {number} workingDaysCount
 * @returns {{ targetDate: Date, weekendsSkipped: number, holidaysSkipped: Array<{ name: string, date: string }> }}
 */
export function addWorkingDays(startDate, workingDaysCount) {
  const current = new Date(startDate.getTime());
  let added = 0;
  let weekendsSkipped = 0;
  const holidaysSkipped = [];

  while (added < workingDaysCount) {
    current.setDate(current.getDate() + 1);

    if (isWeekend(current)) {
      weekendsSkipped += 1;
      continue;
    }

    const holiday = getGazettedHoliday(current);
    if (holiday) {
      holidaysSkipped.push({
        name: holiday.name,
        date: toLocalIsoDate(current),
      });
      continue;
    }

    added += 1;
  }

  return { targetDate: current, weekendsSkipped, holidaysSkipped };
}

/**
 * Main forecast calculator for a citizen service.
 * @param {Object} params
 * @param {Object} params.service Citizen service record
 * @param {string|Date} [params.submissionDate=new Date()]
 * @returns {Object} Forecast report
 */
export function calculateServiceSlaForecast({ service, submissionDate = new Date() } = {}) {
  const subDate = submissionDate instanceof Date ? submissionDate : new Date(submissionDate);
  const validSubDate = isNaN(subDate.getTime()) ? new Date() : subDate;

  const rawTimeline = service?.timeRequired || service?.timeline || '15 to 30 days';
  const { minDays, maxDays, isWorkingDays } = parseOfficialTimeline(rawTimeline);
  const channel = inferDeliveryChannel(service);
  const channelConfig = DELIVERY_CHANNEL_CONFIG[channel];

  // Base completion calculations
  let minTargetDate;
  let maxTargetDate;
  let totalHolidaysSkipped = [];
  let totalWeekendsSkipped = 0;

  if (isWorkingDays) {
    const minResult = addWorkingDays(validSubDate, Math.max(1, minDays));
    const maxResult = addWorkingDays(validSubDate, Math.max(1, maxDays));
    minTargetDate = minResult.targetDate;
    maxTargetDate = maxResult.targetDate;
    totalHolidaysSkipped = maxResult.holidaysSkipped;
    totalWeekendsSkipped = maxResult.weekendsSkipped;
  } else {
    minTargetDate = new Date(validSubDate.getTime());
    minTargetDate.setDate(minTargetDate.getDate() + minDays);

    maxTargetDate = new Date(validSubDate.getTime());
    maxTargetDate.setDate(maxTargetDate.getDate() + maxDays);
  }

  // Apply delivery channel transit buffer
  if (channelConfig.transitBufferDays > 0) {
    maxTargetDate.setDate(maxTargetDate.getDate() + channelConfig.transitBufferDays);
  }

  // Statutory Right to Public Service (RPS) escalation threshold
  // Under state Acts, 1.5x max official timeline or minimum +10 days constitutes default breach threshold
  const statutoryBufferDays = Math.max(7, Math.ceil(maxDays * 0.35));
  const escalationDate = new Date(maxTargetDate.getTime());
  escalationDate.setDate(escalationDate.getDate() + statutoryBufferDays);

  // Confidence rating logic
  let confidenceScore = channelConfig.baseConfidence;
  if (totalHolidaysSkipped.length > 1) {
    confidenceScore -= 4; // festival/holiday rush
  }
  if (maxDays > 30) {
    confidenceScore -= 5; // complex multi-tier approvals
  }

  const confidenceRating = confidenceScore >= 90 ? 'High' : confidenceScore >= 80 ? 'Moderate' : 'Standard';

  return {
    officialTimeline: String(rawTimeline),
    minWorkingDays: minDays,
    maxWorkingDays: maxDays,
    isWorkingDays,
    submissionDateIso: toLocalIsoDate(validSubDate),
    expectedCompletionMinIso: toLocalIsoDate(minTargetDate),
    expectedCompletionMaxIso: toLocalIsoDate(maxTargetDate),
    appellateEscalationDateIso: toLocalIsoDate(escalationDate),
    deliveryChannel: channel,
    deliveryChannelLabel: channelConfig.label,
    deliveryDescription: channelConfig.description,
    transitBufferDays: channelConfig.transitBufferDays,
    confidenceScore: Math.max(50, Math.min(100, confidenceScore)),
    confidenceRating,
    weekendsSkippedCount: totalWeekendsSkipped,
    holidaysSkipped: totalHolidaysSkipped,
    disclaimer:
      'Turnaround forecasts are estimations based on official citizen charters and non-working day exclusions. Actual processing may vary by district office workload and verification needs.',
  };
}

export default {
  GAZETTED_HOLIDAYS_CATALOGUE,
  DELIVERY_CHANNELS,
  DELIVERY_CHANNEL_CONFIG,
  inferDeliveryChannel,
  parseOfficialTimeline,
  isWeekend,
  getGazettedHoliday,
  addWorkingDays,
  calculateServiceSlaForecast,
};
