/**
 * @file legalAidDirectoryData.js
 * @description Official NALSA (National Legal Services Authority), SLSA (State Legal Services Authority),
 * and DLSA (District Legal Services Authority) verified contacts, Section 12 statutory criteria, and Lok Adalat services.
 */

export const STATUTORY_LEGAL_AID_CRITERIA_SEC_12 = [
  {
    categoryCode: 'WOMEN_AND_CHILDREN',
    title: 'Women and Children',
    statutoryReference: 'Section 12(c) of the Legal Services Authorities Act, 1987',
    incomeBarApplicable: false,
    plainLanguageExplanation: 'All women and children are entitled to free legal aid regardless of their financial status or income.'
  },
  {
    categoryCode: 'SC_ST',
    title: 'Members of Scheduled Castes or Scheduled Tribes',
    statutoryReference: 'Section 12(a) of the Legal Services Authorities Act, 1987',
    incomeBarApplicable: false,
    plainLanguageExplanation: 'Eligible for free legal services irrespective of income ceiling upon producing caste identity.'
  },
  {
    categoryCode: 'PERSONS_WITH_DISABILITIES',
    title: 'Persons with Disabilities / Mental Illness',
    statutoryReference: 'Section 12(d) of the Legal Services Authorities Act, 1987',
    incomeBarApplicable: false,
    plainLanguageExplanation: 'Persons suffering from disability as defined in Rights of Persons with Disabilities Act, 2016.'
  },
  {
    categoryCode: 'VICTIMS_OF_DISASTER_OR_TRAFFICKING',
    title: 'Victims of Human Trafficking, Mass Disaster, or Ethnic Violence',
    statutoryReference: 'Section 12(e) & (g) of the Legal Services Authorities Act, 1987',
    incomeBarApplicable: false,
    plainLanguageExplanation: 'Entitled to immediate free legal assistance and rehabilitation support.'
  },
  {
    categoryCode: 'INDUSTRIAL_WORKERS',
    title: 'Industrial Workmen',
    statutoryReference: 'Section 12(f) of the Legal Services Authorities Act, 1987',
    incomeBarApplicable: false,
    plainLanguageExplanation: 'Workers covered under the Industrial Disputes Act, 1947.'
  },
  {
    categoryCode: 'UNDER_TRIAL_PRISONERS_IN_CUSTODY',
    title: 'Persons in Custody / Under-Trial Detainees',
    statutoryReference: 'Section 12(g) of the Legal Services Authorities Act, 1987',
    incomeBarApplicable: false,
    plainLanguageExplanation: 'Anyone detained in custody, juvenile home, or protective custody.'
  },
  {
    categoryCode: 'LOW_INCOME_CITIZENS',
    title: 'General Low-Income Individuals',
    statutoryReference: 'Section 12(h) of the Legal Services Authorities Act, 1987',
    incomeBarApplicable: true,
    incomeCeilingsINR: {
      defaultGeneralINR: 300000,
      supremeCourtCasesINR: 500000
    },
    plainLanguageExplanation: 'Citizens whose annual income from all sources does not exceed the ceiling notified by their respective State Government (typically ₹3,00,000 for High Court/District Court cases and ₹5,00,000 for Supreme Court cases).'
  }
];

export const DLSA_DIRECTORY = [
  {
    id: 'dlsa_ka_bengaluru_urban',
    state: 'IN-KA',
    district: 'Bengaluru Urban',
    authorityName: 'District Legal Services Authority (DLSA) Bengaluru Urban',
    officeAddress: 'City Civil Court Complex, Kempegowda Road, Bengaluru, Karnataka 560009',
    phone: '080-22111746',
    email: 'dlsa-bengaluruurban@karnataka.gov.in',
    tollFreeHelpline: '15100', // NALSA 24/7 National Legal Helpline
    secretaryDesignation: 'Senior Civil Judge & Member Secretary',
    portalUrl: 'https://kslsa.kar.nic.in',
    lokAdalatServices: [
      'Pre-litigation civil dispute mediation',
      'Motor Accident Claims Tribunal (MACT) settlements',
      'Cheque bounce (Sec 138 NI Act) conciliation',
      'Compoundable criminal offenses'
    ],
    lastVerifiedDate: '2026-03-01'
  },
  {
    id: 'dlsa_dl_new_delhi',
    state: 'IN-DL',
    district: 'New Delhi',
    authorityName: 'New Delhi District Legal Services Authority (NDDLSA)',
    officeAddress: 'Patiala House Courts Complex, India Gate, New Delhi 110001',
    phone: '011-23072352',
    email: 'newdelhi-dlsa@nic.in',
    tollFreeHelpline: '1516', // Delhi DSLSA direct helpline
    secretaryDesignation: 'Chief Metropolitan Magistrate / Judge Secretary',
    portalUrl: 'https://dslsa.org',
    lokAdalatServices: [
      'Electricity and water utility billing disputes',
      'Matrimonial maintenance and conciliation',
      'Labour tribunal matters'
    ],
    lastVerifiedDate: '2026-03-05'
  },
  {
    id: 'dlsa_mh_mumbai_city',
    state: 'IN-MH',
    district: 'Mumbai City',
    authorityName: 'District Legal Services Authority, Mumbai',
    officeAddress: 'Old City Civil and Sessions Court Building, Fort, Mumbai 400032',
    phone: '022-22676015',
    email: 'dlsa-mumbai@gov.in',
    tollFreeHelpline: '15100',
    secretaryDesignation: 'District Judge cadre Secretary',
    portalUrl: 'https://legalservices.maharashtra.gov.in',
    lokAdalatServices: [
      'Bank recovery suits pre-litigation',
      'Consumer forum appeals conciliation'
    ],
    lastVerifiedDate: '2026-02-28'
  }
];
