/**
 * Civic Benefit Portability & Life-Event Navigator Service (#141)
 *
 * Implements configurable life-event roadmaps, regional portability filtering,
 * task prioritization (immediate, upcoming, optional), deduplication & source verification,
 * task hiding/saving preferences, and transparent regional disclosures.
 */

import { LIFE_EVENT_JOURNEYS, SUPPORTED_REGIONS } from '../data/lifeEventJourneysData.js';

export const LIFE_EVENT_STORAGE_KEY = 'civic_life_event_journeys';

/**
 * Returns all supported life event journeys.
 * @returns {Array} List of journeys
 */
export function getLifeEvents() {
  return LIFE_EVENT_JOURNEYS;
}

/**
 * Retrieves a life event by identifier.
 * @param {string} id
 * @returns {Object|null}
 */
export function getLifeEventById(id) {
  if (!id || typeof id !== 'string') return null;
  return LIFE_EVENT_JOURNEYS.find((j) => j.id === id) || null;
}

/**
 * Returns supported regions with verification status.
 * @returns {Array}
 */
export function getSupportedRegions() {
  return SUPPORTED_REGIONS;
}

/**
 * Resolves a region object by region code.
 * @param {string} regionCode
 * @returns {Object}
 */
export function getRegionByCode(regionCode = 'all') {
  return (
    SUPPORTED_REGIONS.find((r) => r.code === regionCode) || {
      code: regionCode,
      name: regionCode,
      isVerified: false,
      unverifiedReason: 'Region is not part of verified state registry.',
    }
  );
}

/**
 * Builds and validates a filtered life event journey.
 *
 * Handles:
 * - Empty journey defense
 * - Duplicate task detection & deduplication
 * - Missing official source checks
 * - Grouping into immediate, upcoming, and optional stages
 * - Regional suitability & missing regional data disclosures
 * - Hidden task filtering
 *
 * @param {string|Object} journeyOrId - Journey id string or full journey object
 * @param {Object} options - { region = 'all', hiddenTaskIds = [] }
 * @returns {Object} Processed journey model
 */
export function buildLifeEventJourney(journeyOrId, options = {}) {
  const { region = 'all', hiddenTaskIds = [] } = options;

  let journey = null;
  if (typeof journeyOrId === 'string') {
    journey = getLifeEventById(journeyOrId);
  } else if (journeyOrId && typeof journeyOrId === 'object') {
    journey = journeyOrId;
  }

  // 1. Guard against empty / invalid journey
  if (!journey || !Array.isArray(journey.tasks) || journey.tasks.length === 0) {
    return {
      isValid: false,
      journeyId: journey?.id || null,
      title: journey?.title || 'Unknown Journey',
      errors: ['Journey definition is missing or contains no actionable tasks.'],
      tasks: [],
      hiddenTasks: [],
      groups: {
        immediate: [],
        upcoming: [],
        optional: [],
      },
      regionalDisclosure: null,
      totalCount: 0,
      visibleCount: 0,
      hiddenCount: 0,
    };
  }

  const errors = [];
  const seenTaskIds = new Set();
  const sanitizedTasks = [];
  const hiddenIdSet = new Set(Array.isArray(hiddenTaskIds) ? hiddenTaskIds : []);

  // 2. Process tasks: deduplicate, verify sources, validate stages
  for (const rawTask of journey.tasks) {
    if (!rawTask || !rawTask.id) {
      errors.push('Task missing unique identifier');
      continue;
    }

    // Check duplicate tasks
    if (seenTaskIds.has(rawTask.id)) {
      errors.push(`Duplicate task detected and ignored: "${rawTask.id}"`);
      continue;
    }
    seenTaskIds.add(rawTask.id);

    // Validate official source
    const hasSource =
      rawTask.officialSource &&
      typeof rawTask.officialSource.name === 'string' &&
      typeof rawTask.officialSource.url === 'string' &&
      rawTask.officialSource.url.trim().length > 0;

    if (!hasSource) {
      errors.push(`Task "${rawTask.id}" is missing verified official source citation.`);
    }

    // Verify stage (default to 'upcoming' if unknown)
    const validStages = ['immediate', 'upcoming', 'optional'];
    const stage = validStages.includes(rawTask.stage) ? rawTask.stage : 'upcoming';

    // Regional applicability check
    const applicableRegions = Array.isArray(rawTask.applicableRegions) ? rawTask.applicableRegions : ['all'];
    const isApplicableToRegion =
      region === 'all' || applicableRegions.includes('all') || applicableRegions.includes(region);

    if (!isApplicableToRegion) {
      // Not applicable to this region
      continue;
    }

    sanitizedTasks.push({
      ...rawTask,
      stage,
      hasMissingSource: !hasSource,
      rationale: rawTask.rationale || 'Essential public administrative requirement.',
      officialSource: hasSource
        ? rawTask.officialSource
        : {
            name: 'Official Government Directory (Unverified)',
            url: 'https://services.india.gov.in',
            verified: false,
          },
    });
  }

  // 3. Regional disclosure check
  const regionMeta = getRegionByCode(region);
  let regionalDisclosure = null;
  if (region !== 'all') {
    if (!regionMeta.isVerified) {
      regionalDisclosure = {
        isVerified: false,
        stateName: regionMeta.name,
        message: `Missing Regional Data: Official state-specific portability rules for ${regionMeta.name} are not yet verified. Showing national / central government baseline requirements.`,
        note: regionMeta.unverifiedReason || 'Please verify local circulars at your district collectorate.',
      };
    } else {
      regionalDisclosure = {
        isVerified: true,
        stateName: regionMeta.name,
        message: `Showing portability guidance verified for ${regionMeta.name}.`,
      };
    }
  }

  // 4. Split into visible and hidden
  const visibleTasks = sanitizedTasks.filter((t) => !hiddenIdSet.has(t.id));
  const hiddenTasks = sanitizedTasks.filter((t) => hiddenIdSet.has(t.id));

  // 5. Group visible tasks into immediate, upcoming, optional
  const groups = {
    immediate: visibleTasks.filter((t) => t.stage === 'immediate'),
    upcoming: visibleTasks.filter((t) => t.stage === 'upcoming'),
    optional: visibleTasks.filter((t) => t.stage === 'optional'),
  };

  return {
    isValid: errors.filter((e) => !e.includes('missing verified official source')).length === 0,
    journeyId: journey.id,
    title: journey.title,
    shortDescription: journey.shortDescription,
    category: journey.category,
    icon: journey.icon,
    scopeNotice: journey.scopeNotice,
    errors,
    tasks: visibleTasks,
    hiddenTasks,
    groups,
    regionalDisclosure,
    totalCount: sanitizedTasks.length,
    visibleCount: visibleTasks.length,
    hiddenCount: hiddenTasks.length,
  };
}

/**
 * Reads all stored user journeys from localStorage safely.
 * @param {Storage} [storage=localStorage]
 * @returns {Object} Map of journeyId -> state
 */
export function getAllUserJourneys(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return {};
  try {
    const raw = storage.getItem(LIFE_EVENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Loads user state for a specific journey.
 * @param {string} journeyId
 * @param {Storage} [storage]
 * @returns {Object} { completedTaskIds: string[], hiddenTaskIds: string[], region: string, updatedAt: string }
 */
export function loadUserJourney(journeyId, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!journeyId) return { completedTaskIds: [], hiddenTaskIds: [], region: 'all' };
  const all = getAllUserJourneys(storage);
  const data = all[journeyId];
  return {
    completedTaskIds: Array.isArray(data?.completedTaskIds) ? data.completedTaskIds : [],
    hiddenTaskIds: Array.isArray(data?.hiddenTaskIds) ? data.hiddenTaskIds : [],
    region: data?.region || 'all',
    updatedAt: data?.updatedAt || null,
  };
}

/**
 * Saves user progress, hidden tasks, and chosen region for a journey.
 * @param {string} journeyId
 * @param {Object} stateData
 * @param {Storage} [storage]
 * @returns {boolean} Success status
 */
export function saveUserJourney(
  journeyId,
  stateData = {},
  storage = typeof localStorage !== 'undefined' ? localStorage : null
) {
  if (!journeyId || !storage) return false;
  try {
    const all = getAllUserJourneys(storage);
    all[journeyId] = {
      completedTaskIds: Array.isArray(stateData.completedTaskIds) ? stateData.completedTaskIds : [],
      hiddenTaskIds: Array.isArray(stateData.hiddenTaskIds) ? stateData.hiddenTaskIds : [],
      region: stateData.region || 'all',
      updatedAt: new Date().toISOString(),
    };
    storage.setItem(LIFE_EVENT_STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

/**
 * Resets user progress for a specific journey.
 * @param {string} journeyId
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function resetUserJourney(journeyId, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!journeyId || !storage) return false;
  try {
    const all = getAllUserJourneys(storage);
    delete all[journeyId];
    storage.setItem(LIFE_EVENT_STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

/**
 * Exports a user-requested, plain-language text summary of the journey roadmap.
 * Does not transmit data over the network.
 *
 * @param {Object} journey
 * @param {Object} userState
 * @param {string} region
 * @returns {string} Clean formatted markdown summary
 */
export function exportJourneySummary(journey, userState = {}, region = 'all') {
  if (!journey) return '';

  const completed = new Set(userState.completedTaskIds || []);
  const hidden = new Set(userState.hiddenTaskIds || []);
  const regionMeta = getRegionByCode(region);

  const lines = [
    `# Civic Life-Event Roadmap: ${journey.title}`,
    `Generated on: ${new Date().toLocaleDateString()}`,
    `Selected Region: ${regionMeta.name} (${regionMeta.isVerified ? 'Verified' : 'Unverified Regional Baseline'})`,
    '',
    `> Notice: ${journey.scopeNotice || 'Informational Roadmap Only. Civic Help Setu does not file applications or change records.'}`,
    '',
  ];

  const tasks = Array.isArray(journey.tasks) ? journey.tasks : [];

  for (const stage of ['immediate', 'upcoming', 'optional']) {
    const stageTasks = tasks.filter((t) => t.stage === stage && !hidden.has(t.id));
    if (stageTasks.length === 0) continue;

    const label =
      stage === 'immediate'
        ? '## Immediate Steps (Within 15-30 Days)'
        : stage === 'upcoming'
        ? '## Upcoming Steps (30-90 Days)'
        : '## Optional / Entitlement Steps';

    lines.push(label);
    for (const task of stageTasks) {
      const isDone = completed.has(task.id);
      lines.push(`- [${isDone ? 'x' : ' '}] **${task.title}** (${task.timeframe || stage})`);
      lines.push(`  - Why this appears: ${task.rationale}`);
      if (task.officialSource) {
        lines.push(`  - Official Source: ${task.officialSource.name} (${task.officialSource.url})`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
