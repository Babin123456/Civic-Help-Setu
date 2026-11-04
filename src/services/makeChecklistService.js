/**
 * AI-Assisted Make Checklist Service
 * Converts service document requirement text (bullet lists, paragraphs, incomplete notes)
 * into structured checklists compatible with the existing Checklist UI.
 * 
 * Strict Grounding & Uncertainty Rules:
 * 1. Strict Grounding: Uses only requirements supplied by the service catalogue or input text.
 *    No external or unmentioned documents are ever hallucinated.
 * 2. Preserve Uncertainty: Ambiguous or unverified items are explicitly labeled as
 *    "Confirm with the department." and never marked as officially mandatory.
 * 3. Mandatory Restraint: A document is marked as officially mandatory (required) ONLY
 *    if explicitly stated as such by official sources or catalogue data.
 * 4. Fallback Safety: AI failure cleanly falls back to the verified original requirements.
 */

import { REQUIREMENT_TYPES } from './requirementTypes';
import { CHECKLIST_STORAGE_KEY } from './checklistStorage';

export const CONFIRM_WITH_DEPARTMENT = 'Confirm with the department.';

export const AMBIGUITY_REGEX =
  /\b(maybe|may\s+be|might|possibly|perhaps|approx|unclear|in\s+some\s+cases|in\s+certain\s+cases|subject\s+to|if\s+applicable|if\s+needed|if\s+requested|where\s+applicable|where\s+required|as\s+applicable|confirm\s+with|check\s+with|inquire|consult|local\s+rules|depending\s+on|in\s+some\s+regions|varies\s+by)\b|\?+/i;

export const MANDATORY_REGEX =
  /\b(mandatory|must\s+provide|must\s+submit|must\s+bring|must\s+have|compulsory|required\s+officially|officially\s+required|strictly\s+required|essential\s+requirement)\b/i;

export const OPTIONAL_REGEX =
  /\b(optional|suggestion|suggested|recommended|not\s+mandatory|if\s+you\s+wish|voluntary|not\s+required)\b/i;

export const CONDITIONAL_INDICATOR_REGEX =
  /\b(if|when|unless|only\s+if|in\s+case|where)\b/i;

const getDefaultStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/**
 * Strips conversational filler and list markers from a string
 */
export const cleanItemText = (text) => {
  if (typeof text !== 'string') return '';
  return text
    .replace(/^(\s*[-*•–—]\s+|\s*\d+[.)]\s+|\s*\[[ x]?\]\s+)/i, '') // strip bullet markers, numbered lists like "1. ", brackets
    .replace(/^((documents?|docs?)\s*(needed|required)?|docs?\s*to\s*bring|notes?):?\s*/i, '') // strip introductory tags
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Identifies if a requirement description is ambiguous
 */
export const isAmbiguousRequirement = (text) => {
  if (typeof text !== 'string') return false;
  return AMBIGUITY_REGEX.test(text);
};

/**
 * Identifies if a requirement description indicates an officially mandatory document
 */
export const isOfficiallyMandatory = (text) => {
  if (typeof text !== 'string') return false;
  // If it contains conditional or ambiguity qualifiers, it cannot be considered strictly mandatory
  if (isAmbiguousRequirement(text) || OPTIONAL_REGEX.test(text) || CONDITIONAL_INDICATOR_REGEX.test(text)) {
    return false;
  }
  return MANDATORY_REGEX.test(text);
};

/**
 * Extracts condition clause from requirement text if present
 */
export const extractConditionClause = (text) => {
  if (typeof text !== 'string') return null;
  const match = text.match(/\b(if|when|where|unless|only if)\s+([^.,;!?()]+)/i);
  if (match) {
    return match[0].trim();
  }
  return null;
};

/**
 * Classifies a raw requirement item into type, condition, and ambiguity status
 */
export const classifyItemText = (rawText, serviceContext = null) => {
  const cleaned = cleanItemText(rawText);
  const textForAnalysis = rawText || cleaned;

  // 1. Check if the service catalogue already has verified documentRequirements
  const catalogEntry = serviceContext?.documentRequirements?.[rawText]
    || serviceContext?.documentRequirements?.[cleaned];

  if (catalogEntry && catalogEntry.type) {
    const isAmbiguous = isAmbiguousRequirement(textForAnalysis) || isAmbiguousRequirement(catalogEntry.condition);
    const condition = isAmbiguous
      ? CONFIRM_WITH_DEPARTMENT
      : (catalogEntry.condition || null);

    return {
      title: cleaned,
      type: isAmbiguous && catalogEntry.type === REQUIREMENT_TYPES.REQUIRED
        ? REQUIREMENT_TYPES.UNVERIFIED
        : catalogEntry.type,
      condition,
      isAmbiguous,
      source: catalogEntry.source || null,
    };
  }

  // 2. Ambiguous check: preserve uncertainty
  if (isAmbiguousRequirement(textForAnalysis)) {
    return {
      title: cleaned,
      type: REQUIREMENT_TYPES.UNVERIFIED,
      condition: CONFIRM_WITH_DEPARTMENT,
      isAmbiguous: true,
      source: null,
    };
  }

  // 3. Optional check
  if (OPTIONAL_REGEX.test(textForAnalysis)) {
    return {
      title: cleaned,
      type: REQUIREMENT_TYPES.OPTIONAL,
      condition: null,
      isAmbiguous: false,
      source: null,
    };
  }

  // 4. Officially mandatory check
  if (isOfficiallyMandatory(textForAnalysis)) {
    return {
      title: cleaned,
      type: REQUIREMENT_TYPES.REQUIRED,
      condition: null,
      isAmbiguous: false,
      source: serviceContext?.officialSources?.[0] || null,
    };
  }

  // 5. Conditional check
  const extractedCondition = extractConditionClause(textForAnalysis);
  if (extractedCondition) {
    return {
      title: cleaned,
      type: REQUIREMENT_TYPES.CONDITIONAL,
      condition: extractedCondition,
      isAmbiguous: false,
      source: null,
    };
  }

  // 6. Default to unverified without guessing official mandatory status
  return {
    title: cleaned,
    type: REQUIREMENT_TYPES.UNVERIFIED,
    condition: null,
    isAmbiguous: false,
    source: null,
  };
};

/**
 * Extracts checklist items from a bullet list
 */
export const extractChecklistFromBulletList = (input, serviceContext = null) => {
  let lines = [];
  if (Array.isArray(input)) {
    lines = input;
  } else if (typeof input === 'string') {
    lines = input
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  const items = [];
  const requirements = {};

  for (const line of lines) {
    const cleaned = cleanItemText(line);
    if (!cleaned || cleaned.toLowerCase().startsWith('documents') || cleaned.toLowerCase().startsWith('notes:')) {
      continue;
    }

    const classified = classifyItemText(line, serviceContext);
    const itemLabel = classified.isAmbiguous
      ? `${classified.title} (${CONFIRM_WITH_DEPARTMENT})`
      : classified.title;

    items.push(itemLabel);
    requirements[itemLabel] = {
      type: classified.type,
      condition: classified.condition,
      source: classified.source,
      isAmbiguous: classified.isAmbiguous,
    };
  }

  return { items, requirements };
};

/**
 * Extracts checklist items from long paragraphs
 */
export const extractChecklistFromParagraphs = (paragraphText, serviceContext = null) => {
  if (typeof paragraphText !== 'string') {
    return { items: [], requirements: {} };
  }

  // Split into sentences and logical document clauses
  const sentences = paragraphText
    .split(/(?<=[.!?])\s+|;\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const items = [];
  const requirements = {};

  for (const sentence of sentences) {
    const cleaned = cleanItemText(sentence);
    // Ignore non-requirement narrative sentences
    if (
      cleaned.length < 5 ||
      /^thank you/i.test(cleaned) ||
      /^processing\s+takes/i.test(cleaned) ||
      /^fees\s+are/i.test(cleaned)
    ) {
      continue;
    }

    const classified = classifyItemText(sentence, serviceContext);
    const itemLabel = classified.isAmbiguous
      ? `${classified.title} (${CONFIRM_WITH_DEPARTMENT})`
      : classified.title;

    if (!items.includes(itemLabel)) {
      items.push(itemLabel);
      requirements[itemLabel] = {
        type: classified.type,
        condition: classified.condition,
        source: classified.source,
        isAmbiguous: classified.isAmbiguous,
      };
    }
  }

  return { items, requirements };
};

/**
 * Extracts checklist items from incomplete or fragmented source text
 */
export const extractChecklistFromIncompleteText = (text, serviceContext = null) => {
  if (typeof text !== 'string') {
    return { items: [], requirements: {} };
  }

  // Split on commas, semicolons, question marks, dashes, or newlines
  const fragments = text
    .split(/[,;\n|]|\band\b|(?<=\?)\s*/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  const items = [];
  const requirements = {};

  for (const fragment of fragments) {
    const cleaned = cleanItemText(fragment);
    if (!cleaned || cleaned.length < 2 || /^docs?:?$/i.test(cleaned) || /^notes?:?$/i.test(cleaned)) {
      continue;
    }

    const isFragmentAmbiguous = fragment.includes('?') || isAmbiguousRequirement(fragment);
    const classified = classifyItemText(fragment, serviceContext);

    // If fragment had a question mark or incomplete uncertainty, force ambiguous label
    const isAmbiguous = isFragmentAmbiguous || classified.isAmbiguous;
    const itemLabel = isAmbiguous
      ? `${classified.title} (${CONFIRM_WITH_DEPARTMENT})`
      : classified.title;

    if (!items.includes(itemLabel)) {
      items.push(itemLabel);
      requirements[itemLabel] = {
        type: isAmbiguous ? REQUIREMENT_TYPES.UNVERIFIED : classified.type,
        condition: isAmbiguous ? CONFIRM_WITH_DEPARTMENT : classified.condition,
        source: classified.source,
        isAmbiguous,
      };
    }
  }

  return { items, requirements };
};

/**
 * Fallback generator when AI parsing is unavailable or fails
 */
export const generateFallbackChecklist = (serviceOrText) => {
  // If a catalogue service object was passed
  if (serviceOrText && typeof serviceOrText === 'object') {
    const documents = Array.isArray(serviceOrText.documents)
      ? serviceOrText.documents
      : [];

    const items = [];
    const requirements = {};

    for (const doc of documents) {
      const classified = classifyItemText(doc, serviceOrText);
      const itemLabel = classified.isAmbiguous
        ? `${classified.title} (${CONFIRM_WITH_DEPARTMENT})`
        : classified.title;

      items.push(itemLabel);
      requirements[itemLabel] = {
        type: classified.type,
        condition: classified.condition,
        source: classified.source,
        isAmbiguous: classified.isAmbiguous,
      };
    }

    return {
      items,
      requirements,
      isFallback: true,
      fallbackReason: 'AI service unavailable. Fell back to original service catalogue requirements.',
    };
  }

  // If a raw string was passed
  if (typeof serviceOrText === 'string') {
    const lines = serviceOrText
      .split(/\r?\n/)
      .map(cleanItemText)
      .filter((l) => l.length > 0);

    const items = [];
    const requirements = {};

    for (const line of lines) {
      const isAmbiguous = isAmbiguousRequirement(line);
      const itemLabel = isAmbiguous
        ? `${line} (${CONFIRM_WITH_DEPARTMENT})`
        : line;

      items.push(itemLabel);
      requirements[itemLabel] = {
        type: isAmbiguous ? REQUIREMENT_TYPES.UNVERIFIED : (isOfficiallyMandatory(line) ? REQUIREMENT_TYPES.REQUIRED : REQUIREMENT_TYPES.UNVERIFIED),
        condition: isAmbiguous ? CONFIRM_WITH_DEPARTMENT : null,
        source: null,
        isAmbiguous,
      };
    }

    return {
      items,
      requirements,
      isFallback: true,
      fallbackReason: 'AI service unavailable. Fell back to original requirement text.',
    };
  }

  return {
    items: [],
    requirements: {},
    isFallback: true,
    fallbackReason: 'No requirement text provided.',
  };
};

/**
 * Converts requirement text (bullet list, paragraph, or incomplete text) into a structured checklist
 */
export const convertRequirementTextToChecklist = (text, serviceContext = null, options = {}) => {
  if (options.simulateAiFailure) {
    return generateFallbackChecklist(serviceContext || text);
  }

  if (typeof text !== 'string' || !text.trim()) {
    if (serviceContext) {
      return generateFallbackChecklist(serviceContext);
    }
    return { items: [], requirements: {}, isFallback: false };
  }

  try {
    const trimmed = text.trim();

    // 1. Detect bullet list format
    const hasBullets = /^(\s*[-*•–—]\s+|\s*\d+[.)]\s+|\s*\[[ x]?\]\s+)/m.test(trimmed);
    if (hasBullets) {
      const result = extractChecklistFromBulletList(trimmed, serviceContext);
      return { ...result, isFallback: false };
    }

    // 2. Detect incomplete source text with question marks or fragmented comma separators
    const hasIncompleteSignals = trimmed.includes('?') || /^docs?:/i.test(trimmed) || (trimmed.includes(';') && !trimmed.includes('.'));
    if (hasIncompleteSignals) {
      const result = extractChecklistFromIncompleteText(trimmed, serviceContext);
      return { ...result, isFallback: false };
    }

    // 3. Multi-sentence paragraph format
    const result = extractChecklistFromParagraphs(trimmed, serviceContext);
    return { ...result, isFallback: false };
  } catch {
    return generateFallbackChecklist(serviceContext || text);
  }
};

/**
 * Main AI-assisted action: Converts selected service requirements into a structured checklist
 */
export const generateServiceChecklist = async (service, options = {}) => {
  // Simulate AI parsing latency unless in immediate mode
  if (!options.immediate) {
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  if (options.simulateAiFailure) {
    return generateFallbackChecklist(service);
  }

  if (!service || typeof service !== 'object') {
    return generateFallbackChecklist(service);
  }

  try {
    // If service has explicit requirements text or paragraphs
    if (typeof service.requirementsText === 'string' && service.requirementsText.trim()) {
      return convertRequirementTextToChecklist(service.requirementsText, service, options);
    }

    // If service has documents array
    if (Array.isArray(service.documents) && service.documents.length > 0) {
      const bulletText = service.documents.join('\n');
      return convertRequirementTextToChecklist(bulletText, service, options);
    }

    return generateFallbackChecklist(service);
  } catch {
    return generateFallbackChecklist(service);
  }
};

/**
 * Reads customized checklist definitions from storage
 */
export const readServiceChecklist = (serviceId, storage = getDefaultStorage()) => {
  if (!serviceId || !storage) return null;
  try {
    const raw = storage.getItem(CHECKLIST_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    const entry = map?.[serviceId];
    if (entry && Array.isArray(entry.items)) {
      return {
        items: entry.items,
        requirements: entry.requirements || {},
        updatedAt: entry.updatedAt || null,
      };
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Saves customized checklist definitions to storage
 */
export const saveServiceChecklist = (serviceId, checklistData, storage = getDefaultStorage()) => {
  if (!serviceId || !storage || !checklistData) return false;
  try {
    const raw = storage.getItem(CHECKLIST_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const existing = map[serviceId] || {};

    map[serviceId] = {
      ...existing,
      items: Array.isArray(checklistData.items) ? checklistData.items : [],
      requirements: checklistData.requirements || {},
      checked: Array.isArray(existing.checked) ? existing.checked : [],
      rev: Number.isInteger(existing.rev) ? existing.rev + 1 : 1,
      updatedAt: new Date().toISOString(),
    };

    storage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
};

/**
 * Clears customized checklist definitions from storage
 */
export const clearServiceChecklist = (serviceId, storage = getDefaultStorage()) => {
  if (!serviceId || !storage) return false;
  try {
    const raw = storage.getItem(CHECKLIST_STORAGE_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw);
    if (map[serviceId]) {
      delete map[serviceId].items;
      delete map[serviceId].requirements;
      storage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(map));
    }
    return true;
  } catch {
    return false;
  }
};
