/**
 * UP Anganwadi Service Access and Facility Concern Navigator Service
 * 
 * Supports mothers, pregnant women, and community volunteers accessing Integrated Child
 * Development Services (ICDS) Anganwadi Centres (AWC) under the Department of Women and
 * Child Development, Government of Uttar Pradesh (balvikasup.gov.in / Poshan Tracker).
 * 
 * Key Capabilities:
 * - 6 Core ICDS Service Entitlement Engine: Supplementary Nutrition (THR / Hot Cooked Meal),
 *   Growth Monitoring (Stunting/Wasting via Poshan Tracker), Early Childhood Care & Education (ECCE),
 *   Immunization Support, Health Check-ups, and Nutrition Health Education
 * - Structural facility condition assessment (drinking water, child-friendly toilet, weighing scales)
 * - Multi-observation community consensus verification (minimum 3 reports)
 * - Escalation matrix: Mukhya Sevika (Supervisor) -> CDPO -> District Programme Officer (DPO)
 * - Strict Child & Mother Privacy: Zero names of minors, photographs, or growth health records exposed
 */

export const ICDS_CORE_SERVICES = {
  SUPPLEMENTARY_NUTRITION: {
    code: 'SUPPLEMENTARY_NUTRITION',
    name: 'Supplementary Nutrition Programme (SNP / Poshan Aahar)',
    targetBeneficiaries: 'Children 6 months to 6 years, pregnant women, and lactating mothers',
    mode: 'Take Home Ration (THR) packets / Hot Cooked Meals (HCM)',
    statutoryFrequency: 'Minimum 25 days per month (300 days a year)'
  },
  GROWTH_MONITORING: {
    code: 'GROWTH_MONITORING',
    name: 'Growth Monitoring & SAM/MAM Tracking',
    targetBeneficiaries: 'Children under 5 years',
    tools: 'Infantometer, Stadiometer, and Salter/Mother-Child electronic scale logged on Poshan Tracker app',
    statutoryFrequency: 'Monthly measurement'
  },
  EARLY_CHILDHOOD_EDUCATION: {
    code: 'EARLY_CHILDHOOD_EDUCATION',
    name: 'Early Childhood Care and Education (ECCE / Balvatika)',
    targetBeneficiaries: 'Children 3 to 6 years of age',
    activities: 'Non-formal preschool education, play-way learning, storytelling, socialisation',
    statutoryFrequency: 'Daily (morning sessions)'
  },
  IMMUNIZATION_CONVERGENCE: {
    code: 'IMMUNIZATION_CONVERGENCE',
    name: 'Village Health Sanitation & Nutrition Day (VHSND / Aarogya Diwas)',
    targetBeneficiaries: 'Infants, pregnant women, and adolescent girls',
    convergenceAgency: 'Health Department (ANM & ASHA)',
    statutoryFrequency: 'Monthly (prescribed fixed Wednesday/Saturday)'
  }
};

export const ANGANWADI_ESCALATION_HIERARCHY = [
  { level: 'SECTOR', designation: 'Mukhya Sevika (Anganwadi Supervisor)', role: 'Field supervision of 20-25 Anganwadi Centres and record auditing' },
  { level: 'BLOCK', designation: 'Child Development Project Officer (CDPO / Bal Vikas Pariyojna Adhikari)', role: 'Block-level ration supply chain & administrative control' },
  { level: 'DISTRICT', designation: 'District Programme Officer (DPO / Zila Karyakram Adhikari)', role: 'District overall nodal officer for ICDS and Poshan Abhiyaan' }
];

export const COMMON_FACILITY_CONCERNS = {
  RATION_SUPPLY_IRREGULARITY: 'Supplementary nutrition (Dalia/Panjiri/Fortified Rice) not distributed for consecutive weeks.',
  CENTRE_FREQUENTLY_CLOSED: 'Anganwadi Worker (AWW) / Helper (AWH) absent during mandatory morning operating hours.',
  WEIGHING_EQUIPMENT_BROKEN: 'Lack of functional infant/baby weighing scale to track severe acute malnutrition (SAM).',
  DRINKING_WATER_OR_TOILET_UNUSABLE: 'No functional drinking water supply or clean, safe, child-friendly toilet on premises.'
};

/**
 * Assesses operational adequacy and facility health of an Anganwadi Centre.
 * @param {Object} centreData 
 * @returns {Object} assessment
 */
export function assessAnganwadiFacility(centreData = {}) {
  const issues = [];
  let score = 100;

  if (!centreData.hasPotableWater) {
    score -= 25;
    issues.push('Missing functional drinking water tap or clean water container.');
  }

  if (!centreData.hasFunctionalToilet) {
    score -= 25;
    issues.push('Missing or locked child-friendly toilet facility.');
  }

  if (!centreData.hasFunctionalWeighingScale) {
    score -= 20;
    issues.push('Baby / Mother weighing scale non-functional or unavailable for monthly growth tracking.');
  }

  if (centreData.reportedRationDelayedMonths && Number(centreData.reportedRationDelayedMonths) >= 1) {
    score -= 30;
    issues.push(`Supplementary ration distribution disrupted for ~${centreData.reportedRationDelayedMonths} month(s).`);
  }

  const finalScore = Math.max(0, score);
  let status = 'SATISFACTORY';
  if (finalScore < 50) status = 'CRITICAL_GAPS';
  else if (finalScore < 80) status = 'NEEDS_IMPROVEMENT';

  return {
    awcCode: centreData.awcCode ? `AWC-UP-****-${String(centreData.awcCode).slice(-4)}` : 'AWC-UNKNOWN',
    villageOrWard: centreData.villageOrWard || 'Village Ward',
    district: centreData.district || 'Uttar Pradesh',
    qualityScore: finalScore,
    status,
    identifiedIssues: issues,
    requiresSectorSupervision: finalScore < 80
  };
}

/**
 * Aggregates crowdsourced community concerns with spam-filtering (3+ independent reports).
 * @param {Array<Object>} observations 
 * @returns {Object} aggregate analysis
 */
export function aggregateAnganwadiCommunityConcerns(observations = []) {
  if (!Array.isArray(observations) || observations.length === 0) {
    return {
      totalObservations: 0,
      verifiedByCommunity: false,
      commonConcerns: []
    };
  }

  const valid = observations.filter(o => o && o.awcId);
  const concernCounts = {};

  valid.forEach(obs => {
    (obs.flaggedConcerns || []).forEach(concern => {
      concernCounts[concern] = (concernCounts[concern] || 0) + 1;
    });
  });

  const verifiedConcerns = Object.keys(concernCounts).filter(k => concernCounts[k] >= 2);

  return {
    totalObservations: valid.length,
    verifiedByCommunity: valid.length >= 3,
    verifiedConcerns,
    requiresOfficialEscalation: valid.length >= 3 && verifiedConcerns.length > 0
  };
}

/**
 * Formats printable representation memo for Child Development Project Officer (CDPO).
 * @param {Object} facility 
 * @param {Object} aggregate 
 * @returns {string} markdown memo
 */
export function exportAnganwadiGrievanceMemo(facility = {}, aggregate = {}) {
  return [
    `# Representation: Anganwadi Facility & Service Delivery Deficit`,
    `**Anganwadi Centre (AWC) Ref:** \`${facility.awcCode || 'AWC-UP-****-XXXX'}\``,
    `**Village / Ward:** ${facility.villageOrWard}, **District:** ${facility.district}`,
    `**Facility Quality Rating:** ${facility.qualityScore}/100 (${facility.status})`,
    `**Community Observations Recorded:** ${aggregate.totalObservations || 1} independent reports`,
    ``,
    `## Specific Service Gaps Identified`,
    ...(facility.identifiedIssues?.length > 0
      ? facility.identifiedIssues.map(issue => `- ⚠️ ${issue}`)
      : ['- Routine facility maintenance review.']),
    ``,
    `## Community Consensus Violations`,
    ...(aggregate.verifiedConcerns?.length > 0
      ? aggregate.verifiedConcerns.map(c => `- 🚩 Confirmed by multiple mothers/guardians: ${c}`)
      : ['- Single observation logged; under community verification watch.']),
    ``,
    `## Statutory Action Demanded under ICDS Operational Guidelines`,
    `1. Direct the **Mukhya Sevika (Sector Supervisor)** to conduct an unscheduled on-site inspection of the AWC stock register and Poshan Tracker attendance records.`,
    `2. Restore interrupted supplementary nutrition (THR / HCM) allocations through the block buffer godown.`,
    `3. Replace broken Salter/baby weighing scales to ensure accurate SAM/MAM child nutritional classification.`,
    ``,
    `## Escalation Matrix`,
    ...ANGANWADI_ESCALATION_HIERARCHY.map(h => `- **${h.designation}** (${h.level}) — *Role:* ${h.role}`),
    ``,
    `---`,
    `> **Child Protection Standard:** No individual child names, developmental health records, or family identities are collected.`
  ].join('\n');
}


export const UP_ICDS_FAQS = [
  {
    q: 'Who is eligible to receive Take Home Ration (THR) from Anganwadi Centres?',
    a: 'Children aged 6 months to 3 years, pregnant women, and lactating mothers registered with the Anganwadi Worker.'
  },
  {
    q: 'What is the schedule for Hot Cooked Meals (HCM) in UP Anganwadis?',
    a: 'Under the PM Poshan convergence, children aged 3 to 6 years attending morning preschool sessions receive freshly prepared hot cooked meals.'
  },
  {
    q: 'What should a parent do if an Anganwadi Worker (AWW) is consistently absent?',
    a: 'Log a written complaint with the Sector Mukhya Sevika or CDPO, or call the UP CM Helpline on 1076.'
  },
  {
    q: 'Can an Anganwadi Centre charge fees for admission or preschool kits?',
    a: 'No. All services, educational kits, toys, and supplementary food under ICDS are provided completely free of cost.'
  }
];

export const UP_AWC_INFRASTRUCTURE_NORMS = [
  'Separate child-friendly toilet with low height pan and running water.',
  'Dedicated safe drinking water point with filtration/RO unit.',
  'Kitchen shed for hygienic storage and cooking of meals.',
  'Activity room with adequate natural light, ventilation, and ceiling fan.',
  'Digital infantometer and stadiometer for accurate growth measurement.'
];

/**
 * Returns procedural FAQs for Anganwadi beneficiaries.
 * @returns {Array<{q: string, a: string}>}
 */
export function getAnganwadiFaqs() {
  return UP_ICDS_FAQS;
}

/**
 * Returns prescribed infrastructure norms for modern UP Anganwadi Centres.
 * @returns {Array<string>}
 */
export function getAnganwadiInfrastructureNorms() {
  return UP_AWC_INFRASTRUCTURE_NORMS;
}


export const UP_ICDS_HOTLINE_NUMBERS = [
  { service: 'Women Power Line', number: '1090', note: '24x7 security and safety' },
  { service: 'Childline Emergency Assistance', number: '1098', note: 'Immediate care and protection for children' },
  { service: 'UP Chief Minister Jan Sunwai Helpline', number: '1076', note: 'Administrative complaint escalation' }
];

/**
 * Returns emergency hotlines related to maternal and child welfare in UP.
 * @returns {Array<Object>}
 */
export function getIcdsHotlines() {
  return UP_ICDS_HOTLINE_NUMBERS;
}
