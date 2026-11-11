import { describe, it, expect } from 'vitest';
import {
  PORTABILITY_TIER,
  TASK_CATEGORY,
  exportMigrantTransitionChecklist,
  generateInterStateMigrationGuide,
} from './interStateMigrantServiceGuideService.js';

describe('interStateMigrantServiceGuideService', () => {
  it('generates a categorized transition roadmap for a verified origin-destination pair', () => {
    const guide = generateInterStateMigrationGuide('BIHAR', 'TAMIL_NADU');

    expect(guide.isInterState).toBe(true);
    expect(guide.isVerifiedCombination).toBe(true);
    expect(guide.totalTasks).toBeGreaterThanOrEqual(5);

    // Verify all four core categories are populated
    expect(guide.categorizedTasks[TASK_CATEGORY.PORTABLE_BENEFITS].length).toBeGreaterThan(0);
    expect(guide.categorizedTasks[TASK_CATEGORY.PROFILE_UPDATES].length).toBeGreaterThan(0);
    expect(guide.categorizedTasks[TASK_CATEGORY.FRESH_APPLICATIONS].length).toBeGreaterThan(0);
    expect(guide.categorizedTasks[TASK_CATEGORY.LOCAL_REGISTRATIONS].length).toBeGreaterThan(0);

    // Verify ONORC ration portability
    const onorc = guide.categorizedTasks[TASK_CATEGORY.PORTABLE_BENEFITS].find((t) =>
      t.title.includes('One Nation One Ration Card')
    );
    expect(onorc).toBeDefined();
    expect(onorc.portabilityTier).toBe(PORTABILITY_TIER.NATIONWIDE_PORTABLE);
    expect(onorc.officialSource).toContain('Department of Food and Public Distribution');
    expect(onorc.lastVerifiedDate).toBe('2026-01-10');
  });

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
    expect(voter.portabilityTier).toBe(PORTABILITY_TIER.CONDITIONAL_PORTABILITY);
  });

  it('outputs "not verified" instead of hallucinating for unsupported combinations', () => {
    const unverified = generateInterStateMigrationGuide('BIHAR', 'UNSUPPORTED_STATE_XYZ');

    expect(unverified.isVerifiedCombination).toBe(false);
    expect(unverified.message).toContain('are not verified. Do not guess');
    expect(unverified.tasks.length).toBe(0);
  });

  it('identifies intra-state district moves and directs to local relocation guides', () => {
    const sameState = generateInterStateMigrationGuide('TAMIL_NADU', 'TAMIL_NADU');

    expect(sameState.isInterState).toBe(false);
    expect(sameState.message).toContain('intra-state district relocation');
  });

  it('exports a clean transition checklist without collecting personal identifiers', () => {
    const guide = generateInterStateMigrationGuide('WEST_BENGAL', 'KERALA');
    const exported = exportMigrantTransitionChecklist(guide);

    expect(exported.route).toBe('WEST_BENGAL -> KERALA');
    expect(exported.totalChecklistItems).toBe(guide.totalTasks);
    expect(exported.checklist[0]).toHaveProperty('title');
    expect(exported.checklist[0]).toHaveProperty('portability');
    expect(exported.checklist[0]).toHaveProperty('source');

    // Confirm no personal fields
    const stringified = JSON.stringify(exported);
    expect(stringified).not.toContain('aadhaar');
    expect(stringified).not.toContain('rationNumber');
  });
});
