/**
 * Civic Service Counter Demand & Queue Staffing Contract (#764)
 * Strict domain entities, enums, schema validation, and seed data.
 * Zero-PII contract: all data represents hourly or daily aggregates.
 */

export const FORECAST_MODEL_VERSION = 'v1.0.0-seasonal-erlang';

export const CAPACITY_PLAN_STATUSES = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ARCHIVED: 'ARCHIVED',
};

export const ALLOWED_PLAN_TRANSITIONS = {
  [CAPACITY_PLAN_STATUSES.DRAFT]: [
    CAPACITY_PLAN_STATUSES.DRAFT,
    CAPACITY_PLAN_STATUSES.SUBMITTED,
  ],
  [CAPACITY_PLAN_STATUSES.SUBMITTED]: [
    CAPACITY_PLAN_STATUSES.APPROVED,
    CAPACITY_PLAN_STATUSES.REJECTED,
    CAPACITY_PLAN_STATUSES.DRAFT,
  ],
  [CAPACITY_PLAN_STATUSES.APPROVED]: [
    CAPACITY_PLAN_STATUSES.ARCHIVED,
  ],
  [CAPACITY_PLAN_STATUSES.REJECTED]: [
    CAPACITY_PLAN_STATUSES.DRAFT,
    CAPACITY_PLAN_STATUSES.ARCHIVED,
  ],
  [CAPACITY_PLAN_STATUSES.ARCHIVED]: [],
};

export const HOLIDAY_TYPES = {
  GAZETTED: 'GAZETTED',
  RESTRICTED: 'RESTRICTED',
  EMERGENCY_CLOSURE: 'EMERGENCY_CLOSURE',
  FESTIVAL_HIGH_DEMAND: 'FESTIVAL_HIGH_DEMAND',
};

export const JURISDICTIONS = {
  DELHI_SOUTH: 'DELHI_SOUTH',
  MUMBAI_CENTRAL: 'MUMBAI_CENTRAL',
  BENGALURU_EAST: 'BENGALURU_EAST',
  KOLKATA_NORTH: 'KOLKATA_NORTH',
};

/**
 * Standard Operational Shift Hours (09:00 to 17:00)
 */
export const OPERATING_HOURS = [
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
];

/**
 * Service Categories with statutory benchmark processing times
 */
export const MOCK_SERVICE_CATEGORIES = [
  {
    categoryId: 'cat_aadhaar',
    name: 'Aadhaar Enrolment & Biometric Updates',
    defaultServiceDurationMinutes: 12,
    targetMaxWaitMinutes: 20,
    activeCountersCapacityRatio: 0.35,
    seasonalityWeight: 1.15,
  },
  {
    categoryId: 'cat_revenue_cert',
    name: 'Revenue & Caste/Income Certificates',
    defaultServiceDurationMinutes: 10,
    targetMaxWaitMinutes: 25,
    activeCountersCapacityRatio: 0.25,
    seasonalityWeight: 1.3,
  },
  {
    categoryId: 'cat_trade_licence',
    name: 'Municipal Trade Licences & Health NOCs',
    defaultServiceDurationMinutes: 18,
    targetMaxWaitMinutes: 30,
    activeCountersCapacityRatio: 0.20,
    seasonalityWeight: 1.05,
  },
  {
    categoryId: 'cat_property_tax',
    name: 'Property Tax Assessment & Mutation',
    defaultServiceDurationMinutes: 15,
    targetMaxWaitMinutes: 25,
    activeCountersCapacityRatio: 0.20,
    seasonalityWeight: 1.4,
  },
];

/**
 * Civic Office Capacity Constraints
 */
export const MOCK_OFFICE_CAPACITIES = [
  {
    officeId: 'off_delhi_south_01',
    officeName: 'South Delhi Municipal Facilitation Centre (Hauz Khas)',
    jurisdiction: JURISDICTIONS.DELHI_SOUTH,
    totalPhysicalCounters: 12,
    defaultOpenCounters: 8,
    maxThroughputPerHour: 60,
    bufferStaffRatio: 0.15,
    operatingHours: { start: '09:00', end: '17:00' },
    closureNotice: null,
  },
  {
    officeId: 'off_mumbai_central_02',
    officeName: 'BMC Citizen Facilitation Centre (Dadar West)',
    jurisdiction: JURISDICTIONS.MUMBAI_CENTRAL,
    totalPhysicalCounters: 16,
    defaultOpenCounters: 10,
    maxThroughputPerHour: 85,
    bufferStaffRatio: 0.20,
    operatingHours: { start: '09:00', end: '17:00' },
    closureNotice: null,
  },
  {
    officeId: 'off_bengaluru_east_03',
    officeName: 'BBMP Bengaluru East Civic Seva Kendra (Indiranagar)',
    jurisdiction: JURISDICTIONS.BENGALURU_EAST,
    totalPhysicalCounters: 10,
    defaultOpenCounters: 6,
    maxThroughputPerHour: 50,
    bufferStaffRatio: 0.15,
    operatingHours: { start: '09:00', end: '17:00' },
    closureNotice: null,
  },
  {
    officeId: 'off_kolkata_north_04',
    officeName: 'KMC Borough II Citizen Service Office (Shyambazar)',
    jurisdiction: JURISDICTIONS.KOLKATA_NORTH,
    totalPhysicalCounters: 8,
    defaultOpenCounters: 5,
    maxThroughputPerHour: 40,
    bufferStaffRatio: 0.15,
    operatingHours: { start: '09:00', end: '17:00' },
    closureNotice: null,
  },
  {
    officeId: 'off_cold_start_05',
    officeName: 'New Greater Noida Satellite Seva Counter (Knowledge Park)',
    jurisdiction: JURISDICTIONS.DELHI_SOUTH,
    totalPhysicalCounters: 6,
    defaultOpenCounters: 3,
    maxThroughputPerHour: 25,
    bufferStaffRatio: 0.10,
    operatingHours: { start: '09:00', end: '17:00' },
    closureNotice: null,
  },
];

/**
 * Civic Holiday Calendar with impact multipliers
 */
export const MOCK_HOLIDAY_CALENDAR = [
  {
    holidayId: 'hol_2026_republic_day',
    date: '2026-01-26',
    name: 'Republic Day',
    jurisdiction: 'ALL',
    type: HOLIDAY_TYPES.GAZETTED,
    impactMultiplier: 0.0, // Office closed
    postHolidaySurgeMultiplier: 1.45,
  },
  {
    holidayId: 'hol_2026_independence_day',
    date: '2026-08-15',
    name: 'Independence Day',
    jurisdiction: 'ALL',
    type: HOLIDAY_TYPES.GAZETTED,
    impactMultiplier: 0.0,
    postHolidaySurgeMultiplier: 1.40,
  },
  {
    holidayId: 'hol_2026_gandhi_jayanti',
    date: '2026-10-02',
    name: 'Mahatma Gandhi Jayanti',
    jurisdiction: 'ALL',
    type: HOLIDAY_TYPES.GAZETTED,
    impactMultiplier: 0.0,
    postHolidaySurgeMultiplier: 1.35,
  },
  {
    holidayId: 'hol_2026_diwali',
    date: '2026-11-08',
    name: 'Diwali Deepavali',
    jurisdiction: 'ALL',
    type: HOLIDAY_TYPES.GAZETTED,
    impactMultiplier: 0.0,
    postHolidaySurgeMultiplier: 1.55,
  },
  {
    holidayId: 'hol_2026_delhi_local',
    date: '2026-11-19',
    name: 'Guru Nanak Jayanti',
    jurisdiction: JURISDICTIONS.DELHI_SOUTH,
    type: HOLIDAY_TYPES.GAZETTED,
    impactMultiplier: 0.0,
    postHolidaySurgeMultiplier: 1.30,
  },
  {
    holidayId: 'hol_2026_mumbai_cyclone',
    date: '2026-11-10',
    name: 'High Tide & Precautionary Weather Closure',
    jurisdiction: JURISDICTIONS.MUMBAI_CENTRAL,
    type: HOLIDAY_TYPES.EMERGENCY_CLOSURE,
    impactMultiplier: 0.15,
    postHolidaySurgeMultiplier: 1.50,
  },
];

/**
 * Generate 60 days of synthetic historical hourly aggregates for an office.
 * Strictly Zero-PII: only counts and duration statistics.
 */
export function generateSyntheticDemandAggregates(officeId = 'off_delhi_south_01', days = 60) {
  const records = [];
  const baseDate = new Date('2026-09-15T00:00:00Z');

  // Diurnal multipliers across 8 hours (09:00 - 17:00)
  const hourWeights = [0.85, 1.25, 1.40, 1.15, 0.75, 1.10, 1.30, 0.90];
  // Day of week multipliers: Sun=0, Mon=1.35, Tue=1.1, Wed=1.0, Thu=1.0, Fri=1.15, Sat=0.5
  const dayWeights = [0.0, 1.35, 1.10, 1.00, 1.00, 1.15, 0.45];

  for (let d = 0; d < days; d++) {
    const current = new Date(baseDate.getTime() + d * 86400000);
    const dateStr = current.toISOString().slice(0, 10);
    const dayOfWeek = current.getUTCDay();

    // Sunday office is closed
    if (dayOfWeek === 0) continue;

    const dowFactor = dayWeights[dayOfWeek];

    // Check holiday
    const holiday = MOCK_HOLIDAY_CALENDAR.find((h) => h.date === dateStr);
    const holMultiplier = holiday ? holiday.impactMultiplier : 1.0;

    // Post-holiday backlog surge (day after holiday)
    const prevDate = new Date(current.getTime() - 86400000).toISOString().slice(0, 10);
    const prevHoliday = MOCK_HOLIDAY_CALENDAR.find((h) => h.date === prevDate);
    const postHolMultiplier = prevHoliday ? prevHoliday.postHolidaySurgeMultiplier : 1.0;

    OPERATING_HOURS.forEach((hourStr, idx) => {
      const hourFactor = hourWeights[idx];
      const baseExpected = 28 * dowFactor * hourFactor * holMultiplier * postHolMultiplier;

      // Deterministic pseudo-random variation
      const pseudoNoise = ((d * 17 + idx * 31) % 11 - 5) * 0.8;
      const totalArrivals = Math.max(0, Math.round(baseExpected + pseudoNoise));

      const appointmentCount = Math.round(totalArrivals * 0.45);
      const walkInCount = Math.max(0, totalArrivals - appointmentCount);
      const noShowCount = Math.round(appointmentCount * 0.12);

      // K-anonymity suppression check: suppress bins < 5 arrivals
      const isSuppressed = totalArrivals > 0 && totalArrivals < 5;

      records.push({
        aggregateId: `agg_${officeId}_${dateStr}_${hourStr}`,
        officeId,
        date: dateStr,
        timeSlot: `${hourStr}-${parseInt(hourStr, 10) + 1}:00`,
        hourIndex: idx,
        categoryId: MOCK_SERVICE_CATEGORIES[idx % MOCK_SERVICE_CATEGORIES.length].categoryId,
        appointmentCount: isSuppressed ? 0 : appointmentCount,
        walkInCount: isSuppressed ? 0 : walkInCount,
        totalFootfall: isSuppressed ? 0 : totalArrivals,
        avgServiceDurationMinutes: 13.5 + (idx % 3) * 1.5,
        noShowCount: isSuppressed ? 0 : noShowCount,
        isHoliday: Boolean(holiday),
        isSuppressed,
        schemaVersion: '1.0.0',
      });
    });
  }

  return records;
}

/**
 * Validation: Office Demand Aggregate
 */
export function validateDemandAggregate(record) {
  if (!record || typeof record !== 'object') {
    return { valid: false, error: 'Aggregate record must be an object' };
  }
  if (!record.officeId || typeof record.officeId !== 'string') {
    return { valid: false, error: 'Invalid or missing officeId' };
  }
  if (!record.date || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
    return { valid: false, error: 'Date must be formatted as YYYY-MM-DD' };
  }
  if (typeof record.totalFootfall !== 'number' || record.totalFootfall < 0) {
    return { valid: false, error: 'totalFootfall must be a non-negative number' };
  }
  // Zero-PII check: reject any payload containing citizen identifiers
  const forbiddenFields = [
    'citizenName',
    'applicantName',
    'name',
    'phone',
    'mobile',
    'aadhaar',
    'email',
    'applicationId',
    'tokenNumber',
  ];
  for (const field of forbiddenFields) {
    if (field in record) {
      return {
        valid: false,
        error: `Zero-PII violation: '${field}' cannot be stored in demand aggregates`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validation: Capacity Plan
 */
export function validateCapacityPlan(plan) {
  if (!plan || typeof plan !== 'object') {
    return { valid: false, error: 'Capacity plan must be an object' };
  }
  if (!plan.officeId || typeof plan.officeId !== 'string') {
    return { valid: false, error: 'Missing officeId' };
  }
  if (!plan.planDate || !/^\d{4}-\d{2}-\d{2}$/.test(plan.planDate)) {
    return { valid: false, error: 'planDate must be YYYY-MM-DD' };
  }
  if (!Array.isArray(plan.hourlyStaffing) || plan.hourlyStaffing.length === 0) {
    return { valid: false, error: 'hourlyStaffing must be a non-empty array' };
  }
  if (!Object.values(CAPACITY_PLAN_STATUSES).includes(plan.status)) {
    return { valid: false, error: `Invalid status: ${plan.status}` };
  }

  return { valid: true };
}

/**
 * State Transition Validator
 */
export function validatePlanStateTransition(currentStatus, targetStatus) {
  const allowed = ALLOWED_PLAN_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    return {
      valid: false,
      error: `Invalid transition from ${currentStatus} to ${targetStatus}. Allowed: ${allowed.join(', ') || 'None'}`,
    };
  }
  return { valid: true };
}

