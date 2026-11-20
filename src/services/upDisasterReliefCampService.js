/**
 * UP Disaster Relief Camp Resource and Accessibility Status Network Service
 * 
 * Supports emergency management and displaced citizens during seasonal floods,
 * cold waves, or extreme weather events across flood-prone Uttar Pradesh districts
 * (e.g. Gorakhpur, Balrampur, Bahraich, Prayagraj, Varanasi, Lakhimpur Kheri)
 * under the UP State Disaster Management Authority (UPSDMA) & Relief Commissioner (rahat.up.gov.in).
 * 
 * Key Capabilities:
 * - Real-time camp status validation: Capacity, occupancy, and intake openness
 * - Core humanitarian amenity metrics: Potable drinking water, clean sanitation/toilets,
 *   infant baby food/milk, essential emergency medicine/ORS, mobile charging points
 * - Accessibility ratings for vulnerable groups: Wheelchair ramps, elder beds, lit paths, female-separated toilets
 * - Supply bottleneck & stock-out risk assessment
 * - Printable emergency administrative situation report (SitRep) for District Magistrate / Additional DM (Finance & Revenue)
 * - Strict disaster privacy: Zero beneficiary names, photos of victims, or personal biometric info
 */

export const UP_RELIEF_FACILITIES = {
  DRINKING_WATER: 'POTABLE_DRINKING_WATER',
  SANITATION_SEPARATE_TOILETS: 'SANITATION_SEPARATE_TOILETS',
  INFANT_BABY_FOOD: 'INFANT_BABY_FOOD_AND_MILK',
  FIRST_AID_AND_ORS: 'FIRST_AID_ANTIVENOM_ORS',
  MOBILE_CHARGING_STATION: 'MOBILE_CHARGING_AND_COMMUNICATION',
  LIGHTING_AND_DG_BACKUP: 'SOLAR_OR_DG_NIGHT_LIGHTING'
};

export const UP_RELIEF_ESCALATION = [
  { level: 'BLOCK_TEHSIL', authority: 'Tehsildar / Sub-Divisional Magistrate (SDM)', role: 'Camp administration & daily food supply verification' },
  { level: 'DISTRICT', authority: 'Additional District Magistrate (Finance & Revenue) / District Relief Officer', role: 'District Emergency Operations Centre (DEOC) coordination' },
  { level: 'STATE', authority: 'Relief Commissioner, Government of UP (rahat.up.gov.in)', role: 'Statewide SDRF / NDRF deployment and budget sanction' }
];

/**
 * Assesses humanitarian sufficiency and capacity status of a relief shelter.
 * @param {Object} campData 
 * @returns {Object} assessment
 */
export function assessReliefCampReadiness(campData = {}) {
  const capacity = Number(campData.maxCapacityPersons) || 100;
  const occupancy = Number(campData.currentOccupancyPersons) || 0;
  const occupancyRate = Math.min(100, Math.round((occupancy / Math.max(1, capacity)) * 100));

  const hasPotableWater = Boolean(campData.hasPotableWater);
  const hasMedicalSupport = Boolean(campData.hasMedicalOfficerOrORS);
  const hasSeparatedSanitation = Boolean(campData.hasGenderSeparatedSanitation);
  const hasInfantSupplies = Boolean(campData.hasInfantFoodOrMilk);

  let readinessScore = 0;
  if (hasPotableWater) readinessScore += 30;
  if (hasMedicalSupport) readinessScore += 25;
  if (hasSeparatedSanitation) readinessScore += 25;
  if (hasInfantSupplies) readinessScore += 20;

  const isFull = occupancy >= capacity;
  const criticalShortages = [];
  if (!hasPotableWater) criticalShortages.push('No Potable Drinking Water Available (High Risk)');
  if (!hasMedicalSupport) criticalShortages.push('No Doctor / Paramedic / ORS Packets at Camp');
  if (!hasSeparatedSanitation) criticalShortages.push('No Female-Separated Sanitation Enclosures');

  return {
    campId: campData.campId || 'CAMP-UNSPECIFIED',
    campName: campData.campName || 'Community Relief Shelter',
    district: campData.district || 'Uttar Pradesh',
    capacity,
    occupancy,
    occupancyRate,
    isOpenForIntake: !isFull && (campData.isOperational !== false),
    readinessScore,
    statusLevel: readinessScore >= 80 ? 'SATISFACTORY' : readinessScore >= 50 ? 'PARTIAL' : 'CRITICAL_DEFICIT',
    criticalShortages,
    requiresImmediateReliefDispatch: criticalShortages.length > 0 || occupancyRate > 95
  };
}

/**
 * Evaluates physical accessibility for elderly and disabled evacuees.
 * @param {Object} accessibilityFeatures 
 * @returns {Object} accessibility rating
 */
export function evaluateCampAccessibility(accessibilityFeatures = {}) {
  const checks = [
    { name: 'Wheelchair / Stretcher Ramp at Entrance', available: Boolean(accessibilityFeatures.hasRamp) },
    { name: 'Ground Floor Bedding / Low Cot Arrangement', available: Boolean(accessibilityFeatures.hasGroundFloorBeds) },
    { name: 'Illuminated Path to Latrines at Night', available: Boolean(accessibilityFeatures.hasIlluminatedLatrinePath) },
    { name: 'Accessible / Western Height Toilet Commode', available: Boolean(accessibilityFeatures.hasAccessibleToilet) }
  ];

  const metCount = checks.filter(c => c.available).length;
  const score = Math.round((metCount / checks.length) * 100);

  return {
    accessibilityScore: score,
    isDivyangjanFriendly: score >= 75,
    checks,
    recommendation: score < 75
      ? 'Action Required: Install temporary wooden ramps, emergency solar lantern on toilet route, and reserved ground-level cots.'
      : 'Camp meets core accessible disaster evacuation standards.'
  };
}

/**
 * Formats a Situation Report (SitRep) for the District Emergency Operations Centre (DEOC) / DM.
 * @param {Object} readiness 
 * @param {Object} accessibility 
 * @returns {string} markdown SitRep
 */
export function exportReliefCampSitRep(readiness = {}, accessibility = {}) {
  return [
    `# Disaster Relief Shelter Situation Report (SitRep)`,
    `**Facility Name:** ${readiness.campName} (\`${readiness.campId}\`)`,
    `**District:** ${readiness.district}, **Date:** ${new Date().toLocaleDateString('en-IN')}`,
    `**Intake Status:** ${readiness.isOpenForIntake ? '🟢 OPEN FOR INTAKE' : '🔴 FULL / RESTRICTED'}`,
    `**Capacity & Load:** ${readiness.occupancy} / ${readiness.capacity} evacuees (${readiness.occupancyRate}% utilized)`,
    ``,
    `## Humanitarian Adequacy Assessment`,
    `- Readiness Score: **${readiness.readinessScore}/100 (${readiness.statusLevel})**`,
    `- Critical Supply Shortages:`,
    ...(readiness.criticalShortages?.length > 0
      ? readiness.criticalShortages.map(s => `  - ⚠️ ${s}`)
      : ['  - None reported. Baseline water, food, and medical supplies present.']),
    ``,
    `## Vulnerable Group & Disability Accessibility`,
    `- Accessibility Rating: **${accessibility.accessibilityScore || 0}%** (${accessibility.isDivyangjanFriendly ? 'Accessible' : 'Restricted Barrier'})`,
    `- Recommendation: ${accessibility.recommendation || 'Maintain accessibility norms.'}`,
    ``,
    `## Recommended Immediate Administrative Actions`,
    `1. Deploy water tanker or packaged chlorine treatment tablets if potable water is stressed.`,
    `2. Direct Primary Health Centre (PHC) medical team to conduct daily health checks and distribute halogen tablets / ORS.`,
    `3. Coordinate with District Supply Officer (DSO) for continuous community kitchen (Langar/Rasoi) dry ration supplies.`,
    ``,
    `---`,
    `> **Humanitarian Privacy Standard:** Zero beneficiary names, victim facial photographs, or private personal data collected.`
  ].join('\n');
}


export const UP_FLOOD_PRONE_DISTRICTS = [
  { district: 'Gorakhpur', riverBasin: 'Rapti & Rohini', vulnerableTehsils: ['Sadar', 'Sahjanwa', 'Campierganj', 'Chauri Chaura', 'Khajni', 'Bansgaon', 'Gola'] },
  { district: 'Balrampur', riverBasin: 'Rapti', vulnerableTehsils: ['Balrampur Sadar', 'Tulsipur', 'Utraula'] },
  { district: 'Bahraich', riverBasin: 'Ghaghra & Saryu', vulnerableTehsils: ['Mahasi', 'Nanpara', 'Kaiserganj', 'Mihinpurwa'] },
  { district: 'Prayagraj', riverBasin: 'Ganga & Yamuna', vulnerableTehsils: ['Sadar', 'Phaphamau', 'Koraon', 'Bara', 'Karchhana'] },
  { district: 'Varanasi', riverBasin: 'Ganga & Varuna', vulnerableTehsils: ['Varanasi Sadar', 'Pindra'] },
  { district: 'Lakhimpur Kheri', riverBasin: 'Sharda & Ghaghra', vulnerableTehsils: ['Palia', 'Nighasan', 'Dhaurahra', 'Gola Gokrannath'] }
];

export const UP_EMERGENCY_DISASTER_NUMBERS = [
  { service: 'UP Relief Commissioner Control Room', number: '1070', note: 'State Level 24x7 Emergency' },
  { service: 'State Disaster Response Force (SDRF) Control', number: '0522-2236315', note: 'Boat and water rescue deployment' },
  { service: 'National Disaster Response Force (NDRF 11 Bn)', number: '0542-2621004', note: 'Eastern UP HQ (Varanasi)' },
  { service: 'Integrated Emergency Service', number: '112', note: 'Police, Fire, and Ambulance response' }
];

/**
 * Returns list of high flood-risk districts and river basins in UP.
 * @returns {Array<Object>}
 */
export function getFloodProneDistricts() {
  return UP_FLOOD_PRONE_DISTRICTS;
}

/**
 * Returns emergency disaster contact helplines.
 * @returns {Array<Object>}
 */
export function getEmergencyDisasterContacts() {
  return UP_EMERGENCY_DISASTER_NUMBERS;
}


export const UP_RELIEF_SOP_GUIDELINES = [
  'Every flood shelter must have a designated Nodal Officer (Naib Tehsildar or Block Education Officer).',
  'Water quality testing kits (chloroscope) must be utilized twice daily by Jal Sansthan engineers.',
  'Food preparation in community kitchens must adhere strictly to food safety and hygiene protocols with fresh cooked meals twice a day.',
  'Daily stock status of chlorine tablets, zinc/ORS, and paracetamol must be updated with the District Chief Medical Officer (CMO).',
  'Special security arrangements including women police constables must be deployed for night safety at camps.'
];

/**
 * Returns Standard Operating Procedures (SOPs) for disaster shelter management.
 * @returns {Array<string>}
 */
export function getReliefShelterSops() {
  return UP_RELIEF_SOP_GUIDELINES;
}


export const UP_COMMUNITY_KITCHEN_RATIO_NORMS = {
  GRAIN_PER_PERSON_PER_DAY_GRAMS: 450,
  PULSES_PER_PERSON_PER_DAY_GRAMS: 100,
  OIL_PER_PERSON_PER_DAY_GRAMS: 25,
  MILK_PER_INFANT_PER_DAY_ML: 500,
  POTABLE_WATER_PER_PERSON_PER_DAY_LITRES: 15
};

/**
 * Returns minimum dietary and humanitarian ration norms for community relief kitchens.
 * @returns {Object}
 */
export function getCommunityKitchenNorms() {
  return UP_COMMUNITY_KITCHEN_RATIO_NORMS;
}


export const UP_RELIEF_KIT_ITEMS = [
  'Tarpaulin sheets (tirpal) for temporary waterproofing',
  'Mosquito repellent nets (machhardani) treated with insecticide',
  'Water purification chlorine drops (chlorine goli)',
  'Matchbox, candles, and waterproof emergency pouch',
  'Sanitary pads and personal hygiene soap bars'
];

/**
 * Returns contents of standard UP Government flood relief family kit.
 * @returns {Array<string>}
 */
export function getStandardReliefKitItems() {
  return UP_RELIEF_KIT_ITEMS;
}
