/**
 * @file scholarshipDirectoryData.js
 * @description Source-grounded database of central, state, and category-specific government scholarships in India.
 * Includes administering body, eligibility requirements, benefit amounts, required documents, portal URLs, and verification dates.
 */

export const SCHOLARSHIP_DIRECTORY = [
  {
    id: 'sch_post_matric_sc_st',
    name: 'Post-Matric Scholarship for SC/ST Students',
    category: 'CATEGORY_SPECIFIC',
    administeringBody: 'Ministry of Social Justice and Empowerment / State Social Welfare Departments',
    level: 'POST_MATRIC',
    eligibleCourses: ['Class 11', 'Class 12', 'Diploma', 'Undergraduate', 'Postgraduate', 'Doctoral'],
    jurisdiction: 'ALL_INDIA',
    incomeCeilingAnnualINR: 250000,
    academicRequirement: 'Passed secondary school or previous academic year without backlogs.',
    targetDemographics: ['SC', 'ST'],
    benefits: {
      maintenanceAllowancePerMonthINR: 1200,
      reimbursementOfCompulsoryNonRefundableFees: true,
      studyTourAllowance: 1600,
      thesisTypingAllowance: 1600
    },
    requiredDocuments: [
      'Caste Certificate issued by competent revenue authority',
      'Income Certificate (valid for current financial year)',
      'Previous year academic mark sheet',
      'Admission fee receipt of current recognized institution',
      'Aadhaar-seeded bank account passbook copy'
    ],
    applicationPortal: {
      name: 'National Scholarship Portal (NSP)',
      url: 'https://scholarships.gov.in',
      applicationCycle: 'July to November annually',
      renewalCycle: 'Annual verification by institute Nodal Officer'
    },
    verificationDate: '2026-03-01',
    guidelineSourceUrl: 'https://socialjustice.gov.in/schemes/post-matric-sc',
    disclaimer: 'Administering authority makes the final decision on sanction and disbursal.'
  },
  {
    id: 'sch_karnataka_ssp_post_matric',
    name: 'Karnataka State Scholarship Portal (SSP) Post-Matric Scheme',
    category: 'STATE_SPECIFIC',
    administeringBody: 'Department of Social Welfare / Backward Classes Welfare, Govt. of Karnataka',
    level: 'POST_MATRIC',
    eligibleCourses: ['PUC', 'Diploma', 'ITI', 'Engineering', 'Medical', 'Arts and Science UG/PG'],
    jurisdiction: 'IN-KA',
    incomeCeilingAnnualINR: 250000,
    academicRequirement: 'Admitted through regular/merit quota in recognized colleges in Karnataka.',
    targetDemographics: ['SC', 'ST', 'OBC_CAT_1', 'OBC_2A', 'OBC_2B', 'OBC_3A', 'OBC_3B'],
    benefits: {
      maintenanceAllowancePerMonthINR: 1000,
      tuitionFeeConcession: true,
      hostelFeeWaiver: true
    },
    requiredDocuments: [
      'SSP Student Account ID with Aadhaar e-KYC',
      'RD number for Caste and Income Certificate',
      'Hostel admission acknowledgment (if applicable)',
      'College registration / e-Attestation number',
      'Bank account seeded with NPCI Aadhaar mapper'
    ],
    applicationPortal: {
      name: 'State Scholarship Portal (SSP Karnataka)',
      url: 'https://ssp.postmatric.karnataka.gov.in',
      applicationCycle: 'August to December annually',
      renewalCycle: 'e-Attestation update before academic year commencement'
    },
    verificationDate: '2026-03-05',
    guidelineSourceUrl: 'https://ssp.karnataka.gov.in/docs/guidelines.pdf',
    disclaimer: 'Sanction subject to e-Attestation clearance by Taluk Social Welfare Officer.'
  },
  {
    id: 'sch_merit_cum_means_minorities',
    name: 'Merit-cum-Means Scholarship for Professional and Technical Courses CS',
    category: 'MINORITY_WELFARE',
    administeringBody: 'Ministry of Minority Affairs, Govt. of India',
    level: 'HIGHER_EDUCATION',
    eligibleCourses: ['B.Tech', 'MBBS', 'B.Arch', 'MBA', 'MCA', 'LLB'],
    jurisdiction: 'ALL_INDIA',
    incomeCeilingAnnualINR: 250000,
    academicRequirement: 'Minimum 50% marks in previous final examination.',
    targetDemographics: ['MUSLIM', 'CHRISTIAN', 'SIKH', 'BUDDHIST', 'JAIN', 'PARSI'],
    benefits: {
      courseFeeAllowanceAnnualINR: 20000,
      maintenanceAllowanceHostellerINR: 1000,
      maintenanceAllowanceDayScholarINR: 500
    },
    requiredDocuments: [
      'Minority community self-declaration certificate',
      'Family income certificate from Tehsildar or SDM',
      'Self-attested mark sheet of qualifying examination',
      'Fee receipt of current academic course',
      'Bank account details mapped with Aadhaar'
    ],
    applicationPortal: {
      name: 'National Scholarship Portal (NSP)',
      url: 'https://scholarships.gov.in',
      applicationCycle: 'August to November annually',
      renewalCycle: 'Requires 50% marks in previous semester'
    },
    verificationDate: '2026-02-28',
    guidelineSourceUrl: 'https://minorityaffairs.gov.in/schemes/merit-cum-means',
    disclaimer: 'Administering body reserves the right to quota limits per State/UT.'
  },
  {
    id: 'sch_inspire_dst',
    name: 'INSPIRE Scholarship for Higher Education (SHE)',
    category: 'MERIT_CENTRAL',
    administeringBody: 'Department of Science and Technology (DST), Govt. of India',
    level: 'UNDERGRADUATE_POSTGRADUATE',
    eligibleCourses: ['B.Sc', 'B.S.', 'Int. M.Sc', 'Int. M.S.'],
    jurisdiction: 'ALL_INDIA',
    incomeCeilingAnnualINR: null, // No family income ceiling, purely merit-based in natural & basic sciences
    academicRequirement: 'Top 1% in Class 12 board examination or rank in JEE/NEET opting for basic sciences.',
    targetDemographics: ['GENERAL', 'SC', 'ST', 'OBC', 'EWS'],
    benefits: {
      scholarshipPerAnnumINR: 60000,
      mentorshipGrantSummerResearchINR: 20000
    },
    requiredDocuments: [
      'Class 12 board marksheet and advisory note',
      'Endorsement form signed by Head of Institution',
      'SBI savings bank account passbook copy',
      'Proof of enrollment in recognized basic science program'
    ],
    applicationPortal: {
      name: 'INSPIRE Online Portal',
      url: 'https://online-inspire.gov.in',
      applicationCycle: 'September to November annually',
      renewalCycle: 'Minimum 60% or 7.0 CGPA in yearly university exams'
    },
    verificationDate: '2026-03-10',
    guidelineSourceUrl: 'https://online-inspire.gov.in/Announcement',
    disclaimer: 'Only valid for natural and basic science disciplines; professional engineering/medicine excluded.'
  }
];
