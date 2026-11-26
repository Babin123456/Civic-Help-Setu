/**
 * UP Birth-and-Death Registration Correction and Delayed-Entry Navigator Service
 * 
 * Guides citizens through the Registration of Births and Deaths (RBD) Act, 1969
 * and Uttar Pradesh Registration of Births and Deaths Rules, 2002.
 * 
 * Covers:
 * - Timely registration (within 21 days - Free of charge)
 * - Delayed registration under Section 13:
 *   - Tier 1: 21 to 30 days (Late fee, Registrar approval)
 *   - Tier 2: 30 days to 1 year (Late fee, Sub-Divisional Magistrate / Tehsildar permission)
 *   - Tier 3: Beyond 1 year (Sub-Divisional Magistrate / First Class Magistrate court order)
 * - Correction of clerical, formal, or fraudulent entries under Section 15 & Rule 11
 * - Clear bifurcation between institutional events (Hospital CMS / Medical Record Officer)
 *   vs domiciliary (home) events (Gram Panchayat Secretary / Municipal Registrar)
 * - Evidence pack generation & magistrate affidavit templates without harvesting minor PII
 */

export const UP_REGISTRATION_AUTHORITIES = {
  RURAL: {
    registrar: 'Gram Vikas Adhikari (GVA) / Panchayat Secretary',
    jurisdiction: 'Gram Panchayat (Village level)',
    higherAuthority: 'Assistant Development Officer (Panchayat) / BDO'
  },
  URBAN: {
    registrar: 'Health Officer / Registrar of Births & Deaths, Nagar Nigam / Palika',
    jurisdiction: 'Urban Local Body (Municipal limits)',
    higherAuthority: 'Municipal Commissioner / Additional Municipal Commissioner'
  },
  INSTITUTIONAL: {
    registrar: 'Medical Superintendent / CMS / In-Charge Medical Officer',
    jurisdiction: 'District Hospital / CHC / PHC / Medical College / Private Nursing Home',
    higherAuthority: 'Chief Medical Officer (CMO)'
  }
};

export const DELAYED_REGISTRATION_TIERS = {
  ON_TIME: {
    tier: 'ON_TIME',
    minDays: 0,
    maxDays: 21,
    authority: 'Local Registrar (Panchayat / Nagar Nigam / Hospital)',
    statutoryFeeINR: 0,
    requirements: ['Informant Form 1 (Birth) or Form 2 (Death)', 'Hospital discharge card or Gram Pradhan verification']
  },
  DELAYED_21_TO_30_DAYS: {
    tier: 'DELAYED_21_TO_30_DAYS',
    minDays: 22,
    maxDays: 30,
    authority: 'Local Registrar with prescribed late fee',
    statutoryFeeINR: 2,
    requirements: ['Prescribed Form', 'Late payment receipt', 'Self-declaration explaining 21-day delay']
  },
  DELAYED_30_TO_365_DAYS: {
    tier: 'DELAYED_30_TO_365_DAYS',
    minDays: 31,
    maxDays: 365,
    authority: 'Sub-Divisional Magistrate (SDM) / Tehsildar Permission',
    statutoryFeeINR: 5,
    requirements: [
      'Written permission order from SDM / Tehsildar',
      'Affidavit before Notary Public stating reason for delay',
      'Non-Availability Certificate (NAC / Form 10) from Registrar confirming no prior entry',
      'Immunization card / School TC or cremation ground / doctor death memo'
    ]
  },
  DELAYED_OVER_1_YEAR: {
    tier: 'DELAYED_OVER_1_YEAR',
    minDays: 366,
    maxDays: 36500,
    authority: 'First Class Magistrate / Sub-Divisional Magistrate (SDM) Court Order',
    statutoryFeeINR: 10,
    requirements: [
      'Formal Judicial / Executive Magistrate Inquiry Order under Section 13(3) of RBD Act',
      'Non-Availability Certificate (Form 10) issued by concerned Local Registrar',
      'Notarized affidavit on ₹10 non-judicial e-stamp paper with witness declarations',
      'Police station non-objection or Lekhpal field inquiry report (Mauka Aakhiya)',
      'School transfer certificate, age proof, or burial/cremation receipt'
    ]
  }
};

export const CORRECTION_TYPES = {
  CLERICAL_OR_TYPOGRAPHICAL: {
    code: 'CLERICAL_OR_TYPOGRAPHICAL',
    description: 'Minor spelling mistake in name of child, parent, or date of birth transcribing error.',
    rule: 'Section 15 of RBD Act & Rule 11 of UP RBD Rules, 2002',
    approvingAuthority: 'Local Registrar (requires 2 credible witnesses who were present at the event)',
    evidenceRequired: [
      'Declaration by 2 respectable persons residing in the same village/ward',
      'Hospital discharge summary or school board marksheet proving true spelling',
      'Original incorrect certificate to be surrendered for cancellation'
    ]
  },
  SUBSTANTIAL_NAME_CHANGE_OR_ADOPTION: {
    code: 'SUBSTANTIAL_NAME_CHANGE_OR_ADOPTION',
    description: 'Correction in parentage, formal adoption order, or substantial name change.',
    rule: 'Rule 11(4) of UP RBD Rules',
    approvingAuthority: 'District Registrar / Chief Medical Officer / Competent Civil Court',
    evidenceRequired: [
      'Certified copy of registered Adoption Deed or Court Decree',
      'State Gazette notification copy for name changes',
      'Magistrate order'
    ]
  }
};

/**
 * Calculates statutory delayed registration tier and roadmap based on elapsed days.
 * @param {string|Date} eventDate 
 * @returns {Object} delay roadmap
 */
export function determineDelayedRegistrationTier(eventDate) {
  const eDate = new Date(eventDate);
  if (isNaN(eDate.getTime())) {
    return {
      error: 'Valid event date (birth or death) is required to determine statutory pathway.',
      isCalculable: false
    };
  }

  const now = new Date();
  const msDiff = now.getTime() - eDate.getTime();
  const elapsedDays = Math.max(0, Math.floor(msDiff / (1000 * 60 * 60 * 24)));

  let tier = DELAYED_REGISTRATION_TIERS.DELAYED_OVER_1_YEAR;
  if (elapsedDays <= 21) tier = DELAYED_REGISTRATION_TIERS.ON_TIME;
  else if (elapsedDays <= 30) tier = DELAYED_REGISTRATION_TIERS.DELAYED_21_TO_30_DAYS;
  else if (elapsedDays <= 365) tier = DELAYED_REGISTRATION_TIERS.DELAYED_30_TO_365_DAYS;

  return {
    isCalculable: true,
    elapsedDays,
    tier: tier.tier,
    authority: tier.authority,
    statutoryFeeINR: tier.statutoryFeeINR,
    requirements: tier.requirements,
    requiresMagistrateOrder: tier.tier === 'DELAYED_OVER_1_YEAR',
    requiresNonAvailabilityCertificate: elapsedDays > 30
  };
}

/**
 * Evaluates certificate correction requirements under Section 15 of RBD Act.
 * @param {'CLERICAL_OR_TYPOGRAPHICAL'|'SUBSTANTIAL_NAME_CHANGE_OR_ADOPTION'} correctionType 
 * @returns {Object} correction procedure
 */
export function getCorrectionRequirements(correctionType) {
  const procedure = CORRECTION_TYPES[correctionType] || CORRECTION_TYPES.CLERICAL_OR_TYPOGRAPHICAL;
  return {
    ...procedure,
    procedureNote: 'Under Section 15 of the Registration of Births and Deaths Act, 1969, the Registrar does not erase the original register entry, but enters a marginal entry correcting the error, signed and dated.'
  };
}

/**
 * Generates ready-to-print affidavit draft for delayed entry before Sub-Divisional Magistrate.
 * @param {Object} details 
 * @returns {string} markdown affidavit draft
 */
export function exportDelayedRegistrationAffidavit(details = {}) {
  return [
    `# Sworn Affidavit for Delayed Birth/Death Registration under Section 13(3) of RBD Act, 1969`,
    `*(To be executed on ₹10 Non-Judicial e-Stamp Paper before an Executive / Notary Magistrate)*`,
    ``,
    `**Before the Court of:** Sub-Divisional Magistrate (SDM), Tehsil: ${details.tehsil || 'Sadar'}, District: ${details.district || 'Uttar Pradesh'}`,
    ``,
    `I, **${details.deponentName || 'Deponent'}**, Aged about ${details.deponentAge || 35} years, Resident of ${details.address || 'Village/Ward, UP'}, do hereby solemnly affirm and declare on oath as follows:`,
    ``,
    `1. That on **${details.eventDate || 'DD/MM/YYYY'}**, a ${details.eventType === 'DEATH' ? 'death' : 'birth'} occurred at ${details.eventPlace || 'Home / Village'}.`,
    `2. That the name of the ${details.eventType === 'DEATH' ? 'deceased person' : 'child'} is **${details.subjectName || 'Name'}**, and parentage / relation is **${details.relationName || 'Father / Spouse'}**.`,
    `3. That due to **${details.delayReason || 'lack of legal awareness and rural circumstances'}**, the registration could not be recorded with the local Registrar within the statutory period of 21 days.`,
    `4. That the deponent has obtained a **Non-Availability Certificate (Form 10)** from the Local Registrar confirming that this event has not been registered anywhere previously.`,
    `5. That the facts stated above are true and correct to the best of my personal knowledge and belief, and no material fact has been concealed.`,
    ``,
    `**Verification:**`,
    `Verified at ${details.district || 'District'} on this ${new Date().toLocaleDateString('en-IN')} that the contents of paragraphs 1 to 5 are true and correct.`,
    ``,
    `**Deponent Signature**`,
    `Identified by Advocate: ____________________`
  ].join('\n');
}


export const UP_RBD_FAQS = [
  {
    q: 'Can a birth occurring in a private nursing home be registered at home?',
    a: 'No. Events occurring in institutional medical facilities (hospital/nursing home) must be registered by the hospital In-Charge directly on crsorgi.gov.in.'
  },
  {
    q: 'Can a death certificate be obtained without a cremation/burial receipt?',
    a: 'For home deaths, a certificate from the Gram Pradhan, Ward Councillor, or two neighbor witness affidavits along with Doctor\'s slip can substantiate the event.'
  },
  {
    q: 'How many days does an SDM court inquiry take for births delayed beyond 1 year?',
    a: 'Under the UP Janhit Guarantee Adhiniyam, an inquiry for delayed registration under Section 13(3) carries a guaranteed timeline of 30 working days.'
  },
  {
    q: 'What is the fee for an official extract/copy of a birth or death certificate?',
    a: 'The first copy issued during timely registration is free. Subsequent certified copies carry a nominal fee of ₹10 per copy.'
  }
];

export const UP_RBD_EVIDENCE_CHECKLIST = {
  HOME_BIRTH: [
    'Written declaration of parent/informant (Form 1)',
    'Vaccination / Mother and Child Protection (MCP) card',
    'Gram Pradhan or Ward Councillor certificate of birth',
    'Parents\' identity proofs (Voter ID / Ration Card / Aadhaar copy)'
  ],
  HOME_DEATH: [
    'Written declaration of legal heir/informant (Form 2)',
    'Medical cause of death certificate from attending Registered Medical Practitioner (Form 4A)',
    'Cremation ground / Kabristan receipt or Gram Panchayat verification',
    'Identity proof of the deceased and informant'
  ]
};

/**
 * Returns procedural FAQs for UP birth & death registration.
 * @returns {Array<{q: string, a: string}>}
 */
export function getRbdFaqs() {
  return UP_RBD_FAQS;
}

/**
 * Returns evidence checklist for home events.
 * @param {'HOME_BIRTH'|'HOME_DEATH'} eventType 
 * @returns {Array<string>} checklist items
 */
export function getRbdEvidenceChecklist(eventType) {
  return UP_RBD_EVIDENCE_CHECKLIST[eventType] || [];
}
