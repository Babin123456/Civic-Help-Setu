/**
 * Civic service catalogue visual QA (issue #841).
 *
 * This module is deliberately free of React and of browser-only globals so the
 * same deterministic rules run in the browser (the workspace preview) and on the
 * server (/api/catalogue-visual-qa). Everything here works on SYNTHETIC fixture
 * data: no production catalogue record and no citizen data is read, copied or
 * returned.
 *
 * Deterministic layout measurement
 * --------------------------------
 * The browser is not asked for measurements during the scan. Instead the card
 * width is derived from a named viewport + the production grid rules, and text
 * width is estimated from per-script character factors. The result is stable
 * for a given (seed, filters, component version), which is what the visual
 * regression tests compare. Real screenshots can still confirm a warning, but
 * a scan can never fluctuate between runs because a font had not loaded yet.
 */

import { SERVICE_CATEGORIES } from '../data/serviceCategories.js';
import { SERVICE_SCHEMA_VERSION } from '../data/serviceContract.js';
import { LANGUAGE_CODES, SOURCE_LANGUAGE, SUPPORTED_LANGUAGES } from '../utils/languagePreference.js';

export const VISUAL_QA_SCHEMA_VERSION = 'civic-catalogue-visual-qa/v1';
export const VISUAL_QA_COMPONENT_VERSION = 'catalogue-service-card@1.0.0';
export const FIXTURE_GENERATOR_VERSION = 'synthetic-fixture-generator@1.0.0';
export const DEFAULT_SEED = 841;
export const DEFAULT_PAGE_SIZE = 9;
export const MAX_PAGE_SIZE = 24;
export const MAX_PAGE = 1000;
export const MAX_SEED = 2147483647;
export const FIXTURE_ID_PREFIX = 'qa-sample-';
export const FIXTURE_COUNT = 24;

export const STORAGE_KEYS = Object.freeze({
  draft: 'civicbridge_catalogue_visual_qa_draft_v1',
  baseline: 'civicbridge_catalogue_visual_qa_baseline_v1',
});

export const DRAFT_VERSION = 1;
export const SNAPSHOT_VERSION = VISUAL_QA_SCHEMA_VERSION;
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const BASELINE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_DRAFT_BYTES = 64 * 1024;

export const CONTENT_LENGTHS = Object.freeze(['short', 'long']);

/**
 * Named viewports, mapped to the production directory's grid rules. A desktop lane
 * is 1024px so it fits the 1200px page container without scaling; it is still a named
 * breakpoint in docs/responsive-overflow-and-typography-audit.md.
 */
export const VIEWPORTS = Object.freeze([
  Object.freeze({ id: 'desktop', label: 'Desktop', width: 1024, columns: 3, containerPadding: 32, gap: 24 }),
  Object.freeze({ id: 'tablet', label: 'Tablet', width: 768, columns: 2, containerPadding: 32, gap: 24 }),
  Object.freeze({ id: 'mobile', label: 'Mobile', width: 390, columns: 1, containerPadding: 20, gap: 16 }),
]);

export const VIEWPORT_IDS = VIEWPORTS.map((viewport) => viewport.id);

export const ISSUE_META = Object.freeze({
  TITLE_OVERFLOW: {
    label: 'Title exceeds two lines',
    severity: 'warning',
    group: 'overflow',
    remediation: 'Shorten the title or approve a documented two-line title style for this card.',
    source: 'src/components/ServiceCard.jsx',
  },
  UNBREAKABLE_TOKEN: {
    label: 'Unbreakable identifier in title',
    severity: 'warning',
    group: 'overflow',
    remediation: 'Allow a break opportunity or move the identifier to a metadata row.',
    source: 'docs/responsive-overflow-and-typography-audit.md',
  },
  DEPARTMENT_TRUNCATED: {
    label: 'Department is truncated',
    severity: 'warning',
    group: 'overflow',
    remediation: 'Use a shorter authority label or show the full name in the accessible list.',
    source: 'src/components/ServiceCard.jsx',
  },
  DESCRIPTION_CLAMPED: {
    label: 'Description reaches the three-line clamp',
    severity: 'info',
    group: 'overflow',
    remediation: 'Check that the important eligibility wording is still visible without opening the guide.',
    source: 'src/components/ServiceCard.jsx',
  },
  BADGE_WRAP: {
    label: 'Category and delivery badges wrap',
    severity: 'warning',
    group: 'overflow',
    remediation: 'Shorten a badge label or let the badge row stack predictably.',
    source: 'src/components/ServiceCard.jsx',
  },
  DOCUMENT_COUNT_WRAP: {
    label: 'Document-count badge is too wide',
    severity: 'warning',
    group: 'overflow',
    remediation: 'Use a compact count such as “12 docs” and keep the full list in the table alternative.',
    source: 'docs/civic-service-catalogue-visual-qa.md',
  },
  MIXED_SCRIPT_METADATA: {
    label: 'Latin metadata appears in an Indic fixture',
    severity: 'info',
    group: 'overflow',
    remediation: 'Confirm the untranslated label is intentional or route the string to translation review.',
    source: 'src/utils/translationCoverage.js',
  },
  MISSING_DEPARTMENT: {
    label: 'Department is missing',
    severity: 'error',
    group: 'missing-metadata',
    remediation: 'Add the publishing authority before treating the card as complete.',
    source: 'docs/SERVICE_DATA_CONTRACT.md',
  },
  MISSING_PROCESSING_TIME: {
    label: 'Processing time is missing',
    severity: 'error',
    group: 'missing-metadata',
    remediation: 'Add a processing-time label; the card falls back to “Standard Processing”.',
    source: 'docs/SERVICE_DATA_CONTRACT.md',
  },
  MISSING_DIFFICULTY: {
    label: 'Difficulty badge is missing',
    severity: 'warning',
    group: 'missing-metadata',
    remediation: 'Add the difficulty value or confirm that the badge may be absent.',
    source: 'docs/SERVICE_DATA_CONTRACT.md',
  },
  MISSING_TYPE: {
    label: 'Delivery mode is missing',
    severity: 'warning',
    group: 'missing-metadata',
    remediation: 'Add Online, Offline or Online / Offline so citizens know how to apply.',
    source: 'docs/SERVICE_DATA_CONTRACT.md',
  },
  MISSING_DESCRIPTION: {
    label: 'Short description is missing',
    severity: 'error',
    group: 'missing-metadata',
    remediation: 'Add a short description; the card has no useful summary without it.',
    source: 'docs/SERVICE_DATA_CONTRACT.md',
  },
  MISSING_NAME: {
    label: 'Title is missing',
    severity: 'error',
    group: 'missing-metadata',
    remediation: 'A card cannot be reviewed without a title.',
    source: 'docs/SERVICE_DATA_CONTRACT.md',
  },
  MISSING_CATEGORY: {
    label: 'Category is missing',
    severity: 'error',
    group: 'missing-metadata',
    remediation: 'Add a category from the catalogue list.',
    source: 'docs/SERVICE_DATA_CONTRACT.md',
  },
  LOW_CONFIDENCE_SUGGESTION: {
    label: 'Fixture suggestion needs review',
    severity: 'review',
    group: 'review',
    remediation: 'Confirm or reject the suggested synthetic text before using it as a fixture baseline.',
    source: 'docs/civic-service-catalogue-visual-qa.md',
  },
});

export const ISSUE_CODES = Object.keys(ISSUE_META);

export const SOURCES = Object.freeze([
  {
    id: 'service-contract',
    label: 'Service data contract',
    path: 'docs/SERVICE_DATA_CONTRACT.md',
    version: `service-schema-v${SERVICE_SCHEMA_VERSION}`,
    note: 'Field names and required metadata used by the fixture generator.',
  },
  {
    id: 'fixture-guidance',
    label: 'Synthetic fixture guidance',
    path: 'docs/TEST_FIXTURES.md',
    version: FIXTURE_GENERATOR_VERSION,
    note: 'Rules for fictional names, ids and reserved example.org links.',
  },
  {
    id: 'fixture-generator',
    label: 'Existing synthetic service fixture generator',
    path: ['src', 'test', 'fixtures', 'serviceFixtures.js'].join('/'),
    version: FIXTURE_GENERATOR_VERSION,
    note: 'Deterministic scenario generator this workspace mirrors without importing test fixtures into the app.',
  },
  {
    id: 'card-component',
    label: 'Production service card',
    path: 'src/components/ServiceCard.jsx',
    version: VISUAL_QA_COMPONENT_VERSION,
    note: 'The card markup and inline styles measured by this workspace.',
  },
  {
    id: 'responsive-audit',
    label: 'Responsive overflow and typography audit',
    path: 'docs/responsive-overflow-and-typography-audit.md',
    version: 'audit-#591',
    note: 'Breakpoint, wrapping and touch-target conventions.',
  },
]);

export const DISCLAIMER =
  'Synthetic fixtures only. This workspace does not read, edit or publish production catalogue content, and it is not an official government application status. Layout findings are deterministic review suggestions until a reviewer confirms them.';

const PRIVATE_PROGRESS_NOTE =
  'Private reviewer progress. It is separate from any official government application or approval status.';

// ---- deterministic pseudo-random numbers --------------------------------------

export function hashString(text) {
  let hash = 2166136261;
  const value = String(text);
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seed) {
  let state = Number.isInteger(seed) ? seed >>> 0 : hashString(seed);
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- synthetic vocabulary -----------------------------------------------------

const VOCABULARY = {
  en: {
    sample: 'Sample',
    subjects: ['Riverside', 'Harvest', 'Lantern', 'Orchard', 'Market', 'Harbour', 'Meadow', 'Courtyard'],
    kinds: ['Permit', 'Licence', 'Certificate', 'Registration', 'Support Card', 'Clearance'],
    departments: [
      'Department of Sample Affairs',
      'Example Municipal Services Board',
      'Office of Fictional Civic Records',
      'Sample District Welfare Office',
    ],
    description:
      'A fictional service summary used only to stress-test card layout. Nobody should treat it as an official requirement.',
    step: 'A fictional preparation step for layout review only.',
    document: 'Sample supporting record',
  },
  hi: {
    sample: 'नमूना',
    subjects: ['नदी', 'फसल', 'दीप', 'बाग', 'बाज़ार', 'बंदरगाह', 'घास का मैदान', 'आँगन'],
    kinds: ['अनुमति', 'लाइसेंस', 'प्रमाण पत्र', 'पंजीकरण', 'सहायता कार्ड', 'मंज़ूरी'],
    departments: [
      'नमूना मामलों का विभाग',
      'उदाहरण नगर सेवा बोर्ड',
      'काल्पनिक नागरिक अभिलेख कार्यालय',
      'नमूना जिला कल्याण कार्यालय',
    ],
    description:
      'यह केवल कार्ड लेआउट जाँचने के लिए काल्पनिक सेवा विवरण है। इसे सरकारी नियम न मानें।',
    step: 'लेआउट समीक्षा के लिए केवल काल्पनिक तैयारी चरण।',
    document: 'नमूना सहायक अभिलेख',
  },
  bn: {
    sample: 'নমুনা',
    subjects: ['নদী', 'ফসল', 'প্রদীপ', 'বাগান', 'বাজার', 'বন্দর', 'তৃণভূমি', 'উঠান'],
    kinds: ['অনুমতি', 'লাইসেন্স', 'প্রমাণপত্র', 'নিবন্ধন', 'সহায়তা কার্ড', 'ছাড়পত্র'],
    departments: [
      'নমুনা বিষয়ক বিভাগ',
      'উদাহরণ পৌর সেবা বোর্ড',
      'কাল্পনিক নাগরিক নথি কার্যালয়',
      'নমুনা জেলা কল্যাণ কার্যালয়',
    ],
    description:
      'এটি শুধু কার্ডের বিন্যাস পরীক্ষা করার জন্য কাল্পনিক সেবার বিবরণ। এটিকে সরকারি নিয়ম মনে করবেন না।',
    step: 'বিন্যাস পর্যালোচনার জন্য শুধু কাল্পনিক প্রস্তুতি ধাপ।',
    document: 'নমুনা সহায়ক নথি',
  },
  ta: {
    sample: 'மாதிரி',
    subjects: ['ஆறு', 'அறுவடை', 'விளக்கு', 'தோட்டம்', 'சந்தை', 'துறைமுகம்', 'புல்வெளி', 'முற்றம்'],
    kinds: ['அனுமதி', 'உரிமம்', 'சான்றிதழ்', 'பதிவு', 'உதவி அட்டை', 'அனுமதிச் சீட்டு'],
    departments: [
      'மாதிரி விவகாரத் துறை',
      'எடுத்துக்காட்டு நகராட்சி சேவை வாரியம்',
      'கற்பனை குடிமை ஆவண அலுவலகம்',
      'மாதிரி மாவட்ட நல அலுவலகம்',
    ],
    description:
      'இது அட்டை அமைப்பைச் சோதிக்க மட்டுமே பயன்படுத்தப்படும் கற்பனை சேவை விவரம். இதை அரசு விதியாகக் கருத வேண்டாம்.',
    step: 'அமைப்பு மதிப்பாய்வுக்கான கற்பனை தயாரிப்பு படி மட்டும்.',
    document: 'மாதிரி துணை ஆவணம்',
  },
};

const CATEGORY_LABELS = {
  en: Object.fromEntries(SERVICE_CATEGORIES.map((category) => [category, category])),
  hi: {
    Certificates: 'प्रमाण पत्र',
    Identity: 'पहचान',
    Transport: 'परिवहन',
    'Social Welfare': 'सामाजिक कल्याण',
    Employment: 'रोज़गार',
    Complaints: 'शिकायतें',
    Business: 'व्यवसाय',
    Agriculture: 'कृषि',
    Health: 'स्वास्थ्य',
  },
  bn: {
    Certificates: 'প্রমাণপত্র',
    Identity: 'পরিচয়',
    Transport: 'পরিবহন',
    'Social Welfare': 'সমাজকল্যাণ',
    Employment: 'কর্মসংস্থান',
    Complaints: 'অভিযোগ',
    Business: 'ব্যবসা',
    Agriculture: 'কৃষি',
    Health: 'স্বাস্থ্য',
  },
  ta: {
    Certificates: 'சான்றிதழ்கள்',
    Identity: 'அடையாளம்',
    Transport: 'போக்குவரத்து',
    'Social Welfare': 'சமூக நலன்',
    Employment: 'வேலைவாய்ப்பு',
    Complaints: 'புகார்கள்',
    Business: 'வணிகம்',
    Agriculture: 'வேளாண்மை',
    Health: 'சுகாதாரம்',
  },
};

const FICTIONAL_DATES = ['2025-03-14', '2025-08-02', '2025-11-21', '2026-01-09', '2026-04-27', '2026-07-15'];
const DELIVERY_MODES = ['Online', 'Offline', 'Online / Offline'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const PUBLICATION_STATES = ['published', 'draft', 'archived'];
const LONG_TOKEN_PARTS = ['CIVIC', 'SAMPLE', 'LAYOUT', 'STRESS', 'IDENTIFIER', 'REVIEW'];

const isNonEmptyText = (value) => typeof value === 'string' && value.trim().length > 0;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const normalizeLanguage = (code) => (LANGUAGE_CODES.includes(code) ? code : SOURCE_LANGUAGE);

/** The subset of fixture data that is safe to show and export. */
export function isSyntheticFixture(fixture) {
  if (!fixture || typeof fixture !== 'object') return false;
  if (typeof fixture.id !== 'string' || !fixture.id.startsWith(FIXTURE_ID_PREFIX)) return false;
  const urls = JSON.stringify(fixture).match(/https?:\/\/[^\s"']+/g) || [];
  const reservedDomain = /^https?:\/\/(?:[a-z0-9-]+\.)*example\.(?:org|com|net)(?:[/:?#]|$)/i;
  if (!urls.every((url) => reservedDomain.test(url))) return false;
  return !containsCitizenData(fixture);
}

const AADHAAR_PATTERN = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_PATTERN = /(?<![\d])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\d])/;
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const SECRET_PATTERN = /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]+/;

/** True when a value carries patterns that must never enter a fixture or an export. */
export function containsCitizenData(value) {
  if (value === null || value === undefined) return false;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return (
    AADHAAR_PATTERN.test(text) ||
    PAN_PATTERN.test(text) ||
    PHONE_PATTERN.test(text) ||
    EMAIL_PATTERN.test(text) ||
    SECRET_PATTERN.test(text)
  );
}

function assertNoCitizenData(value, label = 'snapshot') {
  if (containsCitizenData(value)) {
    const error = new Error(`${label} contains citizen data or a credential and was refused.`);
    error.code = 'ERR_CITIZEN_DATA';
    throw error;
  }
}

// ---- filter validation --------------------------------------------------------

export const DEFAULT_FILTERS = Object.freeze({
  category: 'All',
  language: SOURCE_LANGUAGE,
  contentLength: 'short',
  seed: DEFAULT_SEED,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
});

const isIntegerInRange = (value, min, max) =>
  Number.isInteger(value) && value >= min && value <= max;

export function validateVisualQaFilters(input = {}) {
  const errors = [];
  const fail = (field, reason) => errors.push({ field, reason });

  if (input.category !== undefined && input.category !== 'All' && !SERVICE_CATEGORIES.includes(input.category)) {
    fail('category', `must be "All" or one of: ${SERVICE_CATEGORIES.join(', ')}`);
  }
  if (input.language !== undefined && !LANGUAGE_CODES.includes(input.language)) {
    fail('language', `must be one of: ${LANGUAGE_CODES.join(', ')}`);
  }
  if (input.contentLength !== undefined && !CONTENT_LENGTHS.includes(input.contentLength)) {
    fail('contentLength', `must be one of: ${CONTENT_LENGTHS.join(', ')}`);
  }
  if (input.seed !== undefined && !isIntegerInRange(input.seed, 0, MAX_SEED)) {
    fail('seed', `must be a whole number from 0 to ${MAX_SEED}`);
  }
  if (input.page !== undefined && !isIntegerInRange(input.page, 1, MAX_PAGE)) {
    fail('page', `must be a whole number from 1 to ${MAX_PAGE}`);
  }
  if (input.pageSize !== undefined && !isIntegerInRange(input.pageSize, 1, MAX_PAGE_SIZE)) {
    fail('pageSize', `must be a whole number from 1 to ${MAX_PAGE_SIZE}`);
  }
  if (input.viewportIds !== undefined) {
    if (!Array.isArray(input.viewportIds) || input.viewportIds.length === 0) {
      fail('viewportIds', 'must be a non-empty list of viewport ids');
    } else {
      const unknown = input.viewportIds.filter((id) => !VIEWPORT_IDS.includes(id));
      if (unknown.length > 0) fail('viewportIds', `unknown viewport: ${unknown.join(', ')}`);
      if (new Set(input.viewportIds).size !== input.viewportIds.length) {
        fail('viewportIds', 'must not contain duplicates');
      }
    }
  }
  return errors;
}

export function normalizeFilters(input = {}) {
  const viewportIds = Array.isArray(input.viewportIds) && input.viewportIds.length > 0
    ? [...new Set(input.viewportIds.filter((id) => VIEWPORT_IDS.includes(id)))]
    : [...VIEWPORT_IDS];
  return {
    category: SERVICE_CATEGORIES.includes(input.category) || input.category === 'All' ? input.category : 'All',
    language: normalizeLanguage(input.language),
    contentLength: CONTENT_LENGTHS.includes(input.contentLength) ? input.contentLength : 'short',
    seed: Number.isInteger(input.seed) && input.seed >= 0 && input.seed <= MAX_SEED ? input.seed : DEFAULT_SEED,
    page: Number.isInteger(input.page) && input.page >= 1 && input.page <= MAX_PAGE ? input.page : 1,
    pageSize: Number.isInteger(input.pageSize) && input.pageSize >= 1 && input.pageSize <= MAX_PAGE_SIZE
      ? input.pageSize
      : DEFAULT_PAGE_SIZE,
    viewportIds: viewportIds.length > 0 ? viewportIds : [...VIEWPORT_IDS],
  };
}

const getParam = (params, name) => {
  if (!params || typeof params.get !== 'function') return null;
  const value = params.get(name);
  return typeof value === 'string' ? value : null;
};

const getAllParams = (params, names) => {
  if (!params || typeof params.getAll !== 'function') return [];
  return names.flatMap((name) =>
    params.getAll(name).flatMap((value) => (typeof value === 'string' ? value.split(',') : []))
  );
};

const pickAllowed = (value, allowed, fallback) => {
  if (typeof value !== 'string') return fallback;
  const wanted = value.trim().toLowerCase();
  const hit = allowed.find((option) => String(option).toLowerCase() === wanted);
  return hit === undefined ? fallback : hit;
};

const parseBoundedInteger = (value, min, max, fallback) => {
  if (typeof value !== 'string' || !/^\d{1,10}$/.test(value.trim())) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
};

/**
 * Reads query-string values defensively. Unknown values fall back instead of
 * throwing; the strict server validator rejects them with a structured error.
 */
export function parseVisualQaQuery(params, { categories = SERVICE_CATEGORIES } = {}) {
  const category = pickAllowed(
    getParam(params, 'category') ?? getParam(params, 'cat'),
    ['All', ...categories],
    DEFAULT_FILTERS.category
  );
  const language = pickAllowed(
    getParam(params, 'language') ?? getParam(params, 'lang'),
    LANGUAGE_CODES,
    DEFAULT_FILTERS.language
  );
  const contentLength = pickAllowed(
    getParam(params, 'contentLength') ?? getParam(params, 'length'),
    CONTENT_LENGTHS,
    DEFAULT_FILTERS.contentLength
  );
  const selectedViewports = getAllParams(params, ['viewport', 'view'])
    .map((id) => id.trim().toLowerCase())
    .filter((id) => VIEWPORT_IDS.includes(id));
  const viewportIds = selectedViewports.length > 0 ? [...new Set(selectedViewports)] : [...VIEWPORT_IDS];
  const boxes = getParam(params, 'boxes');

  return {
    category,
    language,
    contentLength,
    seed: parseBoundedInteger(getParam(params, 'seed'), 0, MAX_SEED, DEFAULT_FILTERS.seed),
    page: parseBoundedInteger(getParam(params, 'page'), 1, MAX_PAGE, DEFAULT_FILTERS.page),
    pageSize: parseBoundedInteger(
      getParam(params, 'pageSize'),
      1,
      MAX_PAGE_SIZE,
      DEFAULT_FILTERS.pageSize
    ),
    viewportIds,
    showBoxes: boxes === null ? true : boxes !== '0' && boxes.toLowerCase() !== 'false',
  };
}

export function buildVisualQaQuery(filters = {}) {
  const normalized = normalizeFilters(filters);
  const params = new URLSearchParams();
  if (normalized.category !== DEFAULT_FILTERS.category) params.set('category', normalized.category);
  if (normalized.language !== DEFAULT_FILTERS.language) params.set('language', normalized.language);
  if (normalized.contentLength !== DEFAULT_FILTERS.contentLength) {
    params.set('contentLength', normalized.contentLength);
  }
  if (normalized.seed !== DEFAULT_FILTERS.seed) params.set('seed', String(normalized.seed));
  if (normalized.page !== DEFAULT_FILTERS.page) params.set('page', String(normalized.page));
  if (normalized.pageSize !== DEFAULT_FILTERS.pageSize) params.set('pageSize', String(normalized.pageSize));
  if (normalized.viewportIds.length !== VIEWPORT_IDS.length) {
    normalized.viewportIds.forEach((id) => params.append('view', id));
  }
  return params;
}

// ---- synthetic fixture generator ---------------------------------------------

const categoryLabel = (category, language) => CATEGORY_LABELS[language]?.[category] || category;

function longTitle(words, subject, kind, language) {
  if (language === 'en') {
    return `${words.sample} ${subject} ${kind} for Riverside Civic Layout Review and Accessible Service Documentation`;
  }
  return `${words.sample} ${subject} ${kind} ${subject} ${kind} ${subject} ${kind} ${subject} ${subject} ${kind}`;
}

function buildSuggestion({ fixtureId, longName, language, index }) {
  const confidence = Number((0.55 + (hashString(`${fixtureId}:suggestion`) % 40) / 100).toFixed(2));
  return {
    id: `${fixtureId}-title`,
    field: 'name',
    text: longName,
    status: confidence < 0.75 ? 'needs_review' : 'suggested',
    confidence,
    generatedBy: FIXTURE_GENERATOR_VERSION,
    kind: 'synthetic-long-title',
    rationale:
      'Suggested synthetic stress text only. It does not describe a real service, requirement or government decision.',
    sourceRefs: ['docs/TEST_FIXTURES.md', 'docs/SERVICE_DATA_CONTRACT.md'],
    dataVersion: `service-schema-v${SERVICE_SCHEMA_VERSION}`,
    language,
    index,
  };
}

function buildFixture({ category, language, contentLength, seed, index }) {
  const safeLanguage = normalizeLanguage(language);
  const words = VOCABULARY[safeLanguage];
  const rng = createRng(hashString(`${seed}:${safeLanguage}:${contentLength}:${category}:${index}`));
  const subject = words.subjects[Math.floor(rng() * words.subjects.length)];
  const kind = words.kinds[Math.floor(rng() * words.kinds.length)];
  const shortName = `${words.sample} ${subject} ${kind}`;
  const longName = longTitle(words, subject, kind, safeLanguage);
  const unbrokenToken = `QA-${LONG_TOKEN_PARTS[index % LONG_TOKEN_PARTS.length]}-${String(seed).padStart(6, '0')}-${String(index + 1).padStart(3, '0')}-LONG-IDENTIFIER`;
  const name = contentLength === 'long'
    ? `${longName} ${index % 7 === 0 ? unbrokenToken : ''}`.trim()
    : shortName;
  const department = rng() < 0.5 ? words.departments[0] : words.departments[1];
  const longDepartment = `${department} and Fictional Interdepartmental Coordination Cell for Card Layout Review ${index + 1}`;
  const documentCount = contentLength === 'long' ? [8, 12, 18, 31][index % 4] : [0, 1, 2, 3, 5][index % 5];
  // Long content deliberately includes one verbose documents label so the
  // DOCUMENT_COUNT_WRAP warning is reproducible at a named viewport instead of
  // being a code path that can never fire.
  const stressDocumentLabel =
    contentLength === 'long' && index % 5 === 1
      ? `${documentCount} ${words.document} · ${documentCount + 2} ${words.document} · 6 ${words.document}`
      : null;
  const status = PUBLICATION_STATES[index % PUBLICATION_STATES.length];
  const difficulty = DIFFICULTIES[index % DIFFICULTIES.length];
  const type = DELIVERY_MODES[index % DELIVERY_MODES.length];
  const feeType = index % 3 === 0 ? 'free' : 'paid';
  const speedDays = index % 5 === 0 ? 0 : 7 + (index % 30);

  const fixture = {
    id: `${FIXTURE_ID_PREFIX}${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index + 1}`,
    name,
    shortDescription:
      contentLength === 'long'
        ? `${words.description} ${words.description} ${words.description}`
        : words.description,
    category,
    department: contentLength === 'long' ? longDepartment : department,
    type,
    difficulty,
    feeType,
    speedDays,
    popularityScore: 5 + (index * 7) % 90,
    eligibility: [words.description],
    documents: Array.from({ length: documentCount }, (_, docIndex) => `${words.document} ${docIndex + 1}`),
    steps: [
      { title: words.step, description: words.description },
      { title: words.step, description: words.description },
    ],
    fees: feeType === 'free' ? 'Free (synthetic)' : `Sample fee ${10 + index} units`,
    processingTime: speedDays === 0 ? 'Same day (synthetic)' : `${speedDays} sample days`,
    officialSources: [
      {
        name: 'Example Sample Portal',
        url: `https://example.org/visual-qa/${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/${index + 1}`,
        verified: false,
      },
    ],
    lastVerified: FICTIONAL_DATES[index % FICTIONAL_DATES.length],
    publicationState: status,
    warnings: ['Synthetic visual QA fixture. Not an official service record.'],
  };

  // Deliberate metadata gaps, so the missing-metadata state is always reproducible.
  const missingFields = [];
  if (index % 9 === 4) {
    delete fixture.department;
    missingFields.push('department');
  }
  if (index % 11 === 6) {
    delete fixture.processingTime;
    missingFields.push('processingTime');
  }
  if (index % 13 === 8) {
    delete fixture.difficulty;
    missingFields.push('difficulty');
  }
  if (index % 7 === 3) {
    delete fixture.type;
    missingFields.push('type');
  }
  if (index % 17 === 12) {
    delete fixture.name;
    missingFields.push('name');
  }
  if (index % 19 === 14) {
    delete fixture.shortDescription;
    missingFields.push('shortDescription');
  }
  if (index % 23 === 16) {
    delete fixture.category;
    missingFields.push('category');
  }

  // Extra, clearly synthetic review metadata. It is intentionally outside the
  // catalogue contract so it can never be mistaken for a published record.
  fixture.qa = {
    fixtureId: fixture.id,
    isSynthetic: true,
    isProductionRecord: false,
    language: safeLanguage,
    contentLength,
    categoryLabel: categoryLabel(category, safeLanguage),
    documentCount,
    documentLabel: stressDocumentLabel,
    publicationState: status,
    statusLabel: status === 'published' ? 'Published (synthetic)' : `${status} (synthetic)`,
    missingFields,
    generatedBy: FIXTURE_GENERATOR_VERSION,
  };
  fixture.suggestion = buildSuggestion({
    fixtureId: fixture.id,
    longName,
    language: safeLanguage,
    index,
  });

  return fixture;
}

export function generateFixtures({
  category = 'All',
  language = SOURCE_LANGUAGE,
  contentLength = 'short',
  seed = DEFAULT_SEED,
  count = FIXTURE_COUNT,
} = {}) {
  const filters = normalizeFilters({ category, language, contentLength, seed });
  const categories = filters.category === 'All' ? SERVICE_CATEGORIES : [filters.category];
  const safeCount = clamp(Number.isInteger(count) ? count : FIXTURE_COUNT, 0, FIXTURE_COUNT);
  return Array.from({ length: safeCount }, (_, index) =>
    buildFixture({
      category: categories[index % categories.length],
      language: filters.language,
      contentLength: filters.contentLength,
      seed: filters.seed,
      index,
    })
  );
}

// ---- deterministic layout measurement -----------------------------------------

const SCRIPT_FACTORS = {
  latin: 0.53,
  devanagari: 0.61,
  bengali: 0.61,
  tamil: 0.62,
  cjk: 0.92,
};

export const detectScript = (text = '') => {
  if (/[\u0900-\u097F]/.test(text)) return 'devanagari';
  if (/[\u0980-\u09FF]/.test(text)) return 'bengali';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'tamil';
  if (/[\u3040-\u9FFF]/.test(text)) return 'cjk';
  return 'latin';
};

const charFactor = (char, script) => {
  if (/\s/.test(char)) return 0.27;
  if (script !== 'latin') return SCRIPT_FACTORS[script];
  if (/[A-Z]/.test(char)) return 0.62;
  if (/[a-z]/.test(char)) return 0.5;
  if (/[0-9]/.test(char)) return 0.55;
  if (/[.,:;!?'"()[\]{}]/.test(char)) return 0.34;
  if (char === '-') return 0.4;
  return 0.55;
};

/** Estimated rendered width in CSS pixels. Deterministic by design. */
export function estimateTextWidth(text, { fontSize = 16, script } = {}) {
  const value = String(text ?? '');
  const activeScript = script || detectScript(value);
  let width = 0;
  for (const char of value) {
    // Whitespace always uses the narrow space factor, even when the caller asks
    // for an explicit script factor for every visible character.
    width += charFactor(char, activeScript) * fontSize;
  }
  return Math.round(width * 10) / 10;
}

export const estimateLineCount = (text, maxWidth, fontSize, script) => {
  if (!isNonEmptyText(text) || maxWidth <= 0) return 0;
  const width = estimateTextWidth(text, { fontSize, script });
  return Math.max(1, Math.ceil(width / maxWidth));
};

export const longestTokenLength = (text = '') =>
  String(text)
    .split(/\s+/)
    .reduce((longest, token) => Math.max(longest, [...token].length), 0);

export const getViewport = (id) => VIEWPORTS.find((viewport) => viewport.id === id) || null;

export function getCardMetrics(viewport) {
  if (!viewport) throw new Error('Unknown viewport');
  const available = viewport.width - viewport.containerPadding * 2;
  const cardWidth = Math.floor((available - viewport.gap * (viewport.columns - 1)) / viewport.columns);
  const cardPadding = viewport.id === 'mobile' ? 20 : 40;
  return {
    cardWidth,
    cardPadding,
    contentWidth: Math.max(1, cardWidth - cardPadding * 2),
    gap: viewport.gap,
    columns: viewport.columns,
    viewportWidth: viewport.width,
  };
}

export function measureCardService(service, viewportId) {
  const viewport = getViewport(viewportId);
  if (!viewport) throw new Error(`Unknown viewport "${viewportId}"`);
  const metrics = getCardMetrics(viewport);
  const contentWidth = metrics.contentWidth;
  const titleFontSize = 21.6;
  const departmentFontSize = 12.8;
  const descriptionFontSize = 14.8;
  const badgeFontSize = 12;
  const categoryLabel = service.qa?.categoryLabel || service.category || '';
  const script = detectScript(
    [service.name, service.department, service.shortDescription].filter(Boolean).join(' ')
  );
  const titleWidth = estimateTextWidth(service.name, { fontSize: titleFontSize, script });
  const departmentWidth = estimateTextWidth(service.department, {
    fontSize: departmentFontSize,
    script: detectScript(service.department || ''),
  });
  const descriptionWidth = estimateTextWidth(service.shortDescription, {
    fontSize: descriptionFontSize,
    script: detectScript(service.shortDescription || ''),
  });
  const badgeWidth =
    estimateTextWidth(categoryLabel, { fontSize: badgeFontSize }) +
    estimateTextWidth(service.difficulty || '', { fontSize: badgeFontSize }) +
    estimateTextWidth(service.type || '', { fontSize: badgeFontSize }) +
    34;
  const documentLabel = service.qa?.documentLabel || `${service.qa?.documentCount ?? 0} documents`;
  const documentWidth = estimateTextWidth(documentLabel, { fontSize: badgeFontSize }) + 18;

  return {
    viewport: viewport.id,
    viewportLabel: viewport.label,
    viewportWidth: viewport.width,
    cardWidth: metrics.cardWidth,
    cardPadding: metrics.cardPadding,
    contentWidth,
    script,
    title: {
      fontSize: titleFontSize,
      estimatedWidth: titleWidth,
      estimatedLines: estimateLineCount(service.name, contentWidth, titleFontSize, script),
      maxLines: 2,
      longestToken: longestTokenLength(service.name),
    },
    department: {
      fontSize: departmentFontSize,
      estimatedWidth: departmentWidth,
      maxLines: 1,
      clipped: departmentWidth > contentWidth,
    },
    description: {
      fontSize: descriptionFontSize,
      estimatedWidth: descriptionWidth,
      estimatedLines: estimateLineCount(service.shortDescription, contentWidth, descriptionFontSize, script),
      maxLines: 3,
      clamped: descriptionWidth > contentWidth * 3,
    },
    badges: {
      estimatedWidth: badgeWidth,
      availableWidth: contentWidth,
      wraps: badgeWidth > contentWidth,
    },
    documentBadge: {
      label: documentLabel,
      estimatedWidth: documentWidth,
      availableWidth: contentWidth,
      wraps: documentWidth > contentWidth,
    },
    confidence: 0.99,
  };
}

// ---- issue detection ----------------------------------------------------------

const missingFieldChecks = [
  ['MISSING_NAME', 'name', 'Title'],
  ['MISSING_DESCRIPTION', 'shortDescription', 'Short description'],
  ['MISSING_CATEGORY', 'category', 'Category'],
  ['MISSING_DEPARTMENT', 'department', 'Department'],
  ['MISSING_TYPE', 'type', 'Delivery mode'],
  ['MISSING_DIFFICULTY', 'difficulty', 'Difficulty'],
  ['MISSING_PROCESSING_TIME', 'processingTime', 'Processing time'],
];

export function detectLayoutIssues(service, measurements, { language = SOURCE_LANGUAGE, suggestionStatus } = {}) {
  const issues = [];
  const add = (code, field, message, measured, extra = {}) => {
    const meta = ISSUE_META[code];
    if (!meta) throw new Error(`Unknown issue code ${code}`);
    issues.push({
      code,
      field,
      message,
      severity: meta.severity,
      group: meta.group,
      label: meta.label,
      remediation: meta.remediation,
      source: meta.source,
      viewport: measurements.viewport,
      viewportLabel: measurements.viewportLabel,
      measured,
      confidence: extra.confidence ?? measurements.confidence,
      ...extra,
    });
  };

  for (const [code, field, label] of missingFieldChecks) {
    if (!isNonEmptyText(service[field])) {
      add(code, field, `${label} is missing from this synthetic fixture.`, {
        value: null,
        unit: 'field',
      });
    }
  }

  if (measurements.title.estimatedLines > measurements.title.maxLines) {
    add(
      'TITLE_OVERFLOW',
      'name',
      `Title is estimated at ${measurements.title.estimatedLines} lines; the review limit is ${measurements.title.maxLines}.`,
      {
        value: measurements.title.estimatedLines,
        unit: 'lines',
        limit: measurements.title.maxLines,
        estimatedWidth: measurements.title.estimatedWidth,
        contentWidth: measurements.contentWidth,
      }
    );
  }

  if (measurements.title.longestToken > 24) {
    add(
      'UNBREAKABLE_TOKEN',
      'name',
      `Title contains a ${measurements.title.longestToken}-character token; confirm a safe break opportunity.`,
      {
        value: measurements.title.longestToken,
        unit: 'characters',
        limit: 24,
      }
    );
  }

  if (measurements.department.clipped) {
    add(
      'DEPARTMENT_TRUNCATED',
      'department',
      'Department is estimated wider than the single-line metadata row and will be ellipsised.',
      {
        value: measurements.department.estimatedWidth,
        unit: 'px',
        limit: measurements.contentWidth,
      }
    );
  }

  if (measurements.description.clamped) {
    add(
      'DESCRIPTION_CLAMPED',
      'shortDescription',
      'Description is estimated beyond the three-line clamp; confirm that key wording stays visible.',
      {
        value: measurements.description.estimatedLines,
        unit: 'lines',
        limit: measurements.description.maxLines,
      }
    );
  }

  if (measurements.badges.wraps) {
    add(
      'BADGE_WRAP',
      'badges',
      'Category, difficulty and delivery badges are estimated wider than the content area.',
      {
        value: measurements.badges.estimatedWidth,
        unit: 'px',
        limit: measurements.badges.availableWidth,
      }
    );
  }

  if ((service.qa?.documentCount ?? 0) >= 10 && measurements.documentBadge.wraps) {
    add(
      'DOCUMENT_COUNT_WRAP',
      'documents',
      `The synthetic “${measurements.documentBadge.label}” badge is estimated wider than the card content area.`,
      {
        value: measurements.documentBadge.estimatedWidth,
        unit: 'px',
        limit: measurements.documentBadge.availableWidth,
      }
    );
  }

  if (
    language !== SOURCE_LANGUAGE &&
    isNonEmptyText(service.type) &&
    detectScript(service.type) === 'latin'
  ) {
    add(
      'MIXED_SCRIPT_METADATA',
      'type',
      'The delivery-mode label is Latin text inside an Indic-script fixture.',
      { value: service.type, unit: 'field' }
    );
  }

  if (suggestionStatus === 'needs_review') {
    add(
      'LOW_CONFIDENCE_SUGGESTION',
      'suggestion',
      `Suggested fixture title confidence is ${(service.suggestion?.confidence ?? 0).toFixed(2)}; route it to review.`,
      { value: service.suggestion?.confidence ?? 0, unit: 'confidence', limit: 0.75 },
      { confidence: service.suggestion?.confidence ?? 0.5, suggestionId: service.suggestion?.id }
    );
  }

  return issues.sort((left, right) => {
    const order = { error: 0, warning: 1, review: 2, info: 3 };
    return (order[left.severity] ?? 9) - (order[right.severity] ?? 9) || left.code.localeCompare(right.code);
  });
}

// ---- scan report --------------------------------------------------------------

export const suggestionStatusFor = (fixture, decisions = {}) => {
  const suggestion = fixture.suggestion;
  if (!suggestion) return 'none';
  const decision = decisions?.[suggestion.id];
  if (decision === 'confirmed' || decision === 'rejected') return decision;
  return suggestion.status === 'needs_review' ? 'needs_review' : 'suggested';
};

export function scanFixtureAtViewport(fixture, viewportId, { decisions = {} } = {}) {
  const suggestionStatus = suggestionStatusFor(fixture, decisions);
  const effectiveName =
    suggestionStatus === 'confirmed' && fixture.suggestion?.text
      ? fixture.suggestion.text
      : fixture.name;
  const previewService = { ...fixture, name: effectiveName, suggestionStatus };
  const measurements = measureCardService(previewService, viewportId);
  const issues = detectLayoutIssues(previewService, measurements, {
    language: fixture.qa?.language,
    suggestionStatus,
  });
  return {
    fixtureId: fixture.id,
    service: previewService,
    suggestionStatus,
    measurements,
    issues,
  };
}

export const buildScanRunId = (filters) => {
  const normalized = normalizeFilters(filters);
  const seed = [
    VISUAL_QA_SCHEMA_VERSION,
    VISUAL_QA_COMPONENT_VERSION,
    FIXTURE_GENERATOR_VERSION,
    `service-schema-v${SERVICE_SCHEMA_VERSION}`,
    normalized.category,
    normalized.language,
    normalized.contentLength,
    normalized.seed,
    normalized.page,
    normalized.pageSize,
    normalized.viewportIds.slice().sort().join(','),
  ].join('|');
  return `vqa-${hashString(seed).toString(16).padStart(8, '0')}`;
};

const summarizeIssues = (scans) => {
  const byCode = new Map();
  for (const scan of scans) {
    for (const card of scan.cards) {
      for (const issue of card.issues) {
        const entry = byCode.get(issue.code) || {
          code: issue.code,
          label: issue.label,
          severity: issue.severity,
          group: issue.group,
          remediation: issue.remediation,
          source: issue.source,
          count: 0,
          viewports: new Set(),
          sampleFixtures: [],
        };
        entry.count += 1;
        entry.viewports.add(issue.viewport);
        if (entry.sampleFixtures.length < 3 && !entry.sampleFixtures.includes(card.fixtureId)) {
          entry.sampleFixtures.push(card.fixtureId);
        }
        byCode.set(issue.code, entry);
      }
    }
  }
  return [...byCode.values()]
    .map((entry) => ({
      ...entry,
      viewports: [...entry.viewports].sort((a, b) => VIEWPORT_IDS.indexOf(a) - VIEWPORT_IDS.indexOf(b)),
    }))
    .sort(
      (left, right) =>
        (ISSUE_CODES.indexOf(left.code) - ISSUE_CODES.indexOf(right.code)) ||
        left.code.localeCompare(right.code)
    );
};

const countTotals = (scans) => {
  const totals = {
    fixtures: 0,
    visibleFixtures: 0,
    scans: scans.length,
    cardScans: 0,
    passed: 0,
    warned: 0,
    failed: 0,
    overflow: 0,
    missingMetadata: 0,
    lowConfidence: 0,
    needsReview: 0,
    issues: 0,
  };
  for (const scan of scans) {
    for (const card of scan.cards) {
      totals.cardScans += 1;
      if (card.issues.length === 0) totals.passed += 1;
      if (card.issues.some((issue) => issue.severity === 'error')) totals.failed += 1;
      else if (card.issues.some((issue) => issue.severity === 'warning')) totals.warned += 1;
      totals.overflow += card.issues.filter((issue) => issue.group === 'overflow').length;
      totals.missingMetadata += card.issues.filter((issue) => issue.group === 'missing-metadata').length;
      totals.lowConfidence += card.issues.filter((issue) => issue.code === 'LOW_CONFIDENCE_SUGGESTION').length;
      totals.needsReview += card.suggestionStatus === 'needs_review' ? 1 : 0;
      totals.issues += card.issues.length;
    }
  }
  totals.fixtures = scans[0]?.totalFixtures ?? 0;
  totals.visibleFixtures = scans[0]?.visibleFixtures ?? 0;
  return totals;
};

/**
 * Runs one visual scan across the requested viewports. The result is stable for
 * the same seed and filters, so it can be snapshotted in a test.
 */
export function runVisualQaScan(input = {}) {
  const filters = normalizeFilters(input);
  const errors = validateVisualQaFilters({
    category: filters.category,
    language: filters.language,
    contentLength: filters.contentLength,
    seed: filters.seed,
    page: filters.page,
    pageSize: filters.pageSize,
    viewportIds: filters.viewportIds,
  });
  if (errors.length > 0) {
    const error = new Error(`Invalid visual QA filters: ${errors.map((entry) => entry.field).join(', ')}`);
    error.code = 'ERR_INVALID_FILTERS';
    error.fields = errors;
    throw error;
  }

  const allFixtures = generateFixtures({
    category: filters.category,
    language: filters.language,
    contentLength: filters.contentLength,
    seed: filters.seed,
    count: FIXTURE_COUNT,
  });
  const decisionMap = input.decisions && typeof input.decisions === 'object' ? input.decisions : {};
  const total = allFixtures.length;
  const start = (filters.page - 1) * filters.pageSize;
  const pageFixtures = allFixtures.slice(start, start + filters.pageSize);
  const viewports = VIEWPORTS.filter((viewport) => filters.viewportIds.includes(viewport.id)).map((viewport) => {
    const metrics = getCardMetrics(viewport);
    return {
      id: viewport.id,
      label: viewport.label,
      width: viewport.width,
      columns: viewport.columns,
      gap: viewport.gap,
      ...metrics,
    };
  });
  const scans = viewports.map((viewport) => ({
    viewport,
    cards: pageFixtures.map((fixture) =>
      scanFixtureAtViewport(fixture, viewport.id, { decisions: decisionMap })
    ),
    totalFixtures: total,
    visibleFixtures: pageFixtures.length,
  }));

  const issueSummary = summarizeIssues(scans);
  const totals = countTotals(scans);
  const scanRunId = buildScanRunId(filters);

  return {
    schemaVersion: VISUAL_QA_SCHEMA_VERSION,
    scanRunId,
    componentVersion: VISUAL_QA_COMPONENT_VERSION,
    fixtureGeneratorVersion: FIXTURE_GENERATOR_VERSION,
    dataVersion: `service-schema-v${SERVICE_SCHEMA_VERSION}`,
    filters: {
      ...filters,
      viewportIds: [...filters.viewportIds],
    },
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
      hasPrevious: filters.page > 1,
      hasNext: filters.page * filters.pageSize < total,
      empty: pageFixtures.length === 0,
    },
    viewports: scans.map((scan) => ({ ...scan.viewport, cards: scan.cards })),
    issueSummary,
    totals,
    sources: SOURCES,
    disclaimer: DISCLAIMER,
    privateProgressNote: PRIVATE_PROGRESS_NOTE,
    privacy: {
      syntheticOnly: true,
      containsCitizenData: false,
      productionContentIncluded: false,
      storage: 'local browser draft only',
    },
  };
}

/** Flattens every rendered fixture/viewport pair for the accessible table. */
export function flattenScanRows(report) {
  const rows = [];
  for (const viewport of report?.viewports || []) {
    for (const card of viewport.cards || []) {
      rows.push({
        key: `${card.fixtureId}:${viewport.id}`,
        fixtureId: card.fixtureId,
        title: card.service?.name || '',
        category: card.service?.qa?.categoryLabel || card.service?.category || '',
        department: card.service?.department || '',
        language: card.service?.qa?.language || '',
        contentLength: card.service?.qa?.contentLength || '',
        viewport: viewport.id,
        viewportLabel: viewport.label,
        documentCount: card.service?.qa?.documentCount ?? 0,
        status: card.service?.qa?.publicationState || '',
        suggestionStatus: card.suggestionStatus,
        issues: card.issues,
        issueCodes: card.issues.map((issue) => issue.code),
        severity:
          card.issues.some((issue) => issue.severity === 'error')
            ? 'error'
            : card.issues.some((issue) => issue.severity === 'warning')
              ? 'warning'
              : card.issues.length > 0
                ? 'review'
                : 'pass',
      });
    }
  }
  return rows;
}

// ---- snapshot export and comparison ------------------------------------------

const checksumOf = (value) => `sha-like-${hashString(JSON.stringify(value)).toString(16).padStart(8, '0')}`;

/**
 * Builds the downloadable review snapshot. Only synthetic fixture data and
 * deterministic findings are included; the reviewer's identity is never stored.
 */
export function buildReviewSnapshot(report, { now = new Date(), reviewerRole = 'admin', decisions = {} } = {}) {
  if (!report || report.schemaVersion !== VISUAL_QA_SCHEMA_VERSION) {
    const error = new Error('Cannot export an unknown visual QA scan.');
    error.code = 'ERR_INVALID_SCAN';
    throw error;
  }
  const rows = flattenScanRows(report).map((row) => ({
    fixtureId: row.fixtureId,
    title: row.title,
    category: row.category,
    department: row.department,
    language: row.language,
    contentLength: row.contentLength,
    viewport: row.viewport,
    viewportLabel: row.viewportLabel,
    documentCount: row.documentCount,
    publicationState: row.status,
    suggestionStatus: row.suggestionStatus,
    severity: row.severity,
    issues: row.issues.map((issue) => ({
      code: issue.code,
      field: issue.field,
      severity: issue.severity,
      label: issue.label,
      message: issue.message,
      measured: issue.measured,
      remediation: issue.remediation,
      source: issue.source,
      confidence: issue.confidence,
    })),
  }));
  const decisionsSummary = Object.entries(decisions || {}).reduce(
    (summary, [, decision]) => {
      if (decision === 'confirmed') summary.confirmed += 1;
      else if (decision === 'rejected') summary.rejected += 1;
      return summary;
    },
    { confirmed: 0, rejected: 0 }
  );
  const body = {
    schemaVersion: SNAPSHOT_VERSION,
    scanRunId: report.scanRunId,
    componentVersion: report.componentVersion,
    fixtureGeneratorVersion: report.fixtureGeneratorVersion,
    dataVersion: report.dataVersion,
    catalogueVersion: `catalogue-${report.scanRunId}`,
    filters: report.filters,
    pagination: report.pagination,
    totals: report.totals,
    issueSummary: report.issueSummary,
    rows,
    decisions: decisionsSummary,
    exportedAt: now instanceof Date ? now.toISOString() : String(now),
    reviewerRole,
    sources: report.sources,
    disclaimer: report.disclaimer,
    privateProgressNote: report.privateProgressNote,
    dataAssumptions: [
      'All titles, departments, ids and links are synthetic.',
      'Layout widths are deterministic estimates, not browser screenshots.',
      'No production catalogue record or citizen record is included.',
      'A fixture suggestion is advisory until a reviewer confirms it.',
    ],
    privacy: {
      syntheticOnly: true,
      containsCitizenData: false,
      productionContentIncluded: false,
      retention: 'Browser download only. The application does not store this export.',
      officialStatus: 'not-an-official-government-status',
    },
  };
  assertNoCitizenData(body, 'Review snapshot');
  const checksum = checksumOf(body);
  const snapshot = { ...body, snapshotId: `vqa-snap-${checksum.replace('sha-like-', '')}`, checksum };
  assertNoCitizenData(snapshot, 'Review snapshot');
  return snapshot;
}

export function parseReviewSnapshot(value) {
  const errors = [];
  let parsed = value;
  if (typeof value === 'string') {
    if (value.length > 512 * 1024) {
      return { ok: false, snapshot: null, errors: [{ field: '(snapshot)', reason: 'is larger than 512 KB' }] };
    }
    try {
      parsed = JSON.parse(value);
    } catch {
      return { ok: false, snapshot: null, errors: [{ field: '(snapshot)', reason: 'must be valid JSON' }] };
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, snapshot: null, errors: [{ field: '(snapshot)', reason: 'must be an object' }] };
  }
  if (parsed.schemaVersion !== SNAPSHOT_VERSION) {
    errors.push({ field: 'schemaVersion', reason: `must be ${SNAPSHOT_VERSION}` });
  }
  if (!Array.isArray(parsed.rows)) {
    errors.push({ field: 'rows', reason: 'must be an array' });
  }
  if (parsed.privacy?.syntheticOnly !== true) {
    errors.push({ field: 'privacy.syntheticOnly', reason: 'must be true' });
  }
  if (containsCitizenData(parsed)) {
    errors.push({ field: '(snapshot)', reason: 'contains citizen data or a credential' });
  }
  return errors.length > 0 ? { ok: false, snapshot: null, errors } : { ok: true, snapshot: parsed, errors: [] };
}

export function compareSnapshots(baseline, current) {
  const baselineCheck = baseline?.schemaVersion ? { ok: true, snapshot: baseline } : parseReviewSnapshot(baseline);
  const currentCheck = current?.schemaVersion ? { ok: true, snapshot: current } : parseReviewSnapshot(current);
  if (!baselineCheck.ok || !currentCheck.ok) {
    return {
      ok: false,
      identical: false,
      added: [],
      removed: [],
      changed: [],
      errors: [...baselineCheck.errors, ...currentCheck.errors],
      summary: { added: 0, removed: 0, changed: 0, unchanged: 0 },
    };
  }
  const toMap = (snapshot) =>
    new Map(
      (snapshot.rows || []).map((row) => [
        `${row.fixtureId}:${row.viewport}`,
        {
          severity: row.severity,
          issues: [...(row.issues || [])].map((issue) => issue.code).sort(),
          title: row.title,
          department: row.department,
        },
      ])
    );
  const baselineMap = toMap(baselineCheck.snapshot);
  const currentMap = toMap(currentCheck.snapshot);
  const added = [];
  const changed = [];
  const unchanged = [];
  for (const [key, currentRow] of currentMap) {
    if (!baselineMap.has(key)) {
      added.push({ key, current: currentRow, baseline: null });
      continue;
    }
    const baselineRow = baselineMap.get(key);
    const sameIssues = JSON.stringify(baselineRow.issues) === JSON.stringify(currentRow.issues);
    const sameText =
      baselineRow.title === currentRow.title && baselineRow.department === currentRow.department;
    if (sameIssues && sameText && baselineRow.severity === currentRow.severity) {
      unchanged.push({ key });
    } else {
      changed.push({ key, baseline: baselineRow, current: currentRow });
    }
  }
  const removed = [];
  for (const [key, baselineRow] of baselineMap) {
    if (!currentMap.has(key)) removed.push({ key, baseline: baselineRow, current: null });
  }
  return {
    ok: true,
    identical: added.length === 0 && removed.length === 0 && changed.length === 0,
    added,
    removed,
    changed,
    errors: [],
    summary: {
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      unchanged: unchanged.length,
    },
  };
}

// ---- local draft / baseline persistence (no citizen data) --------------------

const safeStorage = (storage) => storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function';

const readJson = (storage, key) => {
  if (!safeStorage(storage)) return null;
  try {
    const raw = storage.getItem(key);
    if (typeof raw !== 'string' || !raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeJson = (storage, key, value) => {
  if (!safeStorage(storage)) return { ok: false, reason: 'storage-unavailable' };
  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_DRAFT_BYTES) return { ok: false, reason: 'draft-too-large' };
  if (containsCitizenData(value)) return { ok: false, reason: 'citizen-data-prohibited' };
  try {
    storage.setItem(key, serialized);
    return { ok: true, bytes: serialized.length };
  } catch {
    return { ok: false, reason: 'storage-write-failed' };
  }
};

export function buildDraft({
  filters = DEFAULT_FILTERS,
  viewportIds = VIEWPORT_IDS,
  showBoxes = true,
  decisions = {},
  scanRunId = null,
  now = Date.now(),
} = {}) {
  const normalized = normalizeFilters({ ...filters, viewportIds });
  return {
    version: DRAFT_VERSION,
    savedAt: now instanceof Date ? now.getTime() : Number(now) || Date.now(),
    filters: {
      category: normalized.category,
      language: normalized.language,
      contentLength: normalized.contentLength,
      seed: normalized.seed,
      page: normalized.page,
      pageSize: normalized.pageSize,
    },
    viewportIds: normalized.viewportIds,
    showBoxes: Boolean(showBoxes),
    decisions: Object.fromEntries(
      Object.entries(decisions || {}).filter(([, value]) => value === 'confirmed' || value === 'rejected')
    ),
    scanRunId: typeof scanRunId === 'string' ? scanRunId.slice(0, 80) : null,
    confirmedNonSensitive: true,
    containsCitizenData: false,
  };
}

export function saveDraft(storage, draft) {
  if (!draft || draft.version !== DRAFT_VERSION) return { ok: false, reason: 'invalid-draft' };
  return writeJson(storage, STORAGE_KEYS.draft, draft);
}

export function loadDraft(storage, { now = Date.now(), maxAgeMs = DRAFT_MAX_AGE_MS } = {}) {
  const draft = readJson(storage, STORAGE_KEYS.draft);
  if (!draft || typeof draft !== 'object' || draft.version !== DRAFT_VERSION) return null;
  if (draft.containsCitizenData !== false) return null;
  if (containsCitizenData(draft)) return null;
  const savedAt = Number(draft.savedAt);
  if (!Number.isFinite(savedAt) || savedAt > now + 60_000 || now - savedAt > maxAgeMs) return null;
  const filters = normalizeFilters({ ...draft.filters, viewportIds: draft.viewportIds });
  return { ...draft, filters: {
    category: filters.category,
    language: filters.language,
    contentLength: filters.contentLength,
    seed: filters.seed,
    page: filters.page,
    pageSize: filters.pageSize,
  }, viewportIds: filters.viewportIds };
}

export const clearDraft = (storage) => {
  if (!safeStorage(storage) || typeof storage.removeItem !== 'function') return false;
  try {
    storage.removeItem(STORAGE_KEYS.draft);
    return true;
  } catch {
    return false;
  }
};

export function saveBaseline(storage, snapshot) {
  const check = parseReviewSnapshot(snapshot);
  if (!check.ok) return { ok: false, reason: 'invalid-snapshot', errors: check.errors };
  return writeJson(storage, STORAGE_KEYS.baseline, check.snapshot);
}

export function loadBaseline(storage, { now = Date.now(), maxAgeMs = BASELINE_MAX_AGE_MS } = {}) {
  const snapshot = readJson(storage, STORAGE_KEYS.baseline);
  const check = parseReviewSnapshot(snapshot);
  if (!check.ok) return null;
  const exportedAt = Date.parse(check.snapshot.exportedAt);
  if (!Number.isFinite(exportedAt) || now - exportedAt > maxAgeMs) return null;
  return check.snapshot;
}

export const clearBaseline = (storage) => {
  if (!safeStorage(storage) || typeof storage.removeItem !== 'function') return false;
  try {
    storage.removeItem(STORAGE_KEYS.baseline);
    return true;
  } catch {
    return false;
  }
};

// ---- client API helper -------------------------------------------------------

export class VisualQaApiError extends Error {
  constructor(code, message, { status = 0, fields = [] } = {}) {
    super(message || 'The visual QA service could not complete the request.');
    this.name = 'VisualQaApiError';
    this.code = code || 'ERR_VISUAL_QA_API';
    this.status = status;
    this.fields = Array.isArray(fields) ? fields : [];
  }
}

export async function requestSuggestionDecision(
  { fixtureId, suggestionId, decision, reviewerNote = '' },
  { fetchImpl = globalThis.fetch, headers = {} } = {}
) {
  if (typeof fetchImpl !== 'function') {
    throw new VisualQaApiError('ERR_FETCH_UNAVAILABLE', 'Fetch is not available in this environment.');
  }
  try {
    const response = await fetchImpl('/api/catalogue-visual-qa', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        action: 'confirm-suggestion',
        fixtureId,
        suggestionId,
        decision,
        reviewerNote: sanitizeReviewerNote(reviewerNote),
      }),
    });
    let body = null;
    try {
      body = await response.json();
    } catch {
      throw new VisualQaApiError('ERR_MALFORMED_RESPONSE', 'The server returned an unreadable response.', {
        status: response.status,
      });
    }
    if (!response.ok) {
      const error = body?.error;
      throw new VisualQaApiError(
        typeof error?.code === 'string' ? error.code : 'ERR_VISUAL_QA_API',
        typeof error?.message === 'string' ? error.message : 'The server refused the suggestion decision.',
        { status: response.status, fields: error?.fields }
      );
    }
    return body?.data ?? body;
  } catch (error) {
    if (error instanceof VisualQaApiError) throw error;
    throw new VisualQaApiError('ERR_NETWORK', 'The visual QA service could not be reached.', { status: 0 });
  }
}

const sanitizeReviewerNote = (value) =>
  typeof value === 'string'
    ? value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300)
    : '';

export async function requestServerScan(filters, { fetchImpl = globalThis.fetch, headers = {} } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new VisualQaApiError('ERR_FETCH_UNAVAILABLE', 'Fetch is not available in this environment.');
  }
  const normalized = normalizeFilters(filters);
  const params = buildVisualQaQuery(normalized);
  params.set('action', 'scan');
  try {
    const response = await fetchImpl(`/api/catalogue-visual-qa?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json', ...headers },
    });
    let body = null;
    try {
      body = await response.json();
    } catch {
      throw new VisualQaApiError('ERR_MALFORMED_RESPONSE', 'The server returned an unreadable response.', {
        status: response.status,
      });
    }
    if (!response.ok) {
      const error = body?.error;
      throw new VisualQaApiError(
        typeof error?.code === 'string' ? error.code : 'ERR_VISUAL_QA_API',
        typeof error?.message === 'string' ? error.message : 'The server refused the visual QA request.',
        { status: response.status, fields: error?.fields }
      );
    }
    return body?.data ?? body;
  } catch (error) {
    if (error instanceof VisualQaApiError) throw error;
    throw new VisualQaApiError('ERR_NETWORK', 'The visual QA service could not be reached.', { status: 0 });
  }
}

export const LANGUAGES = SUPPORTED_LANGUAGES.map((language) => ({ ...language }));
