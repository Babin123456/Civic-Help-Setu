/**
 * src/data/syntheticIndicLexicon.js
 *
 * Procedural linguistic lexicons, administrative entities, and grammar templates
 * for synthetic Indian civic data generation (#778).
 *
 * Invariants:
 * - All names, addresses, and phone numbers are completely fictional and artificial.
 * - Non-routable dummy phone prefixes: +91-99900-XXXXX.
 * - District-to-pincode mapping adheres to real postal circles for realistic testing.
 * - Multi-lingual support: Latin/English, Devanagari (Hindi/Marathi), Tamil, Bengali, Kannada, Telugu, Gujarati.
 */

export const INDIC_REGIONAL_NAMES = {
  maharashtra: {
    firstNames: [
      { en: 'Aarav', mr: 'आरव' },
      { en: 'Ananya', mr: 'अनन्या' },
      { en: 'Rohan', mr: 'रोहन' },
      { en: 'Snehal', mr: 'स्नेहल' },
      { en: 'Pranav', mr: 'प्रणव' },
      { en: 'Pooja', mr: 'पूजा' },
      { en: 'Aditya', mr: 'आदित्य' },
      { en: 'Tanvi', mr: 'तन्वी' },
      { en: 'Omkar', mr: 'ओंकार' },
      { en: 'Vaishnavi', mr: 'वैष्णवी' },
      { en: 'Siddharth', mr: 'सिद्धार्थ' },
      { en: 'Manasi', mr: 'मानसी' },
    ],
    lastNames: [
      { en: 'Deshmukh', mr: 'देशमुख' },
      { en: 'Patil', mr: 'पाटील' },
      { en: 'Kulkarni', mr: 'कुलकर्णी' },
      { en: 'Joshi', mr: 'जोशी' },
      { en: 'Shinde', mr: 'शिंदे' },
      { en: 'Gaikwad', mr: 'गायकवाड' },
      { en: 'Pawar', mr: 'पवार' },
      { en: 'Chavan', mr: 'चव्हाण' },
      { en: 'Bhosale', mr: 'भोसले' },
      { en: 'More', mr: 'मोरे' },
    ],
  },
  north: {
    firstNames: [
      { en: 'Amit', hi: 'अमित' },
      { en: 'Priya', hi: 'प्रिया' },
      { en: 'Rahul', hi: 'राहुल' },
      { en: 'Neha', hi: 'नेहा' },
      { en: 'Vikas', hi: 'विकास' },
      { en: 'Sunita', hi: 'सुनीता' },
      { en: 'Rajesh', hi: 'राजेश' },
      { en: 'Kavita', hi: 'कविता' },
      { en: 'Deepak', hi: 'दीपक' },
      { en: 'Meera', hi: 'मीरा' },
    ],
    lastNames: [
      { en: 'Sharma', hi: 'शर्मा' },
      { en: 'Verma', hi: 'वर्मा' },
      { en: 'Singh', hi: 'सिंह' },
      { en: 'Gupta', hi: 'गुप्ता' },
      { en: 'Kumar', hi: 'कुमार' },
      { en: 'Mishra', hi: 'मिश्रा' },
      { en: 'Yadav', hi: 'यादव' },
      { en: 'Pandey', hi: 'पांडेय' },
    ],
  },
  south: {
    firstNames: [
      { en: 'Karthik', ta: 'கார்த்திக்', te: 'కార్తీక్', kn: 'ಕಾರ್ತಿಕ್' },
      { en: 'Deepa', ta: 'தீபா', te: 'దీప', kn: 'ದೀಪಾ' },
      { en: 'Suresh', ta: 'சுரேஷ்', te: 'సురేష్', kn: 'ಸುರೇಶ್' },
      { en: 'Lakshmi', ta: 'லக்ஷ்மி', te: 'లక్ష్మి', kn: 'ಲಕ್ಷ್ಮಿ' },
      { en: 'Venkatesh', ta: 'வெங்கடேஷ்', te: 'వెంకటేష్', kn: 'ವೆಂಕಟೇಶ್' },
      { en: 'Anitha', ta: 'அனிதா', te: 'అనిత', kn: 'ಅನಿತಾ' },
      { en: 'Murugan', ta: 'முருகன்', te: 'మురుగన్', kn: 'ಮುರುಗನ್' },
    ],
    lastNames: [
      { en: 'Iyer', ta: 'ஐயர்' },
      { en: 'Rao', te: 'రావు', kn: 'ರಾವ್' },
      { en: 'Reddy', te: 'రెడ్డి' },
      { en: 'Nair', ml: 'നായർ' },
      { en: 'Pillai', ta: 'பிள்ளை' },
      { en: 'Gowda', kn: 'ಗೌಡ' },
      { en: 'Subramanian', ta: 'சுப்பிரமணியன்' },
    ],
  },
  east: {
    firstNames: [
      { en: 'Subhash', bn: 'সুভাষ' },
      { en: 'Debolina', bn: 'দেবলীনা' },
      { en: 'Sourav', bn: 'সৌরভ' },
      { en: 'Mousumi', bn: 'মৌসুমী' },
      { en: 'Anirban', bn: 'অনির্বাণ' },
    ],
    lastNames: [
      { en: 'Banerjee', bn: 'ব্যানার্জী' },
      { en: 'Chatterjee', bn: 'চ্যাটার্জী' },
      { en: 'Mukherjee', bn: 'মুখার্জী' },
      { en: 'Bose', bn: 'বোস' },
      { en: 'Dutta', bn: 'দত্ত' },
    ],
  },
};

export const JURISDICTIONS_DATA = [
  {
    state: 'Maharashtra',
    district: 'Pune',
    postalRange: { min: 411001, max: 411058 },
    wards: [
      'Ward 1 - Aundh-Baner',
      'Ward 2 - Kothrud-Bavdhan',
      'Ward 3 - Shivajinagar-Ghole Road',
      'Ward 4 - Kasba-Vishrambaug Wada',
      'Ward 5 - Hadapsar-Mundhwa',
      'Ward 6 - Bibwewadi',
      'Ward 7 - Dhankawadi-Sahakarnagar',
      'Ward 8 - Sinhagad Road',
    ],
    zones: ['Zone 1 (Central)', 'Zone 2 (West)', 'Zone 3 (East)', 'Zone 4 (South)'],
    offices: [
      {
        name: 'Pune Municipal Corporation Head Office',
        type: 'Municipal Corporation',
        code: 'PMC-HQ',
        pincode: 411005,
        address: 'Shivajinagar, Pune, Maharashtra 411005',
      },
      {
        name: 'Aundh Ward Citizen Facilitation Centre (CFC)',
        type: 'Ward Office',
        code: 'PMC-WARD-01',
        pincode: 411007,
        address: 'Near Bremen Chowk, Aundh, Pune 411007',
      },
      {
        name: 'Kothrud Regional Citizen Service Kendra',
        type: 'Zonal Office',
        code: 'PMC-ZONE-02',
        pincode: 411038,
        address: 'Paud Road, Kothrud, Pune 411038',
      },
      {
        name: 'Hadapsar Ward Office and Suvidha Kendra',
        type: 'Ward Office',
        code: 'PMC-WARD-05',
        pincode: 411028,
        address: 'Gadital, Pune-Solapur Highway, Hadapsar 411028',
      },
      {
        name: 'Bibwewadi Citizen Advisory & Grievance Cell',
        type: 'Ward Office',
        code: 'PMC-WARD-06',
        pincode: 411037,
        address: 'Bibwewadi Main Road, Pune 411037',
      },
    ],
  },
  {
    state: 'Maharashtra',
    district: 'Mumbai Suburban',
    postalRange: { min: 400050, max: 400104 },
    wards: [
      'Ward K-East (Andheri East)',
      'Ward K-West (Andheri West)',
      'Ward H-West (Bandra West)',
      'Ward P-South (Goregaon)',
      'Ward R-Central (Borivali)',
    ],
    zones: ['Western Suburbs Zone 1', 'Western Suburbs Zone 2'],
    offices: [
      {
        name: 'BMC K-East Ward Office',
        type: 'Ward Office',
        code: 'BMC-KE',
        pincode: 400069,
        address: 'Gundavali, Andheri East, Mumbai 400069',
      },
      {
        name: 'BMC H-West Citizen Facilitation Centre',
        type: 'Ward Office',
        code: 'BMC-HW',
        pincode: 400050,
        address: 'Saint Martin Road, Bandra West, Mumbai 400050',
      },
      {
        name: 'BMC R-Central Administrative Bhavan',
        type: 'Ward Office',
        code: 'BMC-RC',
        pincode: 400092,
        address: 'Chandavarkar Road, Borivali West, Mumbai 400092',
      },
    ],
  },
  {
    state: 'Delhi',
    district: 'Central Delhi',
    postalRange: { min: 110001, max: 110008 },
    wards: ['Civil Lines Ward', 'Karol Bagh Ward', 'Paharganj Ward', 'Daryaganj Ward'],
    zones: ['Central Zone MCD', 'North Delhi MCD'],
    offices: [
      {
        name: 'MCD Central Civic Centre',
        type: 'MCD Headquarters',
        code: 'MCD-HQ',
        pincode: 110002,
        address: 'J.L. Nehru Marg, Minto Road, New Delhi 110002',
      },
      {
        name: 'Karol Bagh Citizen Suvidha Centre',
        type: 'Zonal Office',
        code: 'MCD-KB',
        pincode: 110005,
        address: 'Anand Parbat, Karol Bagh, New Delhi 110005',
      },
    ],
  },
  {
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    postalRange: { min: 560001, max: 560099 },
    wards: ['Ward 112 - Domlur', 'Ward 150 - Bellandur', 'Ward 174 - HSR Layout', 'Ward 177 - Jayanagar'],
    zones: ['South Zone BBMP', 'East Zone BBMP', 'Mahadevapura Zone BBMP'],
    offices: [
      {
        name: 'BBMP Head Office',
        type: 'Municipal Corporation',
        code: 'BBMP-HQ',
        pincode: 560002,
        address: 'NR Square, Bengaluru, Karnataka 560002',
      },
      {
        name: 'BBMP Mahadevapura Zonal Office',
        type: 'Zonal Office',
        code: 'BBMP-MHD',
        pincode: 560048,
        address: 'Whitefield Main Road, Bengaluru 560048',
      },
    ],
  },
];

export const CIVIC_SERVICE_TEMPLATES = [
  {
    category: 'Revenue & Certificates',
    department: 'Revenue & Land Records',
    services: [
      {
        name: 'Issuance of Income Certificate',
        difficulty: 'Moderate',
        statutoryDays: 15,
        fee: 50,
        feeType: 'Fixed Statutory Fee',
        requiredDocs: ['Aadhaar Card (Synthetic)', 'Ration Card Copy', 'Salary Slip or IT Return Proof', 'Self-Declaration Affidavit'],
        validity: '1 Year from Date of Issue',
      },
      {
        name: 'Issuance of Caste / Community Certificate',
        difficulty: 'High',
        statutoryDays: 30,
        fee: 65,
        feeType: 'Fixed Statutory Fee',
        requiredDocs: ['Applicant School Leaving Certificate', 'Father / Paternal Relative Caste Proof', 'Residence Proof 1950/1967', 'Affidavit in Prescribed Form'],
        validity: 'Permanent unless Revoked',
      },
      {
        name: 'Non-Creamy Layer (NCL) Certificate',
        difficulty: 'Moderate',
        statutoryDays: 21,
        fee: 50,
        feeType: 'Fixed Statutory Fee',
        requiredDocs: ['Caste Certificate', 'Last 3 Years Income Tax Returns', 'Land Holding 7/12 Extract', 'Self-Declaration Form'],
        validity: '3 Financial Years',
      },
      {
        name: 'Domicile and Age/Nationality Certificate',
        difficulty: 'Moderate',
        statutoryDays: 15,
        fee: 50,
        feeType: 'Fixed Statutory Fee',
        requiredDocs: ['Continuous 15-Year Residence Proof', 'Birth Certificate or School Leaving Certificate', 'Voter Identity Card Copy'],
        validity: 'Permanent',
      },
    ],
  },
  {
    category: 'Civil Registration & Health',
    department: 'Public Health Department',
    services: [
      {
        name: 'Birth Certificate Registration & Extract Copy',
        difficulty: 'Easy',
        statutoryDays: 7,
        fee: 25,
        feeType: 'Nominal Search Fee',
        requiredDocs: ['Hospital Discharge Summary / Form 1', 'Parents Identity Proof', 'Marriage Certificate Copy'],
        validity: 'Permanent',
      },
      {
        name: 'Death Certificate Registration & Extract Copy',
        difficulty: 'Easy',
        statutoryDays: 7,
        fee: 25,
        feeType: 'Nominal Search Fee',
        requiredDocs: ['Medical Cause of Death Certificate (Form 4)', 'Crematorium / Burial Ground Receipt', 'Deceased ID Proof'],
        validity: 'Permanent',
      },
      {
        name: 'Food Business License & Health NOC',
        difficulty: 'High',
        statutoryDays: 45,
        fee: 1500,
        feeType: 'Tiered License Fee',
        requiredDocs: ['Premises Ownership / Rent Agreement', 'Fire Safety NOC', 'Water Potability Test Report', 'FSSAI Declaration'],
        validity: '1 to 5 Years Renewable',
      },
    ],
  },
  {
    category: 'Urban Utilities & Town Planning',
    department: 'Engineering & Public Works',
    services: [
      {
        name: 'Municipal Water Tanker Emergency Delivery Request',
        difficulty: 'Easy',
        statutoryDays: 1,
        fee: 350,
        feeType: 'Fixed Tanker Tariff',
        requiredDocs: ['Consumer Water Connection Number', 'Proof of Disrupted Supply or Scarcity Proof', 'Premises Location Pin'],
        validity: 'Per-Trip Delivery',
      },
      {
        name: 'Permission for Tree Trimming / Tree Preservation NOC',
        difficulty: 'Moderate',
        statutoryDays: 14,
        fee: 0,
        feeType: 'Exempt',
        requiredDocs: ['Color Photographs of Tree Hazard', 'Property Ownership Proof', 'Society Resolution or Owner No-Objection'],
        validity: '60 Days Execution Window',
      },
      {
        name: 'Fire Safety NOC & Compliance Certificate',
        difficulty: 'High',
        statutoryDays: 30,
        fee: 2500,
        feeType: 'Inspection & Scrutiny Fee',
        requiredDocs: ['Building Approved Sanction Plan', 'Fire Fighting System Test Certificate (Form A)', 'Licensed Agency Attestation'],
        validity: 'Annual Renewal',
      },
      {
        name: 'Drainage Connection & Road Digging Permission',
        difficulty: 'High',
        statutoryDays: 21,
        fee: 4500,
        feeType: 'Security Deposit & Restoration Charge',
        requiredDocs: ['Sanctioned Drainage Plan', 'Road Cutting Estimate by Ward Engineer', 'Bank Guarantee or Deposit Receipt'],
        validity: '90 Days Completion Window',
      },
    ],
  },
  {
    category: 'Public Grievances & RTI',
    department: 'Citizen Vigilance & Right to Information',
    services: [
      {
        name: 'Right to Information (RTI) Application Filing',
        difficulty: 'Easy',
        statutoryDays: 30,
        fee: 10,
        feeType: 'Statutory RTI Fee',
        requiredDocs: ['Specific Information Query Letter', 'Proof of BPL Exemption (if applicable)'],
        validity: 'Single Query Resolution',
      },
      {
        name: 'Public Grievance Escalation (CPGRAMS / Local Lokshahi)',
        difficulty: 'Easy',
        statutoryDays: 21,
        fee: 0,
        feeType: 'Exempt',
        requiredDocs: ['Prior Unresolved Complaint Reference Number', 'Chronological Delay Timeline Evidence'],
        validity: 'Final Remedy Disposal',
      },
    ],
  },
];

export const SYNTHETIC_ADDRESS_LANDMARKS = [
  'Near Gram Panchayat Bhavan',
  'Opposite Zilla Parishad School',
  'Behind Old Post Office',
  'Next to Shivaji Chowk Clock Tower',
  'Near Primary Health Centre (PHC)',
  'Lane No. 4, Shanti Nagar Housing Society',
  'Near Water Overhead Reservoir',
  'Subhash Road, Gandhi Market',
  'Opposite Police Chowky',
  'Near Railway Overbridge',
];

export const GRIEVANCE_CATEGORIES = [
  {
    code: 'WATER_CONTAMINATION',
    title: 'Discolored or Contaminated Potable Water Supply',
    severity: 'CRITICAL',
    escalationDays: 3,
  },
  {
    code: 'STREET_LIGHT_OUTAGE',
    title: 'Defective Street Lights / Dark Corridor Security Risk',
    severity: 'MEDIUM',
    escalationDays: 5,
  },
  {
    code: 'POTHOLE_ROAD_HAZARD',
    title: 'Hazardous Road Crater / Broken Pavement',
    severity: 'HIGH',
    escalationDays: 7,
  },
  {
    code: 'DELAY_IN_STATUTORY_CERTIFICATE',
    title: 'Citizens Charter Breach: Application Overdue Beyond Prescribed Time',
    severity: 'HIGH',
    escalationDays: 7,
  },
  {
    code: 'ILLEGAL_DEBRIS_DUMPING',
    title: 'Unauthorized Construction Debris Blocking Storm Drain',
    severity: 'MEDIUM',
    escalationDays: 5,
  },
  {
    code: 'CORRUPTION_OVERCHARGE',
    title: 'Demand for Facilitation Fee / Refusal of Official Receipt',
    severity: 'CRITICAL',
    escalationDays: 2,
  },
];

export const TIMELINE_TRANSITION_REMARKS = {
  SUBMITTED: [
    'Application received electronically via Citizen Service Portal. System acknowledgement dispatched.',
    'Scanned documents received at Ward Facilitation Desk and placed in verification queue.',
  ],
  IN_SCRUTINY: [
    'Desk scrutiny initiated by Junior Administrative Officer. Primary identity verified.',
    'Assigned to field verification team for statutory address and document vetting.',
  ],
  QUERY_RAISED: [
    'Deficiency noticed: Uploaded caste record is blurred and illegible. Statutory cure window granted (15 days).',
    'Address verification query raised: Discrepancy between tax receipt name and applicant surname. Clarification requested.',
    'Required document missing: Recent electricity bill copy not attached.',
  ],
  QUERY_RESOLVED: [
    'Applicant submitted fresh high-resolution certified scan of deficient record.',
    'Applicant submitted notarized affidavit clarifying name variation.',
  ],
  FIELD_INSPECTION: [
    'Field inspection conducted by Ward Inspector. Geo-coordinates verified and neighbor statement recorded.',
    'On-site visit completed. Premises dimensions verified against sanctioned building plan.',
  ],
  APPROVED: [
    'All statutory verifications complete. Certified by Competent Authority under Right to Services Act.',
    'Final clearance issued. Digital certificate sealed with QR-verification code.',
  ],
  REJECTED: [
    'Application rejected: Applicant failed to respond within statutory cure window of 30 days.',
    'Rejected: Ineligible due to residence criteria not meeting the prescribed 15-year statutory mandate.',
  ],
  FIRST_APPEAL: [
    'Citizen filed statutory First Appeal under Section 8 of Right to Services Act citing unnotified delay.',
  ],
};
