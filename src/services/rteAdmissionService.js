/**
 * rteAdmissionService.js
 *
 * Implements statutory eligibility calculations, illegal screening / capitation fee audits,
 * free entitlement reconciliations, and formal Section 32 grievance petition drafting under:
 * 1. Right of Children to Free and Compulsory Education Act, 2009 (RTE Act 2009).
 * 2. Section 12(1)(c) - Mandatory 25% admission quota for EWS/DG in unaided private schools.
 * 3. Section 13 - Absolute prohibition on capitation fee and screening procedure.
 * 4. Section 3(2) - Prohibition on auxiliary charges preventing elementary education completion.
 * 5. Supreme Court Precedents:
 *    - Society for Unaided Private Schools of Rajasthan v. Union of India (2012) 6 SCC 1
 *    - Pramati Educational & Cultural Trust v. Union of India (2014) 8 SCC 1
 */

/**
 * State-wise annual family income thresholds for Economically Weaker Section (EWS) quota
 * under RTE Act Section 12(1)(c) (in INR).
 */
export const STATE_EWS_THRESHOLDS = {
  DELHI: { state: 'Delhi', thresholdInr: 100000, maxDistanceKm: 6 },
  MAHARASHTRA: { state: 'Maharashtra', thresholdInr: 100000, maxDistanceKm: 3 },
  KARNATAKA: { state: 'Karnataka', thresholdInr: 350000, maxDistanceKm: 3 },
  UTTAR_PRADESH: { state: 'Uttar Pradesh', thresholdInr: 100000, maxDistanceKm: 3 },
  RAJASTHAN: { state: 'Rajasthan', thresholdInr: 250000, maxDistanceKm: 5 },
  GUJARAT: { state: 'Gujarat', thresholdInr: 150000, maxDistanceKm: 3 },
  TAMIL_NADU: { state: 'Tamil Nadu', thresholdInr: 200000, maxDistanceKm: 3 },
  MADHYA_PRADESH: { state: 'Madhya Pradesh', thresholdInr: 100000, maxDistanceKm: 3 },
  DEFAULT: { state: 'Central / Other States', thresholdInr: 100000, maxDistanceKm: 3 },
};

/**
 * Disadvantaged Group (DG) and Special Categories under Section 2(d) & 2(e)
 */
export const RTE_CATEGORIES = {
  EWS: {
    id: 'EWS',
    label: 'Economically Weaker Section (EWS)',
    requiresIncomeProof: true,
    description: 'Families whose annual income falls below the State-notified RTE income threshold.',
  },
  SC: {
    id: 'SC',
    label: 'Scheduled Caste (SC)',
    requiresIncomeProof: false,
    description: 'Disadvantaged group categorized under Article 341 of the Constitution.',
  },
  ST: {
    id: 'ST',
    label: 'Scheduled Tribe (ST)',
    requiresIncomeProof: false,
    description: 'Disadvantaged group categorized under Article 342 of the Constitution.',
  },
  OBC_NCL: {
    id: 'OBC_NCL',
    label: 'Other Backward Class - Non-Creamy Layer (OBC-NCL)',
    requiresIncomeProof: true,
    description: 'Socially and educationally backward class within the non-creamy layer threshold.',
  },
  CWSN_DISABILITY: {
    id: 'CWSN_DISABILITY',
    label: 'Child with Special Needs / Disability (RPwD Act 2016)',
    requiresIncomeProof: false,
    description: 'Children with benchmark disabilities under the Rights of Persons with Disabilities Act, 2016.',
  },
  ORPHAN_TRANSGENDER: {
    id: 'ORPHAN_TRANSGENDER',
    label: 'Orphan / Transgender / Foster Care Child',
    requiresIncomeProof: false,
    description: 'Special disadvantaged social category with statutory admission priority without income cap.',
  },
};

/**
 * Neighborhood Catchment Priorities under Section 12(1)(c)
 */
export const CATCHMENT_ZONES = {
  ZONE_1: { id: 'ZONE_1', label: 'Primary Catchment (0 to 1 km)', maxKm: 1, priority: 1, text: 'First priority allotment' },
  ZONE_2: { id: 'ZONE_2', label: 'Secondary Catchment (1 to 3 km)', maxKm: 3, priority: 2, text: 'Second priority allotment if seats vacant in Zone 1' },
  ZONE_3: { id: 'ZONE_3', label: 'Extended Catchment (3 to 6 km)', maxKm: 6, priority: 3, text: 'Subject to inter-neighborhood seat availability' },
  OUT_OF_RANGE: { id: 'OUT_OF_RANGE', label: 'Beyond Catchment (> 6 km)', maxKm: Infinity, priority: 4, text: 'Non-conforming catchment; school may deny based on distance' },
};

/**
 * Standard Auxiliary Fee items prohibited under Section 3(2) for EWS/DG quota students
 */
export const MANDATORY_FREE_ENTITLEMENTS = [
  { id: 'tuition_fee', label: 'Tuition Fee / Academic Instruction', statutoryCapInr: 0, requiredFree: true },
  { id: 'textbooks_workbooks', label: 'Prescribed Textbooks & Workbooks', statutoryCapInr: 0, requiredFree: true },
  { id: 'school_uniform', label: 'School Uniform & Footwear (2 Pairs)', statutoryCapInr: 0, requiredFree: true },
  { id: 'writing_materials', label: 'Notebooks & Basic Stationery Materials', statutoryCapInr: 0, requiredFree: true },
  { id: 'library_computer_fee', label: 'Library & Computer Laboratory Charges', statutoryCapInr: 0, requiredFree: true },
  { id: 'development_building_fee', label: 'Annual Building / Development Fund', statutoryCapInr: 0, requiredFree: true },
  { id: 'sports_activity_fee', label: 'Sports, Cultural & Co-Curricular Fees', statutoryCapInr: 0, requiredFree: true },
  { id: 'examination_id_fee', label: 'Term Examination & School ID Card Fee', statutoryCapInr: 0, requiredFree: true },
];

/**
 * Evaluates RTE Section 12(1)(c) eligibility based on family income, category, distance, and documents.
 *
 * @param {Object} params
 * @param {string} params.stateKey - Key from STATE_EWS_THRESHOLDS
 * @param {string} params.categoryKey - Key from RTE_CATEGORIES
 * @param {number} params.annualIncomeInr - Annual family income in INR
 * @param {number} params.distanceKm - Distance between residence and school in kilometers
 * @param {number} params.childAgeYears - Age of child in years
 * @param {string} params.targetGrade - 'nursery', 'lkg', 'ukg', or 'class_1'
 * @param {Object} params.documents - Document checklist booleans
 * @returns {Object} Comprehensive evaluation result
 */
export function evaluateRteEligibility({
  stateKey = 'DEFAULT',
  categoryKey = 'EWS',
  annualIncomeInr = 0,
  distanceKm = 0.5,
  childAgeYears = 6,
  targetGrade = 'class_1',
  documents = {},
} = {}) {
  const stateConfig = STATE_EWS_THRESHOLDS[stateKey] || STATE_EWS_THRESHOLDS.DEFAULT;
  const categoryConfig = RTE_CATEGORIES[categoryKey] || RTE_CATEGORIES.EWS;

  const missingDocs = [];
  if (!documents.proofOfResidence) missingDocs.push('Proof of Residence (Ration Card, Voter ID, Aadhaar, Utility Bill)');
  if (!documents.proofOfAge) missingDocs.push('Proof of Age (Hospital/Anganwadi birth record or parent affidavit under Sec 14)');
  if (categoryConfig.requiresIncomeProof && !documents.incomeCertificate) {
    missingDocs.push(`Current EWS Income Certificate (issued by Revenue Officer / Tehsildar) showing <= ₹${stateConfig.thresholdInr.toLocaleString('en-IN')}`);
  }
  if (!categoryConfig.requiresIncomeProof && !documents.categoryCertificate) {
    missingDocs.push(`Statutory Category Certificate (${categoryConfig.label}) issued by competent district authority`);
  }

  // Income eligibility check
  const isIncomeEligible = !categoryConfig.requiresIncomeProof || (Number(annualIncomeInr) <= stateConfig.thresholdInr);

  // Catchment Zone determination
  let catchment = CATCHMENT_ZONES.OUT_OF_RANGE;
  if (distanceKm <= 1) {
    catchment = CATCHMENT_ZONES.ZONE_1;
  } else if (distanceKm <= 3) {
    catchment = CATCHMENT_ZONES.ZONE_2;
  } else if (distanceKm <= stateConfig.maxDistanceKm) {
    catchment = CATCHMENT_ZONES.ZONE_3;
  }

  // Age eligibility based on grade
  let isAgeEligible;
  let ageRequirementText;
  if (targetGrade === 'nursery' || targetGrade === 'pre_school') {
    isAgeEligible = childAgeYears >= 3 && childAgeYears <= 5;
    ageRequirementText = '3 to 5 years as of academic year entry';
  } else if (targetGrade === 'lkg') {
    isAgeEligible = childAgeYears >= 4 && childAgeYears <= 6;
    ageRequirementText = '4 to 6 years as of academic year entry';
  } else if (targetGrade === 'ukg') {
    isAgeEligible = childAgeYears >= 5 && childAgeYears <= 7;
    ageRequirementText = '5 to 7 years as of academic year entry';
  } else {
    // Default class 1
    isAgeEligible = childAgeYears >= 5.5 && childAgeYears <= 7.5;
    ageRequirementText = '6 years (relaxed between 5.5 and 7.5 years) under NEP / RTE guidelines';
  }

  const isEligible = isIncomeEligible && catchment.priority <= 3 && isAgeEligible;

  // Compute statutory score (0 to 100)
  let score = 0;
  if (isIncomeEligible) score += 35;
  if (catchment.priority === 1) score += 35;
  else if (catchment.priority === 2) score += 25;
  else if (catchment.priority === 3) score += 15;
  if (isAgeEligible) score += 15;
  const docsRatio = (4 - missingDocs.length) / 4;
  score += Math.round(Math.max(0, docsRatio) * 15);

  return {
    isEligible,
    statutoryScore: Math.min(100, Math.max(0, score)),
    stateName: stateConfig.state,
    stateThresholdInr: stateConfig.thresholdInr,
    category: categoryConfig.label,
    isIncomeEligible,
    catchment,
    isAgeEligible,
    ageRequirementText,
    missingDocs,
    allDocumentsPresent: missingDocs.length === 0,
    statutoryGrounds: 'Section 12(1)(c) of RTE Act 2009 read with Society for Unaided Private Schools v. UOI (2012)',
  };
}

/**
 * Audits illegal screening procedures and capitation fee demands under Section 13.
 *
 * @param {Object} params
 * @param {boolean} params.childWrittenTest - Whether a written test was given to the child
 * @param {boolean} params.childOralInterview - Whether an oral screening interview was conducted with the child
 * @param {boolean} params.parentInterview - Whether parents were interviewed or subjected to screening
 * @param {boolean} params.parentQualificationAudit - Whether parent educational degrees were demanded as selection criteria
 * @param {number} params.capitationFeeDemandedInr - Unlawful donation / capitation fee demanded in INR
 * @param {boolean} params.isSubsequentViolation - Whether the school has previously violated Section 13
 * @returns {Object} Audit outcome with statutory penalty liability
 */
export function auditScreeningAndCapitation({
  childWrittenTest = false,
  childOralInterview = false,
  parentInterview = false,
  parentQualificationAudit = false,
  capitationFeeDemandedInr = 0,
  isSubsequentViolation = false,
} = {}) {
  const violations = [];
  let screeningViolationCount = 0;

  if (childWrittenTest) {
    violations.push({
      rule: 'Section 13(1) RTE Act',
      name: 'Unlawful Written Test / Assessment for Child',
      description: 'Subjecting a 3-7 year old child to a written entrance evaluation or elimination test is strictly banned.',
    });
    screeningViolationCount++;
  }

  if (childOralInterview) {
    violations.push({
      rule: 'Section 13(1) RTE Act',
      name: 'Prohibited Child Interview / Interaction Test',
      description: 'Oral screening or verbal assessment of an entry-level child for admission filtering is punishable.',
    });
    screeningViolationCount++;
  }

  if (parentInterview) {
    violations.push({
      rule: 'Section 13(1) RTE Act',
      name: 'Prohibited Parent Interview / Screening Session',
      description: 'Interviewing parents or judging parental demeanor as a condition for school admission is illegal.',
    });
    screeningViolationCount++;
  }

  if (parentQualificationAudit) {
    violations.push({
      rule: 'Section 13(1) & Supreme Court Precedents',
      name: 'Discriminatory Parent Education / Socio-Economic Screening',
      description: 'Denying or ranking admissions based on parents\' academic qualifications or income brackets violates Article 14.',
    });
    screeningViolationCount++;
  }

  const capitationDemanded = Math.max(0, Number(capitationFeeDemandedInr) || 0);
  if (capitationDemanded > 0) {
    violations.push({
      rule: 'Section 13(2)(a) RTE Act',
      name: 'Demand for Unlawful Capitation / Donation Fee',
      description: `Demanding ₹${capitationDemanded.toLocaleString('en-IN')} as admission donation or non-refundable developmental charge is a cognizable civil violation.`,
    });
  }

  // Statutory penalty calculation under Section 13(2):
  // (a) Capitation fee fine: up to 10 times the capitation fee charged.
  const capitationFineMultiplier = 10;
  const statutoryCapitationFineInr = capitationDemanded * capitationFineMultiplier;

  // (b) Screening procedure fine: up to ₹25,000 for 1st contravention; ₹50,000 for each subsequent contravention.
  const perScreeningFine = isSubsequentViolation ? 50000 : 25000;
  const statutoryScreeningFineInr = screeningViolationCount > 0 ? perScreeningFine : 0;

  const totalStatutoryPenalLiabilityInr = statutoryCapitationFineInr + statutoryScreeningFineInr;
  const hasViolations = violations.length > 0;

  let severity = 'COMPLIANT';
  if (totalStatutoryPenalLiabilityInr >= 100000 || capitationDemanded > 0) {
    severity = 'CRITICAL';
  } else if (screeningViolationCount > 0) {
    severity = 'HIGH';
  }

  return {
    hasViolations,
    severity,
    screeningViolationCount,
    capitationDemandedInr: capitationDemanded,
    statutoryCapitationFineInr,
    statutoryScreeningFineInr,
    totalStatutoryPenalLiabilityInr,
    violations,
    statutoryGrounds: 'Section 13 of RTE Act 2009 (Capitation fee penalty up to 10x, Screening fine ₹25,000 to ₹50,000)',
  };
}

/**
 * Reconciles invoice line items against mandatory free entitlement rules under Section 3(2).
 *
 * @param {Array<Object>} feeItems - Array of { id, label, billedInr }
 * @returns {Object} Financial overbilling summary
 */
export function reconcileFreeEntitlementOvercharges(feeItems = []) {
  const lineAudits = feeItems.map((item) => {
    const billed = Math.max(0, Number(item.billedInr) || 0);
    const statutoryCap = 0; // Under Section 3(2), EWS elementary education must be completely free of compulsory auxiliary fees
    const overcharge = Math.max(0, billed - statutoryCap);
    const isIllegal = overcharge > 0;

    return {
      id: item.id,
      label: item.label,
      billedInr: billed,
      statutoryCapInr: statutoryCap,
      overchargeInr: overcharge,
      isIllegal,
      legalNote: isIllegal ? 'Mandatorily free under Section 3(2) RTE Act' : 'Compliant',
    };
  });

  const totalBilledInr = lineAudits.reduce((acc, curr) => acc + curr.billedInr, 0);
  const totalIllegalOverchargeInr = lineAudits.reduce((acc, curr) => acc + curr.overchargeInr, 0);
  const markupPercentage = totalBilledInr > 0 ? 100 : 0; // 100% of the auxiliary bill is illegal for EWS

  return {
    lineAudits,
    totalBilledInr,
    totalIllegalOverchargeInr,
    markupPercentage,
    hasOvercharges: totalIllegalOverchargeInr > 0,
    reimbursementObligation: 'Section 12(2) mandates the State to reimburse the school directly. School cannot recover these from the student.',
  };
}

/**
 * Generates a formal statutory grievance petition under Section 32 of RTE Act 2009.
 *
 * @param {Object} data
 * @returns {string} Formatted legal text representation
 */
export function generateRteSection32Petition({
  childName = 'Child Applicant',
  dateOfBirth = 'YYYY-MM-DD',
  guardianName = 'Parent / Guardian',
  contactPhone = 'XXXXXXXXXX',
  residentialAddress = 'Address of Applicant',
  allotmentSlipId = 'RTE-ALLOT-XXXX',
  category = 'Economically Weaker Section (EWS)',
  targetGrade = 'Class 1',
  schoolName = 'Unaided Private School',
  schoolAddress = 'School Campus Address',
  blockName = 'Local Educational Block',
  districtName = 'District',
  stateName = 'State',
  eligibilityData = null,
  screeningData = null,
  billingData = null,
  denialReason = 'Refusal to admit without paying unauthorized fees',
} = {}) {
  const dateFormatted = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const totalPenalLiability = screeningData?.totalStatutoryPenalLiabilityInr || 0;
  const illegalFees = billingData?.totalIllegalOverchargeInr || 0;

  return `FORMAL STATUTORY COMPLAINT UNDER SECTION 32 OF THE RIGHT OF CHILDREN TO FREE AND COMPULSORY EDUCATION (RTE) ACT, 2009

TO:
1. The Block Education Officer (BEO) / District Education Officer (DEO),
   Department of School Education, ${blockName}, ${districtName}, ${stateName}

2. The Chairperson / Member Secretary,
   State Commission for Protection of Child Rights (SCPCR), ${stateName}

3. (For Reference) National Commission for Protection of Child Rights (NCPCR), New Delhi

SUB: URGENT STATUTORY INTERVENTION FOR ENFORCING SECTION 12(1)(c) EWS/DG ADMISSION, REFUND OF UNLAWFUL AUXILIARY FEES, AND IMPOSITION OF SECTION 13 PENALTIES

APPLICANT DETAILS:
Child Name: ${childName}
Date of Birth: ${dateOfBirth} (Target Grade: ${targetGrade})
Parent / Guardian Name: ${guardianName}
Contact Telephone: ${contactPhone}
Permanent / Current Residence: ${residentialAddress}
RTE Allocation / Registration ID: ${allotmentSlipId}
Statutory Category Claimed: ${category}
Statutory Eligibility Assessment: ${eligibilityData?.statutoryScore ? `${eligibilityData.statutoryScore}/100 verified readiness` : 'Section 12(1)(c) prima-facie verified'}

RESPONDENT SCHOOL DETAILS:
School Name: ${schoolName}
School Address: ${schoolAddress}
Jurisdictional Block / District: ${blockName}, ${districtName}

1. JURISDICTION & STATUTORY BACKING:
Under Section 12(1)(c) of the RTE Act 2009, affirmed by the Supreme Court of India in 'Society for Unaided Private Schools of Rajasthan v. Union of India (2012) 6 SCC 1', every recognized unaided private school is under a binding statutory mandate to admit at least 25% of children from Economically Weaker Sections and Disadvantaged Groups into entry-level classes without charging fees or conditioning enrollment on extraneous criteria.

2. SPECIFIC FACTS & STATEMENT OF GRIEVANCE:
(a) The applicant child was duly registered and allocated an entry seat at ${schoolName} under RTE Reference No: ${allotmentSlipId}.
(b) Upon reporting to the respondent school for document verification and admission confirmation, the school authorities unlawfully refused admission, stating: "${denialReason}".
${screeningData?.hasViolations ? `(c) VIOLATION OF SECTION 13 (PROHIBITION OF SCREENING & CAPITATION):
The respondent school subjected the child/parents to unlawful screening procedures and demanded unauthorized capitation funds.
- Prohibited Screening Practices Detected: ${(screeningData.violations || []).map((v) => v.name).join('; ') || 'Prohibited screening or capitation demand'}
- Capitation / Donation Fee Demanded: INR ${(screeningData.capitationDemandedInr || 0).toLocaleString('en-IN')}
- Prescribed Statutory Penalty under Section 13(2): INR ${totalPenalLiability.toLocaleString('en-IN')} (including 10x capitation fine and screening penalty).` : ''}
${billingData?.hasOvercharges ? `(d) VIOLATION OF SECTION 3(2) (ILLEGAL AUXILIARY CHARGES):
The school unlawfully demanded auxiliary payments totaling INR ${illegalFees.toLocaleString('en-IN')} for textbooks, uniforms, and administrative fees that are statutorily required to be free of cost for EWS/DG admitted children. State reimbursement obligations under Section 12(2) lie with the government, and the school is strictly barred from levying these on the student.` : ''}

3. STATUTORY PRAYERS:
In view of the deliberate contraventions of central statutory law, the complainant respectfully prays that this Competent Authority:
(i) Issue an immediate mandatory direction under Section 32 to ${schoolName} to forthwith grant formal admission to ${childName} in ${targetGrade} under RTE Reference ${allotmentSlipId};
(ii) Restrain the school management from demanding or collecting any tuition fees, capitation donations, textbook charges, or uniform expenses;
(iii) Direct the immediate refund of INR ${illegalFees.toLocaleString('en-IN')} with penal interest at 18% per annum if any sum was coercively recovered;
(iv) Initiate compounding penalty proceedings under Section 13(2) of the RTE Act 2009 amounting to INR ${totalPenalLiability.toLocaleString('en-IN')};
(v) Issue a show-cause notice under Section 18(3) recommending withdrawal of the school's recognition for persistent refusal to comply with RTE statutory quotas.

VERIFICATION:
I, ${guardianName}, parent/guardian of ${childName}, do hereby verify that the contents stated above are true and correct to the best of my knowledge and belief. No material facts have been concealed.

Place: ${districtName}, ${stateName}
Date: ${dateFormatted}

___________________________
Signature / Thumb Impression of Parent/Guardian
`;
}
