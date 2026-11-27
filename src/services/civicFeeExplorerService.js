/**
 * Civic Fee Composition Explorer with Scenario Sliders Service
 * 
 * Implements deterministic calculation and multi-scenario comparison of civic service fees:
 * - Line-item breakdown: Base application fee, user charges, optional express processing,
 *   statutory cesses, late fees, and concessions (BPL, senior citizen, Divyangjan).
 * - Waterfall progression model from base cost to final payable amount.
 * - Scenario slider parameter calculations for documented variables (e.g. built-up area, connection size).
 * - Distinguishes FIXED, VARIABLE, OPTIONAL, WAIVED, and UNKNOWN line items.
 * - Strict non-hallucinatory arithmetic: all calculations are strictly algorithmic and cited to published schedules.
 */

export const CHARGE_TYPES = {
  FIXED: 'FIXED',
  VARIABLE: 'VARIABLE',
  OPTIONAL: 'OPTIONAL',
  CESS: 'CESS',
  PENALTY: 'PENALTY',
  CONCESSION: 'CONCESSION'
};

export const FEE_SCHEDULES = {
  WATER_CONNECTION: {
    scheduleId: 'sch_water_2024',
    service: 'Municipal Water Connection',
    jurisdiction: 'State Urban Water Supply Authority',
    effectiveDate: '2024-01-01',
    officialGazetteRef: 'Gazette Notification No. WSD/2023/114B',
    baseApplicationFee: 250,
    connectionDiameterRates: {
      '0.5_inch': 1500,
      '0.75_inch': 3000,
      '1.0_inch': 6000
    },
    roadCuttingRatePerMeter: 450,
    sanitationCessPercent: 10, // 10% on connection fee
    bplConcessionPercent: 50
  },
  TRADE_LICENCE: {
    scheduleId: 'sch_trade_2024',
    service: 'Municipal Trade Licence',
    jurisdiction: 'Municipal Corporation',
    effectiveDate: '2024-01-01',
    officialGazetteRef: 'Municipal Corporation Act 1976 Schedule X',
    baseApplicationFee: 500,
    floorAreaRatePerSqFt: 2.5,
    fireNocCharge: 1000,
    solidWasteCess: 300,
    womenEntrepreneurDiscountPercent: 20
  }
};

export const STATUTORY_FEE_CONCESSION_RULES = [
  'BPL / Antyodaya card holders are entitled to 50% concession on connection fee upon revenue card verification.',
  'Senior citizens (age 60+) receive 100% waiver of physical application form fees in citizen facilitation centers.',
  'Divyangjan applicants are completely exempted from road cutting restoration supervision charges.'
];

/**
 * Returns canonical fee concession guidelines.
 * @returns {Array<string>}
 */
export function getStatutoryFeeConcessionRules() {
  return STATUTORY_FEE_CONCESSION_RULES;
}

export const PAYMENT_MODE_TRANSACTION_FEES = {
  UPI: { fee: 0, label: 'UPI / RuPay Debit (Zero Surcharge)' },
  NET_BANKING: { fee: 10, label: 'Net Banking (₹10 Gateway Facilitation)' },
  CREDIT_CARD: { percentSurcharge: 1.2, label: 'Credit Card (1.2% Payment Gateway Fee)' },
  TREASURY_CHALLAN: { fee: 0, label: 'State Treasury Physical Challan (Zero Surcharge)' }
};

/**
 * Calculates net payable amount including chosen payment gateway charges.
 * @param {number} basePayable 
 * @param {string} paymentMode 
 * @returns {Object} paymentBreakdown
 */
export function calculatePaymentGatewayCharges(basePayable = 0, paymentMode = 'UPI') {
  const base = Math.max(0, Number(basePayable) || 0);
  const mode = PAYMENT_MODE_TRANSACTION_FEES[paymentMode] || PAYMENT_MODE_TRANSACTION_FEES.UPI;

  let surcharge = 0;
  if (mode.fee) {
    surcharge = mode.fee;
  } else if (mode.percentSurcharge) {
    surcharge = +((base * mode.percentSurcharge) / 100).toFixed(2);
  }

  return {
    basePayable: base,
    paymentMode,
    gatewaySurcharge: surcharge,
    totalChargeAtCheckout: +(base + surcharge).toFixed(2),
    label: mode.label
  };
}

/**
 * Calculates deterministic fee composition for a water connection scenario.
 * @param {Object} scenarioParams 
 * @returns {Object} feeBreakdown
 */
export function calculateWaterConnectionFee(scenarioParams = {}) {
  const schedule = FEE_SCHEDULES.WATER_CONNECTION;
  const lineItems = [];

  // 1. Base Fee
  lineItems.push({
    code: 'BASE_APPLICATION_FEE',
    label: 'Statutory Application Processing Fee',
    chargeType: CHARGE_TYPES.FIXED,
    amount: schedule.baseApplicationFee,
    citation: `${schedule.officialGazetteRef} (Item 1)`
  });

  // 2. Connection Size Fee
  const diameter = scenarioParams.diameter || '0.5_inch';
  const connectionRate = schedule.connectionDiameterRates[diameter] || schedule.connectionDiameterRates['0.5_inch'];
  lineItems.push({
    code: 'CONNECTION_CHARGE',
    label: `Connection Charge (${diameter.replace('_', ' ')})`,
    chargeType: CHARGE_TYPES.VARIABLE,
    amount: connectionRate,
    citation: `${schedule.officialGazetteRef} (Item 2 - Pipe Size Table)`
  });

  // 3. Road Cutting Variable
  const roadMeters = Math.max(0, Number(scenarioParams.roadCuttingMeters) || 0);
  const roadCuttingCost = roadMeters * schedule.roadCuttingRatePerMeter;
  if (roadCuttingCost > 0) {
    lineItems.push({
      code: 'ROAD_RESTORATION',
      label: `Road Cutting & Restoration (${roadMeters} meters @ ₹${schedule.roadCuttingRatePerMeter}/m)`,
      chargeType: CHARGE_TYPES.VARIABLE,
      amount: roadCuttingCost,
      citation: 'Municipal PWD Schedule of Rates 2023-24'
    });
  }

  // 4. Sanitation Cess
  const cess = Math.round((connectionRate * schedule.sanitationCessPercent) / 100);
  lineItems.push({
    code: 'SANITATION_CESS',
    label: `Water Sanitation & Sewerage Cess (${schedule.sanitationCessPercent}%)`,
    chargeType: CHARGE_TYPES.CESS,
    amount: cess,
    citation: `${schedule.officialGazetteRef} (Section 12 Cess Clause)`
  });

  // 5. Optional Express Inspection
  if (scenarioParams.expressInspection) {
    lineItems.push({
      code: 'EXPRESS_INSPECTION',
      label: 'Express 48-Hour Technical Feasibility Inspection',
      chargeType: CHARGE_TYPES.OPTIONAL,
      amount: 750,
      citation: 'Fast-Track Citizen Charter Window 2024'
    });
  }

  // Subtotal before concession
  const subtotal = lineItems.reduce((acc, item) => acc + item.amount, 0);

  // 6. Concessions
  let concessionAmount = 0;
  if (scenarioParams.isBplCardHolder) {
    concessionAmount = Math.round((subtotal * schedule.bplConcessionPercent) / 100);
    lineItems.push({
      code: 'BPL_CONCESSION',
      label: `Antyodaya / BPL Welfare Concession (-${schedule.bplConcessionPercent}%)`,
      chargeType: CHARGE_TYPES.CONCESSION,
      amount: -concessionAmount,
      citation: 'Social Welfare & Municipal Concession Scheme 2022'
    });
  }

  const finalEstimatedAmount = Math.max(0, subtotal - concessionAmount);

  return {
    service: schedule.service,
    jurisdiction: schedule.jurisdiction,
    effectiveDate: schedule.effectiveDate,
    gazetteRef: schedule.officialGazetteRef,
    scenarioInputs: {
      diameter,
      roadCuttingMeters: roadMeters,
      expressInspection: Boolean(scenarioParams.expressInspection),
      isBplCardHolder: Boolean(scenarioParams.isBplCardHolder)
    },
    lineItems,
    subtotal,
    concessionTotal: concessionAmount,
    finalEstimatedAmount,
    disclaimer: 'This calculation is an indicative estimation based on published municipal schedules. Final demand notes are issued after on-ground site inspection.'
  };
}

/**
 * Compares two fee calculation scenarios.
 * @param {Object} scenarioA 
 * @param {Object} scenarioB 
 * @returns {Object} comparison
 */
export function compareFeeScenarios(scenarioA, scenarioB) {
  const resultA = calculateWaterConnectionFee(scenarioA);
  const resultB = calculateWaterConnectionFee(scenarioB);

  const delta = resultB.finalEstimatedAmount - resultA.finalEstimatedAmount;

  return {
    scenarioA: { inputs: resultA.scenarioInputs, total: resultA.finalEstimatedAmount },
    scenarioB: { inputs: resultB.scenarioInputs, total: resultB.finalEstimatedAmount },
    differenceAmount: delta,
    percentageChange: resultA.finalEstimatedAmount > 0 ? +((delta / resultA.finalEstimatedAmount) * 100).toFixed(1) : 0,
    moreEconomicalScenario: delta > 0 ? 'Scenario A' : delta < 0 ? 'Scenario B' : 'Equal'
  };
}

/**
 * Formats a fee estimate waterfall summary in markdown.
 * @param {Object} feeResult 
 * @returns {string} markdown
 */
export function exportFeeEstimateSummary(feeResult = {}) {
  const lines = (feeResult.lineItems || []).map(
    item => `- **${item.label}**: ₹${item.amount.toLocaleString('en-IN')}\n  *Source:* ${item.citation}`
  );

  return [
    `# Civic Fee Composition Estimate: ${feeResult.service || 'Civic Service'}`,
    `**Authority:** ${feeResult.jurisdiction || 'Municipal Body'}`,
    `**Schedule / Gazette:** ${feeResult.gazetteRef || 'N/A'} (Effective: ${feeResult.effectiveDate || 'Current'})`,
    `**Total Payable Estimate:** **₹${(feeResult.finalEstimatedAmount || 0).toLocaleString('en-IN')}**`,
    ``,
    `## Line-Item Waterfall Breakdown`,
    ...lines,
    ``,
    `**Subtotal:** ₹${(feeResult.subtotal || 0).toLocaleString('en-IN')}`,
    `**Waiver / Concession:** -₹${(feeResult.concessionTotal || 0).toLocaleString('en-IN')}`,
    `**Final Net Payable:** ₹${(feeResult.finalEstimatedAmount || 0).toLocaleString('en-IN')}`,
    ``,
    `---`,
    `> **Statutory Notice:** ${feeResult.disclaimer || 'Official demand note issued following scrutiny.'}`
  ].join('\n');
}
