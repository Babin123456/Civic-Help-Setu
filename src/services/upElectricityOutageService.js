/**
 * UP Electricity Transformer and Feeder Outage Pattern Reporter Service
 * 
 * Supports consumers across Uttar Pradesh Power Corporation Limited (UPPCL)
 * distribution companies (Discoms):
 * - Madhyanchal (MVVNL), Pashchimanchal (PVVNL), Purvanchal (PuVVNL), Dakshinanchal (DVVNL), KESCO
 * 
 * Key Capabilities:
 * - Diagnostic separation: Local household MCB/meter fault vs Distribution Transformer (DT) burnout vs 11 kV / 33 kV Feeder breakdown
 * - UPERC (UP Electricity Regulatory Commission) Standards of Performance (SOP) SLA calculation:
 *   - Rural burnt transformer replacement: max 48 hours
 *   - Urban burnt transformer replacement: max 24 hours
 *   - Feeder breakdown restoration: max 4 to 8 hours
 * - Daily outage diary and chronic disruption frequency tracking
 * - Neighborhood cluster verification (multi-consumer consensus)
 * - Printable statutory compensation claim / complaint dossier for Executive Engineer (EDD) / Consumer Grievance Redressal Forum (CGRF)
 * - Strict Privacy: No bank account credentials, billing passwords, or unmasked account IDs stored
 */

export const UPPCL_DISCOMS = {
  MVVNL: { code: 'MVVNL', name: 'Madhyanchal Vidyut Vitaran Nigam Ltd', hq: 'Lucknow', helpline: '1912' },
  PVVNL: { code: 'PVVNL', name: 'Pashchimanchal Vidyut Vitaran Nigam Ltd', hq: 'Meerut', helpline: '1912' },
  PUVVNL: { code: 'PUVVNL', name: 'Purvanchal Vidyut Vitaran Nigam Ltd', hq: 'Varanasi', helpline: '1912' },
  DVVNL: { code: 'DVVNL', name: 'Dakshinanchal Vidyut Vitaran Nigam Ltd', hq: 'Agra', helpline: '1912' },
  KESCO: { code: 'KESCO', name: 'Kanpur Electricity Supply Company', hq: 'Kanpur', helpline: '1912' }
};

export const OUTAGE_SCOPES = {
  INDIVIDUAL_HOUSEHOLD: {
    code: 'INDIVIDUAL_HOUSEHOLD',
    label: 'Isolated Household Fault (Service Cable / MCB / Meter Burnout)',
    upercSlaHours: 4,
    escalationAuthority: 'Sub-Station Line Parichar (Lineman) / Junior Engineer (JE)'
  },
  DISTRIBUTION_TRANSFORMER: {
    code: 'DISTRIBUTION_TRANSFORMER',
    label: 'Distribution Transformer (DT) Failure / Oil Leak / Burnt Coils',
    upercSlaHoursUrban: 24,
    upercSlaHoursRural: 48,
    escalationAuthority: 'Sub-Divisional Officer (SDO) / Executive Engineer (EDD)'
  },
  FEEDER_LEVEL_OUTAGE: {
    code: 'FEEDER_LEVEL_OUTAGE',
    label: '11 kV / 33 kV Rural/Town Feeder Tripping / Insulator Flashover',
    upercSlaHours: 8,
    escalationAuthority: 'Executive Engineer (Electricity Distribution Division) / Superintending Engineer'
  }
};

export const UPPCL_ESCALATION_OFFICERS = [
  { level: 'SUB_STATION', designation: 'Junior Engineer (JE / Avar Abhiyanta)', role: 'Field breakdown inspection and local line staff supervision' },
  { level: 'SUB_DIVISION', designation: 'Sub-Divisional Officer (SDO / Sahayak Abhiyanta)', role: 'Transformer workshop indentation and transformer movement' },
  { level: 'DIVISION', designation: 'Executive Engineer (EE / Adhishasi Abhiyanta)', role: 'Overall divisional network management and contractor work orders' },
  { level: 'STATUTORY', designation: 'Consumer Grievance Redressal Forum (CGRF / Vidyut Upbhokta Shikayat Nivaran Forum)', role: 'Judicial adjudication and statutory compensation awards' }
];

/**
 * Diagnoses electrical disruption scope and computes UPERC statutory SLA limits.
 * @param {Object} outageDetails 
 * @returns {Object} diagnosis
 */
export function diagnoseOutageScope(outageDetails = {}) {
  const isEntireVillageOrColonyOut = Boolean(outageDetails.isEntireVillageOrColonyDark);
  const isTransformerSparkingOrBurnt = Boolean(outageDetails.isTransformerSparkingOrLeakingOil);
  const isRural = Boolean(outageDetails.isRuralArea !== false);

  let scope = OUTAGE_SCOPES.INDIVIDUAL_HOUSEHOLD;
  let slaHours = 4;

  if (isTransformerSparkingOrBurnt) {
    scope = OUTAGE_SCOPES.DISTRIBUTION_TRANSFORMER;
    slaHours = isRural ? scope.upercSlaHoursRural : scope.upercSlaHoursUrban;
  } else if (isEntireVillageOrColonyOut) {
    scope = OUTAGE_SCOPES.FEEDER_LEVEL_OUTAGE;
    slaHours = scope.upercSlaHours;
  }

  const outageDurationHours = Number(outageDetails.durationHours) || 0;
  const isSlaBreached = outageDurationHours > slaHours;
  const overdueHours = isSlaBreached ? outageDurationHours - slaHours : 0;

  return {
    scopeCode: scope.code,
    scopeLabel: scope.label,
    isRural,
    prescribedSlaHours: slaHours,
    reportedDurationHours: outageDurationHours,
    isSlaBreached,
    overdueHours,
    statutoryCompensationEligible: isSlaBreached && overdueHours >= 12,
    remedyGuidance: isTransformerSparkingOrBurnt
      ? `Transformer indent must be raised immediately by Junior Engineer to the Divisional Transformer Workshop (Karyashala). Prescribed SLA: ${slaHours} hours.`
      : isEntireVillageOrColonyOut
      ? `Sub-station 33/11 kV feeder line patrol required to isolate fault. Prescribed SLA: ${slaHours} hours.`
      : `Lineman must check drop-out (DO) fuse or service cable junction. Prescribed SLA: ${slaHours} hours.`
  };
}

/**
 * Aggregates neighborhood consumer outage diaries to confirm community consensus.
 * @param {Array<Object>} reports 
 * @returns {Object} cluster summary
 */
export function aggregateOutageCluster(reports = []) {
  if (!Array.isArray(reports) || reports.length === 0) {
    return {
      totalConsumersReported: 0,
      isCommunityConsensusConfirmed: false,
      averageOutageHours: 0
    };
  }

  const valid = reports.filter(r => r && (r.transformerId || r.feederName));
  const total = valid.length;
  const totalHours = valid.reduce((acc, curr) => acc + (Number(curr.durationHours) || 0), 0);

  return {
    totalConsumersReported: total,
    isCommunityConsensusConfirmed: total >= 3,
    averageOutageHours: Number((totalHours / (total || 1)).toFixed(1)),
    isMassPowerFailureAlert: total >= 5
  };
}

/**
 * Formats printable statutory complaint / compensation dossier for Executive Engineer (EDD).
 * @param {Object} consumer 
 * @param {Object} diagnosis 
 * @param {Object} cluster 
 * @returns {string} markdown dossier
 */
export function exportOutageGrievanceDossier(consumer = {}, diagnosis = {}, cluster = {}) {
  const discom = UPPCL_DISCOMS[consumer.discomCode] || UPPCL_DISCOMS.MVVNL;

  return [
    `# Statutory Grievance: Persistent Power Outage & SLA Breach`,
    `**Distribution Utility (Discom):** ${discom.name} (\`${discom.code}\`)`,
    `**Sub-Station / 33/11 kV Sub-Center:** ${consumer.substationName || 'Local Sub-station'}`,
    `**Feeder / Transformer Asset:** ${consumer.feederOrTransformerName || 'Village/Colony Transformer'}`,
    `**Consumer Account No (Masked):** \`${consumer.consumerNumber ? `UPPCL-****-${String(consumer.consumerNumber).slice(-4)}` : 'UPPCL-****-XXXX'}\``,
    `**Area Classification:** ${diagnosis.isRural ? 'Rural Area (Gramin)' : 'Urban Area (Nagariya)'}`,
    `**Outage Scope:** ${diagnosis.scopeLabel}`,
    ``,
    `## Outage Timeline & Statutory SLA Analysis`,
    `- Continuous Power Cut Duration: **${diagnosis.reportedDurationHours} Hours**`,
    `- UPERC Prescribed SLA Limit: **${diagnosis.prescribedSlaHours} Hours**`,
    `- Regulatory Violation: ${diagnosis.isSlaBreached ? `⚠️ SLA BREACHED by ${diagnosis.overdueHours} Hours` : 'Within standard restoration window'}`,
    `- Community Corroboration: **${cluster.totalConsumersReported || 1} consumer complaints** logged across this transformer zone.`,
    `- Statutory Compensation Clause: ${diagnosis.statutoryCompensationEligible ? 'Eligible for filing statutory penalty claim under UPERC Standards of Performance Regulations (₹50–₹100 per day of delay).' : 'Normal escalation active.'}`,
    ``,
    `## Formal Demands to Executive Engineer (EDD)`,
    `1. Requisition an immediate replacement transformer from the central workshop or dispatch a mobile trolley transformer to restore supply within 12 hours.`,
    `2. Patrol the 11 kV feeder line and trim tree branches causing recurrent jumper tripping during windstorms.`,
    `3. Issue formal inward receipt and diary number for this representation.`,
    ``,
    `## Regulatory Escalation Pathway`,
    ...UPPCL_ESCALATION_OFFICERS.map(o => `- **${o.designation}** (${o.level}): ${o.role}`),
    ``,
    `---`,
    `> **Privacy Guard:** Consumer connection numbers and payment details are masked. No banking or password credentials collected.`
  ].join('\n');
}


export const UP_ELECTRICITY_FAQS = [
  {
    q: 'How can a consumer file a formal transformer replacement request in UP?',
    a: 'Consumers should dial 1912 to register an outage docket number, then submit a joint representation signed by village residents to the local Junior Engineer (JE) or SDO.'
  },
  {
    q: 'Can Discom officials charge money from villagers to transport a replacement transformer?',
    a: 'No. Transformer movement and installation from the Divisional Workshop to the site is entirely at UPPCL expense. Demanding transport fees from consumers is illegal.'
  },
  {
    q: 'What is the function of the Consumer Grievance Redressal Forum (CGRF)?',
    a: 'CGRF is a statutory quasi-judicial forum set up in every distribution zone under UPERC regulations to adjudicate billing disputes, prolonged outages, and compensation claims.'
  },
  {
    q: 'What is the voltage standard prescribed for single-phase rural connections?',
    a: 'Under the UPERC Supply Code, standard single-phase low tension (LT) supply is 230 V (permissible variation ±6%). Severe low-voltage below 180 V is an actionable service deficiency.'
  }
];

export const UP_POWER_SAVING_AND_SAFETY_NORMS = [
  'Never approach or touch fallen overhead conductors or sparking transformer plinths.',
  'Maintain at least 3 meters clearance from 11 kV high-tension lines while constructing roofs.',
  'Report sagging conductors over agricultural fields immediately to 1912 to prevent tractor electrocution.',
  'Ensure every household installation has a functional Earth Leakage Circuit Breaker (ELCB).'
];

/**
 * Returns procedural FAQs for UPPCL electricity consumers.
 * @returns {Array<{q: string, a: string}>}
 */
export function getElectricityFaqs() {
  return UP_ELECTRICITY_FAQS;
}

/**
 * Returns basic electrical safety guidelines.
 * @returns {Array<string>}
 */
export function getElectricalSafetyNorms() {
  return UP_POWER_SAVING_AND_SAFETY_NORMS;
}


export const UP_TRANSFORMER_CAPACITY_SLABS = [
  { capacityKva: 25, typicalLoadHouseholds: '10 to 15 rural domestic households' },
  { capacityKva: 63, typicalLoadHouseholds: '30 to 40 households or tubewell clusters' },
  { capacityKva: 100, typicalLoadHouseholds: '60 to 80 households or mixed commercial hamlet' },
  { capacityKva: 250, typicalLoadHouseholds: '150+ urban colony apartments or industrial units' },
  { capacityKva: 400, typicalLoadHouseholds: 'High-density commercial town centers' }
];

/**
 * Returns standard transformer capacity sizing references in UP.
 * @returns {Array<Object>}
 */
export function getTransformerCapacitySlabs() {
  return UP_TRANSFORMER_CAPACITY_SLABS;
}
