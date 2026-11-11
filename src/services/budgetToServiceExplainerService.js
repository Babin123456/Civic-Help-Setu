/**
 * Public Budget-to-Service Explainer Service
 *
 * Implements a RAG-backed public expenditure explainer connecting local government budget
 * allocations and actual expenditures to everyday civic infrastructure (roads, drainage,
 * sanitation, public health, parks):
 *
 * 1. Provenance Preservation:
 *    - Preserves exact source citations (document title, page number, table id, official URL)
 *      for every financial figure.
 * 2. Distinct Financial & Physical Lifecycle Metrics:
 *    - Explicitly separates Budget Allocation (BE), Revised Estimate (RE), Actual Expenditure,
 *      and Physical Work Completion.
 *    - STRICT RULE: Never infers physical project completion from expenditure disbursements alone.
 * 3. Unit Normalization & Comparison Safety:
 *    - Explicitly standardizes monetary units (Crores, Lakhs, INR) without silent conversions.
 *    - Rejects or flags comparisons across non-comparable accounting heads or missing years.
 * 4. Plain-Language Service Explanations:
 *    - Generates grounded, cited explanations translating technical budget codes (e.g. Major Head 2215)
 *      into tangible civic outcomes.
 */

export const MONETARY_UNIT = {
  CRORES: 'CRORES',
  LAKHS: 'LAKHS',
  INR: 'INR',
};

export const CIVIC_SERVICE_CATEGORY = {
  ROADS_AND_BRIDGES: 'ROADS_AND_BRIDGES',
  WATER_SUPPLY_AND_DRAINAGE: 'WATER_SUPPLY_AND_DRAINAGE',
  SOLID_WASTE_MANAGEMENT: 'SOLID_WASTE_MANAGEMENT',
  PUBLIC_HEALTH_CENTRES: 'PUBLIC_HEALTH_CENTRES',
  PARKS_AND_PLAYGROUNDS: 'PARKS_AND_PLAYGROUNDS',
  STREET_LIGHTING: 'STREET_LIGHTING',
};

/**
 * Standard unit multiplier factors to base INR.
 */
const UNIT_MULTIPLIERS = {
  [MONETARY_UNIT.CRORES]: 10000000,
  [MONETARY_UNIT.LAKHS]: 100000,
  [MONETARY_UNIT.INR]: 1,
};

/**
 * Converts any figure to base INR for mathematical comparisons.
 */
export function toBaseInr(amount, unit = MONETARY_UNIT.INR) {
  const mult = UNIT_MULTIPLIERS[unit] || 1;
  return Number(amount) * mult;
}

/**
 * Formats an amount with an explicit unit label to prevent silent unit mixing.
 */
export function formatMonetaryWithUnit(amount, unit = MONETARY_UNIT.CRORES) {
  return `₹${Number(amount).toLocaleString('en-IN')} ${unit}`;
}

/**
 * Ingests a structured budget line item while strictly validating provenance and metrics.
 *
 * @param {Object} input
 * @returns {Object} Normalized budget record
 */
export function ingestBudgetLineItem(input = {}) {
  const {
    id,
    financialYear,
    department,
    schemeName,
    budgetHead = 'GENERAL',
    serviceCategory = CIVIC_SERVICE_CATEGORY.ROADS_AND_BRIDGES,
    budgetAllocation = 0,
    revisedEstimate = null,
    actualExpenditure = null,
    physicalCompletionPercent = null,
    unit = MONETARY_UNIT.CRORES,
    geographicScope = 'CITY_WIDE',
    provenance,
  } = input;

  if (!financialYear || !/^\d{4}-\d{2,4}$/.test(financialYear)) {
    throw new Error('Valid financial year (e.g., "2025-2026") is required');
  }

  if (!department || typeof department !== 'string') {
    throw new Error('Valid department name is required');
  }

  if (!provenance || !provenance.docTitle || !provenance.pageNumber) {
    throw new Error('Provenance Violation: Every budget figure must cite an official docTitle and pageNumber');
  }

  const generatedId = id || `bud_${financialYear}_${Math.random().toString(36).slice(2, 7)}`;

  return {
    id: generatedId,
    financialYear: financialYear.trim(),
    department: department.trim(),
    schemeName: String(schemeName || department).trim(),
    budgetHead: budgetHead.trim(),
    serviceCategory,
    // Distinct metrics
    budgetAllocation: Number(budgetAllocation) || 0,
    revisedEstimate: revisedEstimate !== null ? Number(revisedEstimate) : null,
    actualExpenditure: actualExpenditure !== null ? Number(actualExpenditure) : null,
    physicalCompletionPercent:
      physicalCompletionPercent !== null ? Math.min(100, Math.max(0, Number(physicalCompletionPercent))) : null,
    unit,
    geographicScope,
    provenance: {
      docTitle: provenance.docTitle.trim(),
      pageNumber: Number(provenance.pageNumber),
      tableId: provenance.tableId ? String(provenance.tableId).trim() : 'Table 1',
      sourceUrl: provenance.sourceUrl ? String(provenance.sourceUrl).trim() : null,
    },
    isComparable: true,
  };
}

/**
 * Compares budget allocation and expenditure across two financial years for a service category.
 * Verifies unit parity and flags missing or non-comparable data.
 *
 * @param {Object} baselineYearItem
 * @param {Object} candidateYearItem
 * @returns {Object} Comparative analysis
 */
export function compareBudgetYears(baselineYearItem, candidateYearItem) {
  if (!baselineYearItem || !candidateYearItem) {
    return {
      isComparable: false,
      comparabilityWarning: 'Incomplete data: One or both financial year records are missing.',
    };
  }

  // Ensure same category
  if (baselineYearItem.serviceCategory !== candidateYearItem.serviceCategory) {
    return {
      isComparable: false,
      comparabilityWarning: `Cannot compare different service categories (${baselineYearItem.serviceCategory} vs ${candidateYearItem.serviceCategory}).`,
    };
  }

  // Convert to base INR to guarantee safe mathematical comparisons without silent unit mixing
  const baseAllocInr = toBaseInr(baselineYearItem.budgetAllocation, baselineYearItem.unit);
  const candAllocInr = toBaseInr(candidateYearItem.budgetAllocation, candidateYearItem.unit);

  const deltaAllocInr = candAllocInr - baseAllocInr;
  const deltaAllocPct = baseAllocInr > 0 ? Number(((deltaAllocInr / baseAllocInr) * 100).toFixed(1)) : 0;

  // Actual expenditures comparison if both present
  let expenditureComparison = null;
  if (baselineYearItem.actualExpenditure !== null && candidateYearItem.actualExpenditure !== null) {
    const baseExpInr = toBaseInr(baselineYearItem.actualExpenditure, baselineYearItem.unit);
    const candExpInr = toBaseInr(candidateYearItem.actualExpenditure, candidateYearItem.unit);
    const deltaExpInr = candExpInr - baseExpInr;
    expenditureComparison = {
      baselineActualInr: baseExpInr,
      candidateActualInr: candExpInr,
      deltaPercent: baseExpInr > 0 ? Number(((deltaExpInr / baseExpInr) * 100).toFixed(1)) : 0,
    };
  } else {
    expenditureComparison = {
      isMissingExpenditure: true,
      note: 'One or both years have unfinalized actual expenditure records.',
    };
  }

  return {
    isComparable: true,
    serviceCategory: baselineYearItem.serviceCategory,
    baselineYear: baselineYearItem.financialYear,
    candidateYear: candidateYearItem.financialYear,
    allocationDeltaPercent: deltaAllocPct,
    expenditureComparison,
    provenanceCitations: [baselineYearItem.provenance, candidateYearItem.provenance],
  };
}

/**
 * Generates an interpretable, citation-backed plain-language civic summary.
 *
 * @param {Object} item Normalized budget record
 * @returns {string} Plain language summary with source citations
 */
export function generateServiceBudgetSummary(item) {
  if (!item) return 'No budget data available.';

  const allocFormatted = formatMonetaryWithUnit(item.budgetAllocation, item.unit);
  const expFormatted =
    item.actualExpenditure !== null ? formatMonetaryWithUnit(item.actualExpenditure, item.unit) : 'Pending / Not Published';

  let physicalStatus = 'Physical completion tracking is not provided in financial accounts.';
  if (item.physicalCompletionPercent !== null) {
    physicalStatus = `Independent physical inspection confirms ${item.physicalCompletionPercent}% of work completed.`;
  }

  // Calculate fund utilization
  let utilizationText = '';
  if (item.actualExpenditure !== null && item.budgetAllocation > 0) {
    const utilPct = ((toBaseInr(item.actualExpenditure, item.unit) / toBaseInr(item.budgetAllocation, item.unit)) * 100).toFixed(1);
    utilizationText = ` (Utilization: ${utilPct}% of initial allocation).`;
  }

  const citation = `[Source: ${item.provenance.docTitle}, Page ${item.provenance.pageNumber}, ${item.provenance.tableId}]`;

  return (
    `For Financial Year ${item.financialYear}, ${item.department} allocated ${allocFormatted} for ` +
    `"${item.schemeName}". Actual recorded expenditure stands at ${expFormatted}${utilizationText} ` +
    `${physicalStatus} Note: Financial expenditure does not automatically equate to finished ground infrastructure. ${citation}`
  );
}
