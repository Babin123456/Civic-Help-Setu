/**
 * UP Public Handpump Repair, Water-Point Downtime and Maintenance Tracker Service
 * 
 * Supports rural residents across Uttar Pradesh dependent on India Mark-II public handpumps
 * administered by Gram Panchayats (Panchayati Raj Department), Jal Nigam (Rural),
 * and Jal Jeevan Mission (JJM / UP State Water and Sanitation Mission - SWSM).
 * 
 * Key Capabilities:
 * - Handpump asset fault diagnostic:
 *   - Broken handle / chain / connecting rod failure
 *   - Worn washer / cylinder leathers / foot-valve leakage (pump drawing air)
 *   - Water column dried / ground-water table drop (requiring pipe re-boring)
 *   - Cracked masonry platform / stagnant wastewater puddle (soak-pit drainage hazard)
 *   - Water quality defect: Yellowish rust / iron contamination or foul smell
 * - Maintenance SLA calculator:
 *   - Minor mechanical repair: 48 to 72 hours (Panchayat repair fund / Block mechanic)
 *   - Re-boring / Deepening: 15 to 30 days (Jal Nigam / District Water & Sanitation Mission)
 * - Multi-household downtime consensus verification (minimum 3 households)
 * - Printable representation for Assistant Development Officer (Panchayat) & BDO
 * - Strict Privacy: No individual resident phone numbers or financial IDs harvested
 */

export const UP_HANDPUMP_MODELS = {
  INDIA_MARK_II: 'India Mark-II Deep Well Handpump (Standard UP rural installation)',
  INDIA_MARK_III: 'India Mark-III Handpump (VLOM - Village Level Operation & Maintenance)',
  EXTRA_DEEP_WELL: 'India Mark-II Extra Deep Well (For Bundelkhand / Vindhyan low water-table zones)'
};

export const HANDPUMP_FAULT_CATEGORIES = {
  MECHANICAL_SURFACE: {
    code: 'MECHANICAL_SURFACE',
    name: 'Surface Component Breakdown (Handle / Chain / Head Assembly)',
    statutorySlaHours: 48,
    remedy: 'Local Village Handpump Mechanic (Gram Mistri) replaces chain, axle bolt, or handle using Gram Panchayat 15th Finance Commission maintenance funds.',
    authorityTier: 'Gram Panchayat Secretary / Gram Pradhan'
  },
  CYLINDER_AND_CONNECTING_ROD: {
    code: 'CYLINDER_AND_CONNECTING_ROD',
    name: 'Subsurface Cylinder, Plunger Rod or Washer Failure',
    statutorySlaHours: 72,
    remedy: 'Lifting connecting rods and replacing rubber washers, bucket leathers, or brass cylinder assembly.',
    authorityTier: 'Block Handpump Repair Gang / ADO (Panchayat)'
  },
  PLATFORM_AND_DRAINAGE_DEFECT: {
    code: 'PLATFORM_AND_DRAINAGE_DEFECT',
    name: 'Cracked Masonry Platform & Lack of Soak-Pit Drainage',
    statutorySlaHours: 120,
    remedy: 'Gram Panchayat constructs cement concrete (CC) apron and soak-pit to prevent stagnant contaminated wastewater from leaching back into the bore.',
    authorityTier: 'Gram Panchayat (Gaon Nidhi Fund)'
  },
  WATER_TABLE_DEPLETED_OR_DRY: {
    code: 'WATER_TABLE_DEPLETED_OR_DRY',
    name: 'Water Column Dried / Deep Re-boring Required',
    statutorySlaHours: 720, // 30 days
    remedy: 'Re-boring and lowering extra 20–30 ft riser pipe assemblies under District Jal Nigam / JJM contingency budget.',
    authorityTier: 'Executive Engineer, UP Jal Nigam (Rural) / CDO'
  },
  WATER_QUALITY_CONTAMINATION: {
    code: 'WATER_QUALITY_CONTAMINATION',
    name: 'Iron Contamination, Sand Ingress or Toxic Turbidity',
    statutorySlaHours: 168, // 7 days
    remedy: 'Water testing through Field Test Kit (FTK) by Jal Sakhi, flushing the bore, or installing iron-removal attachment.',
    authorityTier: 'District Water & Sanitation Mission (DWSM) / PHED Lab'
  }
};

export const UP_WATER_ESCALATION_OFFICERS = [
  { level: 'PANCHAYAT', designation: 'Gram Pradhan & Gram Vikas Adhikari (Secretary)', role: 'Immediate disbursement of repair funds from Gaon Nidhi 15th Finance account' },
  { level: 'BLOCK', designation: 'Assistant Development Officer (Panchayat) / ADO(P)', role: 'Block mobile repair mechanic deployment and monitoring' },
  { level: 'DISTRICT', designation: 'District Panchayat Raj Officer (DPRO) / Executive Engineer (Jal Nigam)', role: 'Re-boring tenders, contractor penalization, and JJM convergence' }
];

/**
 * Diagnoses handpump fault category and prescribes statutory repair SLA.
 * @param {Object} faultSymptoms 
 * @returns {Object} diagnostic assessment
 */
export function diagnoseHandpumpFault(faultSymptoms = {}) {
  let matchedCategory = HANDPUMP_FAULT_CATEGORIES.MECHANICAL_SURFACE;

  if (faultSymptoms.isWaterDriedOrSeasonallyDry) {
    matchedCategory = HANDPUMP_FAULT_CATEGORIES.WATER_TABLE_DEPLETED_OR_DRY;
  } else if (faultSymptoms.hasWaterDiscolorationOrSmell) {
    matchedCategory = HANDPUMP_FAULT_CATEGORIES.WATER_QUALITY_CONTAMINATION;
  } else if (faultSymptoms.isPlatformCrackedOrWaterlogged) {
    matchedCategory = HANDPUMP_FAULT_CATEGORIES.PLATFORM_AND_DRAINAGE_DEFECT;
  } else if (faultSymptoms.isPumpDrawingAirOrNoWaterWhileHandleMoves) {
    matchedCategory = HANDPUMP_FAULT_CATEGORIES.CYLINDER_AND_CONNECTING_ROD;
  }

  const downtimeDays = Number(faultSymptoms.downtimeDays) || 0;
  const slaDays = Math.ceil(matchedCategory.statutorySlaHours / 24);
  const isOverdue = downtimeDays > slaDays;

  return {
    faultCode: matchedCategory.code,
    faultName: matchedCategory.name,
    prescribedSlaHours: matchedCategory.statutorySlaHours,
    statutorySlaDays: slaDays,
    downtimeDaysRecorded: downtimeDays,
    isSlaBreached: isOverdue,
    overdueDays: isOverdue ? downtimeDays - slaDays : 0,
    technicalRemedy: matchedCategory.remedy,
    responsibleAuthority: matchedCategory.authorityTier
  };
}

/**
 * Aggregates neighborhood downtime reports requiring minimum 3 verified households.
 * @param {Array<Object>} householdReports 
 * @returns {Object} consensus status
 */
export function aggregateHandpumpDowntimeReports(householdReports = []) {
  if (!Array.isArray(householdReports) || householdReports.length === 0) {
    return {
      totalHouseholdsReported: 0,
      hasCommunityConsensus: false,
      isDrinkingWaterCrisis: false
    };
  }

  const valid = householdReports.filter(r => r && r.handpumpId);
  const total = valid.length;
  const noAlternativeSource = valid.filter(r => r.noAlternativeDrinkingWaterSource).length;

  return {
    totalHouseholdsReported: total,
    hasCommunityConsensus: total >= 3,
    noAlternativeSourceCount: noAlternativeSource,
    isDrinkingWaterCrisis: total >= 3 && noAlternativeSource >= 2,
    urgencyPriority: (total >= 3 && noAlternativeSource >= 2) ? 'CRITICAL_WATER_STRESS' : 'STANDARD_MAINTENANCE'
  };
}

/**
 * Formats representation memorandum for Assistant Development Officer (Panchayat).
 * @param {Object} handpumpDetails 
 * @param {Object} diagnosis 
 * @param {Object} community 
 * @returns {string} markdown memorandum
 */
export function exportHandpumpGrievanceMemo(handpumpDetails = {}, diagnosis = {}, community = {}) {
  return [
    `# Public Handpump Repair Requisition & Downtime Escalation`,
    `**Handpump Asset Reference:** \`${handpumpDetails.handpumpId || 'HP-UP-****-XXXX'}\``,
    `**Location / Majra:** ${handpumpDetails.majraOrHamlet || 'Hamlet'}, Gram Panchayat: ${handpumpDetails.gramPanchayat || 'Gram Panchayat'}`,
    `**Vikas Khand (Block):** ${handpumpDetails.block || 'Block'}, **District:** ${handpumpDetails.district || 'Uttar Pradesh'}`,
    `**Downtime Duration:** ${diagnosis.downtimeDaysRecorded} days (Statutory SLA: ${diagnosis.statutorySlaDays} days)`,
    `**Affected Households:** ${community.totalHouseholdsReported || 1} families (Consensus: ${community.hasCommunityConsensus ? 'CONFIRMED' : 'Logged'})`,
    ``,
    `## Diagnostic Fault Assessment`,
    `- Fault Nature: **${diagnosis.faultName}**`,
    `- SLA Breach: ${diagnosis.isSlaBreached ? `⚠️ OVERDUE by ${diagnosis.overdueDays} days` : 'Within permissible response window'}`,
    `- Required Technical Remediation: ${diagnosis.technicalRemedy}`,
    `- Responsible Administrative Tier: **${diagnosis.responsibleAuthority}**`,
    ``,
    `## Emergency Demand on Gram Panchayat Gaon Nidhi Funds`,
    `1. Direct the village Panchayat Secretary (Gram Vikas Adhikari) to release required maintenance expenditure from the untied 15th Finance Commission rural water grant.`,
    `2. Dispatch the block mobile handpump repair technician / mistri within 24 hours to replace worn washers and re-set the cylinder head.`,
    `3. If water table depletion is confirmed, forward the file immediately to the Executive Engineer, Jal Nigam for inclusion in the emergency re-boring schedule.`,
    ``,
    `## Escalation Contacts`,
    ...UP_WATER_ESCALATION_OFFICERS.map(o => `- **${o.designation}** (${o.level}) — *Role:* ${o.role}`),
    ``,
    `---`,
    `> **Citizen Accountability:** Verified through community consensus. No individual citizen identity or personal phone records stored.`
  ].join('\n');
}


export const UP_HANDPUMP_MAINTENANCE_FAQS = [
  {
    q: 'Can a Gram Pradhan refuse to repair a public handpump due to lack of funds?',
    a: 'No. The 15th Finance Commission untied grants allocated to every Gram Panchayat contain dedicated tied allocations for rural drinking water and sanitation maintenance.'
  },
  {
    q: 'How can citizens test if handpump water has excess iron or fluoride?',
    a: 'Under Jal Jeevan Mission, trained village women (Jal Sakhis) are equipped with Field Test Kits (FTKs) to perform spot testing for pH, hardness, chloride, iron, and fluoride.'
  },
  {
    q: 'What is the procedure if a handpump runs completely dry during peak summer?',
    a: 'The Gram Panchayat must pass a proposal for re-boring to lower depths (usually 120-180 ft) and submit it to the Block ADO (Panchayat) for Jal Nigam rig scheduling.'
  },
  {
    q: 'Is private locking of a government public handpump permissible?',
    a: 'No. Enclosing or locking a public handpump erected on public land (Gaon Sabha land) is illegal and constitutes an offense under UP Panchayati Raj rules.'
  }
];

export const UP_WATER_TESTING_PARAMETERS = [
  { parameter: 'Iron (Fe)', desirableLimitMgPerL: '0.3 mg/L', symptom: 'Yellowish/reddish color, metallic taste, stains laundry' },
  { parameter: 'Fluoride (F)', desirableLimitMgPerL: '1.0 mg/L (max 1.5)', symptom: 'Dental fluorosis (yellow/brown teeth) and skeletal stiffness' },
  { parameter: 'Total Dissolved Solids (TDS)', desirableLimitMgPerL: '500 mg/L', symptom: 'Salty/brackish taste' },
  { parameter: 'Coliform / E. Coli Bacteria', desirableLimitMgPerL: '0 / 100 mL', symptom: 'Diarrhea, stomach cramps, water-borne gastrointestinal infections' }
];

/**
 * Returns procedural FAQs for rural drinking water maintenance.
 * @returns {Array<{q: string, a: string}>}
 */
export function getHandpumpFaqs() {
  return UP_HANDPUMP_MAINTENANCE_FAQS;
}

/**
 * Returns water quality testing parameters under Jal Jeevan Mission.
 * @returns {Array<Object>}
 */
export function getWaterTestingParameters() {
  return UP_WATER_TESTING_PARAMETERS;
}


export const UP_HANDPUMP_SPARE_PARTS = [
  'India Mark-II Nitrile Rubber Bucket Washer (63.5 mm)',
  'Hexagonal Connecting Rod (12 mm dia, 3-meter length) with welded sockets',
  'Gunmetal / Brass Foot Valve Assembly',
  'Chain Assembly with connecting bolt and lock nut',
  'Handle Axle Pin with brass bushes and circlips'
];

/**
 * Returns standard spare parts catalogue for India Mark-II maintenance.
 * @returns {Array<string>}
 */
export function getHandpumpSparePartsCatalogue() {
  return UP_HANDPUMP_SPARE_PARTS;
}
