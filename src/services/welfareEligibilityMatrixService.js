/**
 * Multi-Scheme Welfare Eligibility Evaluation Engine.
 * Evaluates a citizen or household profile against statutory central/state criteria.
 */

export const WELFARE_SCHEMES = [
  {
    id: 'pm-jay',
    title: 'Ayushman Bharat (PM-JAY)',
    category: 'Healthcare',
    ministry: 'Ministry of Health and Family Welfare',
    maxAnnualIncome: 250000,
    minAge: 0,
    maxAge: 120,
    benefitSummary: '₹5 Lakh per family per year secondary & tertiary hospitalization coverage.',
    checkEligibility: (profile) => {
      const income = Number(profile.annualIncome) || 0;
      if (profile.hasBplCard || income <= 250000) {
        return { isEligible: true, matchStatus: 'ELIGIBLE', reason: 'Meets income threshold (< ₹2.5L / BPL coverage)' };
      }
      return { isEligible: false, matchStatus: 'INELIGIBLE', reason: 'Annual income exceeds ₹2.5L threshold' };
    },
  },
  {
    id: 'pm-kisan',
    title: 'PM-Kisan Samman Nidhi',
    category: 'Agriculture',
    ministry: 'Ministry of Agriculture & Farmers Welfare',
    maxAnnualIncome: 400000,
    minAge: 18,
    maxAge: 100,
    benefitSummary: '₹6,000 per year direct income support in three equal ₹2,000 tranches.',
    checkEligibility: (profile) => {
      const isFarmer = profile.occupation === 'farmer' || profile.isFarmer === true || profile.hasAgriculturalLand === true;
      if (!isFarmer) {
        return { isEligible: false, matchStatus: 'INELIGIBLE', reason: 'Requires cultivable agricultural land ownership' };
      }
      return { isEligible: true, matchStatus: 'ELIGIBLE', reason: 'Meets farmer and agricultural land ownership criteria' };
    },
  },
  {
    id: 'pmay-u',
    title: 'PM Awas Yojana (PMAY - Housing)',
    category: 'Housing',
    ministry: 'Ministry of Housing and Urban Affairs',
    maxAnnualIncome: 600000,
    minAge: 18,
    maxAge: 99,
    benefitSummary: 'Interest subsidy up to ₹2.67 Lakh on home loans for first-time pucca house owners.',
    checkEligibility: (profile) => {
      const income = Number(profile.annualIncome) || 0;
      const ownsPuccaHouse = Boolean(profile.ownsPuccaHouse);
      if (ownsPuccaHouse) {
        return { isEligible: false, matchStatus: 'INELIGIBLE', reason: 'Beneficiary family must not own a pucca house' };
      }
      if (income <= 600000) {
        return { isEligible: true, matchStatus: 'ELIGIBLE', reason: 'Qualifies for EWS / LIG credit-linked housing subsidy' };
      }
      return { isEligible: false, matchStatus: 'INELIGIBLE', reason: 'Household income exceeds ₹6L subsidy ceiling' };
    },
  },
  {
    id: 'ignoaps',
    title: 'National Old Age Pension Scheme (IGNOAPS)',
    category: 'Social Security',
    ministry: 'Ministry of Rural Development',
    maxAnnualIncome: 200000,
    minAge: 60,
    maxAge: 120,
    benefitSummary: 'Monthly central & state cash pension for senior citizens from low-income households.',
    checkEligibility: (profile) => {
      const age = Number(profile.age) || 0;
      const income = Number(profile.annualIncome) || 0;
      if (age < 60) {
        return { isEligible: false, matchStatus: 'INELIGIBLE', reason: `Applicant age (${age} yrs) is below senior threshold (60 yrs)` };
      }
      if (income > 200000 && !profile.hasBplCard) {
        return { isEligible: false, matchStatus: 'INELIGIBLE', reason: 'Income exceeds ₹2L low-income limit' };
      }
      return { isEligible: true, matchStatus: 'ELIGIBLE', reason: 'Meets age (60+) and vulnerable income threshold' };
    },
  },
  {
    id: 'sukanya',
    title: 'Sukanya Samriddhi Yojana (SSY)',
    category: 'Women & Child',
    ministry: 'Ministry of Finance',
    maxAnnualIncome: 99999999,
    minAge: 0,
    maxAge: 10,
    benefitSummary: 'High-interest tax-exempt savings scheme (8.2% p.a.) with Section 80C rebate for girl child.',
    checkEligibility: (profile) => {
      const age = Number(profile.childAge ?? profile.age) || 0;
      const isGirl = profile.gender === 'female' || profile.hasGirlChild === true;
      if (!isGirl) {
        return { isEligible: false, matchStatus: 'INELIGIBLE', reason: 'Scheme exclusive to parents/guardians of girl child' };
      }
      if (age > 10) {
        return { isEligible: false, matchStatus: 'INELIGIBLE', reason: `Girl child must be 10 years or younger (Current: ${age} yrs)` };
      }
      return { isEligible: true, matchStatus: 'ELIGIBLE', reason: 'Eligible for SSY high-yield sovereign savings account' };
    },
  },
];

/**
 * Evaluates a given applicant or household profile against all welfare schemes.
 */
export const evaluateCitizenAcrossSchemes = (profile = {}) => {
  return WELFARE_SCHEMES.map((scheme) => {
    const outcome = scheme.checkEligibility(profile);
    return {
      schemeId: scheme.id,
      title: scheme.title,
      category: scheme.category,
      ministry: scheme.ministry,
      benefitSummary: scheme.benefitSummary,
      isEligible: outcome.isEligible,
      matchStatus: outcome.matchStatus,
      reason: outcome.reason,
    };
  });
};
