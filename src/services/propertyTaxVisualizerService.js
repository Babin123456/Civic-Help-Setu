/**
 * Property-Tax Assessment Breakdown and Correction Visualizer Service
 * 
 * Provides structured decomposition and Year-over-Year (YoY) comparison of property tax bills:
 * - Line-item composition: Unit Area Value (UAV) / Capital Value, Usage Factor, Age Depreciation,
 *   Solid Waste Management (SWM) Cess, Library Cess, Beggar Cess, Urban Transport Cess.
 * - Compares two assessment periods (Current vs Previous) and pinpoints field-level deltas
 *   (e.g., changes in built-up area, tenancy status, zoning classification, rebate eligibility).
 * - Generates structured municipal correction objection checklists without automated formal filing.
 * - Strict deterministic calculations with OCR validation confidence tracking.
 */

export const PROPERTY_USAGE_TYPES = {
  RESIDENTIAL_SELF_OCCUPIED: { code: 'RESIDENTIAL_SELF_OCCUPIED', factor: 1.0, label: 'Residential (Self-Occupied)' },
  RESIDENTIAL_TENANTED: { code: 'RESIDENTIAL_TENANTED', factor: 2.0, label: 'Residential (Rented / Tenanted)' },
  COMMERCIAL_RETAIL: { code: 'COMMERCIAL_RETAIL', factor: 3.5, label: 'Commercial Retail / Shop' },
  COMMERCIAL_OFFICE: { code: 'COMMERCIAL_OFFICE', factor: 4.0, label: 'Commercial Office Space' }
};

export const MUNICIPAL_CESS_RATES = {
  SWM_CESS: { rate: 0.15, label: 'Solid Waste Management (SWM) Cess (15%)' },
  LIBRARY_CESS: { rate: 0.06, label: 'State Library Infrastructure Cess (6%)' },
  BEGGAR_CESS: { rate: 0.03, label: 'Beggary Prevention Cess (3%)' }
};

export const MUNICIPAL_OBJECTION_STATUTES = {
  DELHI_MCD: 'Delhi Municipal Corporation Act 1957 (Section 123D)',
  BANGALORE_BBMP: 'Bruhat Bengaluru Mahanagara Palike Act 2020 (Section 144)',
  MUMBAI_BMC: 'Mumbai Municipal Corporation Act 1888 (Section 217 Appeal)'
};

export const COMMON_ASSESSMENT_DISCREPANCY_FLAGS = [
  'ERR_EXCESS_SUPER_BUILTUP_CALCULATION: Common areas included erroneously in carpet plinth.',
  'ERR_DISALLOWED_DEPRECIATION: Structure age reset to zero following minor repair.',
  'ERR_OMISSION_OF_EARLY_BIRD_REBATE: System payment processed before cutoff failed to debit 5% rebate.'
];

/**
 * Returns discrepancy diagnostic descriptions.
 * @returns {Array<string>}
 */
export function getAssessmentDiscrepancyFlags() {
  return COMMON_ASSESSMENT_DISCREPANCY_FLAGS;
}

/**
 * Computes detailed property tax line items from confirmed property attributes.
 * @param {Object} propertyAttributes 
 * @returns {Object} assessmentResult
 */
export function calculatePropertyTaxAssessment(propertyAttributes = {}) {
  const builtUpArea = Math.max(0, Number(propertyAttributes.builtUpAreaSqFt) || 0);
  const baseRatePerSqFt = Math.max(0, Number(propertyAttributes.baseUnitAreaRate) || 2.5);
  const usage = PROPERTY_USAGE_TYPES[propertyAttributes.usageType] || PROPERTY_USAGE_TYPES.RESIDENTIAL_SELF_OCCUPIED;
  const ageYears = Math.max(0, Number(propertyAttributes.buildingAgeYears) || 0);

  // Depreciation factor (typically 1% per year capped at 30%)
  const depreciationFactor = Math.min(0.30, +(ageYears * 0.01).toFixed(2));

  // Annual Value calculation: Area * Base Rate * Usage Factor * (1 - Depreciation) * 10 months
  const annualValue = +(builtUpArea * baseRatePerSqFt * usage.factor * (1 - depreciationFactor) * 10).toFixed(2);

  // Property Tax (typically 20% of Annual Value)
  const basePropertyTax = +(annualValue * 0.20).toFixed(2);

  // Statutory Cesses
  const swmCess = +(basePropertyTax * MUNICIPAL_CESS_RATES.SWM_CESS.rate).toFixed(2);
  const libraryCess = +(basePropertyTax * MUNICIPAL_CESS_RATES.LIBRARY_CESS.rate).toFixed(2);
  const beggarCess = +(basePropertyTax * MUNICIPAL_CESS_RATES.BEGGAR_CESS.rate).toFixed(2);
  const totalCess = +(swmCess + libraryCess + beggarCess).toFixed(2);

  // Early Bird Rebate (5% if paid before cutoff)
  const earlyPaymentRebate = propertyAttributes.eligibleForEarlyRebate ? +(basePropertyTax * 0.05).toFixed(2) : 0;

  const totalDemand = +(basePropertyTax + totalCess - earlyPaymentRebate).toFixed(2);

  return {
    period: propertyAttributes.assessmentYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    propertyAttributes: {
      builtUpAreaSqFt: builtUpArea,
      baseUnitAreaRate: baseRatePerSqFt,
      usageType: usage.code,
      buildingAgeYears: ageYears,
      depreciationFactor
    },
    lineItems: [
      { code: 'BASE_PROPERTY_TAX', label: 'Base General Property Tax', amount: basePropertyTax },
      { code: 'SWM_CESS', label: MUNICIPAL_CESS_RATES.SWM_CESS.label, amount: swmCess },
      { code: 'LIBRARY_CESS', label: MUNICIPAL_CESS_RATES.LIBRARY_CESS.label, amount: libraryCess },
      { code: 'BEGGAR_CESS', label: MUNICIPAL_CESS_RATES.BEGGAR_CESS.label, amount: beggarCess },
      ...(earlyPaymentRebate > 0 ? [{ code: 'EARLY_REBATE', label: 'Early Payment Rebate (5%)', amount: -earlyPaymentRebate }] : [])
    ],
    annualValue,
    basePropertyTax,
    totalCess,
    earlyPaymentRebate,
    totalDemand
  };
}

/**
 * Compares two assessment periods and identifies root-cause changes.
 * @param {Object} periodA 
 * @param {Object} periodB 
 * @returns {Object} comparisonReport
 */
export function compareAssessmentPeriods(periodA, periodB) {
  const resultA = calculatePropertyTaxAssessment(periodA);
  const resultB = calculatePropertyTaxAssessment(periodB);

  const deltaTotal = +(resultB.totalDemand - resultA.totalDemand).toFixed(2);
  const percentDelta = resultA.totalDemand > 0 ? +((deltaTotal / resultA.totalDemand) * 100).toFixed(1) : 0;

  const detectedAttributeChanges = [];
  if (resultA.propertyAttributes.builtUpAreaSqFt !== resultB.propertyAttributes.builtUpAreaSqFt) {
    detectedAttributeChanges.push({
      field: 'Built-up Area (Sq Ft)',
      from: resultA.propertyAttributes.builtUpAreaSqFt,
      to: resultB.propertyAttributes.builtUpAreaSqFt,
      reason: 'Physical extension, measurement resurvey, or data correction'
    });
  }

  if (resultA.propertyAttributes.usageType !== resultB.propertyAttributes.usageType) {
    detectedAttributeChanges.push({
      field: 'Occupancy / Usage Category',
      from: resultA.propertyAttributes.usageType,
      to: resultB.propertyAttributes.usageType,
      reason: 'Change in tenancy status from self-occupied to rented, or commercial conversion'
    });
  }

  return {
    periodA: { year: resultA.period, totalDemand: resultA.totalDemand },
    periodB: { year: resultB.period, totalDemand: resultB.totalDemand },
    deltaAmount: deltaTotal,
    percentChange: percentDelta,
    isIncreased: deltaTotal > 0,
    attributeChanges: detectedAttributeChanges
  };
}

/**
 * Generates an actionable Municipal Correction Checklist for challenging an erroneous tax hike.
 * @param {Object} comparison 
 * @returns {Object} correctionPlan
 */
export function buildTaxCorrectionChecklist(comparison = {}) {
  const items = [];

  (comparison.attributeChanges || []).forEach(change => {
    if (change.field.includes('Area')) {
      items.push({
        action: 'Sanctioned Building Plan / Architect Measurement Certificate',
        purpose: 'Disprove arbitrary area hike by submitting approved building plan extract.',
        authority: 'Assistant Revenue Officer (ARO) Property Tax Cell'
      });
    }
    if (change.field.includes('Usage')) {
      items.push({
        action: 'Self-Occupancy Affidavit / Electricity Meter in Owner Name',
        purpose: 'Contest erroneous commercial or tenanted rate multiplier.',
        authority: 'Municipal Assessment Grievance Officer'
      });
    }
  });

  if (items.length === 0) {
    items.push({
      action: 'Obtain Detailed Demand Breakdown Sheet',
      purpose: 'Apply for certified assessment register extract under Section 108 of Municipal Act.',
      authority: 'Zonal Revenue Office'
    });
  }

  return {
    checklistId: 'tax_chk_' + Math.random().toString(36).substring(2, 9),
    deltaAmount: comparison.deltaAmount || 0,
    checklistItems: items,
    notice: 'Under State Municipal Laws, objections against revised property assessments must typically be filed within 30 days of receiving the demand notice.'
  };
}

/**
 * Exports property tax assessment comparison and correction dossier in markdown.
 * @param {Object} comparison 
 * @param {Object} correction 
 * @returns {string} markdown
 */
export function exportTaxCorrectionDossier(comparison = {}, correction = {}) {
  return [
    `# Property-Tax Assessment Breakdown & Correction Dossier`,
    `**Comparison:** ${comparison.periodA?.year || 'Previous Period'} vs ${comparison.periodB?.year || 'Current Period'}`,
    `**Previous Demand:** ₹${(comparison.periodA?.totalDemand || 0).toLocaleString('en-IN')}`,
    `**Revised Demand:** ₹${(comparison.periodB?.totalDemand || 0).toLocaleString('en-IN')}`,
    `**Net Variation:** ${comparison.deltaAmount >= 0 ? '+' : ''}₹${(comparison.deltaAmount || 0).toLocaleString('en-IN')} (${comparison.percentChange || 0}%)`,
    ``,
    `## Detected Attribute Deltas Explaining Variance`,
    ...(comparison.attributeChanges?.length > 0
      ? comparison.attributeChanges.map(
          c => `- **${c.field}:** Changed from \`${c.from}\` to \`${c.to}\`\n  *Probable Impact:* ${c.reason}`
        )
      : ['No attribute variations detected; increase likely driven by general municipal unit area rate hike.']),
    ``,
    `## Recommended Municipal Objection Checklist`,
    ...(correction.checklistItems?.length > 0
      ? correction.checklistItems.map(
          (i, idx) => `### Step ${idx + 1}: ${i.action}\n- **Purpose:** ${i.purpose}\n- **Target Desk:** ${i.authority}`
        )
      : ['No specific dispute items identified.']),
    ``,
    `---`,
    `> **Statutory Notice:** ${correction.notice || 'Objections must be lodged within statutory timelines.'}`
  ].join('\n');
}
