/**
 * @file domesticWorkerWelfareData.js
 * @description Official records of state-specific Domestic Worker Welfare Boards, statutory labour protections,
 * registration portals, social security schemes, helplines, and minimum wage notifications.
 */

export const DOMESTIC_WORKER_WELFARE_DATA = [
  {
    id: 'dw_welfare_mh',
    state: 'IN-MH',
    stateName: 'Maharashtra',
    boardName: 'Maharashtra Domestic Workers Welfare Board (MDWWB)',
    administeringAuthority: 'Labour Department, Government of Maharashtra',
    statutoryAct: 'Maharashtra Domestic Workers Welfare Board Act, 2008',
    workerCategoriesCovered: ['Cook', 'Housekeeper', 'Babysitter/Nanny', 'Elderly Caregiver', 'Gardener', 'Chauffeur'],
    registrationRoute: {
      portalName: 'Mahashramm Portal / District Labour Facilitation Centre',
      portalUrl: 'https://mahashramm.gov.in',
      isOnline: true,
      offlineRoute: 'District Labour Officer (ALC) office submission',
      feeINR: 30,
      annualRenewalINR: 12
    },
    eligibility: {
      minAge: 18,
      maxAge: 60,
      minWorkDaysPerYear: 90,
      residentOfState: true
    },
    statutoryRights: [
      'Entitled to identity smart card from the Welfare Board.',
      'Access to state social security funds and death/disability benefits.',
      'Protection against unnotified arbitrary termination; right to minimum wage schedules where notified.'
    ],
    welfareBenefits: [
      {
        benefitType: 'MATERNITY_BENEFIT',
        amountINR: 5000,
        description: 'Financial assistance for female domestic workers for up to two children.'
      },
      {
        benefitType: 'DEATH_FUNERAL_AID',
        amountINR: 25000,
        description: 'Immediate ex-gratia assistance to nominee upon natural/accidental death.'
      },
      {
        benefitType: 'EDUCATIONAL_SCHOLARSHIP_CHILDREN',
        amountINR: 2000,
        description: 'Annual scholarship for Class 9 through graduation for children of registered workers.'
      }
    ],
    requiredDocuments: [
      'Self-declaration of employment signed by employer or residential society certificate',
      'Age proof (Aadhaar Card, Voter ID, or School Leaving Certificate)',
      'Proof of residence in Maharashtra (Ration Card, Electricity Bill, or Domicile)',
      'Bank passbook details with IFSC code',
      'Two passport size photographs'
    ],
    emergencyHelplines: [
      { name: 'National Labour Helpline', number: '14434' },
      { name: 'Maharashtra Women Helpline', number: '181' },
      { name: 'Emergency Police Service', number: '112' }
    ],
    lastVerifiedDate: '2026-03-01',
    officialSourceUrl: 'https://labour.maharashtra.gov.in/schemes',
    disclaimer: 'This informational module does not collect citizen identity proofs or employer documents.'
  },
  {
    id: 'dw_welfare_ka',
    state: 'IN-KA',
    stateName: 'Karnataka',
    boardName: 'Karnataka State Unorganised Workers Social Security Board',
    administeringAuthority: 'Department of Labour, Govt. of Karnataka',
    statutoryAct: 'Unorganised Workers Social Security Act, 2008 & Karnataka Minimum Wages Notification',
    workerCategoriesCovered: ['Housekeeper', 'Cook', 'Gardener', 'Childcare Attendant'],
    registrationRoute: {
      portalName: 'Karmika Seva Sindhu / e-Shram Portal',
      portalUrl: 'https://labour.karnataka.gov.in',
      isOnline: true,
      offlineRoute: 'Seva Sindhu Kendra / Taluk Labour Office',
      feeINR: 25,
      annualRenewalINR: 10
    },
    eligibility: {
      minAge: 18,
      maxAge: 59,
      minWorkDaysPerYear: 90,
      residentOfState: true
    },
    statutoryRights: [
      'Coverage under Karnataka Minimum Wages for Domestic Employment schedule.',
      'Mandatory weekly day off (24 hours consecutive rest).',
      'Right to safe working environment free from sexual harassment under POSH Act 2013 (Local Complaints Committee).'
    ],
    welfareBenefits: [
      {
        benefitType: 'ACCIDENTAL_DISABILITY_AID',
        amountINR: 100000,
        description: 'Coverage for permanent/partial disability resulting from workplace accident.'
      },
      {
        benefitType: 'MEDICAL_CARE_SUBSIDY',
        amountINR: 10000,
        description: 'Hospitalization allowance under state unorganised worker health funds.'
      }
    ],
    requiredDocuments: [
      'Aadhaar Card (e-KYC verified)',
      'Bank Account linked to Aadhaar (NPCI mapped)',
      'Employer certificate or Domestic Workers Union membership verification',
      'Karnataka Resident Certificate / Ration card'
    ],
    emergencyHelplines: [
      { name: 'Karnataka Labour Helpline', number: '155214' },
      { name: 'Women Helpline Karnataka', number: '1091' }
    ],
    lastVerifiedDate: '2026-03-05',
    officialSourceUrl: 'https://labour.karnataka.gov.in/page/Unorganised+Workers/en',
    disclaimer: 'Disbursal of claims is solely executed through Taluk Labour Officers.'
  },
  {
    id: 'dw_welfare_central_eshram',
    state: 'ALL_INDIA',
    stateName: 'Central Sector',
    boardName: 'e-Shram National Database for Unorganised Workers (NDUW)',
    administeringAuthority: 'Ministry of Labour and Employment, Govt. of India',
    statutoryAct: 'Code on Social Security, 2020 (Unorganised Workers Section)',
    workerCategoriesCovered: ['Domestic Worker', 'Cook', 'Driver', 'Housekeeper', 'Caregiver'],
    registrationRoute: {
      portalName: 'e-Shram Portal / Common Service Centres (CSC)',
      portalUrl: 'https://eshram.gov.in',
      isOnline: true,
      offlineRoute: 'Nearby CSC VLE or Post Office',
      feeINR: 0, // Free registration
      annualRenewalINR: 0
    },
    eligibility: {
      minAge: 16,
      maxAge: 59,
      minWorkDaysPerYear: null,
      residentOfState: true
    },
    statutoryRights: [
      'Universal Account Number (UAN) card for unorganised workers valid across India.',
      'Portability of social security benefits when migrating between states.'
    ],
    welfareBenefits: [
      {
        benefitType: 'ACCIDENTAL_DEATH_INSURANCE',
        amountINR: 200000,
        description: 'Pradhan Mantri Suraksha Bima Yojana (PMSBY) accidental cover for 1 year.'
      },
      {
        benefitType: 'PARTIAL_DISABILITY_INSURANCE',
        amountINR: 100000,
        description: 'Disability financial assistance due to accidental injury.'
      }
    ],
    requiredDocuments: [
      'Aadhaar number linked to active mobile phone for OTP',
      'Savings Bank Account with IFSC code',
      'Nominee details'
    ],
    emergencyHelplines: [
      { name: 'e-Shram National Toll-Free Helpline', number: '14434' },
      { name: 'National Emergency Help', number: '112' }
    ],
    lastVerifiedDate: '2026-02-28',
    officialSourceUrl: 'https://eshram.gov.in/guidelines',
    disclaimer: 'Registration on e-Shram is free of charge; do not pay unauthorized agents.'
  }
];
