/**
 * Bounded, explainable image triage for tree inspections.
 *
 * What this module does: turns a small set of observable symptom tags plus safe
 * image metadata into a *suggestion* that an arborist can accept, edit or
 * reject. It does not identify people, infer protected attributes, or make a
 * pruning/removal/risk decision.
 *
 * What it deliberately does not do: pretend to analyse pixels. There is no
 * external model in this deployment, so the deterministic ruleset is always
 * available as the fallback. If an external adapter is wired in later, its
 * version and execution time are recorded and any failure falls back here.
 */

import { hashString, sanitizePlain, createTreeError } from './treeInventoryValidation';
import {
  RISK_LEVELS,
  TREE_CONDITIONS,
  TREE_ERROR_CODES,
  TRIAGE_DECISIONS,
} from './treeInventoryConstants';

export const TREE_TRIAGE_RULESET_VERSION = 'tree-triage-rules-v1';
export const TREE_TRIAGE_MODEL_VERSION = 'deterministic-symptom-rules-v1';

export const TREE_SYMPTOM_TAGS = Object.freeze({
  DEADWOOD: 'deadwood',
  CAVITY: 'cavity',
  CRACKED_BARK: 'cracked_bark',
  LEANING: 'leaning',
  FALLEN_BRANCH: 'fallen_branch',
  ROOT_DAMAGE: 'root_damage',
  PEST_SIGNS: 'pest_signs',
  CANOPY_THINNING: 'canopy_thinning',
  VEHICLE_DAMAGE: 'vehicle_damage',
  WATERLOGGING: 'waterlogging',
});

export const TREE_SYMPTOM_LABELS = Object.freeze({
  [TREE_SYMPTOM_TAGS.DEADWOOD]: 'Deadwood in canopy',
  [TREE_SYMPTOM_TAGS.CAVITY]: 'Cavity or hollow in trunk',
  [TREE_SYMPTOM_TAGS.CRACKED_BARK]: 'Cracked bark or split union',
  [TREE_SYMPTOM_TAGS.LEANING]: 'Visible lean',
  [TREE_SYMPTOM_TAGS.FALLEN_BRANCH]: 'Fallen or hanging branch',
  [TREE_SYMPTOM_TAGS.ROOT_DAMAGE]: 'Exposed or damaged roots',
  [TREE_SYMPTOM_TAGS.PEST_SIGNS]: 'Pest or disease signs',
  [TREE_SYMPTOM_TAGS.CANOPY_THINNING]: 'Thinning canopy',
  [TREE_SYMPTOM_TAGS.VEHICLE_DAMAGE]: 'Vehicle strike damage',
  [TREE_SYMPTOM_TAGS.WATERLOGGING]: 'Waterlogging at root zone',
});

export const TRIAGE_PROHIBITED_USES = Object.freeze([
  'automatic_pruning',
  'automatic_removal',
  'automatic_risk_designation',
  'service_access_denial',
]);

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.filter((tag) => Object.values(TREE_SYMPTOM_TAGS).includes(tag)))].slice(0, 10);
};

const buildExplanations = (tags, speciesId) => {
  const explanations = tags.map((tag) => ({
    sourceField: 'symptomTags',
    factor: TREE_SYMPTOM_LABELS[tag],
    value: tag,
    influence: ['cavity', 'cracked_bark', 'leaning', 'fallen_branch'].includes(tag) ? 'high' : 'moderate',
    note: 'Observed by the person who submitted the inspection and available for expert review.',
  }));
  if (speciesId) {
    explanations.push({
      sourceField: 'speciesId',
      factor: 'Species context',
      value: speciesId,
      influence: 'low',
      note: 'Species adds context only; it is not evidence that this individual tree is unsafe.',
    });
  }
  explanations.push({
    sourceField: 'image.metadata',
    factor: 'Image provided',
    value: 'metadata_only',
    influence: 'low',
        note: 'The deterministic ruleset uses image type and size, not private visual inference. An expert must view the evidence.',
  });
  return explanations;
};

const scoreSuggestion = (tags) => {
  const highSignals = [
    TREE_SYMPTOM_TAGS.CAVITY,
    TREE_SYMPTOM_TAGS.CRACKED_BARK,
    TREE_SYMPTOM_TAGS.FALLEN_BRANCH,
    TREE_SYMPTOM_TAGS.LEANING,
  ].filter((tag) => tags.includes(tag));
  const moderateSignals = [
    TREE_SYMPTOM_TAGS.ROOT_DAMAGE,
    TREE_SYMPTOM_TAGS.PEST_SIGNS,
    TREE_SYMPTOM_TAGS.CANOPY_THINNING,
    TREE_SYMPTOM_TAGS.WATERLOGGING,
  ].filter((tag) => tags.includes(tag));
  const lowSignals = [
    TREE_SYMPTOM_TAGS.DEADWOOD,
    TREE_SYMPTOM_TAGS.VEHICLE_DAMAGE,
  ].filter((tag) => tags.includes(tag));

  if (tags.length === 0) {
    return {
      suggestedCondition: TREE_CONDITIONS.UNKNOWN,
      suggestedRisk: RISK_LEVELS.NONE,
      confidence: 'low',
      rationale: 'No observable symptom tags were supplied, so the suggestion stays "not assessed".',
    };
  }
  if (highSignals.length >= 2 || (highSignals.length >= 1 && moderateSignals.length >= 1)) {
    return {
      suggestedCondition: TREE_CONDITIONS.CRITICAL,
      suggestedRisk: RISK_LEVELS.HIGH,
      confidence: 'medium',
      rationale: `Multiple structural signals (${highSignals.join(' + ')}) warrant a prompt expert inspection.`,
    };
  }
  if (highSignals.length === 1 || moderateSignals.length >= 2) {
    return {
      suggestedCondition: TREE_CONDITIONS.POOR,
      suggestedRisk: RISK_LEVELS.MODERATE,
      confidence: 'medium',
      rationale: 'At least one structural or physiological concern is present. Schedule an expert inspection.',
    };
  }
  if (moderateSignals.length === 1 || lowSignals.length > 0) {
    return {
      suggestedCondition: TREE_CONDITIONS.FAIR,
      suggestedRisk: RISK_LEVELS.LOW,
      confidence: 'low',
      rationale: 'Minor or monitorable symptoms were recorded. Confirm during the next routine inspection.',
    };
  }
  return {
    suggestedCondition: TREE_CONDITIONS.FAIR,
    suggestedRisk: RISK_LEVELS.LOW,
    confidence: 'low',
    rationale: 'Only low-specificity observations were supplied.',
  };
};

/**
 * @param {object} input
 * @param {{mimeType?:string,sizeBytes?:number,url?:string}} [input.image]
 * @param {string[]} [input.symptomTags]
 * @param {string} [input.speciesId]
 * @param {object} [options]
 * @param {number} [options.nowMs]
 * @param {(input: object) => object} [options.externalAdapter] optional, synchronous adapter
 */
export const analyzeTreeImage = (input = {}, options = {}) => {
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const tags = normalizeTags(input.symptomTags);
  const image = input.image && typeof input.image === 'object' ? input.image : null;
  const speciesId = sanitizePlain(input.speciesId || '', { max: 80, multiline: false });

  let fallbackReason = 'No external image model is configured; deterministic rules were used.';
  let externalAttempted = false;
  let externalErrorCode = null;

  if (typeof options.externalAdapter === 'function') {
    externalAttempted = true;
    try {
      const external = options.externalAdapter({
        imageMimeType: image?.mimeType ? String(image.mimeType).slice(0, 80) : '',
        imageSizeBytes: Number(image?.sizeBytes || 0),
        symptomTags: tags,
        speciesId,
      });
      if (external && Object.values(TREE_CONDITIONS).includes(external.suggestedCondition)) {
        const externalExplanation = Array.isArray(external.explanations) ? external.explanations.slice(0, 8) : [];
        return Object.freeze({
          triageId: external.triageId || `triage_${hashString(`${nowMs}|external|${tags.join(',')}`)}`,
          rulesetVersion: TREE_TRIAGE_RULESET_VERSION,
          modelVersion: sanitizePlain(external.modelVersion || 'external-image-model', { max: 120, multiline: false }),
          executedAt: new Date(nowMs).toISOString(),
          isFallback: false,
          fallbackReason: null,
          externalAttempted: true,
          externalErrorCode: null,
          inputWindow: {
            fieldsUsed: ['image.mimeType', 'image.sizeBytes', 'symptomTags', 'speciesId'],
            imageFingerprint: hashString(`${image?.mimeType || ''}|${image?.sizeBytes || 0}`),
            imageMimeType: image?.mimeType || null,
            imageSizeBytes: Number(image?.sizeBytes || 0),
            symptomTags: tags,
            speciesId: speciesId || null,
          },
          suggestedCondition: external.suggestedCondition,
          suggestedRisk: Object.values(RISK_LEVELS).includes(external.suggestedRisk) ? external.suggestedRisk : RISK_LEVELS.LOW,
          confidence: ['low', 'medium', 'high'].includes(external.confidence) ? external.confidence : 'low',
          rationale: sanitizePlain(external.rationale || 'External model suggestion.', { max: 500, multiline: false }),
          explanations: externalExplanation,
          decision: TRIAGE_DECISIONS.PENDING,
          requiresExpertConfirmation: true,
          canApplyAutomatically: false,
          allowedUses: ['inspection_triage'],
          prohibitedUses: [...TRIAGE_PROHIBITED_USES],
        });
      }
      externalErrorCode = 'EXTERNAL_MALFORMED';
      fallbackReason = 'The external model returned an unusable result; deterministic rules were used.';
    } catch {
      externalErrorCode = 'EXTERNAL_UNAVAILABLE';
      fallbackReason = 'The external model was unavailable; deterministic rules were used.';
    }
  }

  const scored = scoreSuggestion(tags);
  const fingerprint = hashString(`${image?.mimeType || ''}|${image?.sizeBytes || 0}|${tags.join(',')}|${speciesId}`);

  return Object.freeze({
    triageId: `triage_${fingerprint}`,
    rulesetVersion: TREE_TRIAGE_RULESET_VERSION,
    modelVersion: TREE_TRIAGE_MODEL_VERSION,
    executedAt: new Date(nowMs).toISOString(),
    isFallback: true,
    fallbackReason,
    externalAttempted,
    externalErrorCode,
    inputWindow: {
      fieldsUsed: ['image.mimeType', 'image.sizeBytes', 'symptomTags', 'speciesId'],
      imageFingerprint: fingerprint,
      imageMimeType: image?.mimeType || null,
      imageSizeBytes: Number(image?.sizeBytes || 0),
      symptomTags: tags,
      speciesId: speciesId || null,
    },
    suggestedCondition: scored.suggestedCondition,
    suggestedRisk: scored.suggestedRisk,
    confidence: scored.confidence,
    rationale: scored.rationale,
    explanations: buildExplanations(tags, speciesId),
    decision: TRIAGE_DECISIONS.PENDING,
    requiresExpertConfirmation: true,
    canApplyAutomatically: false,
    allowedUses: ['inspection_triage'],
    prohibitedUses: [...TRIAGE_PROHIBITED_USES],
  });
};

/** Human-in-the-loop decision. A suggestion is never applied without this. */
export const reviewTriageSuggestion = (suggestion, input = {}) => {
  if (!suggestion || typeof suggestion !== 'object') {
    throw createTreeError(TREE_ERROR_CODES.NOT_FOUND, 'Triage suggestion was not found.');
  }
  const decision = input.decision;
  if (![TRIAGE_DECISIONS.ACCEPTED, TRIAGE_DECISIONS.EDITED, TRIAGE_DECISIONS.REJECTED].includes(decision)) {
    throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, 'Decision must be accepted, edited or rejected.', {
      fieldErrors: { decision: 'Choose accept, edit or reject.' },
    });
  }

  const reason = sanitizePlain(input.reason || '', { max: 500, multiline: false });
  if (decision !== TRIAGE_DECISIONS.ACCEPTED && reason.length < 5) {
    throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, 'A reason is required when editing or rejecting a suggestion.', {
      fieldErrors: { reason: 'Give a short reason for this decision.' },
    });
  }

  let appliedCondition = null;
  if (decision === TRIAGE_DECISIONS.ACCEPTED) {
    appliedCondition = suggestion.suggestedCondition;
  }
  if (decision === TRIAGE_DECISIONS.EDITED) {
    if (!Object.values(TREE_CONDITIONS).includes(input.editedCondition)) {
      throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, 'Choose a valid condition for the edited suggestion.', {
        fieldErrors: { editedCondition: 'Choose a valid tree condition.' },
      });
    }
    appliedCondition = input.editedCondition;
  }

  if (!input.reviewerId) {
    throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, 'A named human reviewer is required.');
  }

  return {
    decision,
    reason,
    appliedCondition,
    reviewedBy: sanitizePlain(input.reviewerId, { max: 120, multiline: false }),
    reviewedAt: new Date(Number.isFinite(input.nowMs) ? input.nowMs : Date.now()).toISOString(),
    requiresExpertConfirmation: true,
    prohibitedUses: [...TRIAGE_PROHIBITED_USES],
  };
};

/** A compact log/audit shape that contains no image URL, token or personal data. */
export const toSafeTriageAudit = (suggestion) => ({
  triageId: suggestion?.triageId || null,
  rulesetVersion: suggestion?.rulesetVersion || null,
  modelVersion: suggestion?.modelVersion || null,
  executedAt: suggestion?.executedAt || null,
  isFallback: Boolean(suggestion?.isFallback),
  fallbackReason: suggestion?.fallbackReason || null,
  inputWindow: suggestion?.inputWindow
    ? {
        fieldsUsed: [...(suggestion.inputWindow.fieldsUsed || [])],
        imageFingerprint: suggestion.inputWindow.imageFingerprint,
        imageMimeType: suggestion.inputWindow.imageMimeType,
        imageSizeBytes: suggestion.inputWindow.imageSizeBytes,
        symptomTags: [...(suggestion.inputWindow.symptomTags || [])],
        speciesId: suggestion.inputWindow.speciesId,
      }
    : null,
  suggestedCondition: suggestion?.suggestedCondition || null,
  suggestedRisk: suggestion?.suggestedRisk || null,
  confidence: suggestion?.confidence || null,
  decision: suggestion?.decision || TRIAGE_DECISIONS.PENDING,
});
