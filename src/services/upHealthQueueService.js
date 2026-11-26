/**
 * UP Public Health Facility Queue and Service Availability Observation Board Service
 * 
 * Supports patients, caregivers, and community health volunteers visiting public health
 * facilities across Uttar Pradesh (Primary Health Centres - PHC, Community Health Centres - CHC,
 * Sub-Divisional / District Hospitals, and Medical Colleges) under the Department of Medical Health
 * and Family Welfare, Government of UP (uphealth.up.gov.in / National Health Mission).
 * 
 * Key Capabilities:
 * - Public counter queue congestion & operational status tracking:
 *   - OPD Registration Counter / ABHA Scan & Share
 *   - Essential Medicine Pharmacy Counter (Jan Aushadhi / Free generic dispensary)
 *   - Diagnostic Pathology & Biochemistry Lab (Blood/Urine/Sputum test sample counter)
 *   - Ultrasound / X-Ray / Radiodiagnosis counter
 *   - Maternal & Child Health (MCH) / Immunization room
 * - 4-hour time-bound observation freshness decay (queue realities change intra-day)
 * - Multi-patient community consensus aggregation (minimum 3 patient observations)
 * - Escalation pathway: Medical Officer In-Charge (MOIC) -> Chief Medical Superintendent (CMS) -> Chief Medical Officer (CMO)
 * - Strict Patient Privacy: Zero clinical diagnoses, medical records, prescription photos, or patient names exposed
 */

export const UP_HEALTH_FACILITY_TIERS = {
  PHC: {
    code: 'PHC',
    name: 'Primary Health Centre (Prathmik Swasthya Kendra)',
    doctorNorm: '1-2 Medical Officers (MBBS/AYUSH)',
    bedCapacity: '4 to 6 Day Beds',
    statutoryTimings: '08:00 AM to 02:00 PM (Summer/Winter)'
  },
  CHC: {
    code: 'CHC',
    name: 'Community Health Centre (Samudaik Swasthya Kendra)',
    doctorNorm: '4 Specialists (Surgeon, Physician, Gynecologist, Pediatrician)',
    bedCapacity: '30 Inpatient Beds',
    statutoryTimings: '24x7 Emergency; OPD 08:00 AM to 02:00 PM'
  },
  DISTRICT_HOSPITAL: {
    code: 'DISTRICT_HOSPITAL',
    name: 'District Hospital / Male & Female Combined Hospital',
    doctorNorm: 'Full Specialist & Super-specialist faculty',
    bedCapacity: '100 to 500 Beds',
    statutoryTimings: '24x7 Emergency, Trauma & ICU; General OPD morning shift'
  }
};

export const COUNTER_TYPES = {
  OPD_REGISTRATION: {
    code: 'OPD_REGISTRATION',
    name: 'OPD Registration / Parchi Counter',
    normWaitMinutes: 20
  },
  PHARMACY_DISPENSARY: {
    code: 'PHARMACY_DISPENSARY',
    name: 'Free Medicine Dispensary (Dava Vitaran Kaksh)',
    normWaitMinutes: 25
  },
  DIAGNOSTIC_PATHOLOGY: {
    code: 'DIAGNOSTIC_PATHOLOGY',
    name: 'Sample Collection Lab (Blood/Urine Testing)',
    normWaitMinutes: 30
  },
  RADIOLOGY_XRAY: {
    code: 'RADIOLOGY_XRAY',
    name: 'X-Ray & Ultrasound Diagnostics',
    normWaitMinutes: 45
  }
};

export const UP_HEALTH_ESCALATION_OFFICERS = [
  { level: 'FACILITY', title: 'Medical Officer In-Charge (MOIC) / Chief Medical Superintendent (CMS)', role: 'Facility daily administration, counter staffing, and essential drug stock availability' },
  { level: 'DISTRICT', title: 'Chief Medical Officer (CMO / Mukhya Chikitsa Adhikari)', role: 'District overall health supervision and NHM logistics' },
  { level: 'DIVISION', title: 'Additional Director (Health & Family Welfare)', role: 'Divisional health quality inspections and grievance hearings' }
];

/**
 * Assesses operational counter status and flags wait-time congestion.
 * @param {Object} counterData 
 * @returns {Object} status analysis
 */
export function assessCounterCongestion(counterData = {}) {
  const counter = COUNTER_TYPES[counterData.counterType] || COUNTER_TYPES.OPD_REGISTRATION;
  const estimatedWaitMinutes = Number(counterData.waitMinutes) || 0;
  const isCounterOpen = counterData.isOpen !== false;
  const queueLengthPersons = Number(counterData.queueLengthPersons) || 0;

  const isSevereCongestion = estimatedWaitMinutes > (counter.normWaitMinutes * 2);
  let statusLevel = 'NORMAL';

  if (!isCounterOpen) {
    statusLevel = 'COUNTER_SHUTTERED';
  } else if (isSevereCongestion || queueLengthPersons > 50) {
    statusLevel = 'HEAVILY_CONGESTED';
  } else if (estimatedWaitMinutes > counter.normWaitMinutes) {
    statusLevel = 'MODERATE_WAIT';
  }

  return {
    counterCode: counter.code,
    counterName: counter.name,
    isCounterOpen,
    queueLengthPersons,
    estimatedWaitMinutes,
    prescribedNormWaitMinutes: counter.normWaitMinutes,
    statusLevel,
    isSevereCongestion,
    actionRequired: !isCounterOpen
      ? 'Counter reported closed during official OPD shift. MOIC intervention needed to deploy pharmacist/registration clerk.'
      : isSevereCongestion
      ? 'Severe queue overflow: Deploy auxiliary ABHA digital queue counter or split into separate elderly/female queues.'
      : 'Queue progressing within normal hospital flow.'
  };
}

/**
 * Checks observation freshness with strict 4-hour intra-day expiry.
 * @param {string|Date} observationTime 
 * @returns {Object} freshness
 */
export function evaluateHealthObservationFreshness(observationTime) {
  const obsMs = new Date(observationTime).getTime();
  const nowMs = Date.now();
  const ageHours = (nowMs - obsMs) / (1000 * 60 * 60);

  const isFresh = !isNaN(obsMs) && ageHours >= 0 && ageHours <= 4;
  return {
    isFresh,
    ageHours: Math.max(0, Number(ageHours.toFixed(1))),
    expiryLimitHours: 4,
    statusNote: isFresh ? `Active Ground Data (${Math.round(ageHours * 60)} min old)` : 'Stale Observation (>4h old, expired)'
  };
}

/**
 * Aggregates patient crowd observations requiring at least 3 fresh reports.
 * @param {Array<Object>} reports 
 * @returns {Object} aggregate
 */
export function aggregateHealthQueueObservations(reports = []) {
  if (!Array.isArray(reports) || reports.length === 0) {
    return {
      totalObservations: 0,
      isVerifiedConsensus: false,
      reportedMedicineStockOutCount: 0
    };
  }

  const freshReports = reports.filter(r => {
    const f = evaluateHealthObservationFreshness(r.reportedAt);
    return f.isFresh;
  });

  const stockOuts = freshReports.filter(r => r.isEssentialMedicineStockOut).length;
  const closedCounters = freshReports.filter(r => r.isCounterPrematurelyClosed).length;

  return {
    totalObservations: freshReports.length,
    isVerifiedConsensus: freshReports.length >= 3,
    reportedMedicineStockOutCount: stockOuts,
    reportedClosedCounterCount: closedCounters,
    hasSevereStockOutConsensus: stockOuts >= 2,
    priorityEscalationNeeded: freshReports.length >= 3 && (stockOuts >= 2 || closedCounters >= 2)
  };
}

/**
 * Formats printable administrative representation for Chief Medical Superintendent / CMO.
 * @param {Object} facility 
 * @param {Object} congestion 
 * @param {Object} aggregate 
 * @returns {string} markdown representation
 */
export function exportHealthQueueRepresentation(facility = {}, congestion = {}, aggregate = {}) {
  return [
    `# Public Health Counter Service & Availability Memorandum`,
    `**Health Facility:** ${facility.name || 'Community Health Centre (CHC)'} (${facility.tier || 'CHC/District Hospital'})`,
    `**Location / Tehsil:** ${facility.blockOrTehsil || 'Local Tehsil'}, **District:** ${facility.district || 'Uttar Pradesh'}`,
    `**Target Counter:** ${congestion.counterName}`,
    `**Operational Status:** ${congestion.statusLevel}`,
    `**Current Estimated Wait Time:** ~${congestion.estimatedWaitMinutes} Minutes (Queue: ~${congestion.queueLengthPersons} patients)`,
    ``,
    `## Community Ground Observation Summary (Fresh <4 Hours)`,
    `- Verified Patient Observations: **${aggregate.totalObservations || 1} independent reports**`,
    `- Counter Closure Status: ${congestion.isCounterOpen ? 'Open' : '⚠️ Reported Unstaffed / Closed during official OPD hours'}`,
    `- Medicine Stock-Out Warning: ${aggregate.hasSevereStockOutConsensus ? '⚠️ MULTIPLE PATIENTS REPORT ESSENTIAL DRUGS (Antibiotics/Analgesics) OUT OF STOCK' : 'Normal inventory reported'}`,
    `- Administrative Assessment: ${congestion.actionRequired}`,
    ``,
    `## Administrative Demands under National Health Mission Norms`,
    `1. Deploy an additional registration clerk or enable ABHA Scan-and-Share express counter to reduce registration queue times under 20 minutes.`,
    `2. Re-supply stock-out medications from the district buffer warehouse (UPMSCL - UP Medical Supplies Corporation Ltd).`,
    `3. Ensure functional drinking water and ceiling fans in the patient waiting shed.`,
    ``,
    `## Escalation Pathway`,
    ...UP_HEALTH_ESCALATION_OFFICERS.map(o => `- **${o.title}** (${o.level}) — *Role:* ${o.role}`),
    ``,
    `---`,
    `> **Patient Dignity & Clinical Privacy:** No clinical case records, diagnostic test findings, prescription photos, or patient names are captured.`
  ].join('\n');
}


export const UP_HEALTH_FACILITY_FAQS = [
  {
    q: 'Are medicines completely free in UP government hospitals and CHCs?',
    a: 'Yes. Under the Essential Drug List (EDL) policy of the UP Government, over 300 essential medicines are mandated to be dispensed free of cost.'
  },
  {
    q: 'What is the ABHA Scan and Share QR code registration process?',
    a: 'Patients can scan the hospital Ayushman Bharat Health Account (ABHA) QR code using the Aarogya Setu or ABHA app to generate an instant OPD registration token, skipping long manual queues.'
  },
  {
    q: 'What is the operational timing of OPD counters in government hospitals in UP?',
    a: 'General OPD operates from 08:00 AM to 02:00 PM on all working days. Emergency services operate 24 hours a day, 7 days a week.'
  },
  {
    q: 'Can a patient file a grievance if a doctor writes medicines to be purchased from private medical shops outside?',
    a: 'Yes. Writing outside branded prescriptions when generic drugs are available in the hospital formulary is prohibited under government circulars and can be escalated to the CMS or CMO.'
  }
];

export const UP_ESSENTIAL_DIAGNOSTIC_SERVICES = [
  'Complete Blood Count (CBC) and Hemoglobin estimation',
  'Blood Glucose (Random, Fasting, Post-Prandial)',
  'Malaria, Dengue, and Chikungunya rapid card tests',
  'Sputum microscopy for Tuberculosis (TB-Nikshay)',
  'Urine routine and microscopy examination',
  'Digital X-Ray and Ultrasonography (USG) for antenatal care'
];

/**
 * Returns procedural FAQs for patients in UP public health facilities.
 * @returns {Array<{q: string, a: string}>}
 */
export function getHealthFacilityFaqs() {
  return UP_HEALTH_FACILITY_FAQS;
}

/**
 * Returns list of essential free diagnostic tests mandated at CHCs and District Hospitals.
 * @returns {Array<string>}
 */
export function getEssentialDiagnosticsList() {
  return UP_ESSENTIAL_DIAGNOSTIC_SERVICES;
}
