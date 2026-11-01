/**
 * Civic Service Acronym Directory (#263)
 *
 * A single, reusable source of acronym and abbreviation definitions used
 * across civic service guides. Each entry stores the acronym, its expanded
 * form, a plain-language explanation, and the related service IDs it links
 * back to. Entries are maintained here so glossary text is never duplicated
 * across components.
 *
 * The `relatedServiceIds` reference service ids from the service catalogue
 * (src/data/services.js). Unknown acronyms are intentionally absent: they are
 * never expanded by guessing.
 */

export const CIVIC_ACRONYMS = [
  {
    id: 'bpl',
    acronym: 'BPL',
    expandedForm: 'Below Poverty Line',
    plainLanguageExplanation: 'An economic category used by state governments to identify families eligible for the highest level of subsidies, free rations, and fee waivers on civic certificates.',
    relatedServiceIds: ['ration-card', 'income-certificate'],
  },
  {
    id: 'noc',
    acronym: 'NOC',
    expandedForm: 'No Objection Certificate',
    plainLanguageExplanation: 'A formal letter from a department, bank, or employer stating they have no objections or pending dues regarding your application or transaction.',
    relatedServiceIds: ['driving-license', 'passport'],
  },
  {
    id: 'ews',
    acronym: 'EWS',
    expandedForm: 'Economically Weaker Section',
    plainLanguageExplanation: 'A certificate confirming a family\'s income and assets fall under the government limit, making them eligible for 10% reservation in general-category seats.',
    relatedServiceIds: ['income-certificate'],
  },
  {
    id: 'poi',
    acronym: 'POI',
    expandedForm: 'Proof of Identity',
    plainLanguageExplanation: 'An official document that establishes who you are, such as an Aadhaar card, PAN card, passport, or Voter ID.',
    relatedServiceIds: ['aadhaar-card', 'passport', 'voter-id'],
  },
  {
    id: 'poa',
    acronym: 'POA',
    expandedForm: 'Proof of Address',
    plainLanguageExplanation: 'An official document showing where you permanently live, such as a passport, utility bill, or bank statement.',
    relatedServiceIds: ['aadhaar-card', 'passport'],
  },
  {
    id: 'ifsc',
    acronym: 'IFSC',
    expandedForm: 'Indian Financial System Code',
    plainLanguageExplanation: 'An 11-character code that uniquely identifies a specific bank branch so government subsidies and payments reach the correct account.',
    relatedServiceIds: ['pm-kisan'],
  },
  {
    id: 'uan',
    acronym: 'UAN',
    expandedForm: 'Universal Account Number',
    plainLanguageExplanation: 'A unique number given to every EPF member that links all their provident fund accounts across different employers.',
    relatedServiceIds: ['pf-withdrawal'],
  },
  {
    id: 'eid',
    acronym: 'EID',
    expandedForm: 'Enrollment ID',
    plainLanguageExplanation: 'A 14-digit number given when you enroll for Aadhaar, used to track the status of your Aadhaar application.',
    relatedServiceIds: ['aadhaar-card'],
  },
  {
    id: 'epic',
    acronym: 'EPIC',
    expandedForm: 'Electoral Photo Identity Card',
    plainLanguageExplanation: 'The official Voter ID card issued by the Election Commission that allows you to cast a vote in elections.',
    relatedServiceIds: ['voter-id'],
  },
  {
    id: 'psk',
    acronym: 'PSK',
    expandedForm: 'Passport Seva Kendra',
    plainLanguageExplanation: 'A government centre where you submit your passport application documents and complete biometric verification.',
    relatedServiceIds: ['passport'],
  },
  {
    id: 'rto',
    acronym: 'RTO',
    expandedForm: 'Regional Transport Office',
    plainLanguageExplanation: 'The government office that handles vehicle registration, driving licences, and road transport permits.',
    relatedServiceIds: ['driving-license'],
  },
  {
    id: 'csc',
    acronym: 'CSC',
    expandedForm: 'Common Services Centre',
    plainLanguageExplanation: 'A local digital service centre where citizens can apply for government schemes and certificates online.',
    relatedServiceIds: ['pm-kisan'],
  },
  {
    id: 'rti',
    acronym: 'RTI',
    expandedForm: 'Right to Information',
    plainLanguageExplanation: 'A law that lets citizens request information from government departments and receive a reply within a fixed time limit.',
    relatedServiceIds: ['public-grievance'],
  },
  {
    id: 'dbt',
    acronym: 'DBT',
    expandedForm: 'Direct Benefit Transfer',
    plainLanguageExplanation: 'A system that sends government subsidies and benefits directly into a citizen\'s bank account, cutting out middlemen.',
    relatedServiceIds: ['pm-kisan'],
  },
  {
    id: 'epfo',
    acronym: 'EPFO',
    expandedForm: "Employees' Provident Fund Organisation",
    plainLanguageExplanation: 'The government body that manages provident fund and pension savings for salaried employees.',
    relatedServiceIds: ['pf-withdrawal'],
  },
  {
    id: 'uidai',
    acronym: 'UIDAI',
    expandedForm: 'Unique Identification Authority of India',
    plainLanguageExplanation: 'The government authority that issues Aadhaar numbers and manages the Aadhaar database.',
    relatedServiceIds: ['aadhaar-card'],
  },
  {
    id: 'nsdl',
    acronym: 'NSDL',
    expandedForm: 'National Securities Depository Limited',
    plainLanguageExplanation: 'A government-authorized entity that processes PAN card applications and issues PAN cards.',
    relatedServiceIds: ['pan-card'],
  },
];
