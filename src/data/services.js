export const MOCK_SERVICES = [
  {
    id: 'birth-certificate',
    name: 'Birth Certificate',
    shortDescription: 'Official record of a person\'s birth, required for various legal and identity purposes.',
    category: 'Certificates',
    department: 'Municipal Administration',
    type: 'Online / Offline',
    difficulty: 'Medium',
    feeType: 'paid',
    speedDays: 14,
    popularityScore: 92,
    eligibilityRuleKey: 'birth-certificate',
    eligibility: ['Parents of the newborn', 'Individuals without a birth certificate'],
    documents: [
      'Proof of birth from hospital (if born in hospital)',
      'Parents\' identity proof (Aadhaar/Voter ID)',
      'Marriage certificate of parents (in some regions)'
    ],
    documentRequirements: {
      'Proof of birth from hospital (if born in hospital)': { type: 'conditional', condition: 'The child was born in a hospital.' },
      'Marriage certificate of parents (in some regions)': { type: 'conditional', condition: 'Your region asks for it. The service record says only some regions do.' }
    },
    steps: [
      { title: 'Register the birth', description: 'Ensure the hospital has registered the birth, or register it locally within 21 days.' },
      { title: 'Gather documents', description: 'Collect hospital discharge summary and parents\' ID proofs.' },
      { title: 'Apply online/offline', description: 'Submit the application via the local municipal portal or visit the registrar office.' }
    ],
    fees: 'Typically ₹20 - ₹100 (varies by state and time elapsed since birth)',
    processingTime: '7 - 30 days',
    officialSources: [
      { name: 'National Government Services Portal', url: 'https://services.india.gov.in', verified: true }
    ],
    warnings: ['Late registration (after 21 days) may require an affidavit and additional fees.', 'Information may vary by state.'],
    lastVerified: '2023-10-01'
  },
  {
    id: 'aadhaar-card',
    jurisdiction: { level: 'national', states: [], districts: [], localBody: '' },
    name: 'Aadhaar Card Enrollment',
    shortDescription: '12-digit unique identity number based on biometric and demographic data.',
    category: 'Identity',
    department: 'UIDAI',
    type: 'Offline (Appointment Online)',
    difficulty: 'Medium',
    feeType: 'free',
    speedDays: 30,
    popularityScore: 99,
    eligibility: ['Any resident of India'],
    documents: [
      'Proof of Identity (POI) (e.g., PAN, Passport, Voter ID)',
      'Proof of Address (POA) (e.g., Passport, Bank Statement, Utility Bill)',
      'Proof of Date of Birth (DOB) (e.g., Birth Certificate, SSLC Certificate)'
    ],
    steps: [
      { title: 'Locate an Enrollment Center', description: 'Find a nearby Aadhaar Seva Kendra or authorized bank/post office.' },
      { title: 'Book an Appointment (Optional)', description: 'Book online to save time.' },
      { title: 'Visit the Center', description: 'Carry original documents. Provide biometrics (fingerprints, iris) and demographic details.' },
      { title: 'Collect Acknowledgment Slip', description: 'Keep the 14-digit EID number safe to track status.' }
    ],
    fees: 'Free for new enrollment',
    processingTime: 'Up to 90 days',
    officialSources: [
      { name: 'UIDAI Official Website', url: 'https://uidai.gov.in', verified: true }
    ],
    warnings: ['Always carry original documents to the center for verification.', 'Do not share your Aadhaar OTP with anyone.'],
    lastVerified: '2023-11-05'
  },
  {
    id: 'driving-license',
    name: 'Driving License',
    shortDescription: 'Official document certifying authorization to drive a motor vehicle.',
    category: 'Transport',
    department: 'Ministry of Road Transport & Highways',
    type: 'Online / Offline',
    difficulty: 'Hard',
    feeType: 'paid',
    speedDays: 35,
    popularityScore: 95,
    eligibility: ['18+ years of age (for regular vehicles)', 'Must hold a valid Learner\'s License for at least 30 days'],
    documents: [
      'Valid Learner\'s License',
      'Address Proof (Aadhaar, Passport, etc.)',
      'Age Proof (Birth Certificate, PAN, etc.)',
      'Passport size photographs'
    ],
    steps: [
      { title: 'Apply for Learner\'s License', description: 'Pass the written traffic rules test.' },
      { title: 'Practice Driving', description: 'Wait at least 30 days.' },
      { title: 'Apply for Permanent License', description: 'Book a driving test slot online.' },
      { title: 'Pass Driving Test', description: 'Take the test at the RTO with your vehicle.' }
    ],
    fees: 'Approx ₹200 - ₹1000 depending on vehicle class',
    processingTime: '30 - 45 days after passing the test',
    officialSources: [
      { name: 'Parivahan Sewa', url: 'https://parivahan.gov.in', verified: true }
    ],
    warnings: ['You must bring a vehicle of the correct class for the driving test.'],
    lastVerified: '2023-09-15'
  },
  {
    id: 'pan-card',
    jurisdiction: { level: 'national', states: [], districts: [], localBody: '' },
    name: 'PAN Card (Permanent Account Number)',
    shortDescription: '10-digit alphanumeric identity issued by the Income Tax Department.',
    category: 'Identity',
    department: 'Income Tax Department (CBDT)',
    type: 'Online',
    difficulty: 'Easy',
    feeType: 'paid',
    speedDays: 15,
    popularityScore: 97,
    eligibility: ['Indian Citizens (Form 49A)', 'Foreign Citizens (Form 49AA)'],
    documents: [
      'Identity Proof (Aadhaar is generally sufficient for e-KYC)',
      'Address Proof',
      'Date of Birth Proof'
    ],
    steps: [
      { title: 'Visit NSDL or UTIITSL', description: 'Go to the official portal.' },
      { title: 'Fill Form 49A', description: 'Provide details and choose physical or e-PAN.' },
      { title: 'Pay Fees', description: 'Pay online via net banking or cards.' },
      { title: 'Aadhaar e-KYC', description: 'Authenticate using Aadhaar OTP (no document upload needed).' }
    ],
    fees: '₹107 for physical card (domestic dispatch)',
    processingTime: '15 - 20 days (e-PAN in a few hours if e-KYC is used)',
    officialSources: [
      { name: 'NSDL PAN Portal', url: 'https://www.onlineservices.nsdl.com/paam/endUserRegisterContact.html', verified: true }
    ],
    warnings: ['Linking PAN with Aadhaar is mandatory.'],
    lastVerified: '2023-12-01'
  },
  {
    id: 'voter-id',
    jurisdiction: { level: 'national', states: [], districts: [], localBody: '' },
    name: 'Voter ID Registration',
    shortDescription: 'EPIC card required to cast a vote in democratic elections.',
    category: 'Identity',
    department: 'Election Commission of India',
    type: 'Online',
    difficulty: 'Easy',
    feeType: 'free',
    speedDays: 30,
    popularityScore: 89,
    eligibility: ['Indian citizen', '18 years of age or older as of January 1st of the year'],
    documents: [
      'Passport size photograph',
      'Age proof (Birth certificate, PAN, Aadhaar)',
      'Address proof (Aadhaar, Utility bill, Passport)'
    ],
    steps: [
      { title: 'Visit NVSP Portal', description: 'Go to the National Voter\'s Service Portal.' },
      { title: 'Fill Form 6', description: 'Fill the form for new registration.' },
      { title: 'Upload Documents', description: 'Attach digital copies of age and address proofs.' },
      { title: 'Submit & Track', description: 'Note the reference ID to track application status.' }
    ],
    fees: 'Free',
    processingTime: '30 - 60 days',
    officialSources: [
      { name: 'Voter\'s Service Portal', url: 'https://voters.eci.gov.in', verified: true }
    ],
    warnings: ['A physical verification by a Booth Level Officer (BLO) may happen before approval.'],
    lastVerified: '2023-08-20'
  },
  {
    id: 'passport',
    jurisdiction: { level: 'national', states: [], districts: [], localBody: '' },
    name: 'New Passport Application',
    shortDescription: 'Travel document issued by the Government for international travel.',
    category: 'Identity',
    department: 'Ministry of External Affairs',
    type: 'Online / Offline',
    difficulty: 'Medium',
    feeType: 'paid',
    speedDays: 25,
    popularityScore: 94,
    eligibility: ['Citizens of India'],
    documents: [
      'Proof of Present Address (e.g., Aadhaar, Utility bill)',
      'Proof of Date of Birth (e.g., Birth Certificate, PAN, School passing certificate)',
      'Documentary proof for Non-ECR categories (if applicable)'
    ],
    steps: [
      { title: 'Register on Passport Seva', description: 'Create an account and fill the application form.' },
      { title: 'Pay & Schedule', description: 'Pay the fee and book an appointment at a Passport Seva Kendra (PSK).' },
      { title: 'Visit PSK', description: 'Arrive on time with original documents.' },
      { title: 'Police Verification', description: 'Wait for police verification at your address.' }
    ],
    fees: '₹1500 (Standard 36 pages) / Additional for Tatkaal',
    processingTime: '30 - 45 days (Standard)',
    officialSources: [
      { name: 'Passport Seva', url: 'https://www.passportindia.gov.in', verified: true }
    ],
    warnings: ['Any discrepancy in documents can cause severe delays. Names must match exactly across all IDs.'],
    lastVerified: '2023-11-10'
  },
  {
    id: 'ration-card',
    name: 'Ration Card Application',
    shortDescription: 'Document issued by state governments for purchasing subsidized food.',
    category: 'Social Welfare',
    department: 'Department of Food & Public Distribution',
    type: 'Online / Offline',
    difficulty: 'Medium',
    feeType: 'paid',
    speedDays: 20,
    popularityScore: 84,
    eligibility: ['Indian citizen', 'Not holding a ration card in any other state'],
    documents: [
      'Identity proof of the head of family',
      'Address proof',
      'Income certificate',
      'Photographs of family members'
    ],
    steps: [
      { title: 'Check State Portal', description: 'Ration cards are state-specific. Find your state\'s food department portal.' },
      { title: 'Fill Application', description: 'Provide details of all family members.' },
      { title: 'Submit Documents', description: 'Attach income proof and Aadhaar details.' },
      { title: 'Verification', description: 'A field verification may be conducted.' }
    ],
    fees: 'Nominal fee (₹5 - ₹50 depending on state)',
    processingTime: '15 - 30 days',
    officialSources: [
      { name: 'NFSA Portal', url: 'https://nfsa.gov.in', verified: true }
    ],
    warnings: ['Eligibility and card type (BPL/APL) depend heavily on the submitted income certificate.'],
    lastVerified: '2023-07-15'
  },
  {
    id: 'income-certificate',
    name: 'Income Certificate',
    shortDescription: 'Official document recording the annual income of an individual or family.',
    category: 'Certificates',
    department: 'Revenue & Disaster Management',
    type: 'Online',
    difficulty: 'Easy',
    feeType: 'paid',
    speedDays: 10,
    popularityScore: 91,
    eligibility: ['Residents of the respective state needing proof for scholarships, schemes, etc.'],
    documents: [
      'Aadhaar Card',
      'Salary slips or IT returns (if employed)',
      'Affidavit of income (if informal sector)'
    ],
    steps: [
      { title: 'Visit e-District Portal', description: 'Go to your state\'s e-District portal.' },
      { title: 'Register/Login', description: 'Create an account.' },
      { title: 'Fill Form & Upload', description: 'Enter family income details and upload proofs.' },
      { title: 'Download Certificate', description: 'Once approved by the Tehsildar, download it digitally.' }
    ],
    fees: '₹15 - ₹30',
    processingTime: '7 - 15 days',
    officialSources: [
      { name: 'State e-District Portals', url: 'https://services.india.gov.in', verified: true }
    ],
    warnings: ['Usually valid for only 6 to 12 months from the date of issue.'],
    lastVerified: '2023-10-25'
  },
  {
    id: 'pf-withdrawal',
    jurisdiction: { level: 'national', states: [], districts: [], localBody: '' },
    name: 'EPF Withdrawal',
    shortDescription: 'Process to withdraw Provident Fund savings online.',
    category: 'Employment',
    department: 'Employees\' Provident Fund Organisation (EPFO)',
    type: 'Online',
    difficulty: 'Medium',
    feeType: 'free',
    speedDays: 5,
    popularityScore: 88,
    eligibility: ['Employees with active UAN', 'Aadhaar linked to UAN', 'Bank details verified in EPF'],
    documents: [
      'UAN and Password',
      'Cancelled cheque (if not already verified)'
    ],
    steps: [
      { title: 'Login to Member Portal', description: 'Access the EPFO Unified Portal.' },
      { title: 'Check KYC', description: 'Ensure Aadhaar, PAN, and Bank details are verified.' },
      { title: 'Go to Online Services', description: 'Select Claim (Form-31, 19, 10C & 10D).' },
      { title: 'Authenticate', description: 'Submit via Aadhaar OTP.' }
    ],
    fees: 'Free',
    processingTime: '3 - 7 working days',
    officialSources: [
      { name: 'EPFO Member Portal', url: 'https://unifiedportal-mem.epfindia.gov.in', verified: true }
    ],
    warnings: ['Withdrawing before 5 years of continuous service may attract TDS.'],
    lastVerified: '2024-01-05'
  },
  {
    id: 'public-grievance',
    name: 'File Public Grievance (CPGRAMS)',
    shortDescription: 'Register complaints regarding central or state government services.',
    category: 'Complaints',
    department: 'Department of Administrative Reforms (DARPG)',
    type: 'Online',
    difficulty: 'Easy',
    feeType: 'free',
    speedDays: 20,
    popularityScore: 78,
    eligibility: ['Any citizen facing issues with government departments'],
    documents: [
      'Supporting documents of the complaint (PDF format)'
    ],
    steps: [
      { title: 'Visit CPGRAMS', description: 'Go to pgportal.gov.in.' },
      { title: 'Register', description: 'Sign up using mobile number/email.' },
      { title: 'Lodge Grievance', description: 'Select the department and describe the issue clearly.' },
      { title: 'Attach Proofs', description: 'Upload relevant files.' },
      { title: 'Track', description: 'Use the registration number to track action taken.' }
    ],
    fees: 'Free',
    processingTime: 'Maximum 30 days (as per guidelines)',
    officialSources: [
      { name: 'CPGRAMS Portal', url: 'https://pgportal.gov.in', verified: true }
    ],
    warnings: ['RTI matters, court cases, and religious matters cannot be filed here.'],
    lastVerified: '2023-12-15'
  },
  {
    id: 'udyam-registration',
    jurisdiction: { level: 'national', states: [], districts: [], localBody: '' },
    name: 'Udyam Registration (MSME)',
    shortDescription: 'Official registration for Micro, Small and Medium Enterprises in India.',
    category: 'Business',
    department: 'Ministry of MSME',
    type: 'Online',
    difficulty: 'Easy',
    feeType: 'free',
    speedDays: 2,
    popularityScore: 82,
    eligibility: ['Any individual intending to establish a micro, small or medium enterprise', 'Must possess a valid Aadhaar number'],
    documents: [
      'Aadhaar Number of proprietor/partner',
      'PAN Card',
      'Bank Account details of the business'
    ],
    steps: [
      { title: 'Visit Udyam Portal', description: 'Go to the official Udyam Registration website.' },
      { title: 'Aadhaar Verification', description: 'Enter Aadhaar and validate via OTP.' },
      { title: 'Fill Enterprise Details', description: 'Provide PAN, plant location, and bank details.' },
      { title: 'Generate Certificate', description: 'Submit the form to instantly generate your Udyam Certificate.' }
    ],
    fees: 'Free (Do not pay any agent)',
    processingTime: 'Instant / 1-2 days',
    officialSources: [
      { name: 'Udyam Registration Portal', url: 'https://udyamregistration.gov.in', verified: true }
    ],
    warnings: ['The process is strictly online and totally free of cost. Beware of fake sites charging money.'],
    lastVerified: '2024-02-10'
  },
  {
    id: 'pm-kisan',
    jurisdiction: { level: 'national', states: [], districts: [], localBody: '' },
    name: 'PM Kisan Samman Nidhi',
    shortDescription: 'Financial benefit scheme providing ₹6,000 per year to eligible farmer families.',
    category: 'Agriculture',
    department: 'Ministry of Agriculture & Farmers Welfare',
    type: 'Online / Offline',
    difficulty: 'Medium',
    feeType: 'free',
    speedDays: 15,
    popularityScore: 87,
    eligibility: ['Small and marginal farmer families holding cultivable land', 'Must not be institutional land holders or high income earners'],
    documents: [
      'Aadhaar Card',
      'Land holding papers (Khatauni)',
      'Savings Bank Account details'
    ],
    steps: [
      { title: 'Visit PM Kisan Portal', description: 'Access pmkisan.gov.in or visit a local CSC.' },
      { title: 'New Farmer Registration', description: 'Select Rural or Urban farmer and enter Aadhaar.' },
      { title: 'Fill Land Details', description: 'Upload land holding records and bank details.' },
      { title: 'e-KYC', description: 'Complete mandatory e-KYC using Aadhaar OTP or biometrics.' }
    ],
    fees: 'Free at portal (CSC may charge nominal fee)',
    processingTime: 'Varies based on state verification',
    officialSources: [
      { name: 'PM Kisan Portal', url: 'https://pmkisan.gov.in', verified: true }
    ],
    warnings: ['Mandatory e-KYC is required to receive installments. Land holding must be registered in the farmer\'s name.'],
    lastVerified: '2024-01-20'
  }
];

export const services = MOCK_SERVICES;
export default services;
