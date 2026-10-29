/**
 * Intake Window and Token Capacity Service (#256)
 * Models official civic service intake windows (token quotas, document scrutiny,
 * lunch recess, dispatch) separately from general facility office hours.
 */

export const INTAKE_PHASES = {
  TOKEN_ISSUANCE: 'TOKEN_ISSUANCE',
  DOCUMENT_SCRUTINY: 'DOCUMENT_SCRUTINY',
  LUNCH_RECESS: 'LUNCH_RECESS',
  DISPATCH_ONLY: 'DISPATCH_ONLY',
  GENERAL_QUERIES: 'GENERAL_QUERIES',
  CLOSED: 'CLOSED',
};

/**
 * Standard breakdown of operational intake windows based on office classification
 */
export function getOfficeIntakeSchedule(office = {}) {
  const tokensPerDay = office.tokensPerDay || 200;
  const type = (office.type || office.category || '').toLowerCase();

  if (type.includes('passport') || type.includes('seva kendra')) {
    return [
      {
        id: 'tokens',
        phase: INTAKE_PHASES.TOKEN_ISSUANCE,
        name: 'Appointment Token Entry',
        startHour: 9,
        startMin: 0,
        endHour: 13,
        endMin: 0,
        quota: tokensPerDay,
        acceptsNewCitizens: true,
        description: 'Biometric appointment token scanning and initial queue entry',
      },
      {
        id: 'lunch',
        phase: INTAKE_PHASES.LUNCH_RECESS,
        name: 'Official Lunch Recess',
        startHour: 13,
        startMin: 0,
        endHour: 13,
        endMin: 45,
        quota: 0,
        acceptsNewCitizens: false,
        description: 'Counters paused; processing resumes at 1:45 PM',
      },
      {
        id: 'scrutiny',
        phase: INTAKE_PHASES.DOCUMENT_SCRUTINY,
        name: 'Counter Document Verification',
        startHour: 13,
        startMin: 45,
        endHour: 16,
        endMin: 30,
        quota: Math.round(tokensPerDay * 0.4),
        acceptsNewCitizens: true,
        description: 'Verification of original certificates & police clearance appointments',
      },
      {
        id: 'queries',
        phase: INTAKE_PHASES.GENERAL_QUERIES,
        name: 'Citizen Helpdesk & Inquiries',
        startHour: 16,
        startMin: 30,
        endHour: 17,
        endMin: 30,
        quota: 50,
        acceptsNewCitizens: true,
        description: 'General status queries, re-issuance inquiries and token assistance',
      },
    ];
  }

  // Default RTO, Tehsil, Collectorate, Civic Center
  return [
    {
      id: 'tokens',
      phase: INTAKE_PHASES.TOKEN_ISSUANCE,
      name: 'Morning Token Distribution',
      startHour: 9,
      startMin: 30,
      endHour: 12,
      endMin: 30,
      quota: tokensPerDay,
      acceptsNewCitizens: true,
      description: 'Physical queue tokens distributed for daily service processing',
    },
    {
      id: 'scrutiny',
      phase: INTAKE_PHASES.DOCUMENT_SCRUTINY,
      name: 'Document Scrutiny & Data Entry',
      startHour: 10,
      startMin: 0,
      endHour: 13,
      endMin: 30,
      quota: tokensPerDay,
      acceptsNewCitizens: true,
      description: 'Original certificate verification and portal submission review',
    },
    {
      id: 'lunch',
      phase: INTAKE_PHASES.LUNCH_RECESS,
      name: 'Mandatory Lunch Recess',
      startHour: 13,
      startMin: 30,
      endHour: 14,
      endMin: 15,
      quota: 0,
      acceptsNewCitizens: false,
      description: 'Counters paused for administrative recess',
    },
    {
      id: 'dispatch',
      phase: INTAKE_PHASES.DISPATCH_ONLY,
      name: 'Certified Copy & Dispatch Delivery',
      startHour: 14,
      startMin: 15,
      endHour: 16,
      endMin: 45,
      quota: Math.round(tokensPerDay * 0.5),
      acceptsNewCitizens: true,
      description: 'Collection of approved certificates, deeds, and driving licenses',
    },
    {
      id: 'queries',
      phase: INTAKE_PHASES.GENERAL_QUERIES,
      name: 'Citizen Public Inquiries',
      startHour: 16,
      startMin: 45,
      endHour: 17,
      endMin: 30,
      quota: 30,
      acceptsNewCitizens: true,
      description: 'Advisory counter for incomplete paperwork and re-applications',
    },
  ];
}

/**
 * Determine real-time intake status for an office at a given reference time.
 */
export function getCurrentIntakeStatus(office = {}, referenceTime = new Date()) {
  const day = referenceTime.getDay();
  const isWeekend = day === 0 || (day === 6 && !office.officeHours?.openSaturdays);

  if (isWeekend) {
    return {
      phase: INTAKE_PHASES.CLOSED,
      label: 'Closed on Weekends',
      isAcceptingTokens: false,
      minutesRemaining: 0,
      badgeVariant: 'danger',
      description: 'Office intake counters are closed on weekends.',
    };
  }

  const currentMinutes = referenceTime.getHours() * 60 + referenceTime.getMinutes();
  const schedule = getOfficeIntakeSchedule(office);

  // Check if before opening
  const firstWindow = schedule[0];
  const openingMinutes = firstWindow.startHour * 60 + firstWindow.startMin;
  if (currentMinutes < openingMinutes) {
    const diff = openingMinutes - currentMinutes;
    return {
      phase: INTAKE_PHASES.CLOSED,
      label: `Opens at ${String(firstWindow.startHour).padStart(2, '0')}:${String(firstWindow.startMin).padStart(2, '0')}`,
      isAcceptingTokens: false,
      minutesRemaining: diff,
      badgeVariant: 'warning',
      description: `Intake counters open in ${formatIntakeTimeRemaining(diff)}.`,
      nextWindow: firstWindow,
    };
  }

  // Find active window
  for (let i = 0; i < schedule.length; i++) {
    const win = schedule[i];
    const winStart = win.startHour * 60 + win.startMin;
    const winEnd = win.endHour * 60 + win.endMin;

    if (currentMinutes >= winStart && currentMinutes < winEnd) {
      const minutesRemaining = winEnd - currentMinutes;
      const nextWin = schedule[i + 1] || null;

      if (win.phase === INTAKE_PHASES.LUNCH_RECESS) {
        return {
          phase: win.phase,
          label: `Lunch Break (Resumes ${String(win.endHour).padStart(2, '0')}:${String(win.endMin).padStart(2, '0')})`,
          isAcceptingTokens: false,
          minutesRemaining,
          badgeVariant: 'warning',
          currentWindow: win,
          nextWindow: nextWin,
          description: win.description,
        };
      }

      if (win.phase === INTAKE_PHASES.TOKEN_ISSUANCE) {
        return {
          phase: win.phase,
          label: `Tokens Open (${formatIntakeTimeRemaining(minutesRemaining)} left)`,
          isAcceptingTokens: true,
          tokenQuota: win.quota,
          minutesRemaining,
          badgeVariant: 'success',
          currentWindow: win,
          nextWindow: nextWin,
          description: win.description,
        };
      }

      return {
        phase: win.phase,
        label: `${win.name} (${formatIntakeTimeRemaining(minutesRemaining)} left)`,
        isAcceptingTokens: win.acceptsNewCitizens,
        minutesRemaining,
        badgeVariant: win.acceptsNewCitizens ? 'info' : 'warning',
        currentWindow: win,
        nextWindow: nextWin,
        description: win.description,
      };
    }
  }

  // After all windows
  return {
    phase: INTAKE_PHASES.CLOSED,
    label: 'Intake Closed for Today',
    isAcceptingTokens: false,
    minutesRemaining: 0,
    badgeVariant: 'danger',
    description: 'All public intake counters have closed for the day. Reopens next business morning.',
  };
}

/**
 * Format minutes into readable time remaining string.
 */
export function formatIntakeTimeRemaining(minutes = 0) {
  if (minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}
