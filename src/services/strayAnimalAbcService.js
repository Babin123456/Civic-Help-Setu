/**
 * strayAnimalAbcService.js
 *
 * Implements statutory and clinical algorithms for:
 * 1. Rabies Post-Exposure Prophylaxis (PEP) Engine under WHO & National Rabies Control Programme (NRCP) Guidelines.
 * 2. Animal Birth Control (ABC) Rules, 2023 Ward Compliance Auditor (PCA Act, 1960).
 * 3. Community Pet & Street Feeder Regulatory Charter under Rule 20 of ABC Rules 2023.
 * 4. Statutory Requisitions to Municipal Authorities & RWA Anti-Relocation Legal Notices.
 */

/**
 * WHO / NRCP Exposure Categories
 */
export const RABIES_EXPOSURE_CATEGORIES = {
  CATEGORY_I: {
    id: 'CATEGORY_I',
    label: 'Category I (No Exposure)',
    description: 'Touching or feeding animals, animal licks on intact skin without contact with mucous membranes.',
    riskLevel: 'None',
    pepRequired: false,
    rigRequired: false,
    recommendedAction: 'Wash exposed skin surfaces with soap and running water. No vaccine or RIG indicated.',
  },
  CATEGORY_II: {
    id: 'CATEGORY_II',
    label: 'Category II (Minor Exposure)',
    description: 'Minor scratches or abrasions without bleeding, nibbling of uncovered skin.',
    riskLevel: 'Moderate',
    pepRequired: true,
    rigRequired: false,
    recommendedAction: 'Immediate thorough wound washing with soap and running water for >= 15 minutes. Immediate antiseptic application (povidone-iodine). Anti-Rabies Vaccine (ARV) series mandatory. RIG not indicated unless patient is immunocompromised.',
  },
  CATEGORY_III: {
    id: 'CATEGORY_III',
    label: 'Category III (Severe Exposure)',
    description: 'Single or multiple transdermal bites or scratches, licks on broken skin, contamination of mucous membrane with saliva, exposures to bats.',
    riskLevel: 'High / Critical',
    pepRequired: true,
    rigRequired: true,
    recommendedAction: 'Immediate wound washing with soap and running water for >= 15 minutes. Immediate antiseptic application. Anti-Rabies Vaccine (ARV) series mandatory AND Rabies Immunoglobulin (RIG) local infiltration directly into and around all wounds mandatory.',
  },
};

/**
 * Anti-Rabies Vaccination (ARV) Regimens approved by WHO / NRCP India
 */
export const ARV_REGIMENS = {
  ESSEN_IM: {
    id: 'ESSEN_IM',
    label: 'Essen Regimen (Intramuscular - 5 Doses)',
    route: 'Intramuscular (IM)',
    site: 'Deltoid muscle (adults/children >= 2 yrs) or anterolateral thigh (infants). NEVER inject into gluteal region.',
    doseVolume: '1.0 mL or 0.5 mL (per manufacturer recommendation)',
    dayOffsets: [0, 3, 7, 14, 28],
    description: 'Standard 5-dose intramuscular schedule on Days 0, 3, 7, 14, and 28.',
  },
  THAI_RED_CROSS_ID: {
    id: 'THAI_RED_CROSS_ID',
    label: 'Thai Red Cross Regimen (Intradermal - 2 Sites, 4 Visits)',
    route: 'Intradermal (ID)',
    site: '2 separate anatomical sites (bilateral deltoids)',
    doseVolume: '0.1 mL per site (0.2 mL total per visit)',
    dayOffsets: [0, 3, 7, 28],
    description: 'WHO-recommended dose-sparing intradermal regimen on Days 0, 3, 7, and 28.',
  },
  ZAGREB_IM: {
    id: 'ZAGREB_IM',
    label: 'Zagreb Regimen (Intramuscular - 2-1-1 Regimen, 3 Visits)',
    route: 'Intramuscular (IM)',
    site: 'Bilateral deltoids on Day 0; single deltoid on Days 7 and 21.',
    doseVolume: '2 doses Day 0 (different sites), 1 dose Day 7, 1 dose Day 21.',
    dayOffsets: [0, 7, 21],
    description: 'Accelerated 4-dose schedule: 2 doses on Day 0, 1 dose on Day 7, and 1 dose on Day 21.',
  },
};

/**
 * Rabies Immunoglobulin (RIG) Types and Potencies
 */
export const RIG_TYPES = {
  HRIG: {
    id: 'HRIG',
    label: 'Human Rabies Immunoglobulin (HRIG)',
    dosePerKgIu: 20, // 20 IU/kg body weight
    potencyIuPerMl: 150, // Standard 150 IU/mL
    advantage: 'Homologous origin, virtually zero risk of serum sickness or anaphylaxis. No skin testing needed.',
  },
  ERIG: {
    id: 'ERIG',
    label: 'Equine Rabies Immunoglobulin (ERIG)',
    dosePerKgIu: 40, // 40 IU/kg body weight
    potencyIuPerMl: 300, // Standard 300 IU/mL (purified F(ab\')2 fragments)
    advantage: 'Readily available at public hospitals, highly effective, economical.',
  },
};

/**
 * Animal Birth Control (ABC) Rules 2023 Ward Checkpoints
 */
export const ABC_WARD_CHECKPOINTS = [
  {
    id: 'monitoring_committee',
    title: 'Ward / Local ABC Monitoring Committee Constituted',
    ruleCitation: 'Rule 11(1) ABC Rules 2023',
    description: 'Mandatory committee comprising Municipal Commissioner, Veterinary Officer, SPCA representative, and 2 animal welfare NGO members.',
    mandatory: true,
  },
  {
    id: 'humane_capture',
    title: 'Humane Capture via Butterfly Nets / Sacking (No Wire Loops)',
    ruleCitation: 'Rule 11(4) ABC Rules 2023',
    description: 'Capturing dogs using wire loops, metal tongs, or cruel methods is strictly prohibited. Humane butterfly nets must be used.',
    mandatory: true,
  },
  {
    id: 'pre_op_veterinary_inspection',
    title: 'Pre-Operative Veterinary Health Screening & Quarantine',
    ruleCitation: 'Rule 11(7) ABC Rules 2023',
    description: 'Only healthy dogs aged above 6 months can be sterilized. Pups, sick, or pregnant dogs must not undergo surgery.',
    mandatory: true,
  },
  {
    id: 'ear_notching_identification',
    title: 'Permanent "V-Notch" Ear Tagging for Sterilized Dogs',
    ruleCitation: 'Rule 11(9) ABC Rules 2023',
    description: 'Right ear V-notch cut under anesthesia as permanent universal visible sign that the dog is sterilized and anti-rabies vaccinated.',
    mandatory: true,
  },
  {
    id: 'anti_rabies_vaccination',
    title: 'Mandatory Anti-Rabies Vaccination (ARV) during Surgery',
    ruleCitation: 'Rule 11(10) ABC Rules 2023',
    description: 'Every captured animal must receive an anti-rabies vaccine dose before post-operative recovery.',
    mandatory: true,
  },
  {
    id: 'post_op_hospitalization',
    title: 'Post-Operative Housing & Healing (3 to 4 Days)',
    ruleCitation: 'Rule 11(11) ABC Rules 2023',
    description: 'Dogs must be housed in clean, ventilated kennels with food and water until surgical incision is healed and sutures removed.',
    mandatory: true,
  },
  {
    id: 'same_territory_release',
    title: 'Mandatory Release into the EXACT SAME Territory / Street',
    ruleCitation: 'Rule 11(16) ABC Rules 2023',
    description: 'Sterilized and vaccinated dogs must be released back into the exact spot/colony from which they were captured. Relocation is illegal.',
    mandatory: true,
  },
];

/**
 * Calculates calendar dates for Anti-Rabies Vaccination based on exposure date and regimen.
 *
 * @param {string|Date} exposureDate Date of animal bite / exposure
 * @param {string} [regimenKey='ESSEN_IM'] Key from ARV_REGIMENS
 * @returns {Array<Object>} Scheduled vaccine appointments
 */
export function calculateVaccinationSchedule(exposureDate, regimenKey = 'ESSEN_IM') {
  const baseDate = exposureDate ? new Date(exposureDate) : new Date();
  if (isNaN(baseDate.getTime())) {
    throw new Error('Invalid exposure date provided');
  }

  const regimen = ARV_REGIMENS[regimenKey] || ARV_REGIMENS.ESSEN_IM;

  return regimen.dayOffsets.map((dayOffset) => {
    const scheduledDate = new Date(baseDate);
    scheduledDate.setDate(scheduledDate.getDate() + dayOffset);

    let doseDescription = `Day ${dayOffset} Dose`;
    if (regimenKey === 'ZAGREB_IM' && dayOffset === 0) {
      doseDescription = 'Day 0 (2 Doses: Bilateral Deltoids)';
    }

    return {
      dayOffset,
      doseDescription,
      dateString: scheduledDate.toISOString().slice(0, 10),
      displayDate: scheduledDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      route: regimen.route,
      anatomicalSite: regimen.site,
    };
  });
}

/**
 * Computes Rabies Immunoglobulin (RIG) weight-based dosage for Category III exposures.
 *
 * @param {Object} params
 * @param {number} params.weightKg Patient body weight in kilograms
 * @param {string} [params.rigType='HRIG'] 'HRIG' or 'ERIG'
 * @returns {Object} Calculated RIG units and clinical volume
 */
export function calculateRigDosage({ weightKg = 0, rigType = 'HRIG' }) {
  const weight = Math.max(1, Number(weightKg) || 0);
  const selectedRig = RIG_TYPES[rigType] || RIG_TYPES.HRIG;

  const totalIuRequired = Math.round(weight * selectedRig.dosePerKgIu);
  const volumeMlRequired = parseFloat((totalIuRequired / selectedRig.potencyIuPerMl).toFixed(1));

  return {
    patientWeightKg: weight,
    rigType: selectedRig.id,
    rigLabel: selectedRig.label,
    dosePerKgIu: selectedRig.dosePerKgIu,
    totalIuRequired,
    potencyIuPerMl: selectedRig.potencyIuPerMl,
    volumeMlRequired,
    clinicalInfiltrationRule: 'Infiltrate as much of the total calculated volume as anatomically feasible directly in and around all bite wounds. If any residual volume remains, administer intramuscularly at an anatomical site distant from the vaccine site (e.g., opposite arm or thigh). NEVER inject RIG in the same syringe or same anatomical site as the anti-rabies vaccine.',
    firstAidImmediateInstructions: [
      'Immediately wash the wound with soap and copious running water for at least 15 minutes.',
      'Apply povidone-iodine, chlorhexidine, or surgical spirit. Do not apply irritants (chili powder, turmeric, kerosene).',
      'Do NOT immediately suture the wound. If suturing is unavoidable, apply loose stay sutures only after thorough RIG infiltration.',
      'Check Tetanus Toxoid (TT) vaccination status and administer booster if indicated.',
    ],
  };
}

/**
 * Evaluates Animal Birth Control (ABC) compliance and generates anti-relocation statutory warnings.
 *
 * @param {Object} auditData
 * @param {string} [auditData.wardNumber=''] Ward or locality name
 * @param {number} [auditData.estimatedDogCount=0] Estimated free-roaming dog count in area
 * @param {number} [auditData.sterilizedDogCount=0] Dogs with visible V-notch ear cut
 * @param {boolean} [auditData.monitoringCommitteeExists=false]
 * @param {boolean} [auditData.relocationComplaints=false]
 * @param {boolean} [auditData.designatedFeedingSpotsSetup=false]
 * @returns {Object} ABC audit outcome and legal status
 */
export function evaluateWardAbcCompliance(auditData = {}) {
  const ward = auditData.wardNumber || 'General Municipal Ward';
  const totalDogs = Math.max(0, Number(auditData.estimatedDogCount) || 0);
  const sterilizedDogs = Math.min(totalDogs, Math.max(0, Number(auditData.sterilizedDogCount) || 0));

  const sterilizationRatioPercent = totalDogs > 0
    ? Math.round((sterilizedDogs / totalDogs) * 100)
    : 0;

  // WHO & AWBI recommendation: minimum 70% sterilization & vaccination coverage required for herd immunity
  const meetsHerdImmunityThreshold = sterilizationRatioPercent >= 70;

  const nonCompliances = [];
  if (!auditData.monitoringCommitteeExists) {
    nonCompliances.push({
      rule: 'Rule 11(1) ABC Rules 2023',
      issue: 'Ward Animal Birth Control Monitoring Committee not formally notified.',
      mandatoryAction: 'Municipal Commissioner must notify monitoring committee comprising SPCA & registered animal welfare representatives.',
    });
  }

  if (sterilizationRatioPercent < 70) {
    nonCompliances.push({
      rule: 'Rule 11 & NRCP Mandate',
      issue: `Sterilization coverage is only ${sterilizationRatioPercent}%, far below the 70% statutory threshold required to eliminate rabies and stabilize street dog populations.`,
      mandatoryAction: 'Initiate priority humane capture, sterilization, and anti-rabies drive through AWBI-recognized ABC center.',
    });
  }

  if (auditData.relocationComplaints) {
    nonCompliances.push({
      rule: 'Rule 11(16) ABC Rules 2023 & Section 11 PCA Act 1960',
      issue: 'Illegal attempts or instances of street dog relocation / displacement reported.',
      mandatoryAction: 'Issue immediate prohibitory injunction. Illegal relocation is a cognizable animal cruelty offense punishable under PCA Act 1960 and Supreme Court binding directives.',
    });
  }

  if (!auditData.designatedFeedingSpotsSetup) {
    nonCompliances.push({
      rule: 'Rule 20 ABC Rules 2023',
      issue: 'Designated street animal feeding spots not demarcated by RWA / Municipality.',
      mandatoryAction: 'Demarcate designated feeding spots in consultation with community caregivers away from entry gates and play parks.',
    });
  }

  return {
    wardNumber: ward,
    totalDogs,
    sterilizedDogs,
    sterilizationRatioPercent,
    meetsHerdImmunityThreshold,
    isCompliant: nonCompliances.length === 0,
    nonCompliances,
    statutoryWarningRelocation: 'STATUTORY LEGAL WARNING: Relocating street dogs is strictly illegal under Rule 11(16) of Animal Birth Control Rules, 2023 and judgments of the Hon\'ble Supreme Court of India in AWBI v. A. Nagaraja (2014) 7 SCC 547. Captured animals must be returned to the exact spot of capture. Any person or RWA enforcing relocation faces penal prosecution under Section 11 of the Prevention of Cruelty to Animals Act, 1960.',
  };
}

/**
 * Generates Community Pet & Street Feeder Regulatory Charter guidelines under Rule 20.
 *
 * @param {Object} charterData
 * @returns {Object} Standard operating charter
 */
export function generateFeederCharter(charterData = {}) {
  const colony = charterData.colonyName || '[RESIDENTIAL SOCIETY / COLONY NAME]';
  const designatedSpots = charterData.spots || [
    'Boundary wall perimeter away from main entrance gate',
    'Open vacant plot corner behind community garden',
    'Designated cul-de-sac adjacent to service lane',
  ];
  const feedingHours = charterData.feedingHours || '5:30 AM - 7:00 AM & 10:30 PM - 11:30 PM';

  return {
    colonyName: colony,
    designatedSpots,
    feedingHours,
    statutoryFramework: 'Rule 20 of Animal Birth Control Rules, 2023 & Delhi High Court Mandates',
    caretakerRights: [
      'Citizens feeding community animals are performing a recognized civic function protected by law and Article 51A(g) of the Constitution of India.',
      'RWAs, apartment associations, and security guards have NO lawful power to harass, intimidate, assault, or impose arbitrary monetary fines on street dog feeders.',
      'Community animals cannot be denied food, water, or medical aid.',
    ],
    caretakerResponsibilities: [
      'Feed animals only at designated spots during approved hours to avoid inconvenience to children and senior citizens.',
      'Clean up food waste and disposable plates immediately after feeding.',
      'Collaborate with municipal veterinary staff to ensure 100% of community dogs are sterilized (V-notched) and vaccinated annually.',
    ],
  };
}

/**
 * Generates formal statutory requisition letter for municipal ABC drive.
 *
 * @param {Object} requisitionData
 * @returns {string} Formatted text letter
 */
export function generateMunicipalAbcRequisition(requisitionData = {}) {
  const applicantName = requisitionData.applicant?.name || '[NAME OF APPLICANT / RWA REPRESENTATIVE]';
  const applicantContact = requisitionData.applicant?.contact || '[PHONE / EMAIL]';
  const applicantAddress = requisitionData.applicant?.address || '[RESIDENTIAL ADDRESS]';
  const ward = requisitionData.location?.ward || '[WARD NUMBER]';
  const city = requisitionData.location?.city || '[MUNICIPAL CORPORATION CITY]';
  const state = requisitionData.location?.state || '[STATE]';

  const unsterilizedDogs = requisitionData.unsterilizedDogs || '[NUMBER OF UNSTERILIZED DOGS]';
  const aggressiveIncidents = requisitionData.aggressiveIncidents || 'Multiple barking/territorial aggression incidents';

  const lines = [
    '================================================================================',
    'STATUTORY REQUISITION FOR HUMANE ANIMAL BIRTH CONTROL & ANTI-RABIES DRIVE',
    'UNDER RULE 11 & 16 OF ANIMAL BIRTH CONTROL RULES, 2023',
    'READ WITH SECTION 38 OF PREVENTION OF CRUELTY TO ANIMALS ACT, 1960',
    '================================================================================',
    '',
    `DATE: ${new Date().toISOString().slice(0, 10)}`,
    '',
    'TO:',
    `1. THE MUNICIPAL COMMISSIONER / HEALTH OFFICER`,
    `   ${city} Municipal Corporation, ${state}`,
    '',
    `2. THE NODAL VETERINARY SURGEON / ABC MONITORING COMMITTEE`,
    `   Municipal Animal Birth Control Center, ${city}`,
    '',
    `3. THE MEMBER SECRETARY, DISTRICT SPCA`,
    `   Society for Prevention of Cruelty to Animals, ${city}, ${state}`,
    '',
    'FROM:',
    `${applicantName}`,
    `${applicantAddress}`,
    `Contact: ${applicantContact}`,
    '',
    '--------------------------------------------------------------------------------',
    'SUBJECT: URGENT REQUISITION FOR CONDUCTING SYSTEMATIC HUMANE ANIMAL BIRTH CONTROL',
    `(ABC) STERILIZATION AND ANTI-RABIES VACCINATION (ARV) DRIVE IN WARD NO. ${ward}, ${city}.`,
    '--------------------------------------------------------------------------------',
    '',
    'RESPECTED AUTHORITIES,',
    '',
    '1. LOCATIONAL DETAILS & CIVIC ISSUE:',
    `   (a) Subject Location: Ward No. ${ward}, ${city}, ${state}.`,
    `   (b) Estimated Unsterilized Street Dogs: Approximately ${unsterilizedDogs} without visible right ear V-notch marks.`,
    `   (c) Ground Situation: ${aggressiveIncidents}.`,
    '',
    '2. STATUTORY MANDATES UNDER ABC RULES, 2023:',
    '   Under Rule 11 of the Animal Birth Control Rules, 2023, the local authority is statutorily mandated to:',
    '   (a) Constitute and convene the Ward ABC Monitoring Committee;',
    '   (b) Undertake humane capture using butterfly nets/sacking under Rule 11(4) (prohibiting iron loops/tongs);',
    '   (c) Conduct surgical sterilization under general anesthesia by a registered veterinary doctor;',
    '   (d) Make a permanent right-ear V-notch on sterilized dogs under Rule 11(9);',
    '   (e) Administer Anti-Rabies Vaccine (ARV) under Rule 11(10); and',
    '   (f) Provide mandatory 3-4 days post-operative care and release dogs back into the EXACT SAME territory under Rule 11(16).',
    '',
    '3. DEMAND FOR IMMEDIATE ACTION:',
    'The undersigned hereby formally requisitions that the Municipal Corporation and ABC Committee shall:',
    '   (a) Depute authorized ABC veterinary teams to survey and catch unsterilized dogs within 7 business days;',
    '   (b) Administer fresh anti-rabies booster shots to all community dogs in the ward;',
    '   (c) Coordinate with local animal feeders to ensure smooth capture and release;',
    '   (d) Issue clear public notifications that illegal relocation of street dogs constitutes a penal offense under Section 11 of PCA Act, 1960.',
    '',
    'Anticipating prompt humane action in the interest of citizen safety and animal welfare.',
    '',
    'Yours faithfully,',
    '',
    '____________________________________',
    `${applicantName}`,
    '================================================================================',
  ];

  return lines.join('\n');
}

/**
 * Generates an emergency Rabies Post-Exposure Prophylaxis (PEP) clinical card / passport.
 *
 * @param {Object} pepData
 * @returns {string} Formatted clinical slip
 */
export function generateRabiesPepSlip(pepData = {}) {
  const patientName = pepData.patient?.name || '[PATIENT NAME]';
  const patientAge = pepData.patient?.age || '[AGE]';
  const weight = pepData.patient?.weightKg || '[WEIGHT]';
  const exposureDate = pepData.exposureDate || new Date().toISOString().slice(0, 10);
  const animalType = pepData.animalType || 'Stray Dog';
  const category = pepData.category || 'CATEGORY_III';
  const catObj = RABIES_EXPOSURE_CATEGORIES[category] || RABIES_EXPOSURE_CATEGORIES.CATEGORY_III;

  const regimenKey = pepData.regimenKey || 'ESSEN_IM';
  const schedule = calculateVaccinationSchedule(exposureDate, regimenKey);
  const rigDetails = catObj.rigRequired ? calculateRigDosage({ weightKg: Number(weight) || 60, rigType: pepData.rigType || 'HRIG' }) : null;

  const lines = [
    '================================================================================',
    'RABIES POST-EXPOSURE PROPHYLAXIS (PEP) EMERGENCY MEDICAL PASSPORT',
    'IN ACCORDANCE WITH WHO & NATIONAL RABIES CONTROL PROGRAMME (NRCP) GUIDELINES',
    '================================================================================',
    '',
    `PATIENT NAME: ${patientName}    AGE/SEX: ${patientAge}    WEIGHT: ${weight} kg`,
    `EXPOSURE DATE: ${exposureDate}    ANIMAL INVOLVED: ${animalType}`,
    `EXPOSURE CATEGORY: ${catObj.label}`,
    `CLINICAL SEVERITY: ${catObj.riskLevel} Risk`,
    '',
    '1. MANDATORY LOCAL WOUND TREATMENT (FIRST-AID):',
    '   - Immediate washing with soap and running tap water for 15 minutes minimum.',
    '   - Application of povidone-iodine antiseptic.',
    '   - No immediate suturing (unless loose stay sutures after RIG infiltration).',
    '',
    '2. RABIES IMMUNOGLOBULIN (RIG) ADMINISTRATION:',
  ];

  if (rigDetails) {
    lines.push(
      `   - RIG Prescribed: ${rigDetails.rigLabel}`,
      `   - Recommended Dosage: ${rigDetails.dosePerKgIu} IU/kg -> TOTAL DOSE: ${rigDetails.totalIuRequired} IU`,
      `   - Total Volume: ~${rigDetails.volumeMlRequired} mL (at ${rigDetails.potencyIuPerMl} IU/mL)`,
      `   - Administration: Infiltrate entire volume in and around all wounds anatomically.`,
      `   - Residual Dose: Administer IM at a distant anatomical site if volume exceeds wound capacity.`
    );
  } else {
    lines.push('   - RIG Not indicated for Category I / II exposures in immunocompetent patients.');
  }

  lines.push(
    '',
    `3. ANTI-RABIES VACCINE (ARV) SCHEDULE (${ARV_REGIMENS[regimenKey]?.label || regimenKey}):`
  );

  schedule.forEach((dose, idx) => {
    lines.push(
      `   [ ] Dose ${idx + 1}: ${dose.doseDescription} -> DUE ON: ${dose.displayDate} (${dose.route} - ${dose.anatomicalSite})`
    );
  });

  lines.push(
    '',
    '4. IMPORTANT ADVISORY & 10-DAY OBSERVATION RULE:',
    '   - Rabies is 100% fatal once clinical symptoms develop, but 100% preventable with timely PEP.',
    '   - Complete all scheduled vaccine doses without interruption even if the animal looks healthy.',
    '   - If the biting animal is alive and normal after 10 days of observation, consult your physician.',
    '',
    'TREATING CLINICIAN / MEDICAL OFFICER SIGNATURE:',
    '',
    '____________________________________',
    'Date & Hospital Stamp',
    '================================================================================'
  );

  return lines.join('\n');
}
