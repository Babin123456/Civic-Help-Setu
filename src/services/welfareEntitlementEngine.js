import { WELFARE_SCHEMES } from '../data/welfareSchemesData';

/**
 * Calculates aggregated citizen welfare benefits, direct cash transfers,
 * and statutory healthcare subsidies based on demographic criteria.
 */
export function calculateCitizenEntitlements(profile = {}) {
  const {
    age = 30,
    annualIncome = 200000,
    occupation = 'general',
    category = 'GENERAL',
    isStudent = false,
    hasPuccaHouse = true,
    isFarmer = false,
    hasDaughterUnder10 = false,
    hasDisability = false
  } = profile;

  const eligibleSchemes = [];
  let totalAnnualCash = 0;
  let totalHealthCoverage = 0;
  let totalSubsidySavings = 0;

  for (const scheme of WELFARE_SCHEMES) {
    const c = scheme.criteria;
    let isEligible = true;

    // Income threshold check
    if (c.maxAnnualIncome && annualIncome > c.maxAnnualIncome) {
      isEligible = false;
    }

    // Age constraints
    if (c.minAge && age < c.minAge) {
      isEligible = false;
    }

    // Occupation criteria
    if (c.occupation) {
      const occLower = occupation.toLowerCase();
      const matchOcc = c.occupation.some(occ => occLower.includes(occ)) || (isFarmer && c.occupation.includes('farmer'));
      if (!matchOcc) isEligible = false;
    }

    // Social category filter
    if (c.priorityCategories) {
      if (!c.priorityCategories.includes(category.toUpperCase())) {
        isEligible = false;
      }
    }

    // Specific situational requirements
    if (c.hasPuccaHouse !== undefined && hasPuccaHouse !== c.hasPuccaHouse) {
      isEligible = false;
    }

    if (c.student && !isStudent) {
      isEligible = false;
    }

    if (c.hasDaughterUnder10 && !hasDaughterUnder10) {
      isEligible = false;
    }

    if (isEligible) {
      eligibleSchemes.push(scheme);
      totalAnnualCash += scheme.annualBenefitCash || 0;
      if (scheme.type === 'HEALTH_COVER') {
        totalHealthCoverage += scheme.annualBenefitInKind || 0;
      } else {
        totalSubsidySavings += scheme.annualBenefitInKind || 0;
      }
    }
  }

  // Category summary groupings
  const byCategory = eligibleSchemes.reduce((acc, s) => {
    acc[s.category] = (acc[s.category] || 0) + (s.annualBenefitCash + s.annualBenefitInKind);
    return acc;
  }, {});

  return {
    profileSummary: {
      age,
      annualIncome,
      occupation,
      category
    },
    eligibleCount: eligibleSchemes.length,
    eligibleSchemes,
    totalAnnualCash,
    totalHealthCoverage,
    totalSubsidySavings,
    totalGrossAnnualValue: totalAnnualCash + totalHealthCoverage + totalSubsidySavings,
    byCategory
  };
}

/**
 * Formats Indian Currency (INR) with standard commas
 */
export function formatInr(amount = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Catalog mapping specific civic services to their statutory financial entitlement schemes
 */
export const SERVICE_BENEFIT_CATALOG = {
  'pm-kisan': {
    schemeId: 'pm-kisan',
    name: 'PM-KISAN Samman Nidhi',
    category: 'Agriculture & Rural Welfare',
    benefitType: 'DIRECT_CASH',
    annualBenefitCash: 6000,
    annualBenefitInKind: 0,
    disbursementFrequency: 'Quarterly (Every 4 Months)',
    installments: [
      { period: 'Period 1 (Apr - Jul)', amount: 2000, description: 'Direct benefit transfer to Aadhaar-linked bank account' },
      { period: 'Period 2 (Aug - Nov)', amount: 2000, description: 'Second DBT installment upon e-KYC verification' },
      { period: 'Period 3 (Dec - Mar)', amount: 2000, description: 'Third DBT installment for agricultural input purchase' }
    ],
    maxAnnualIncome: 300000,
    requiredOccupation: ['farmer', 'agriculture'],
    statutoryRules: [
      'Landholding must be registered in state land revenue records (Bhulekh/Khasra).',
      'Mandatory Aadhaar seeding and NPCI bank account mapping.',
      'Institutional landholders and serving government employees are excluded.'
    ],
    howToClaim: 'Register online at pmkisan.gov.in or visit the nearest CSC kiosk with land record and Aadhaar.'
  },
  'ration-card': {
    schemeId: 'nfsa-ration',
    name: 'National Food Security Act (NFSA) Subsidized Grains',
    category: 'Food & Civil Supplies',
    benefitType: 'SUBSIDY',
    annualBenefitCash: 0,
    annualBenefitInKind: 14400,
    disbursementFrequency: 'Monthly Quota',
    installments: [
      { period: 'Monthly (1st - 30th)', amount: 1200, description: 'Monthly allocation of rice (₹3/kg or free), wheat (₹2/kg or free), and coarse grains under PMGKAY' }
    ],
    maxAnnualIncome: 180000,
    statutoryRules: [
      'Household income must be below state-defined poverty or priority limit.',
      'One Nation One Ration Card (ONORC) enables portability across Fair Price Shops nationwide.',
      'Biometric e-PoS authentication required at fair price shops.'
    ],
    howToClaim: 'Apply via State Food & Civil Supplies Portal or Block Development Office with family Aadhaar copies.'
  },
  'ayushman-bharat': {
    schemeId: 'ayushman-bharat',
    name: 'Ayushman Bharat PM-JAY',
    category: 'Healthcare & Wellness',
    benefitType: 'HEALTH_COVER',
    annualBenefitCash: 0,
    annualBenefitInKind: 500000,
    disbursementFrequency: 'Cashless Annual Cover',
    installments: [
      { period: 'Annual Floating Cover', amount: 500000, description: 'Cashless coverage per family per year across 27,000+ empanelled hospitals' }
    ],
    maxAnnualIncome: 250000,
    statutoryRules: [
      'Entitled families identified based on SECC 2011 deprivation criteria.',
      'Covers pre-existing conditions from day one with zero waiting period.',
      'Includes 3 days pre-hospitalization and 15 days post-hospitalization medicine costs.'
    ],
    howToClaim: 'Generate Ayushman Golden Card at any empanelled hospital or Ayushman Arogya Mandir.'
  },
  'income-certificate': {
    schemeId: 'statutory-fee-concession-gateway',
    name: 'Government Fee Concession & Welfare Gateway',
    category: 'Revenue & Certificates',
    benefitType: 'GATEWAY',
    annualBenefitCash: 15000,
    annualBenefitInKind: 0,
    disbursementFrequency: 'Annual Multi-Scheme Access',
    installments: [
      { period: 'Academic Year / State Portal Cycle', amount: 15000, description: 'Unlocks post-matric scholarships, exam fee remissions, housing subsidies, and EWS certificates' }
    ],
    maxAnnualIncome: 800000,
    statutoryRules: [
      'Valid for 1 to 3 fiscal years depending on state revenue regulations.',
      'Must encompass total gross household income from all sources (agriculture, salary, trade).'
    ],
    howToClaim: 'Submit salary slips, ITR, or village revenue Patwari report through the state e-District portal.'
  }
};

/**
 * Returns benefit metadata for a given service, or null if no welfare benefits apply.
 */
export function getServiceBenefitMetadata(serviceId) {
  if (!serviceId) return null;
  const normalized = String(serviceId).toLowerCase().trim();
  return SERVICE_BENEFIT_CATALOG[normalized] || null;
}

/**
 * Calculates concrete financial entitlement and eligibility for a specific civic service.
 */
export function calculateServiceBenefit(serviceId, profile = {}) {
  const meta = getServiceBenefitMetadata(serviceId);
  if (!meta) {
    return {
      hasBenefit: false,
      serviceId,
      message: 'This service is an administrative procedure or standard registration with no direct cash subsidy attached.'
    };
  }

  const {
    age = 30,
    annualIncome = 150000,
    occupation = 'general',
    category = 'GENERAL',
    isFarmer = false,
  } = profile;

  let isEligible = true;
  const eligibilityReasons = [];
  const disqualificationReasons = [];

  // Income verification
  if (meta.maxAnnualIncome) {
    if (annualIncome <= meta.maxAnnualIncome) {
      eligibilityReasons.push(`Reported income (${formatInr(annualIncome)}) is within the statutory ceiling of ${formatInr(meta.maxAnnualIncome)}.`);
    } else {
      isEligible = false;
      disqualificationReasons.push(`Reported income (${formatInr(annualIncome)}) exceeds the statutory eligibility ceiling of ${formatInr(meta.maxAnnualIncome)}.`);
    }
  }

  // Occupation verification if needed
  if (meta.requiredOccupation && meta.requiredOccupation.length > 0) {
    const occLower = String(occupation).toLowerCase();
    const matchesOcc = meta.requiredOccupation.some(o => occLower.includes(o)) || (isFarmer && meta.requiredOccupation.includes('farmer'));
    if (matchesOcc) {
      eligibilityReasons.push(`Applicant occupation matches designated sector (${meta.requiredOccupation.join(', ')}).`);
    } else {
      isEligible = false;
      disqualificationReasons.push(`Scheme priority reserved for designated occupation: ${meta.requiredOccupation.join(', ')}.`);
    }
  }

  const totalAnnualBenefit = meta.annualBenefitCash + meta.annualBenefitInKind;
  const status = isEligible ? 'eligible' : (disqualificationReasons.length > 0 ? 'ineligible' : 'potential');

  return {
    hasBenefit: true,
    serviceId,
    schemeId: meta.schemeId,
    schemeName: meta.name,
    category: meta.category,
    benefitType: meta.benefitType,
    annualBenefitCash: meta.annualBenefitCash,
    annualBenefitInKind: meta.annualBenefitInKind,
    totalAnnualBenefit,
    formattedAnnualBenefit: formatInr(totalAnnualBenefit),
    disbursementFrequency: meta.disbursementFrequency,
    installments: meta.installments,
    statutoryRules: meta.statutoryRules,
    howToClaim: meta.howToClaim,
    eligibilityStatus: status,
    eligibilityReasons: isEligible ? eligibilityReasons : disqualificationReasons,
    assessedProfile: { age, annualIncome, occupation, category }
  };
}
