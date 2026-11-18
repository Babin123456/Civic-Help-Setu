/**
 * UP Public Cremation and Burial Ground Facility Information and Maintenance Directory Service
 * 
 * Supports bereaved citizens, civic volunteers, and municipal authorities navigating public
 * cremation grounds (Shamshan Ghat / Mokshadham / Electric & CNG Crematoriums) and burial grounds
 * (Kabristan / Qabristan / Christian Cemeteries) across Uttar Pradesh under Urban Local Bodies
 * (Nagar Nigam / Nagar Palika) and Panchayati Raj (Antyeshti Sthal Yojana).
 * 
 * Key Capabilities:
 * - Public facility directory and amenity assessment:
 *   - Type of facility (Electric, CNG gasifier, traditional wood pyre platform)
 *   - Essential basic amenities: Running water taps, covered waiting shed (Varandah),
 *     solar/electric lighting for night access, paved access approach road, functional boundary wall
 *   - Official municipal fee schedule transparency to prevent extortion by unauthorized middlemen
 * - Community maintenance feedback logging: Missing lights, dilapidated shed roofs, broken water taps
 * - Printable representation memorandum for Municipal Commissioner / Executive Officer (EO) / DPRO
 * - Strict Bereavement Privacy: Zero names of deceased individuals, no death causes, and zero photos of funeral rituals or grieving families
 */

export const UP_FACILITY_TYPES = {
  ELECTRIC_CREMATORIUM: {
    code: 'ELECTRIC_CREMATORIUM',
    name: 'Electric Crematorium (Vidyut Shavdah Grih)',
    fuelType: 'ELECTRIC',
    isEcoFriendly: true
  },
  CNG_GAS_CREMATORIUM: {
    code: 'CNG_GAS_CREMATORIUM',
    name: 'CNG Gasifier Crematorium (CNG Shavdah Grih)',
    fuelType: 'CNG_GAS',
    isEcoFriendly: true
  },
  TRADITIONAL_PYRE_GHAT: {
    code: 'TRADITIONAL_PYRE_GHAT',
    name: 'Traditional Wood Cremation Ground (Mokshadham / Antyeshti Sthal)',
    fuelType: 'FIREWOOD_AND_COW_DUNG_LOGS',
    isEcoFriendly: false
  },
  BURIAL_GROUND_KABRISTAN: {
    code: 'BURIAL_GROUND_KABRISTAN',
    name: 'Public Burial Ground (Kabristan / Qabristan)',
    fuelType: 'EARTH_BURIAL',
    isEcoFriendly: true
  },
  CHRISTIAN_CEMETERY: {
    code: 'CHRISTIAN_CEMETERY',
    name: 'Christian Cemetery / Kabristan',
    fuelType: 'EARTH_BURIAL',
    isEcoFriendly: true
  }
};

export const UP_CREMATION_ESCALATION = [
  { level: 'URBAN_WARD', title: 'Sanitary Inspector / Ward Junior Engineer', role: 'Daily sanitation, water supply, and lighting verification' },
  { level: 'MUNICIPALITY', title: 'Health Officer / Executive Officer (EO) / Municipal Commissioner', role: 'Crematorium contractor oversight and fee schedule enforcement' },
  { level: 'RURAL_DISTRICT', title: 'District Panchayat Raj Officer (DPRO) / BDO', role: 'Antyeshti Sthal scheme civil maintenance fund release' }
];

/**
 * Assesses civil amenities and infrastructure adequacy of a cremation or burial site.
 * @param {Object} facilityData 
 * @returns {Object} assessment
 */
export function assessFacilityInfrastructure(facilityData = {}) {
  const issues = [];
  let score = 100;

  if (!facilityData.hasRunningWater) {
    score -= 25;
    issues.push('No functional running water tap or handpump for bathing/ablution rites.');
  }

  if (!facilityData.hasCoveredShed) {
    score -= 25;
    issues.push('Missing or damaged covered waiting shed (citizens exposed to rain/sun).');
  }

  if (!facilityData.hasNightLighting) {
    score -= 20;
    issues.push('Missing or non-functional solar/electric illumination for evening or night cremations.');
  }

  if (!facilityData.hasPavedRoadAccess) {
    score -= 15;
    issues.push('Unpaved or waterlogged approach road restricting hearse/funeral procession movement.');
  }

  if (!facilityData.hasBoundaryWallOrGate) {
    score -= 15;
    issues.push('No protective boundary wall (stray animal ingress and sanitation hazard).');
  }

  const finalScore = Math.max(0, score);
  let status = 'WELL_MAINTAINED';
  if (finalScore < 50) status = 'CRITICAL_NEGLECT';
  else if (finalScore < 80) status = 'NEEDS_MAINTENANCE';

  return {
    facilityId: facilityData.facilityId ? `FAC-UP-****-${String(facilityData.facilityId).slice(-4)}` : 'FAC-UNKNOWN',
    facilityName: facilityData.facilityName || 'Public Cremation / Burial Ground',
    location: facilityData.location || 'Local Ward/Village',
    district: facilityData.district || 'Uttar Pradesh',
    amenityScore: finalScore,
    status,
    identifiedIssues: issues,
    requiresMunicipalIntervention: finalScore < 80
  };
}

/**
 * Validates municipal fee transparency and flags unauthorized middleman extortion.
 * Standard statutory fee for electric/CNG crematorium in UP ULBs: ₹500 to ₹1,000 (often free for BPL).
 * @param {Object} feeDetails 
 * @returns {Object} fee analysis
 */
export function checkFeeTransparency(feeDetails = {}) {
  const officialRateINR = Number(feeDetails.officialRateINR) || 500;
  const chargedRateINR = Number(feeDetails.chargedRateINR) || 0;
  const isOverchargingReported = chargedRateINR > officialRateINR;

  return {
    officialRateINR,
    chargedRateINR,
    isOverchargingReported,
    excessAmountChargedINR: isOverchargingReported ? chargedRateINR - officialRateINR : 0,
    hasOfficialRateBoardDisplayed: Boolean(feeDetails.hasOfficialRateBoardDisplayed),
    advisory: isOverchargingReported
      ? `Overcharging alert: Municipal statutory charge is ₹${officialRateINR}, but ₹${chargedRateINR} was demanded. Report extortion to the Municipal Health Officer or 1533.`
      : 'Compliant with prescribed municipal rate schedule.'
  };
}

/**
 * Formats printable memorandum for Municipal Commissioner / Executive Officer (EO).
 * @param {Object} facility 
 * @param {Object} feeAnalysis 
 * @returns {string} markdown memorandum
 */
export function exportCremationGrievanceMemo(facility = {}, feeAnalysis = {}) {
  return [
    `# Memorandum: Public Crematorium / Burial Ground Infrastructure Deficit`,
    `**Facility Name:** ${facility.facilityName} (\`${facility.facilityId}\`)`,
    `**Ward / Village:** ${facility.location}, **District:** ${facility.district}`,
    `**Infrastructure Rating:** ${facility.amenityScore}/100 (${facility.status})`,
    `**Fee Transparency Compliance:** ${feeAnalysis.isOverchargingReported ? '⚠️ OVERCHARGING REPORTED' : 'Verified Standard'}`,
    ``,
    `## Civil Amenity Gaps Identified`,
    ...(facility.identifiedIssues?.length > 0
      ? facility.identifiedIssues.map(issue => `- ⚠️ ${issue}`)
      : ['- All baseline civil amenities verified functional.']),
    ``,
    `## Fee Transparency & Extortion Prevention`,
    `- Official Prescribed Municipal Fee: **₹${feeAnalysis.officialRateINR || 500}**`,
    `- Official Rate Board at Entrance: ${feeAnalysis.hasOfficialRateBoardDisplayed ? 'Displayed' : '❌ MISSING (Promotes illegal middleman extortion)'}`,
    `- Advisory: ${feeAnalysis.advisory || 'Ensure fee compliance.'}`,
    ``,
    `## Demands on Municipal / Panchayat Administration`,
    `1. Repair dysfunctional high-mast lighting and water connections within 48 hours.`,
    `2. Erect a bilingual (Hindi/English) permanent steel board displaying the official rates approved by the Municipal Corporation / Nagar Palika board.`,
    `3. Ensure daily waste clearing of funeral remains and maintenance of pyre ash disposal filters adhering to UP Pollution Control Board norms.`,
    ``,
    `## Administrative Escalation Authorities`,
    ...UP_CREMATION_ESCALATION.map(e => `- **${e.title}** (${e.level}) — *Role:* ${e.role}`),
    ``,
    `---`,
    `> **Bereavement Privacy Standard:** Strictly zero names of deceased citizens, religious rites, or grieving families captured.`
  ].join('\n');
}


export const UP_CREMATORIUM_ENVIRONMENTAL_NORMS = [
  'Wet scrubber air pollution control system for smoke particulate filtration.',
  'Sedimentation tank for ash and water separation before disposal.',
  'Dedicated wood storage shed maintaining dry firewood inventory during monsoons.',
  'Promotion of cow-dung briquettes (Go-Kashth) as eco-friendly alternative to forest timber.',
  'Mandatory registration counter recording death memo details for CRS birth-and-death portal.'
];

export const UP_CREMATION_DIRECTORY_FAQS = [
  {
    q: 'Are electric/CNG crematoriums mandatory in major UP cities?',
    a: 'Under National Green Tribunal (NGT) and UPPCB directives, all major Municipal Corporations (Nagar Nigams) are mandated to maintain functional electric or CNG eco-friendly crematoriums.'
  },
  {
    q: 'What documents are required to perform a cremation at a municipal facility?',
    a: 'A medical death summary from the hospital (or death confirmation from the attending doctor) along with a valid photo ID of the applicant/informant.'
  },
  {
    q: 'How can citizens report private middlemen demanding extra money for pyre wood?',
    a: 'Citizens can report overcharging to the on-site Municipal Manager or call the Nagar Nigam helpline on 1533 or dial 112.'
  },
  {
    q: 'What is the Antyeshti Sthal Yojana in rural Uttar Pradesh?',
    a: 'It is a flagship scheme of the UP Panchayati Raj Department funding covered crematoria, solar lights, and clean water handpumps in rural Gram Panchayats.'
  }
];

/**
 * Returns environmental compliance standards for crematoria.
 * @returns {Array<string>}
 */
export function getCrematoriumEnvironmentalNorms() {
  return UP_CREMATORIUM_ENVIRONMENTAL_NORMS;
}

/**
 * Returns procedural FAQs for citizens.
 * @returns {Array<{q: string, a: string}>}
 */
export function getCremationDirectoryFaqs() {
  return UP_CREMATION_DIRECTORY_FAQS;
}


export const UP_CREMATORIUM_HELP_CHANNELS = [
  { service: 'UP Urban Local Body Civic Call Center', number: '1533', note: '24x7 Municipal complaints' },
  { service: 'State Emergency Helpline', number: '112', note: 'Immediate law and order or extortion response' },
  { service: 'UP Pollution Control Board Control Room', number: '0522-2720828', note: 'Air pollution and industrial scrubber complaints' },
  { service: 'UP CM Jan Sunwai Grievance Portal', number: '1076', note: 'Administrative complaint escalation' }
];

/**
 * Returns helpline channels for public crematorium issues.
 * @returns {Array<Object>}
 */
export function getCremationHelplines() {
  return UP_CREMATORIUM_HELP_CHANNELS;
}
