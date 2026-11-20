/**
 * UP Public Distribution Shop (PDS) Stock-Availability Transparency Ledger Service
 * 
 * Supports NFSA (National Food Security Act) beneficiaries across Uttar Pradesh
 * accessing Fair Price Shops (FPS / Kotedar) via the Department of Food and Civil Supplies (fcs.up.gov.in).
 * 
 * Key Capabilities:
 * - Entitlement calculations for Antyodaya Anna Yojana (AAY - 35 kg fixed) and Priority Household (PHH - 5 kg/unit)
 * - Clear bifurcation between Official e-PoS / FCS ledger data vs Community crowdsourced availability observations
 * - Freshness decay: Community observations expire after 48 hours
 * - Discrepancy detector: Highlights divergence between dealer e-PoS opening balance vs reported empty stock
 * - Printable grievance memo for District Supply Officer (DSO) / Sub-Divisional Magistrate (SDM)
 * - Strict privacy: No 12-digit ration card numbers, Aadhaar biometrics, or personal identifiers exposed
 */

export const UP_RATION_CARD_TYPES = {
  ANTYODAYA: {
    code: 'ANTYODAYA',
    name: 'Antyodaya Anna Yojana (AAY - Yellow/Red Card)',
    targetGroup: 'Poorest of the poor families',
    fixedScalePerCardKg: 35,
    wheatShareKg: 14,
    riceShareKg: 21,
    costPerKgINR: 0 // Free under Pradhan Mantri Garib Kalyan Anna Yojana (PMGKAY)
  },
  PRIORITY_HOUSEHOLD: {
    code: 'PRIORITY_HOUSEHOLD',
    name: 'Priority Household (PHH / Patra Grihasti - White Card)',
    targetGroup: 'Eligible families based on socioeconomic exclusion criteria',
    scalePerUnitKg: 5,
    wheatSharePerUnitKg: 2,
    riceSharePerUnitKg: 3,
    costPerKgINR: 0 // Free under PMGKAY
  }
};

export const UP_PDS_ESCALATION_OFFICERS = [
  { level: 'BLOCK_MUNICIPALITY', title: 'Supply Inspector (Poorti Nirikshak)', role: 'Field inspection of Fair Price Shop and physical stock verification' },
  { level: 'TEHSIL', title: 'Sub-Divisional Magistrate (SDM) / Up-Ziladhikari', role: 'Executive magistrate supervision and license suspension hearings' },
  { level: 'DISTRICT', title: 'District Supply Officer (DSO / Zila Poorti Adhikari)', role: 'District statutory licensing authority for Fair Price Shops' }
];

/**
 * Calculates statutory monthly grain entitlement under NFSA & PMGKAY in UP.
 * @param {'ANTYODAYA'|'PRIORITY_HOUSEHOLD'} cardTypeCode 
 * @param {number} unitCount Number of registered family units on ration card
 * @returns {Object} entitlement breakdown
 */
export function calculatePdsEntitlement(cardTypeCode, unitCount = 1) {
  const scheme = UP_RATION_CARD_TYPES[cardTypeCode] || UP_RATION_CARD_TYPES.PRIORITY_HOUSEHOLD;
  const units = Math.max(1, Number(unitCount) || 1);

  if (scheme.code === 'ANTYODAYA') {
    return {
      cardType: scheme.name,
      unitsCount: units,
      isFixedPerCard: true,
      totalGrainKg: scheme.fixedScalePerCardKg,
      wheatKg: scheme.wheatShareKg,
      riceKg: scheme.riceShareKg,
      totalCostINR: 0,
      pmgkaySubsidized: true,
      entitlementNote: '35 kg total grain per family (14 kg wheat + 21 kg rice) irrespective of family unit count.'
    };
  }

  const totalGrain = units * scheme.scalePerUnitKg;
  const wheat = units * scheme.wheatSharePerUnitKg;
  const rice = units * scheme.riceSharePerUnitKg;

  return {
    cardType: scheme.name,
    unitsCount: units,
    isFixedPerCard: false,
    totalGrainKg: totalGrain,
    wheatKg: wheat,
    riceKg: rice,
    totalCostINR: 0,
    pmgkaySubsidized: true,
    entitlementNote: `${units} units @ 5 kg per unit = ${totalGrain} kg total (${wheat} kg wheat + ${rice} kg rice).`
  };
}

/**
 * Evaluates observation freshness with 48-hour decay window.
 * @param {string|Date} observationDate 
 * @returns {Object} freshness metadata
 */
export function evaluateObservationFreshness(observationDate) {
  const obsTime = new Date(observationDate).getTime();
  const now = Date.now();
  const ageHours = (now - obsTime) / (1000 * 60 * 60);

  const isValid = !isNaN(obsTime) && ageHours >= 0 && ageHours <= 48;
  return {
    isFresh: isValid,
    ageHours: Math.max(0, Number(ageHours.toFixed(1))),
    expiryLimitHours: 48,
    statusText: isValid ? `Fresh (${Math.round(ageHours)}h ago)` : 'Decayed / Expired (>48h old)'
  };
}

/**
 * Detects discrepancies between official portal e-PoS stock and crowdsourced ground observations.
 * @param {Object} officialStock 
 * @param {Array<Object>} communityObservations 
 * @returns {Object} discrepancy analysis
 */
export function analyzePdsStockDiscrepancy(officialStock = {}, communityObservations = []) {
  const freshReports = (communityObservations || []).filter(obs => {
    const freshness = evaluateObservationFreshness(obs.reportedAt);
    return freshness.isFresh;
  });

  const reportedClosed = freshReports.filter(r => r.isShopClosedDuringWorkingHours).length;
  const reportedStockExhausted = freshReports.filter(r => r.dealerClaimsOutOfStock).length;
  const reportedWeighmentShortage = freshReports.filter(r => r.dealerDivertingOrUnderweighing).length;

  const officialOpeningWheat = Number(officialStock.wheatBalanceKg) || 0;
  const officialOpeningRice = Number(officialStock.riceBalanceKg) || 0;
  const hasOfficialStockOnRecord = (officialOpeningWheat + officialOpeningRice) > 500;

  let discrepancyAlert = false;
  const issues = [];

  if (hasOfficialStockOnRecord && reportedStockExhausted >= 2) {
    discrepancyAlert = true;
    issues.push('e-PoS Stock Inconsistency: Portal shows active grain balance (>500 kg), but multiple cardholders report dealer claims empty stock.');
  }

  if (reportedClosed >= 2) {
    discrepancyAlert = true;
    issues.push('Distribution Schedule Violation: Shop reported repeatedly shuttered during statutory operating hours.');
  }

  if (reportedWeighmentShortage >= 2) {
    discrepancyAlert = true;
    issues.push('Weighment Malpractice: Cardholders report biometric authentication taken without dispensing or deductions under prescribed weight.');
  }

  return {
    dealerCode: officialStock.dealerCode ? `FPS-UP-****-${String(officialStock.dealerCode).slice(-4)}` : 'FPS-UNKNOWN',
    officialBalanceWheatKg: officialOpeningWheat,
    officialBalanceRiceKg: officialOpeningRice,
    freshCommunityReportCount: freshReports.length,
    discrepancyDetected: discrepancyAlert,
    flaggedIssues: issues,
    recommendInspection: discrepancyAlert && freshReports.length >= 3
  };
}

/**
 * Formats printable representation for District Supply Officer (DSO).
 * @param {Object} shopDetails 
 * @param {Object} analysis 
 * @returns {string} markdown memo
 */
export function exportPdsGrievanceMemo(shopDetails = {}, analysis = {}) {
  return [
    `# Memorandum of Irregularity: Fair Price Shop (FPS) PDS Distribution`,
    `**Fair Price Shop (FPS) ID:** \`${analysis.dealerCode || 'FPS-UP-****-XXXX'}\``,
    `**Village / Ward:** ${shopDetails.villageOrWard || 'Local Ward'}, **District:** ${shopDetails.district || 'Uttar Pradesh'}`,
    `**Official e-PoS Reported Balance:** Wheat: ${analysis.officialBalanceWheatKg} kg | Rice: ${analysis.officialBalanceRiceKg} kg`,
    `**Community Observations (Fresh <48h):** ${analysis.freshCommunityReportCount} verified cardholder reports`,
    ``,
    `## Identified Discrepancies & Violations`,
    ...(analysis.flaggedIssues?.length > 0
      ? analysis.flaggedIssues.map(issue => `- ⚠️ ${issue}`)
      : ['- Routine stock reconciliation verification.']),
    ``,
    `## Statutory Action Demanded under Essential Commodities Act`,
    `1. Direct the **Supply Inspector (Poorti Nirikshak)** to conduct an unscheduled physical weighment audit of the shop godown.`,
    `2. Compare electronic PoS transaction logs against physical grain bags available on premises.`,
    `3. If dealer diverted grains or compelled cardholders to return empty-handed after biometric slip generation, initiate action under Section 3/7 of Essential Commodities Act, 1955.`,
    ``,
    `## Escalation Matrix`,
    ...UP_PDS_ESCALATION_OFFICERS.map(o => `- **${o.title}** (${o.level}): ${o.role}`),
    ``,
    `---`,
    `> **Beneficiary Protection:** No individual ration card numbers or citizen biometrics are collected or displayed.`
  ].join('\n');
}


export const UP_PDS_FAQS = [
  {
    q: 'Can a dealer charge money for NFSA ration grains?',
    a: 'No. Under the Government of India PMGKAY mandate extended by the UP Government, food grains are distributed completely free of charge to both AAY and PHH cardholders.'
  },
  {
    q: 'Can ration be collected if the cardholder biometric fingerprint does not match on e-PoS?',
    a: 'Yes. If fingerprint matching fails, dealers are mandated to use IRIS scanners, OTP-based verification to the registered mobile, or nominee proxy authentication.'
  },
  {
    q: 'Can a cardholder draw ration from any Fair Price Shop in Uttar Pradesh?',
    a: 'Yes. Under the "One Nation One Ration Card" (ONORC) portable distribution mechanism, cardholders can collect ration from any active e-PoS dealer across UP.'
  },
  {
    q: 'What is the statutory weighment rule for electronic scales?',
    a: 'The electronic weighing scale must be directly linked via Bluetooth/serial cable to the e-PoS machine (e-Weighing / e-Tula), preventing manual tampering of weight entries.'
  }
];

export const UP_PDS_COMPLAINT_CHANNELS = [
  { channel: 'UP FCS Toll-Free Call Centre', contact: '1967 / 1800-1800-150', availability: 'Mon-Sat 08:00 AM - 08:00 PM' },
  { channel: 'UP CM Jan Sunwai Portal', contact: '1076 / jansunwai.up.nic.in', availability: '24x7 Online' },
  { channel: 'National Consumer Helpline (NCH)', contact: '1915', availability: 'All days except national holidays' }
];

/**
 * Returns procedural FAQs for UP PDS cardholders.
 * @returns {Array<{q: string, a: string}>}
 */
export function getPdsFaqs() {
  return UP_PDS_FAQS;
}

/**
 * Returns grievance registration helplines for food distribution issues.
 * @returns {Array<Object>}
 */
export function getPdsComplaintChannels() {
  return UP_PDS_COMPLAINT_CHANNELS;
}


export const UP_PDS_SHOP_INSPECTION_CHECKLIST = [
  'Verify physical gunny bags in godown against e-PoS opening balance.',
  'Inspect daily stock and rate display board at shop entrance.',
  'Check electronic weighing scale calibration seal from Legal Metrology (Bat-Maap) Department.',
  'Verify complaint register availability and entries made by local cardholders.',
  'Sample interview of 5 recent biometrically verified cardholders.'
];

/**
 * Returns field inspection protocol checklist for Supply Inspectors.
 * @returns {Array<string>}
 */
export function getShopInspectionChecklist() {
  return UP_PDS_SHOP_INSPECTION_CHECKLIST;
}
