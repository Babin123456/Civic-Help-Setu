export const MOCK_SERVICES = [
  {
    "id": "birth-certificate",
    "jurisdiction": {
      "level": "state",
      "states": [
        "Tamil Nadu"
      ],
      "districts": [],
      "localBody": ""
    },
    "name": "Birth Certificate",
    "shortDescription": "Register a birth in Tamil Nadu with the Registrar for the place where it occurred, then search or download the official certificate through the Tamil Nadu Civil Registration System.",
    "category": "Certificates",
    "department": "Chief Registrar of Births and Deaths, Tamil Nadu / jurisdictional Registrar",
    "type": "Online / Offline",
    "difficulty": "Medium",
    "feeType": "paid",
    "speedDays": 30,
    "popularityScore": 92,
    "eligibility": [
      "This guide applies when the birth occurred in Tamil Nadu. Registration is handled by the Registrar for the place of occurrence, not simply the family's current residential address.",
      "For a birth in a hospital or other institution, the institution is responsible for informing the Registrar under the civil-registration process.",
      "For a home birth, the informant should report the event to the Registrar for the local area within 21 days."
    ],
    "documents": [
      "Hospital or health-centre birth record / institutional acknowledgement (keep available if requested; confirm the current checklist with the Registrar)",
      "Evidence of the date and place of birth requested by the jurisdictional Registrar (requirements depend on the circumstances and are not established as one universal checklist by the linked public sources)",
      "Self-attested supporting document in Form 14 (for delayed reporting after 30 days and within one year, as prescribed by Tamil Nadu Rule 9(2))"
    ],
    "documentRequirements": {
      "Hospital or health-centre birth record / institutional acknowledgement (keep available if requested; confirm the current checklist with the Registrar)": {
        "type": "unverified"
      },
      "Evidence of the date and place of birth requested by the jurisdictional Registrar (requirements depend on the circumstances and are not established as one universal checklist by the linked public sources)": {
        "type": "unverified"
      },
      "Self-attested supporting document in Form 14 (for delayed reporting after 30 days and within one year, as prescribed by Tamil Nadu Rule 9(2))": {
        "type": "conditional",
        "condition": "The birth is reported after 30 days but within one year of its occurrence."
      }
    },
    "steps": [
      {
        "title": "Identify the correct Registrar",
        "description": "Use the place where the birth occurred to identify the local registration unit and Registrar. A birth occurring outside Tamil Nadu must be registered with the authority for that place."
      },
      {
        "title": "Check who reports the birth",
        "description": "For a hospital, health centre, maternity home, nursing home or similar institution, the institution is responsible for informing the Registrar. For a home birth, the citizen/informant should report it to the Registrar for the local area."
      },
      {
        "title": "Report within 21 days",
        "description": "Tamil Nadu Rule 5(3) requires the information to be given within 21 days from the date of birth. Normal registration within this period is free."
      },
      {
        "title": "Use the correct delayed-registration route",
        "description": "After 21 days but within 30 days: Rule 9(1) sets a ₹100 late fee. After 30 days but within one year: Rule 9(2) requires written permission from the officer for the registration-unit type, a ₹200 late fee and a self-attested supporting document in Form 14. After one year, Rule 9(3) prescribes a ₹500 late fee; the competent authority must be read with amended Section 13 of the central Act effective 1 October 2026: for more than one year but within two years, an order from the District Magistrate, Sub-Divisional Magistrate or an Executive Magistrate authorised by the District Magistrate; after two years, an order from a Judicial Magistrate of the First Class. The authority verifies the event."
      },
      {
        "title": "Search or download the certificate",
        "description": "The CRSTN public portal provides search and certificate download for births registered from 1 January 2018. The search page asks for RCH ID or details such as gender, district, place of birth and date of birth, with mobile verification."
      },
      {
        "title": "For older or missing records",
        "description": "For a birth registered before 1 January 2018, contact the relevant local body. If no entry appears, ask the jurisdictional Registrar about a record search or non-availability certificate; do not submit a duplicate registration without checking."
      },
      {
        "title": "Add the child's name or correct an entry",
        "description": "Under Tamil Nadu Rule 10, the parent or guardian can provide the child's name within 12 months from registration without a late fee; after 12 months but within 15 years, the rule prescribes ₹200. For an error in an existing entry, contact the Registrar and follow the Rule 11 / Section 15 correction process."
      }
    ],
    "dateGuidance": [
      {
        "label": "Date of birth",
        "description": "The event date. It starts the normal 21-day reporting period and determines which delayed-registration period applies."
      },
      {
        "label": "Reporting date",
        "description": "The date the birth information is given to the Registrar. Keep any acknowledgement or reference number supplied by the institution or Registrar."
      },
      {
        "label": "Registration date",
        "description": "The date entered in the register. The child's name-addition period under Rule 10 is calculated from this date, not the date of birth."
      },
      {
        "label": "Certificate issue / download date",
        "description": "Keep the downloaded or issued certificate and note when it was obtained. It is distinct from the date of birth and registration date."
      }
    ],
    "validityNote": "The linked official sources do not specify a general expiry date for a birth certificate. A separate authority may ask for a recently issued copy for a particular application; confirm that requirement with the receiving authority.",
    "fees": "Normal registration within 21 days: free. After 21 days but within 30 days: ₹100. After 30 days but within one year: ₹200, with written permission and Form 14. After one year: Tamil Nadu Rule 9(3) prescribes ₹500; the competent authority is split by amended Section 13 (1–2 years: District Magistrate / Sub-Divisional Magistrate / authorised Executive Magistrate; over 2 years: Judicial Magistrate First Class). CRSTN online downloads for births registered from 1 January 2018 are free. Separate searches or certified extracts may have Rule 13 fees; confirm the exact service and amount before paying.",
    "processingTime": "Tamil Nadu Rule 8 describes a 30-day certificate collection/transmission window in specified reporting cases. The reviewed official sources do not state one universal processing guarantee for every route; confirm the current timeline with the jurisdictional Registrar.",
    "officialSources": [
      {
        "name": "Tamil Nadu Directorate of Town Panchayats — Birth and Death Registration",
        "url": "https://townpanchayat.in/birth_death.php",
        "verified": true,
        "lastVerified": "2026-11-05"
      },
      {
        "name": "Tamil Nadu Civil Registration System (CRSTN)",
        "url": "https://www.crstn.org/birth_death_tn/crs",
        "verified": true,
        "lastVerified": "2026-11-05"
      },
      {
        "name": "CRSTN — Birth Certificate Search",
        "url": "https://www.crstn.org/birth_death_tn/BCert",
        "verified": true,
        "lastVerified": "2026-11-05"
      },
      {
        "name": "Tamil Nadu Government Gazette archive — Rules, 2025 (G.O. Ms. No. 351 / SRO A-20(a)/2025)",
        "url": "https://www.stationeryprinting.tn.gov.in/extra_ordinary_lists.php?id=MjAyNQ%3D%3D",
        "verified": true,
        "lastVerified": "2026-11-05"
      },
      {
        "name": "Office of the Registrar General & Census Commissioner — Registration of Births and Deaths (Amendment) Act, 2026",
        "url": "https://censusindia.mha.gov.in/nada/index.php/catalog/47182",
        "verified": true,
        "lastVerified": "2026-11-05"
      }
    ],
    "warnings": [
      "This guide is specific to births that occurred in Tamil Nadu. Use the Registrar for the place of occurrence if the birth happened in another state or Union Territory.",
      "The Tamil Nadu Rules, 2025 supersede the 2000 state rules. For delayed reports after one year, also apply the central Registration of Births and Deaths (Amendment) Act, 2026, in force from 1 October 2026: more than two years now requires a Judicial Magistrate of the First Class order.",
      "Do not assume a universal identity-document checklist. Confirm the current evidence required for the particular birth circumstances with the jurisdictional Registrar.",
      "CRSTN online download is free for births registered from 1 January 2018; separate record searches, certified extracts and non-availability certificates are different services and may carry separate fees."
    ],
    "lastVerified": "2026-11-05"
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
  },
  {
    id: 'ayushman-bharat-card',
    jurisdiction: { level: 'national', states: [], districts: [], localBody: '' },
    name: 'Ayushman Bharat PM-JAY Beneficiary Card',
    shortDescription: 'Download, verify, or correct the Ayushman Bharat PM-JAY beneficiary card (Ayushman Card) for cashless hospitalization up to ₹5 lakh per family per year at empanelled hospitals. Eligibility is based on SECC 2011 deprivation criteria and state-specific categories; not all residents qualify.',
    category: 'Health',
    department: 'National Health Authority (NHA) / State Health Agencies (SHAs)',
    type: 'Online / Offline (CSC / Empanelled Hospital)',
    difficulty: 'Medium',
    feeType: 'free',
    speedDays: 7,
    popularityScore: 93,
    eligibility: [
      'Households identified as eligible under the Socio-Economic Caste Census (SECC) 2011 deprivation criteria (D1–D5, D7) for rural areas, and occupational categories for urban areas.',
      'Additional state-specific eligibility categories may apply (e.g., Antyodaya Anna Yojana families, construction workers, street vendors, ASHA/anganwadi workers, etc.). Eligibility varies by state/UT; check the state health agency portal.',
      'The beneficiary must be a member of an eligible household. Individual enrollment is not open to the general public; the scheme uses pre-identified beneficiary lists.',
      'Aadhaar-linked mobile number is required for OTP-based e-KYC verification at the time of card generation or download.'
    ],
    documents: [
      'Aadhaar card (or Aadhaar number) of the beneficiary for e-KYC verification',
      'Ration card or family ID (state-specific) to establish household membership',
      'Mobile number linked to Aadhaar for OTP verification',
      'Optional: Any government-issued photo ID (Voter ID, PAN, Driving License) for assisted verification at CSC or empanelled hospital if Aadhaar OTP fails'
    ],
    documentRequirements: {
      'Aadhaar card (or Aadhaar number) of the beneficiary for e-KYC verification': { type: 'required' },
      'Ration card or family ID (state-specific) to establish household membership': { type: 'required', condition: 'Required to locate the beneficiary in the SECC/state database; exact document name varies by state' },
      'Mobile number linked to Aadhaar for OTP verification': { type: 'required' },
      'Optional: Any government-issued photo ID (Voter ID, PAN, Driving License) for assisted verification at CSC or empanelled hospital if Aadhaar OTP fails': { type: 'optional' }
    },
    steps: [
      {
        title: 'Check eligibility and locate beneficiary record',
        description: 'Visit the NHA beneficiary portal (https://beneficiary.nha.gov.in) or the state health agency portal. Enter Aadhaar number, ration card number, or mobile number to search the beneficiary database. If the record exists, the system will display the household details and eligible members.'
      },
      {
        title: 'Complete e-KYC verification',
        description: 'For the selected beneficiary, initiate Aadhaar OTP-based e-KYC. An OTP is sent to the Aadhaar-linked mobile number. Enter the OTP to verify identity. If OTP fails, visit a Common Service Centre (CSC) or empanelled hospital for biometric/assisted verification.'
      },
      {
        title: 'Generate or download the Ayushman Card',
        description: 'After successful e-KYC, the Ayushman Card (PDF) is generated. Download it from the SETU portal (https://setu.pmjay.gov.in) or the beneficiary portal. The card displays the beneficiary name, PM-JAY ID, family members, and QR code for hospital verification.'
      },
      {
        title: 'Verify card details and family members',
        description: 'Check that all eligible family members are listed on the card. If a member is missing, they may need separate e-KYC or the household record may need updating at the state level. Do not assume all household members are automatically included.'
      },
      {
        title: 'Use the card at empanelled hospitals',
        description: 'Present the Ayushman Card (printed or digital) and a valid photo ID at any empanelled public or private hospital. The hospital verifies the card via the PM-JAY Transaction Management System (TMS). Search empanelled hospitals at https://hospitals.pmjay.gov.in.'
      },
      {
        title: 'Request correction if details are wrong',
        description: 'For errors in name, gender, date of birth, or family member details, raise a grievance through the PM-JAY grievance portal (https://grievance.pmjay.gov.in) or contact the State Health Agency helpline. Corrections require supporting documents (e.g., Aadhaar for DOB/name, birth certificate for new members). The card is re-issued after approval.'
      }
    ],
    dateGuidance: [
      {
        label: 'Eligibility verification date',
        description: 'The date the beneficiary record was confirmed in the SECC/state database. This is not the same as the card download date. Check the beneficiary portal for the verification status and date.'
      },
      {
        label: 'e-KYC completion date',
        description: 'The date Aadhaar OTP or biometric verification was successfully completed. The card cannot be generated before this step. Keep the e-KYC acknowledgement/reference number.'
      },
      {
        label: 'Card generation date',
        description: 'The date the Ayushman Card PDF was generated and made available for download. This is the effective date for the current card version.'
      },
      {
        label: 'Card download date',
        description: 'The date you downloaded or printed the card. Keep a record; some hospitals may ask when the card was last downloaded.'
      },
      {
        label: 'Correction request date',
        description: 'The date a correction grievance was submitted. Track status via the grievance portal. The revised card will have a new generation date.'
      },
      {
        label: 'Scheme year / validity window',
        description: 'PM-JAY benefits reset annually (typically April–March). The card remains valid for the scheme year, but hospitals verify eligibility in real-time via TMS. The linked official sources do not specify a fixed card expiry date; confirm with the State Health Agency.'
      }
    ],
    validityNote: 'The Ayushman Card does not have a fixed expiry date printed on it. Eligibility is verified in real-time at the hospital via the PM-JAY TMS. Benefits are available for the ongoing scheme year (typically April–March). If household eligibility changes (e.g., member added/removed), a new card must be generated. The linked official sources do not specify a general card expiry; confirm current validity rules with the State Health Agency.',
    fees: 'Free on all official portals (beneficiary.nha.gov.in, setu.pmjay.gov.in). Common Service Centres (CSCs) may charge a nominal facilitation fee (typically ₹10–₹30) for assisted download/print; this is not a government fee. Do not pay agents for card generation.',
    processingTime: 'e-KYC and card generation are near-instant (minutes) if Aadhaar OTP works. Assisted verification at CSC/hospital may take 15–30 minutes. Correction requests via grievance portal: the linked official sources do not specify a statutory timeline; typical resolution is 7–30 days depending on the State Health Agency.',
    officialSources: [
      {
        name: 'National Health Authority — PM-JAY Official Website',
        url: 'https://pmjay.gov.in',
        verified: true,
        lastVerified: '2026-11-05'
      },
      {
        name: 'NHA Beneficiary Identification & Verification Portal',
        url: 'https://beneficiary.nha.gov.in',
        verified: true,
        lastVerified: '2026-11-05'
      },
      {
        name: 'SETU Portal — Ayushman Card Download',
        url: 'https://setu.pmjay.gov.in',
        verified: true,
        lastVerified: '2026-11-05'
      },
      {
        name: 'Empanelled Hospital Search',
        url: 'https://hospitals.pmjay.gov.in',
        verified: true,
        lastVerified: '2026-11-05'
      },
      {
        name: 'PM-JAY Grievance Redressal Portal',
        url: 'https://grievance.pmjay.gov.in',
        verified: true,
        lastVerified: '2026-11-05'
      }
    ],
    warnings: [
      'Eligibility is NOT universal. Only pre-identified SECC 2011 households and state-specific categories qualify. You cannot "apply" as an individual; you can only verify if your household is already in the database.',
      'State implementation varies. Some states/UTs (e.g., West Bengal, Odisha, Delhi, Telangana) have separate or merged health schemes with different eligibility and portals. Always check the State Health Agency portal for your state.',
      'The Ayushman Card (PM-JAY card) is different from state-specific health cards (e.g., Tamil Nadu CMCHIS, Karnataka Ayushman Arogya Karnataka, Maharashtra MJPJAY). They are not interchangeable.',
      'e-KYC requires an Aadhaar-linked mobile number. If the mobile number is not linked or has changed, visit a CSC or empanelled hospital for biometric verification.',
      'Card download is free on official portals. Do not pay third-party agents or unofficial websites.',
      'The card alone does not guarantee treatment; the hospital must verify eligibility in the TMS at the time of admission. Pre-authorization may be required for certain packages.',
      'Family members not listed on the card must complete their own e-KYC. Adding members after initial card generation requires a correction request.',
      'Correction of name, DOB, or gender requires supporting documents (Aadhaar, birth certificate). The linked official sources do not specify a standard correction timeline; escalate to the State Health Agency helpline if delayed.',
      'Keep identifiers (PM-JAY ID, Aadhaar, ration card) private. Do not share them on public links, social media, or analytics.'
    ],
    contacts: [
      { label: 'NHA Helpline (National)', phone: '14555', url: 'https://pmjay.gov.in' },
      { label: 'PM-JAY Grievance Portal', url: 'https://grievance.pmjay.gov.in' },
      { label: 'State Health Agency Contacts', url: 'https://pmjay.gov.in/state-health-agencies' }
    ],
    lastVerified: '2026-11-05'
  }
];

export const services = MOCK_SERVICES;
export default services;
