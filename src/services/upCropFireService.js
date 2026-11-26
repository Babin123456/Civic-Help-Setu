/**
 * UP Crop-Residue Fire Incident Reporting and Response Coordination Tool Service
 * 
 * Supports citizens, village watchmen (Gram Chowkidar), and environmental responders
 * monitoring farm and roadside crop-residue / stubble fires (Parali Dahan) across
 * Uttar Pradesh under the Commission for Air Quality Management (CAQM),
 * UP Pollution Control Board (UPPCB), and Department of Agriculture.
 * 
 * Key Capabilities:
 * - Immediate safety emergency triage: Distinguishes fast-spreading fires threatening
 *   residential huts, grain godowns, or high-tension power lines (directing to Dial 112 / Fire 101)
 *   versus contained field burning
 * - Satellite & Ground Incident Verification: Geospatial proximity clustering (within 1.5 km and 3 hours)
 *   to avoid duplicate administrative dispatch
 * - Escalation Matrix: Lekhpal & Gram Pradhan -> Agriculture Technical Assistant -> SDM / Tehsildar
 * - In-situ Crop Residue Management (CRM) subsidy guide (Super Seeder, Happy Seeder, Straw Baler, Bio-decomposer)
 * - Printable Field Verification Report for District Agriculture Officer (DAO)
 * - Strict Privacy: No individual farmer names or punitive accusations without multi-witness confirmation
 */

export const UP_FIRE_RESPONSE_SERVICES = [
  { service: 'Fire & Rescue Service', number: '101', role: 'Immediate fire tender dispatch for life & asset protection' },
  { service: 'Police & Integrated Emergency', number: '112', role: 'Rapid response team and roadblock control' },
  { service: 'UPPCB Air Quality Helpline', number: '0522-2720828', role: 'Environmental monitoring and air quality index tracking' },
  { service: 'Kisan Call Centre', number: '1800-180-1551', role: 'Advisory on crop residue management machinery subsidies' }
];

export const UP_FIRE_ESCALATION_OFFICERS = [
  { level: 'VILLAGE', authority: 'Lekhpal / Gram Pradhan / Gram Chowkidar', role: 'Immediate field arrival and local fire suppression' },
  { level: 'BLOCK', authority: 'Assistant Development Officer (Agriculture) / BDO', role: 'Deployment of tractor-mounted water tankers' },
  { level: 'TEHSIL', authority: 'Sub-Divisional Magistrate (SDM) / Tehsildar', role: 'Enforcement of Section 144 / Air Act orders and environmental compensation' },
  { level: 'DISTRICT', authority: 'District Agriculture Officer (DAO) / District Magistrate', role: 'Overall nodal control and CAQM compliance monitoring' }
];

export const CRM_EQUIPMENT_SUBSIDIES = {
  SUPER_SEEDER: {
    name: 'Super Seeder',
    purpose: 'Simultaneous tilling, sowing wheat, and mulching standing paddy stubble.',
    subsidyRatePercent: 50,
    maxSubsidyINR: 105000,
    customHiringCentreSubsidyPercent: 80
  },
  HAPPY_SEEDER: {
    name: 'Happy Seeder',
    purpose: 'Direct drilling of wheat into heavy standing straw without burning.',
    subsidyRatePercent: 50,
    maxSubsidyINR: 75000,
    customHiringCentreSubsidyPercent: 80
  },
  STRAW_BALER: {
    name: 'Straw Baler & Rake',
    purpose: 'Ex-situ residue collection into compressed square or round straw bales for biomass power/dairy.',
    subsidyRatePercent: 50,
    maxSubsidyINR: 200000,
    customHiringCentreSubsidyPercent: 80
  },
  BIO_DECOMPOSER: {
    name: 'Pusa Bio-Decomposer Spray',
    purpose: 'Microbial spray decomposing stubble into organic compost in-situ within 20–25 days.',
    subsidyRatePercent: 100,
    maxSubsidyINR: 'Free distribution through Block Agriculture Office',
    customHiringCentreSubsidyPercent: 100
  }
};

/**
 * Triages a reported crop fire and evaluates immediate safety risk.
 * @param {Object} incident 
 * @returns {Object} triage result
 */
export function triageCropFireIncident(incident = {}) {
  const isThreateningStructures = Boolean(incident.isNearHutsOrHouses || incident.isNearGrainGodown);
  const isNearPowerLines = Boolean(incident.isNearHighTensionLines);
  const isHeavySmokeOnHighway = Boolean(incident.isCausingHighwayZeroVisibility);

  const isEmergency = isThreateningStructures || isNearPowerLines || isHeavySmokeOnHighway;

  let emergencyAction = 'Log for Revenue Inspector / Lekhpal field verification within 4 hours.';
  if (isEmergency) {
    emergencyAction = 'CRITICAL EMERGENCY: Immediately dial 112 / 101 for fire tender dispatch. Stubble fire threatens human settlements, electrical grid, or major road transit.';
  }

  return {
    incidentId: incident.incidentId || `FIRE-UP-${Date.now()}`,
    isEmergency,
    urgencyLevel: isEmergency ? 'HIGH_PRIORITY_EMERGENCY' : 'STANDARD_ENVIRONMENTAL_MONITORING',
    immediateAction: emergencyAction,
    recommendedHotlines: isEmergency ? ['101', '112'] : ['1800-180-1551'],
    threatFactors: {
      threateningHutsOrHouses: isThreateningStructures,
      nearHighTensionLines: isNearPowerLines,
      highwayVisibilityImpaired: isHeavySmokeOnHighway
    }
  };
}

/**
 * Clusters reported incidents to eliminate duplicate citizen dispatch.
 * Considers incidents within 1.5 km distance and within 3 hours of elapsed time as duplicates.
 * @param {Object} newIncident 
 * @param {Array<Object>} existingIncidents 
 * @returns {Object} deduplication decision
 */
export function clusterFireIncidents(newIncident = {}, existingIncidents = []) {
  if (!Array.isArray(existingIncidents) || existingIncidents.length === 0) {
    return {
      isDuplicate: false,
      clusterLeaderId: newIncident.incidentId || 'INC-LEADER',
      existingClusterSize: 1
    };
  }

  const newTime = new Date(newIncident.timestamp || Date.now()).getTime();
  const maxDistanceKm = 1.5;
  const maxTimeDiffHours = 3;

  for (const existing of existingIncidents) {
    const exTime = new Date(existing.timestamp).getTime();
    const timeDiffHours = Math.abs(newTime - exTime) / (1000 * 60 * 60);

    // Approximate distance check if lat/lon provided
    const latDiff = Math.abs((Number(newIncident.latitude) || 0) - (Number(existing.latitude) || 0));
    const lonDiff = Math.abs((Number(newIncident.longitude) || 0) - (Number(existing.longitude) || 0));
    const isNearby = latDiff < 0.015 && lonDiff < 0.015; // ~1.5 km

    if (timeDiffHours <= maxTimeDiffHours && isNearby) {
      return {
        isDuplicate: true,
        clusterLeaderId: existing.incidentId,
        existingClusterSize: (existing.duplicateReportCount || 1) + 1,
        message: 'Incident already reported by another observer in this coordinate cluster.'
      };
    }
  }

  return {
    isDuplicate: false,
    clusterLeaderId: newIncident.incidentId,
    existingClusterSize: 1
  };
}

/**
 * Formats printable field verification report for District Agriculture Officer.
 * @param {Object} incident 
 * @param {Object} triage 
 * @returns {string} markdown report
 */
export function exportCropFireVerificationReport(incident = {}, triage = {}) {
  return [
    `# Agricultural Fire Incident Verification Report`,
    `**Incident Reference:** \`${triage.incidentId}\``,
    `**Village / Gram Panchayat:** ${incident.village || 'Local Village'}, **Tehsil:** ${incident.tehsil || 'Concerned Tehsil'}`,
    `**District:** ${incident.district || 'Uttar Pradesh'}, **Date/Time:** ${incident.timestamp || new Date().toLocaleString('en-IN')}`,
    `**Triage Classification:** ${triage.urgencyLevel}`,
    ``,
    `## Fire Hazard & Danger Assessment`,
    `- High-Risk Life/Property Threat: ${triage.isEmergency ? '⚠️ YES — Immediate danger' : 'No direct residential threat'}`,
    `- Field Action Recommended: ${triage.immediateAction}`,
    `- Proximity to High-Tension Lines: ${triage.threatFactors?.nearHighTensionLines ? 'YES (High Grid Risk)' : 'NO'}`,
    `- Highway Smoke Hazard: ${triage.threatFactors?.highwayVisibilityImpaired ? 'YES (Accident Hazard)' : 'NO'}`,
    ``,
    `## Sustainable Residue Management Interventions`,
    `- Promote Custom Hiring Centre (CHC) availability for Happy Seeder and Straw Balers.`,
    `- Distribute Pusa Bio-Decomposer capsules through the Village Agriculture Assistant (Kisan Sahayak).`,
    `- Convene Gram Sabha awareness sessions highlighting soil microbial loss caused by stubble burning.`,
    ``,
    `## Field Escalation Matrix`,
    ...UP_FIRE_ESCALATION_OFFICERS.map(o => `- **${o.authority}** (${o.level}) — *Role:* ${o.role}`),
    ``,
    `---`,
    `> **Citizen Protection:** Individual farmer identities are kept confidential to encourage collaborative remediation over punitive confrontation.`
  ].join('\n');
}


export const UP_STUBBLE_BURNING_LEGAL_FRAMEWORK = {
  SUPREME_COURT_MANDATE: 'Supreme Court directions in MC Mehta case prohibiting agricultural burning in NCR and adjoining states.',
  CAQM_ACT: 'Section 14 of the Commission for Air Quality Management in National Capital Region and Adjoining Areas Act, 2021.',
  ENVIRONMENTAL_COMPENSATION_SLABS: [
    { landHolding: 'Less than 2 acres', penaltyINR: 2500 },
    { landHolding: '2 to 5 acres', penaltyINR: 5000 },
    { landHolding: 'More than 5 acres', penaltyINR: 15000 }
  ],
  RED_ENTRY_DISQUALIFICATION: 'Adverse Red Entry (Laal Indraj) in Khatauni revenue record restricting PM-KISAN benefits and cooperative seed/fertilizer loans.'
};

/**
 * Returns legal framework and statutory environmental compensation slabs.
 * @returns {Object}
 */
export function getStubbleLegalFramework() {
  return UP_STUBBLE_BURNING_LEGAL_FRAMEWORK;
}


export const UP_CRM_HOTLINE_ADVISORY = [
  'Farmers can locate the nearest active Custom Hiring Centre (CHC) via the UP Agriculture Department mobile app.',
  'Pusa Bio-Decomposer spraying should be carried out immediately after combine harvesting with moisture in soil.',
  'Tractor-mounted straw reapers must not be operated without fire-extinguisher spark arresters during dry windy afternoons.',
  'Village Panchayats can requisition community water tankers from the Block Development Office during harvest season.'
];

/**
 * Returns practical field advisory notes for stubble management.
 * @returns {Array<string>}
 */
export function getCrmAdvisoryNotes() {
  return UP_CRM_HOTLINE_ADVISORY;
}
