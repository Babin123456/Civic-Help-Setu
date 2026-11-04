import { getServiceById } from './serviceCatalog.js';

/**
 * Useful default set of civic-service starter questions used when
 * specific service context or AI generation is unavailable.
 */
export const GENERIC_FALLBACK_SUGGESTIONS = [
  'Which documents are usually needed for this service?',
  'Where can I find the official application link?',
  'What are the typical fees and processing time?',
  'What are the general eligibility criteria?',
  'What steps are involved in submitting an application?',
  'How can I track my submitted civic application status?',
  'How do I file a grievance if a public service is delayed?',
];

/**
 * Page-specific contextual questions when navigating from other civic views.
 */
export const PAGE_CONTEXT_SUGGESTIONS = {
  track: [
    'How do I track my submitted civic application status?',
    'What should I do if my application tracking reference is lost?',
    'What do the different civic application status stages mean?',
    'How can I file an escalation if an application exceeds statutory SLA?',
  ],
  eligibility: [
    'What are the common eligibility criteria across civic welfare schemes?',
    'How is family income verified for government welfare schemes?',
    'Which documents are needed to prove scheme eligibility?',
    'Can I apply for multiple government benefit schemes simultaneously?',
  ],
  vault: [
    'Which civic documents are recommended to store in the digital vault?',
    'How do I ensure my uploaded civic documents are stored securely?',
    'How do I verify if my uploaded certificate is still valid?',
  ],
  services: [
    'Which public services can be applied for completely online?',
    'Where can I find official state versus central government portals?',
    'Which documents are commonly required across multiple civic services?',
    'What is the difference between statutory and standard processing time?',
  ],
};

/**
 * Regex patterns that could imply an application has been approved
 * or that eligibility is guaranteed. Per project policy, suggestions
 * must remain open exploratory inquiries and never guarantee outcomes.
 */
const FORBIDDEN_OUTCOME_PATTERNS = [
  /\b(application\s+(is|has\s+been)\s+approved)\b/i,
  /\b(your\s+approval\s+is\s+confirmed)\b/i,
  /\b(guaranteed\s+(eligibility|approval|admission|benefit|outcome))\b/i,
  /\b(eligibility\s+is\s+guaranteed)\b/i,
  /\b(download\s+your\s+approved\s+(certificate|licence|license|card))\b/i,
  /\b(you\s+have\s+been\s+approved)\b/i,
  /\b(guarantee(d)?\s+approval)\b/i,
];

/**
 * Validates whether a suggestion adheres to the civic safety guidelines
 * (does not imply approval or guaranteed eligibility).
 */
export const isSafeCivicSuggestion = (text) => {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  return !FORBIDDEN_OUTCOME_PATTERNS.some((pattern) => pattern.test(trimmed));
};

/**
 * Removes duplicate suggestions based on case-insensitive trimmed text.
 */
export const deduplicateSuggestions = (items = []) => {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const text = typeof item === 'string' ? item : item?.prompt || item?.text || '';
    const key = text.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(typeof item === 'string' ? item.trim() : item);
  }

  return result;
};

/**
 * Generates contextual starter questions for a specific civic service.
 * Adapts to service name, category, fees, and requirements while avoiding
 * any implication of guaranteed approval.
 */
export const generateServiceSpecificSuggestions = (service) => {
  if (!service || typeof service !== 'object') {
    return [...GENERIC_FALLBACK_SUGGESTIONS];
  }

  const name = service.name || 'this service';
  const suggestions = [];

  // Core inquiries (matches issue examples)
  suggestions.push(`Which documents are usually needed for ${name}?`);
  suggestions.push(`Where can I find the official application link for ${name}?`);
  suggestions.push(`What are the typical fees and processing time for ${name}?`);
  suggestions.push(`What are the general eligibility requirements for ${name}?`);

  if (Array.isArray(service.steps) && service.steps.length > 0) {
    suggestions.push(`What are the step-by-step application instructions for ${name}?`);
  }

  if (Array.isArray(service.warnings) && service.warnings.length > 0) {
    suggestions.push(`What should I watch out for when applying for ${name}?`);
  }

  if (service.department) {
    suggestions.push(`Which department is responsible for processing ${name}?`);
  }

  suggestions.push(`How can I track the progress of my ${name} application?`);

  return suggestions;
};

/**
 * Main resolver to retrieve question suggestions based on available context.
 *
 * @param {Object} options
 * @param {Object|null} [options.service] - A service object if already known
 * @param {string|null} [options.serviceId] - Service ID slug to look up in catalog
 * @param {string|null} [options.page] - Page identifier (e.g. 'track', 'eligibility')
 * @param {string[]} [options.customQuestions] - Optional additional questions
 * @returns {string[]} An array of deduplicated, safe question suggestions
 */
export const getCivicQuestionSuggestions = ({
  service = null,
  serviceId = null,
  page = null,
  customQuestions = [],
} = {}) => {
  let resolvedService = service;

  if (!resolvedService && serviceId) {
    try {
      resolvedService = getServiceById(serviceId);
    } catch {
      resolvedService = null;
    }
  }

  let rawSuggestions = resolvedService
    ? generateServiceSpecificSuggestions(resolvedService)
    : page && PAGE_CONTEXT_SUGGESTIONS[page.toLowerCase()]
      ? PAGE_CONTEXT_SUGGESTIONS[page.toLowerCase()]
      : [...GENERIC_FALLBACK_SUGGESTIONS];

  if (Array.isArray(customQuestions) && customQuestions.length > 0) {
    rawSuggestions = [...rawSuggestions, ...customQuestions];
  }

  // Filter out any unsafe/forbidden phrasing, then deduplicate
  const safeSuggestions = rawSuggestions.filter(isSafeCivicSuggestion);
  const deduplicated = deduplicateSuggestions(safeSuggestions);

  return deduplicated.length > 0 ? deduplicated : [...GENERIC_FALLBACK_SUGGESTIONS];
};
