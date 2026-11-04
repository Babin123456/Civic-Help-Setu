import { describe, it, expect } from 'vitest';
import {
  STATUS_DEFINITIONS,
  STATUS_CATEGORIES,
  getStatusDefinition,
  getAllStatusKeys,
  getPlatformStatusKeys,
} from './statusDefinitions';

describe('statusDefinitions', () => {
  describe('STATUS_DEFINITIONS structure', () => {
    it('has all expected categories', () => {
      expect(Object.keys(STATUS_DEFINITIONS)).toEqual([
        STATUS_CATEGORIES.REQUIREMENT,
        STATUS_CATEGORIES.INTAKE_WINDOW,
        STATUS_CATEGORIES.APPLICATION,
        STATUS_CATEGORIES.FEE,
        STATUS_CATEGORIES.ELIGIBILITY,
      ]);
    });

    it('each category has at least one status', () => {
      Object.values(STATUS_CATEGORIES).forEach((category) => {
        const keys = getAllStatusKeys(category);
        expect(keys.length).toBeGreaterThan(0);
      });
    });

    it('each status definition has required fields', () => {
      Object.entries(STATUS_DEFINITIONS).forEach(([category, defs]) => {
        Object.values(defs).forEach((def) => {
          expect(def).toHaveProperty('label');
          expect(def).toHaveProperty('shortLabel');
          expect(def).toHaveProperty('description');
          expect(def).toHaveProperty('whatItDoesNotMean');
          expect(def).toHaveProperty('nextSteps');
          expect(def).toHaveProperty('category');
          expect(def).toHaveProperty('platformStatus');
          expect(def.category).toBe(category);
          expect(typeof def.platformStatus).toBe('boolean');
          expect(def.platformStatus).toBe(true);
        });
      });
    });

    it('all platformStatus values are true (since these are platform-generated)', () => {
      const platformKeys = getPlatformStatusKeys();
      platformKeys.forEach((def) => {
        expect(def.platformStatus).toBe(true);
      });
    });
  });

  describe('getStatusDefinition', () => {
    it('returns definition for valid category and key', () => {
      const def = getStatusDefinition(STATUS_CATEGORIES.REQUIREMENT, 'required');
      expect(def).not.toBeNull();
      expect(def.label).toBe('Official requirement');
    });

    it('returns null for invalid category', () => {
      const def = getStatusDefinition('invalid-category', 'required');
      expect(def).toBeNull();
    });

    it('returns null for invalid key', () => {
      const def = getStatusDefinition(STATUS_CATEGORIES.REQUIREMENT, 'invalid-key');
      expect(def).toBeNull();
    });

    it('returns definition for all known status keys', () => {
      const requirementKeys = getAllStatusKeys(STATUS_CATEGORIES.REQUIREMENT);
      requirementKeys.forEach((key) => {
        const def = getStatusDefinition(STATUS_CATEGORIES.REQUIREMENT, key);
        expect(def).not.toBeNull();
      });

      const intakeKeys = getAllStatusKeys(STATUS_CATEGORIES.INTAKE_WINDOW);
      intakeKeys.forEach((key) => {
        const def = getStatusDefinition(STATUS_CATEGORIES.INTAKE_WINDOW, key);
        expect(def).not.toBeNull();
      });

      const appKeys = getAllStatusKeys(STATUS_CATEGORIES.APPLICATION);
      appKeys.forEach((key) => {
        const def = getStatusDefinition(STATUS_CATEGORIES.APPLICATION, key);
        expect(def).not.toBeNull();
      });

      const feeKeys = getAllStatusKeys(STATUS_CATEGORIES.FEE);
      feeKeys.forEach((key) => {
        const def = getStatusDefinition(STATUS_CATEGORIES.FEE, key);
        expect(def).not.toBeNull();
      });

      const eligibilityKeys = getAllStatusKeys(STATUS_CATEGORIES.ELIGIBILITY);
      eligibilityKeys.forEach((key) => {
        const def = getStatusDefinition(STATUS_CATEGORIES.ELIGIBILITY, key);
        expect(def).not.toBeNull();
      });
    });
  });

  describe('getAllStatusKeys', () => {
    it('returns all keys for a category', () => {
      const keys = getAllStatusKeys(STATUS_CATEGORIES.REQUIREMENT);
      expect(keys).toEqual(['required', 'conditional', 'optional', 'unverified']);
    });

    it('returns empty array for invalid category', () => {
      const keys = getAllStatusKeys('invalid-category');
      expect(keys).toEqual([]);
    });
  });

  describe('getPlatformStatusKeys', () => {
    it('returns all platform status definitions with metadata', () => {
      const keys = getPlatformStatusKeys();
      expect(keys.length).toBeGreaterThan(0);

      keys.forEach((def) => {
        expect(def).toHaveProperty('category');
        expect(def).toHaveProperty('key');
        expect(def).toHaveProperty('label');
        expect(def).toHaveProperty('shortLabel');
        expect(def).toHaveProperty('description');
        expect(def).toHaveProperty('whatItDoesNotMean');
        expect(def).toHaveProperty('nextSteps');
        expect(def).toHaveProperty('platformStatus');
        expect(def.platformStatus).toBe(true);
      });
    });

    it('includes all expected status keys across categories', () => {
      const keys = getPlatformStatusKeys();
      const keyPairs = keys.map((k) => `${k.category}:${k.key}`);

      expect(keyPairs).toContain(`${STATUS_CATEGORIES.REQUIREMENT}:required`);
      expect(keyPairs).toContain(`${STATUS_CATEGORIES.REQUIREMENT}:conditional`);
      expect(keyPairs).toContain(`${STATUS_CATEGORIES.REQUIREMENT}:optional`);
      expect(keyPairs).toContain(`${STATUS_CATEGORIES.REQUIREMENT}:unverified`);

      expect(keyPairs).toContain(`${STATUS_CATEGORIES.INTAKE_WINDOW}:open`);
      expect(keyPairs).toContain(`${STATUS_CATEGORIES.INTAKE_WINDOW}:upcoming`);
      expect(keyPairs).toContain(`${STATUS_CATEGORIES.INTAKE_WINDOW}:closed`);
      expect(keyPairs).toContain(`${STATUS_CATEGORIES.INTAKE_WINDOW}:unpublished`);
      expect(keyPairs).toContain(`${STATUS_CATEGORIES.INTAKE_WINDOW}:not confirmed`);

      expect(keyPairs).toContain(`${STATUS_CATEGORIES.APPLICATION}:submitted`);
      expect(keyPairs).toContain(`${STATUS_CATEGORIES.APPLICATION}:in-progress`);
      expect(keyPairs).toContain(`${STATUS_CATEGORIES.APPLICATION}:action-required`);
      expect(keyPairs).toContain(`${STATUS_CATEGORIES.APPLICATION}:completed`);

      expect(keyPairs).toContain(`${STATUS_CATEGORIES.FEE}:published`);
      expect(keyPairs).toContain(`${STATUS_CATEGORIES.FEE}:free`);
      expect(keyPairs).toContain(`${STATUS_CATEGORIES.FEE}:unverified`);

      expect(keyPairs).toContain(`${STATUS_CATEGORIES.ELIGIBILITY}:eligible`);
      expect(keyPairs).toContain(`${STATUS_CATEGORIES.ELIGIBILITY}:conditional`);
      expect(keyPairs).toContain(`${STATUS_CATEGORIES.ELIGIBILITY}:ineligible`);
      expect(keyPairs).toContain(`${STATUS_CATEGORIES.ELIGIBILITY}:unknown`);
    });
  });
});

describe('Status definitions sync with codebase usage', () => {
  const statusKeysUsedInCodebase = {
    [STATUS_CATEGORIES.REQUIREMENT]: ['required', 'conditional', 'optional', 'unverified'],
    [STATUS_CATEGORIES.INTAKE_WINDOW]: ['open', 'upcoming', 'closed', 'unpublished', 'not confirmed'],
    [STATUS_CATEGORIES.APPLICATION]: ['submitted', 'in-progress', 'action-required', 'completed'],
    [STATUS_CATEGORIES.FEE]: ['published', 'free', 'unverified'],
    [STATUS_CATEGORIES.ELIGIBILITY]: ['eligible', 'conditional', 'ineligible', 'unknown'],
  };

  it('every status key used in the codebase has a definition', () => {
    Object.entries(statusKeysUsedInCodebase).forEach(([category, keys]) => {
      keys.forEach((key) => {
        const def = getStatusDefinition(category, key);
        expect(def).not.toBeNull();
      });
    });
  });

  it('every definition has a corresponding usage in the codebase (no orphan definitions)', () => {
    Object.entries(STATUS_DEFINITIONS).forEach(([category, defs]) => {
      Object.keys(defs).forEach((key) => {
        const usedKeys = statusKeysUsedInCodebase[category] || [];
        expect(usedKeys).toContain(key);
      });
    });
  });
});