/**
 * Municipal Trade Licence Reference Dataset
 *
 * Grounded in state municipal acts and official urban local body portals.
 * Covers verified Urban Local Bodies (MCD, GCC, BBMP, KMC, BMC) and fallback unlisted ULB.
 */

export const MUNICIPAL_JURISDICTIONS = [
  {
    id: 'delhi',
    state: 'Delhi (NCT)',
    district: 'All Delhi Districts',
    localBody: 'Municipal Corporation of Delhi (MCD)',
    department: 'Assessment & Collection / Trade Licensing Department',
    statutoryAct: 'Delhi Municipal Corporation Act, 1957 (Sections 417, 421, 422)',
    portalName: 'MCD Online Citizen Portal',
    portalUrl: 'https://mcdonline.nic.in',
    processingTime: '7 to 15 working days (Same-day provisional under EODB self-certification for non-polluting trades)',
    feeStructure: 'Calculated dynamically based on covered unit area (sq. meters), trade schedule category, and electric motor horse power (HP).',
    validityPeriod: 'Financial Year (expires 31 March) or 1 to 3 years multi-year option.',
    renewalWindow: '1 January to 31 March annually. Late renewals subject to statutory penal surcharge.',
    lastVerified: '2026-11-05',
    verified: true,
    inspectionMandatory: false,
    inspectionNote: 'Self-certification permitted for trades on de-notified/mixed-use streets; physical spot inspection mandatory for health and hazardous categories.'
  },
  {
    id: 'chennai',
    state: 'Tamil Nadu',
    district: 'Chennai',
    localBody: 'Greater Chennai Corporation (GCC)',
    department: 'Revenue & Public Health Department',
    statutoryAct: 'Tamil Nadu Urban Local Bodies Act, 1998 & Rules 2023 / Chennai City Municipal Corporation Act, 1919',
    portalName: 'Greater Chennai Corporation Citizen Portal',
    portalUrl: 'https://chennaicorporation.gov.in',
    processingTime: '15 to 30 working days under statutory Citizens\' Charter',
    feeStructure: 'Prescribed under Tamil Nadu Urban Local Bodies Rules, 2023 based on plinth area (sq. ft.), motor horsepower, and trade hazard classification.',
    validityPeriod: '1 Financial Year (1 April to 31 March).',
    renewalWindow: 'January to March annually. 25% to 50% late fee applied for renewals filed after 31 March.',
    lastVerified: '2026-11-05',
    verified: true,
    inspectionMandatory: true,
    inspectionNote: 'Sanitary Inspector (SI) / Zonal Health Officer physical inspection conducted prior to licence grant.'
  },
  {
    id: 'bengaluru',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    localBody: 'Bruhat Bengaluru Mahanagara Palike (BBMP)',
    department: 'Health Department / Trade License Division',
    statutoryAct: 'Bruhat Bengaluru Mahanagara Palike Act, 2020 / Karnataka Municipal Corporations Act, 1976 (Section 343)',
    portalName: 'BBMP Citizen Portal / e-Aasthi',
    portalUrl: 'https://bbmptax.karnataka.gov.in',
    processingTime: '14 to 21 working days (guaranteed under Karnataka Sakala Services Act)',
    feeStructure: 'Assessed per BBMP Trade Classification Matrix Schedule X (minimum base fee + area surcharge + power rate).',
    validityPeriod: '1 Financial Year ending on 31 March.',
    renewalWindow: '1 January to 31 March. Statutory penalty accrues on lapses beyond 31 March.',
    lastVerified: '2026-11-05',
    verified: true,
    inspectionMandatory: true,
    inspectionNote: 'Medical Officer of Health (MOH) / Senior Health Inspector verification required for food and commercial operations.'
  },
  {
    id: 'kolkata',
    state: 'West Bengal',
    district: 'Kolkata',
    localBody: 'Kolkata Municipal Corporation (KMC)',
    department: 'Licence Department (Certificate of Enlistment)',
    statutoryAct: 'Kolkata Municipal Corporation Act, 1980 (Section 199)',
    portalName: 'KMC e-Services Portal',
    portalUrl: 'https://www.kmcgov.in',
    processingTime: 'Instant provisional C.E. for non-food retail; 15 to 30 days for inspection-based categories.',
    feeStructure: 'Graduated fee scale pegged to annual valuation of commercial premises and trade nature under KMC Act Section 199.',
    validityPeriod: '1 Year or 3-Year Certificate of Enlistment (C.E.).',
    renewalWindow: 'Prior to expiration of existing Certificate of Enlistment.',
    lastVerified: '2026-11-05',
    verified: true,
    inspectionMandatory: false,
    inspectionNote: 'Simplified EODB clearance for non-offensive trades; physical inspection required for eating houses and hazardous goods.'
  },
  {
    id: 'mumbai',
    state: 'Maharashtra',
    district: 'Mumbai City & Suburban',
    localBody: 'Brihanmumbai Municipal Corporation (BMC / MCGM)',
    department: 'Public Health Department / Citizen Facilitation Centre (CFC)',
    statutoryAct: 'Mumbai Municipal Corporation Act, 1888 (Section 394)',
    portalName: 'BMC Citizen Facilitation Portal',
    portalUrl: 'https://portal.mcgm.gov.in',
    processingTime: '15 to 30 working days under Maharashtra Right to Public Services Act',
    feeStructure: 'Assessed pursuant to Schedule M of MMC Act (computed via trade risk code, carpet area, and employee count).',
    validityPeriod: 'Annual or multi-year validity.',
    renewalWindow: '30 days prior to expiry date. Penal surcharge imposed for delayed filing.',
    lastVerified: '2026-11-05',
    verified: true,
    inspectionMandatory: true,
    inspectionNote: 'Sanitary Inspector and Fire Safety Officer inspection mandatory before final issuance.'
  },
  {
    id: 'unspecified',
    state: 'Other / Unlisted State',
    district: 'Unspecified District',
    localBody: 'Local Municipal Corporation / Council / Nagar Palika',
    department: 'Not specified by the linked official source.',
    statutoryAct: 'Respective State Municipal Act',
    portalName: 'Not specified by the linked official source.',
    portalUrl: null,
    processingTime: 'Not specified by the linked official source.',
    feeStructure: 'Not specified by the linked official source.',
    validityPeriod: 'Not specified by the linked official source.',
    renewalWindow: 'Not specified by the linked official source.',
    lastVerified: 'Not specified by the linked official source.',
    verified: false,
    inspectionMandatory: false,
    inspectionNote: 'Not specified by the linked official source.'
  }
];

export const MANDATORY_DOCUMENTS = [
  {
    id: 'doc-identity',
    title: 'Identity Proof of Applicant / Proprietor / Authorised Partner',
    description: 'Aadhaar Card, Voter ID, Passport, or PAN Card of the person applying on behalf of the commercial entity.',
    category: 'mandatory',
    officialBasis: 'Required to verify the applicant is a legal adult carrying civil accountability.'
  },
  {
    id: 'doc-occupancy',
    title: 'Proof of Legal Occupancy of Business Premises',
    description: 'If owned: Latest Property Tax Assessment Receipt / Sanctioned Building Plan. If leased/rented: Registered Lease/Rent Agreement along with Landlord\'s Property Tax Receipt and Owner Consent/NOC.',
    category: 'mandatory',
    officialBasis: 'Municipalities mandate proof of lawful possession before granting commercial permission.'
  },
  {
    id: 'doc-utility',
    title: 'Utility Bill of Commercial Premises',
    description: 'Latest Electricity Bill or Water Bill for the trade premises (in applicant\'s or property owner\'s name).',
    category: 'mandatory',
    officialBasis: 'Establishes active physical existence and premises identification in the municipal grid.'
  },
  {
    id: 'doc-entity',
    title: 'Entity Constitution & Registration Document',
    description: 'Proprietorship: Self-declaration with PAN. Partnership: Registered Partnership Deed. Company/LLP: Certificate of Incorporation (CIN/LLPIN), MOA, AOA, and Board Resolution authorising applicant.',
    category: 'mandatory',
    officialBasis: 'Identifies the taxable commercial entity responsible for compliance.'
  },
  {
    id: 'doc-keyplan',
    title: 'Premises Key Plan / Dimensioned Layout Sketch',
    description: 'Rough or architect-certified sketch displaying carpet area (in sq. ft. or sq. m.), entrance, emergency exits, and boundary dimensions.',
    category: 'mandatory',
    officialBasis: 'Used by the municipal assessor to compute the exact area-based licence fee.'
  }
];

export const CONDITIONAL_DOCUMENTS = [
  {
    id: 'doc-fire',
    title: 'Fire Safety Certificate / Fire NOC',
    condition: 'Applicable for restaurants, banquet halls, hotels, schools, cinema halls, inflammable storage, or premises exceeding municipal carpet area thresholds (typically 500+ sq. ft.).',
    description: 'No Objection Certificate issued by the Chief Fire Officer (CFO) of the local State Fire Service.',
    category: 'conditional'
  },
  {
    id: 'doc-pollution',
    title: 'State Pollution Control Board Consent (CTE / CTO)',
    condition: 'Applicable for manufacturing, industrial fabrication, automobile repair workshops, chemical processing, and polluting trades under Red/Orange/Green categories.',
    description: 'Consent to Establish (CTE) or Consent to Operate (CTO) issued by the State Pollution Control Board / DPCC.',
    category: 'conditional'
  },
  {
    id: 'doc-fssai',
    title: 'FSSAI Registration / Food Safety Licence',
    condition: 'Mandatory for all food handling businesses, restaurants, sweetshops, bakeries, cafes, and grocery stores selling edible items.',
    description: 'Registration or State/Central Licence issued by Food Safety and Standards Authority of India.',
    category: 'conditional'
  },
  {
    id: 'doc-police',
    title: 'Police Clearance / Entertainment Licence',
    condition: 'Applicable for cinema halls, lodging houses, amusement parks, gaming arcades, and late-night commercial activities.',
    description: 'Clearance certificate from the jurisdictional Police Commissioner / Superintendent of Police.',
    category: 'conditional'
  },
  {
    id: 'doc-structural',
    title: 'Structural Stability & Machine Horsepower Certificate',
    condition: 'Applicable where electric motors, generators, heavy machineries, or boilers are installed.',
    description: 'Certificate from a chartered structural engineer confirming the building can withstand machinery vibrations.',
    category: 'conditional'
  }
];

export const OPTIONAL_DOCUMENTS = [
  {
    id: 'doc-udyam',
    title: 'Udyam MSME Registration Certificate',
    description: 'Zero-fee central MSME certificate. Often facilitates concession or priority processing under state Ease of Doing Business policies.',
    category: 'optional'
  },
  {
    id: 'doc-gstin',
    title: 'Goods and Services Tax (GSTIN) Certificate',
    description: 'Helpful for commercial identity verification, though only mandatory when business turnover crosses statutory GST thresholds.',
    category: 'optional'
  },
  {
    id: 'doc-prev-licence',
    title: 'Previous Year Trade Licence Copy',
    description: 'Mandatory for renewal applications, but strictly optional / not applicable for new business applications.',
    category: 'optional'
  }
];

export const ORDERED_JOURNEY_STAGES = [
  {
    stage: 1,
    title: 'Premises Land-Use & Master Plan Permissibility Check',
    description: 'Verify that your commercial activity is legally permitted on the specific street or zone under the City Master Plan (commercial zone, notified mixed-use road, or local commercial center).',
    dateLabel: 'Pre-check Date',
    milestone: 'Zoning clearance confirmed before signing leases or investing capital.'
  },
  {
    stage: 2,
    title: 'Jurisdiction Identification & Municipal Portal Onboarding',
    description: 'Identify the exact Urban Local Body (ULB) governing the location and register on the official portal with applicant mobile and email.',
    dateLabel: 'Application Date',
    milestone: 'User profile created on official municipal portal.'
  },
  {
    stage: 3,
    title: 'Application Submission & Provisional Acknowledgement',
    description: 'Fill in trade schedule category, carpet area, and motor HP; upload mandatory and applicable conditional documents. Receive a formal system acknowledgement number.',
    dateLabel: 'Acknowledgement Date',
    milestone: 'Formal tracking token and provisional reference number generated.'
  },
  {
    stage: 4,
    title: 'Departmental Scrutiny & Field Site Inspection',
    description: 'Depending on jurisdiction and trade risk, the Sanitary Inspector (SI) or Junior Engineer (JE) schedules an on-site visit to inspect fire safety, hygiene, and measurements.',
    dateLabel: 'Appointment / Inspection Date',
    milestone: 'Physical inspection completed or self-certification cleared under EODB.'
  },
  {
    stage: 5,
    title: 'Statutory Verification & Final Scrutiny Approval',
    description: 'The Zonal Health Officer / Licensing Officer reviews the inspection report and document bundle, endorsing the final fee assessment.',
    dateLabel: 'Verification Date',
    milestone: 'Departmental sign-off and fee demand note issued.'
  },
  {
    stage: 6,
    title: 'Statutory Fee Payment, Licence Issuance & Annual Renewal',
    description: 'Pay the assessed municipal fee via the official payment gateway. Download the QR-coded, digitally signed Trade Licence, frame it at shop entrance, and observe the annual renewal cycle.',
    dateLabel: 'Issue Date & Validity / Renewal Dates',
    milestone: 'Official Trade Licence active; mandatory display at premises.'
  }
];
