/**
 * Interactive Service Fee & Multi-Tier Expense Calculator.
 *
 * Computes exact citizen payable costs across statutory government treasury fees,
 * expedited Tatkal processing charges, physical postal booklet delivery,
 * notary stamp duty, and CSC digital kiosk facilitation fees.
 * Handles BPL (Below Poverty Line) statutory waivers and concessions.
 */

export const CONCESSION_CATEGORIES = [
  { id: 'NONE', label: 'General / No Concession', discountRate: 0 },
  { id: 'BPL', label: 'BPL / Antyodaya Cardholder (100% Base Fee Exemption)', discountRate: 1.0 },
  { id: 'PWD', label: 'Person with Disability (Divyangjan - 50% Concession)', discountRate: 0.5 },
  { id: 'SENIOR', label: 'Senior Citizen (60+ Years - 25% Concession)', discountRate: 0.25 },
  { id: 'STUDENT', label: 'Enrolled Student (Academic Concession - 25%)', discountRate: 0.25 },
];

export const DEFAULT_ESTIMATOR_OPTIONS = {
  isTatkal: false,
  needsPostalDelivery: true,
  needsNotaryAffidavit: false,
  needsKioskAssistance: false,
  concessionId: 'NONE',
};

/**
 * Parses numeric fee from free-form fee strings (e.g. "₹50 (Free for BPL)", "1500 INR", "Free").
 */
export function parseBaseFeeAmount(feeString = '') {
  if (!feeString || typeof feeString !== 'string') return 0;
  const match = feeString.match(/(\d+[\d,]*)/);
  if (match) {
    const numeric = parseInt(match[1].replace(/,/g, ''), 10);
    return Number.isNaN(numeric) ? 0 : numeric;
  }
  return 0;
}

/**
 * Calculates itemized breakdown and net payable amount for a given service.
 */
export function calculateEstimatedCost(serviceRecord = {}, userOptions = {}) {
  const service = serviceRecord || {};
  const opts = { ...DEFAULT_ESTIMATOR_OPTIONS, ...userOptions };

  const rawFeeString = service.fees || (service.fee ? String(service.fee) : '0');
  const baseFee = parseBaseFeeAmount(rawFeeString);

  // Surcharges
  const tatkalFee = opts.isTatkal ? Math.max(500, Math.round(baseFee * 1.5)) : 0;
  const postalFee = opts.needsPostalDelivery ? 50 : 0;
  const notaryFee = opts.needsNotaryAffidavit ? 150 : 0;
  const kioskFee = opts.needsKioskAssistance ? 60 : 0;

  // Concession calculation
  const selectedConcession = CONCESSION_CATEGORIES.find((c) => c.id === opts.concessionId) || CONCESSION_CATEGORIES[0];
  const waiverDiscount = Math.round(baseFee * selectedConcession.discountRate);
  const discountedBaseFee = Math.max(0, baseFee - waiverDiscount);

  const grossTotal = baseFee + tatkalFee + postalFee + notaryFee + kioskFee;
  const netPayable = discountedBaseFee + tatkalFee + postalFee + notaryFee + kioskFee;
  const isFullyExempt = netPayable === 0;

  const breakdownItems = [
    {
      label: 'Statutory Government Application Fee',
      amount: baseFee,
      discountedAmount: discountedBaseFee,
      isExempted: waiverDiscount > 0,
      description: 'Treasury Challan / Non-Judicial Head',
    },
  ];

  if (opts.isTatkal) {
    breakdownItems.push({
      label: 'Tatkal / Priority Fast-Track Processing Surcharge',
      amount: tatkalFee,
      description: 'Guaranteed 24-48 hour prioritized verification',
    });
  }

  if (opts.needsPostalDelivery) {
    breakdownItems.push({
      label: 'Speed Post Secure Document Dispatch',
      amount: postalFee,
      description: 'Department of Posts barcoded tracked parcel',
    });
  }

  if (opts.needsNotaryAffidavit) {
    breakdownItems.push({
      label: 'Notarized Affidavit & Stamp Paper Duty',
      amount: notaryFee,
      description: 'Executive magistrate / public notary attestation',
    });
  }

  if (opts.needsKioskAssistance) {
    breakdownItems.push({
      label: 'CSC / Citizen Facilitation Center Service Charge',
      amount: kioskFee,
      description: 'Operator data entry, scanner and biometric capture',
    });
  }

  return {
    serviceName: service.name || 'Civic Service',
    baseFee,
    tatkalFee,
    postalFee,
    notaryFee,
    kioskFee,
    grossTotal,
    waiverDiscount,
    netPayable,
    isFullyExempt,
    concessionName: selectedConcession.label,
    breakdownItems,
  };
}
