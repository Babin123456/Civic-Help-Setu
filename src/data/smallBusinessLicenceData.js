/**
 * Small-Business Licence Renewal and Closure Checklist Dataset (#721)
 *
 * Grounded in state municipal corporation acts, Shops & Establishments acts,
 * FSSAI regulations, SPCB pollution control guidelines, and CBIC statutory rules.
 *
 * Adheres strictly to the anti-assumption principle:
 * Unverified jurisdictions and uncatalogued local bodies are explicitly marked
 * UNAVAILABLE_OR_UNVERIFIED with fallback instructions.
 */

export const DATA_STALENESS_HORIZON_DAYS = 180;

export const STATUTORY_LEGAL_DISCLAIMER =
  'This checklist centre provides administrative and procedural guidance grounded in published municipal byelaws and departmental citizen charters. It does not constitute formal legal representation, statutory licensing decisions, tax clearance certificates, or municipal sanctions. Licences must be processed through official governmental single-window portals.';

export const BUSINESS_CATEGORIES = [
  { id: 'RETAIL', label: 'Retail Trade & General Merchandising', description: 'Grocery shops, apparel stores, hardware, and retail outlets' },
  { id: 'FOOD_BEVERAGE', label: 'Food, Eateries & Cloud Kitchens', description: 'Restaurants, cafes, bakeries, sweet shops, and delivery kitchens' },
  { id: 'MANUFACTURING', label: 'Light Manufacturing, Fabrication & Workshops', description: 'Small workshops, packaging units, and industrial fabrication' },
  { id: 'PERSONAL_CARE', label: 'Personal Care, Salons & Wellness Clinics', description: 'Barbershops, beauty parlours, fitness centres, and dental clinics' },
  { id: 'SERVICES', label: 'Professional, IT & Commercial Services', description: 'Offices, consulting agencies, creative studios, and repair desks' }
];

export const MUNICIPAL_JURISDICTIONS = [
  {
    key: 'DELHI_MCD',
    state: 'Delhi (NCT)',
    city: 'Delhi',
    authorityName: 'Municipal Corporation of Delhi (MCD)',
    department: 'Trade Licensing & Health Department',
    statutoryAct: 'Delhi Municipal Corporation Act, 1957 (Sections 417, 421, 422)',
    portalName: 'MCD Online Citizen Portal',
    portalUrl: 'https://mcdonline.nic.in',
    effectiveDate: '2023-04-01',
    verificationTimestamp: '2026-11-05',
    verified: true,
    renewalCycleMonths: 12,
    renewalWindow: '1 January to 31 March annually',
    advanceNoticeDays: 60,
    lateFeePolicy: 'Statutory surcharge applies for renewals submitted after 31 March; inspection triggers if lapsed > 1 year.'
  },
  {
    key: 'MAHARASHTRA_MUMBAI',
    state: 'Maharashtra',
    city: 'Mumbai',
    authorityName: 'Brihanmumbai Municipal Corporation (BMC)',
    department: 'Shops & Establishments / Licence Department',
    statutoryAct: 'Mumbai Municipal Corporation Act, 1888 (Section 394) & Maharashtra Shops & Est Act 2017',
    portalName: 'BMC Citizen Portal',
    portalUrl: 'https://portal.mcgm.gov.in',
    effectiveDate: '2023-01-01',
    verificationTimestamp: '2026-11-05',
    verified: true,
    renewalCycleMonths: 12,
    renewalWindow: '1 January to 31 March or custom 3-year term',
    advanceNoticeDays: 60,
    lateFeePolicy: 'Compound penal fee per month of default under MMC Act Section 394.'
  },
  {
    key: 'KARNATAKA_BENGALURU',
    state: 'Karnataka',
    city: 'Bengaluru',
    authorityName: 'Bruhat Bengaluru Mahanagara Palike (BBMP)',
    department: 'Health & Revenue Department',
    statutoryAct: 'BBMP Act 2020 / Karnataka Municipal Corporations Act, 1976 (Section 353)',
    portalName: 'BBMP Citizen Portal',
    portalUrl: 'https://bbmptax.karnataka.gov.in',
    effectiveDate: '2023-04-01',
    verificationTimestamp: '2026-11-05',
    verified: true,
    renewalCycleMonths: 12,
    renewalWindow: '1 January to 28 February annually (extended to 31 March with penalty)',
    advanceNoticeDays: 60,
    lateFeePolicy: 'Late fee surcharge of 25% to 50% on assessed trade licence fee.'
  },
  {
    key: 'TAMILNADU_CHENNAI',
    state: 'Tamil Nadu',
    city: 'Chennai',
    authorityName: 'Greater Chennai Corporation (GCC)',
    department: 'Revenue & Public Health Department',
    statutoryAct: 'Tamil Nadu Urban Local Bodies Act, 1998 & Rules 2023 (Section 114)',
    portalName: 'Greater Chennai Corporation Portal',
    portalUrl: 'https://chennaicorporation.gov.in',
    effectiveDate: '2023-06-01',
    verificationTimestamp: '2026-11-05',
    verified: true,
    renewalCycleMonths: 12,
    renewalWindow: '1 January to 31 March annually',
    advanceNoticeDays: 60,
    lateFeePolicy: 'Late surcharge applied as per TNULB Rules Schedule after financial year cutoff.'
  },
  {
    key: 'TELANGANA_HYDERABAD',
    state: 'Telangana',
    city: 'Hyderabad',
    authorityName: 'Greater Hyderabad Municipal Corporation (GHMC)',
    department: 'Health & Sanitation / Citizen Services',
    statutoryAct: 'GHMC Act, 1955 & TS-bPASS Single Window Act, 2020',
    portalName: 'GHMC Online Services',
    portalUrl: 'https://www.ghmc.gov.in',
    effectiveDate: '2023-04-01',
    verificationTimestamp: '2026-11-05',
    verified: true,
    renewalCycleMonths: 12,
    renewalWindow: '1 January to 31 March',
    advanceNoticeDays: 60,
    lateFeePolicy: '25% penalty for filings after 31 March; 50% penalty if delayed beyond 31 May.'
  },
  {
    key: 'WESTBENGAL_KOLKATA',
    state: 'West Bengal',
    city: 'Kolkata',
    authorityName: 'Kolkata Municipal Corporation (KMC)',
    department: 'Licence Department (Certificate of Enlistment)',
    statutoryAct: 'Kolkata Municipal Corporation Act, 1980 (Section 199)',
    portalName: 'KMC Citizen Portal',
    portalUrl: 'https://www.kmcgov.in',
    effectiveDate: '2023-04-01',
    verificationTimestamp: '2026-11-05',
    verified: true,
    renewalCycleMonths: 12,
    renewalWindow: 'April to July for preceding financial year',
    advanceNoticeDays: 45,
    lateFeePolicy: 'Statutory interest and compounding late fee levied on Certificate of Enlistment.'
  },
  {
    key: 'UNLISTED_JURISDICTION',
    state: 'Other / Unlisted State',
    city: 'Unlisted Urban Local Body',
    authorityName: 'Jurisdictional Municipal Corporation / Municipality / Town Panchayat',
    department: 'Local Licensing Officer',
    statutoryAct: 'Relevant State Urban Local Bodies / Municipalities Act',
    portalName: 'State Urban Development Single Window Portal',
    portalUrl: null,
    effectiveDate: '2023-01-01',
    verificationTimestamp: null,
    verified: false,
    renewalCycleMonths: 12,
    renewalWindow: 'Consult local municipal notice board',
    advanceNoticeDays: 30,
    lateFeePolicy: 'Varies by municipality. Contact local municipal licensing cell directly.'
  }
];

export const LICENCE_CATALOG = [
  // TRACK 1: MUNICIPAL LICENCES
  {
    key: 'municipal_trade_licence',
    track: 'MUNICIPAL',
    title: 'Municipal General Trade Licence',
    categoryScope: ['RETAIL', 'FOOD_BEVERAGE', 'MANUFACTURING', 'PERSONAL_CARE', 'SERVICES'],
    governingAuthority: 'Local Municipal Corporation (MCD, BMC, BBMP, GCC, GHMC, KMC)',
    statutoryAct: 'State Municipal Corporation Acts (e.g. DMC Act 1957 s.417; MMC Act 1888 s.394; KMC Act 1976 s.353)',
    portalUrl: 'https://mcdonline.nic.in',
    renewalCycle: 'Annual Financial Year (Expires 31 March)',
    advanceRenewalDays: 60,
    gracePeriodDays: 30,
    verificationTimestamp: '2026-11-05',
    verified: true,
    officialInstruction:
      'Every establishment carrying on a specified trade or commercial activity must renew its trade licence annually before 31 March. Running a trade without an active licence attracts premises sealing and penal seizure under municipal bylaws.',
    editorialExplanation:
      'Trade licences are regulatory permissions to ensure non-nuisance; they never confer property title or ownership guarantee. If you shift shops or alter carpet area, file an amendment rather than a standard renewal.'
  },
  {
    key: 'health_trade_licence',
    track: 'MUNICIPAL',
    title: 'Health & Sanitary Trade Licence',
    categoryScope: ['FOOD_BEVERAGE', 'PERSONAL_CARE'],
    governingAuthority: 'Municipal Public Health Directorate / Sanitary Health Officer',
    statutoryAct: 'Municipal Public Health Bylaws & Prevention of Food Adulteration provisions',
    portalUrl: 'https://portal.mcgm.gov.in',
    renewalCycle: 'Annual (Synchronized with Municipal Financial Year)',
    advanceRenewalDays: 60,
    gracePeriodDays: 15,
    verificationTimestamp: '2026-11-05',
    verified: true,
    officialInstruction:
      'Mandatory for premises serving food, drinks, butchery, bakeries, beauty salons, and healthcare clinics. Requires periodic water potability test certificates and medical fitness certificates for all food handlers.',
    editorialExplanation:
      'Keep your water testing laboratory report (from an NABL-accredited or municipal lab) ready before applying for health licence renewal. Inspections by the Sanitary Inspector are routinely conducted.'
  },
  {
    key: 'signage_display_permission',
    track: 'MUNICIPAL',
    title: 'Signboard & Outdoor Advertisement Permission',
    categoryScope: ['RETAIL', 'FOOD_BEVERAGE', 'MANUFACTURING', 'PERSONAL_CARE', 'SERVICES'],
    governingAuthority: 'Municipal Advertisement Department',
    statutoryAct: 'Municipal Corporation Advertisement Control Byelaws / Outdoor Signage Policy',
    portalUrl: 'https://chennaicorporation.gov.in',
    renewalCycle: 'Annual or Biennial',
    advanceRenewalDays: 30,
    gracePeriodDays: 0,
    verificationTimestamp: '2026-11-05',
    verified: true,
    officialInstruction:
      'Signboards exceeding standard fascia dimensions or projecting into public rights-of-way require explicit municipal advertisement permission and payment of advertisement tax.',
    editorialExplanation:
      'Standard shop-name boards within prescribed dimensional limits (often under 25 sq. ft. flush against the wall) may be tax-exempt depending on your city, but illuminated neon signs almost always require annual clearance.'
  },
  {
    key: 'hazardous_storage_licence',
    track: 'MUNICIPAL',
    title: 'Storage of Combustible / Hazardous Goods Licence',
    categoryScope: ['MANUFACTURING', 'RETAIL'],
    governingAuthority: 'Municipal Factory Licensing / Fire Prevention Department',
    statutoryAct: 'State Municipal Acts (Dangerous & Offensive Trades schedule)',
    portalUrl: 'https://mcdonline.nic.in',
    renewalCycle: 'Annual',
    advanceRenewalDays: 45,
    gracePeriodDays: 0,
    verificationTimestamp: '2026-11-05',
    verified: true,
    officialInstruction:
      'Required if storing paints, petroleum thinners, combustible packaging, LPG cylinders, or chemical solvents above prescribed municipal threshold quantities.',
    editorialExplanation:
      'Ensure your premise possesses an appropriate ABC-type fire extinguisher with a valid servicing stamp before requesting inspection renewal.'
  },

  // TRACK 2: SECTOR-SPECIFIC & STATUTORY LICENCES
  {
    key: 'shops_establishment_registration',
    track: 'SECTOR_SPECIFIC',
    title: 'Shops & Commercial Establishments Act Registration',
    categoryScope: ['RETAIL', 'FOOD_BEVERAGE', 'MANUFACTURING', 'PERSONAL_CARE', 'SERVICES'],
    governingAuthority: 'State Labour Department / Office of the Chief Inspector of Shops',
    statutoryAct: 'State Shops and Commercial Establishments Acts (e.g. Delhi Shops Act 1954, Maharashtra Shops Act 2017)',
    portalUrl: 'https://labour.gov.in',
    renewalCycle: 'Perpetual or 1 to 5 years (Varies by State: Perpetual in MH/KA for micro-units; periodic in DL)',
    advanceRenewalDays: 60,
    gracePeriodDays: 30,
    verificationTimestamp: '2026-11-05',
    verified: true,
    officialInstruction:
      'Governs employee work hours, daily intervals, statutory leaves, overtime records, and wage muster roles. Changes in number of employees or working partners must be amended within 30 days.',
    editorialExplanation:
      'In states like Maharashtra and Karnataka, establishments with fewer than 10 employees receive an intimation receipt that has lifetime validity unless amended or surrendered.'
  },
  {
    key: 'fssai_licence_registration',
    track: 'SECTOR_SPECIFIC',
    title: 'FSSAI Food Business Registration / Licence',
    categoryScope: ['FOOD_BEVERAGE'],
    governingAuthority: 'Food Safety and Standards Authority of India (FSSAI)',
    statutoryAct: 'Food Safety and Standards Act, 2006 & (Licensing and Registration) Regulations, 2011',
    portalUrl: 'https://foscos.fssai.gov.in',
    renewalCycle: '1 to 5 Years (User-selected at application)',
    advanceRenewalDays: 120,
    gracePeriodDays: 0,
    verificationTimestamp: '2026-11-05',
    verified: true,
    officialInstruction:
      'Renewal application can be filed up to 120 days prior to expiry on FoSCoS portal. A late fee of ₹100 per day is automatically levied if renewal is filed after expiry until cutoff.',
    editorialExplanation:
      'Do not delay FSSAI renewals. If a licence completely lapses, FoSCoS does not allow retrospective renewal; you will have to apply for a fresh 14-digit licence number and reprint all food packaging and signage.'
  },
  {
    key: 'spcb_pollution_consent',
    track: 'SECTOR_SPECIFIC',
    title: 'State Pollution Control Board (SPCB) Consent / Exemption',
    categoryScope: ['MANUFACTURING', 'FOOD_BEVERAGE', 'PERSONAL_CARE'],
    governingAuthority: 'State Pollution Control Board / Committee (DPCC, MPCB, KSPCB, TNPCB)',
    statutoryAct: 'Water (Prevention and Control of Pollution) Act, 1974 & Air Act, 1981',
    portalUrl: 'https://kspcb.karnataka.gov.in',
    renewalCycle: '3 to 5 Years (Green Category) / 1 to 2 Years (Orange Category)',
    advanceRenewalDays: 90,
    gracePeriodDays: 0,
    verificationTimestamp: '2026-11-05',
    verified: true,
    officialInstruction:
      'Consent to Operate (CTO) must be renewed prior to expiration. White category micro-units require a one-time self-certification undertaking without annual renewal.',
    editorialExplanation:
      'If your establishment operates DG sets, effluent discharge (e.g. laundry, clinic), or commercial kitchen exhaust scrubbers, keep stack emission and noise monitoring test certificates ready.'
  },
  {
    key: 'legal_metrology_verification',
    track: 'SECTOR_SPECIFIC',
    title: 'Legal Metrology (Weights & Measures) Verification Certificate',
    categoryScope: ['RETAIL', 'FOOD_BEVERAGE', 'MANUFACTURING'],
    governingAuthority: 'Directorate of Legal Metrology / Assistant Controller of Weights & Measures',
    statutoryAct: 'Legal Metrology Act, 2009 & Legal Metrology (General) Rules, 2011',
    portalUrl: 'https://consumeraffairs.nic.in',
    renewalCycle: 'Annual or Biennial (Electronic scales require annual re-stamping)',
    advanceRenewalDays: 30,
    gracePeriodDays: 0,
    verificationTimestamp: '2026-11-05',
    verified: true,
    officialInstruction:
      'Commercial weighing machines, measuring counters, and platform scales must be physically stamped by an authorized Legal Metrology Inspector. Operating unverified scales is a cognizable offence.',
    editorialExplanation:
      'A metallic lead seal and a hologram sticker are affixed to the scale. Keep the paper verification certificate prominently framed near the billing counter.'
  },
  {
    key: 'fire_safety_certificate',
    track: 'SECTOR_SPECIFIC',
    title: 'Fire Safety Certificate / Fire NOC',
    categoryScope: ['FOOD_BEVERAGE', 'MANUFACTURING', 'RETAIL'],
    governingAuthority: 'State Fire & Emergency Services Directorate / Chief Fire Officer',
    statutoryAct: 'State Fire Prevention and Life Safety Measures Acts / NBC 2016 Part 4',
    portalUrl: 'https://mahafireservice.gov.in',
    renewalCycle: 'Annual or 3-Yearly depending on building occupancy classification',
    advanceRenewalDays: 60,
    gracePeriodDays: 0,
    verificationTimestamp: '2026-11-05',
    verified: true,
    officialInstruction:
      'Mandatory for restaurants with seating capacity > 50 persons, multi-level retail complexes, and premises handling hazardous or combustible substances.',
    editorialExplanation:
      'Requires Form B maintenance certificate issued by an authorized fire equipment agency certifying working condition of fire extinguishers, hose reels, and smoke detectors.'
  },
  {
    key: 'professional_tax_registration',
    track: 'SECTOR_SPECIFIC',
    title: 'Professional Tax Certificate (PT-EC & PT-RC)',
    categoryScope: ['RETAIL', 'FOOD_BEVERAGE', 'MANUFACTURING', 'PERSONAL_CARE', 'SERVICES'],
    governingAuthority: 'State Commercial Tax / Revenue Department',
    statutoryAct: 'State Tax on Professions, Trades, Callings and Employments Acts',
    portalUrl: 'https://bbmptax.karnataka.gov.in',
    renewalCycle: 'Annual (PT-EC due before 30 April annually in most states)',
    advanceRenewalDays: 30,
    gracePeriodDays: 30,
    verificationTimestamp: '2026-11-05',
    verified: true,
    officialInstruction:
      'Enrolment Certificate (PT-EC) applies to the business entity itself; Registration Certificate (PT-RC) applies to employer deducting tax from salaried staff.',
    editorialExplanation:
      'Pay PT-EC before 30 April every year to avoid penal interest (1.25% to 2% per month) under state commercial tax enactments.'
  },
  {
    key: 'gst_cancellation_surrender',
    track: 'SECTOR_SPECIFIC',
    title: 'GSTIN Registration Cancellation & Surrender (GSTR-10)',
    categoryScope: ['RETAIL', 'FOOD_BEVERAGE', 'MANUFACTURING', 'PERSONAL_CARE', 'SERVICES'],
    governingAuthority: 'Goods and Services Tax Network (GSTN) / State & Central GST Commissionerate',
    statutoryAct: 'Central Goods and Services Tax Act, 2017 (Section 29 & Rule 20, 22)',
    portalUrl: 'https://www.gst.gov.in',
    renewalCycle: 'One-time on Business Closure / Cessation',
    advanceRenewalDays: 30,
    gracePeriodDays: 0,
    verificationTimestamp: '2026-11-05',
    verified: true,
    officialInstruction:
      'Application for cancellation of registration (Form GST REG-16) must be filed within 30 days of closure. Following cancellation order, Final Return (Form GSTR-10) must be filed within 3 months.',
    editorialExplanation:
      'Failure to file GSTR-10 after GST cancellation attracts automatic late fee accrual of ₹100 per day under Section 47 of CGST Act. Settle input tax credit reversal on unsold stock.'
  },
  {
    key: 'epfo_esic_deregistration',
    track: 'SECTOR_SPECIFIC',
    title: 'EPFO & ESIC Establishment Closure / Dormancy Intimation',
    categoryScope: ['MANUFACTURING', 'RETAIL', 'SERVICES'],
    governingAuthority: 'Employees\' Provident Fund Organisation & ESIC',
    statutoryAct: 'EPF & MP Act 1952 & ESI Act 1948',
    portalUrl: 'https://unifiedportal-emp.epfindia.gov.in',
    renewalCycle: 'One-time on Business Cessation',
    advanceRenewalDays: 30,
    gracePeriodDays: 0,
    verificationTimestamp: '2026-11-05',
    verified: true,
    officialInstruction:
      'Establishments closing down must intimate the regional EPF/ESIC commissioner, clear all pending employee contribution returns (ECR), and request establishment code deactivation.',
    editorialExplanation:
      'Never abandon an EPFO/ESIC code without formal closure. The portal assesses default 7A interest and 14B damages indefinitely against active codes with zero return filings.'
  }
];

export const AMENDMENT_REQUIREMENTS = {
  ADDRESS_CHANGE: {
    title: 'Amendment: Change of Business Premises / Relocation',
    officialRule:
      'Whenever an establishment changes its operational place of business, formal amendment applications must be submitted across all municipal and statutory registrations within 30 days of shifting.',
    editorialTip:
      'Do not operate at a new premises under an old address licence. Municipal squads can treat unauthorized addresses as unlicenced commercial trade.',
    evidenceChecklist: [
      {
        id: 'new_registered_lease_or_deed',
        label: 'Registered Lease Agreement or Ownership Title Deed',
        officialBasis: 'Proof of legal occupancy at the newly declared commercial address (stamp duty paid).',
        mandatory: true
      },
      {
        id: 'landlord_noc',
        label: 'No-Objection Certificate (NOC) from Property Owner',
        officialBasis: 'Mandatory if the applicant is a tenant or lessee for commercial operation.',
        mandatory: true
      },
      {
        id: 'new_electricity_bill',
        label: 'Recent Commercial Electricity / Utility Meter Bill',
        officialBasis: 'Shows commercial tariff category (non-domestic) and authentic consumer address.',
        mandatory: true
      },
      {
        id: 'property_tax_receipt',
        label: 'Municipal Property Tax Paid Receipt of New Premises',
        officialBasis: 'Verifies that the building is assessed to commercial property tax and free of municipal tax arrears.',
        mandatory: true
      },
      {
        id: 'premises_key_plan',
        label: 'Scaled Key Plan & Site Location Sketch',
        officialBasis: 'Annotates plinth area, entrance egress, and abutting road width in meters.',
        mandatory: false
      },
      {
        id: 'surrender_of_old_certificate',
        label: 'Physical Surrender / Endorsement of Prior Licence Certificate',
        officialBasis: 'Original certificate copy for departmental endorsement or replacement.',
        mandatory: true
      }
    ]
  },
  OWNERSHIP_CONSTITUTION_CHANGE: {
    title: 'Amendment: Change in Ownership, Partners or Business Constitution',
    officialRule:
      'Any transfer of business interest, induction/retirement of partners, restructuring into LLP/Private Limited, or death of a proprietor requires formal amendment or re-issuance under statutory provisions.',
    editorialTip:
      'If converting from Sole Proprietorship to Private Limited or LLP, a new PAN is issued. Most departments require a formal transfer application linked with an indemnity undertaking.',
    evidenceChecklist: [
      {
        id: 'partnership_deed_or_mca_certificate',
        label: 'Revised Partnership Deed / MCA Certificate of Incorporation',
        officialBasis: 'Legal charter evidencing new constitution and partner shareholdings.',
        mandatory: true
      },
      {
        id: 'dissolution_or_relinquishment_deed',
        label: 'Deed of Dissolution / Retirement / Relinquishment',
        officialBasis: 'Proof that outgoing partner/owner has relinquished commercial claims and liabilities.',
        mandatory: true
      },
      {
        id: 'transfer_indemnity_bond',
        label: 'Notarized Indemnity Bond on Non-Judicial Stamp Paper',
        officialBasis: 'Undertaking indemnifying the municipal corporation against past dues, tax claims, and civil disputes.',
        mandatory: true
      },
      {
        id: 'pan_card_transferee',
        label: 'PAN Card Copy of Transferee Entity / Incoming Partners',
        officialBasis: 'Statutory income tax identification for commercial records.',
        mandatory: true
      },
      {
        id: 'board_resolution_or_consent',
        label: 'Board Resolution / Written Consent of all Partners',
        officialBasis: 'Authorizing the designated signatory to represent the enterprise before licensing bodies.',
        mandatory: true
      }
    ]
  }
};

export const SUSPENSION_REQUIREMENTS = {
  title: 'Temporary Suspension & Voluntary Holding Protocol',
  officialRule:
    'Establishments suspending operations temporarily (seasonal trade, renovation, or litigation) may file for temporary suspension with the local municipal authority and Labour Department to preserve renewal priority without accruing daily default fines.',
  editorialTip:
    'Notify authorities in writing before the suspension starts. If an enforcement squad finds a locked shop without prior suspension intimation, they may assume illegal abandonment or issue revocation notices.',
  checkpoints: [
    {
      id: 'written_intimation',
      label: 'Written Intimation of Suspension to Municipal Ward Inspector',
      mandatory: true,
      description: 'Stating the anticipated dormancy period, reason (e.g. structural renovation), and contact details.'
    },
    {
      id: 'labour_retrenchment_compliance',
      label: 'Labour Act Compliance & Wage Settlement Notice',
      mandatory: true,
      description: 'Confirming that employee statutory wages and notice periods are settled under the Industrial Disputes Act.'
    },
    {
      id: 'utility_meter_safe_disconnect',
      label: 'Safe Meter Isolation / Dormancy Tariff Notice',
      mandatory: false,
      description: 'Notifying commercial electricity and water distribution companies to avoid minimum demand charge spikes.'
    },
    {
      id: 'showcause_rectification_file',
      label: 'Departmental Showcause Cure Response (If suspended by order)',
      mandatory: false,
      description: 'Formal point-by-point compliance petition curing any alleged sanitary or building violation.'
    }
  ]
};

export const CLOSURE_AND_SURRENDER_WORKFLOW = [
  {
    stepId: 'FINAL_DUES_CLEARANCE',
    title: 'Phase 1: Final Dues & Statutory Liabilities Settlement',
    officialRule:
      'Before a municipal or sector licence can be formally cancelled, all trailing dues, property taxes, electricity tariffs, and commercial levies must be settled in full.',
    editorialTip:
      'Obtain written "Zero Balance / No Dues" statements from your electricity board and municipal ward tax revenue cell. These are required attachments.',
    items: [
      {
        id: 'commercial_property_tax_dues',
        label: 'Municipal Commercial Property Tax No-Dues Receipt',
        department: 'Urban Local Body Revenue Cell',
        action: 'Pay all pending municipal property taxes up to the current assessment quarter and download receipt.'
      },
      {
        id: 'commercial_electricity_water_settlement',
        label: 'Electricity & Water Utility Final Meter Reading Clearance',
        department: 'State Electricity Board / Water Supply Board',
        action: 'Request final meter reading, pay closing adjustment bill, and obtain meter disconnection receipt.'
      },
      {
        id: 'commercial_rent_landlord_nodues',
        label: 'Commercial Landlord Final Rent Settlement & Security Refund NOC',
        department: 'Premises Owner',
        action: 'Obtain written clearance confirming surrender of possession and full discharge of rental dues.'
      }
    ]
  },
  {
    stepId: 'FORMAL_SURRENDER_FILING',
    title: 'Phase 2: Formal Licence Surrender & Cancellation Applications',
    officialRule:
      'Submit formal licence surrender applications along with original certificates to the respective licensing directorates within 30 days of business cessation.',
    editorialTip:
      'Most ULBs have an online "Surrender of Trade Licence" option. If offline, submit via registered speed post or physical ward counter with a delivery acknowledgement copy.',
    items: [
      {
        id: 'trade_licence_surrender_filing',
        label: 'Municipal Trade Licence Surrender Submission',
        department: 'Municipal Licensing Department',
        action: 'Submit Form for Trade Licence Surrender with the original licence certificate copy and closure affidavit.'
      },
      {
        id: 'shops_est_cancellation_filing',
        label: 'Shops & Establishments Notice of Closure (Form C / Closure Notice)',
        department: 'State Labour Department',
        action: 'Submit Notice of Closure within 15 days of closing down, stating date of closure and employee settlement details.'
      },
      {
        id: 'fssai_surrender_portal',
        label: 'FSSAI Licence Surrender via FoSCoS Portal',
        department: 'FSSAI Licensing Authority',
        action: 'Login to FoSCoS, select "Surrender of Licence/Registration", state reason as business closure, and submit OTP.'
      },
      {
        id: 'gst_cancellation_reg16',
        label: 'GSTIN Cancellation Application (Form GST REG-16)',
        department: 'GST Commissionerate',
        action: 'File REG-16 on GST portal stating business closure. File GSTR-10 Final Return within 90 days of order.'
      }
    ]
  },
  {
    stepId: 'SURRENDER_ACKNOWLEDGEMENT_RETAINER',
    title: 'Phase 3: Surrender Acknowledgement Tracking & Permanent Archival',
    officialRule:
      'Business proprietors must secure and retain formal Departmental Surrender Acknowledgement Orders. A mere filing does not constitute legal cancellation until endorsed by the competent authority.',
    editorialTip:
      'Keep your stamped acknowledgement receipts, GSTR-10 acknowledgment, and ward surrender receipts saved permanently (minimum 7 years) to shield against false retrospective penalty notices.',
    items: [
      {
        id: 'municipal_surrender_ack_order',
        label: 'Municipal Stamped / Digital Surrender Acknowledgement Order',
        department: 'Municipal Corporation',
        action: 'Download or collect formal cancellation endorsement bearing date, officer seal, and file cancellation number.'
      },
      {
        id: 'labour_cancellation_ack',
        label: 'Labour Department Stamped Closure Endorsement',
        department: 'Labour Department',
        action: 'Secure Form C cancellation acknowledgement receipt from the Chief Inspector of Shops.'
      },
      {
        id: 'gstr10_filing_arn',
        label: 'GSTR-10 Final Return Filing ARN & Cancellation Order (REG-19)',
        department: 'Goods & Services Tax Network',
        action: 'Archive the Form GST REG-19 Cancellation Order along with the GSTR-10 Application Reference Number (ARN).'
      }
    ]
  }
];

