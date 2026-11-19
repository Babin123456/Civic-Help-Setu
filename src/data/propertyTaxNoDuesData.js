/**
 * Property Tax No-Dues Certificate & Payment Receipt Guide Dataset
 *
 * Grounded in state municipal corporation statutes, urban local body (ULB) rules,
 * official municipal revenue portals, and citizen service charters across India.
 *
 * Official Primary Portals:
 * - Municipal Corporation of Delhi (MCD): https://mcdonline.nic.in
 * - Bruhat Bengaluru Mahanagara Palike (BBMP): https://bbmptax.karnataka.gov.in
 * - Brihanmumbai Municipal Corporation (BMC / MCGM): https://ptaxportal.mcgm.gov.in
 * - Greater Chennai Corporation (GCC): https://chennaicorporation.gov.in
 * - Kolkata Municipal Corporation (KMC): https://www.kmcgov.in
 * - Greater Hyderabad Municipal Corporation (GHMC): https://www.ghmc.gov.in
 * - Ahmedabad Municipal Corporation (AMC): https://ahmedabadcity.gov.in
 * - Pune Municipal Corporation (PMC): https://propertytax.punecorporation.org
 */

import { INDIAN_STATES_AND_UTS } from './jurisdictions';

export { INDIAN_STATES_AND_UTS };

export const PROPERTY_TAX_CORE_DEFINITIONS = [
  {
    id: 'def-property-tax',
    title: 'What is Property Tax?',
    badge: 'Municipal Levy',
    summary:
      'Property tax is a recurrent annual or semi-annual local tax imposed by municipal bodies (Corporations, Municipalities, Town Panchayats, or Cantonment Boards) on real estate owners. It funds vital local civic infrastructure including roads, storm-water drainage, street lighting, public sanitation, and solid waste management.',
    keyPoints: [
      'Statutory obligation under state municipal corporation and urban local body acts.',
      'Assessed based on annual rental value (ARV), capital value, or unit area value (UAV) method depending on the city.',
      'Mandatory for residential, commercial, industrial, and institutional holdings within municipal limits.'
    ]
  },
  {
    id: 'def-payment-receipt',
    title: 'What is a Property Tax Payment Receipt?',
    badge: 'Transaction Record',
    summary:
      'A payment receipt is an official financial voucher issued immediately by the municipal treasury or authorized bank acknowledging the receipt of a specific payment sum toward property tax for a defined financial period.',
    keyPoints: [
      'Proves that money was remitted on a specific date via a specific transaction mode (UPI, Net Banking, Challan, DD).',
      'Contains receipt number, G8 challan/UTR reference, amount received, and the specific assessment half-year or year credited.',
      'Does NOT verify that historical arrears, pending interest, or earlier unassessed financial years are completely clear.'
    ]
  },
  {
    id: 'def-no-dues-cert',
    title: 'What is a Property Tax No-Dues Certificate (NOC)?',
    badge: 'Legal Clearance',
    summary:
      'A No-Dues Certificate (also called Nil-Dues Certificate, Tax Clearance Certificate, or Municipal No-Objection Certificate) is a formal statutory confirmation issued by the municipal revenue or assessment department certifying that as of a specific date, no outstanding taxes, arrears, cess, surcharge, or penalty remain unpaid against the property identifier.',
    keyPoints: [
      'Verifies the entire historical account of the property, not just a single transaction.',
      'Issued after administrative ledger reconciliation or automated ledger audit across all applicable financial years.',
      'Frequently demanded by banks for housing loan mortgages, by buyers during property transactions, and by town planning for building sanctions.'
    ]
  },
  {
    id: 'def-receipt-vs-nodues',
    title: 'Why Receipts and No-Dues Certificates are NOT Interchangeable',
    badge: 'Critical Distinction',
    summary:
      'A payment receipt proves a transaction took place; a No-Dues Certificate confirms that the property has zero unpaid liability in the municipal ledger. Presenting a recent payment receipt does not guarantee that older arrears or penalties do not exist.',
    keyPoints: [
      'Receipt: Confirms "₹X was paid on Date Y for Year Z".',
      'No-Dues Certificate: Confirms "Zero dues remain outstanding across all years as on Date Y".',
      'A receipt cannot substitute for an NOC when a financial institution, court, or planning department specifically mandates a Nil-Dues Certificate.'
    ]
  },
  {
    id: 'def-title-disclaimer',
    title: 'What Neither Document Establishes: Ownership & Legal Title',
    badge: 'Statutory Disclaimer',
    summary:
      'Neither a property tax payment receipt nor a No-Dues Certificate creates, confers, or proves lawful legal ownership, marketable title, or proprietary right over the land or building.',
    keyPoints: [
      'Property tax is an fiscal assessment on occupancy or rateable holding; it is not title adjudication.',
      'Ownership is established solely through registered transfer instruments (Sale Deed, Gift Deed, Relinquishment Deed) and revenue title records (Patta, Record of Rights, Jamabandi, Land Mutation Register).',
      'Payment of property tax on an unauthorized or encroached construction does NOT regularize the violation or prevent municipal demolition under town planning laws.'
    ]
  }
];

export const WHY_CITIZENS_NEED_CERTIFICATE = [
  {
    id: 'reason-sale-purchase',
    title: 'Property Sale and Title Conveyance',
    icon: 'Building',
    description:
      'Prospective buyers and conveyancing advocates insist on a No-Dues Certificate to ensure they do not inherit historical tax liabilities, which by law attach as a charge on the property.'
  },
  {
    id: 'reason-home-loan',
    title: 'Home Loan, Mortgage & Refinancing',
    icon: 'CreditCard',
    description:
      'Scheduled commercial banks and housing finance companies require a certified No-Dues status as part of legal technical clearance before disbursing loan tranches.'
  },
  {
    id: 'reason-mutation',
    title: 'Khata Transfer & Municipal Mutation',
    icon: 'FileCheck',
    description:
      'Updating the municipal assessment register (Mutation / Khata transfer) upon inheritance, purchase, or partition requires clearance of all outstanding property taxes up to the current quarter.'
  },
  {
    id: 'reason-building-plan',
    title: 'Sanction of Building Plan & Addition Permits',
    icon: 'Layers',
    description:
      'Urban planning and building development authorities require proof of zero municipal property tax arrears before issuing sanction for new construction or additional floor expansion.'
  },
  {
    id: 'reason-utilities',
    title: 'Commercial Electricity & Water Sewerage Connections',
    icon: 'Zap',
    description:
      'Distribution companies (DISCOMs) and water sewerage boards mandate an updated tax receipt or No-Dues Certificate prior to releasing new or enhanced service loads.'
  },
  {
    id: 'reason-trade-licence',
    title: 'Municipal Trade & Commercial Licencing',
    icon: 'Briefcase',
    description:
      'Obtaining or renewing a Municipal Trade Licence or Health Licencing requires proof of paid property tax for the commercial unit.'
  }
];

export const JURISDICTION_PROPERTY_TAX_DATA = [
  {
    id: 'delhi-mcd',
    state: 'Delhi',
    district: 'All Delhi Districts',
    ulb: 'Municipal Corporation of Delhi (MCD)',
    issuingDepartment: 'Assessment & Collection Department',
    statutoryAct: 'Delhi Municipal Corporation Act, 1957 (Sections 113, 114, 123D)',
    officialPortal: {
      label: 'MCD Online Property Tax Portal',
      url: 'https://mcdonline.nic.in'
    },
    propertyIdentifierLabel: 'Unique Property Identification Code (UPIC)',
    propertyIdentifierHint: 'A unique alphanumeric UPIC assigned to the property or previous property tax receipt number.',
    certificateAvailable: 'available_online',
    certificateServiceName: 'MCD Property Tax No-Dues Certificate / Clearance Status',
    eligibility: [
      'Registered property owner or lawful occupant whose name appears in MCD assessment record.',
      'Authorized representative with registered General/Special Power of Attorney or authorization letter.',
      'All principal property tax, education cess, and solid waste management charges cleared up to current assessment year.',
      'Zero outstanding dishonoured cheque penalties, interest under Section 152, or disputed warrants of distress.'
    ],
    requiredDocuments: [
      {
        id: 'doc-mcd-upic',
        name: 'UPIC (Unique Property Identification Code) or Property Assessment ID',
        category: 'required',
        whyNeeded: 'Mandatory key to query property ledger records in the MCD centralized property tax system.',
        officialSource: 'MCD Assessment & Collection Department Guidelines',
        jurisdiction: 'Municipal Corporation of Delhi (MCD)'
      },
      {
        id: 'doc-mcd-last-receipt',
        name: 'Latest Property Tax Paid Receipt / G8 Challan',
        category: 'required',
        whyNeeded: 'Verifies the most recent payment transaction ID, date, and credited financial year.',
        officialSource: 'DMC Act 1957 Section 123D',
        jurisdiction: 'Municipal Corporation of Delhi (MCD)'
      },
      {
        id: 'doc-mcd-id-proof',
        name: 'Government Photo ID of Applicant (Aadhaar / Voter ID / PAN / Passport)',
        category: 'required',
        whyNeeded: 'Confirms the identity of the applying taxpayer or authorized representative.',
        officialSource: 'MCD Citizen Charter',
        jurisdiction: 'Municipal Corporation of Delhi (MCD)'
      }
    ],
    optionalDocuments: [
      {
        id: 'doc-mcd-ownership',
        name: 'Registered Sale Deed / Conveyance Deed / Title Deed',
        category: 'conditional',
        whyNeeded: 'Required if ownership name in MCD ledger has not yet been updated via mutation.',
        officialSource: 'MCD Property Mutation Guidelines',
        jurisdiction: 'Municipal Corporation of Delhi (MCD)'
      },
      {
        id: 'doc-mcd-poa',
        name: 'Power of Attorney / Written Owner Authorization Letter',
        category: 'conditional',
        whyNeeded: 'Required when an agent, advocate, or family representative applies on behalf of the registered owner.',
        officialSource: 'MCD Citizen Charter',
        jurisdiction: 'Municipal Corporation of Delhi (MCD)'
      },
      {
        id: 'doc-mcd-legal-heir',
        name: 'Death Certificate & Legal Heir Certificate / Surviving Member Certificate',
        category: 'conditional',
        whyNeeded: 'Mandatory if the registered owner is deceased and legal heirs are seeking tax clearance.',
        officialSource: 'Revenue Department, Govt of NCT of Delhi',
        jurisdiction: 'Municipal Corporation of Delhi (MCD)'
      }
    ],
    onlineSteps: [
      'Visit the official MCD portal at https://mcdonline.nic.in and select your administrative zone.',
      'Navigate to "Property Tax (PTR)" and log in with your registered mobile number using OTP.',
      'Select "Search Property by UPIC / Property ID" or search using owner name and colony.',
      'Review the displayed demand: check current assessment year, arrear demands, rebates, and interest.',
      'If outstanding balance exists, click "Pay Property Tax" and complete payment via authorized Net Banking, Debit/Credit Card, or UPI gateway.',
      'Immediately download the digitally generated Property Tax Payment Receipt bearing G8 Challan and QR code.',
      'Click on "Generate Property Tax No-Dues Certificate" under the Property Services menu.',
      'The portal validates zero ledger balance across all years and renders the digitally signed MCD No-Dues Certificate for download.'
    ],
    offlineSteps: [
      'Visit the Zonal Assessment & Collection Department office of your MCD zone (e.g., South, Central, West, Shahdara, City SP).',
      'Obtain and complete the Property Tax Verification / No-Dues Request Form from the Citizen Facilitation Centre (CFC).',
      'Submit copies of latest paid receipt, UPIC allotment slip, and applicant photo ID.',
      'The Zonal Inspector / Dealing Assistant verifies physical ledger and system entries for any unresolved court injunctions or arrears.',
      'Upon clearance of dues and manual ledger reconciliation, the Zonal Joint/Assistant Assessor issues the stamped No-Dues Certificate.'
    ],
    paymentInformation: {
      officialFee: 'No separate government fee for online No-Dues Certificate generation; standard tax dues and applicable cesses must be paid in full.',
      paymentMethods: [
        'Online: UPI (BHIM, Google Pay, PhonePe), Net Banking, RuPay/Visa/MasterCard Debit & Credit Cards on MCD portal',
        'Offline: Designated branches of Axis Bank / Canara Bank / HDFC Bank via system-generated offline challan, or Zonal Citizen Facilitation Centre cash/DD counter'
      ],
      processingTimeline: 'Instant download online upon zero ledger balance; 3 to 7 working days for manual zonal office application.'
    },
    certificateInformation: {
      applicationMethod: 'Online via mcdonline.nic.in or offline at MCD Zonal A&C Office.',
      collectionMethod: 'Direct PDF download with cryptographic signature and QR verification code.',
      validity: 'Valid up to the end of the current financial year or until a subsequent assessment demand is officially raised.'
    },
    grievanceInformation: {
      contact: 'MCD Property Tax Helpline: 155304 / 011-23227413, Email: mcd-ithelpdesk@mcd.nic.in',
      portal: 'https://mcdonline.nic.in/citizen/citizen-grievance'
    },
    sources: [
      {
        title: 'Delhi Municipal Corporation Act, 1957 (Sections 113-123D)',
        department: 'Legislative Department, Ministry of Law and Justice',
        url: 'https://mcdonline.nic.in',
        publicationDate: '1957-12-28',
        effectiveDate: '1958-04-07',
        lastVerified: '2026-11-18'
      },
      {
        title: 'MCD Assessment & Collection Department Citizens Charter',
        department: 'Assessment & Collection Department, MCD',
        url: 'https://mcdonline.nic.in',
        publicationDate: '2023-01-15',
        effectiveDate: '2023-01-15',
        lastVerified: '2026-11-18'
      }
    ],
    verificationStatus: 'verified'
  },
  {
    id: 'bengaluru-bbmp',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    ulb: 'Bruhat Bengaluru Mahanagara Palike (BBMP)',
    issuingDepartment: 'Revenue Department',
    statutoryAct: 'Bruhat Bengaluru Mahanagara Palike Act, 2020 / Karnataka Municipal Corporations Act, 1976 (Sections 108-112)',
    officialPortal: {
      label: 'BBMP Property Tax Portal / e-Aasthi',
      url: 'https://bbmptax.karnataka.gov.in'
    },
    propertyIdentifierLabel: 'SAS Application Number / PID (Property Identification Number)',
    propertyIdentifierHint: '10-digit SAS Base Application number or e-Aasthi 15-digit Property Identification Number.',
    certificateAvailable: 'available_online',
    certificateServiceName: 'BBMP Property Tax Clearance / SAS Nil Dues Extract',
    eligibility: [
      'Khatedar (registered owner) or occupant holding valid SAS PID.',
      'Authorized family member or representative with authorization slip.',
      'All property tax, solid waste cess, and library cess cleared up to the current assessment year.',
      'No pending difference tax demand arising from BBMP Total Station Survey (TSS) or GIS property audit.'
    ],
    requiredDocuments: [
      {
        id: 'doc-bbmp-pid',
        name: 'PID (Property Identification Number) or Previous 10-digit SAS Number',
        category: 'required',
        whyNeeded: 'Primary key to pull property tax demand notices and previous receipts from BBMP servers.',
        officialSource: 'BBMP Property Tax Citizens Charter',
        jurisdiction: 'Bruhat Bengaluru Mahanagara Palike (BBMP)'
      },
      {
        id: 'doc-bbmp-receipt',
        name: 'Latest SAS Property Tax Receipt (Form IV / Form V)',
        category: 'required',
        whyNeeded: 'Confirms payment made for the preceding assessment year.',
        officialSource: 'BBMP Revenue Rules',
        jurisdiction: 'Bruhat Bengaluru Mahanagara Palike (BBMP)'
      },
      {
        id: 'doc-bbmp-id',
        name: 'Applicant Photo Identity Proof',
        category: 'required',
        whyNeeded: 'Identity verification of applicant.',
        officialSource: 'Karnataka Sakala Services Act, 2011',
        jurisdiction: 'Bruhat Bengaluru Mahanagara Palike (BBMP)'
      }
    ],
    optionalDocuments: [
      {
        id: 'doc-bbmp-khata',
        name: 'BBMP Khata Certificate / Khata Extract (e-Khata)',
        category: 'conditional',
        whyNeeded: 'Required when verifying title lineage or applying for formal clearance certificate through ARO office.',
        officialSource: 'BBMP Revenue Department',
        jurisdiction: 'Bruhat Bengaluru Mahanagara Palike (BBMP)'
      },
      {
        id: 'doc-bbmp-deed',
        name: 'Registered Sale Deed / Title Document',
        category: 'conditional',
        whyNeeded: 'Needed if name update or bifurcation is pending in BBMP books.',
        officialSource: 'BBMP Citizens Charter',
        jurisdiction: 'Bruhat Bengaluru Mahanagara Palike (BBMP)'
      }
    ],
    onlineSteps: [
      'Visit https://bbmptax.karnataka.gov.in and click "Citizen Services".',
      'Select "Property Tax Payment / Search" and enter your 10-digit SAS Base Application No. or PID Number.',
      'Review the property ledger: verify owner name, zone, ward, plinth area, and assessment year.',
      'Check pending dues, arrears, solid waste management cess, and penal interest (2% per month on delayed payment).',
      'Click "Pay Online" via payment gateway (Net Banking, Card, UPI).',
      'Download the official BBMP Form IV / Form V e-Receipt immediately.',
      'Navigate to "Downloads" -> "Receipts & Nil-Dues Status" to retrieve your confirmed Nil-Dues ledger extract.',
      'For a formal printed certificate, submit the generated e-receipt to the Assistant Revenue Officer (ARO) of your sub-division under Karnataka Sakala Services Act.'
    ],
    offlineSteps: [
      'Visit your sub-divisional Assistant Revenue Officer (ARO) office with your PID details.',
      'Request tax assessment verification ledger at the citizen counter.',
      'Clear any pending arrears via BBMP challan at designated BengaluruOne centres or nationalized bank partner branches.',
      'Submit the paid challan copy to the Revenue Inspector for ledger entry.',
      'The ARO issues a verified Nil Dues Endorsement under the Karnataka Sakala Services Act.'
    ],
    paymentInformation: {
      officialFee: 'Nil for online status check; statutory Sakala application fee of ₹20 to ₹50 if applied through BangaloreOne centre for physical seal.',
      paymentMethods: [
        'Online: UPI, Debit/Credit Card, Net Banking on BBMP Tax portal',
        'Offline: DD or Cash challan at Canara Bank branches, BangaloreOne counters, or ARO helpdesks'
      ],
      processingTimeline: 'Instant online download; 7 to 14 working days under Karnataka Sakala Services Act for physical ARO certificate.'
    },
    certificateInformation: {
      applicationMethod: 'Online via bbmptax.karnataka.gov.in or BangaloreOne / ARO office.',
      collectionMethod: 'Direct PDF download or printed copy collected from BangaloreOne / ARO office.',
      validity: 'Valid for the financial year of issue (up to 31 March).'
    },
    grievanceInformation: {
      contact: 'BBMP Central Control Room: 080-22660000 / 080-22221188, Email: contactusbbmp@gmail.com',
      portal: 'https://bbmp.gov.in/grievance'
    },
    sources: [
      {
        title: 'Bruhat Bengaluru Mahanagara Palike Act, 2020',
        department: 'Urban Development Department, Government of Karnataka',
        url: 'https://bbmptax.karnataka.gov.in',
        publicationDate: '2020-12-18',
        effectiveDate: '2021-01-11',
        lastVerified: '2026-11-18'
      },
      {
        title: 'BBMP Citizens Charter - Property Tax Guidelines',
        department: 'Revenue Department, BBMP',
        url: 'https://bbmptax.karnataka.gov.in',
        publicationDate: '2024-04-01',
        effectiveDate: '2024-04-01',
        lastVerified: '2026-11-18'
      }
    ],
    verificationStatus: 'verified'
  },
  {
    id: 'mumbai-bmc',
    state: 'Maharashtra',
    district: 'Mumbai City & Mumbai Suburban',
    ulb: 'Brihanmumbai Municipal Corporation (BMC / MCGM)',
    issuingDepartment: 'Assessment & Collection Department',
    statutoryAct: 'Mumbai Municipal Corporation Act, 1888 (Sections 139, 140, 217)',
    officialPortal: {
      label: 'BMC Property Tax Citizen Portal',
      url: 'https://ptaxportal.mcgm.gov.in'
    },
    propertyIdentifierLabel: 'SAC Number (Section-Account-Code) / 15-digit Property Identification Code',
    propertyIdentifierHint: '15-character SAC number printed on top-left of previous MCGM property tax bills.',
    certificateAvailable: 'available_online',
    certificateServiceName: 'BMC Property Tax Clearance / No-Dues Certificate (NOC)',
    eligibility: [
      'Owner, Co-owner, Co-operative Housing Society (CHS) authorized representative, or occupier.',
      'All Capital Value based property tax, water benefit tax, education cess, and tree cess cleared in full.',
      'No pending special notices under Section 354 or pending attachment warrants issued by Assessor and Collector.'
    ],
    requiredDocuments: [
      {
        id: 'doc-bmc-sac',
        name: 'SAC (Section-Account-Code) / Property Account Number',
        category: 'required',
        whyNeeded: 'Essential identifier to fetch bill history and outstanding demand on BMC server.',
        officialSource: 'BMC Assessment & Collection Rules',
        jurisdiction: 'Brihanmumbai Municipal Corporation (BMC)'
      },
      {
        id: 'doc-bmc-receipt',
        name: 'Latest MCGM Property Tax Paid Receipt',
        category: 'required',
        whyNeeded: 'Verifies the most recent half-yearly instalment payment.',
        officialSource: 'MMC Act 1888 Section 140',
        jurisdiction: 'Brihanmumbai Municipal Corporation (BMC)'
      },
      {
        id: 'doc-bmc-id',
        name: 'Identity Proof of Applicant / Co-operative Housing Society Letter',
        category: 'required',
        whyNeeded: 'Confirms locus standi of applicant.',
        officialSource: 'Maharashtra Right to Public Services Act, 2015',
        jurisdiction: 'Brihanmumbai Municipal Corporation (BMC)'
      }
    ],
    optionalDocuments: [
      {
        id: 'doc-bmc-property-card',
        name: 'City Survey Property Card (Malmatta Patrak)',
        category: 'conditional',
        whyNeeded: 'Required for land parcels or when dispute on rateable value or plot boundary exists.',
        officialSource: 'Revenue & Forest Department, Maharashtra',
        jurisdiction: 'Brihanmumbai Municipal Corporation (BMC)'
      },
      {
        id: 'doc-bmc-chs-noc',
        name: 'Co-operative Housing Society NOC / Managing Committee Resolution',
        category: 'conditional',
        whyNeeded: 'Required if flat/unit is part of a CHS where property tax is billed collectively.',
        officialSource: 'Maharashtra Co-operative Societies Act, 1960',
        jurisdiction: 'Brihanmumbai Municipal Corporation (BMC)'
      }
    ],
    onlineSteps: [
      'Visit https://ptaxportal.mcgm.gov.in and click "Citizen Portal".',
      'Enter the 15-digit SAC Property Account Number and complete the captcha verification.',
      'View the outstanding demand ledger: check first-half and second-half assessment dues, arrears, and penalty interest.',
      'If dues are pending, click "Make Online Payment" and pay via State Bank of India / BillDesk gateway.',
      'Download and print the official digitally signed BMC Property Tax Receipt.',
      'Select "No-Dues Certificate" from the left navigation menu.',
      'System conducts automated zero-arrears audit and prompts for applicant details.',
      'Download the official BMC No-Dues Certificate carrying the QR code and digital verification signature.'
    ],
    offlineSteps: [
      'Visit your respective BMC Ward Office (Ward A through T) and proceed to the Citizen Facilitation Centre (CFC).',
      'Submit the No-Dues Application Form along with copies of previous receipts and SAC details.',
      'The Ward Assessor & Collector staff checks for any trailing water/sewerage surcharges or legal attachments.',
      'Pay any residual reconciliation dues at the CFC cash/DD counter.',
      'Collect the signed and stamped No-Dues Certificate within the timeframe stipulated under the Maharashtra Right to Public Services Act.'
    ],
    paymentInformation: {
      officialFee: 'No fee for online ledger verification; nominal search fee of ₹50 to ₹100 may apply for certified historical extracts at ward office.',
      paymentMethods: [
        'Online: UPI, Net Banking, Credit/Debit cards via MCGM Payment Gateway',
        'Offline: Cash up to statutory limits, Demand Draft, or Pay Order payable to "Brihanmumbai Mahanagarpalika" at Ward CFC'
      ],
      processingTimeline: 'Immediate online download upon ledger clearance; 7 to 15 working days at ward office under Maharashtra Right to Public Services Act.'
    },
    certificateInformation: {
      applicationMethod: 'Online via ptaxportal.mcgm.gov.in or offline at Ward Office CFC.',
      collectionMethod: 'Instant PDF download with QR code or counter pickup at Ward CFC.',
      validity: 'Valid up to the end of the ongoing half-year or financial year.'
    },
    grievanceInformation: {
      contact: 'BMC Disaster Management & Citizen Helpline: 1916 / 022-22694725, Email: mcgm@mcgm.gov.in',
      portal: 'https://portal.mcgm.gov.in'
    },
    sources: [
      {
        title: 'Mumbai Municipal Corporation Act, 1888',
        department: 'Urban Development Department, Government of Maharashtra',
        url: 'https://ptaxportal.mcgm.gov.in',
        publicationDate: '1888-09-14',
        effectiveDate: '1888-09-14',
        lastVerified: '2026-11-18'
      },
      {
        title: 'BMC Citizens Charter - Property Tax Assessment & Collection',
        department: 'Assessment & Collection Department, BMC',
        url: 'https://ptaxportal.mcgm.gov.in',
        publicationDate: '2023-04-01',
        effectiveDate: '2023-04-01',
        lastVerified: '2026-11-18'
      }
    ],
    verificationStatus: 'verified'
  },
  {
    id: 'chennai-gcc',
    state: 'Tamil Nadu',
    district: 'Chennai',
    ulb: 'Greater Chennai Corporation (GCC)',
    issuingDepartment: 'Revenue Department',
    statutoryAct: 'Tamil Nadu Urban Local Bodies Act, 1998 & Rules 2023 / Chennai City Municipal Corporation Act, 1919 (Sections 98-103)',
    officialPortal: {
      label: 'Greater Chennai Corporation Property Tax Portal',
      url: 'https://chennaicorporation.gov.in'
    },
    propertyIdentifierLabel: '15-digit New Property Tax Assessment Number (Zone / Division / Bill No)',
    propertyIdentifierHint: 'Format: Zone (2 digits) / Division (3 digits) / Bill No (5 digits) / Sub No (3 digits).',
    certificateAvailable: 'available_online',
    certificateServiceName: 'GCC Property Tax Clearance / Paid Status Extract',
    eligibility: [
      'Property assessee / titleholder registered in GCC Revenue Records.',
      'Legal representative or authorized tenant with consent.',
      'Full payment of Half-Yearly Property Tax (1st Half: April-September; 2nd Half: October-March).',
      'No pending penal interest under Tamil Nadu Urban Local Bodies Rules, 2023.'
    ],
    requiredDocuments: [
      {
        id: 'doc-gcc-bill-no',
        name: 'Zone, Division, and Bill Number (15-digit Assessment Number)',
        category: 'required',
        whyNeeded: 'Unique key required to query GCC Property Tax Database.',
        officialSource: 'GCC Revenue Department Guidelines',
        jurisdiction: 'Greater Chennai Corporation (GCC)'
      },
      {
        id: 'doc-gcc-last-receipt',
        name: 'Latest Half-Yearly Property Tax Receipt',
        category: 'required',
        whyNeeded: 'Validates latest payment credit.',
        officialSource: 'TN ULB Act 1998',
        jurisdiction: 'Greater Chennai Corporation (GCC)'
      },
      {
        id: 'doc-gcc-id',
        name: 'Government Photo ID of Applicant',
        category: 'required',
        whyNeeded: 'Confirms identity of applicant.',
        officialSource: 'GCC Citizen Charter',
        jurisdiction: 'Greater Chennai Corporation (GCC)'
      }
    ],
    optionalDocuments: [
      {
        id: 'doc-gcc-patta',
        name: 'Town Survey Land Register (TSLR) Extract / Patta',
        category: 'conditional',
        whyNeeded: 'Required if ownership mutation or name transfer in corporation records is pending.',
        officialSource: 'Revenue Department, Government of Tamil Nadu',
        jurisdiction: 'Greater Chennai Corporation (GCC)'
      },
      {
        id: 'doc-gcc-sale-deed',
        name: 'Registered Sale Deed / Title Document',
        category: 'conditional',
        whyNeeded: 'Required for new assessment or discrepancy in plinth area calculation.',
        officialSource: 'GCC Revenue Department',
        jurisdiction: 'Greater Chennai Corporation (GCC)'
      }
    ],
    onlineSteps: [
      'Visit the official GCC portal at https://chennaicorporation.gov.in and click "Online Services" -> "Property Tax".',
      'Click on "Property Tax Online Payment / Dues Status".',
      'Select your Zone Number, Division Code, and enter your Bill Number.',
      'Examine the demand table: check current half-year tax, library cess, education cess, and any accumulated arrears.',
      'If dues are indicated, click "Pay Property Tax" and pay via Net Banking, Debit/Credit Card, or UPI gateway.',
      'Download your official computerized payment receipt containing the Corporation transaction ID and barcode.',
      'Click on "Property Tax Status & No-Dues Certificate" to view the zero-dues confirmation extract.',
      'Download the printable ledger statement verifying that all half-yearly dues up to the current assessment period are cleared.'
    ],
    offlineSteps: [
      'Visit the Zonal Assistant Revenue Officer (ARO) office of your respective GCC zone (Zones 1 through 15).',
      'Present your assessment bill number and copies of past receipts.',
      'Revenue Assistant inspects the demand collection balance (DCB) register.',
      'Pay outstanding amounts if any at the e-Seva counter or designated Indian Bank / Canara Bank counters.',
      'The ARO issues a verified Dues Clearance Endorsement on the official Corporation letterhead.'
    ],
    paymentInformation: {
      officialFee: 'No fee for online clearance extract generation; statutory dues must be settled in full.',
      paymentMethods: [
        'Online: UPI, Net Banking, Credit/Debit Cards on GCC official portal',
        'Offline: e-Seva centres in Chennai, designated bank counters, or GCC Tax Collector POS machine'
      ],
      processingTimeline: 'Immediate online status; 7 to 15 working days for manual ARO certificate.'
    },
    certificateInformation: {
      applicationMethod: 'Online via chennaicorporation.gov.in or Zonal ARO Office.',
      collectionMethod: 'Direct PDF download or collection from Zonal Office.',
      validity: 'Valid up to the end of the ongoing half-year period (30 September or 31 March).'
    },
    grievanceInformation: {
      contact: 'GCC Public Grievance Helpline: 1913, Phone: 044-25619206, Email: commissioner@chennaicorporation.gov.in',
      portal: 'https://chennaicorporation.gov.in/gcc/grievance/'
    },
    sources: [
      {
        title: 'Tamil Nadu Urban Local Bodies Act, 1998 & Rules 2023',
        department: 'Municipal Administration and Water Supply Department, Tamil Nadu',
        url: 'https://chennaicorporation.gov.in',
        publicationDate: '1998-08-20',
        effectiveDate: '2023-04-13',
        lastVerified: '2026-11-18'
      },
      {
        title: 'Greater Chennai Corporation Citizens Charter',
        department: 'Revenue Department, GCC',
        url: 'https://chennaicorporation.gov.in',
        publicationDate: '2023-05-01',
        effectiveDate: '2023-05-01',
        lastVerified: '2026-11-18'
      }
    ],
    verificationStatus: 'verified'
  },
  {
    id: 'kolkata-kmc',
    state: 'West Bengal',
    district: 'Kolkata',
    ulb: 'Kolkata Municipal Corporation (KMC)',
    issuingDepartment: 'Assessment-Collection Department',
    statutoryAct: 'Kolkata Municipal Corporation Act, 1980 (Sections 170-183)',
    officialPortal: {
      label: 'KMC e-Services Citizen Portal',
      url: 'https://www.kmcgov.in'
    },
    propertyIdentifierLabel: '10-digit Assessee Number',
    propertyIdentifierHint: '10-digit Assessee Number printed on top of previous KMC quarterly tax bills.',
    certificateAvailable: 'available_online',
    certificateServiceName: 'KMC Assessment Clearance / Outstanding Dues Certificate',
    eligibility: [
      'Assessee recorded in KMC Assessment-Collection records.',
      'Authorized legal representative with written proxy.',
      'Payment of all four quarterly tax demands (Q1, Q2, Q3, Q4) and commercial surcharges.',
      'Settlement of all pending Hearing / General Valuation revision disputes.'
    ],
    requiredDocuments: [
      {
        id: 'doc-kmc-assessee-no',
        name: '10-digit Assessee Number & Ward Number',
        category: 'required',
        whyNeeded: 'Unique account identifier in KMC revenue database.',
        officialSource: 'KMC Assessment & Collection Rules',
        jurisdiction: 'Kolkata Municipal Corporation (KMC)'
      },
      {
        id: 'doc-kmc-receipt',
        name: 'Latest Quarterly Paid Property Tax Receipt / Counterfoil',
        category: 'required',
        whyNeeded: 'Verifies the most recent quarterly instalment payment.',
        officialSource: 'KMC Act 1980 Section 171',
        jurisdiction: 'Kolkata Municipal Corporation (KMC)'
      },
      {
        id: 'doc-kmc-id',
        name: 'Applicant Photo Identity Document',
        category: 'required',
        whyNeeded: 'Confirms identity of applicant.',
        officialSource: 'KMC Citizen Charter',
        jurisdiction: 'Kolkata Municipal Corporation (KMC)'
      }
    ],
    optionalDocuments: [
      {
        id: 'doc-kmc-deed',
        name: 'Registered Title Deed / Mutation Certificate',
        category: 'conditional',
        whyNeeded: 'Required when seeking certificate in the name of a new transferee.',
        officialSource: 'KMC Assessment Rules',
        jurisdiction: 'Kolkata Municipal Corporation (KMC)'
      },
      {
        id: 'doc-kmc-hearing',
        name: 'General Valuation Hearing Order Sheet',
        category: 'conditional',
        whyNeeded: 'Required if premises recently underwent Annual Valuation revision.',
        officialSource: 'KMC Hearing Department',
        jurisdiction: 'Kolkata Municipal Corporation (KMC)'
      }
    ],
    onlineSteps: [
      'Visit https://www.kmcgov.in and click "Online Services" -> "Property Tax".',
      'Select "Assessment Collection (PT) - Demand & Payment".',
      'Enter your 10-digit Assessee Number and verify property details (Ward, Street, Premises No).',
      'Review the quarterly demand schedule: inspect current quarter bills, interest, and pending penalty.',
      'Click "Pay Online" and pay through State Bank of India ePay or integrated payment gateway.',
      'Download your official KMC e-Receipt with digital signature.',
      'Navigate to "Property Tax" -> "Outstanding Dues Certificate / Status".',
      'Download the certified Nil Outstanding Ledger confirmation.'
    ],
    offlineSteps: [
      'Visit your Borough Executive Health & Assessment Office or KMC Headquarters at 5, S.N. Banerjee Road, Kolkata.',
      'Submit the prescribed requisition letter for Assessment Clearance along with copies of last 3 years paid bills.',
      'The Assessor-Collector verifies the inspection ledger for supplementary bills or unassessed additions.',
      'Pay any reconciliation dues at the KMC treasury counter.',
      'The Assessor-Collector issues the official stamped Assessment Clearance Certificate.'
    ],
    paymentInformation: {
      officialFee: 'No fee for online status check; prescribed statutory search fee applies for certified historical extracts under Section 199.',
      paymentMethods: [
        'Online: UPI, Net Banking, Credit/Debit cards on KMC portal',
        'Offline: Cash or DD at KMC Borough Treasury counters or e-Kolkata Citizen Facilitation Kiosks'
      ],
      processingTimeline: 'Instant online verification; 10 to 20 working days for manual Borough Office certificate.'
    },
    certificateInformation: {
      applicationMethod: 'Online via kmcgov.in or offline at Borough Assessment Office.',
      collectionMethod: 'Direct PDF download or collection from Borough Office counter.',
      validity: 'Valid for the ongoing quarter or financial year.'
    },
    grievanceInformation: {
      contact: 'KMC Control Room Helpline: 033-22861212 / 033-22861414, Email: mayor@kmcgov.in',
      portal: 'https://www.kmcgov.in'
    },
    sources: [
      {
        title: 'Kolkata Municipal Corporation Act, 1980',
        department: 'Urban Development & Municipal Affairs Department, West Bengal',
        url: 'https://www.kmcgov.in',
        publicationDate: '1980-12-29',
        effectiveDate: '1984-01-04',
        lastVerified: '2026-11-18'
      },
      {
        title: 'KMC Citizens Charter - Assessment & Collection Department',
        department: 'Assessment & Collection Department, KMC',
        url: 'https://www.kmcgov.in',
        publicationDate: '2023-01-01',
        effectiveDate: '2023-01-01',
        lastVerified: '2026-11-18'
      }
    ],
    verificationStatus: 'verified'
  },
  {
    id: 'hyderabad-ghmc',
    state: 'Telangana',
    district: 'Hyderabad',
    ulb: 'Greater Hyderabad Municipal Corporation (GHMC)',
    issuingDepartment: 'Revenue Wing',
    statutoryAct: 'Greater Hyderabad Municipal Corporation Act, 1955 (Sections 197-212)',
    officialPortal: {
      label: 'GHMC Property Tax Online Portal',
      url: 'https://www.ghmc.gov.in'
    },
    propertyIdentifierLabel: '10-digit PTIN (Property Tax Identification Number)',
    propertyIdentifierHint: '10-digit PTIN assigned by GHMC to each assessed property door number.',
    certificateAvailable: 'available_online',
    certificateServiceName: 'GHMC Property Tax No-Dues Certificate / Dues Clearance Status',
    eligibility: [
      'Recorded property owner or legal occupant holding valid PTIN.',
      'Authorized representative with valid KYC proof.',
      'Payment of both half-yearly property tax installments, library cess, and interest.',
      'No pending unauthorized floor addition notices under GHMC Act Section 452.'
    ],
    requiredDocuments: [
      {
        id: 'doc-ghmc-ptin',
        name: '10-digit PTIN (Property Tax Identification Number)',
        category: 'required',
        whyNeeded: 'Unique key to query GHMC property assessment ledger.',
        officialSource: 'GHMC Revenue Wing Guidelines',
        jurisdiction: 'Greater Hyderabad Municipal Corporation (GHMC)'
      },
      {
        id: 'doc-ghmc-receipt',
        name: 'Latest GHMC Property Tax Payment Receipt',
        category: 'required',
        whyNeeded: 'Verifies the most recent half-year payment.',
        officialSource: 'GHMC Act 1955',
        jurisdiction: 'Greater Hyderabad Municipal Corporation (GHMC)'
      },
      {
        id: 'doc-ghmc-id',
        name: 'Applicant Photo ID (Aadhaar / Voter ID / Driving Licence)',
        category: 'required',
        whyNeeded: 'Proof of applicant identity.',
        officialSource: 'Telangana Citizen Service Charter',
        jurisdiction: 'Greater Hyderabad Municipal Corporation (GHMC)'
      }
    ],
    optionalDocuments: [
      {
        id: 'doc-ghmc-deed',
        name: 'Registered Sale Deed / Title Deed',
        category: 'conditional',
        whyNeeded: 'Required if PTIN ownership name has not yet been mutated via Dharani / MeeSeva.',
        officialSource: 'GHMC Town Planning & Revenue',
        jurisdiction: 'Greater Hyderabad Municipal Corporation (GHMC)'
      }
    ],
    onlineSteps: [
      'Visit https://www.ghmc.gov.in and click "Online Payments" -> "Property Tax".',
      'Enter your 10-digit PTIN number and registered mobile number.',
      'Verify displayed details: Owner Name, Door Number, Locality, Circle, and Ward.',
      'Review current year demand, arrears, library cess, and early bird rebate (if paying in April).',
      'Pay pending amount using Net Banking, Debit/Credit Card, or UPI on TS Online / BillDesk gateway.',
      'Download and print the official GHMC e-Receipt immediately.',
      'Click on "Property Tax Dues Search & No-Dues Certificate" on the GHMC portal.',
      'The portal checks for zero balance and generates the digitally verified GHMC No-Dues Certificate with QR code.'
    ],
    offlineSteps: [
      'Visit your respective GHMC Circle Office (Citizen Service Centre - CSC) or any MeeSeva centre.',
      'Provide your PTIN to the operator.',
      'Pay outstanding dues via cash or DD at the CSC counter.',
      'Request the operator to print the MeeSeva verified Property Tax Clearance Certificate.',
      'The Tax Inspector / Assistant Municipal Commissioner signs and stamps the document if required for court or bank verification.'
    ],
    paymentInformation: {
      officialFee: 'Zero fee on official GHMC portal; standard MeeSeva service charge of ₹35 to ₹45 applies if processed via physical MeeSeva kiosk.',
      paymentMethods: [
        'Online: UPI, Net Banking, Credit/Debit cards on GHMC portal',
        'Offline: Cash or DD at GHMC Circle CSCs, MeeSeva kiosks, or Citizen Facilitation Centres'
      ],
      processingTimeline: 'Instant online download; same day at MeeSeva centres upon ledger clearance.'
    },
    certificateInformation: {
      applicationMethod: 'Online via ghmc.gov.in or MeeSeva / GHMC Circle Office.',
      collectionMethod: 'Direct PDF download or MeeSeva printed certificate.',
      validity: 'Valid up to the end of the ongoing half-year or financial year.'
    },
    grievanceInformation: {
      contact: 'GHMC Central Helpline: 040-21111111, WhatsApp Grievance: 91-9985533330, Email: commissioner-ghmc@telangana.gov.in',
      portal: 'https://www.ghmc.gov.in/Grievance'
    },
    sources: [
      {
        title: 'Greater Hyderabad Municipal Corporation Act, 1955',
        department: 'Municipal Administration and Urban Development Department, Telangana',
        url: 'https://www.ghmc.gov.in',
        publicationDate: '1955-08-01',
        effectiveDate: '1955-08-01',
        lastVerified: '2026-11-18'
      },
      {
        title: 'GHMC Citizens Charter - Property Tax Administration',
        department: 'Revenue Wing, GHMC',
        url: 'https://www.ghmc.gov.in',
        publicationDate: '2023-04-01',
        effectiveDate: '2023-04-01',
        lastVerified: '2026-11-18'
      }
    ],
    verificationStatus: 'verified'
  },
  {
    id: 'ahmedabad-amc',
    state: 'Gujarat',
    district: 'Ahmedabad',
    ulb: 'Ahmedabad Municipal Corporation (AMC)',
    issuingDepartment: 'Property Tax Department',
    statutoryAct: 'Gujarat Provincial Municipal Corporations (GPMC) Act, 1949 (Sections 127-141)',
    officialPortal: {
      label: 'AMC Property Tax Citizen Portal',
      url: 'https://ahmedabadcity.gov.in'
    },
    propertyIdentifierLabel: 'Tenement Number (16 digits)',
    propertyIdentifierHint: '16-character Tenement Number found on AMC property tax bills (Ward/Tenement/Sub-tenement).',
    certificateAvailable: 'available_online',
    certificateServiceName: 'AMC Tenement No-Dues Certificate / Nil Tax Clearance',
    eligibility: [
      'Tenement owner or authorized occupant registered in AMC records.',
      'Payment of all general tax, water cess, conservancy tax, and education cess.',
      'No pending litigation on rateable value or unauthorized construction impact fees.'
    ],
    requiredDocuments: [
      {
        id: 'doc-amc-tenement',
        name: '16-digit Tenement Number',
        category: 'required',
        whyNeeded: 'Unique tenement identifier in AMC database.',
        officialSource: 'AMC Property Tax Rules',
        jurisdiction: 'Ahmedabad Municipal Corporation (AMC)'
      },
      {
        id: 'doc-amc-receipt',
        name: 'Latest AMC Property Tax Receipt',
        category: 'required',
        whyNeeded: 'Proof of latest tax payment.',
        officialSource: 'GPMC Act 1949',
        jurisdiction: 'Ahmedabad Municipal Corporation (AMC)'
      },
      {
        id: 'doc-amc-id',
        name: 'Applicant Photo ID Proof',
        category: 'required',
        whyNeeded: 'Proof of applicant identity.',
        officialSource: 'AMC Citizen Charter',
        jurisdiction: 'Ahmedabad Municipal Corporation (AMC)'
      }
    ],
    optionalDocuments: [
      {
        id: 'doc-amc-index2',
        name: 'Index-II / Registered Sale Deed',
        category: 'conditional',
        whyNeeded: 'Required if tenement owner name requires update in AMC records.',
        officialSource: 'Revenue Department, Gujarat',
        jurisdiction: 'Ahmedabad Municipal Corporation (AMC)'
      }
    ],
    onlineSteps: [
      'Visit https://ahmedabadcity.gov.in and click "Online Services" -> "Property Tax".',
      'Select "Property Tax Payment & Tenement Search".',
      'Enter your 16-digit Tenement Number or search by Zone, Ward, and Society Name.',
      'Examine the displayed bill details: general tax, water charges, education cess, and arrears.',
      'Pay online via Net Banking, Debit/Credit Card, or UPI gateway.',
      'Download and save the official computerized AMC payment receipt.',
      'Select "No-Dues Certificate / Nil Status" from the online service menu.',
      'Download the digitally verified AMC Tenement Clearance Certificate.'
    ],
    offlineSteps: [
      'Visit any AMC Civic Centre (available across all 7 zones: West, New West, East, North, South, Central, North West).',
      'Provide your Tenement Number to the Civic Centre counter executive.',
      'Pay any pending dues via cash, cheque, or card at the counter.',
      'Collect the printed official AMC Property Tax receipt and request a No-Dues Endorsement certificate.',
      'The Civic Centre supervisor validates the record and issues the stamped clearance slip.'
    ],
    paymentInformation: {
      officialFee: 'Nil on portal; nominal service charge of ₹20 applies at AMC Civic Centres.',
      paymentMethods: [
        'Online: UPI, Net Banking, Credit/Debit cards on AMC portal',
        'Offline: Cash, Cheque, or Card at any AMC Civic Centre'
      ],
      processingTimeline: 'Instant online download; same day at AMC Civic Centres.'
    },
    certificateInformation: {
      applicationMethod: 'Online via ahmedabadcity.gov.in or offline at any AMC Civic Centre.',
      collectionMethod: 'Direct PDF download or printed copy from Civic Centre.',
      validity: 'Valid for the ongoing financial year (up to 31 March).'
    },
    grievanceInformation: {
      contact: 'AMC Comprehensive Call Centre: 155303 / 079-25391811, Email: info@ahmedabadcity.gov.in',
      portal: 'https://ahmedabadcity.gov.in'
    },
    sources: [
      {
        title: 'Gujarat Provincial Municipal Corporations Act, 1949',
        department: 'Urban Development & Urban Housing Department, Gujarat',
        url: 'https://ahmedabadcity.gov.in',
        publicationDate: '1949-09-29',
        effectiveDate: '1949-12-29',
        lastVerified: '2026-11-18'
      },
      {
        title: 'AMC Citizen Charter - Property Tax Guidelines',
        department: 'Property Tax Department, AMC',
        url: 'https://ahmedabadcity.gov.in',
        publicationDate: '2023-01-01',
        effectiveDate: '2023-01-01',
        lastVerified: '2026-11-18'
      }
    ],
    verificationStatus: 'verified'
  },
  {
    id: 'pune-pmc',
    state: 'Maharashtra',
    district: 'Pune',
    ulb: 'Pune Municipal Corporation (PMC)',
    issuingDepartment: 'Property Tax Department',
    statutoryAct: 'Maharashtra Municipal Corporations Act, 1949 (Sections 127-133)',
    officialPortal: {
      label: 'PMC Property Tax Portal',
      url: 'https://propertytax.punecorporation.org'
    },
    propertyIdentifierLabel: 'Property Number (Peth / Ward / Society / Flat ID)',
    propertyIdentifierHint: 'Property number comprising Ward/Peth code, society code, and unit number.',
    certificateAvailable: 'available_online',
    certificateServiceName: 'PMC Property Tax No-Dues Certificate (NOC)',
    eligibility: [
      'Property owner or authorized representative whose details match PMC records.',
      'All property taxes, water tax, drainage cess, and interest paid in full.',
      'No pending revision objections or court injunctions.'
    ],
    requiredDocuments: [
      {
        id: 'doc-pmc-prop-no',
        name: 'PMC Property Number (Section / Peth / Society / Flat ID)',
        category: 'required',
        whyNeeded: 'Unique account identifier in PMC Property Tax Department.',
        officialSource: 'PMC Property Tax Rules',
        jurisdiction: 'Pune Municipal Corporation (PMC)'
      },
      {
        id: 'doc-pmc-receipt',
        name: 'Latest PMC Property Tax Paid Challan / Receipt',
        category: 'required',
        whyNeeded: 'Validates latest payment credit.',
        officialSource: 'MMC Act 1949',
        jurisdiction: 'Pune Municipal Corporation (PMC)'
      },
      {
        id: 'doc-pmc-id',
        name: 'Applicant Photo ID Proof',
        category: 'required',
        whyNeeded: 'Proof of identity of applicant.',
        officialSource: 'Maharashtra Right to Public Services Act, 2015',
        jurisdiction: 'Pune Municipal Corporation (PMC)'
      }
    ],
    optionalDocuments: [
      {
        id: 'doc-pmc-index2',
        name: 'Registered Sale Deed / Index-II Copy',
        category: 'conditional',
        whyNeeded: 'Required if transfer of assessment name in PMC records is pending.',
        officialSource: 'Revenue & Forest Department, Maharashtra',
        jurisdiction: 'Pune Municipal Corporation (PMC)'
      }
    ],
    onlineSteps: [
      'Visit https://propertytax.punecorporation.org and click "Pay Property Tax".',
      'Enter your Section/Peth code, Society name, and Flat/Property number.',
      'View the outstanding tax demand, arrear ledger, and early bird discount details.',
      'Pay online using Net Banking, Debit/Credit Card, or UPI gateway.',
      'Download and save the official computerized payment receipt.',
      'Click on "No Objection Certificate (NOC) / No-Dues Certificate" on the homepage menu.',
      'Enter Property Number; the system confirms zero outstanding balance and generates the digitally signed PMC No-Dues Certificate for download.'
    ],
    offlineSteps: [
      'Visit your respective PMC Ward Office or the Property Tax Department at PMC Main Building, Shivajinagar, Pune.',
      'Proceed to the Citizen Facilitation Centre (CFC) counter.',
      'Submit the No-Dues Application along with property identification documents.',
      'Pay any residual reconciliation dues via cash or DD at the counter.',
      'The Property Tax Officer (PTO) validates the physical ledger and issues the certified No-Dues Certificate.'
    ],
    paymentInformation: {
      officialFee: 'Nil for online NOC download; standard payment of all assessed property taxes required.',
      paymentMethods: [
        'Online: UPI, Net Banking, Credit/Debit cards on PMC Property Tax portal',
        'Offline: Cash, Demand Draft, or Card at PMC Ward CFC counters or designated bank branches'
      ],
      processingTimeline: 'Immediate online download upon zero dues; 7 to 15 working days for offline ward office application under Maharashtra Right to Public Services Act.'
    },
    certificateInformation: {
      applicationMethod: 'Online via propertytax.punecorporation.org or offline at PMC Ward CFC.',
      collectionMethod: 'Direct PDF download with QR code or counter collection at Ward Office.',
      validity: 'Valid for the ongoing financial year (up to 31 March).'
    },
    grievanceInformation: {
      contact: 'PMC Toll-Free Helpline: 1800 1030 222, WhatsApp: 9689900002, Email: info@punecorporation.org',
      portal: 'https://complaint.punecorporation.org'
    },
    sources: [
      {
        title: 'Maharashtra Municipal Corporations Act, 1949',
        department: 'Urban Development Department, Government of Maharashtra',
        url: 'https://propertytax.punecorporation.org',
        publicationDate: '1949-12-29',
        effectiveDate: '1949-12-29',
        lastVerified: '2026-11-18'
      },
      {
        title: 'PMC Citizens Charter - Property Tax Administration',
        department: 'Property Tax Department, PMC',
        url: 'https://propertytax.punecorporation.org',
        publicationDate: '2023-04-01',
        effectiveDate: '2023-04-01',
        lastVerified: '2026-11-18'
      }
    ],
    verificationStatus: 'verified'
  },
  {
    id: 'unverified-fallback',
    state: 'Unlisted State / UT',
    district: 'Unspecified District',
    ulb: 'Unverified Urban Local Body',
    issuingDepartment: 'Not specified by the linked official source.',
    statutoryAct: 'Respective State Municipal Act',
    officialPortal: {
      label: 'Not specified by the linked official source.',
      url: null
    },
    propertyIdentifierLabel: 'Property ID / Assessment Number',
    propertyIdentifierHint: 'Not specified by the linked official source.',
    certificateAvailable: 'unknown',
    certificateServiceName: 'Not specified by the linked official source.',
    eligibility: [
      'Official information for this jurisdiction has not yet been verified.',
      'Please consult your local municipal corporation, municipality, or nagar palika office directly.'
    ],
    requiredDocuments: [
      {
        id: 'doc-fallback-prop-id',
        name: 'Property Identification Number / Assessment Number',
        category: 'required',
        whyNeeded: 'Universal municipal identifier needed to query local tax records.',
        officialSource: 'Not specified by the linked official source.',
        jurisdiction: 'Unverified Urban Local Body'
      },
      {
        id: 'doc-fallback-receipt',
        name: 'Previous Property Tax Paid Receipt',
        category: 'required',
        whyNeeded: 'Proof of earlier tax payments.',
        officialSource: 'Not specified by the linked official source.',
        jurisdiction: 'Unverified Urban Local Body'
      },
      {
        id: 'doc-fallback-id',
        name: 'Applicant Photo Identity Document',
        category: 'required',
        whyNeeded: 'Verification of applicant identity.',
        officialSource: 'Not specified by the linked official source.',
        jurisdiction: 'Unverified Urban Local Body'
      }
    ],
    optionalDocuments: [],
    onlineSteps: [
      'Official information for this jurisdiction has not yet been verified.',
      'Check if your state urban development department or municipal council hosts an official portal under your state government domain (.gov.in or .nic.in).',
      'Never submit payment or identity documents on unverified third-party websites.'
    ],
    offlineSteps: [
      'Visit your local municipal council / nagar palika / municipal corporation revenue or tax counter in person.',
      'Inquire with the tax superintendent regarding the official procedure for checking dues and requesting a No-Dues Certificate.',
      'Always collect an official stamped paper receipt for any fee or tax paid in person.'
    ],
    paymentInformation: {
      officialFee: 'Not specified by the linked official source.',
      paymentMethods: [
        'Not specified by the linked official source. Inquire at your local municipal office.'
      ],
      processingTimeline: 'Not specified by the linked official source.'
    },
    certificateInformation: {
      applicationMethod: 'Not specified by the linked official source.',
      collectionMethod: 'Not specified by the linked official source.',
      validity: 'Not specified by the linked official source.'
    },
    grievanceInformation: {
      contact: 'Not specified by the linked official source.',
      portal: null
    },
    sources: [],
    verificationStatus: 'unavailable'
  }
];

export const JURISDICTION_HIERARCHY = {
  Delhi: {
    'All Delhi Districts': [
      {
        id: 'delhi-mcd',
        name: 'Municipal Corporation of Delhi (MCD)',
        status: 'verified'
      }
    ]
  },
  Karnataka: {
    'Bengaluru Urban': [
      {
        id: 'bengaluru-bbmp',
        name: 'Bruhat Bengaluru Mahanagara Palike (BBMP)',
        status: 'verified'
      }
    ]
  },
  Maharashtra: {
    'Mumbai City & Mumbai Suburban': [
      {
        id: 'mumbai-bmc',
        name: 'Brihanmumbai Municipal Corporation (BMC / MCGM)',
        status: 'verified'
      }
    ],
    Pune: [
      {
        id: 'pune-pmc',
        name: 'Pune Municipal Corporation (PMC)',
        status: 'verified'
      }
    ]
  },
  'Tamil Nadu': {
    Chennai: [
      {
        id: 'chennai-gcc',
        name: 'Greater Chennai Corporation (GCC)',
        status: 'verified'
      }
    ]
  },
  'West Bengal': {
    Kolkata: [
      {
        id: 'kolkata-kmc',
        name: 'Kolkata Municipal Corporation (KMC)',
        status: 'verified'
      }
    ]
  },
  Telangana: {
    Hyderabad: [
      {
        id: 'hyderabad-ghmc',
        name: 'Greater Hyderabad Municipal Corporation (GHMC)',
        status: 'verified'
      }
    ]
  },
  Gujarat: {
    Ahmedabad: [
      {
        id: 'ahmedabad-amc',
        name: 'Ahmedabad Municipal Corporation (AMC)',
        status: 'verified'
      }
    ]
  }
};

/**
 * Returns the verified ULB record by id, or the unverified fallback record.
 */
export function getJurisdictionById(id) {
  if (!id) return JURISDICTION_PROPERTY_TAX_DATA.find((j) => j.id === 'unverified-fallback');
  return (
    JURISDICTION_PROPERTY_TAX_DATA.find((j) => j.id === id) ||
    JURISDICTION_PROPERTY_TAX_DATA.find((j) => j.id === 'unverified-fallback')
  );
}

/**
 * Returns available districts for a state from the verified hierarchy.
 */
export function getAvailableDistrictsForState(stateName) {
  if (!stateName || !JURISDICTION_HIERARCHY[stateName]) return [];
  return Object.keys(JURISDICTION_HIERARCHY[stateName]);
}

/**
 * Returns available ULBs for a state and district.
 */
export function getAvailableUlbsForDistrict(stateName, districtName) {
  if (!stateName || !districtName) return [];
  const stateData = JURISDICTION_HIERARCHY[stateName];
  if (!stateData || !stateData[districtName]) return [];
  return stateData[districtName];
}

/**
 * Standard 10-step Application Journey stages.
 */
export const ORDERED_JOURNEY_STAGES = [
  {
    step: 1,
    title: 'Identify Your Competent Municipal Authority',
    summary:
      'Determine which Urban Local Body (Municipal Corporation, Municipality, Town Panchayat, or Cantonment Board) holds statutory territorial jurisdiction over your property address.',
    actionPoint:
      'Check previous property tax papers, electricity bill billing division, or local municipal ward map to identify the exact local body.'
  },
  {
    step: 2,
    title: 'Locate the Official Property Tax Portal or Office',
    summary:
      'Access the authentic government portal (ending strictly in .gov.in or .nic.in) or identify your zonal citizen facilitation centre.',
    actionPoint:
      'Never search for property tax payments through unverified third-party financial blogs, search-engine advertisements, or unofficial aggregator apps.'
  },
  {
    step: 3,
    title: 'Find the Property Using Unique Identifier',
    summary:
      'Retrieve property records using your city-specific identifier (e.g. MCD UPIC, BBMP SAS/PID, BMC SAC number, GCC Bill number, GHMC PTIN, or AMC Tenement number).',
    actionPoint:
      'If you do not possess your ID, search via registered mobile number, owner name, or zone/ward/street address on the portal.'
  },
  {
    step: 4,
    title: 'Inspect Assessment Year, Demands, Arrears & Penalties',
    summary:
      'Carefully examine the line-item bill decomposition: current financial year principal tax, solid waste/library cesses, accumulated historical arrears, and statutory interest.',
    actionPoint:
      'Verify that previous payments have been credited; if older paid receipts do not reflect, raise a reconciliation request before paying again.'
  },
  {
    step: 5,
    title: 'Verify Property Attributes & Rateable Calculations',
    summary:
      'Ensure the registered plinth area, usage classification (residential vs commercial), and occupancy status (self-occupied vs tenanted) match real-world facts.',
    actionPoint:
      'If attributes are incorrect, file an online assessment revision objection under the relevant municipal act before finalizing payment.'
  },
  {
    step: 6,
    title: 'Clear All Outstanding Dues via Official Payment Methods',
    summary:
      'Remit full outstanding amounts through official gateways: integrated Net Banking, authorized UPI, or an official bank challan at a designated municipal counter.',
    actionPoint:
      'Retain bank transaction UTR reference and avoid closing the browser tab until the gateway redirects back with confirmation.'
  },
  {
    step: 7,
    title: 'Immediately Download the Official Payment Receipt',
    summary:
      'Save the computerized payment voucher containing transaction ID, G8 challan number, timestamp, and barcode/QR verification.',
    actionPoint:
      'A payment receipt proves this individual transaction. Store multiple digital and physical copies in your property records file.'
  },
  {
    step: 8,
    title: 'Check if the Authority Issues a Separate No-Dues Certificate',
    summary:
      'Determine if your ULB provides an automated Nil-Dues Certificate upon zero balance, requires a separate application, or issues an endorsed ledger extract.',
    actionPoint:
      'ULBs like MCD, BMC, and PMC provide instant downloadable No-Dues Certificates; others require submission of an ARO verification application.'
  },
  {
    step: 9,
    title: 'Submit the No-Dues Request and Supporting Documents',
    summary:
      'If an explicit application is mandated, submit the request online or at the zonal revenue office along with ID proof and latest paid receipts.',
    actionPoint:
      'Collect an official application acknowledgement receipt containing an application reference number and expected statutory service date.'
  },
  {
    step: 10,
    title: 'Track Verification and Download Signed No-Dues Certificate',
    summary:
      'Track the ledger reconciliation status. Upon internal approval, download the digitally signed certificate or collect the physical sealed document from the zonal office.',
    actionPoint:
      'Verify that the certificate explicitly states "Nil Dues" or "No Outstanding Dues" as of the specified verification date.'
  }
];

/**
 * Informational Tracking Fields that citizens should track in their own records.
 * (Zero backend storage, informational guidance only).
 */
export const INFORMATIONAL_TRACKING_FIELDS = [
  {
    key: 'propertyId',
    label: 'Property ID / Assessment Number',
    purpose: 'Universal account key used by municipal authorities to locate the property ledger.',
    statusInGuide: 'Citizen records for their own files. Civic-Help-Setu never stores this.'
  },
  {
    key: 'assessmentYear',
    label: 'Assessment Year / Period',
    purpose: 'Financial year for which the tax is computed (e.g., 2026-2027).',
    statusInGuide: 'Typically runs from 1 April to 31 March across Indian municipal jurisdictions.'
  },
  {
    key: 'taxDueDate',
    label: 'Tax Due Date',
    purpose: 'Statutory deadline before which property tax must be remitted without penal interest.',
    statusInGuide: 'Varies by municipality. Early bird rebate often applies if paid in the first quarter (April-June).'
  },
  {
    key: 'outstandingPrincipal',
    label: 'Outstanding Principal Tax',
    purpose: 'Base municipal property tax levied on the rateable value or unit area.',
    statusInGuide: 'Computed by municipal authority based on covered area, age, usage, and zone.'
  },
  {
    key: 'arrears',
    label: 'Accumulated Arrears',
    purpose: 'Unpaid tax carried forward from previous financial years.',
    statusInGuide: 'Must be cleared in full before any No-Dues Certificate can be granted.'
  },
  {
    key: 'penaltyInterest',
    label: 'Penalty / Interest Charges',
    purpose: 'Statutory surcharge (typically 1% to 2% per month) levied on delayed payments.',
    statusInGuide: 'Governed by state municipal corporation acts (e.g., DMC Act Section 152).'
  },
  {
    key: 'paymentDate',
    label: 'Payment Date',
    purpose: 'The exact calendar day on which funds were transferred to the municipal exchequer.',
    statusInGuide: 'Printed on bank transaction slip and municipal receipt.'
  },
  {
    key: 'paymentReference',
    label: 'Payment Reference / Transaction ID / UTR',
    purpose: 'Bank and gateway reference number proving financial settlement.',
    statusInGuide: 'Essential for tracking and grievance redressal if receipt generation fails.'
  },
  {
    key: 'paymentReceiptDate',
    label: 'Payment Receipt Date',
    purpose: 'The date on which the municipal treasury generated the official receipt.',
    statusInGuide: 'Usually matches payment date for online transactions; may differ for cheque/DD.'
  },
  {
    key: 'submissionDate',
    label: 'No-Dues Application Submission Date',
    purpose: 'Date on which formal request for Nil-Dues Certificate was submitted.',
    statusInGuide: 'Not specified by the linked official source if the ULB auto-generates certificates.'
  },
  {
    key: 'acknowledgementDate',
    label: 'Application Acknowledgement Date',
    purpose: 'Date on which the municipal office acknowledged receipt of the application.',
    statusInGuide: 'Trigger date for statutory service delivery timelines under State Right to Services Acts.'
  },
  {
    key: 'appointmentDate',
    label: 'Appointment Date',
    purpose: 'Date scheduled for physical document verification or hearing, if mandated.',
    statusInGuide: 'Not specified by the linked official source for standard automated property tax clearance.'
  },
  {
    key: 'verificationDate',
    label: 'Ledger Verification Date',
    purpose: 'Date on which the revenue inspector reconciled ledger entries.',
    statusInGuide: 'Timestamped on digitally signed clearance certificates.'
  },
  {
    key: 'certificateIssueDate',
    label: 'Certificate Issue Date',
    purpose: 'Date on which the final No-Dues Certificate was formally granted.',
    statusInGuide: 'Distinguished from payment date; confirms clearance as on that date.'
  },
  {
    key: 'certificateValidityDate',
    label: 'Certificate Validity Date',
    purpose: 'Period during which the No-Dues Certificate is recognized as valid.',
    statusInGuide: 'Valid until the end of the ongoing assessment period or next demand cycle.'
  }
];

export const PROPERTY_TAX_FAQS = [
  {
    question: 'Is a property tax payment receipt the same as a No-Dues Certificate?',
    answer:
      'No. A payment receipt merely proves that a specific amount was paid on a specific date for a specific period. A No-Dues Certificate is a comprehensive municipal certification confirming that as of that date, zero tax arrears, interest, or penalties remain unpaid across all previous financial years.'
  },
  {
    question: 'Does paying property tax make me the legal owner of the property?',
    answer:
      'No. Property tax is a fiscal levy on municipal property for local services. It does not determine or create legal title. Legal title is established through registered title deeds (Sale Deed, Gift Deed) and revenue land records (Patta, Record of Rights). Courts in India have repeatedly held that property tax receipts do not prove ownership.'
  },
  {
    question: 'What should I do if my bank account was debited but no receipt was generated?',
    answer:
      'Wait 24 to 48 hours for bank reconciliation. Do not make an immediate duplicate payment. Note your Bank Transaction Reference (UTR) number. Visit the portal "Payment Status" or "Re-print Receipt" tab. If the transaction still shows pending after 48 hours, lodge an online grievance on the municipal portal quoting your Property ID and UTR.'
  },
  {
    question: 'Can I get a No-Dues Certificate if previous years are under dispute or appeal?',
    answer:
      'Generally, no. Municipal authorities require all demands to be settled before issuing a clean No-Dues Certificate. If a dispute is pending before a municipal tribunal or High Court, the authority may only issue a conditional ledger statement reflecting the sub-judice status.'
  },
  {
    question: 'How long is a Property Tax No-Dues Certificate valid?',
    answer:
      'A No-Dues Certificate is valid up to the end of the ongoing assessment cycle (typically the ongoing financial year ending 31 March, or the half-year ending 30 September / 31 March) or until the next statutory property tax demand is generated.'
  },
  {
    question: 'Can a tenant apply for a No-Dues Certificate on behalf of the landlord?',
    answer:
      'Yes, in most municipal jurisdictions, any lawful occupier possessing the property identification number can check dues and pay taxes. However, obtaining a formal certified clearance certificate may require the owner authorization letter depending on the ULB.'
  }
];

export const STATUTORY_CAVEATS_AND_WARNINGS = [
  {
    id: 'warn-no-title',
    title: 'No Proof of Legal Ownership or Title',
    type: 'danger',
    description:
      'A Property Tax Receipt or No-Dues Certificate does NOT confer legal ownership, title, or proprietary right. Never rely solely on tax receipts when buying real estate without examining registered title deeds and encumbrance certificates.'
  },
  {
    id: 'warn-no-regularization',
    title: 'No Regularization of Unauthorized Construction',
    type: 'danger',
    description:
      'Assessment and collection of property tax on an unauthorized structure does NOT legalize the deviation or protect it from demolition under town planning acts.'
  },
  {
    id: 'warn-fake-portals',
    title: 'Beware of Fraudulent Payment Portals & Phishing Links',
    type: 'warning',
    description:
      'Always verify that the payment website ends with .gov.in or .nic.in. Never pay property tax through unverified third-party search results, shortened links, or social media pages.'
  },
  {
    id: 'warn-dispute-resolution',
    title: 'Resolution of Trailing Assessment Arrears',
    type: 'info',
    description:
      'If uncredited arrears appear on your demand notice despite previous payment, submit previous stamped physical receipts to your zonal revenue office for manual Demand Collection Balance (DCB) ledger rectification.'
  }
];
