/**
 * @file propertyTaxRulesData.js
 * @description Municipal property tax assessment formulas, early-bird rebates, senior citizen / defense exemptions,
 * and dispute rectification procedures across Indian local bodies (BBMP Bengaluru, MCD Delhi, BMC Mumbai).
 */

export const MUNICIPAL_PROPERTY_TAX_RULES = [
  {
    jurisdictionId: 'IN-KA-BLR',
    municipality: 'Bruhat Bengaluru Mahanagara Palike (BBMP)',
    assessmentSystem: 'Unit Area Value (UAV) / Capital Value Hybrid',
    portalUrl: 'https://bbmptax.karnataka.gov.in',
    rebates: [
      {
        name: 'Early Bird Full Payment Rebate',
        discountPercentage: 5,
        deadlineDescription: 'Applicable when full annual tax is paid within the first month of the financial year (April 30).'
      }
    ],
    exemptions: [
      'Places of public worship (temples, mosques, churches) registered as non-profit charitable trusts.',
      'Recognized educational institutions solely used for academic instruction.',
      'Ex-servicemen and war widows (subject to zonal revenue officer certification).'
    ],
    disputeChannel: {
      firstStep: 'File Form-V / Objections with Assistant Revenue Officer (ARO) within 30 days of Special Notice of Assessment.',
      appellateAuthority: 'Joint Commissioner (Revenue) / Karnataka Administrative Tribunal'
    },
    paymentReceiptVerification: 'Verify 10-digit Application Number and 10-digit PID/SAS number on e-receipt.'
  },
  {
    jurisdictionId: 'IN-DL-MCD',
    municipality: 'Municipal Corporation of Delhi (MCD)',
    assessmentSystem: 'Unit Area Method (UAM)',
    portalUrl: 'https://mcdonline.nic.in',
    rebates: [
      {
        name: 'Lump Sum Early Payment Rebate',
        discountPercentage: 10,
        deadlineDescription: 'Available for one-time payment of annual tax before June 30.'
      },
      {
        name: 'Senior Citizen / Women / Specially-Abled Rebate',
        discountPercentage: 30,
        deadlineDescription: 'Available up to 100 sq meters covered area for self-occupied residential property.'
      }
    ],
    exemptions: [
      'Agricultural land and buildings used exclusively for agricultural storage.',
      'Heritage structures maintained without commercial rent.'
    ],
    disputeChannel: {
      firstStep: 'Lodge rectification request under Section 123D with Joint Assessor & Collector.',
      appellateAuthority: 'Municipal Taxation Tribunal (MTT)'
    },
    paymentReceiptVerification: 'Verify Unique Property Identification Code (UPIC) and G-8 cash/online receipt counterfoil.'
  }
];

export const PROPERTY_TAX_GLOSSARY = [
  { term: 'Annual Rateable Value (ARV)', definition: 'The estimated gross annual rent that a property might reasonably be expected to fetch if let out from year to year.' },
  { term: 'Unit Area Value (UAV)', definition: 'A predetermined per-square-foot tax rate fixed by the municipality based on street category, structural type, and usage.' },
  { term: 'SAS / Self-Assessment Scheme', definition: 'System allowing property owners to calculate their own liability and declare changes in built-up area or tenancy status.' },
  { term: 'Arrears & Penal Interest', definition: 'Unpaid tax from previous financial years carrying statutory compound interest (typically 2% per month) until cleared.' }
];
