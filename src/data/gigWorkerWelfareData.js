/**
 * @file gigWorkerWelfareData.js
 * @description Grounded dataset of statutory gig and platform worker social security programmes,
 * state welfare boards (e.g. Rajasthan, Karnataka), registration portals, dispute channels, and plain-language terminology.
 */

export const GIG_WELFARE_PROGRAMMES = [
  {
    id: 'gig_prog_rajasthan_act',
    scope: 'STATE_STATUTORY',
    state: 'IN-RJ',
    stateName: 'Rajasthan',
    title: 'Rajasthan Platform Based Gig Workers (Registration and Welfare) Act, 2023',
    administeringAuthority: 'Rajasthan Platform Based Gig Workers Welfare Board',
    coverage: ['Delivery Partners', 'Ride-Hailing Drivers', 'Home Service Aggregator Personnel'],
    statutoryMechanisms: {
      welfareCessFee: 'Fee levied on each transaction on aggregator platforms to fund the welfare corpus.',
      uniqueWorkerId: 'Unique ID issued to each gig worker valid across aggregators in Rajasthan.',
      aggregatorCompliance: 'Mandatory registration of aggregator platforms operating in Rajasthan.'
    },
    eligibility: {
      minimumAge: 18,
      onboardedWithAggregatorInState: true,
      activePlatformAccount: true
    },
    benefits: [
      'Accident and health insurance coverage funded through the welfare cess fund.',
      'Access to state social security schemes without forfeiture upon changing aggregators.',
      'Statutory grievance redressal portal for sudden deactivation or payout deductions.'
    ],
    requiredDocuments: [
      'Aadhaar card for digital KYC',
      'Active mobile number linked to aggregator app profile',
      'Aggregator partner ID / login screenshot / onboarding confirmation letter',
      'Bank account details for DBT transfers'
    ],
    registrationPortal: {
      name: 'Rajasthan Jan Kalyan / Gig Worker Board Portal',
      url: 'https://jankalyan.rajasthan.gov.in',
      isOfficial: true
    },
    lastVerifiedDate: '2026-03-01',
    guidelineSourceUrl: 'https://labour.rajasthan.gov.in/ActsRules.aspx',
    disclaimer: 'Civic Help Setu is strictly an informational tool; official worker ID generation is performed exclusively by the Government of Rajasthan.'
  },
  {
    id: 'gig_prog_karnataka_free_insurance',
    scope: 'STATE_STATUTORY',
    state: 'IN-KA',
    stateName: 'Karnataka',
    title: 'Karnataka Gig Worker Accident & Life Insurance Scheme',
    administeringAuthority: 'Karnataka State Unorganised Workers Social Security Board',
    coverage: ['Food Delivery Agents', 'E-commerce Delivery Couriers', 'App-Based Cab and Auto Drivers'],
    statutoryMechanisms: {
      welfareCessFee: 'State-funded insurance premium subsidy.',
      uniqueWorkerId: 'Linked to Seva Sindhu / e-Shram UAN.'
    },
    eligibility: {
      minimumAge: 18,
      maximumAge: 60,
      activeOnPlatformPastMonths: 3,
      residentOfKarnataka: true
    },
    benefits: [
      '₹2,00,000 accidental death cover.',
      '₹2,00,000 permanent total disability cover.',
      '₹1,00,000 hospitalisation reimbursement for accidents incurred while on active duty.'
    ],
    requiredDocuments: [
      'Karnataka residence proof or voter ID',
      'Proof of completion of deliveries/trips on platform in Karnataka within last 90 days',
      'Aadhaar e-KYC consent',
      'Bank passbook copy'
    ],
    registrationPortal: {
      name: 'Seva Sindhu Gig Worker Insurance Portal',
      url: 'https://sevasindhu.karnataka.gov.in',
      isOfficial: true
    },
    lastVerifiedDate: '2026-03-08',
    guidelineSourceUrl: 'https://labour.karnataka.gov.in/announcements',
    disclaimer: 'Insurance claims are evaluated and settled by the state nodal insurance underwriter.'
  },
  {
    id: 'gig_prog_central_code_2020',
    scope: 'CENTRAL_FRAMEWORK',
    state: 'ALL_INDIA',
    stateName: 'Central Sector',
    title: 'Code on Social Security 2020 - Gig & Platform Worker Provisions',
    administeringAuthority: 'Ministry of Labour and Employment, Govt. of India',
    coverage: ['All app-based transport, logistics, food delivery, and freelance platform personnel'],
    statutoryMechanisms: {
      welfareCessFee: 'Contribution by aggregators at 1% to 2% of annual turnover, not exceeding 5% of amount paid to gig workers.',
      uniqueWorkerId: 'e-Shram Universal Account Number (UAN)'
    },
    eligibility: {
      minimumAge: 16,
      maximumAge: 59,
      engagedInGigOrPlatformWork: true
    },
    benefits: [
      'National social security fund covering life, disability, health, and old age benefits.',
      'Inter-state portability of registered unorganised worker profile.'
    ],
    requiredDocuments: [
      'Aadhaar card with linked mobile phone',
      'Active bank account with IFSC code',
      'Nominee details'
    ],
    registrationPortal: {
      name: 'e-Shram National Portal',
      url: 'https://eshram.gov.in',
      isOfficial: true
    },
    lastVerifiedDate: '2026-02-25',
    guidelineSourceUrl: 'https://labour.gov.in/whatsnew/code-social-security-2020',
    disclaimer: 'Central rules notify enabling framework; specific welfare schemes are rolled out in phases.'
  }
];

export const GIG_TERMINOLOGY_GLOSSARY = [
  {
    term: 'Platform Worker',
    definition: 'A person engaged in a work arrangement in which an organisation uses an online platform or mobile application to access other organisations or individuals to solve specific problems or provide specific services.'
  },
  {
    term: 'Aggregator Cess',
    definition: 'A statutory contribution mandated by government legislation levied on the gross revenue of digital aggregators to finance social security and accident funds for gig workers.'
  },
  {
    term: 'Arbitrary Deactivation',
    definition: 'The unilateral suspension or termination of a gig worker account by a platform without prior written notice, transparent reason, or right of appeal to a neutral grievance officer.'
  },
  {
    term: 'Direct Benefit Transfer (DBT)',
    definition: 'Government mechanism transferring insurance payouts, maternity grants, or scholarships directly into the bank account linked with the worker Aadhaar in the NPCI mapper.'
  }
];
