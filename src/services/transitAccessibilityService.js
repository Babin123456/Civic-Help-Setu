/**
 * Public Transport Stop Accessibility and Amenities Verification Directory Service
 * 
 * Implements a structured directory of bus and transit stops with verified:
 * - Wheelchair ramps, tactile paving, and low-floor bus boarding compatibility
 * - Physical amenities: Shelter, seating, lighting, tactile signboards
 * - Real-time Passenger Information System (PIS) & audio announcement status
 * - Moderated citizen correction reports with operator review workflows
 * - Geographic coordinate bounding and proximity filtering
 */

export const ACCESSIBILITY_FEATURES = {
  WHEELCHAIR_RAMP: { code: 'WHEELCHAIR_RAMP', label: 'Wheelchair Accessible Ramp', category: 'MOBILITY' },
  TACTILE_PAVING: { code: 'TACTILE_PAVING', label: 'Tactile Guiding & Warning Paving', category: 'VISION' },
  AUDIO_ANNOUNCEMENT: { code: 'AUDIO_ANNOUNCEMENT', label: 'Automated Audio Route Announcements', category: 'HEARING_VISION' },
  LOW_FLOOR_CURB: { code: 'LOW_FLOOR_CURB', label: 'Level-Boarding Raised Curb', category: 'MOBILITY' },
  BRAILLE_SIGNAGE: { code: 'BRAILLE_SIGNAGE', label: 'Braille / High-Contrast Route Signboards', category: 'VISION' }
};

export const AMENITY_FEATURES = {
  SHELTER_ROOF: { code: 'SHELTER_ROOF', label: 'Weather-Proof Covered Shelter' },
  BENCH_SEATING: { code: 'BENCH_SEATING', label: 'Dedicated Passenger Seating' },
  NIGHT_LIGHTING: { code: 'NIGHT_LIGHTING', label: 'Illuminated LED Night Lighting' },
  DIGITAL_PIS_DISPLAY: { code: 'DIGITAL_PIS_DISPLAY', label: 'Digital Next-Bus Arrival Screen' },
  DRINKING_WATER: { code: 'DRINKING_WATER', label: 'Public Drinking Water Dispenser' }
};

export const VERIFICATION_STATUSES = {
  VERIFIED_OFFICIAL: 'VERIFIED_OFFICIAL',
  COMMUNITY_AUDITED: 'COMMUNITY_AUDITED',
  PENDING_INSPECTION: 'PENDING_INSPECTION',
  FLAGGED_OUTDATED: 'FLAGGED_OUTDATED'
};

/**
 * Validates transit stop entity and calculates accessibility index.
 * @param {Object} stopData 
 * @returns {Object} validatedStop
 */
export function validateTransitStop(stopData = {}) {
  const errors = [];

  if (!stopData.stopId || stopData.stopId.trim().length < 3) {
    errors.push('Official Stop ID / GTFS Stop Code is required.');
  }

  if (!stopData.stopName || stopData.stopName.trim().length < 3) {
    errors.push('Transit stop name is required.');
  }

  const lat = Number(stopData.latitude);
  const lon = Number(stopData.longitude);

  if (isNaN(lat) || lat < -90 || lat > 90) {
    errors.push('Valid latitude between -90 and 90 is required.');
  }

  if (isNaN(lon) || lon < -180 || lon > 180) {
    errors.push('Valid longitude between -180 and 180 is required.');
  }

  const activeAccessibility = Array.isArray(stopData.accessibilityFeatures) ? stopData.accessibilityFeatures : [];
  const activeAmenities = Array.isArray(stopData.amenities) ? stopData.amenities : [];

  // Calculate accessibility score out of 5
  const totalAccPoints = Object.keys(ACCESSIBILITY_FEATURES).length;
  const matchedAcc = activeAccessibility.filter(code => ACCESSIBILITY_FEATURES[code]).length;
  const accessibilityRating = +( (matchedAcc / totalAccPoints) * 5 ).toFixed(1);

  return {
    isValid: errors.length === 0,
    errors,
    transitStop: errors.length === 0 ? {
      stopId: stopData.stopId.trim(),
      stopName: stopData.stopName.trim(),
      operatorName: stopData.operatorName || 'City Transport Corporation',
      jurisdiction: stopData.jurisdiction || 'Metropolitan Transport Authority',
      latitude: lat,
      longitude: lon,
      accessibilityRating,
      accessibilityFeatures: activeAccessibility,
      amenities: activeAmenities,
      verificationStatus: stopData.verificationStatus || VERIFICATION_STATUSES.PENDING_INSPECTION,
      lastInspectedAt: stopData.lastInspectedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } : null
  };
}

/**
 * Filters stops by mandatory accessibility and amenity criteria.
 * @param {Array<Object>} stops 
 * @param {Object} filters 
 * @returns {Array<Object>}
 */
export function filterTransitStops(stops = [], filters = {}) {
  const requiredAcc = filters.requiredAccessibility || [];
  const requiredAmen = filters.requiredAmenities || [];
  const minRating = Number(filters.minAccessibilityRating) || 0;
  const operator = (filters.operator || '').toLowerCase();

  return stops.filter(stop => {
    if (stop.accessibilityRating < minRating) return false;

    if (operator && !stop.operatorName?.toLowerCase().includes(operator)) return false;

    // Check mandatory accessibility features
    for (const req of requiredAcc) {
      if (!stop.accessibilityFeatures?.includes(req)) return false;
    }

    // Check mandatory amenities
    for (const req of requiredAmen) {
      if (!stop.amenities?.includes(req)) return false;
    }

    return true;
  });
}

/**
 * Registers a moderated citizen correction report for a transit stop.
 * @param {string} stopId 
 * @param {Object} reportData 
 * @returns {Object} correctionReport
 */
export function submitCorrectionReport(stopId, reportData = {}) {
  if (!stopId) {
    return { success: false, error: 'Stop ID is required to lodge a correction.' };
  }

  if (!reportData.observedDiscrepancy || reportData.observedDiscrepancy.trim().length < 10) {
    return { success: false, error: 'Detailed discrepancy description (min 10 characters) is required.' };
  }

  const correctionReport = {
    reportId: 'corr_' + Math.random().toString(36).substring(2, 9),
    stopId,
    observedDiscrepancy: reportData.observedDiscrepancy.trim(),
    featureCode: reportData.featureCode || 'GENERAL',
    suggestedStatus: reportData.suggestedStatus || 'DAMAGED_OR_MISSING',
    reportedAt: new Date().toISOString(),
    moderationStatus: 'PENDING_OPERATOR_REVIEW'
  };

  return {
    success: true,
    correctionReport,
    notice: 'Correction queued for operator review. Verified updates will be published after inspection.'
  };
}

/**
 * Moderates a citizen correction report and updates stop status.
 * @param {Object} transitStop 
 * @param {Object} report 
 * @param {string} action - 'ACCEPT' | 'REJECT'
 * @param {string} operatorNotes 
 * @returns {Object}
 */
export function resolveCorrectionReport(transitStop, report, action, operatorNotes = '') {
  if (action !== 'ACCEPT' && action !== 'REJECT') {
    return { success: false, error: "Action must be 'ACCEPT' or 'REJECT'." };
  }

  const isAccepted = action === 'ACCEPT';

  const updatedStop = { ...transitStop };
  if (isAccepted) {
    if (report.suggestedStatus === 'DAMAGED_OR_MISSING') {
      updatedStop.accessibilityFeatures = (updatedStop.accessibilityFeatures || []).filter(f => f !== report.featureCode);
      updatedStop.amenities = (updatedStop.amenities || []).filter(a => a !== report.featureCode);
    }
    updatedStop.verificationStatus = VERIFICATION_STATUSES.COMMUNITY_AUDITED;
    updatedStop.lastInspectedAt = new Date().toISOString();
  }

  return {
    success: true,
    action,
    updatedStop,
    resolution: {
      reportId: report.reportId,
      resolvedAt: new Date().toISOString(),
      action,
      operatorNotes: operatorNotes.trim() || (isAccepted ? 'Correction confirmed on ground' : 'Discrepancy not substantiated')
    }
  };
}

/**
 * Exports transit stop accessibility profile in markdown.
 * @param {Object} stop 
 * @returns {string} markdown
 */
export function exportTransitStopDossier(stop = {}) {
  const accList = (stop.accessibilityFeatures || []).map(code => {
    const feat = ACCESSIBILITY_FEATURES[code];
    return feat ? `- **${feat.label}** [${feat.category}]` : `- ${code}`;
  });

  const amenList = (stop.amenities || []).map(code => {
    const amen = AMENITY_FEATURES[code];
    return amen ? `- **${amen.label}**` : `- ${code}`;
  });

  return [
    `# Transit Stop Accessibility Dossier: ${stop.stopName || 'Unnamed Stop'}`,
    `**Stop Code / GTFS ID:** ${stop.stopId || 'N/A'}`,
    `**Operating Transport Authority:** ${stop.operatorName || 'City Transport'}`,
    `**Coordinates:** ${stop.latitude || 0}, ${stop.longitude || 0}`,
    `**Verification Status:** ${stop.verificationStatus || 'PENDING'}`,
    `**Accessibility Rating:** ${stop.accessibilityRating || 0} / 5.0`,
    `**Last Inspected:** ${stop.lastInspectedAt ? stop.lastInspectedAt.split('T')[0] : 'N/A'}`,
    ``,
    `## Verified Accessibility Features`,
    ...(accList.length > 0 ? accList : ['No verified accessibility features recorded.']),
    ``,
    `## Passenger Amenities & Facilities`,
    ...(amenList.length > 0 ? amenList : ['No passenger shelter or amenities recorded.']),
    ``,
    `---`,
    `*Data audited under Harmonised Guidelines and Space Standards for Barrier-Free Built Environment.*`
  ].join('\n');
}
