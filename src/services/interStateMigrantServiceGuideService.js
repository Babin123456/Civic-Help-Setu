/**
 * National Inter-State Migrant Worker Document and Benefit Portability Planner
 *
 * Implements a privacy-first planner that compares origin and destination state guidance
 * for selected public services and benefits. Workers moving between states can determine
 * which documents remain usable, which benefits are portable, and where to seek help in
 * the destination state.
 *
 * Key principles:
 * - State-specific requirements are never generalized nationally.
 * - Every portability claim links to a dated official source.
 * - Unknown/conflicting rules remain visible (never guessed over).
 * - No employer, location history, or identity number is required.
 * - Offline export retains no precise travel or employer history.
 * - Does not guarantee benefit portability or act as a labour placement intermediary.
 */

// -- Exported constants for portability tiers and task categories --
export const PORTABILITY_TIER = {
  NATIONWIDE_PORTABLE: 'NATIONWIDE_PORTABLE',
  CONDITIONAL_PORTABILITY: 'CONDITIONAL_PORTABILITY',
  NON_PORTABLE_LOCAL_ONLY: 'NON_PORTABLE_LOCAL_ONLY',
};

export const TASK_CATEGORY = {
  PORTABLE_BENEFITS: 'PORTABLE_BENEFITS',
  PROFILE_UPDATES: 'PROFILE_UPDATES',
  FRESH_APPLICATIONS: 'FRESH_APPLICATIONS',
  LOCAL_REGISTRATIONS: 'LOCAL_REGISTRATIONS',
};

import { INDIAN_STATES_AND_UTS } from '../data/jurisdictions';

// ---------------------------------------------------------------------------
// Bilingual document inventory (English + Hindi)
// ---------------------------------------------------------------------------

/**
 * Document inventory entries with bilingual descriptions.
 * Each entry lists the document name, its purpose, and portability status
 * across state borders. No personal document numbers or Aadhaar/ration numbers
 * are stored; only the document type and its applicability.
 */
export const MIGRANT_DOCUMENT_INVENTORY = [
  {
    id: 'ration-card',
    name: 'Ration Card',
    hindi: 'राशन कार्ड',
    category: 'FOOD_SECURITY',
    portabilityTier: 'NATIONWIDE_PORTABLE',
    description:
      'Used for lifting subsidized foodgrains under NFSA. Under ONORC, the same card works at any Fair Price Shop in India using biometric Aadhaar e-PoS authentication. You do NOT need to cancel your home ration card.',
    officialSource: 'Department of Food and Public Distribution, Govt of India',
    portalUrl: 'https://nfsa.gov.in',
    lastVerified: '2026-01-10',
  },
  {
    id: 'aadhaar-card',
    name: 'Aadhaar Card',
    hindi: 'आधार कार्ड',
    category: 'IDENTITY',
    portabilityTier: 'NATIONWIDE_PORTABLE',
    description:
      'UIDAI-issued identity number valid across India. Used for PDS, DBT, and verification. Does not authorize work or residence in any state.',
    officialSource: 'Unique Identification Authority of India (UIDAI)',
    portalUrl: 'https://uidai.gov.in',
    lastVerified: '2026-02-01',
  },
  {
    id: 'voter-id',
    name: 'Voter ID (Election Card)',
    hindi: 'मतदाता पहचान पत्र',
    category: 'IDENTITY',
    portabilityTier: 'CONDITIONAL_PORTABILITY',
    description:
      'Valid for voting in the constituency of residence. Requires Form 8 transfer for permanent shift; dual registration is discouraged.',
    officialSource: 'Election Commission of India (ECI)',
    portalUrl: 'https://voters.eci.gov.in',
    lastVerified: '2026-01-20',
  },
  {
    id: 'pan-card',
    name: 'PAN Card',
    hindi: 'पैन कार्ड',
    category: 'IDENTITY',
    portabilityTier: 'NATIONWIDE_PORTABLE',
    description:
      'Permanent Account Number issued by Income Tax Department. Valid India-wide for financial transactions. No state-specific re-registration required.',
    officialSource: 'Income Tax Department, Govt of India',
    portalUrl: 'https://incometax.gov.in',
    lastVerified: '2026-01-15',
  },
  {
    id: 'health-card',
    name: 'Health Card / PM-JAY',
    hindi: 'स्वास्थ्य कार्ड / PM-JAY',
    category: 'HEALTH',
    portabilityTier: 'NATIONWIDE_PORTABLE',
    description:
      'Ayushman Bharat PM-JAY hospitalization cover is portable nationwide for empanelled hospitals regardless of issuing state. ABHA linkage recommended.',
    officialSource: 'National Health Authority (NHA)',
    portalUrl: 'https://pmjay.gov.in',
    lastVerified: '2026-02-01',
  },
  {
    id: 'e-shram-card',
    name: 'e-Shram Card',
    hindi: 'e-श्रम कार्ड',
    category: 'SOCIAL_SECURITY',
    portabilityTier: 'NATIONWIDE_PORTABLE',
    description:
      '12-digit Universal Account Number (UAN) valid across India. Update destination address on the portal to remain eligible for accidental insurance and social security distributions.',
    officialSource: 'Ministry of Labour and Employment, Govt of India',
    portalUrl: 'https://eshram.gov.in',
    lastVerified: '2026-01-15',
  },
  {
    id: 'bocw-registration',
    name: 'BOCW Welfare Card',
    hindi: 'बीओसीडब्ल्यू कल्याण कार्ड',
    category: 'EMPLOYMENT',
    portabilityTier: 'NON_PORTABLE_LOCAL_ONLY',
    description:
      'Building & Other Construction Workers welfare funds are managed state-by-state. Construction workers must obtain 90-day work certification from their destination contractor or trade union to register with the destination state BOCW board and claim local education, marriage, and pension cess benefits.',
    officialSource: 'State Labour Welfare Departments',
    portalUrl: 'https://labour.gov.in',
    lastVerified: '2026-01-12',
  },
  {
    id: 'school-transfer',
    name: 'School Transfer Certificate',
    hindi: 'स्कूल स्थानांतरण प्रमाण-पत्र',
    category: 'EDUCATION',
    portabilityTier: 'RE_REGISTRATION',
    description:
      'Under RTE Act, 2009, children of migrant workers are entitled to admission in neighborhood government schools without requiring transfer certificates (TC) or birth certificates as a barrier. Some states may still require local verification.',
    officialSource: 'Department of School Education & Literacy, Ministry of Education',
    portalUrl: 'https://dsel.education.gov.in',
    lastVerified: '2026-01-18',
  },
  {
    id: 'birth-certificate',
    name: 'Birth Certificate',
    hindi: 'जन्म प्रमाण-पत्र',
    category: 'CERTIFICATE',
    portabilityTier: 'RE_REGISTRATION',
    description:
      'May require re-registration in the destination state depending on local municipal rules. Some states accept the home-state certificate; others require a fresh municipal issuance.',
    officialSource: 'Concerned State Municipal Corporation / Gram Panchayat',
    portalUrl: null,
    lastVerified: '2026-01-10',
  },
  {
    id: 'driving-license',
    name: 'Driving License',
    hindi: 'ड्राइविंग लाइसेंस',
    category: 'TRANSPORT',
    portabilityTier: 'CONDITIONAL_PORTABILITY',
    description:
      'Must be transferred to the destination state within 30-60 days of relocation per Regional Transport Office (RTO) rules. Some states allow temporary driving with the home-state license; check local RTO.',
    officialSource: 'Ministry of Road Transport and Highways',
    portalUrl: 'https://parivahan.gov.in',
    lastVerified: '2026-02-01',
  },
];

// ---------------------------------------------------------------------------
// Authority contact sheet (bilingual)
// ---------------------------------------------------------------------------

/**
 * Bilingual authority contact sheet for inter-state migrant workers.
 * Provides official contact points per state/UT for key benefit portability
 * and document re-registration enquiries. No personal citizen data is collected.
 */
export const MIGRANT_AUTHORITY_CONTACT_SHEET = {
  english: {
    title: 'Inter-State Migrant Worker - Authority Contact Sheet',
    hindi: 'अंतर-राज्यीय श्रमिक - प्राधिकारी संपर्क सूची',
    contacts: [
      {
        state: 'All States',
        stateHindi: 'सभी राज्यों',
        category: 'National Portability',
        categoryHindi: 'राष्ट्रीय पोर्टेबिलिटी',
        phone: '1800-11-611 (NFSA Helpline)',
        email: 'nfsa-help@gov.in',
        portal: 'https://nfsa.gov.in',
        purpose: 'Subsidized foodgrains and ration card portability',
      },
      {
        state: 'All States',
        stateHindi: 'सभी राज्यों',
        category: 'National Portability',
        categoryHindi: 'राष्ट्रीय पोर्टेबिलिटी',
        phone: '14444 (e-Shram Helpline)',
        email: 'eshram-help@minlabour.gov.in',
        portal: 'https://eshram.gov.in',
        purpose: 'Unorganized worker social security and insurance',
      },
      {
        state: 'All States',
        stateHindi: 'सभी राज्यों',
        category: 'National Portability',
        categoryHindi: 'राष्ट्रीय पोर्टेबिलिटी',
        phone: '104 (NHA Helpline)',
        email: 'pmjay@nha.gov.in',
        portal: 'https://pmjay.gov.in',
        purpose: 'Ayushman Bharat hospitalization portability',
      },
      {
        state: 'Destination State',
        stateHindi: 'गंतव्य राज्य',
        category: 'State Labour Welfare',
        categoryHindi: 'राज्य श्रम कल्याण',
        phone: 'Varies by state',
        email: 'Check state Labour Department website',
        portal: 'https://labour.gov.in',
        purpose: 'BOCW welfare board registration and benefits',
      },
      {
        state: 'Destination State',
        stateHindi: 'गंतव्य राज्य',
        category: 'Education',
        categoryHindi: 'शिक्षा',
        phone: 'Varies by district',
        email: 'Concerned District Education Officer',
        portal: 'https://dsel.education.gov.in',
        purpose: 'School admission for children of migrant workers under RTE',
      },
      {
        state: 'Home State',
        stateHindi: 'गृह राज्य',
        category: 'Document Re-issuance',
        categoryHindi: 'दस्तावेज दोबारा जारी करना',
        phone: 'Concerned Municipal Corporation',
        email: 'varies by city',
        portal: null,
        purpose: 'Birth certificate, ration card, and other document re-registration',
      },
    ],
  },

  hindi: {
    title: 'अंतर-राज्यीय श्रमिक - प्राधिकारी संपर्क सूची',
    english: 'Inter-State Migrant Worker - Authority Contact Sheet',
    contacts: [
      {
        state: 'All States',
        stateHindi: 'सभी राज्यों',
        category: 'राष्ट्रीय पोर्टेबिलिटी',
        categoryEnglish: 'National Portability',
        phone: '1800-11-611 (NFSA हेल्पलाइन)',
        email: 'nfsa-help@gov.in',
        portal: 'https://nfsa.gov.in',
        purpose: 'सब्सिडीयुक्त अनाज और राशन कार्ड पोर्टेबिलिटी',
      },
      {
        state: 'All States',
        stateHindi: 'सभी राज्यों',
        category: 'राष्ट्रीय पोर्टेबिलिटी',
        categoryEnglish: 'National Portability',
        phone: '14444 (e-श्रम हेल्पलाइन)',
        email: 'eshram-help@minlabour.gov.in',
        portal: 'https://eshram.gov.in',
        purpose: 'असंगठित श्रमिक सामाजिक सुरक्षा और बीमा',
      },
      {
        state: 'All States',
        stateHindi: 'सभी राज्यों',
        category: 'राष्ट्रीय पोर्टेबिलिटी',
        categoryEnglish: 'National Portability',
        phone: '104 (NHA हेल्पलाइन)',
        email: 'pmjay@nha.gov.in',
        portal: 'https://pmjay.gov.in',
        purpose: 'आयुष्मान भारत अस्पताल पोर्टेबिलिटी',
      },
      {
        state: 'गंतव्य राज्य',
        stateHindi: 'गंतव्य राज्य',
        category: 'राज्य श्रम कल्याण',
        categoryEnglish: 'State Labour Welfare',
        phone: 'राज्य द्वारा भिन्न',
        email: 'राज्य श्रम विभाग की वेबसाइट देखें',
        portal: 'https://labour.gov.in',
        purpose: 'बीओसीडब्ल्यू कल्याण बोर्ड पंजीकरण और लाभ',
      },
      {
        state: 'गंतव्य राज्य',
        stateHindi: 'गंतव्य राज्य',
        category: 'शिक्षा',
        categoryEnglish: 'Education',
        phone: 'जिला द्वारा भिन्न',
        english: 'Concerned District Education Officer',
        portal: 'https://dsel.education.gov.in',
        purpose: 'मigrant श्रमिकों के बच्चों के लिए RTE के तहत स्कूल प्रवेश',
      },
      {
        state: 'गृह राज्य',
        stateHindi: 'गृह राज्य',
        category: 'दस्तावेज दोबारा जारी करना',
        categoryEnglish: 'Document Re-issuance',
        phone: 'संबंधित नगर निगम',
        email: 'शहर के अनुसार भिन्न',
        portal: null,
        purpose: 'जन्म प्रमाण-पत्र, राशन कार्ड और अन्य दस्तावेज दोबारा जारी करना',
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Verified states - all Indian states and UTs
// ---------------------------------------------------------------------------

/**
 * All 28 Indian States and 8 Union Territories.
 * The planner never assumes a state is nationally applicable without explicit
 * official source verification. Rules for unlisted or unknown states are
 * explicitly marked as "NOT_VERIFIED".
 */
export const VERIFIED_STATES = new Set(
  INDIAN_STATES_AND_UTS.map((s) => s.toUpperCase().replace(/\s+/g, '_'))
);

// ---------------------------------------------------------------------------
// Inter-state scheme rules with service category support
// ---------------------------------------------------------------------------

/**
 * Curated inter-state transition rules and schemes, organized by task category
 * and service category. Every portability rule cites official acts, portals, and
 * last-verified dates. No guessing for unsupported state pairs or schemes.
 */
export const INTERSTATE_SCHEME_RULES = {
  // === PORTABLE BENEFITS (nationwide portable under central schemes) ===
  RATION_ONORC: {
    title: 'Subsidized Foodgrains via One Nation One Ration Card (ONORC)',
    category: TASK_CATEGORY.PORTABLE_BENEFITS,
    portabilityTier: PORTABILITY_TIER.NATIONWIDE_PORTABLE,
    schemeOwnership: 'CENTRAL_STATE_PARTNERSHIP',
    serviceCategories: ['Food', 'Agriculture', 'Social Welfare'],
    guidance:
      'Under the National Food Security Act (NFSA), your existing ration card remains active. You can lift subsidized foodgrains at any Fair Price Shop (FPS) in your destination state using biometric Aadhaar e-PoS authentication. You do NOT need to cancel your home ration card.',
    officialSource: 'Department of Food and Public Distribution, Govt of India',
    portalUrl: 'https://nfsa.gov.in',
    lastVerifiedDate: '2026-01-10',
  },
  E_SHRAM_BENEFITS: {
    title: 'Unorganized Worker Social Security via e-Shram UAN',
    category: TASK_CATEGORY.PORTABLE_BENEFITS,
    portabilityTier: PORTABILITY_TIER.NATIONWIDE_PORTABLE,
    schemeOwnership: 'CENTRAL',
    serviceCategories: ['Social Welfare', 'Employment'],
    guidance:
      'Your 12-digit Universal Account Number (UAN) is valid across India. Update your current destination address and occupation profile on the e-Shram portal to remain eligible for accidental insurance (PMSBY) and emergency social security distributions.',
    officialSource: 'Ministry of Labour and Employment, Govt of India',
    portalUrl: 'https://eshram.gov.in',
    lastVerifiedDate: '2026-01-15',
  },
  HEALTH_PMJAY: {
    title: 'Ayushman Bharat PM-JAY Nationwide Hospitalization Portability',
    category: TASK_CATEGORY.PORTABLE_BENEFITS,
    portabilityTier: PORTABILITY_TIER.NATIONWIDE_PORTABLE,
    schemeOwnership: 'CENTRAL_STATE_PARTNERSHIP',
    serviceCategories: ['Health', 'Social Welfare'],
    guidance:
      'Eligible SECC/ABHA holders can access cashless secondary and tertiary hospitalization at any empanelled public or private hospital nationwide regardless of issuing state.',
    officialSource: 'National Health Authority (NHA)',
    portalUrl: 'https://pmjay.gov.in',
    lastVerifiedDate: '2026-02-01',
  },

  // === PROFILE UPDATES (conditional portability, requires action) ===
  VOTER_ID_TRANSFER: {
    title: 'Voter Registration Transfer to Destination Constituency',
    category: TASK_CATEGORY.PROFILE_UPDATES,
    portabilityTier: PORTABILITY_TIER.CONDITIONAL_PORTABILITY,
    schemeOwnership: 'ELECTION_COMMISSION',
    serviceCategories: ['Identity', 'Complaints'],
    guidance:
      'If residing permanently at destination, submit Form 8 (shifting of residence outside constituency) via the Election Commission Voters portal. Avoid double-voting or holding dual registrations.',
    officialSource: 'Election Commission of India (ECI)',
    portalUrl: 'https://voters.eci.gov.in',
    lastVerifiedDate: '2026-01-20',
  },

  // === FRESH APPLICATIONS (state-dependent, local-only registration) ===
  BOCW_WORKER_BOARD: {
    title: 'Building & Other Construction Workers (BOCW) Welfare Board Registration',
    category: TASK_CATEGORY.FRESH_APPLICATIONS,
    portabilityTier: PORTABILITY_TIER.NON_PORTABLE_LOCAL_ONLY,
    schemeOwnership: 'STATE_GOVERNMENT',
    serviceCategories: ['Employment', 'Business', 'Social Welfare'],
    guidance:
      'BOCW welfare funds are managed state-by-state. Construction workers must obtain 90-day work certification from their destination contractor or trade union to register with the destination state BOCW board and claim local education, marriage, and pension cess benefits.',
    officialSource: 'State Labour Welfare Departments',
    portalUrl: 'https://labour.gov.in',
    lastVerifiedDate: '2026-01-12',
  },

  // === LOCAL REGISTRATIONS (conditional, barrier-free under central law) ===
  CHILD_EDUCATION_RTE: {
    title: 'Children Government School Transfer under Right to Education (RTE)',
    category: TASK_CATEGORY.LOCAL_REGISTRATIONS,
    portabilityTier: PORTABILITY_TIER.CONDITIONAL_PORTABILITY,
    schemeOwnership: 'CENTRAL_STATE_PARTNERSHIP',
    serviceCategories: ['Education', 'Social Welfare'],
    guidance:
      'Under the RTE Act, 2009, children of migrant workers are entitled to admission in government neighborhood schools without requiring transfer certificates (TC) or birth certificates as a barrier.',
    officialSource: 'Department of School Education & Literacy, Ministry of Education',
    portalUrl: 'https://dsel.education.gov.in',
    lastVerifiedDate: '2026-01-18',
  },
};

// ---------------------------------------------------------------------------
// Core planner function
// ---------------------------------------------------------------------------

/**
 * Generates an inter-state civic migration roadmap for a given origin and destination
 * pair, filtered by an optional service category. The user explicitly selects origin/
 * destination states and service category - migration status is never inferred.
 *
 * @param {string} originState Full state/UT name (e.g. 'Maharashtra', 'Delhi')
 * @param {string} destinationState Full state/UT name (e.g. 'Kerala', 'West Bengal')
 * @param {string} [serviceCategory] Optional service category from SERVICE_CATEGORIES.
 *                                 If omitted, all applicable categories are returned.
 * @returns {Object} Categorized roadmap model with portability rulings and source links.
 */
export function generateInterStateMigrationGuide(
  originState,
  destinationState,
  serviceCategory
) {
  // ---- Input validation ----
  if (!originState || !destinationState) {
    throw new Error('Both originState and destinationState are required');
  }

  // Normalize state names: trim and convert to verified-set format
  const normalizeState = (s) =>
    s
      .trim()
      .split(/\s+/)
      .map((word) => word.replace(/^[-_]|[-_]$/g, ''))
      .map((word) => word.replace(/^./, (c) => c.toUpperCase() + c.slice(1).toLowerCase()))
      .join(' ');

  const originNorm = normalizeState(originState);
  const destNorm = normalizeState(destinationState);

  // ---- Same-state check ----
  if (originNorm === destNorm) {
    return {
      isInterState: false,
      originState: originNorm,
      destinationState: destNorm,
      message:
        'Origin and destination are within the same state. Use intra-state relocation guide.',
      tasks: [],
      serviceCategory: serviceCategory || null,
    };
  }

  // ---- Verify both states are known Indian states/UTs ----
  const isOriginValid =
    VERIFIED_STATES.has(originNorm.toUpperCase().replace(/\s+/g, '_'));
  const isDestValid =
    VERIFIED_STATES.has(destNorm.toUpperCase().replace(/\s+/g, '_'));

  if (!isOriginValid || !isDestValid) {
    return {
      isInterState: true,
      originState: originNorm,
      destinationState: destNorm,
      isVerifiedCombination: false,
      message: `Statutory transition rules for state pair ${originState} -> ${destinationState} are not verified. Do not guess.`,
      recommendedAction:
        'Check national portability portals (nfsa.gov.in, eshram.gov.in, pmjay.gov.in) directly.',
      tasks: [],
      serviceCategory: serviceCategory || null,
    };
  }

  // ---- Build task list filtered by service category (if provided) ----
  const allTasks = Object.entries(INTERSTATE_SCHEME_RULES).map(([key, scheme], idx) => ({
    id: `mig_task_${idx + 1}`,
    key,
    title: scheme.title,
    category: scheme.category,
    portabilityTier: scheme.portabilityTier,
    ownership: scheme.schemeOwnership,
    serviceCategories: scheme.serviceCategories || [],
    actionGuidance: scheme.guidance,
    officialPortalUrl: scheme.portalUrl,
    officialSource: scheme.officialSource,
    lastVerifiedDate: scheme.lastVerifiedDate,
    isCompleted: false,
    serviceCategoryFilter: serviceCategory,
  }));

  // Filter by service category if provided
  let tasks = allTasks;
  if (serviceCategory) {
    const normalizedCategory =
      serviceCategory
        .trim()
        .split(/\s+/)
        .map((w) => w.replace(/^./, (c) => c.toUpperCase() + c.slice(1)))
        .join(' ');
    tasks = allTasks.filter(
      (t) =>
        t.serviceCategories &&
        t.serviceCategories.some(
          (sc) =>
            sc
              .trim()
              .split(/\s+/)
              .map((w) => w.replace(/^./, (c) => c.toUpperCase() + c.slice(1)))
              .join(' ') === normalizedCategory
        )
    );
  }

  // ---- Categorize tasks ----
  const categorized = {
    [TASK_CATEGORY.PORTABLE_BENEFITS]: tasks.filter(
      (t) => t.category === TASK_CATEGORY.PORTABLE_BENEFITS
    ),
    [TASK_CATEGORY.PROFILE_UPDATES]: tasks.filter(
      (t) => t.category === TASK_CATEGORY.PROFILE_UPDATES
    ),
    [TASK_CATEGORY.FRESH_APPLICATIONS]: tasks.filter(
      (t) => t.category === TASK_CATEGORY.FRESH_APPLICATIONS
    ),
    [TASK_CATEGORY.LOCAL_REGISTRATIONS]: tasks.filter(
      (t) => t.category === TASK_CATEGORY.LOCAL_REGISTRATIONS
    ),
  };

  // ---- Determine if combination is verified: both states verified + at least one task applicable ----
  const hasApplicableTasks = tasks.length > 0;
  const isVerifiedCombination = isOriginValid && isDestValid && hasApplicableTasks;

  return {
    isInterState: true,
    originState: originNorm,
    destinationState: destNorm,
    isVerifiedCombination,
    totalTasks: tasks.length,
    categorizedTasks: categorized,
    disclaimer:
      'Inter-state portability rules are subject to bilateral state notifications and central guidelines. ' +
      'Civic Help Setu does not collect personal identity numbers to generate this guide. ' +
      'Every portability claim links to a dated official source. Unknown or conflicting rules remain visible.',
    serviceCategory: serviceCategory || null,
  };
}

// ---------------------------------------------------------------------------
// Checklist export (offline, no PII retained)
// ---------------------------------------------------------------------------

/**
 * Exports a clean migration checklist package from a migration guide result.
 * The export retains no precise travel history, employer name, or identity numbers.
 * It is suitable for offline saving (e.g. JSON file, local storage) without
 * revealing citizen-specific data.
 *
 * @param {Object} migrationGuide Result from generateInterStateMigrationGuide
 * @returns {Object} Export model safe for offline retention
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
        id: t.id,
        title: t.title,
        category: t.category,
        portability: t.portabilityTier,
        ownership: t.ownership,
        guidance: t.actionGuidance,
        source: t.officialSource,
        portal: t.officialPortalUrl,
        lastVerified: t.lastVerifiedDate,
        isCompleted: Boolean(t.isCompleted),
        serviceCategoryFilter: t.serviceCategoryFilter || null,
      });
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    route: `${migrationGuide.originState} → ${migrationGuide.destinationState}`,
    totalChecklistItems: allTasks.length,
    checklist: allTasks,
    serviceCategory: migrationGuide.serviceCategory || null,
    disclaimer: migrationGuide.disclaimer,
  };
}

// ---------------------------------------------------------------------------
// Document inventory lookup (bilingual)
// ---------------------------------------------------------------------------

/**
 * Looks up a document from the migrant document inventory by document ID.
 * Returns the bilingual entry including purpose, portability tier, and source.
 *
 * @param {string} docId Document ID (e.g. 'ration-card', 'aadhaar-card')
 * @returns {Object|null} Document inventory entry or null if not found
 */
export function getMigrantDocumentById(docId) {
  const entry = MIGRANT_DOCUMENT_INVENTORY.find((d) => d.id === docId);
  return entry || null;
}

/**
 * Gets the bilingual document inventory entries filtered by portability tier.
 * Useful for generating category-specific checklists.
 *
 * @param {string} portabilityTier One of PORTABILITY_TIER values
 * @returns {Object[]} Filtered document entries
 */
export function getMigrantDocumentsByPortability(portabilityTier) {
  return MIGRANT_DOCUMENT_INVENTORY.filter(
    (d) => d.portabilityTier === portabilityTier
  );
}

// ---------------------------------------------------------------------------
// Authority contact sheet lookup (bilingual)
// ---------------------------------------------------------------------------

/**
 * Retrieves the contact sheet entry for a given state and category.
 *
 * @param {string} state State/UT name or 'All States'
 * @param {string} category Contact category (national, state, etc.)
 * @returns {Object|null} Contact entry or null if not found
 */
export function getAuthorityContact(state, category) {
  const sheetEnglish = MIGRANT_AUTHORITY_CONTACT_SHEET.english;
  const sheetHindi = MIGRANT_AUTHORITY_CONTACT_SHEET.hindi;

  // Try English first, then Hindi
  const sheet = Object.entries({ english: sheetEnglish, hindi: sheetHindi }).find(
    ([, s]) => s.contacts.some((c) => c.state === state && c.category === category)
  );

  if (!sheet) return null;

  const contacts = sheet[0] === 'english' ? sheetEnglish.contacts : sheetHindi.contacts;
  const contact = contacts.find((c) => c.state === state && c.category === category);
  return contact || null;
}

// ---------------------------------------------------------------------------
// Service category filter helpers
// ---------------------------------------------------------------------------

/**
 * Checks whether a given service category matches any of the scheme's service categories.
 *
 * @param {string} category Service category from SERVICE_CATEGORIES
 * @param {string[]} schemeCategories Scheme's serviceCategories array
 * @returns {boolean} True if there is a match
 */
export function serviceCategoryMatches(category, schemeCategories) {
  if (!schemeCategories || schemeCategories.length === 0) return false;
  if (!category) return true;

  const normalizeWord = (w) => w.replace(/^./, (c) => c.toUpperCase() + c.slice(1));
  const normalizedCategory =
    category.trim().split(/\s+/).map(normalizeWord).join(' ');

  return schemeCategories.some(
    (sc) =>
      sc.trim().split(/\s+/).map(normalizeWord).join(' ') === normalizedCategory
  );
}

// ---------------------------------------------------------------------------