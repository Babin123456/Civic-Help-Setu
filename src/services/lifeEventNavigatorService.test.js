import { describe, it, expect, beforeEach } from 'vitest';
import {
  getLifeEvents,
  getLifeEventById,
  getSupportedRegions,
  getRegionByCode,
  buildLifeEventJourney,
  saveUserJourney,
  loadUserJourney,
  resetUserJourney,
  exportJourneySummary,
  LIFE_EVENT_STORAGE_KEY,
} from './lifeEventNavigatorService.js';

// Simple in-memory storage mock
const createMockStorage = (initial = {}) => {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
};

describe('lifeEventNavigatorService (#141)', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
  });

  describe('Registry & Data Retrieval', () => {
    it('returns all defined life event journeys', () => {
      const events = getLifeEvents();
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThanOrEqual(5);

      const ids = events.map((e) => e.id);
      expect(ids).toContain('moving-home');
      expect(ids).toContain('starting-college');
      expect(ids).toContain('first-job');
      expect(ids).toContain('retirement');
      expect(ids).toContain('family-change');
    });

    it('retrieves an event by id', () => {
      const event = getLifeEventById('moving-home');
      expect(event).not.toBeNull();
      expect(event.title).toContain('Moving');
    });

    it('returns null for unknown event id', () => {
      expect(getLifeEventById('non-existent')).toBeNull();
      expect(getLifeEventById(null)).toBeNull();
    });

    it('resolves region metadata correctly', () => {
      const regions = getSupportedRegions();
      expect(regions.length).toBeGreaterThan(0);

      const delhi = getRegionByCode('delhi');
      expect(delhi.isVerified).toBe(true);
      expect(delhi.name).toContain('Delhi');

      const westBengal = getRegionByCode('west-bengal');
      expect(westBengal.isVerified).toBe(false);
      expect(westBengal.unverifiedReason).toBeDefined();

      const unknown = getRegionByCode('unknown-state');
      expect(unknown.isVerified).toBe(false);
    });
  });

  describe('buildLifeEventJourney - Edge Cases & Acceptance Criteria', () => {
    it('handles empty journey safely (null or empty tasks)', () => {
      const emptyNull = buildLifeEventJourney(null);
      expect(emptyNull.isValid).toBe(false);
      expect(emptyNull.tasks).toEqual([]);
      expect(emptyNull.errors.length).toBeGreaterThan(0);

      const emptyObject = buildLifeEventJourney({ id: 'test-empty', tasks: [] });
      expect(emptyObject.isValid).toBe(false);
      expect(emptyObject.totalCount).toBe(0);
      expect(emptyObject.groups.immediate).toEqual([]);
    });

    it('detects and handles duplicate tasks by dropping duplicates and logging errors', () => {
      const journeyWithDups = {
        id: 'dup-test',
        title: 'Duplicate Task Test',
        tasks: [
          {
            id: 'task-1',
            title: 'First Step',
            stage: 'immediate',
            officialSource: { name: 'Portal', url: 'https://example.gov.in', verified: true },
          },
          {
            id: 'task-1', // duplicate!
            title: 'First Step Duplicate',
            stage: 'immediate',
            officialSource: { name: 'Portal', url: 'https://example.gov.in', verified: true },
          },
          {
            id: 'task-2',
            title: 'Second Step',
            stage: 'upcoming',
            officialSource: { name: 'Portal 2', url: 'https://example2.gov.in', verified: true },
          },
        ],
      };

      const result = buildLifeEventJourney(journeyWithDups);
      expect(result.tasks.length).toBe(2);
      expect(result.errors.some((e) => e.includes('Duplicate task detected'))).toBe(true);
      expect(result.tasks.map((t) => t.id)).toEqual(['task-1', 'task-2']);
    });

    it('handles missing official sources with transparent flags and fallbacks', () => {
      const journeyMissingSource = {
        id: 'source-test',
        title: 'Missing Source Test',
        tasks: [
          {
            id: 'task-no-source',
            title: 'Unverified Step',
            stage: 'immediate',
            // No officialSource
          },
          {
            id: 'task-valid-source',
            title: 'Verified Step',
            stage: 'upcoming',
            officialSource: { name: 'Official Portal', url: 'https://official.gov.in', verified: true },
          },
        ],
      };

      const result = buildLifeEventJourney(journeyMissingSource);
      expect(result.tasks.length).toBe(2);
      expect(result.errors.some((e) => e.includes('missing verified official source'))).toBe(true);

      const taskWithoutSource = result.tasks.find((t) => t.id === 'task-no-source');
      expect(taskWithoutSource.hasMissingSource).toBe(true);
      expect(taskWithoutSource.officialSource.url).toBe('https://services.india.gov.in');
    });

    it('groups tasks properly into immediate, upcoming, and optional stages', () => {
      const result = buildLifeEventJourney('moving-home');
      expect(result.isValid).toBe(true);
      expect(result.groups.immediate.length).toBeGreaterThan(0);
      expect(result.groups.upcoming.length).toBeGreaterThan(0);
      expect(result.groups.optional.length).toBeGreaterThan(0);

      // Verify immediate tasks contain address & voter updates
      const immediateTitles = result.groups.immediate.map((t) => t.id);
      expect(immediateTitles).toContain('task-move-aadhaar');
      expect(immediateTitles).toContain('task-move-voter');
    });

    it('discloses when regional data is unverified or missing', () => {
      // 1. National baseline: no disclosure
      const baseline = buildLifeEventJourney('moving-home', { region: 'all' });
      expect(baseline.regionalDisclosure).toBeNull();

      // 2. Verified state: positive verification note
      const verified = buildLifeEventJourney('moving-home', { region: 'delhi' });
      expect(verified.regionalDisclosure).not.toBeNull();
      expect(verified.regionalDisclosure.isVerified).toBe(true);

      // 3. Unverified state: clear disclosure warning
      const unverified = buildLifeEventJourney('moving-home', { region: 'west-bengal' });
      expect(unverified.regionalDisclosure).not.toBeNull();
      expect(unverified.regionalDisclosure.isVerified).toBe(false);
      expect(unverified.regionalDisclosure.message).toContain('Missing Regional Data');
    });

    it('supports hiding irrelevant tasks', () => {
      const full = buildLifeEventJourney('moving-home');
      const totalCount = full.tasks.length;

      const hidden = buildLifeEventJourney('moving-home', {
        hiddenTaskIds: ['task-move-aadhaar'],
      });

      expect(hidden.tasks.length).toBe(totalCount - 1);
      expect(hidden.hiddenCount).toBe(1);
      expect(hidden.hiddenTasks.map((t) => t.id)).toContain('task-move-aadhaar');
    });
  });

  describe('User Progress Persistence & Export', () => {
    it('saves, loads, and resets user journey preferences in storage', () => {
      const journeyId = 'moving-home';
      const userState = {
        completedTaskIds: ['task-move-aadhaar'],
        hiddenTaskIds: ['task-move-domicile'],
        region: 'karnataka',
      };

      const saved = saveUserJourney(journeyId, userState, mockStorage);
      expect(saved).toBe(true);

      const loaded = loadUserJourney(journeyId, mockStorage);
      expect(loaded.completedTaskIds).toEqual(['task-move-aadhaar']);
      expect(loaded.hiddenTaskIds).toEqual(['task-move-domicile']);
      expect(loaded.region).toBe('karnataka');

      const reset = resetUserJourney(journeyId, mockStorage);
      expect(reset).toBe(true);

      const emptyAfterReset = loadUserJourney(journeyId, mockStorage);
      expect(emptyAfterReset.completedTaskIds).toEqual([]);
    });

    it('exports a plain-text markdown summary with sources and disclosures', () => {
      const journey = getLifeEventById('first-job');
      const userState = {
        completedTaskIds: ['task-job-pan-aadhaar-link'],
        hiddenTaskIds: [],
      };

      const summary = exportJourneySummary(journey, userState, 'all');
      expect(summary).toContain('# Civic Life-Event Roadmap: Beginning a First Job');
      expect(summary).toContain('Notice:');
      expect(summary).toContain('[x] **Verify PAN-Aadhaar Linkage and Bank e-KYC**');
      expect(summary).toContain('Why this appears:');
      expect(summary).toContain('Official Source:');
    });
  });
});
