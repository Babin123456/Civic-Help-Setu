/**
 * Inter-State Civic Service Guide for Migrant Workers Service
 *
 * Implements a migration navigation engine comparing origin and destination states
 * to structure transition workflows for inter-state workers and families:
 *
 * 1. Categorization of Transition Tasks:
 *    - PORTABLE_BENEFITS: Nationally portable schemes (ONORC ration portability, e-Shram, PM-JAY).
 *    - PROFILE_UPDATES: Address and constituency modifications on existing national IDs (Aadhaar, Voter ID Form 8).
 *    - FRESH_APPLICATIONS: State welfare benefits requiring fresh local registration (BOCW boards, state subsidies).
 *    - LOCAL_REGISTRATIONS: Local neighborhood registrations (school transfers under RTE, resident tenant verification).
 * 2. Distinction of Central vs. State Ownership & Portability:
 *    - NATIONWIDE_PORTABLE vs. CONDITIONAL_PORTABILITY vs. NON_PORTABLE_LOCAL_ONLY.
 * 3. Verified Provenance & No Guessing:
 *    - Every portability rule cites official acts, portals, and last-verified dates.
 *    - Unsupported state pairs or unverified schemes explicitly output "NOT_VERIFIED", never a guess.
 * 4. Privacy-Respecting Transition Checklist:
 *    - Generates user-saveable and exportable action checklists without collecting personal Aadhaar,
 *      ration numbers, or identity credentials.
 */

export const TASK_CATEGORY = {
  PORTABLE_BENEFITS: 'PORTABLE_BENEFITS',
  PROFILE_UPDATES: 'PROFILE_UPDATES',
  FRESH_APPLICATIONS: 'FRESH_APPLICATIONS',
  LOCAL_REGISTRATIONS: 'LOCAL_REGISTRATIONS',
};

export const PORTABILITY_TIER = {
  NATIONWIDE_PORTABLE: 'NATIONWIDE_PORTABLE',
  CONDITIONAL_PORTABILITY: 'CONDITIONAL_PORTABILITY',
  NON_PORTABLE_LOCAL_ONLY: 'NON_PORTABLE_LOCAL_ONLY',
};

/**
 * Curated interstate transition rules and schemes.
 */
export const INTERSTATE_SCHEME_RULES = {
  RATION_ONORC: {
    title: 'Subsidized Foodgrains via One Nation One Ration Card (ONORC)',
    category: TASK_CATEGORY.PORTABLE_BENEFITS,
    portabilityTier: PORTABILITY_TIER.NATIONWIDE_PORTABLE,
    schemeOwnership: 'CENTRAL_STATE_PARTNERSHIP',
    guidance:
      'Under the National Food Security Act (NFSA), your existing ration card remains active. ' +
      'You can lift subsidized foodgrains at any Fair Price Shop (FPS) in your destination state ' +
      'using biometric Aadhaar e-PoS authentication. You do NOT need to cancel your home ration card.',
    officialSource: 'Department of Food and Public Distribution, Govt of India',
    portalUrl: 'https://nfsa.gov.in',
    lastVerifiedDate: '2026-01-10',
  },
  E_SHRAM_BENEFITS: {
    title: 'Unorganized Worker Social Security via e-Shram UAN',
    category: TASK_CATEGORY.PORTABLE_BENEFITS,
    portabilityTier: PORTABILITY_TIER.NATIONWIDE_PORTABLE,
    schemeOwnership: 'CENTRAL',
    guidance:
      'Your 12-digit Universal Account Number (UAN) is valid across India. Update your current ' +
      'destination address and occupation profile on the e-Shram portal to remain eligible for ' +
      'accidental insurance (PMSBY) and emergency social security distributions.',
    officialSource: 'Ministry of Labour and Employment, Govt of India',
    portalUrl: 'https://eshram.gov.in',
    lastVerifiedDate: '2026-01-15',
  },
  HEALTH_PMJAY: {
    title: 'Ayushman Bharat PM-JAY Nationwide Hospitalization Portability',
    category: TASK_CATEGORY.PORTABLE_BENEFITS,
    portabilityTier: PORTABILITY_TIER.NATIONWIDE_PORTABLE,
    schemeOwnership: 'CENTRAL_STATE_PARTNERSHIP',
    guidance:
      'Eligible SECC/ABHA holders can access cashless secondary and tertiary hospitalization ' +
      'at any empanelled public or private hospital nationwide regardless of issuing state.',
    officialSource: 'National Health Authority (NHA)',
    portalUrl: 'https://pmjay.gov.in',
    lastVerifiedDate: '2026-02-01',
  },
  VOTER_ID_TRANSFER: {
    title: 'Voter Registration Transfer to Destination Constituency',
    category: TASK_CATEGORY.PROFILE_UPDATES,
    portabilityTier: PORTABILITY_TIER.CONDITIONAL_PORTABILITY,
    schemeOwnership: 'ELECTION_COMMISSION',
    guidance:
      'If residing permanently at destination, submit Form 8 (shifting of residence outside constituency) ' +
      'via the Election Commission Voters portal. Avoid double-voting or holding dual registrations.',
    officialSource: 'Election Commission of India (ECI)',
    portalUrl: 'https://voters.eci.gov.in',
    lastVerifiedDate: '2026-01-20',
  },
  BOCW_WORKER_BOARD: {
    title: 'Building & Other Construction Workers (BOCW) Welfare Board Registration',
    category: TASK_CATEGORY.FRESH_APPLICATIONS,
    portabilityTier: PORTABILITY_TIER.NON_PORTABLE_LOCAL_ONLY,
    schemeOwnership: 'STATE_GOVERNMENT',
    guidance:
      'BOCW welfare funds are managed state-by-state. Construction workers must obtain 90-day ' +
      'work certification from their destination contractor or trade union to register with the ' +
      'destination state BOCW board and claim local education, marriage, and pension cess benefits.',
    officialSource: 'State Labour Welfare Departments',
    portalUrl: 'https://labour.gov.in',
    lastVerifiedDate: '2026-01-12',
  },
  CHILD_EDUCATION_RTE: {
    title: 'Children Government School Transfer under Right to Education (RTE)',
    category: TASK_CATEGORY.LOCAL_REGISTRATIONS,
    portabilityTier: PORTABILITY_TIER.CONDITIONAL_PORTABILITY,
    schemeOwnership: 'CENTRAL_STATE_PARTNERSHIP',
    guidance:
      'Under the RTE Act, 2009, children of migrant workers are entitled to admission in government ' +
      'neighborhood schools without requiring transfer certificates (TC) or birth certificates as a barrier.',
    officialSource: 'Department of School Education & Literacy, Ministry of Education',
    portalUrl: 'https://dsel.education.gov.in',
    lastVerifiedDate: '2026-01-18',
  },
};

/**
 * Verified State Registry
 */
export const VERIFIED_STATES = new Set([
  'BIHAR',
  'UTTAR_PRADESH',
  'TAMIL_NADU',
  'MAHARASHTRA',
  'KARNATAKA',
  'WEST_BENGAL',
  'ODISHA',
  'KERALA',
  'TELANGANA',
  'DELHI',
]);

/**
 * Generates an inter-state civic migration roadmap for a given origin and destination pair.
 *
 * @param {string} originState
 * @param {string} destinationState
 * @returns {Object} Categorized roadmap model
 */
export function generateInterStateMigrationGuide(originState, destinationState) {
  if (!originState || !destinationState) {
    throw new Error('Both originState and destinationState are required');
  }

  const originNorm = originState.toUpperCase().replace(/\s+/g, '_');
  const destNorm = destinationState.toUpperCase().replace(/\s+/g, '_');

  if (originNorm === destNorm) {
    return {
      isInterState: false,
      originState,
      destinationState,
      message: 'Origin and destination are within the same state. Use intra-state district relocation guide.',
      tasks: [],
    };
  }

  const isOriginVerified = VERIFIED_STATES.has(originNorm);
  const isDestVerified = VERIFIED_STATES.has(destNorm);

  if (!isOriginVerified || !isDestVerified) {
    return {
      isInterState: true,
      originState,
      destinationState,
      isVerifiedCombination: false,
      message: `Statutory transition rules for state pair ${originState} -> ${destinationState} are not verified. Do not guess.`,
      recommendedAction: 'Check national portability portals (nfsa.gov.in, eshram.gov.in) directly.',
      tasks: [],
    };
  }

  // Compile categorized tasks
  const tasks = Object.entries(INTERSTATE_SCHEME_RULES).map(([key, scheme], idx) => ({
    id: `mig_task_${idx + 1}`,
    key,
    title: scheme.title,
    category: scheme.category,
    portabilityTier: scheme.portabilityTier,
    ownership: scheme.schemeOwnership,
    actionGuidance: scheme.guidance,
    officialPortalUrl: scheme.portalUrl,
    officialSource: scheme.officialSource,
    lastVerifiedDate: scheme.lastVerifiedDate,
    isCompleted: false,
  }));

  const categorized = {
    [TASK_CATEGORY.PORTABLE_BENEFITS]: tasks.filter((t) => t.category === TASK_CATEGORY.PORTABLE_BENEFITS),
    [TASK_CATEGORY.PROFILE_UPDATES]: tasks.filter((t) => t.category === TASK_CATEGORY.PROFILE_UPDATES),
    [TASK_CATEGORY.FRESH_APPLICATIONS]: tasks.filter((t) => t.category === TASK_CATEGORY.FRESH_APPLICATIONS),
    [TASK_CATEGORY.LOCAL_REGISTRATIONS]: tasks.filter((t) => t.category === TASK_CATEGORY.LOCAL_REGISTRATIONS),
  };

  return {
    isInterState: true,
    originState: originNorm,
    destinationState: destNorm,
    isVerifiedCombination: true,
    totalTasks: tasks.length,
    categorizedTasks: categorized,
    disclaimer:
      'Inter-state portability rules are subject to bilateral state notifications and central guidelines. ' +
      'Civic-Help-Setu does not collect personal identity numbers to generate this guide.',
  };
}

/**
 * Exports a clean migration checklist package.
 *
 * @param {Object} migrationGuide Result from generateInterStateMigrationGuide
 * @returns {Object} Export model
 */
export function exportMigrantTransitionChecklist(migrationGuide) {
  if (!migrationGuide || !migrationGuide.isVerifiedCombination) {
    return {
      exportedAt: new Date().toISOString(),
      status: 'NOT_VERIFIED',
      message: 'Cannot export an unverified interstate transition roadmap.',
    };
  }

  const allTasks = [];
  for (const catTasks of Object.values(migrationGuide.categorizedTasks)) {
    for (const t of catTasks) {
      allTasks.push({
        title: t.title,
        category: t.category,
        portability: t.portabilityTier,
        guidance: t.actionGuidance,
        source: t.officialSource,
        portal: t.officialPortalUrl,
        isCompleted: Boolean(t.isCompleted),
      });
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    route: `${migrationGuide.originState} -> ${migrationGuide.destinationState}`,
    totalChecklistItems: allTasks.length,
    checklist: allTasks,
    disclaimer: migrationGuide.disclaimer,
  };
}
