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
    shortDescription: '12-digit unique identity number based on biometric and demographic data issued by UIDAI. Enrolment is free; demographic updates (address online, name/DoB at centre) carry capped fees.',
    category: 'Identity',
    department: 'Unique Identification Authority of India (UIDAI)',
    type: 'Offline (ASK / Centre) / Online (myAadhaar for Address)',
    difficulty: 'Medium',
    feeType: 'free',
    speedDays: 30,
    popularityScore: 99,
    eligibility: [
      'Any resident individual who has resided in India for 182 days or more in the 12 months immediately preceding application.',
      'Newborns and children of all ages (Baal Aadhaar for children under 5 years, with facial photo linked to parent).',
      'Non-Resident Indians (NRIs) holding a valid Indian passport on arrival.'
    ],
    documents: [
      'Proof of Identity (POI) (Original Passport, PAN Card, Voter ID, Driving Licence, or Govt Photo ID)',
      'Proof of Address (POA) (Original Passport, Bank Passbook with photo, Voter ID, Utility Bill not older than 3 months, or Registered Rent Agreement)',
      'Proof of Date of Birth (DOB) (Birth Certificate issued by Registrar/Local Body; SSLC/Matriculation Certificate; or Passport)',
      'Proof of Relationship (POR) (Birth Certificate, Ration Card, or Marriage Certificate — required for children <5 years or Head of Family address update)',
      'Optional: Active Personal Mobile Number and Email Address (voluntary at enrolment, but essential for OTP and myAadhaar tracking)'
    ],
    documentRequirements: {
      'Proof of Identity (POI) (Original Passport, PAN Card, Voter ID, Driving Licence, or Govt Photo ID)': {
        type: 'official'
      },
      'Proof of Address (POA) (Original Passport, Bank Passbook with photo, Voter ID, Utility Bill not older than 3 months, or Registered Rent Agreement)': {
        type: 'official'
      },
      'Proof of Date of Birth (DOB) (Birth Certificate issued by Registrar/Local Body; SSLC/Matriculation Certificate; or Passport)': {
        type: 'official'
      },
      'Proof of Relationship (POR) (Birth Certificate, Ration Card, or Marriage Certificate — required for children <5 years or Head of Family address update)': {
        type: 'conditional',
        condition: 'Mandatory when enrolling minors under 5 years or applying for Head of Family (HoF) based address update.'
      },
      'Optional: Active Personal Mobile Number and Email Address (voluntary at enrolment, but essential for OTP and myAadhaar tracking)': {
        type: 'optional'
      }
    },
    steps: [
      {
        title: 'Determine service path and assemble original proofs',
        description: 'Decide whether you need New Enrolment (first-time, free) or Demographic Update (existing Aadhaar holder, ₹50 at ASK or free online document upload). Gather unexpired original documents (photocopies without originals are not accepted).'
      },
      {
        title: 'Locate an authorised centre or open myAadhaar',
        description: 'For address-only updates, use the myAadhaar portal (https://myaadhaar.uidai.gov.in) with mobile OTP. For new enrolment, photo, mobile, or DoB updates, locate an authorised Aadhaar Seva Kendra, Bank, or Post Office centre at https://appointments.uidai.gov.in.'
      },
      {
        title: 'Book an appointment online (optional but recommended)',
        description: 'Book an advance slot on appointments.uidai.gov.in to save time, or obtain a walk-in token directly at an Aadhaar Seva Kendra.'
      },
      {
        title: 'Visit the centre for data capture and screen review',
        description: 'Present original documents for colour scanning. Certified operator captures biometrics (10 fingerprints, 2 iris scans, photo). Scrutinize the resident-facing monitor carefully before signing off.'
      },
      {
        title: 'Collect and verify Enrolment Acknowledgement Slip',
        description: 'Verify your name spelling, mobile number, and address on the printed slip. Note your 28-digit Enrolment ID (EID) or 14-digit Update Request Number (URN).'
      },
      {
        title: 'Track CIDR validation status',
        description: 'Track the application on https://myaadhaar.uidai.gov.in/CheckAadhaarStatus using your 28-digit EID. CIDR executes automated de-duplication and document verification.'
      },
      {
        title: 'Download digital e-Aadhaar and receive physical card',
        description: 'Once generated, download digitally signed e-Aadhaar immediately for free (PDF password: first 4 letters of name in CAPITAL + 4-digit Year of Birth). Physical Aadhaar letter is delivered via India Post Speed Post.'
      }
    ],
    fees: 'Free for new enrolment and minor Mandatory Biometric Updates (ages 5-7, 15-17); ₹50 (inclusive of GST) for demographic updates at centres; ₹100 for biometric updates; ₹50 for official PVC card.',
    processingTime: 'Up to 30 to 90 days under UIDAI Citizens\' Charter (e-Aadhaar often available in 5–15 days).',
    dateGuidance: [
      { label: 'Application Date', description: 'Date the resident submits the online form or visits an authorised enrolment centre.' },
      { label: 'Appointment Date', description: 'Reserved date and time slot at the Aadhaar Seva Kendra.' },
      { label: 'Enrolment Date', description: 'Timestamp when operator captures biometrics and demographic particulars at the counter.' },
      { label: 'Verification Date', description: 'Date UIDAI CIDR backend scrutinizes submitted supporting documents.' },
      { label: 'Acknowledgement Date', description: 'Date printed on the official Acknowledgement Slip containing the 28-digit EID or 14-digit URN.' },
      { label: 'Issue Date', description: 'Date the 12-digit Aadhaar number is generated or demographic update is committed.' },
      { label: 'Dispatch Date', description: 'Date India Post Speed Post tracking number is assigned to the physical letter.' },
      { label: 'Delivery Date', description: 'Date India Post delivers the printed Aadhaar packet to the citizen\'s residential address.' },
      { label: 'Validity Expiry Date', description: 'Adult Aadhaar has lifelong validity. Baal Aadhaar (under 5 years) expires at age 5 and requires mandatory biometric update.' },
      { label: 'Statutory Turnaround', description: 'Standard timeframe under UIDAI Citizens\' Charter: up to 30 to 90 days from data capture.' }
    ],
    validityNote: 'Aadhaar has lifelong validity for adult residents. For children under 5 (Baal Aadhaar), validity requires mandatory biometric update between ages 5-7 and ages 15-17.',
    officialSources: [
      { name: 'UIDAI Official Website', url: 'https://uidai.gov.in', verified: true },
      { name: 'myAadhaar Citizen Portal', url: 'https://myaadhaar.uidai.gov.in', verified: true },
      { name: 'UIDAI Appointment Booking Portal', url: 'https://appointments.uidai.gov.in', verified: true },
      { name: 'UIDAI Grievance Redressal Portal', url: 'https://myaadhaar.uidai.gov.in/file-complaint', verified: true }
    ],
    warnings: [
      'An Enrolment Acknowledgement Slip is strictly a submission record and does NOT constitute an Aadhaar card or proof of identity or Indian citizenship (Section 9 of Aadhaar Act).',
      'Always scrutinize the operator’s preview monitor before leaving the counter to catch spelling errors immediately.',
      'UIDAI strictly caps official fees at ₹0 for enrolment, ₹50 for demographic updates, and ₹100 for biometrics. If any centre overcharges, demand a computer receipt and escalate to 1947 or helpdesk@uidai.gov.in.',
      'Never laminate or purchase unauthorized plastic smart cards from local cyber cafes. Order the official ₹50 PVC card exclusively on myAadhaar.'
    ],
    lineageRecordId: 'aadhaar-card',
    lastVerified: '2026-11-12'
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
  },
  {
    id: 'business-licence-checklist',
    name: 'Small-Business Licence Renewal & Closure Checklist Centre',
    title: 'Small-Business Licence Renewal & Closure Checklist Centre',
    shortDescription: 'Lifecycle compliance tracker for small enterprises across municipal trade licences, Shops & Establishments registrations, FSSAI, SPCB consents, and statutory surrender acknowledgement archiving (#721).',
    description: 'Lifecycle compliance tracker for small enterprises across municipal trade licences, Shops & Establishments registrations, FSSAI, SPCB consents, and statutory surrender acknowledgement archiving (#721).',
    department: 'Urban Local Bodies (Municipal Corporations) & Directorate of Commercial Licencing',
    category: 'Business',
    type: 'Online / Offline',
    difficulty: 'Medium',
    feeType: 'paid',
    speedDays: 30,
    popularityScore: 94,
    eligibility: [
      'Micro, Small and Medium Enterprises (MSMEs)',
      'Retail shops, commercial establishments, eateries, and service firms',
      'Proprietors, partners, or corporate entities holding active or expiring commercial registrations'
    ],
    documents: [
      'Existing Trade Licence / Municipal Enlistment Certificate',
      'Shops and Establishments Registration Certificate',
      'Commercial Lease Agreement & Landlord NOC (for premises relocation)',
      'Electricity / Utility Commercial Meter Zero Dues Bill',
      'Municipal Property Tax Paid Receipts',
      'Deed of Dissolution / Partnership Transfer Deed (for constitution amendment)',
      'Stamped Surrender Acknowledgement Order (for formal closure & deregistration)'
    ],
    steps: [
      { title: 'Select Establishment & Jurisdiction', description: 'Configure branch details, municipal corporation (e.g. MCD, BMC, BBMP), and business category.' },
      { title: 'Track Dual-Track Licences', description: 'Monitor municipal trade licences and sector-specific registrations (FSSAI, SPCB, Labour) independently.' },
      { title: 'Monitor Expiry Reminders', description: 'Set 60/30/15-day renewal alert windows and download standard calendar reminders (.ics).' },
      { title: 'Execute Amendments with Evidence', description: 'Follow structured admissible evidence checklists for address shifts or partner constitution changes.' },
      { title: 'Execute Closure & Archive Acknowledgements', description: 'Clear municipal and utility final dues, submit surrender applications, and permanently archive the dated surrender acknowledgement receipt.' }
    ],
    validityNote: 'Trade licences operate strictly on the financial year basis (expiring 31 March) across most Indian urban local bodies. FSSAI food business licences operate on 1 to 5 year validity. Shops & Establishments registrations may be perpetual or require periodic intimation depending on state rules.',
    fees: 'Assessed dynamically by local municipal corporations based on covered carpet area, street category, and electric motor horsepower. Sector-specific fees vary by turnover and hazard class. Do not pay unofficial facilitation agents.',
    processingTime: '7 to 30 working days depending on jurisdiction citizen charters. Instant provisional certificates available under Ease of Doing Business self-certification in select municipalities.',
    officialSources: [
      {
        name: 'Municipal Corporation of Delhi (MCD) Online Portal',
        url: 'https://mcdonline.nic.in',
        verified: true,
        lastVerified: '2026-11-05'
      },
      {
        name: 'Brihanmumbai Municipal Corporation (BMC) Citizen Portal',
        url: 'https://portal.mcgm.gov.in',
        verified: true,
        lastVerified: '2026-11-05'
      },
      {
        name: 'Bruhat Bengaluru Mahanagara Palike (BBMP) Portal',
        url: 'https://bbmptax.karnataka.gov.in',
        verified: true,
        lastVerified: '2026-11-05'
      },
      {
        name: 'Greater Chennai Corporation (GCC) Portal',
        url: 'https://chennaicorporation.gov.in',
        verified: true,
        lastVerified: '2026-11-05'
      },
      {
        name: 'Food Safety and Standards Authority of India (FoSCoS)',
        url: 'https://foscos.fssai.gov.in',
        verified: true,
        lastVerified: '2026-11-05'
      },
      {
        name: 'GST Portal (CBIC)',
        url: 'https://www.gst.gov.in',
        verified: true,
        lastVerified: '2026-11-05'
      }
    ],
    warnings: [
      'A Municipal Trade Licence DOES NOT confer title or ownership of property, nor does it regularize unauthorized construction.',
      'Always secure a formal, stamped or digitally signed Surrender Acknowledgement Receipt when closing down a business to defend against trailing tax demands.',
      'Shifting premises without filing an address amendment is treated as operating without an authorized licence.',
      'Keep personal identifiers (GSTIN, PAN, Aadhaar) confidential. Never expose them in public links or shared dossiers.'
    ],
    contacts: [
      { label: 'MCD Citizen Helpline', phone: '155305', url: 'https://mcdonline.nic.in' },
      { label: 'BMC Central Control Room', phone: '1916', url: 'https://portal.mcgm.gov.in' },
      { label: 'FSSAI National Toll-Free Helpline', phone: '1800112100', url: 'https://foscos.fssai.gov.in' }
    ],
    lastVerified: '2026-11-05'
  },
  {
    id: 'fire-noc',
    jurisdiction: {
      level: 'state',
      states: ['Delhi', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Telangana'],
      districts: [],
      localBody: ''
    },
    name: 'Fire Safety Certificate / Fire NOC',
    shortDescription: 'Procedural preparation and compliance guide for building owners and businesses to secure Provisional Fire NOC, Final Fire Safety Certificate, and periodic renewals pursuant to NBC 2016 Part 4.',
    category: 'Business',
    department: 'State Directorate of Fire & Emergency Services / Municipal Fire Prevention Wing',
    type: 'Online / Offline',
    difficulty: 'Medium',
    feeType: 'paid',
    speedDays: 30,
    popularityScore: 88,
    eligibility: [
      'Applies to commercial, industrial, institutional (hospitals/schools), assembly halls, and high-rise buildings exceeding 15 meters in height.',
      'Provisional NOC is required at building plan sanction stage prior to commencing construction.',
      'Final Fire Safety Certificate is required prior to applying for Occupancy Certificate.',
      'Annual/periodic renewal is mandatory for active commercial and assembly premises.'
    ],
    documents: [
      'Site plan showing minimum 6-meter unobstructed peripheral fire tender access driveway',
      'Floor layouts displaying fire exits, staircase widths, and travel distance to safety',
      'Fire protection scheme drawings detailing risers, hydrants, pumps, and sprinkler grids',
      'Underground and overhead fire water storage static tank capacity certificate',
      'Commissioning test report of dual main electric and standby diesel fire pumps',
      'CBRI / NABL accredited laboratory test certificate for 1 to 2 hour fire-resistant doors'
    ],
    documentRequirements: {
      'Site plan showing minimum 6-meter unobstructed peripheral fire tender access driveway': {
        type: 'mandatory'
      },
      'Floor layouts displaying fire exits, staircase widths, and travel distance to safety': {
        type: 'mandatory'
      },
      'Fire protection scheme drawings detailing risers, hydrants, pumps, and sprinkler grids': {
        type: 'mandatory'
      },
      'Underground and overhead fire water storage static tank capacity certificate': {
        type: 'mandatory'
      },
      'Commissioning test report of dual main electric and standby diesel fire pumps': {
        type: 'mandatory'
      },
      'CBRI / NABL accredited laboratory test certificate for 1 to 2 hour fire-resistant doors': {
        type: 'conditional',
        condition: 'Mandatory for high-rise buildings over 15 meters, institutional hospitals, and assembly halls.'
      }
    },
    steps: [
      {
        title: 'Determine NBC 2016 Occupancy Group & Height Threshold',
        description: 'Check whether your building use (Group A to J) and height (e.g. >= 15m) trigger mandatory Fire NOC under local fire force rules.'
      },
      {
        title: 'Apply for Provisional Fire NOC',
        description: 'Submit architectural drawings, fire exit schemes, and land title documents on the single-window building sanction portal.'
      },
      {
        title: 'Install Active & Passive Fire Safety Equipment',
        description: 'Execute works via a Directorate-licensed fire safety agency: pumps, wet risers, sprinklers, alarms, and fire-resistant doors.'
      },
      {
        title: 'Undergo Physical Spot Inspection',
        description: 'Chief Fire Officer / Station Officer conducts physical hydrostatic, flow, and alarm tests on site.'
      },
      {
        title: 'Cure Shortfall Memoranda & Receive Final Fire Certificate',
        description: 'Remediate any inspection deficiencies within 15 days to secure the final Fire Safety Certificate required for occupancy.'
      }
    ],
    fees: 'Varies by state, building category and built-up area. Check the fee schedule on your state fire service portal.',
    processingTime: 'Around 30 days, varies by state and occupancy',
    officialSources: [
      { name: 'Delhi Fire Service', url: 'https://dfs.delhigovt.nic.in' },
      { name: 'Maharashtra Fire Services', url: 'https://mahafireservice.gov.in' },
      { name: 'Karnataka State Fire Services', url: 'https://ksfes.karnataka.gov.in' }
    ],
    warnings: [
      'Procedural guidance only. This guide does NOT replace certified fire safety auditors or fire-protection engineering calculations.',
      'Operating commercial premises or assembly halls without a valid Fire Safety Certificate is punishable with closure notices and penal action under State Fire Acts.'
    ],
    contacts: [
      { label: 'Delhi Fire Service', url: 'https://dfs.delhigovt.nic.in' },
      { label: 'Maharashtra Fire Services', url: 'https://mahafireservice.gov.in' },
      { label: 'Karnataka State Fire Services', url: 'https://ksfes.karnataka.gov.in' }
    ],
    lastVerified: '2026-03-01'
  },
  {
    id: 'tree-pruning-permission',
    jurisdiction: { level: 'state', states: ['Delhi', 'Karnataka', 'Maharashtra', 'Tamil Nadu', 'Telangana'], districts: [], localBody: '' },
    name: 'Tree-Pruning Permission and Urban Tree Protection',
    shortDescription: 'Official statutory permissions to prune, transplant, or remove trees under state preservation of trees acts, plus 24/7 emergency response for hazardous fallen trees and confidential illegal felling reporting.',
    category: 'Complaints',
    department: 'State Forest Departments & Municipal Tree Authorities',
    type: 'Online (e-Forest / Single Window) / In-person Inspection',
    difficulty: 'Medium',
    feeType: 'paid',
    speedDays: 21,
    popularityScore: 88,
    eligibility: [
      'Lawful property owners, registered housing societies (RWAs), or institutional property managers with trees situated within their recorded premises.',
      'Citizens reporting immediate public safety hazards (storm-damaged, leaning, or hollow trees threatening life, buildings, or electric powerlines).',
      'Whistleblowers reporting suspected unauthorized tree cutting or girdling to Forest Vigilance.'
    ],
    documents: [
      'Proof of Land Ownership / Custody (Registered Sale Deed, Property Tax Extract, or Khata / Mutation Certificate)',
      'No-Objection Certificate (NOC) from RWA or Society Managing Committee (for common residential premises)',
      'Contextual Wide-Angle & Close-Up Photographs of the Tree (showing defect, trunk girth, and proximity to buildings/wires)',
      'Dimensioned Site Sketch showing plot boundaries, structure distance, and exact tree location',
      'Signed Legal Undertaking for Compensatory Afforestation (minimum 1:10 native saplings ratio or security deposit)',
      'Optional: Certified Arborist Health Report or Structural Engineer Danger Certification'
    ],
    documentRequirements: {
      'Proof of Land Ownership / Custody (Registered Sale Deed, Property Tax Extract, or Khata / Mutation Certificate)': {
        type: 'official'
      },
      'No-Objection Certificate (NOC) from RWA or Society Managing Committee (for common residential premises)': {
        type: 'conditional',
        condition: 'Mandatory if the tree is located within a cooperative housing society, apartment complex, or shared boundary.'
      },
      'Contextual Wide-Angle & Close-Up Photographs of the Tree (showing defect, trunk girth, and proximity to buildings/wires)': {
        type: 'official'
      },
      'Dimensioned Site Sketch showing plot boundaries, structure distance, and exact tree location': {
        type: 'official'
      },
      'Signed Legal Undertaking for Compensatory Afforestation (minimum 1:10 native saplings ratio or security deposit)': {
        type: 'official'
      },
      'Optional: Certified Arborist Health Report or Structural Engineer Danger Certification': {
        type: 'optional'
      }
    },
    steps: [
      {
        title: 'Determine Operation Classification & Girth Threshold',
        description: 'Verify whether your tree work is minor branch trimming (< 10-15 cm girth, often exempt or requiring intimation) vs lopping, heavy branch removal, transplantation, or felling.'
      },
      {
        title: 'Assemble Geo-Tagged Evidence & Ownership Proof',
        description: 'Take high-resolution photos of trunk defects, rot cavities, or powerline clearances, and prepare your property title extract and compensatory planting undertaking.'
      },
      {
        title: 'Submit Application to Designated Tree Officer',
        description: 'File application through the municipal or state forest single-window portal (e.g. Delhi e-Forest, BBMP Forest Cell, BMC Tree Authority, TS-bPASS).'
      },
      {
        title: 'Site Inspection & Mandatory Public Objection Notice Window',
        description: 'Accommodate site visit by the Tree Officer / Range Forest Officer. Non-emergency felling undergoes statutory 15 to 30 day public objection disclosures.'
      },
      {
        title: 'Receipt of Tree Officer Sanction & Compensatory Compliance',
        description: 'Execute approved work strictly conforming to permit conditions and plant/nurture required replacement saplings.'
      }
    ],
    fees: 'Varies by state and by the work approved (pruning, lopping, transplanting or felling). Check the notice of your state Tree Officer.',
    processingTime: 'Around 21 days, varies by state',
    officialSources: [
      {
        name: 'Delhi e-Forest Online Citizen Services Portal',
        url: 'https://forest.delhigovt.nic.in/tree-felling-permission',
        verified: true,
        lastVerified: '2026-10-15'
      },
      {
        name: 'BBMP Forest Cell Citizen Single Window',
        url: 'https://bbmp.gov.in/forest.html',
        verified: true,
        lastVerified: '2026-10-18'
      },
      {
        name: 'BMC Garden & Tree Authority Services',
        url: 'https://www.mcgm.gov.in/irj/portal/anonymous/qlgarden',
        verified: true,
        lastVerified: '2026-10-20'
      }
    ],
    warnings: [
      'Pruning branches beyond prescribed girth thresholds without prior written Tree Officer sanction is a cognizable criminal offense punishable by imprisonment up to 1 year and heavy fines under State Preservation of Trees Acts.',
      'Emergency dangerous or storm-damaged trees should be reported immediately to the 24/7 Municipal Disaster Control Room (112 / city helpline); do NOT attempt self-felling without municipal assistance.',
      'Heritage trees (>50 years of age in Maharashtra and other states) receive elevated statutory protection and require state-level Tree Authority clearances.',
      'Special protected and royal timber species (Sandalwood, Teak, Red Sanders, Rosewood, Banyan) have heightened felling restrictions regardless of whether they grow on private patta land.'
    ],
    contacts: [
      { label: 'Delhi Forest Dept Control Room', phone: '1800-11-8600', url: 'https://forest.delhigovt.nic.in' },
      { label: 'BBMP 24x7 Control Room (Bengaluru)', phone: '080-22660000', url: 'https://bbmp.gov.in' },
      { label: 'BMC Disaster Management Helpline (Mumbai)', phone: '1916', url: 'https://www.mcgm.gov.in' },
      { label: 'National Forest Vigilance Helpline', phone: '1926', url: 'https://forests.telangana.gov.in' }
    ],
    lineageRecordId: 'tree-pruning-permission',
    lastVerified: '2026-10-25'
  },
  {
    id: 'counter-demand-forecasting',
    name: 'Civic Service Counter Demand & Queue Staffing Forecast',
    category: 'Complaints',
    type: 'Online',
    difficulty: 'Medium',
    feeType: 'free',
    speedDays: 1,
    department: 'Department of Administrative Reforms & Public Grievances / Municipal Administration',
    shortDescription: 'Statistical estimation of daily and hourly civic service counter footfall from appointment and visit aggregates, combined with Erlang-C queue capacity staffing optimization for municipal facilitation centres.',
    processingTime: '1 business day (planning cycle)',
    fees: 'Free / Internal Operational Planning Tool',
    eligibility: [
      'Municipal Facilitation Centre Managers and Supervisors',
      'Civic Centre Shift Officers and Desk Dispatchers',
      'Urban Local Body Public Delivery Administrative Reviewers'
    ],
    documents: [
      'Historical hourly appointment and walk-in footfall aggregates',
      'Office physical counter capacity inventory',
      'Jurisdiction gazetted and emergency holiday calendar',
      'Statutory service duration and benchmark wait-time standards'
    ],
    documentRequirements: {
      'Historical hourly appointment and walk-in footfall aggregates': { type: 'mandatory' },
      'Office physical counter capacity inventory': { type: 'mandatory' },
      'Jurisdiction gazetted and emergency holiday calendar': { type: 'mandatory' },
      'Statutory service duration and benchmark wait-time standards': { type: 'mandatory' }
    },
    steps: [
      {
        title: 'Ingest Anonymized Footfall & Appointment Aggregates',
        description: 'Aggregate historical daily and hourly arrivals excluding citizen names and application numbers.'
      },
      {
        title: 'Compute Seasonal & Diurnal Demand Baseline',
        description: 'Calculate day-of-week and hour-of-day seasonal weights, holiday impact multipliers, and 80%/95% prediction intervals.'
      },
      {
        title: 'Run Erlang-C Queue Staffing Optimization',
        description: 'Solve for minimal counter staffing keeping utilization <= 0.85 and wait exceedance probability within statutory targets.'
      },
      {
        title: 'Draft & Review Capacity Plan with Human-in-the-Loop',
        description: 'Adjust shift staffing allocations with mandatory justification for >=20% variance.'
      },
      {
        title: 'Authorize & Land Shift Plan',
        description: 'Centre manager reviews and authorizes final staffing with append-only audit trail.'
      }
    ],
    officialSources: [
      {
        name: 'DARPG Citizen-Centric Governance Guidelines',
        url: 'https://darpg.gov.in',
        verified: true,
        lastVerified: '2026-11-15'
      },
      {
        name: 'National e-Governance Division (NeGD) Service Delivery Norms',
        url: 'https://negd.gov.in',
        verified: true,
        lastVerified: '2026-11-15'
      }
    ],
    warnings: [
      'Operational planning model only. This service does NOT provide guaranteed individual waiting times or token queue promises to citizens.',
      'All historical training inputs must strictly exclude citizen names, phone numbers, Aadhaar numbers, and application identifiers.'
    ],
    contacts: [
      { label: 'DARPG Helpdesk', url: 'https://darpg.gov.in' },
      { label: 'National e-Governance Service Support', url: 'https://negd.gov.in' }
    ],
    lastVerified: '2026-11-15'
  },
  {
    id: 'ward-budget-proposal',
    jurisdiction: { level: 'national', states: [], districts: [], localBody: '' },
    name: 'Participatory Ward Budget Proposal & Public Deliberation',
    shortDescription: 'Submit, deliberate, and track citizen-initiated ward budget proposals for local public infrastructure improvements, pedestrian footpaths, drainage, and parks.',
    category: 'Complaints',
    department: 'Urban Local Bodies / Ward Committees / Municipal Corporation Directorate',
    type: 'Online / Ward Sabha',
    difficulty: 'Easy',
    feeType: 'free',
    speedDays: 45,
    popularityScore: 95,
    eligibility: [
      'Must be a resident, property owner, trader, or registered Resident Welfare Association (RWA) member within the designated municipal ward.',
      'Proposed works must fall within municipal jurisdiction (roads, footpaths, stormwater drainage, public lighting, parks, or community reading centers).',
      'Cost estimate must fall within the ward budget ceiling (up to ₹5 Crore per ward envelope).',
      'Works must not duplicate ongoing capital tenders or encroach upon private property.'
    ],
    documents: [
      'Proof of ward residency or voter registration (Electors Photo Identity Card / utility bill / property tax receipt)',
      'Photographic evidence or survey notes of location defect / required civic improvement',
      'Preliminary itemized cost estimate or municipal schedule of rates reference (optional but recommended)'
    ],
    documentRequirements: {
      'Proof of ward residency or voter registration (Electors Photo Identity Card / utility bill / property tax receipt)': {
        type: 'mandatory'
      },
      'Photographic evidence or survey notes of location defect / required civic improvement': {
        type: 'mandatory'
      },
      'Preliminary itemized cost estimate or municipal schedule of rates reference (optional but recommended)': {
        type: 'optional'
      }
    },
    steps: [
      {
        title: 'Check Ward Budget Cycle Timeline',
        description: 'Verify that your municipal ward has an open intake or public deliberation cycle active.'
      },
      {
        title: 'Formulate Proposal & Cost Estimate',
        description: 'Specify the exact street or landmark location, select category, and provide realistic cost estimates within the statutory cap.'
      },
      {
        title: 'Review Automated Duplicate Suggestions',
        description: 'Inspect duplicate candidate clusters to consolidate repetitive requests with neighbors and build collective support.'
      },
      {
        title: 'Public Neighborhood Deliberation',
        description: 'Engage with fellow residents, answer municipal engineer queries, and refine specifications during the deliberation window.'
      },
      {
        title: 'Cast Advisory Citizen Vote',
        description: 'Participate in the advisory ward ballot to signal priority to the Ward Committee.'
      },
      {
        title: 'Track Social Audit & Ground Execution',
        description: 'Follow milestone updates, tender issuance, contractor assignment, and ground inspection photos.'
      }
    ],
    fees: 'Free',
    processingTime: 'Around 45 days',
    officialSources: [
      {
        name: 'Ministry of Housing and Urban Affairs (MoHUA) Citizen Participation Guidelines',
        url: 'https://mohua.gov.in',
        verified: true,
        lastVerified: '2026-11-01'
      },
      {
        name: 'National Urban Governance Platform',
        url: 'https://smartnet.niua.org',
        verified: true,
        lastVerified: '2026-11-05'
      }
    ],
    warnings: [
      'Citizen deliberation and advisory voting are non-statutory or advisory unless explicitly mandated by state municipal law.',
      'Proposals proposing works on private property, gated layout internal private alleys, or national highways will be disqualified during technical review.',
      'Do not include personal contact details, phone numbers, or identity numbers in public proposals or discussion comments.'
    ],
    contacts: [
      { label: 'Central Urban Citizen Helpline', phone: '14420', url: 'https://mohua.gov.in' },
      { label: 'Local Ward Committee Secretariat', phone: '1912', url: 'https://smartnet.niua.org' }
    ],
    lastVerified: '2026-11-15'
  },
  {
    id: 'water-quality-register',
    jurisdiction: { level: 'national', states: [], districts: [], localBody: '' },
    name: 'Community Water-Quality Sampling & Laboratory Result Register',
    shortDescription: 'Search public drinking water points, view verified laboratory test parameters against Bureau of Indian Standards IS 10500:2012, and track municipal corrective actions.',
    category: 'Health',
    department: 'Public Health Engineering Department (PHED) / Municipal Water Supply & Sewerage Board',
    type: 'Public Register / Surveillance',
    difficulty: 'Easy',
    feeType: 'free',
    speedDays: 3,
    popularityScore: 92,
    eligibility: [
      'Open to all residents, community organizations, and public health monitors.',
      'Public drinking water points include municipal taps, public standposts, community RO purification kiosks, and public borewells.',
      'Field sampling submissions must be accompanied by certified container bar code identifiers.'
    ],
    documents: [
      'Accredited NABL laboratory report certificate (for laboratory analysts and officials)',
      'Sealed container identification code and chain-of-custody log (for field samplers)'
    ],
    documentRequirements: {
      'Accredited NABL laboratory report certificate (for laboratory analysts and officials)': {
        type: 'mandatory'
      },
      'Sealed container identification code and chain-of-custody log (for field samplers)': {
        type: 'mandatory'
      }
    },
    steps: [
      {
        title: 'Locate Community Water Point',
        description: 'Search nearby municipal taps, public borewells, or community RO kiosks by ward or landmark.'
      },
      {
        title: 'Inspect Verified IS 10500 Parameters',
        description: 'Review physical, chemical, and bacteriological test values (pH, TDS, turbidity, hardness, E. coli) against statutory limits.'
      },
      {
        title: 'Check Cryptographic Verification Seal',
        description: 'Verify tamper-evident hash seal issued by accredited NABL state water testing laboratory.'
      },
      {
        title: 'Monitor Remedial Corrective Interventions',
        description: 'Track municipal pipeline repairs, super-chlorination disinfections, or filtration membrane replacements for out-of-range water points.'
      }
    ],
    fees: 'Free',
    processingTime: 'Around 3 days',
    officialSources: [
      {
        name: 'Bureau of Indian Standards (BIS) IS 10500:2012 Drinking Water Specification',
        url: 'https://www.services.bis.gov.in',
        verified: true,
        lastVerified: '2026-11-01'
      },
      {
        name: 'National Accreditation Board for Testing and Calibration Laboratories (NABL)',
        url: 'https://nabl-india.org',
        verified: true,
        lastVerified: '2026-11-05'
      },
      {
        name: 'Jal Jeevan Mission (JJM) Water Quality Management Information System',
        url: 'https://ejalshakti.gov.in/wqmis/',
        verified: true,
        lastVerified: '2026-11-10'
      }
    ],
    warnings: [
      'Water surveillance parameter comparisons are deterministic rule evaluations against IS 10500:2012; they do not constitute medical or clinical diagnoses.',
      'If bacteriological pathogens (Total Coliform / E. coli) are detected, observe precautionary boiling instructions while municipal disinfection is underway.',
      'Do not disclose private residential door or flat numbers in public field observations.'
    ],
    contacts: [
      { label: 'National Jal Jeevan Mission Helpline', phone: '1800-180-1551', url: 'https://jaljeevanmission.gov.in' },
      { label: 'Central Public Health Engineering (CPHEEO)', phone: '011-23062331', url: 'https://cpheeo.gov.in' }
    ],
    lastVerified: '2026-11-16'
  },
  {
    id: 'civic-survey-builder',
    jurisdiction: { level: 'national', states: [], districts: [], localBody: '' },
    name: 'Civic Survey Builder & Sampling Diagnostics',
    shortDescription: 'Design structured public surveys, manage sample representation targets, review question missingness, and inspect response-bias diagnostics with anonymous response protection.',
    category: 'Complaints',
    department: 'Directorate of Public Consultation & Urban Planning',
    type: 'Online',
    difficulty: 'Easy',
    feeType: 'free',
    speedDays: 1,
    popularityScore: 91,
    eligibility: [
      'Accessible to municipal department officers, approved public interest researchers, and community planning teams.',
      'Public responses are open to all citizens within the specified local ward or urban jurisdiction.',
      'Anonymous response mode ensures individual submissions cannot be correlated with citizen identification accounts.'
    ],
    documents: [
      'Departmental consultation authorization and gazette topic brief',
      'Statutory informed consent text with explicit voluntary participation rights',
      'Sampling quota design specifying minimum target respondents and voluntary strata'
    ],
    documentRequirements: {
      'Departmental consultation authorization and gazette topic brief': {
        type: 'mandatory'
      },
      'Statutory informed consent text with explicit voluntary participation rights': {
        type: 'mandatory'
      },
      'Sampling quota design specifying minimum target respondents and voluntary strata': {
        type: 'mandatory'
      }
    },
    steps: [
      {
        title: 'Draft Survey Scope & Sampling Target',
        description: 'Specify consultation objectives, target jurisdiction (ward/city), collection timeline, and minimum demographic representation quotas.'
      },
      {
        title: 'Author Questions & Dynamic Branching Rules',
        description: 'Configure typed questions, variable names, validation rules, and conditional logic to prevent irrelevant question burden.'
      },
      {
        title: 'Incorporate Informed Consent & Anonymous Protection',
        description: 'Provide clear consent disclosures and ensure consent tokens remain separated from answer vectors.'
      },
      {
        title: 'Publish Consultation & Monitor Quality Metrics',
        description: 'Track response intake against sampling targets, evaluate item missingness rates, and inspect demographic balance.'
      },
      {
        title: 'Inspect Diagnostics & Export Open Codebooks',
        description: 'Review ruleset-versioned recommendations and export data dictionaries for transparent statistical analysis.'
      }
    ],
    fees: 'Free',
    processingTime: 'Around 1 day',
    officialSources: [
      {
        name: 'Ministry of Housing and Urban Affairs — Citizen Engagement Guidelines',
        url: 'https://mohua.gov.in',
        verified: true,
        lastVerified: '2026-11-15'
      },
      {
        name: 'National Urban Digital Mission — Public Consultation Standards',
        url: 'https://nudm.mohua.gov.in',
        verified: true,
        lastVerified: '2026-11-15'
      }
    ],
    warnings: [
      'Demographic imbalance diagnostics only evaluate voluntary self-reported strata and do not guarantee probabilistic census representativeness.',
      'Personal identifiers (Aadhaar, PAN, phone numbers) must never be requested or stored in public survey response vectors.',
      'Small demographic groups with fewer than 5 respondents are suppressed under k-anonymity privacy safeguards.'
    ],
    contacts: [
      { label: 'Citizen Consultation Helpdesk', phone: '1800-11-0033', url: 'https://mohua.gov.in' },
      { label: 'Urban Analytics & Diagnostics Cell', phone: '011-23061111', url: 'https://nudm.mohua.gov.in' }
    ],
    lastVerified: '2026-11-15'
  },
  {

    id: 'verifiable-evidence-bundles',
    name: 'Verifiable Evidence Bundles for Civic Complaints',
    category: 'Grievance Redressal & Legal Evidence',
    icon: 'Shield',
    shortDescription: 'Cryptographically protected, append-only evidence packaging for municipal grievances, RTI escalations, and administrative complaints.',
    detailedDescription: 'Enables citizens to collect photographs, fee challans, postal receipts, and departmental correspondence over time into an append-only SHA-256 hash-chained ledger. Distinguishes unverified citizen assertions from independently verified government tokens and prevents file tampering, clock skew, and chain disruption.',
    department: 'Public Grievance Redressal / Administrative Authorities',
    type: 'Online / Offline Client Verification',
    difficulty: 'Easy',
    feeType: 'free',
    speedDays: 1,
    popularityScore: 95,
    jurisdiction: {
      level: 'national',
      states: [],
      districts: [],
      localBody: ''
    },
    tags: ['Grievance', 'Evidence', 'CPGRAMS', 'RTI', 'Tamper-Proof', 'Provenance', 'Cryptography'],
    processingTime: 'Instant / Client-Side Offline Verification',
    fees: 'Free & Open Source (0 INR)',
    eligibility: {
      minAge: 0,
      description: 'Any citizen, community group, or legal aid clinic assembling documentary proof for public service complaints.'
    },
    documents: {
      'Incident Photographs or Video Captures': { type: 'optional' },
      'Statutory Fee Payment Receipt / Challan Slip': { type: 'optional' },
      'Official Acknowledgement Slip / Token Number': { type: 'optional' },
      'Departmental Notice or Written Correspondence': { type: 'optional' }
    },
    steps: [
      {
        title: 'Create Evidence Bundle Manifest',
        description: 'Initialize a new complaint ledger with title, target department, and official reference numbers.'
      },
      {
        title: 'Append Evidence Items with Provenance Tiers',
        description: 'Upload files and tag them as Citizen Assertion or Independently Verified Record with factual notes.'
      },
      {
        title: 'Cryptographic Chain & Merkle Root Sealing',
        description: 'Client runtime automatically hashes each payload, chains to the previous record, and seals the Merkle tree.'
      },
      {
        title: 'Export Portable Archive & Dossier',
        description: 'Generate portable verifiable JSON packages or Markdown complaint dossiers with statutory disclaimers.'
      },
      {
        title: 'Lodge with Official Authorities',
        description: 'Attach the verified bundle to CPGRAMS (pgportal.gov.in), State Jan Sunwai, or local municipal counters.'
      }
    ],
    officialSources: [
      {
        name: 'CPGRAMS — Centralized Public Grievance Redress and Monitoring System',
        url: 'https://pgportal.gov.in',
        verified: true,
        lastVerified: '2026-11-25'
      },
      {
        name: 'RTI Online Portal — Government of India',
        url: 'https://rtionline.gov.in',
        verified: true,
        lastVerified: '2026-11-25'
      }
    ],
    warnings: [
      'Civic Help Setu Verifiable Evidence Bundles establish mathematical data integrity and chronological provenance for citizen records.',
      'This tool does NOT provide sovereign government attestation, legal advice, or guaranteed grievance resolution.',
      'Citizen assertions remain subjective user claims until independently verified by statutory authorities.'
    ],
    contacts: [
      { label: 'CPGRAMS Citizen Redressal Helpline', phone: '1800-11-4000', url: 'https://pgportal.gov.in' }
    ],
    lastVerified: '2026-11-25'

    id: 'public-toilet-directory',
    jurisdiction: { level: 'national', states: [], districts: [], localBody: '' },
    name: 'Public Toilet Availability, Accessibility & Maintenance Status',
    shortDescription: 'Searchable public sanitation facility directory with operating hours, wheelchair accessibility, sanitary amenities, cleaning logs, and verified maintenance status.',
    category: 'Health',
    department: 'Municipal Corporation / Urban Local Bodies — Sanitation Wing',
    type: 'Online',
    difficulty: 'Easy',
    feeType: 'free',
    speedDays: 1,
    popularityScore: 94,
    eligibility: [
      'Open to all residents, commuters, and visitors requiring municipal sanitation facilities.',
      'Accessible features (wheelchair ramps, grab bars, diaper changing, all-gender cabins) are available at verified municipal complexes.',
      'Facility operators and sanitation supervisors have dedicated access to update temporary closures and log cleaning events.'
    ],
    documents: [
      'No documents required for citizen public access or issue reporting'
    ],
    documentRequirements: {},
    steps: [
      {
        title: 'Locate Nearest Facility',
        description: 'Filter verified public toilets by city, ward, wheelchair ramp, running water, or 24/7 operating hours.'
      },
      {
        title: 'Verify Operating Hours & Live Status',
        description: 'Inspect real-time open/closed calculations, schedule windows, and active temporary closure notices.'
      },
      {
        title: 'Inspect Audited Cleanliness & Amenities',
        description: 'Review the latest supervisor cleaning timestamp, sanitary napkin availability, and audit score.'
      },
      {
        title: 'Report Issues or Submit Feedback',
        description: 'Submit maintenance tickets or hygiene observations with instant cryptographic tracking receipts.'
      }
    ],
    fees: 'Free',
    processingTime: 'Around 1 day',
    officialSources: [
      {
        name: 'Ministry of Housing and Urban Affairs — Swachh Bharat Mission (Urban)',
        url: 'https://swachhbharaturban.gov.in',
        verified: true,
        lastVerified: '2026-11-16'
      }
    ],
    warnings: [
      'Never include personal identifiers (Aadhaar, PAN, phone numbers) when submitting public issue reports.',
      'Emergency plumbing or sewer overhauls may cause temporary closures as declared by authorized municipal operators.'
    ],
    contacts: [
      { label: 'Swachhata Citizen Helpline', phone: '1969', url: 'https://swachhbharaturban.gov.in' }
    ],
    lastVerified: '2026-11-16'
  },
  {
    id: 'pedestrian-barrier-map',
    name: 'Accessible Pedestrian Route & Barrier Map',
    shortDescription: 'Plan accessible pedestrian routes avoiding broken footpaths, missing curb ramps, steep gradients, and temporary obstructions with community reporting and official municipal audits.',
    category: 'Transport',
    department: 'Municipal Corporation / Directorate of Urban Land Transport (DULT)',
    type: 'Online Tool / Civic Audit',
    difficulty: 'Easy',
    feeType: 'free',
    speedDays: 1,
    popularityScore: 94,
    jurisdiction: {
      level: 'local',
      states: ['Karnataka'],
      districts: ['Bengaluru Urban'],
      localBody: 'Bruhat Bengaluru Mahanagara Palike (BBMP)'
    },
    eligibility: [
      'Open to all residents, wheelchair users, senior citizens, parents with strollers, and pedestrians.',
      'Community obstacle reporting is open to all citizens without requiring personal medical or health disclosure.',
      'Ground verification and resolution updates are performed by authorized municipal engineers and ward reviewers.'
    ],
    documents: [
      'No documents required for route planning or obstacle reporting.',
      'Optional photographic evidence of physical barriers or missing curb ramps.'
    ],
    documentRequirements: {
      'No documents required for route planning or obstacle reporting.': {
        type: 'none'
      },
      'Optional photographic evidence of physical barriers or missing curb ramps.': {
        type: 'optional'
      }
    },
    steps: [
      {
        title: 'Select Origin and Destination Nodes',
        description: 'Choose your start and destination points on the pedestrian network map or directory dropdown.'
      },
      {
        title: 'Configure Functional Mobility Constraints',
        description: 'Toggle constraints such as avoiding stairs/steps, requiring dropped curb ramps, or setting maximum gradient thresholds without disclosing personal diagnoses.'
      },
      {
        title: 'Inspect Scoring Provenance & Alternative Route Tables',
        description: 'Review the calculated route, audit freshness indicators, active obstacles, or switch to the screen-reader accessible table view.'
      },
      {
        title: 'Report New Obstacles for Municipal Scrutiny',
        description: 'Submit geo-tagged descriptions of missing curb cuts, broken pavers, or temporary roadwork to update the routing graph for all citizens.'
      }
    ],
    fees: 'Free',
    processingTime: 'Around 1 day',
    officialSources: [
      {
        name: 'Harmonised Guidelines and Standards for Universal Accessibility in India (MoHUA)',
        url: 'https://mohua.gov.in',
        verified: true,
        lastVerified: '2026-11-16'
      },
      {
        name: 'Rights of Persons with Disabilities Act (Section 40 & 44 — Public Infrastructure Accessibility)',
        url: 'https://disabilityaffairs.gov.in',
        verified: true,
        lastVerified: '2026-11-16'
      }
    ],
    warnings: [
      'No route is described as fully accessible unless all traversed segments have undergone verified municipal ground inspection within the last 30 days.',
      'Personal contact details (Aadhaar, phone, email) must never be submitted in public barrier descriptions.',
      'Route preferences remain local to your browser and are not linked to citizen profiles.'
    ],
    contacts: [
      { label: 'Pedestrian Infrastructure Helpline', phone: '1533', url: 'https://bbmp.gov.in' },
      { label: 'Universal Accessibility Cell', phone: '080-22660000', url: 'https://dult.karnataka.gov.in' }
    ],
    lastVerified: '2026-11-16'
  },
  {
    id: 'open-contracting-red-flags',
    jurisdiction: { level: 'national', states: [], districts: [], localBody: '' },
    name: 'Open Contracting Red-Flag Analytics & Audit Workspace',
    shortDescription: 'Audit public procurement records across tender notice, bid, award, and amendment stages using explainable anomaly detection and OCDS red-flag benchmarks without declaring wrongdoing.',
    category: 'Complaints',
    department: 'Central Vigilance Commission & State Public Procurement Oversight Authorities',
    type: 'Online',
    difficulty: 'Medium',
    feeType: 'free',
    speedDays: 1,
    popularityScore: 94,
    tags: [
      'Procurement',
      'Tenders',
      'Auditing',
      'Red Flags',
      'Open Contracting',
      'OCDS',
      'Contract Amendments',
      'Single Bid',
      'Price Outlier'
    ],
    summary: 'Auditors, researchers, and citizens can review public procurement notices, detect statistical anomalies (repeated single-bid awards, unusual amendments, price creep, abbreviated notice periods), inspect linked procurement lifecycles, and document reasoned human review outcomes.',
    eligibility: [
      'Municipal and state auditors conducting procurement reviews',
      'Civil society oversight researchers and transparency watchdogs',
      'Citizen observers reviewing local public works and goods tenders',
      'Procurement analysts verifying supplier concentrations',
      'Public procurement records published under Open Contracting Data Standard (OCDS) or state e-Procurement portals',
      'Auditors must provide statutory justifications when recording review decisions or clearing flags'
    ],
    documents: [
      'Published Tender Notice & Corrigenda (Official tender advertisement with dates and criteria)',
      'Technical & Financial Bid Evaluation Sheets (Documenting received quotes and bidder rankings)',
      'Contract Award Order & Amendments (Documenting awarded amount and variation orders)'
    ],
    fees: 'Free',
    processingTime: 'Around 1 day',
    steps: [
      {
        title: 'Import & Harmonize Procurement Records',
        description: 'Tender notices, bids, award details, and contract amendments are normalized under Open Contracting schemas.'
      },
      {
        title: 'Run Explainable Anomaly Analytics',
        description: 'Deterministic rulesets detect single-bid awards, short turnaround windows, excessive amendments, and price outliers with comparison cohorts.'
      },
      {
        title: 'Inspect Linked Lifecycle Stages',
        description: 'Reviewers explore the timeline connecting notice to bids, award to amendments, and compare against category cohort benchmarks.'
      },
      {
        title: 'Record Human Audit Review & Issue Seal',
        description: 'Authorized auditors examine file records, mark false positives with documented reasons or escalate for formal audit with cryptographic seals.'
      }
    ],
    officialSources: [
      {
        name: 'Government e-Marketplace (GeM)',
        url: 'https://gem.gov.in',
        verified: true,
        lastVerified: '2026-11-16'
      },
      {
        name: 'Central Public Procurement Portal (CPPP)',
        url: 'https://eprocure.gov.in',
        verified: true,
        lastVerified: '2026-11-16'
      },
      {
        name: 'Open Contracting Partnership (OCDS)',
        url: 'https://www.open-contracting.org',
        verified: true,
        lastVerified: '2026-11-16'
      }
    ],
    warnings: [
      'Red-flag anomaly indicators are statistical and procedural prompts for auditor review; they do not declare wrongdoing or legal liability.',
      'Auditors must review the complete procurement file before taking formal administrative or investigative actions.',
      'Personal identifiers (Aadhaar, PAN, phone numbers, private emails) must never be entered into public audit review notes.'
    ],
    contacts: [
      { label: 'Central Vigilance Commission Helpline', phone: '1800-11-5555', url: 'https://cvc.gov.in' },
      { label: 'State Public Procurement Authority Helpdesk', phone: '080-22250000', url: 'https://kppp.karnataka.gov.in' }
    ],
    lastVerified: '2026-11-16'
  },
  {
    id: 'ward-issue-heatmap',
    jurisdiction: { level: 'national', states: [], districts: [], localBody: '' },
    name: 'Anonymized Ward-Level Civic Issue Heatmap & Trend Explorer',
    shortDescription: 'Aggregate analytics view for understanding recurring civic issues across municipal wards without exposing individual complainants or exact private locations.',
    category: 'Complaints',
    department: 'Directorate of Municipal Administration & Urban Data Governance Cell',
    type: 'Online Analytics & Public Dashboard',
    difficulty: 'Easy',
    feeType: 'free',
    speedDays: 1,
    popularityScore: 96,
    eligibility: [
      'Accessible to all citizens, community researchers, Resident Welfare Associations (RWAs), and municipal ward committees.',
      'Public view enforces k-anonymity (k >= 5) small-cell suppression: sparse cohorts are withheld from public display to prevent complainant re-identification.',
      'Municipal operators and administrators have authorized access to triage intervention recommendations and view aggregate trends across jurisdictions.'
    ],
    documents: [
      'Factual observation or geo-tagged location landmark for eligible civic defects',
      'No personal identity documents (Aadhaar/PAN) or private contact details required or permitted'
    ],
    documentRequirements: {
      'Factual observation or geo-tagged location landmark for eligible civic defects': {
        type: 'mandatory'
      }
    },
    steps: [
      {
        title: 'Explore Ward Heatmap & Issue Densities',
        description: 'Review ward-level distribution of recurring civic issues including road damage, water supply, solid waste, and waterlogging.'
      },
      {
        title: 'Inspect k-Anonymity & Suppression Safeguards',
        description: 'Verify active privacy rules (k >= 5) where cohorts with fewer than 5 events are suppressed to safeguard complainant confidentiality.'
      },
      {
        title: 'Compare Multi-Ward Trend Velocities',
        description: 'Evaluate reporting velocities across consecutive time windows to identify emerging hotspots and seasonal patterns.'
      },
      {
        title: 'Review Explainable Municipal Interventions',
        description: 'Inspect automated, ruleset-versioned recommendations with explainable data signals and human-in-the-loop review actions.'
      },
      {
        title: 'Submit Anonymized Civic Observation',
        description: 'Contribute ground observations with coordinates snapped strictly to the municipal ward centroid.'
      }
    ],
    fees: 'Free',
    processingTime: 'Around 1 day',
    officialSources: [
      {
        name: 'Ministry of Housing and Urban Affairs (MoHUA) — Urban Data Guidelines',
        url: 'https://mohua.gov.in',
        verified: true,
        lastVerified: '2026-11-15'
      },
      {
        name: 'National Urban Digital Mission — Open Urban Analytics Standards',
        url: 'https://nudm.mohua.gov.in',
        verified: true,
        lastVerified: '2026-11-15'
      }
    ],
    warnings: [
      'Exact residential door numbers, private coordinates, and complainant identities are never published or retained in heatmap analytics.',
      'Small cohorts with fewer than 5 reports are suppressed under k-anonymity privacy safeguards to prevent deanonymization.',
      'Automated recommendations are advisory and require human-in-the-loop validation by authorized municipal engineers.'
    ],
    contacts: [
      { label: 'Urban Analytics & Diagnostics Helpline', phone: '1800-11-4455', url: 'https://mohua.gov.in' },
      { label: 'Municipal Control Room', phone: '1916', url: 'https://nudm.mohua.gov.in' }
    ],
    lastVerified: '2026-11-15'
  },
  {
    id: 'property-tax-no-dues',
    name: 'Property Tax No-Dues Certificate & Payment Receipt Guide',
    title: 'Property Tax No-Dues Certificate & Payment Receipt Guide',
    shortDescription: 'Authoritative citizen guide for checking property tax dues, downloading official payment receipts, and securing a Municipal No-Dues Certificate across Indian Urban Local Bodies (#531).',
    description: 'Comprehensive, jurisdiction-aware citizen guide for checking municipal property tax dues, downloading official payment receipts, and obtaining certified Property Tax No-Dues Certificates across Indian municipal corporations and municipalities (MCD, BBMP, BMC, GCC, KMC, GHMC, AMC, PMC). Clearly differentiates payment receipts from No-Dues Certificates and explains that neither document confers legal ownership or title.',
    department: 'Urban Local Bodies (Municipal Corporations, Councils & Nagar Palikas) — Revenue & Assessment Department',
    category: 'Certificates',
    type: 'Online / Offline',
    difficulty: 'Easy',
    feeType: 'free',
    speedDays: 1,
    popularityScore: 97,
    eligibility: [
      'Registered property owners, co-owners, or recorded occupiers in municipal records',
      'Authorized family members, power of attorney (POA) holders, or legal representatives',
      'All property tax dues, solid waste management cesses, arrears, and penalties cleared in full'
    ],
    documents: [
      'Property Identification Number (UPIC, SAS/PID, SAC, Bill No, PTIN, or Tenement No)',
      'Latest Property Tax Paid Receipt / Bank Challan',
      'Government Photo Identity Proof of Applicant (Aadhaar, Voter ID, PAN, Passport)',
      'Registered Sale Deed / Title Deed (conditional, if mutation or name transfer is pending)',
      'Power of Attorney or Owner Authorization Letter (conditional, if representative applies)',
      'Death Certificate & Legal Heir Certificate (conditional, if registered owner is deceased)'
    ],
    steps: [
      { title: 'Identify Municipal Authority', description: 'Determine the competent Urban Local Body (e.g. MCD, BBMP, BMC, GCC, KMC, GHMC) holding territorial jurisdiction.' },
      { title: 'Locate Property in Ledger', description: 'Search using your city-specific Property ID, UPIC, SAS number, SAC, or PTIN on the official municipal revenue portal.' },
      { title: 'Inspect Demands & Arrears', description: 'Review current assessment year demand, accumulated arrears, cess line-items, and statutory penal interest.' },
      { title: 'Remit Pending Dues & Save Receipt', description: 'Clear all outstanding amounts via official payment gateways or bank challan and download the digitally signed payment receipt.' },
      { title: 'Apply & Download No-Dues Certificate', description: 'Generate the certified No-Dues Certificate online or submit a clearance application at the zonal revenue office.' }
    ],
    validityNote: 'Payment receipts verify a single transaction. No-Dues Certificates certify zero outstanding dues and are valid for the ongoing assessment cycle (typically ending 31 March) or until the next statutory demand is raised.',
    fees: 'No government fee for online No-Dues Certificate generation in most major ULBs; all assessed tax dues, cesses, and accumulated arrears must be cleared in full.',
    processingTime: 'Instant online download upon ledger zero-balance; 3 to 15 working days for manual zonal revenue office applications under State Right to Services Acts.',
    officialSources: [
      {
        name: 'Municipal Corporation of Delhi (MCD) Property Tax Portal',
        url: 'https://mcdonline.nic.in',
        verified: true,
        lastVerified: '2026-11-18'
      },
      {
        name: 'Bruhat Bengaluru Mahanagara Palike (BBMP) Property Tax System',
        url: 'https://bbmptax.karnataka.gov.in',
        verified: true,
        lastVerified: '2026-11-18'
      },
      {
        name: 'Brihanmumbai Municipal Corporation (BMC) Citizen Portal',
        url: 'https://ptaxportal.mcgm.gov.in',
        verified: true,
        lastVerified: '2026-11-18'
      },
      {
        name: 'Greater Chennai Corporation (GCC) Property Tax Portal',
        url: 'https://chennaicorporation.gov.in',
        verified: true,
        lastVerified: '2026-11-18'
      }
    ],
    warnings: [
      'A Property Tax Payment Receipt or No-Dues Certificate does NOT confer or prove legal ownership, title, or proprietary right over real estate.',
      'Payment of property tax does NOT regularize unauthorized constructions or shield them from municipal enforcement action.',
      'Never remit property taxes on unverified third-party websites or search engine advertisements. Verify that the portal URL ends with .gov.in or .nic.in.'
    ],
    contacts: [
      { label: 'Delhi MCD Helpline', phone: '155304', url: 'https://mcdonline.nic.in' },
      { label: 'Bengaluru BBMP Control Room', phone: '080-22660000', url: 'https://bbmptax.karnataka.gov.in' },
      { label: 'Mumbai BMC Helpline', phone: '1916', url: 'https://ptaxportal.mcgm.gov.in' },
      { label: 'Chennai GCC Helpline', phone: '1913', url: 'https://chennaicorporation.gov.in' }
    ],
    lastVerified: '2026-11-18'
  },
  {
    id: 'transgender-certificate-welfare',
    name: 'Transgender Identity Certificate & Welfare Navigator',
    shortDescription: 'Privacy-first guide to official certificate application routes, medical affirmation revisions, welfare schemes, and verified support resources under the Transgender Persons Act, 2019 (#1104).',
    description: 'Statutory guide to official transgender identity certificate application routes under Section 5 and gender affirmation revisions under Section 7 of the Transgender Persons (Protection of Rights) Act, 2019. Covers the National Portal (transgender.dosje.gov.in), 30-day DM turnaround, zero-fee mandate, SMILE scheme, Ayushman Bharat TG Plus, Garima Greh, and state-aware verified support resources with zero identity document collection and client-side privacy.',
    department: 'Ministry of Social Justice and Empowerment / State Transgender Welfare Boards',
    category: 'Certificates',
    type: 'Online / Citizen Guide',
    difficulty: 'Easy',
    feeType: 'free',
    speedDays: 30,
    popularityScore: 98,
    path: '/services/transgender-certificate-welfare',
    eligibility: [
      'Any transgender person residing in India',
      'At least one year of continuous residence within the jurisdiction of the District Magistrate',
      'Self-perceived gender identity declared via Form 2 affidavit (no medical exam permitted)'
    ],
    documents: [
      'Self-declaration Affidavit in Form 2 on non-judicial stamp paper',
      'Recent colour passport-size photograph',
      'Proof of residence of at least 1 year (utility bill, voter ID, ration card, rent agreement)',
      'For revised certificate (Section 7): Form 3 Certificate from Medical Superintendent / CMO'
    ],
    steps: [
      { title: 'Register on National Portal', description: 'Create an account on transgender.dosje.gov.in without mandatory Aadhaar linkage.' },
      { title: 'Submit Form 1 & Form 2 Affidavit', description: 'Upload self-perceived identity affidavit and address proof.' },
      { title: 'District Magistrate Review', description: 'Statutory 30-day timeline for issuance; physical examination is legally prohibited.' },
      { title: 'Digital Download & Revision Access', description: 'Download the Certificate of Identity and barcoded card; apply for revisions post-medical affirmation under Section 7.' }
    ],
    validityNote: 'Certificate of Identity is valid across all Union and State Government departments nationwide with lifetime validity, subject to statutory revision under Section 7 upon medical intervention.',
    fees: 'Nil (Completely free of cost as mandated under Central Rules)',
    processingTime: '30 statutory days from receipt of application under Rule 6(1)',
    officialSources: [
      {
        name: 'National Portal for Transgender Persons (MoSJE)',
        url: 'https://transgender.dosje.gov.in',
        verified: true,
        lastVerified: '2026-11-20'
      },
      {
        name: 'Ministry of Social Justice and Empowerment',
        url: 'https://socialjustice.gov.in',
        verified: true,
        lastVerified: '2026-11-20'
      }
    ],
    warnings: [
      'Under Section 5 of the Transgender Persons Act, 2019, requiring an applicant to undergo any physical or medical examination for an initial Certificate of Identity is strictly illegal.',
      'Never share your barcoded Certificate of Identity or QR code on unverified websites or public social media.',
      'Official applications are completely free on transgender.dosje.gov.in; do not pay middlemen or unofficial agents.'
    ],
    contacts: [
      { label: 'National Tele-Counselling Helpline', phone: '14567', url: 'https://transgender.dosje.gov.in' },
      { label: 'Emergency Helpline for Women & TG', phone: '181', url: 'https://wcd.nic.in' },
      { label: 'National Legal Services Authority (NALSA)', phone: '15100', url: 'https://nalsa.gov.in' }
    ],
    lastVerified: '2026-11-20'

  }
];

export const services = MOCK_SERVICES;
export default services;