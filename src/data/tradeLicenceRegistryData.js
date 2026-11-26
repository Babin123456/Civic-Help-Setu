/**
 * @file tradeLicenceRegistryData.js
 * @description Clear differentiation between municipal trade licences, Shops & Establishments registrations,
 * FSSAI food licences, and GST registrations. Includes renewal windows and municipal authority portals.
 */

export const MUNICIPAL_TRADE_LICENCE_DATA = [
  {
    jurisdictionId: 'IN-KA-BLR',
    city: 'Bengaluru',
    administeringAuthority: 'Bruhat Bengaluru Mahanagara Palike (BBMP) Health Wing',
    portalUrl: 'https://tradelicence.bbmpgov.in',
    renewalCycleMonths: 12,
    renewalDeadlineMonth: 'February 28 annually (without fine)',
    standardDocuments: [
      'Property Tax paid receipt of commercial premises for current fiscal year',
      'Lease/Rent Agreement or Consent letter from property owner',
      'Power Sanction letter / BESCOM electricity bill in commercial tariff',
      'Sanathan/Occupancy certificate or building sanction plan',
      'Pollution Control Board (KSPCB) consent / Fire NOC (for notified hazardous/large trades)'
    ],
    sampleFeeSlabs: [
      { businessType: 'Retail Grocery Store (up to 200 sq ft)', annualFeeINR: 1500 },
      { businessType: 'Bakery / Eatery with cooking power up to 5 HP', annualFeeINR: 4500 },
      { businessType: 'Hardware / Electrical Spares Shop', annualFeeINR: 3000 }
    ],
    lastVerifiedDate: '2026-03-01'
  },
  {
    jurisdictionId: 'IN-DL-MCD',
    city: 'Delhi',
    administeringAuthority: 'Municipal Corporation of Delhi (MCD) Factory/General Trade Licensing Department',
    portalUrl: 'https://mcdonline.nic.in/tradelicense',
    renewalCycleMonths: 12,
    renewalDeadlineMonth: 'March 31 annually',
    standardDocuments: [
      'Proof of legal possession (Registered Lease Deed / GPA / Title Deed)',
      'Site plan and key plan showing covered area in square meters',
      'Identity proof of proprietor/partner (PAN and Aadhaar)',
      'Conversion and parking charges clearance receipt from MCD'
    ],
    sampleFeeSlabs: [
      { businessType: 'General Trade Shop (up to 15 sq meters)', annualFeeINR: 1200 },
      { businessType: 'Restaurants / Food Establishments', annualFeeINR: 6000 }
    ],
    lastVerifiedDate: '2026-02-28'
  }
];

export const DISTINCT_BUSINESS_REGISTRATIONS = [
  {
    registrationName: 'Municipal Trade Licence',
    administeringAuthority: 'City Municipal Corporation / Municipality',
    purpose: 'Certifies that the specific trade activity does not create health hazards, offensive nuisance, or fire risk in the municipal ward.',
    statutoryAct: 'State Municipal Corporation Act'
  },
  {
    registrationName: 'Shops & Commercial Establishments Act Registration',
    administeringAuthority: 'State Labour Department',
    purpose: 'Regulates working hours, weekly holidays, overtime, wages, and working conditions of shop employees.',
    statutoryAct: 'State Shops & Commercial Establishments Act'
  },
  {
    registrationName: 'FSSAI Food Safety Licence / Registration',
    administeringAuthority: 'Food Safety and Standards Authority of India (FSSAI)',
    purpose: 'Mandatory for any business manufacturing, storing, distributing, or selling food items.',
    statutoryAct: 'Food Safety and Standards Act, 2006'
  },
  {
    registrationName: 'Goods and Services Tax (GST) Registration',
    administeringAuthority: 'Central Board of Indirect Taxes and Customs (CBIC) / State Commercial Tax Dept',
    purpose: 'Taxation of goods and services turnover exceeding statutory threshold (₹40L for goods, ₹20L for services).',
    statutoryAct: 'Central Goods and Services Tax Act, 2017'
  }
];
