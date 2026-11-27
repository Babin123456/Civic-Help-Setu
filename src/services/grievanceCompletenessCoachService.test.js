import { describe, it, expect } from 'vitest';
import {
  MULTILINGUAL_COACH_PROMPTS,
  analyzeGrievanceDraft,
  decideCoachSuggestion,
  migrateCoachStoreState,
  verifyCoachRuleProvenance,
} from './grievanceCompletenessCoachService.js';

describe('Public Grievance Language Quality & Completeness Coach (#1444)', () => {
  it('highlights missing fields with multilingual prompts and preserves originalText', () => {
    const draft = analyzeGrievanceDraft({
      originalText: 'The bulb is useless and broken.',
      language: 'hi',
    });

    expect(draft.originalText).toBe('The bulb is useless and broken.');
    expect(draft.approvedDraftText).toBe(draft.originalText);
    expect(draft.missingFields.map((f) => f.field)).toContain('date');
    expect(draft.missingFields.map((f) => f.field)).toContain('location');
    expect(draft.missingFields[0].prompt).toBe(MULTILINGUAL_COACH_PROMPTS.hi.missingDate);
    expect(draft.suggestions.some((s) => s.id === 'nw-useless')).toBe(true);
    expect(draft.officialRule.verified).toBe(true);
  });

  it('requires explicit user approval before modifying approvedDraftText and preserves originalText', () => {
    const draft = analyzeGrievanceDraft({
      originalText: 'On 2026-11-10 near Ward 4, please fix the useless streetlight. Ticket T-10.',
      language: 'en',
    });

    expect(draft.completenessScore).toBe(100);
    expect(draft.approvedDraftText).toBe(draft.originalText);

    const approved = decideCoachSuggestion(draft, {
      suggestionId: 'nw-useless',
      decision: 'approve',
    });
    expect(approved.originalText).toBe(draft.originalText);
    expect(approved.approvedDraftText).toContain('non-functional');
    expect(approved.approvedDraftText).not.toContain('useless');

    const rejected = decideCoachSuggestion(approved, {
      suggestionId: 'nw-useless',
      decision: 'reject',
    });
    expect(rejected.approvedDraftText).toBe(draft.originalText);
  });

  it('rejects PII, marks unknown rules unverified, and migrates legacy state', () => {
    expect(() =>
      analyzeGrievanceDraft({ originalText: 'My Aadhaar 2345 6789 0123 and useless road.' })
    ).toThrow(/Privacy violation/);

    const unverified = verifyCoachRuleProvenance({ source: 'Draft' });
    expect(unverified.verified).toBe(false);
    expect(unverified.status).toBe('unverified');

    const migrated = migrateCoachStoreState({});
    expect(migrated.schemaVersion).toBe('1.0.0');
  });
});
