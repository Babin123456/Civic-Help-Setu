/**
 * @file irdaiGrievanceData.js
 * @description Official IRDAI (Insurance Regulatory and Development Authority of India) dispute resolution framework,
 * Executive Council of Insurers / Insurance Ombudsman rules, 2017, and Bima Bharosa portal pathways.
 */

export const IRDAI_GRIEVANCE_CHANNELS = {
  BIMA_BHAROSA_PORTAL: {
    name: 'Bima Bharosa (IRDAI Integrated Grievance Management System - IGMS)',
    portalUrl: 'https://bimabharosa.irdai.gov.in',
    tollFreeHelpline: '155255',
    alternateHelpline: '1800-4254-732',
    disposalWindowDays: 15
  },
  INSURANCE_OMBUDSMAN_COUNCIL: {
    name: 'Council for Insurance Ombudsmen (CIO)',
    portalUrl: 'https://cioins.co.in',
    maxAwardCompensationINR: 5000000, // ₹50 Lakhs limit under Insurance Ombudsman Rules, 2017
    limitationPeriodYears: 1
  }
};

export const INSURANCE_PRODUCT_CATEGORIES = [
  {
    productType: 'HEALTH_INSURANCE',
    title: 'Health / Mediclaim Insurance',
    commonRejectionReasons: [
      {
        code: 'PRE_EXISTING_DISEASE_NON_DISCLOSURE',
        title: 'Alleged Non-Disclosure of Pre-Existing Disease (PED)',
        plainExplanation: 'Insurer claims you failed to declare a past ailment when purchasing the policy.',
        counterCheck: 'Under IRDAI Master Circular, PED exclusion cannot apply after policy continuous renewal exceeds the statutory Moratorium Period (60 months / 5 years).'
      },
      {
        code: 'PROPORTIONATE_DEDUCTION_ROOM_RENT',
        title: 'Proportionate Deduction for Room Rent Capping',
        plainExplanation: 'If room rent exceeds sub-limit (e.g. 1% of sum insured), insurer deducts associated doctor and surgery fees proportionally.',
        counterCheck: 'Verify policy schedule for room rent limits and check whether ICU charges were wrongfully subjected to proportionate deductions.'
      },
      {
        code: 'INVESTIGATION_ONLY_ADMISSION',
        title: 'Active Line of Treatment vs. Diagnostic Evaluation',
        plainExplanation: 'Insurer claims hospitalisation was purely for diagnostic tests without active medical intervention.',
        counterCheck: 'Request treating doctor for a Certificate of Active Line of Treatment confirming continuous inpatient therapy.'
      }
    ]
  },
  {
    productType: 'MOTOR_INSURANCE',
    title: 'Motor / Vehicle Insurance',
    commonRejectionReasons: [
      {
        code: 'DELAY_IN_INTIMATION',
        title: 'Delayed Theft or Accident Intimation',
        plainExplanation: 'Insurer rejected claim because accident or theft was reported after a few days delay.',
        counterCheck: 'Supreme Court ruling (Gurshinder Singh vs Sriram General Insurance) holds genuine claims cannot be rejected solely due to delay if FIR/police report was lodged promptly.'
      },
      {
        code: 'CONSEQUENTIAL_ENGINE_HYDROSTATIC_LOCK',
        title: 'Engine Seizure / Hydrostatic Lock in Waterlogged Roads',
        plainExplanation: 'Damage caused by water entering the running engine during floods without Engine Protect add-on.',
        counterCheck: 'Check if policy includes Engine Protector or Zero Depreciation endorsement.'
      }
    ]
  },
  {
    productType: 'LIFE_INSURANCE',
    title: 'Life Insurance / Term Insurance',
    commonRejectionReasons: [
      {
        code: 'SECTION_45_NON_DISCLOSURE',
        title: 'Section 45 Insurance Act Repudiation',
        plainExplanation: 'Insurer claims policyholder suppressed material health or smoking history.',
        counterCheck: 'Under Section 45 of Insurance Act, 1938, no life insurance policy can be called in question on any ground whatsoever after the expiry of 3 years from the date of issuance.'
      }
    ]
  }
];
