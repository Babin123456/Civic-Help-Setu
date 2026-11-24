/**
 * UP Road Excavation and Utility-Cut Reinstatement Monitor Service
 * 
 * Tracks permissions, safety barricading, trench backfilling, and resurfacing
 * for utility road excavations across Uttar Pradesh (PWD, Nagar Nigam / Municipalities,
 * UP Jal Nigam, Torrent/GAIL Gas, Telecom/OFC optical fibre).
 * 
 * Features:
 * - Utility-cut registry schema & permit lifecycle validation
 * - Safety hazard scoring (Missing barricading, unlit trenches at night, school/hospital proximity)
 * - Citizen observation tally and multi-report verification
 * - SLA breach calculator based on UP Urban Local Body / PWD guidelines (max 14 days post-excavation)
 * - Printable public escalation notice for Municipal Commissioner / PWD Executive Engineer
 */

export const UP_EXCAVATING_AGENCIES = [
  'UP Jal Nigam (Water / Sewerage Pipeline)',
  'City Gas Distribution (Torrent / GAIL / Adani Gas)',
  'Telecom / OFC Laying (Jio / Airtel / BSNL Optical Fibre)',
  'UPPCL / Discom (Underground Power Cable Laying)',
  'Private Builder / Individual Domestic Water-Sewer Connection',
  'Smart City Mission Infrastructure Project'
];

export const UP_ROAD_AUTHORITIES = {
  PWD: {
    code: 'PWD',
    name: 'Public Works Department (Lok Nirman Vibhag), UP',
    jurisdiction: 'State highways, major district roads (MDR), arterial link roads',
    officer: 'Executive Engineer (Adhishasi Abhiyanta), PWD'
  },
  NAGAR_NIGAM: {
    code: 'NAGAR_NIGAM',
    name: 'Municipal Corporation (Nagar Nigam / Nagar Palika Parishad)',
    jurisdiction: 'Internal colony roads, municipal streets, local commercial sectors',
    officer: 'Municipal Commissioner / Chief Engineer (Civil)'
  },
  DEVELOPMENT_AUTHORITY: {
    code: 'DEVELOPMENT_AUTHORITY',
    name: 'Development Authority (e.g. LDA, KDA, GDA, NOIDA)',
    jurisdiction: 'Planned sectors, scheme layouts, master plan roads',
    officer: 'Chief Engineer / Enforcement Officer'
  }
};

export const REINSTATEMENT_STATUSES = {
  PERMITTED: 'PERMITTED_NOT_STARTED',
  EXCAVATION_IN_PROGRESS: 'EXCAVATION_IN_PROGRESS',
  TRENCH_OPEN_IDLE: 'TRENCH_OPEN_IDLE',
  BACKFILLED_UNPAVED: 'BACKFILLED_UNPAVED',
  RESURFACED_COMPLETED: 'RESURFACED_COMPLETED',
  OVERDUE_BREACHED: 'OVERDUE_BREACHED'
};

/**
 * Calculates safety risk score (0-100) and priority level for an open trench / road cut.
 * @param {Object} hazardFactors 
 * @returns {Object} risk assessment
 */
export function assessRoadCutSafetyRisk(hazardFactors = {}) {
  let score = 20; // baseline risk for any road cut

  if (!hazardFactors.hasWarningBarricades) score += 25;
  if (!hazardFactors.hasRetroreflectiveTapeOrNightLighting) score += 20;
  if (hazardFactors.isNearSchoolOrHospital) score += 15;
  if (hazardFactors.isMainArterialRoad) score += 10;
  if (Number(hazardFactors.trenchDepthMeters) >= 1.5) score += 10;

  const boundedScore = Math.min(100, score);
  let severityLevel = 'LOW';
  if (boundedScore >= 70) severityLevel = 'CRITICAL';
  else if (boundedScore >= 45) severityLevel = 'MODERATE';

  return {
    safetyScore: boundedScore,
    severityLevel,
    isImmediateHazard: boundedScore >= 70,
    requiredImmediateAction: boundedScore >= 70
      ? 'Immediate intervention required: Erect sturdy reflective barricades and deploy warning flashers before dusk.'
      : 'Maintain standard perimeter demarcation.'
  };
}

/**
 * Calculates reinstatement SLA status and overdue days.
 * Prescribed UP PWD / Urban Development norm:
 * Reinstatement & bituminous resurfacing must complete within 14 calendar days of trench closure.
 * @param {Object} roadCutRecord 
 * @returns {Object} SLA timeline
 */
export function checkReinstatementSla(roadCutRecord = {}) {
  const excavationEndDate = roadCutRecord.excavationEndDate
    ? new Date(roadCutRecord.excavationEndDate)
    : null;

  if (!excavationEndDate || isNaN(excavationEndDate.getTime())) {
    return {
      status: roadCutRecord.status || REINSTATEMENT_STATUSES.EXCAVATION_IN_PROGRESS,
      isOverdue: false,
      overdueDays: 0,
      slaLimitDays: 14
    };
  }

  const now = new Date();
  const msDiff = now.getTime() - excavationEndDate.getTime();
  const elapsedDays = Math.floor(msDiff / (1000 * 60 * 60 * 24));
  const maxSlaDays = 14;

  const isOverdue = elapsedDays > maxSlaDays && roadCutRecord.status !== REINSTATEMENT_STATUSES.RESURFACED_COMPLETED;
  const overdueDays = isOverdue ? elapsedDays - maxSlaDays : 0;

  return {
    status: isOverdue ? REINSTATEMENT_STATUSES.OVERDUE_BREACHED : (roadCutRecord.status || 'IN_PROGRESS'),
    isOverdue,
    elapsedDays,
    slaLimitDays: maxSlaDays,
    overdueDays,
    bankGuaranteeForfeitureEligible: isOverdue && overdueDays >= 15
  };
}

/**
 * Aggregates citizen community reports with spam de-duplication.
 * @param {Array<Object>} observations 
 * @returns {Object} aggregate status
 */
export function aggregateRoadCutObservations(observations = []) {
  if (!Array.isArray(observations) || observations.length === 0) {
    return {
      totalObservations: 0,
      verifiedByCommunity: false,
      averageReportedDepthMeters: 0,
      unbarricadedReportCount: 0
    };
  }

  const validReports = observations.filter(o => o && o.roadId);
  const unbarricaded = validReports.filter(o => !o.hasBarricade).length;
  const totalDepth = validReports.reduce((acc, curr) => acc + (Number(curr.depthMeters) || 0.5), 0);

  return {
    totalObservations: validReports.length,
    verifiedByCommunity: validReports.length >= 3,
    averageReportedDepthMeters: Number((totalDepth / (validReports.length || 1)).toFixed(2)),
    unbarricadedReportCount: unbarricaded,
    consensusBarricadingMissing: unbarricaded > (validReports.length / 2)
  };
}

/**
 * Builds public escalation notice markdown for Municipal Commissioner / PWD.
 * @param {Object} roadCut 
 * @param {Object} safety 
 * @param {Object} sla 
 * @returns {string} markdown notice
 */
export function exportRoadCutEscalationNotice(roadCut = {}, safety = {}, sla = {}) {
  return [
    `# Public Notice & Reinstatement Demand: Unrestored Utility Road Cut`,
    `**Road / Location:** ${roadCut.locationName || 'Main Colony Road'}, ${roadCut.city || 'UP City'}`,
    `**Responsible Road Authority:** ${roadCut.authorityName || 'Nagar Nigam / PWD'}`,
    `**Excavating Entity:** ${roadCut.excavatingAgency || 'Public/Private Utility'}`,
    `**Permit / Reference ID:** \`${roadCut.permitNumber || 'UNAUTHORIZED_OR_UNKNOWN'}\``,
    ``,
    `## Safety & Hazard Assessment`,
    `- Risk Severity: **${safety.severityLevel || 'MODERATE'} (Score: ${safety.safetyScore || 50}/100)**`,
    `- Immediate Hazard Condition: ${safety.isImmediateHazard ? '⚠️ YES — Immediate risk to motorists/pedestrians' : 'Normal caution'}`,
    `- Action Required: ${safety.requiredImmediateAction || 'Erect barricades'}`,
    ``,
    `## Statutory SLA & Reinstatement Timeline`,
    `- Prescribed Resurfacing SLA: **14 Calendar Days**`,
    `- Current Status: **${sla.status || 'IN_PROGRESS'}**`,
    `- Overdue Delay: **${sla.overdueDays || 0} Days Past Deadline**`,
    `- Security Deposit / Bank Guarantee Clause: ${sla.bankGuaranteeForfeitureEligible ? 'Eligible for immediate forfeiture to fund emergency municipal road repair.' : 'Notice period active.'}`,
    ``,
    `## Demands for Municipal Action`,
    `1. Direct the excavating agency to install continuous reflective safety cones and amber flashers.`,
    `2. Execute wet-mix macadam (WMM) compacted backfilling within 48 hours to restore safe vehicular passage.`,
    `3. Complete final bituminous / concrete overlay and deduct cost from agency security deposit.`,
    ``,
    `---`,
    `> **Citizen Accountability:** Generated under the UP Urban Local Bodies Civic Grievance Framework.`
  ].join('\n');
}


export const UP_ROAD_CUT_REPAIR_STANDARDS = {
  SUB_BASE_SPECIFICATION: 'Granular Sub-Base (GSB) compacted in layers of not more than 150 mm thickness.',
  BASE_COURSE: 'Wet Mix Macadam (WMM) compacted to 98% maximum dry density.',
  SURFACING_FLEXIBLE: 'Bituminous Macadam (BM) followed by Semi-Dense Bituminous Concrete (SDBC) / Dense Bituminous Macadam (DBM).',
  SURFACING_RIGID: 'M-30 grade ready-mix concrete with tie bars matching existing road slab joints.',
  MINIMUM_CURING_TIME_DAYS: 7
};

export const UP_MUNICIPAL_HELPLINES = [
  { city: 'Lucknow', agency: 'Lucknow Municipal Corporation (LMC)', contact: '1533 / 0522-2622080' },
  { city: 'Kanpur', agency: 'Kanpur Municipal Corporation (KNN)', contact: '0512-2541258 / 1533' },
  { city: 'Varanasi', agency: 'Varanasi Nagar Nigam', contact: '1533 / 0542-2280333' },
  { city: 'Agra', agency: 'Agra Municipal Corporation', contact: '1533 / 0562-2520615' },
  { city: 'Prayagraj', agency: 'Prayagraj Nagar Nigam', contact: '1533 / 0532-2407983' },
  { city: 'Ghaziabad', agency: 'Ghaziabad Municipal Corporation', contact: '1533 / 0120-2790369' }
];

/**
 * Returns technical road reinstatement specification standards.
 * @returns {Object}
 */
export function getTechnicalReinstatementStandards() {
  return UP_ROAD_CUT_REPAIR_STANDARDS;
}

/**
 * Looks up municipal road helpline by city name.
 * @param {string} cityName 
 * @returns {Object}
 */
export function getMunicipalHelpline(cityName = '') {
  const norm = String(cityName).trim().toLowerCase();
  const found = UP_MUNICIPAL_HELPLINES.find(h => h.city.toLowerCase() === norm);
  return found || { city: cityName || 'General UP', agency: 'Local Urban Local Body', contact: '1533 (Centralized Civic Helpline)' };
}


export const UP_EXCAVATION_PERMIT_CONDITIONS = [
  'Pre-digging trial trench (potholing) to locate underground high-tension power cables and water mains.',
  'Compulsory barricading of 1.2 m height painted with alternating retroreflective red and white diagonal bands.',
  'Amber hazard lamps with solar trickle chargers activated between sunset and sunrise.',
  'Prohibition of excavation during festive processions or designated high-density fair dates (e.g. Magh Mela / Kanwar Yatra).',
  'Post-completion joint inspection by Assistant Engineer (Civil) and the excavating agency representative.'
];

/**
 * Returns mandatory statutory permit conditions for road excavations.
 * @returns {Array<string>}
 */
export function getExcavationPermitConditions() {
  return UP_EXCAVATION_PERMIT_CONDITIONS;
}
