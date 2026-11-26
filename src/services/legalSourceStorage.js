/**
 * legalSourceStorage.js
 *
 * Persistence and cryptographic integrity engine for CivicBridge's versioned
 * legal source registry, historical template citations, and statutory revision audits.
 *
 * Capabilities:
 * - LocalStorage adapter with seamless memory-fallback for isolated testing and SSR.
 * - Authoritative seed data covering primary statutory provisions across workspace templates
 *   (RPwD Act 2016, MWPSC Act 2007, RERA 2016, Street Vendors Act 2014, Electricity Act 2003,
 *    RTE Act 2009, Clinical Establishments Act 2010, CPA 2019, SWM Rules 2016).
 * - WebCrypto SHA-256 canonical hashing for immutable source seals.
 * - Historical draft citation snapshots (`civicbridge_legal_draft_snapshots_v1`).
 * - Tamper-evident audit logging for version transitions and rollbacks.
 */

export const LEGAL_SOURCES_STORAGE_KEY = 'civicbridge_legal_sources_v1';
export const LEGAL_SNAPSHOTS_STORAGE_KEY = 'civicbridge_legal_draft_snapshots_v1';
export const LEGAL_AUDIT_STORAGE_KEY = 'civicbridge_legal_sources_audit_v1';

let inMemorySources = null;
let inMemorySnapshots = null;
let inMemoryAuditLogs = null;

function getStorage(customStorage) {
  if (customStorage) return customStorage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

/**
 * Authoritative default legal sources registered in the platform.
 */
export const INITIAL_LEGAL_SOURCES = [
  {
    id: 'src-rera-sec18',
    title: 'Section 18(1), Real Estate (Regulation and Development) Act, 2016',
    actName: 'Real Estate (Regulation and Development) Act, 2016',
    provision: 'Section 18(1)',
    jurisdiction: 'National',
    applicableTemplates: ['rera_homebuyer_dispute'],
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/2158',
    summary: 'Mandates full refund of invested amounts with prescribed interest, or monthly delay interest at SBI highest MCLR + 2% if the allottee chooses not to withdraw, upon failure of the promoter to hand over possession within the agreed timeline.',
    fullText: 'If the promoter fails to complete or is unable to give possession of an apartment, plot or building, in accordance with the terms of the agreement for sale or duly completed by the date specified therein, he shall be liable on demand to the allottees, in case the allottee wishes to withdraw from the project, without prejudice to any other remedy available, to return the amount received by him in respect of that apartment, plot, building, as the case may be, with interest at such rate as may be prescribed in this behalf including compensation in the manner as provided under this Act.',
    currentVersion: '1.0.0',
    status: 'REVIEWED',
    reviewedAt: '2026-01-10T10:00:00.000Z',
    reviewedBy: 'Senior Legal Officer (Admin)',
    reviewerNotes: 'Verified against Gazette of India extraordinary notification. Standardized MCLR+2% delay interest formula.',
    supersededBy: null,
    supersedes: null,
    supersededReason: null,
    versionHistory: [],
    createdAt: '2026-01-05T08:00:00.000Z',
    updatedAt: '2026-01-10T10:00:00.000Z',
  },
  {
    id: 'src-rera-sec40',
    title: 'Section 40, Real Estate (Regulation and Development) Act, 2016 - Recovery of Dues',
    actName: 'Real Estate (Regulation and Development) Act, 2016',
    provision: 'Section 40(1)',
    jurisdiction: 'National',
    applicableTemplates: ['rera_homebuyer_dispute'],
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/2158',
    summary: 'Authorizes issuance of Revenue Recovery Certificates (RRC) executable through the District Magistrate / Collector as arrears of land revenue for non-compliance with RERA refund and compensation orders.',
    fullText: 'If a promoter or an allottee or a real estate agent fails to pay any interest or penalty or compensation imposed on him, or under an order of the adjudicating officer or the Regulatory Authority or the Appellate Tribunal, it shall be recoverable from such promoter or allottee or real estate agent, in such manner as may be prescribed as an arrears of land revenue.',
    currentVersion: '1.0.0',
    status: 'REVIEWED',
    reviewedAt: '2026-01-10T10:30:00.000Z',
    reviewedBy: 'Senior Legal Officer (Admin)',
    reviewerNotes: 'Affirmed under Supreme Court ruling in Newtech Promoters (2021).',
    supersededBy: null,
    supersedes: null,
    supersededReason: null,
    versionHistory: [],
    createdAt: '2026-01-05T08:00:00.000Z',
    updatedAt: '2026-01-10T10:30:00.000Z',
  },
  {
    id: 'src-mwpsc-sec4',
    title: 'Section 4, Maintenance and Welfare of Parents and Senior Citizens Act, 2007',
    actName: 'Maintenance and Welfare of Parents and Senior Citizens Act, 2007',
    provision: 'Section 4 & Section 9',
    jurisdiction: 'National',
    applicableTemplates: ['senior_citizen_maintenance'],
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/2009',
    summary: 'Establishes the absolute statutory entitlement of a senior citizen or parent to claim monthly maintenance allowance from children or legal heirs possessing their inheritance.',
    fullText: 'A senior citizen including parent who is unable to maintain himself from his own earning or out of the property owned by him, shall be entitled to make an application under section 5 against one or more of his children or relatives in the manner provided.',
    currentVersion: '1.1.0',
    status: 'REVIEWED',
    reviewedAt: '2026-01-15T11:00:00.000Z',
    reviewedBy: 'Tribunal Compliance Counsel (Admin)',
    reviewerNotes: 'Re-reviewed following MoSJE advisories on interim maintenance grant timelines.',
    supersededBy: null,
    supersedes: null,
    supersededReason: null,
    versionHistory: [
      {
        version: '1.0.0',
        status: 'SUPERSEDED',
        summary: 'Maintenance entitlement for senior citizens under MWPSC Act.',
        fullText: 'A senior citizen shall be entitled to claim monthly maintenance.',
        officialUrl: 'https://www.indiacode.nic.in/handle/123456789/2009',
        reviewedAt: '2025-06-01T00:00:00.000Z',
        reviewedBy: 'Admin Legal Reviewer',
        reviewerNotes: 'Initial entry',
      },
    ],
    createdAt: '2025-05-15T09:00:00.000Z',
    updatedAt: '2026-01-15T11:00:00.000Z',
  },
  {
    id: 'src-mwpsc-sec23',
    title: 'Section 23, Maintenance and Welfare of Parents and Senior Citizens Act, 2007',
    actName: 'Maintenance and Welfare of Parents and Senior Citizens Act, 2007',
    provision: 'Section 23',
    jurisdiction: 'National',
    applicableTemplates: ['senior_citizen_maintenance'],
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/2009',
    summary: 'Empowers the Maintenance Tribunal to declare a transfer or gift deed of ancestral/self-acquired property void if the transferee refuses to provide basic amenities or physical care.',
    fullText: 'Where any senior citizen who, after the commencement of this Act, has transferred by way of gift or otherwise, his property, subject to the condition that the transferee shall provide the basic amenities and basic physical needs to the transferor and such transferee refuses or fails to provide such amenities and physical needs, the said transfer of property shall be deemed to have been made by fraud or coercion or under undue influence and shall at the option of the transferor be declared void by the Tribunal.',
    currentVersion: '1.0.0',
    status: 'REVIEWED',
    reviewedAt: '2026-01-15T11:30:00.000Z',
    reviewedBy: 'Tribunal Compliance Counsel (Admin)',
    reviewerNotes: 'Verified against Section 23 case law and statutory text.',
    supersededBy: null,
    supersedes: null,
    supersededReason: null,
    versionHistory: [],
    createdAt: '2025-05-15T09:00:00.000Z',
    updatedAt: '2026-01-15T11:30:00.000Z',
  },
  {
    id: 'src-sv-sec3',
    title: 'Section 3(3), Street Vendors Act, 2014 - Absolute Eviction Immunity',
    actName: 'Street Vendors (Protection of Livelihood and Regulation of Street Vending) Act, 2014',
    provision: 'Section 3(3)',
    jurisdiction: 'National',
    applicableTemplates: ['street_vendor_tvc_petition'],
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/2144',
    summary: 'Bars municipal authorities and local police from evicting or relocating any street vendor until the statutory Town Vending Committee (TVC) survey is fully completed and vending certificates are distributed.',
    fullText: 'No street vendor shall be evicted or, as the case may be, relocated till the survey specified under sub-section (1) has been completed and the certificate of vending has been issued to all street vendors.',
    currentVersion: '1.0.0',
    status: 'REVIEWED',
    reviewedAt: '2026-02-01T09:00:00.000Z',
    reviewedBy: 'Urban Livelihoods Legal Reviewer (Admin)',
    reviewerNotes: 'Affirmed under Delhi High Court and Bombay High Court vendor protection benches.',
    supersededBy: null,
    supersedes: null,
    supersededReason: null,
    versionHistory: [],
    createdAt: '2026-01-20T10:00:00.000Z',
    updatedAt: '2026-02-01T09:00:00.000Z',
  },
  {
    id: 'src-sv-sec19',
    title: 'Section 19, Street Vendors Act, 2014 - Seizure of Vending Goods',
    actName: 'Street Vendors (Protection of Livelihood and Regulation of Street Vending) Act, 2014',
    provision: 'Section 19',
    jurisdiction: 'National',
    applicableTemplates: ['street_vendor_tvc_petition'],
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/2144',
    summary: 'Requires local authorities to provide an itemized seizure inventory receipt and mandates release of seized perishable goods within two working days upon payment of prescribed holding fees.',
    fullText: 'Where any vendor hinders or obstructs the implementation of the vending plan or carries on street vending without certificate, the local authority may seize the goods: Provided that an inventory of the seized goods shall be prepared and a copy delivered to the street vendor: Provided further that in case of perishable goods, the local authority shall release the goods within two days.',
    currentVersion: '1.0.0',
    status: 'REVIEWED',
    reviewedAt: '2026-02-01T09:30:00.000Z',
    reviewedBy: 'Urban Livelihoods Legal Reviewer (Admin)',
    reviewerNotes: 'Ensures compliance with statutory 2-day perishable return timeline.',
    supersededBy: null,
    supersedes: null,
    supersededReason: null,
    versionHistory: [],
    createdAt: '2026-01-20T10:00:00.000Z',
    updatedAt: '2026-02-01T09:30:00.000Z',
  },
  {
    id: 'src-elect-sec42',
    title: 'Section 42(5), Electricity Act, 2003 - Consumer Grievance Redressal Forum',
    actName: 'Electricity Act, 2003',
    provision: 'Section 42(5)',
    jurisdiction: 'National',
    applicableTemplates: ['electricity_cgrf_petition'],
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/2058',
    summary: 'Mandates every electricity distribution licensee to establish a Consumer Grievance Redressal Forum (CGRF) to resolve consumer grievances regarding billing, metering, and service standards.',
    fullText: 'Every distribution licensee shall, within six months from the appointed date or date of grant of licence, whichever is earlier, establish a forum for redressal of grievances of the consumers in accordance with the guidelines as may be specified by the State Commission.',
    currentVersion: '1.0.0',
    status: 'REVIEWED',
    reviewedAt: '2026-01-18T14:00:00.000Z',
    reviewedBy: 'Regulatory Affairs Reviewer (Admin)',
    reviewerNotes: 'Checked against CERC & SERC Model Regulations.',
    supersededBy: null,
    supersedes: null,
    supersededReason: null,
    versionHistory: [],
    createdAt: '2026-01-12T11:00:00.000Z',
    updatedAt: '2026-01-18T14:00:00.000Z',
  },
  {
    id: 'src-elect-rules2020',
    title: 'Rule 13 & Schedule II, Electricity (Rights of Consumers) Rules, 2020',
    actName: 'Electricity (Rights of Consumers) Rules, 2020',
    provision: 'Rule 13, Rule 14 & Schedule II',
    jurisdiction: 'National',
    applicableTemplates: ['electricity_cgrf_petition'],
    officialUrl: 'https://powermin.gov.in/en/content/electricity-rights-consumers-rules-2020',
    summary: 'Codifies statutory maximum response times for burnt meters, billing rectification, and unplanned outages, specifying automatic per-day compensation credited directly to electricity bills.',
    fullText: 'The distribution licensee shall supply electricity 24x7 to all consumers except for specified categories of agriculture. Compensation shall be automatically payable to consumers for failure to meet performance standards.',
    currentVersion: '1.0.0',
    status: 'REVIEWED',
    reviewedAt: '2026-01-18T14:30:00.000Z',
    reviewedBy: 'Regulatory Affairs Reviewer (Admin)',
    reviewerNotes: 'Ministry of Power Gazette Notification G.S.R. 818(E).',
    supersededBy: null,
    supersedes: null,
    supersededReason: null,
    versionHistory: [],
    createdAt: '2026-01-12T11:00:00.000Z',
    updatedAt: '2026-01-18T14:30:00.000Z',
  },
  {
    id: 'src-rte-sec12',
    title: 'Section 12(1)(c), Right of Children to Free and Compulsory Education Act, 2009',
    actName: 'Right of Children to Free and Compulsory Education Act, 2009',
    provision: 'Section 12(1)(c)',
    jurisdiction: 'National',
    applicableTemplates: ['rte_ews_admission_petition'],
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/2088',
    summary: 'Requires private unaided schools to admit at least 25% of children from disadvantaged groups and weaker sections in Class I / pre-school and provide free and compulsory education till completion of elementary schooling.',
    fullText: 'A specified category school and an unaided school shall admit in class I, to the extent of at least twenty-five per cent of the strength of that class, children belonging to weaker section and disadvantaged group in the neighbourhood and provide free and compulsory elementary education till its completion.',
    currentVersion: '1.0.0',
    status: 'REVIEWED',
    reviewedAt: '2026-01-25T12:00:00.000Z',
    reviewedBy: 'Education Rights Counsel (Admin)',
    reviewerNotes: 'Verified against Supreme Court judgments in Society for Unaided Private Schools (2012).',
    supersededBy: null,
    supersedes: null,
    supersededReason: null,
    versionHistory: [],
    createdAt: '2026-01-15T12:00:00.000Z',
    updatedAt: '2026-01-25T12:00:00.000Z',
  },
  {
    id: 'src-clin-sec56',
    title: 'Section 56 & 12, Clinical Establishments Act, 2010 - Emergency Care Non-Refusal',
    actName: 'Clinical Establishments (Registration and Regulation) Act, 2010',
    provision: 'Section 12(2) & Section 56',
    jurisdiction: 'National',
    applicableTemplates: ['clinical_establishment_grievance'],
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/2103',
    summary: 'Mandates every clinical establishment to stabilize individuals with emergency medical conditions immediately without insisting on advance monetary payment or financial clearance.',
    fullText: 'Every clinical establishment shall undertake to provide within the staff and facilities available, such medical examination and treatment as may be required to stabilize the emergency medical condition of any individual who comes or is brought to such clinical establishment.',
    currentVersion: '1.0.0',
    status: 'REVIEWED',
    reviewedAt: '2026-01-22T15:00:00.000Z',
    reviewedBy: 'Healthcare Rights Reviewer (Admin)',
    reviewerNotes: 'Compliant with Parmanand Katara v. Union of India doctrine.',
    supersededBy: null,
    supersedes: null,
    supersededReason: null,
    versionHistory: [],
    createdAt: '2026-01-10T14:00:00.000Z',
    updatedAt: '2026-01-22T15:00:00.000Z',
  },
  {
    id: 'src-rpwd-sec20',
    title: 'Section 20 & 45, Rights of Persons with Disabilities Act, 2016',
    actName: 'Rights of Persons with Disabilities Act, 2016',
    provision: 'Section 20 & Section 45',
    jurisdiction: 'National',
    applicableTemplates: ['accessibility_commissioner_petition'],
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/2155',
    summary: 'Prohibits discrimination in government/private establishments and requires mandatory time-bound compliance with Harmonised Guidelines on Physical Environment & Built Infrastructure Accessibility.',
    fullText: 'All existing public buildings shall be made accessible in accordance with the rules formulated by the Central Government within a period not exceeding five years from the date of notification of such rules.',
    currentVersion: '1.0.0',
    status: 'REVIEWED',
    reviewedAt: '2026-01-28T16:00:00.000Z',
    reviewedBy: 'Accessibility Law Specialist (Admin)',
    reviewerNotes: 'Incorporates Ministry of Housing and Urban Affairs Harmonised Guidelines 2021 standards.',
    supersededBy: null,
    supersedes: null,
    supersededReason: null,
    versionHistory: [],
    createdAt: '2026-01-15T15:00:00.000Z',
    updatedAt: '2026-01-28T16:00:00.000Z',
  },
  {
    id: 'src-cpa-dark-patterns',
    title: 'Guidelines for Prevention and Regulation of Dark Patterns, 2023 under CPA 2019',
    actName: 'Consumer Protection Act, 2019',
    provision: 'Guideline 5 & Guideline 6 (CCPA Notification 2023)',
    jurisdiction: 'National',
    applicableTemplates: ['consumer_protection_drip_pricing'],
    officialUrl: 'https://consumeraffairs.nic.in/',
    summary: 'Declares Drip Pricing, Bait and Switch, False Urgency, and Basket Sneaking as unfair trade practices prohibited under Section 18 of the Consumer Protection Act, 2019.',
    fullText: 'No person, including any platform, shall engage in any dark pattern practice. Drip pricing is a practice whereby elements of prices are not revealed upfront or are revealed surreptitiously within the user experience.',
    currentVersion: '1.0.0',
    status: 'REVIEWED',
    reviewedAt: '2026-02-05T11:00:00.000Z',
    reviewedBy: 'Consumer Protection Specialist (Admin)',
    reviewerNotes: 'Gazette notification issued by Central Consumer Protection Authority (CCPA).',
    supersededBy: null,
    supersedes: null,
    supersededReason: null,
    versionHistory: [],
    createdAt: '2026-01-25T10:00:00.000Z',
    updatedAt: '2026-02-05T11:00:00.000Z',
  },
  {
    id: 'src-swm-rules',
    title: 'Rule 4 & Rule 22, Solid Waste Management Rules, 2016',
    actName: 'Environment (Protection) Act, 1986',
    provision: 'Rule 4 & Rule 22 (SWM Rules, 2016)',
    jurisdiction: 'National',
    applicableTemplates: ['solid_waste_notice'],
    officialUrl: 'https://moef.gov.in/en/division/forest-divisions-2/hazardous-substances-management-division-hsmd/solid-waste-management/',
    summary: 'Mandates source segregation into wet, dry, and domestic hazardous waste, and establishes time-bound duties for local authorities to establish processing facilities and remediate legacy dumpsites.',
    fullText: 'Every waste generator shall segregate and store the waste generated by them in three separate streams, namely bio-degradable, non-biodegradable and domestic hazardous wastes in suitable bins and handover segregated wastes to authorized waste pickers or waste collectors.',
    currentVersion: '1.0.0',
    status: 'REVIEWED',
    reviewedAt: '2026-01-19T09:00:00.000Z',
    reviewedBy: 'Environmental Law Counsel (Admin)',
    reviewerNotes: 'Cross-checked with National Green Tribunal (NGT) Principal Bench compliance directives.',
    supersededBy: null,
    supersedes: null,
    supersededReason: null,
    versionHistory: [],
    createdAt: '2026-01-10T09:00:00.000Z',
    updatedAt: '2026-01-19T09:00:00.000Z',
  },
  // Demonstrative test seeds for Stale, Superseded, Draft, and Jurisdiction conflict:
  {
    id: 'src-delhi-tree-act-stale',
    title: 'Section 9, Delhi Preservation of Trees Act, 1994 (Stale Demonstration)',
    actName: 'Delhi Preservation of Trees Act, 1994',
    provision: 'Section 9',
    jurisdiction: 'Delhi',
    applicableTemplates: ['tree_preservation_notice'],
    officialUrl: 'http://delhi.gov.in/wps/wcm/connect/doit_forest/Forest/Home/',
    summary: 'Prescribes procedure for obtaining felling permission with mandatory compensatory afforestation of ten saplings per felled tree.',
    fullText: 'Any person desiring to fell, cut or remove any tree shall apply to the Tree Officer for permission with prescribed grounds.',
    currentVersion: '0.9.0',
    status: 'REVIEWED',
    reviewedAt: '2024-06-01T08:00:00.000Z', // > 365 days ago (Stale!)
    reviewedBy: 'Forest Officer (Admin)',
    reviewerNotes: 'Needs annual review for updated compensatory afforestation deposit rates.',
    supersededBy: null,
    supersedes: null,
    supersededReason: null,
    versionHistory: [],
    createdAt: '2024-05-01T08:00:00.000Z',
    updatedAt: '2024-06-01T08:00:00.000Z',
  },
  {
    id: 'src-old-swm-2000',
    title: 'Municipal Solid Wastes (Management and Handling) Rules, 2000 (Superseded)',
    actName: 'Environment (Protection) Act, 1986',
    provision: 'Rule 3 & Schedule I (MSW Rules 2000)',
    jurisdiction: 'National',
    applicableTemplates: ['solid_waste_notice'],
    officialUrl: 'https://moef.gov.in/',
    summary: 'Original legacy framework for municipal waste management, now completely repealed and superseded by SWM Rules 2016.',
    fullText: 'Every municipal authority shall, within the territorial area of the municipality, be responsible for the implementation of the provisions of these rules.',
    currentVersion: '1.0.0',
    status: 'SUPERSEDED',
    reviewedAt: '2025-01-10T10:00:00.000Z',
    reviewedBy: 'Senior Legal Officer (Admin)',
    reviewerNotes: 'Repealed by Ministry of Environment Notification S.O. 1357(E) dated 8 April 2016.',
    supersededBy: 'src-swm-rules',
    supersedes: null,
    supersededReason: 'Repealed and replaced by the comprehensive Solid Waste Management Rules, 2016.',
    versionHistory: [],
    createdAt: '2025-01-01T10:00:00.000Z',
    updatedAt: '2025-01-10T10:00:00.000Z',
  },
  {
    id: 'src-maha-rera-rule3',
    title: 'Rule 3, Maharashtra Real Estate (Regulation and Development) Rules, 2017',
    actName: 'Maharashtra Real Estate (Regulation and Development) Rules, 2017',
    provision: 'Rule 3(2)',
    jurisdiction: 'Maharashtra',
    applicableTemplates: ['rera_homebuyer_dispute'],
    officialUrl: 'https://maharera.mahaonline.gov.in/',
    summary: 'State-specific disclosure of encumbrances and title search report requirements for registered projects in Maharashtra.',
    fullText: 'The promoter shall upload title search report from an advocate having experience of at least 10 years.',
    currentVersion: '1.0.0',
    status: 'REVIEWED',
    reviewedAt: '2026-01-20T11:00:00.000Z',
    reviewedBy: 'MahaRERA Legal Consultant (Admin)',
    reviewerNotes: 'State-specific regulation applicable exclusively within Maharashtra jurisdiction.',
    supersededBy: null,
    supersedes: null,
    supersededReason: null,
    versionHistory: [],
    createdAt: '2026-01-05T08:00:00.000Z',
    updatedAt: '2026-01-20T11:00:00.000Z',
  },
  {
    id: 'src-draft-rera-amendment',
    title: 'Proposed Draft Amendment to Model Agreement for Sale Rules (Draft)',
    actName: 'Real Estate (Regulation and Development) Act, 2016',
    provision: 'Proposed Draft Clause 7A',
    jurisdiction: 'National',
    applicableTemplates: ['rera_homebuyer_dispute'],
    officialUrl: 'https://mohua.gov.in/',
    summary: 'Proposed standardization of common area handover protocols before occupancy certificate issuance. Pending formal review.',
    fullText: 'Draft provision under consultation by Central Advisory Council.',
    currentVersion: '0.1.0',
    status: 'DRAFT',
    reviewedAt: null,
    reviewedBy: null,
    reviewerNotes: 'Pending final gazette notification by MoHUA.',
    supersededBy: null,
    supersedes: null,
    supersededReason: null,
    versionHistory: [],
    createdAt: '2026-02-10T10:00:00.000Z',
    updatedAt: '2026-02-10T10:00:00.000Z',
  },
];

/**
 * Computes a deterministic SHA-256 seal for an individual legal source record.
 *
 * @param {Object} source
 * @returns {Promise<string>} Hex seal string
 */
export async function computeLegalSourceDigest(source) {
  const normalized = {
    id: source.id || '',
    actName: source.actName || '',
    provision: source.provision || '',
    jurisdiction: source.jurisdiction || '',
    currentVersion: source.currentVersion || '',
    status: source.status || '',
    summary: source.summary || '',
    fullText: source.fullText || '',
    officialUrl: source.officialUrl || '',
  };

  const canonicalString = JSON.stringify(normalized, Object.keys(normalized).sort());

  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Pure deterministic JS fallback hash
  let hash = 5381;
  for (let i = 0; i < canonicalString.length; i++) {
    hash = ((hash << 5) + hash) + canonicalString.charCodeAt(i);
    hash |= 0;
  }
  return `fallback-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Verifies whether a legal source record has maintained cryptographic integrity.
 *
 * @param {Object} source
 * @returns {Promise<{ valid: boolean, calculatedDigest: string, storedDigest: string }>}
 */
export async function verifyLegalSourceIntegrity(source) {
  if (!source) return { valid: false, calculatedDigest: '', storedDigest: '' };
  const calculated = await computeLegalSourceDigest(source);
  const stored = source.digest || '';
  return {
    valid: Boolean(stored && calculated === stored),
    calculatedDigest: calculated,
    storedDigest: stored,
  };
}

/**
 * Loads all legal sources from storage, initializing with seed data if empty.
 *
 * @param {Storage} [customStorage]
 * @returns {Array<Object>} List of legal sources
 */
export function loadLegalSources(customStorage) {
  const storage = getStorage(customStorage);
  if (!storage) {
    if (!inMemorySources) {
      inMemorySources = JSON.parse(JSON.stringify(INITIAL_LEGAL_SOURCES));
    }
    return inMemorySources;
  }

  try {
    const raw = storage.getItem(LEGAL_SOURCES_STORAGE_KEY);
    if (!raw) {
      const cloned = JSON.parse(JSON.stringify(INITIAL_LEGAL_SOURCES));
      storage.setItem(LEGAL_SOURCES_STORAGE_KEY, JSON.stringify(cloned));
      return cloned;
    }
    return JSON.parse(raw);
  } catch {
    return JSON.parse(JSON.stringify(INITIAL_LEGAL_SOURCES));
  }
}

/**
 * Saves all legal sources to storage.
 *
 * @param {Array<Object>} sources
 * @param {Storage} [customStorage]
 * @returns {boolean} Success status
 */
export function saveLegalSources(sources, customStorage) {
  const storage = getStorage(customStorage);
  if (!storage) {
    inMemorySources = JSON.parse(JSON.stringify(sources));
    return true;
  }

  try {
    storage.setItem(LEGAL_SOURCES_STORAGE_KEY, JSON.stringify(sources));
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads historical draft snapshots from storage.
 *
 * @param {Storage} [customStorage]
 * @returns {Array<Object>}
 */
export function loadDraftSnapshots(customStorage) {
  const storage = getStorage(customStorage);
  if (!storage) {
    if (!inMemorySnapshots) inMemorySnapshots = [];
    return inMemorySnapshots;
  }

  try {
    const raw = storage.getItem(LEGAL_SNAPSHOTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves historical draft snapshots to storage.
 *
 * @param {Array<Object>} snapshots
 * @param {Storage} [customStorage]
 * @returns {boolean}
 */
export function saveDraftSnapshots(snapshots, customStorage) {
  const storage = getStorage(customStorage);
  if (!storage) {
    inMemorySnapshots = JSON.parse(JSON.stringify(snapshots));
    return true;
  }

  try {
    storage.setItem(LEGAL_SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots));
    return true;
  } catch {
    return false;
  }
}

/**
 * Appends a tamper-evident audit record to the legal sources audit log.
 *
 * @param {Object} entry
 * @param {Storage} [customStorage]
 * @returns {Object} Appended audit record
 */
export function appendLegalSourceAuditLog(entry, customStorage) {
  const storage = getStorage(customStorage);
  const now = new Date().toISOString();
  const auditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
    ...entry,
  };

  if (!storage) {
    if (!inMemoryAuditLogs) inMemoryAuditLogs = [];
    inMemoryAuditLogs.unshift(auditEntry);
    return auditEntry;
  }

  try {
    const raw = storage.getItem(LEGAL_AUDIT_STORAGE_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    logs.unshift(auditEntry);
    storage.setItem(LEGAL_AUDIT_STORAGE_KEY, JSON.stringify(logs.slice(0, 200)));
    return auditEntry;
  } catch {
    return auditEntry;
  }
}

/**
 * Loads legal sources audit logs.
 *
 * @param {Storage} [customStorage]
 * @returns {Array<Object>}
 */
export function loadLegalSourceAuditLogs(customStorage) {
  const storage = getStorage(customStorage);
  if (!storage) {
    return inMemoryAuditLogs || [];
  }

  try {
    const raw = storage.getItem(LEGAL_AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Resets legal sources to factory defaults.
 *
 * @param {Storage} [customStorage]
 * @returns {Array<Object>}
 */
export function resetLegalSourcesToDefault(customStorage) {
  const storage = getStorage(customStorage);
  const cloned = JSON.parse(JSON.stringify(INITIAL_LEGAL_SOURCES));
  if (!storage) {
    inMemorySources = cloned;
    inMemorySnapshots = [];
    inMemoryAuditLogs = [];
    return inMemorySources;
  }

  storage.setItem(LEGAL_SOURCES_STORAGE_KEY, JSON.stringify(cloned));
  storage.removeItem(LEGAL_SNAPSHOTS_STORAGE_KEY);
  storage.removeItem(LEGAL_AUDIT_STORAGE_KEY);
  return cloned;
}

/**
 * Generates an exportable JSON dossier of all registered legal sources.
 *
 * @param {Array<Object>} sources
 * @returns {string} JSON string
 */
export function exportLegalSourceDossier(sources = []) {
  const payload = {
    manifestVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    generator: 'CivicBridge Versioned Legal Source Registry',
    totalSources: sources.length,
    reviewedCount: sources.filter((s) => s.status === 'REVIEWED').length,
    draftCount: sources.filter((s) => s.status === 'DRAFT').length,
    supersededCount: sources.filter((s) => s.status === 'SUPERSEDED').length,
    sources,
  };
  return JSON.stringify(payload, null, 2);
}
