/**
 * clinicalEstablishmentService.js
 *
 * Implements statutory patient rights evaluations and overbilling analytics under:
 * 1. Clinical Establishments (Registration and Regulation) Act, 2010 (CEA 2010).
 * 2. National Human Rights Commission (NHRC) / MoHFW Charter of Patients' Rights.
 * 3. Supreme Court Landmark Precedents:
 *    - Pt. Parmanand Katara v. Union of India (1989) 4 SCC 286 (Universal Emergency Care)
 *    - Paschim Banga Khet Mazdoor Samity v. State of West Bengal (1996) 4 SCC 37
 * 4. NPPA / DPCO Drug and Medical Device Price Ceiling Regulations.
 */

/**
 * NHRC / MoHFW 6 Core Patient Rights Evaluated
 */
export const PATIENT_RIGHTS_CHARTER = {
  RIGHT_TO_EMERGENCY_TREATMENT: {
    id: 'RIGHT_TO_EMERGENCY_TREATMENT',
    title: 'Right to Emergency Medical Care & Stabilization (No Advance Demand)',
    statutoryRef: 'Section 56 of CEA 2010 & Parmanand Katara Precedent',
    description: 'Every clinical establishment must provide immediate emergency medical treatment to stabilize life without conditioning care on advance financial deposit or police MLC formalities.',
    penalty: 'Registration cancellation under Section 41 and prosecution for criminal negligence.',
  },
  RIGHT_AGAINST_DETAINMENT: {
    id: 'RIGHT_AGAINST_DETAINMENT',
    title: 'Absolute Right against Detainment (Patients & Mortal Remains)',
    statutoryRef: 'Article 21 Constitution & Bombay HC in Sanjay Prajapati v. State of Maharashtra',
    description: 'Hospitals are strictly prohibited from detaining discharged patients or withholding mortal remains (dead bodies) over disputed or unpaid medical dues. Confinement is an actionable criminal offense.',
    penalty: 'Cognizable offense of wrongful confinement (Section 340 IPC/BNS) & civil damages.',
  },
  RIGHT_TO_MEDICAL_RECORDS: {
    id: 'RIGHT_TO_MEDICAL_RECORDS',
    title: 'Right to Timely Medical Records (24h Emergency / 72h Discharge)',
    statutoryRef: 'National Medical Commission (NMC) Code of Ethics Rule 1.3.2',
    description: 'Patients and authorized relatives have an absolute legal right to receive complete case sheets, lab reports, discharge summaries, and ICU doctor notes within 24 hours in emergencies or 72 hours of discharge.',
    penalty: 'Professional disciplinary action against medical superintendent and license review.',
  },
  RIGHT_TO_TRANSPARENT_RATES: {
    id: 'RIGHT_TO_TRANSPARENT_RATES',
    title: 'Right to Standardized Rate Transparency & Itemized Invoicing',
    statutoryRef: 'Section 12(2)(o) of CEA 2010 & Rule 9 Central Rules',
    description: 'Clinical establishments must display itemized procedure tariffs, bed charges, and package rates. Billed rates cannot exceed displayed tariffs or state-notified standard rate ceilings.',
    penalty: 'Compounding fines up to ₹5,00,000 for repeated overbilling defaults under Section 42.',
  },
  RIGHT_TO_EXTERNAL_PHARMACY: {
    id: 'RIGHT_TO_EXTERNAL_PHARMACY',
    title: 'Right to Source Medicines & Consumables Externally',
    statutoryRef: 'NHRC Charter of Patients\' Rights Clause 7 & CCI Directives',
    description: 'Hospitals cannot mandate or compel patients to purchase medicines, surgical supplies, or implants solely from the in-house hospital pharmacy.',
    penalty: 'Violation of fair trade practice and patient autonomy.',
  },
  RIGHT_TO_INFORMED_CONSENT: {
    id: 'RIGHT_TO_INFORMED_CONSENT',
    title: 'Right to Informed Consent, Diagnosis Clarity & Second Opinion',
    statutoryRef: 'NHRC Charter Clause 3 & Supreme Court in Samira Kohli v. Dr. Prabha Manchanda',
    description: 'Patients have the right to be informed in simple language regarding diagnosis, risks, alternative procedures, and expected costs prior to surgery.',
    penalty: 'Medical battery and deficiency in service under Consumer Protection Act, 2019.',
  },
};

/**
 * Standard State / CGHS / NPPA Medical Procedure & Bed Tariff Ceilings
 */
export const STANDARD_TARIFF_CEILINGS = {
  GENERAL_WARD_PER_DAY: {
    id: 'GENERAL_WARD_PER_DAY',
    category: 'Bed Charges',
    label: 'General Ward Bed per Day (Including Nursing)',
    standardCeilingInr: 1200,
    description: 'Standard multi-bed ward including routine nursing and medical officer monitoring.',
  },
  ICU_BED_PER_DAY: {
    id: 'ICU_BED_PER_DAY',
    category: 'Bed Charges',
    label: 'ICU Bed without Ventilator per Day',
    standardCeilingInr: 4500,
    description: 'Intensive Care Unit bed with multipara monitoring and resident doctor supervision.',
  },
  ICU_VENTILATOR_PER_DAY: {
    id: 'ICU_VENTILATOR_PER_DAY',
    category: 'Bed Charges',
    label: 'ICU Bed with Mechanical Ventilator Support per Day',
    standardCeilingInr: 7500,
    description: 'Critical care ICU with invasive mechanical ventilation, blood gas monitoring, and intensive nursing.',
  },
  CARDIAC_STENT_DES: {
    id: 'CARDIAC_STENT_DES',
    category: 'Implant',
    label: 'Drug Eluting Coronary Stent (DES) (NPPA Capped)',
    standardCeilingInr: 30080, // Statutory NPPA ceiling + GST
    description: 'National Pharmaceutical Pricing Authority statutory ceiling on bare drug-eluting cardiac stents.',
  },
  KNEE_IMPLANT_PRIMARY: {
    id: 'KNEE_IMPLANT_PRIMARY',
    category: 'Implant',
    label: 'Primary Knee Replacement Implant (Titanium/Cobalt NPPA Capped)',
    standardCeilingInr: 54000,
    description: 'NPPA capped standard component femoral and tibial knee replacement kit.',
  },
  NORMAL_DELIVERY_PACKAGE: {
    id: 'NORMAL_DELIVERY_PACKAGE',
    category: 'Procedure',
    label: 'Normal Obstetric Delivery Package (3 Days)',
    standardCeilingInr: 15000,
    description: 'Full vaginal delivery package including labor room, doctor fees, and baby care.',
  },
  CESAREAN_LSCS_PACKAGE: {
    id: 'CESAREAN_LSCS_PACKAGE',
    category: 'Procedure',
    label: 'Cesarean Section (LSCS) Delivery Package (5 Days)',
    standardCeilingInr: 25000,
    description: 'Surgical delivery, theater charges, anesthesia, obstetrician, and pediatrician care.',
  },
  CORONARY_ANGIOGRAPHY: {
    id: 'CORONARY_ANGIOGRAPHY',
    category: 'Procedure',
    label: 'Diagnostic Coronary Angiogram (Radial / Femoral)',
    standardCeilingInr: 12000,
    description: 'Cath lab diagnostic procedure with contrast media.',
  },
};

/**
 * Evaluates hospital compliance with emergency care, patient detainment, and statutory rights.
 *
 * @param {Object} auditData
 * @returns {Object} Evaluation summary
 */
export function evaluateEmergencyCareCompliance(auditData = {}) {
  const hospitalName = auditData.hospitalName || 'Clinical Establishment';
  const emergencyType = auditData.emergencyType || 'Acute Trauma / Cardiac Emergency';
  const advanceDemanded = Math.max(0, Number(auditData.advanceDemandedInr) || 0);

  const violations = [];
  let severityScore = 0; // 0 (compliant) to 100 (critical criminal infraction)

  if (auditData.refusedTriageOrStabilization) {
    violations.push({
      rightKey: 'RIGHT_TO_EMERGENCY_TREATMENT',
      rule: 'Section 56 CEA 2010 & Parmanand Katara Precedent',
      violation: 'Refusal to examine, triage, or medically stabilize an emergency patient.',
      legalImpact: 'Gross violation of Right to Life (Article 21). Hospital is liable for cancellation of registration and prosecution for criminal medical negligence.',
    });
    severityScore += 40;
  }

  if (auditData.conditionalOnAdvanceDeposit && advanceDemanded > 0) {
    violations.push({
      rightKey: 'RIGHT_TO_EMERGENCY_TREATMENT',
      rule: 'Section 56 CEA 2010 & Supreme Court Directives',
      violation: `Conditioning emergency ICU/surgery commencement on prior financial deposit of ₹${advanceDemanded.toLocaleString('en-IN')}.`,
      legalImpact: 'Statutory breach. Stabilization cannot be withheld or delayed due to lack of immediate financial deposit.',
    });
    severityScore += 30;
  }

  if (auditData.detainedPatientOrMortalRemains) {
    violations.push({
      rightKey: 'RIGHT_AGAINST_DETAINMENT',
      rule: 'Bombay HC in Sanjay Prajapati v. State & Section 340 IPC/BNS',
      violation: 'Illegal detention of patient or refusal to release deceased body due to pending billing dispute.',
      legalImpact: 'Constitutes cognizable criminal offense of wrongful confinement. Hospital has no lien on a living patient or mortal remains.',
    });
    severityScore += 35;
  }

  if (auditData.withheldMedicalRecords) {
    violations.push({
      rightKey: 'RIGHT_TO_MEDICAL_RECORDS',
      rule: 'NMC Code of Ethics Rule 1.3.2 & NHRC Charter',
      violation: 'Refusal or failure to provide complete indoor medical case sheets and diagnostic records.',
      legalImpact: 'Violation of patient right to information and second opinion.',
    });
    severityScore += 15;
  }

  if (auditData.deniedExternalPharmacy) {
    violations.push({
      rightKey: 'RIGHT_TO_EXTERNAL_PHARMACY',
      rule: 'NHRC Charter Clause 7 & Competition Act 2002',
      violation: 'Coercive refusal to permit external purchase of medicines, surgical consumables, or implants.',
      legalImpact: 'Restrictive and unfair medical trade practice.',
    });
    severityScore += 10;
  }

  const isCompliant = violations.length === 0;

  return {
    hospitalName,
    emergencyType,
    advanceDemandedInr: advanceDemanded,
    isCompliant,
    severityScore: Math.min(100, severityScore),
    violations,
    statutoryStatus: isCompliant
      ? 'Fully Compliant with Clinical Establishment Act 2010 & NHRC Charter'
      : `${violations.length} Statutory Infractions Detected (Actionable under Section 41/42)`,
  };
}

/**
 * Analyzes hospital itemized invoice against standard package rate ceilings.
 *
 * @param {Array<Object>} lineItems Items with { tariffKey, customName, invoicedAmountInr, daysOrUnits }
 * @returns {Object} Financial overcharge discrepancy analytics
 */
export function analyzeHospitalBilling(lineItems = []) {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return {
      totalInvoicedInr: 0,
      totalStatutoryCeilingInr: 0,
      totalOverchargeInr: 0,
      overchargePercent: 0,
      itemsAnalysis: [],
      hasOvercharge: false,
    };
  }

  let totalInvoiced = 0;
  let totalStandardCeiling = 0;

  const itemsAnalysis = lineItems.map((item) => {
    const units = Math.max(1, Number(item.daysOrUnits) || 1);
    const invoiced = Math.max(0, Number(item.invoicedAmountInr) || 0);

    const standardDef = STANDARD_TARIFF_CEILINGS[item.tariffKey];
    const unitCeiling = standardDef ? standardDef.standardCeilingInr : invoiced;
    const totalCeiling = unitCeiling * units;

    const overcharge = Math.max(0, invoiced - totalCeiling);
    const markupPct = totalCeiling > 0 ? parseFloat(((overcharge / totalCeiling) * 100).toFixed(1)) : 0;

    totalInvoiced += invoiced;
    totalStandardCeiling += totalCeiling;

    return {
      itemLabel: standardDef ? standardDef.label : (item.customName || 'Medical Service'),
      category: standardDef ? standardDef.category : 'General Hospital Billing',
      units,
      invoicedAmountInr: invoiced,
      standardCeilingInr: totalCeiling,
      overchargeInr: overcharge,
      markupPercent: markupPct,
      isCappedViolation: overcharge > 0,
    };
  });

  const totalOvercharge = Math.max(0, totalInvoiced - totalStandardCeiling);
  const overchargePercent = totalStandardCeiling > 0
    ? parseFloat(((totalOvercharge / totalStandardCeiling) * 100).toFixed(1))
    : 0;

  return {
    totalInvoicedInr: totalInvoiced,
    totalStatutoryCeilingInr: totalStandardCeiling,
    totalOverchargeInr: totalOvercharge,
    overchargePercent,
    itemsAnalysis,
    hasOvercharge: totalOvercharge > 0,
  };
}

/**
 * Formulates formal statutory representation to District Registering Authority under Section 41/42.
 *
 * @param {Object} grievanceData
 * @returns {string} Formatted legal representation
 */
export function generateDistrictRegisteringAuthorityComplaint(grievanceData = {}) {
  const complainantName = grievanceData.patient?.name || '[NAME OF COMPLAINANT / PATIENT REPRESENTATIVE]';
  const complainantAddress = grievanceData.patient?.address || '[RESIDENTIAL ADDRESS]';
  const complainantContact = grievanceData.patient?.contact || '[PHONE / EMAIL]';

  const hospitalName = grievanceData.hospitalName || '[NAME OF CLINICAL ESTABLISHMENT / HOSPITAL]';
  const hospitalAddress = grievanceData.hospitalAddress || '[HOSPITAL LOCATION / ADDRESS]';
  const district = grievanceData.district || '[DISTRICT]';
  const state = grievanceData.state || '[STATE]';

  const admissionDate = grievanceData.admissionDate || new Date().toISOString().slice(0, 10);
  const dischargeDate = grievanceData.dischargeDate || new Date().toISOString().slice(0, 10);
  const ipdNumber = grievanceData.ipdNumber || '[IPD / PATIENT UHID NO.]';

  const compliance = grievanceData.compliance || {};
  const billingAnalysis = grievanceData.billingAnalysis || {};

  const lines = [
    '================================================================================',
    'FORMAL STATUTORY COMPLAINT UNDER SECTION 41 & 42 OF THE CLINICAL ESTABLISHMENTS',
    '(REGISTRATION AND REGULATION) ACT, 2010 READ WITH NHRC CHARTER OF PATIENT RIGHTS',
    '================================================================================',
    '',
    `DATE: ${new Date().toISOString().slice(0, 10)}`,
    '',
    'TO:',
    `1. THE DISTRICT REGISTERING AUTHORITY`,
    `   (Presided by District Magistrate / District Collector, ${district}, ${state})`,
    '',
    `2. THE CHIEF MEDICAL OFFICER / CIVIL SURGEON`,
    `   (Member Secretary, District Registering Authority, ${district}, ${state})`,
    '',
    `3. THE STATE COUNCIL FOR CLINICAL ESTABLISHMENTS`,
    `   Directorate of Health Services, Government of ${state}`,
    '',
    'FROM:',
    `${complainantName}`,
    `${complainantAddress}`,
    `Contact: ${complainantContact}`,
    '',
    '--------------------------------------------------------------------------------',
    `SUBJECT: STATUTORY COMPLAINT AGAINST ${hospitalName.toUpperCase()} FOR REFUSAL OF`,
    'EMERGENCY STABILIZATION, EXORBITANT OVERBILLING, AND VIOLATION OF PATIENTS\' RIGHTS',
    `IN RESPECT OF PATIENT IPD/UHID: ${ipdNumber}.`,
    '--------------------------------------------------------------------------------',
    '',
    'RESPECTED DISTRICT REGISTERING AUTHORITY,',
    '',
    '1. PARTICULARS OF THE CLINICAL ESTABLISHMENT & PATIENT:',
    `   (a) Name of Clinical Establishment: ${hospitalName}.`,
    `   (b) Address / Jurisdiction: ${hospitalAddress}, ${district}, ${state}.`,
    `   (c) Patient IPD / Case Sheet No.: ${ipdNumber}.`,
    `   (d) Treatment Period: From ${admissionDate} to ${dischargeDate}.`,
    '',
    '2. STATUTORY RIGHTS VIOLATIONS (SECTION 56 CEA 2010 & NHRC CHARTER):'
  ];

  if (compliance.violations && compliance.violations.length > 0) {
    compliance.violations.forEach((v, idx) => {
      lines.push(`   (${String.fromCharCode(97 + idx)}) Violation of ${v.rule}: ${v.violation}`);
      lines.push(`       Legal Consequence: ${v.legalImpact}`);
    });
  } else {
    lines.push('   (a) Continued dispute regarding billing opacity and withholding of complete case sheets.');
  }

  lines.push(
    '',
    '3. FINANCIAL OVERBILLING & TARIFF CEILING EXCEEDANCE:',
    `   (a) Total Hospital Invoiced Sum: Rs. ${Number(billingAnalysis.totalInvoicedInr || 0).toLocaleString('en-IN')}`,
    `   (b) Prescribed State / Standard Rate Ceiling: Rs. ${Number(billingAnalysis.totalStatutoryCeilingInr || 0).toLocaleString('en-IN')}`,
    `   (c) Net Illegal Overcharge Extracted: Rs. ${Number(billingAnalysis.totalOverchargeInr || 0).toLocaleString('en-IN')} (${billingAnalysis.overchargePercent || 0}% markup over legal caps)`,
    '',
    '4. VIOLATION OF BINDING SUPREME COURT & HIGH COURT JURISPRUDENCE:',
    '   (a) Parmanand Katara v. Union of India (1989) 4 SCC 286: Emergency medical care is an integral constitutional right under Article 21 and cannot be denied or conditioned upon commercial advances.',
    '   (b) Sanjay Prajapati v. State of Maharashtra: Detaining patients or withholding mortal remains for disputed dues constitutes wrongful confinement under criminal law.',
    '',
    '5. STATUTORY PRAYERS & RELIEFS SOUGHT:',
    'The Complainant respectfully requests the District Registering Authority to:',
    '   (a) Order an immediate statutory inspection of the hospital records under Section 34 of the Act;',
    `   (b) Direct ${hospitalName} to immediately refund the illegal overcharge of Rs. ${Number(billingAnalysis.totalOverchargeInr || 0).toLocaleString('en-IN')} to the Complainant;`,
    '   (c) Compel the immediate, unconditional handover of complete attested copies of all indoor medical records and ICU charts;',
    '   (d) Levy statutory compounding penalties under Section 42 of the Act (up to Rs. 5,00,000 for repeated default); and',
    '   (e) Initiate proceedings for suspension or cancellation of the hospital\'s clinical establishment registration under Section 41.',
    '',
    'Yours faithfully,',
    '',
    '____________________________________',
    `${complainantName}`,
    '================================================================================'
  );

  return lines.join('\n');
}
