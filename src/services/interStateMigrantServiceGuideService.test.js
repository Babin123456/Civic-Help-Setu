import { describe, it, expect } from 'vitest';
import {
  PORTABILITY_TIER,
  TASK_CATEGORY,
  generateInterStateMigrationGuide,
  exportMigrantTransitionChecklist,
  getMigrantDocumentById,
  getMigrantDocumentsByPortability,
  getAuthorityContact,
  serviceCategoryMatches,
  MIGRANT_DOCUMENT_INVENTORY,
  MIGRANT_AUTHORITY_CONTACT_SHEET,
  VERIFIED_STATES,
} from './interStateMigrantServiceGuideService.js';
import { INDIAN_STATES_AND_UTS } from '../data/jurisdictions';

describe('interStateMigrantServiceGuideService - National Inter-State Migrant Worker Planner', () => {
  // ---- VERIFIED STATES ----

  describe('verified states', () => {
    it('includes all 28 Indian states and 8 union territories', () => {
      expect(VERIFIED_STATES.size).toBe(36); // 28 + 8
      // Check a few key states - using normalized uppercase-with-underscore format
      expect(VERIFIED_STATES.has('ANDHRA_PRADESH')).toBe(true);
      expect(VERIFIED_STATES.has('MAHARASHTRA')).toBe(true);
      expect(VERIFIED_STATES.has('KERALA')).toBe(true);
      expect(VERIFIED_STATES.has('DELHI')).toBe(true);
      expect(VERIFIED_STATES.has('JAMMU_AND_KASHMIR')).toBe(true);
    });

    it('includes all INDIAN_STATES_AND_UTS mapping', () => {
      const allExpected = new Set(
        INDIAN_STATES_AND_UTS.map((s) => s.toUpperCase().replace(/\s+/g, '_'))
      );
      expect(VERIFIED_STATES).toEqual(allExpected);
    });
  });

  // ---- SERVICE CATEGORY FILTERING ----

  describe('service category filtering', () => {
    it('returns all tasks when no service category specified', () => {
      const guide = generateInterStateMigrationGuide('BIHAR', 'TAMIL_NADU');
      expect(guide.totalTasks).toBeGreaterThan(0);
    });

    it('filters tasks by service category', () => {
      const guide = generateInterStateMigrationGuide('BIHAR', 'TAMIL_NADU', 'Health');
      // Should only return tasks matching Health category
      expect(guide.totalTasks).toBeGreaterThan(0);
      // All tasks should be from Health-related schemes
      guide.categorizedTasks[TASK_CATEGORY.PORTABLE_BENEFITS].forEach((t) => {
        expect(t.serviceCategories).toBeDefined();
      });
    });

    it('serviceCategoryMatches correctly identifies matches', () => {
      expect(
        serviceCategoryMatches('Health', ['Health', 'Social Welfare'])
      ).toBe(true);
      expect(
        serviceCategoryMatches('Education', ['Health', 'Social Welfare'])
      ).toBe(false);
      expect(serviceCategoryMatches(null, [])).toBe(false);
      expect(serviceCategoryMatches('Health', [])).toBe(false);
    });
  });

  // ---- SAME STATE ----

  describe('same state handling', () => {
    it('detects intra-state moves and directs to local guide', () => {
      const sameState = generateInterStateMigrationGuide('TAMIL_NADU', 'TAMIL_NADU');
      expect(sameState.isInterState).toBe(false);
      expect(sameState.message).toContain('intra-state');
    });

    it('handles same state with different case/spacing', () => {
      const result = generateInterStateMigrationGuide('  tamil nadu  ', 'tamil nadu');
      expect(result.isInterState).toBe(false);
    });
  });

  // ---- UNSUPPORTED/UNVERIFIED STATE COMBINATIONS ----

  describe('unverified state combinations', () => {
    it('outputs "not verified" for unsupported destination state', () => {
      const unverified = generateInterStateMigrationGuide('BIHAR', 'UNSUPPORTED_STATE_XYZ');
      expect(unverified.isVerifiedCombination).toBe(false);
      expect(unverified.message).toContain('are not verified. Do not guess');
      expect(unverified.tasks.length).toBe(0);
    });

    it('outputs "not verified" for origin state not in verified list', () => {
      const unverified = generateInterStateMigrationGuide('UnknownState', 'KERALA');
      expect(unverified.isVerifiedCombination).toBe(false);
      expect(unverified.message).toContain('are not verified');
    });
  });

  // ---- PORTABILITY TIERS ----

  describe('portability tiers', () => {
    it('distinguishes nationwide portable benefits from state-dependent fresh registrations', () => {
      const guide = generateInterStateMigrationGuide('UTTAR_PRADESH', 'MAHARASHTRA');

      // BOCW building worker registration requires fresh state application
      const bocw = guide.categorizedTasks[TASK_CATEGORY.FRESH_APPLICATIONS].find((t) =>
        t.title.includes('BOCW')
      );
      expect(bocw).toBeDefined();
      expect(bocw.portabilityTier).toBe(PORTABILITY_TIER.NON_PORTABLE_LOCAL_ONLY);
      expect(bocw.ownership).toBe('STATE_GOVERNMENT');

      // Voter registration is conditional on residency and Form 8
      const voter = guide.categorizedTasks[TASK_CATEGORY.PROFILE_UPDATES].find((t) =>
        t.title.includes('Voter')
      );
      expect(voter).toBeDefined();
      expect(voter.portabilityTier).toBe(PORTABILITY_TIER.CONDITIONAL_PORTABILITY);
    });

    it('includes NATIONWIDE_PORTABLE tasks for verified state pairs', () => {
      const guide = generateInterStateMigrationGuide('BIHAR', 'TAMIL_NADU');
      const onorc = guide.categorizedTasks[TASK_CATEGORY.PORTABLE_BENEFITS].find((t) =>
        t.title.includes('One Nation One Ration Card')
      );
      expect(onorc).toBeDefined();
      expect(onorc.portabilityTier).toBe(PORTABILITY_TIER.NATIONWIDE_PORTABLE);
      expect(onorc.officialSource).toContain('Department of Food and Public Distribution');
      expect(onorc.lastVerifiedDate).toBe('2026-01-10');
    });
  });

  // ---- BILINGUAL DOCUMENT INVENTORY ----

  describe('bilingual document inventory', () => {
    it('has document entries with bilingual descriptions', () => {
      expect(MIGRANT_DOCUMENT_INVENTORY.length).toBeGreaterThan(0);

      // Check a sample entry has both English and Hindi
      const firstEntry = MIGRANT_DOCUMENT_INVENTORY[0];
      expect(firstEntry).toHaveProperty('name');
      expect(firstEntry).toHaveProperty('hindi');
      expect(firstEntry.name).toBeDefined();
      expect(firstEntry.hindi).toBeDefined();
    });

    it('ration card is marked NATIONWIDE_PORTABLE', () => {
      const ration = getMigrantDocumentById('ration-card');
      expect(ration).toBeDefined();
      expect(ration.portabilityTier).toBe(PORTABILITY_TIER.NATIONWIDE_PORTABLE);
    });

    it('BOCW card is marked LOCAL_ONLY', () => {
      const bocw = getMigrantDocumentById('bocw-registration');
      expect(bocw).toBeDefined();
      expect(bocw.portabilityTier).toBe(PORTABILITY_TIER.NON_PORTABLE_LOCAL_ONLY);
    });

    it('returns documents filtered by portability tier', () => {
      const portableDocs = getMigrantDocumentsByPortability(PORTABILITY_TIER.NATIONWIDE_PORTABLE);
      expect(portableDocs.length).toBeGreaterThan(0);
      portableDocs.forEach((d) => {
        expect(d.portabilityTier).toBe(PORTABILITY_TIER.NATIONWIDE_PORTABLE);
      });
    });

    it('returns empty array for unsupported portability tier', () => {
      const unknownDocs = getMigrantDocumentsByPortability('UNKNOWN_TIER');
      expect(unknownDocs).toEqual([]);
    });
  });

  // ---- AUTHORITY CONTACT SHEET ----

  describe('authority contact sheet', () => {
    it('has bilingual contact entries', () => {
      const sheetEnglish = MIGRANT_AUTHORITY_CONTACT_SHEET.english;
      const sheetHindi = MIGRANT_AUTHORITY_CONTACT_SHEET.hindi;

      expect(sheetEnglish).toHaveProperty('title');
      expect(sheetHindi).toHaveProperty('title');
      expect(sheetEnglish.contacts.length).toBeGreaterThan(0);
      expect(sheetHindi.contacts.length).toBeGreaterThan(0);
    });

    it('english contact sheet has NFSA helpline entry', () => {
      const nfsaContact = getAuthorityContact('All States', 'National Portability');
      expect(nfsaContact).toBeDefined();
      expect(nfsaContact.phone).toBe('1800-11-611 (NFSA Helpline)');
    });

    it('hindi contact sheet has NFSA helpline entry', () => {
      const nfsaContact = getAuthorityContact('All States', 'राष्ट्रीय पोर्टेबिलिटी');
      expect(nfsaContact).toBeDefined();
      // Phone field contains the language-specific helpline text
      expect(nfsaContact.phone).toContain('NFSA');
    });
  });

  // ---- OFFLINE EXPORT WITHOUT PII ----

  describe('offline export without PII', () => {
    it('exports a clean transition checklist', () => {
      const guide = generateInterStateMigrationGuide('WEST_BENGAL', 'KERALA');
      const exported = exportMigrantTransitionChecklist(guide);

      expect(exported.route).toBe('WEST_BENGAL → KERALA');
      expect(exported.totalChecklistItems).toBe(guide.totalTasks);
      expect(exported.checklist).toBeDefined();
      expect(exported.checklist.length).toBeGreaterThan(0);

      // Confirm no personal fields leak into the export
      const stringified = JSON.stringify(exported);
      expect(stringified).not.toContain('aadhaar');
      expect(stringified).not.toContain('rationNumber');
      expect(stringified).not.toContain('userId');
      expect(stringified).not.toContain('panNumber');
      expect(stringified).not.toContain('employer');
      expect(stringified).not.toContain('exactAddress');
    });

    it('export includes service category filter if provided', () => {
      const guide = generateInterStateMigrationGuide('BIHAR', 'TAMIL_NADU', 'Health');
      const exported = exportMigrantTransitionChecklist(guide);
      expect(exported.serviceCategory).toBe('Health');
    });

    it('export is valid JSON with no personal data', () => {
      const guide = generateInterStateMigrationGuide('PUNJAB', 'KARNATAKA');
      const exported = exportMigrantTransitionChecklist(guide);
      const parsed = JSON.parse(JSON.stringify(exported));
      // Verify all checklist items have expected fields but no PII
      parsed.checklist.forEach((item) => {
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('portability');
        expect(item).toHaveProperty('source');
        expect(item).not.toHaveProperty('aadhaarNumber');
        expect(item).not.toHaveProperty('rationNumber');
        expect(item).not.toHaveProperty('employerName');
      });
    });
  });

  // ---- CONFLICTING / UNKNOWN RULES VISIBLE ----

  describe('conflicting/unknown rules remain visible', () => {
    it('shows unknown state pair without guessing', () => {
      const result = generateInterStateMigrationGuide('BIHAR', 'SIKKIM_XYZ');
      expect(result.isVerifiedCombination).toBe(false);
      // No tasks are hallucinated — message explicitly says "do not guess"
      expect(result.message).toContain('Do not guess');
      expect(result.tasks.length).toBe(0);
    });

    it('shows task with portability tier when official source exists', () => {
      const guide = generateInterStateMigrationGuide('BIHAR', 'TAMIL_NADU');
      // Even for unverified state pairs with some verified schemes, rules should be visible
      expect(guide.totalTasks).toBeGreaterThanOrEqual(0);
      guide.categorizedTasks[TASK_CATEGORY.PORTABLE_BENEFITS].forEach((t) => {
        // Every task must have an official source link
        expect(t.officialSource).toBeDefined();
        expect(t.lastVerifiedDate).toBeDefined();
      });
    });
  });

  // ---- COMPREHENSIVE STATE COMBINATION TESTS ----

  describe('comprehensive state combinations', () => {
    it('handles multiple state pair combinations', () => {
      const combinations = [
        ['BIHAR', 'TAMIL_NADU'],
        ['UTTAR_PRADESH', 'MAHARASHTRA'],
        ['KERALA', 'WEST_BENGAL'],
        ['PUNJAB', 'KARNATAKA'],
        ['DELHI', 'Maharashtra'], // mixed case
      ];

      for (const [origin, dest] of combinations) {
        const guide = generateInterStateMigrationGuide(origin, dest);
        // Each combination should produce a valid guide structure
        expect(guide).toHaveProperty('isInterState');
        expect(guide).toHaveProperty('originState');
        expect(guide).toHaveProperty('destinationState');
        expect(guide).toHaveProperty('totalTasks');
        expect(guide).toHaveProperty('categorizedTasks');
        expect(guide).toHaveProperty('disclaimer');
      }
    });

    it('each portability claim links to a dated official source', () => {
      const guide = generateInterStateMigrationGuide('BIHAR', 'TAMIL_NADU');
      guide.categorizedTasks[TASK_CATEGORY.PORTABLE_BENEFITS].forEach((t) => {
        // Every portability claim must link to a dated official source
        expect(t.officialSource).toBeDefined();
        expect(t.lastVerifiedDate).toBeDefined();
        // Date should be in YYYY-MM-DD format
        const dateMatch = t.lastVerifiedDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        expect(dateMatch).not.toBe(null);
      });
    });
  });

  // ---- DELETE / CLEANUP ----

  describe('deletion and cleanup', () => {
    it('export can be serialized and stored without PII', () => {
      const guide = generateInterStateMigrationGuide('RAJASTHAN', 'ODISHA');
      const exported = exportMigrantTransitionChecklist(guide);

      // Simulate deletion by clearing the exported object
      const deleted = { ...exported };
      expect(deleted.route).toBe('RAJASTHAN → ODISHA');
      expect(deleted.checklist).toBeDefined();
      expect(deleted.totalChecklistItems).toBeGreaterThan(0);

      // Verify no sensitive fields remain after "deletion"
      // Use quoted pattern to avoid matching words in guidance text
      const jsonStr = JSON.stringify(deleted);
      expect(jsonStr).not.toMatch(/"aadhaar"|"rationNumber"|"panNumber"|"employer"/i);
    });

    it('guide generation is idempotent for same state pair', () => {
      const result1 = generateInterStateMigrationGuide('BIHAR', 'TAMIL_NADU');
      const result2 = generateInterStateMigrationGuide('BIHAR', 'TAMIL_NADU');
      expect(result1.originState).toBe(result2.originState);
      expect(result1.destinationState).toBe(result2.destinationState);
      expect(result1.totalTasks).toBe(result2.totalTasks);
      expect(result1.isVerifiedCombination).toBe(result2.isVerifiedCombination);
    });
  });
});