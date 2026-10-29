/**
 * Validation for values that arrive through the address bar (/services?q=...&sort=..., /track?id=...).
 * Anyone can type or share a URL, so nothing read from it is trusted: free text is cleaned and
 * bounded, and every filter or sort key must be one the page knows. Unknown values fall back to the
 * default instead of breaking the page. Everything returned is plain text; render it as a React
 * child, never as HTML.
 */

export const MAX_SEARCH_LENGTH = 100;
export const MAX_ASSISTANT_QUERY_LENGTH = 500;
export const MAX_ID_LENGTH = 64;

export const SORT_KEYS = ['relevance', 'popularity', 'speed-asc', 'name-asc', 'name-desc', 'difficulty-asc'];

export const FILTER_OPTIONS = {
  mode: ['Online', 'Offline', 'Hybrid'],
  diff: ['Easy', 'Medium', 'Hard'],
  fee: ['Free', 'Paid'],
  speed: ['Fast', 'Urgent', 'Standard'],
};

// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;

/**
 * Cleans free text: removes control and invisible direction characters, collapses whitespace and
 * cuts to `max` characters (counted in whole characters, so a pair is never split). `trim: false`
 * keeps one space at either end, which a search box needs while the person is still typing.
 */
export const normalizeText = (value, max = MAX_SEARCH_LENGTH, { trim = true } = {}) => {
  if (typeof value !== 'string') return '';
  const cleaned = value.normalize('NFKC').replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ');
  const bounded = [...(trim ? cleaned.trim() : cleaned)].slice(0, max).join('');
  return trim ? bounded.trim() : bounded.trim() === '' ? '' : bounded;
};

/** Search text for the services page. Edges are kept so typing "birth " does not lose the space. */
export const normalizeSearchQuery = (value) => normalizeText(value, MAX_SEARCH_LENGTH, { trim: false });

/** Returns the matching allowed value (ignoring case), or `fallback` when there is none. */
export const pickAllowed = (value, allowed, fallback) => {
  if (typeof value !== 'string') return fallback;
  const wanted = value.trim().toLowerCase();
  const hit = allowed.find((option) => option.toLowerCase() === wanted);
  return hit ?? fallback;
};

/**
 * Reads and validates the filters of the services page.
 * @param {URLSearchParams} params
 * @param {{ categories?: string[], departments?: string[] }} known values that exist in the catalogue
 */
export const parseServiceFilters = (params, { categories = [], departments = [] } = {}) => ({
  searchQuery: normalizeSearchQuery(params.get('q')),
  category: pickAllowed(params.get('cat'), categories, 'All'),
  department: pickAllowed(params.get('dept'), departments, 'All'),
  mode: pickAllowed(params.get('mode'), FILTER_OPTIONS.mode, 'All'),
  difficulty: pickAllowed(params.get('diff'), FILTER_OPTIONS.diff, 'All'),
  fee: pickAllowed(params.get('fee'), FILTER_OPTIONS.fee, 'All'),
  speed: pickAllowed(params.get('speed'), FILTER_OPTIONS.speed, 'All'),
  sortBy: pickAllowed(params.get('sort'), SORT_KEYS, 'relevance'),
});

/**
 * A service slug from the address bar (for example "ration-card"): letters, digits, dot, dash and
 * underscore only. Anything else means "not a usable slug" and returns ''.
 */
export const parseSlugParam = (value) => {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text || text.length > MAX_ID_LENGTH) return '';
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(text) ? text : '';
};

/**
 * An application reference typed by the person (tracking page). References entered by hand have no
 * fixed format, so this only cleans and bounds the text instead of restricting the characters.
 */
export const parseReferenceParam = (value) => normalizeText(value, MAX_ID_LENGTH);

/** The assistant's ?q= text: cleaned and cut to a sensible length, '' when nothing is left. */
export const parseAssistantQuery = (value) => normalizeText(value, MAX_ASSISTANT_QUERY_LENGTH);
