import { describe, it, expect } from 'vitest';
import {
  analyzeTreeImage,
  reviewTriageSuggestion,
  toSafeTriageAudit,
  TREE_TRIAGE_MODEL_VERSION,
  TREE_TRIAGE_RULESET_VERSION,
  TREE_SYMPTOM_TAGS,
  TRIAGE_PROHIBITED_USES,
} from './treeImageTriageService';
import { TREE_CONDITIONS, TRIAGE_DECISIONS } from './treeInventoryConstants';

const expectCode = (fn, code) => {
  try {
    fn();
    throw new Error('Expected the call to be refused');
  } catch (error) {
    expect(error.code).toBe(code);
  }
};

describe('treeImageTriageService — bounded and explainable suggestions', () => {
  it('returns a deterministic fallback with version, input window and no automatic authority', () => {
    const suggestion = analyzeTreeImage(
      {
        image: { mimeType: 'image/jpeg', sizeBytes: 1200 },
        symptomTags: [],
        speciesId: 'sp_neem',
      },
      { nowMs: 1_700_000_000_000 }
    );

    expect(suggestion.rulesetVersion).toBe(TREE_TRIAGE_RULESET_VERSION);
    expect(suggestion.modelVersion).toBe(TREE_TRIAGE_MODEL_VERSION);
    expect(suggestion.isFallback).toBe(true);
    expect(suggestion.executedAt).toBe('2023-11-14T22:13:20.000Z');
    expect(suggestion.suggestedCondition).toBe(TREE_CONDITIONS.UNKNOWN);
    expect(suggestion.inputWindow.fieldsUsed).toEqual([
      'image.mimeType',
      'image.sizeBytes',
      'symptomTags',
      'speciesId',
    ]);
    expect(suggestion.inputWindow.imageFingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(suggestion.requiresExpertConfirmation).toBe(true);
    expect(suggestion.canApplyAutomatically).toBe(false);
    expect(suggestion.decision).toBe(TRIAGE_DECISIONS.PENDING);
    expect(suggestion.prohibitedUses).toEqual(expect.arrayContaining(TRIAGE_PROHIBITED_USES));
    expect(suggestion.explanations.length).toBeGreaterThan(0);
    expect(suggestion.explanations.some((item) => item.sourceField === 'image.metadata')).toBe(true);
  });

  it('escalates multiple structural signals to a critical suggestion without making a decision', () => {
    const suggestion = analyzeTreeImage({
      symptomTags: [TREE_SYMPTOM_TAGS.CAVITY, TREE_SYMPTOM_TAGS.CRACKED_BARK],
    });
    expect(suggestion.suggestedCondition).toBe(TREE_CONDITIONS.CRITICAL);
    expect(suggestion.suggestedRisk).toBe('high');
    expect(suggestion.confidence).toBe('medium');
    expect(suggestion.decision).toBe(TRIAGE_DECISIONS.PENDING);
    expect(suggestion.rationale).toMatch(/expert inspection/i);
    expect(suggestion.explanations.filter((item) => item.sourceField === 'symptomTags')).toHaveLength(2);
  });

  it('maps one structural signal or multiple moderate signals to poor', () => {
    const structural = analyzeTreeImage({ symptomTags: [TREE_SYMPTOM_TAGS.LEANING] });
    expect(structural.suggestedCondition).toBe(TREE_CONDITIONS.POOR);

    const moderate = analyzeTreeImage({
      symptomTags: [TREE_SYMPTOM_TAGS.ROOT_DAMAGE, TREE_SYMPTOM_TAGS.WATERLOGGING],
    });
    expect(moderate.suggestedCondition).toBe(TREE_CONDITIONS.POOR);
  });

  it('uses a configured external adapter but still requires human confirmation', () => {
    const suggestion = analyzeTreeImage(
      { symptomTags: [TREE_SYMPTOM_TAGS.DEADWOOD] },
      {
        externalAdapter: () => ({
          suggestedCondition: TREE_CONDITIONS.FAIR,
          suggestedRisk: 'low',
          confidence: 'high',
          modelVersion: 'external-model-2026-11',
          rationale: 'External model saw minor deadwood.',
          explanations: [
            { sourceField: 'image', factor: 'Deadwood', value: 'small', influence: 'moderate', note: 'Expert must verify.' },
          ],
        }),
      }
    );

    expect(suggestion.isFallback).toBe(false);
    expect(suggestion.modelVersion).toBe('external-model-2026-11');
    expect(suggestion.suggestedCondition).toBe(TREE_CONDITIONS.FAIR);
    expect(suggestion.requiresExpertConfirmation).toBe(true);
    expect(suggestion.canApplyAutomatically).toBe(false);
  });

  it('falls back deterministically when the external adapter throws or returns junk', () => {
    const thrown = analyzeTreeImage(
      { symptomTags: [TREE_SYMPTOM_TAGS.DEADWOOD] },
      {
        externalAdapter: () => {
          throw new Error('model offline');
        },
      }
    );
    expect(thrown.isFallback).toBe(true);
    expect(thrown.externalAttempted).toBe(true);
    expect(thrown.externalErrorCode).toBe('EXTERNAL_UNAVAILABLE');

    const junk = analyzeTreeImage(
      { symptomTags: [TREE_SYMPTOM_TAGS.DEADWOOD] },
      { externalAdapter: () => ({ suggestedCondition: 'not-a-condition' }) }
    );
    expect(junk.isFallback).toBe(true);
    expect(junk.externalErrorCode).toBe('EXTERNAL_MALFORMED');
  });

  it('requires a named human reviewer to accept, edit or reject a suggestion', () => {
    const suggestion = analyzeTreeImage({ symptomTags: [TREE_SYMPTOM_TAGS.CAVITY] });

    const accepted = reviewTriageSuggestion(suggestion, {
      decision: TRIAGE_DECISIONS.ACCEPTED,
      reviewerId: 'arborist_1',
    });
    expect(accepted.appliedCondition).toBe(suggestion.suggestedCondition);
    expect(accepted.requiresExpertConfirmation).toBe(true);

    const edited = reviewTriageSuggestion(suggestion, {
      decision: TRIAGE_DECISIONS.EDITED,
      editedCondition: TREE_CONDITIONS.FAIR,
      reason: 'Cavity is shallow on close inspection.',
      reviewerId: 'arborist_1',
    });
    expect(edited.appliedCondition).toBe(TREE_CONDITIONS.FAIR);

    const rejected = reviewTriageSuggestion(suggestion, {
      decision: TRIAGE_DECISIONS.REJECTED,
      reason: 'Image is of a different tree.',
      reviewerId: 'arborist_1',
    });
    expect(rejected.appliedCondition).toBeNull();

    expectCode(
      () => reviewTriageSuggestion(suggestion, { decision: TRIAGE_DECISIONS.EDITED, reviewerId: 'arborist_1' }),
      'TREE_VALIDATION_ERROR'
    );
    expectCode(
      () => reviewTriageSuggestion(suggestion, { decision: TRIAGE_DECISIONS.ACCEPTED }),
      'TREE_VALIDATION_ERROR'
    );
  });

  it('emits an audit summary that contains no image URL, token or personal data', () => {
    const suggestion = analyzeTreeImage({
      image: { mimeType: 'image/jpeg', sizeBytes: 900, url: 'https://example.test/private-photo.jpg?token=abc' },
      symptomTags: [TREE_SYMPTOM_TAGS.CAVITY],
      speciesId: 'sp_neem',
    });
    const safe = toSafeTriageAudit(suggestion);
    expect(safe).not.toHaveProperty('image');
    expect(JSON.stringify(safe)).not.toContain('private-photo');
    expect(JSON.stringify(safe)).not.toContain('token');
    expect(safe.rulesetVersion).toBe(TREE_TRIAGE_RULESET_VERSION);
  });
});
