/**
 * src/services/syntheticGeneratorEngine.js
 *
 * Procedural Topological Civic Generator Engine (#778).
 *
 * Implements:
 * - Mulberry32 32-bit deterministic pseudo-random number generator (PRNG)
 * - Directed Acyclic Graph (DAG) generation preserving referential integrity:
 *     Offices -> Services -> Applications -> Grievances
 * - Markov Chain timeline state transitions with statutory delay modeling
 * - Indic multi-lingual name and landmark synthesis
 * - Edge case injection (cure window deficiencies, overdue deadlines, multi-script)
 * - Standardized export transformers: JSON, CSV, and SQL inserts
 */

import {
  INDIC_REGIONAL_NAMES,
  JURISDICTIONS_DATA,
  CIVIC_SERVICE_TEMPLATES,
  SYNTHETIC_ADDRESS_LANDMARKS,
  GRIEVANCE_CATEGORIES,
  TIMELINE_TRANSITION_REMARKS,
} from '../data/syntheticIndicLexicon';
import { SYNTHETIC_WATERMARK } from './piiLeakageGuardService';

/**
 * Creates a reproducible Mulberry32 32-bit PRNG from an integer seed.
 */
export function createPRNG(initialSeed = 1337) {
  let s = (Math.abs(Number(initialSeed)) || 1337) >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns a random integer between min and max (inclusive) using the PRNG.
 */
export function randomInt(prng, min, max) {
  return Math.floor(prng() * (max - min + 1)) + min;
}

/**
 * Returns a uniform random item from an array.
 */
export function randomChoice(prng, arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(prng() * arr.length)];
}

/**
 * Selects an item based on categorical weights.
 */
export function randomWeightedChoice(prng, itemsWithWeights) {
  const total = itemsWithWeights.reduce((sum, item) => sum + item.weight, 0);
  let threshold = prng() * total;
  for (const item of itemsWithWeights) {
    if (threshold < item.weight) return item.value;
    threshold -= item.weight;
  }
  return itemsWithWeights[itemsWithWeights.length - 1].value;
}

/**
 * Generates an 8-character hex string deterministically.
 */
export function generateHexId(prng, length = 6) {
  let res = '';
  for (let i = 0; i < length; i += 1) {
    res += Math.floor(prng() * 16).toString(16).toUpperCase();
  }
  return res;
}

/**
 * Simple fast deterministic string hash (FNV-1a 32-bit).
 */
export function calculateChecksum(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * 1. Generates Synthetic Administrative Offices
 */
export function generateOffices(count, jurisdictionScope, prng) {
  const matchedJurisdiction =
    JURISDICTIONS_DATA.find(
      (j) => j.state === jurisdictionScope?.state && j.district === jurisdictionScope?.district
    ) || JURISDICTIONS_DATA[0];

  const offices = [];
  const baseOffices = matchedJurisdiction.offices;

  for (let i = 0; i < count; i += 1) {
    const template = baseOffices[i % baseOffices.length];
    const officeNum = i + 1;
    const hex = generateHexId(prng, 4);

    offices.push({
      id: `SYN-OFF-${hex}`,
      name: `${template.name} #${officeNum}`,
      code: `${template.code}-${officeNum}`,
      type: template.type,
      state: matchedJurisdiction.state,
      district: matchedJurisdiction.district,
      ward: randomChoice(prng, matchedJurisdiction.wards),
      pincode: template.pincode,
      address: `${template.address}, Block ${officeNum}`,
      officialContactDesignation: 'Public Service Desk In-Charge',
      syntheticContactPhone: `+91-99900-${randomInt(prng, 10000, 99999)}`,
      isSynthetic: true,
      syntheticWatermark: SYNTHETIC_WATERMARK,
    });
  }

  return offices;
}

/**
 * 2. Generates Synthetic Civic Services
 */
export function generateServices(count, prng) {
  const services = [];
  const allTemplates = [];

  for (const cat of CIVIC_SERVICE_TEMPLATES) {
    for (const s of cat.services) {
      allTemplates.push({ ...s, category: cat.category, department: cat.department });
    }
  }

  for (let i = 0; i < count; i += 1) {
    const template = allTemplates[i % allTemplates.length];
    const hex = generateHexId(prng, 4);

    services.push({
      id: `SYN-SRV-${hex}`,
      name: `${template.name} [Synthetic-${i + 1}]`,
      category: template.category,
      department: template.department,
      difficulty: template.difficulty,
      statutoryDays: template.statutoryDays,
      fee: template.fee,
      feeType: template.feeType,
      requiredDocs: template.requiredDocs,
      validity: template.validity,
      officialPortalUrl: `https://synthetic.services.civic.internal/service/SYN-SRV-${hex}`,
      isSynthetic: true,
      syntheticWatermark: SYNTHETIC_WATERMARK,
    });
  }

  return services;
}

/**
 * Generates an applicant pseudonym respecting Indic regional scripts.
 */
export function generateApplicantName(prng, languageDist, state = 'Maharashtra') {
  let regionKey = 'maharashtra';
  if (state === 'Delhi') regionKey = 'north';
  else if (state === 'Karnataka') regionKey = 'south';

  const regionNames = INDIC_REGIONAL_NAMES[regionKey] || INDIC_REGIONAL_NAMES.maharashtra;
  const firstNameObj = randomChoice(prng, regionNames.firstNames);
  const lastNameObj = randomChoice(prng, regionNames.lastNames);

  // Pick language based on distribution
  const langChoices = Object.entries(languageDist || { en: 0.5, mr: 0.5 }).map(
    ([lang, weight]) => ({ value: lang, weight })
  );
  const chosenLang = randomWeightedChoice(prng, langChoices);

  const first = firstNameObj[chosenLang] || firstNameObj.en;
  const last = lastNameObj[chosenLang] || lastNameObj.en;

  return {
    fullName: `${first} ${last}`,
    primaryScript: chosenLang,
    latinTransliteration: `${firstNameObj.en} ${lastNameObj.en}`,
  };
}

/**
 * 3. Generates Synthetic Citizen Applications with Markov Status Timelines
 */
export function generateApplications(
  count,
  services,
  offices,
  edgeCaseRates = {},
  languageDist = {},
  prng
) {
  const applications = [];
  const baseDate = new Date(2026, 8, 1); // Start Sept 1, 2026

  for (let i = 0; i < count; i += 1) {
    const service = randomChoice(prng, services);
    const office = randomChoice(prng, offices);
    const applicant = generateApplicantName(prng, languageDist, office.state);
    const hex = generateHexId(prng, 4);

    // Apply date variations
    const dayOffset = randomInt(prng, 0, 60);
    const appliedTimestamp = new Date(baseDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);

    // Timeline state machine
    const hasDeficiency = prng() < (edgeCaseRates.queryDeficiencyPct || 0.15);
    const isOverdue = prng() < (edgeCaseRates.statutoryDeadlineOverduePct || 0.2);

    const timeline = [];
    let currentStepDate = new Date(appliedTimestamp);

    // Event 1: SUBMITTED
    timeline.push({
      status: 'SUBMITTED',
      date: currentStepDate.toISOString(),
      actor: 'Applicant',
      remarks: randomChoice(prng, TIMELINE_TRANSITION_REMARKS.SUBMITTED),
    });

    // Event 2: IN_SCRUTINY
    currentStepDate = new Date(currentStepDate.getTime() + randomInt(prng, 1, 3) * 86400000);
    timeline.push({
      status: 'IN_SCRUTINY',
      date: currentStepDate.toISOString(),
      actor: 'Scrutiny Officer',
      remarks: randomChoice(prng, TIMELINE_TRANSITION_REMARKS.IN_SCRUTINY),
    });

    // Intermediate Deficiency query event
    if (hasDeficiency) {
      currentStepDate = new Date(currentStepDate.getTime() + randomInt(prng, 2, 4) * 86400000);
      timeline.push({
        status: 'QUERY_RAISED',
        date: currentStepDate.toISOString(),
        actor: 'Scrutiny Officer',
        cureDaysAllowed: 15,
        remarks: randomChoice(prng, TIMELINE_TRANSITION_REMARKS.QUERY_RAISED),
      });

      currentStepDate = new Date(currentStepDate.getTime() + randomInt(prng, 3, 7) * 86400000);
      timeline.push({
        status: 'QUERY_RESOLVED',
        date: currentStepDate.toISOString(),
        actor: 'Applicant',
        remarks: randomChoice(prng, TIMELINE_TRANSITION_REMARKS.QUERY_RESOLVED),
      });
    }

    // Outcome determination
    const outcomeWeights = [
      { value: 'APPROVED', weight: 0.65 },
      { value: 'REJECTED', weight: 0.20 },
      { value: 'IN_PROCESS', weight: 0.15 },
    ];
    const outcome = randomWeightedChoice(prng, outcomeWeights);

    let finalStatus = 'IN_SCRUTINY';
    if (outcome === 'APPROVED') {
      const completionDays = isOverdue
        ? service.statutoryDays + randomInt(prng, 5, 20)
        : Math.max(2, service.statutoryDays - randomInt(prng, 1, 4));
      currentStepDate = new Date(appliedTimestamp.getTime() + completionDays * 86400000);

      timeline.push({
        status: 'APPROVED',
        date: currentStepDate.toISOString(),
        actor: 'Competent Authority',
        remarks: randomChoice(prng, TIMELINE_TRANSITION_REMARKS.APPROVED),
      });
      finalStatus = 'APPROVED';
    } else if (outcome === 'REJECTED') {
      currentStepDate = new Date(currentStepDate.getTime() + randomInt(prng, 5, 12) * 86400000);
      timeline.push({
        status: 'REJECTED',
        date: currentStepDate.toISOString(),
        actor: 'Competent Authority',
        remarks: randomChoice(prng, TIMELINE_TRANSITION_REMARKS.REJECTED),
      });
      finalStatus = 'REJECTED';
    }

    const statutoryDueDate = new Date(appliedTimestamp.getTime() + service.statutoryDays * 86400000);

    applications.push({
      id: `SYN-APP-${hex}`,
      serviceId: service.id,
      serviceName: service.name,
      officeId: office.id,
      officeName: office.name,
      applicantPseudonym: applicant.fullName,
      applicantLatinName: applicant.latinTransliteration,
      applicantLanguage: applicant.primaryScript,
      dummyContactPhone: `+91-99900-${randomInt(prng, 10000, 99999)}`,
      address: `${randomChoice(prng, SYNTHETIC_ADDRESS_LANDMARKS)}, ${office.ward}, ${office.district}`,
      status: finalStatus,
      appliedDate: appliedTimestamp.toISOString().split('T')[0],
      statutoryDueDate: statutoryDueDate.toISOString().split('T')[0],
      isOverdue: isOverdue && finalStatus !== 'APPROVED',
      timeline,
      syntheticExplainability: {
        rulesetVersion: '1.0.0',
        generatorType: 'rule-based-topological-dag',
        inputFeatureWindow: '2026-Q3-Q4',
        governingRules: [
          `Service statutory SLA ceiling: ${service.statutoryDays} days`,
          hasDeficiency ? 'Deficiency injection rule applied (15-day cure window)' : 'Standard clean verification rule',
          isOverdue ? 'Simulated delay rule: overdue status triggered beyond statutory days' : 'Timely clearance rule',
        ],
        influencingFields: ['serviceId', 'officeId', 'statutoryDays', 'edgeCaseRates'],
      },
      isSynthetic: true,
      syntheticWatermark: SYNTHETIC_WATERMARK,
    });
  }

  return applications;
}

/**
 * 4. Generates Synthetic Public Grievances
 */
export function generateGrievances(count, services, applications, edgeCaseRates = {}, prng) {
  const grievances = [];
  const baseDate = new Date(2026, 9, 1);

  for (let i = 0; i < count; i += 1) {
    const service = randomChoice(prng, services);
    const category = randomChoice(prng, GRIEVANCE_CATEGORIES);
    const hex = generateHexId(prng, 4);

    // 50% chance of being linked to an existing application
    const linkedApp = prng() > 0.5 ? randomChoice(prng, applications) : null;
    const dayOffset = randomInt(prng, 0, 45);
    const filedDate = new Date(baseDate.getTime() + dayOffset * 86400000);

    const isEscalated = prng() < (edgeCaseRates.statutoryDeadlineOverduePct || 0.25);
    const statuses = ['SUBMITTED', 'UNDER_INVESTIGATION', 'ACTION_TAKEN', 'RESOLVED', 'CLOSED'];
    const status = randomChoice(prng, statuses);

    grievances.push({
      id: `SYN-GRV-${hex}`,
      serviceId: service.id,
      serviceName: service.name,
      applicationId: linkedApp ? linkedApp.id : null,
      categoryCode: category.code,
      title: `${category.title} (Ticket #${i + 1})`,
      severity: category.severity,
      status,
      filedDate: filedDate.toISOString().split('T')[0],
      escalationLevel: isEscalated ? 'LEVEL_2_COMMISSIONER' : 'LEVEL_1_WARD_OFFICER',
      statutoryResolutionDays: category.escalationDays,
      publicSummary: `Synthetic grievance: ${category.title} reported near public ward sector. Automated testing entry.`,
      syntheticExplainability: {
        rulesetVersion: '1.0.0',
        generatorType: 'rule-based-markov-chain',
        inputFeatureWindow: '2026-Q3-Q4',
        governingRules: [
          `Category severity: ${category.severity}`,
          `Resolution statutory window: ${category.escalationDays} days`,
          isEscalated ? 'Tier-2 Appellate escalation triggered' : 'Tier-1 Ward resolution path',
        ],
        influencingFields: ['serviceId', 'categoryCode', 'severity', 'edgeCaseRates'],
      },
      isSynthetic: true,
      syntheticWatermark: SYNTHETIC_WATERMARK,
    });
  }

  return grievances;
}

/**
 * Master generator: Executes topological DAG from SyntheticProfile.
 */
export function executeSyntheticGeneration(profile) {
  const seed = profile?.seed || 1337;
  const prng = createPRNG(seed);

  const scale = profile?.scaleConfig || {
    servicesCount: 5,
    officesCount: 3,
    applicationsCount: 25,
    grievancesCount: 10,
  };

  const jurisdiction = profile?.jurisdictionScope || {
    state: 'Maharashtra',
    district: 'Pune',
  };

  const edgeCases = profile?.edgeCaseRates || {};
  const langDist = profile?.languageDistribution || { en: 0.5, mr: 0.5 };

  // 1. Generate Offices
  const offices = generateOffices(scale.officesCount, jurisdiction, prng);

  // 2. Generate Services
  const services = generateServices(scale.servicesCount, prng);

  // 3. Generate Applications (Foreign keys reference generated services and offices)
  const applications = generateApplications(
    scale.applicationsCount,
    services,
    offices,
    edgeCases,
    langDist,
    prng
  );

  // 4. Generate Grievances (Foreign keys reference services and optionally applications)
  const grievances = generateGrievances(scale.grievancesCount, services, applications, edgeCases, prng);

  const bundle = {
    profileId: profile?.profileId || 'custom-profile',
    seed,
    generatedAt: new Date().toISOString(),
    schemaVersion: '1.0.0',
    jurisdictionScope: jurisdiction,
    summary: {
      totalOffices: offices.length,
      totalServices: services.length,
      totalApplications: applications.length,
      totalGrievances: grievances.length,
      grandTotalRecords: offices.length + services.length + applications.length + grievances.length,
    },
    rulesetMetadata: {
      rulesetVersion: '1.0.0',
      generatorType: 'Topological-DAG-Markov-Engine',
      inputFeatureWindow: '2026-Q3-Q4',
      privacyReviewStatus: 'APPROVED_BOUNDED_NON_PARAMETRIC',
      executionTimestamp: new Date().toISOString(),
    },
    offices,
    services,
    applications,
    grievances,
    isSynthetic: true,
    syntheticWatermark: SYNTHETIC_WATERMARK,
  };

  const deterministicPayload = {
    profileId: bundle.profileId,
    seed: bundle.seed,
    jurisdictionScope: bundle.jurisdictionScope,
    offices: bundle.offices,
    services: bundle.services,
    applications: bundle.applications,
    grievances: bundle.grievances,
  };

  bundle.checksum = calculateChecksum(deterministicPayload);

  return bundle;
}

/**
 * Export helpers: JSON, CSV, and SQL
 */
export function exportBundleToJson(bundle) {
  return JSON.stringify(bundle, null, 2);
}

export function exportEntityToCsv(records) {
  if (!Array.isArray(records) || records.length === 0) return '';
  const sample = records[0];
  const keys = Object.keys(sample).filter(
    (k) => typeof sample[k] !== 'object' && !Array.isArray(sample[k])
  );

  const header = keys.join(',');
  const rows = records.map((rec) =>
    keys
      .map((k) => {
        const val = rec[k] !== undefined && rec[k] !== null ? String(rec[k]) : '';
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(',')
  );

  return [header, ...rows].join('\n');
}

export function exportBundleToSql(bundle) {
  const statements = [];
  statements.push(`-- Synthetic Civic Dataset Export (Seed: ${bundle.seed})`);
  statements.push(`-- Watermark: ${bundle.syntheticWatermark}`);
  statements.push('');

  for (const s of bundle.services) {
    statements.push(
      `INSERT INTO synthetic_services (id, name, category, department, statutory_days, fee, fee_type) VALUES ('${s.id}', '${s.name.replace(/'/g, "''")}', '${s.category}', '${s.department}', ${s.statutoryDays}, ${s.fee}, '${s.feeType}');`
    );
  }

  for (const o of bundle.offices) {
    statements.push(
      `INSERT INTO synthetic_offices (id, name, type, state, district, ward, pincode) VALUES ('${o.id}', '${o.name.replace(/'/g, "''")}', '${o.type}', '${o.state}', '${o.district}', '${o.ward}', ${o.pincode});`
    );
  }

  for (const a of bundle.applications) {
    statements.push(
      `INSERT INTO synthetic_applications (id, service_id, office_id, applicant_pseudonym, status, applied_date) VALUES ('${a.id}', '${a.serviceId}', '${a.officeId}', '${a.applicantPseudonym.replace(/'/g, "''")}', '${a.status}', '${a.appliedDate}');`
    );
  }

  for (const g of bundle.grievances) {
    statements.push(
      `INSERT INTO synthetic_grievances (id, service_id, application_id, category_code, severity, status) VALUES ('${g.id}', '${g.serviceId}', ${g.applicationId ? `'${g.applicationId}'` : 'NULL'}, '${g.categoryCode}', '${g.severity}', '${g.status}');`
    );
  }

  return statements.join('\n');
}
