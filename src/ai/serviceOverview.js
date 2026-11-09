/**
 * One-sentence overview of a service for the search results (#384)
 *
 * Like the rest of src/ai, this runs in the browser on the record that is already in the catalogue:
 * nothing is sent anywhere and no model is called (see docs/INTEGRATIONS.md). It reads three fields,
 * the name, the description and the department, and says nothing the record does not say:
 *
 *   - a record without a name or without a description gets no overview, not a guess
 *   - the sentence is the first sentence of the description, plus "handled by <department>" when
 *     the department is on the record and the sentence does not already name it
 *
 * The catalogue has no field for the intended audience (`eligibility` holds conditions), so none is
 * used here. The record is never changed, the overview never feeds the order of the results or any
 * eligibility status, and the result is plain text for React to render as children.
 *
 * Results are kept per guide, and a changed name, description or department gets a new one, so a
 * list that is opened again does not ask twice.
 */
import { sanitizePlainText } from '../utils/safeContent';

export const OVERVIEW_LABEL = 'AI-generated overview';
export const OVERVIEW_NOTICE = 'Made from this guide’s name, description and department only. Not official.';
export const INSUFFICIENT_MESSAGE = 'There is not enough in this guide for an overview, so none was made.';

// The other src/ai helpers wait a moment as a model call would; the same short wait keeps the loading
// state real here, and callers and tests can set it to 0.
export const OVERVIEW_LATENCY_MS = 300;
export const OVERVIEW_TIMEOUT_MS = 4000;
const CACHE_LIMIT = 300;

const cleanText = (value) => (typeof value === 'string' ? sanitizePlainText(value, { multiline: false, max: 500 }) : '');

const firstSentence = (text) => {
  const found = /^(.+?[.!?])(?=\s+[A-Z(]|$)/.exec(text);
  return (found ? found[1] : text).trim();
};

const withoutFinalStop = (text) => text.replace(/[.!?]+$/, '');

/**
 * @param {object} service A service record. It is only read.
 * @returns {{ status: 'ready' | 'insufficient', label: string, ... }}
 */
export function buildServiceOverview(service) {
  const record = service && typeof service === 'object' ? service : {};
  const name = cleanText(record.name);
  const description = cleanText(record.shortDescription);
  if (!name || !description) {
    return { status: 'insufficient', label: OVERVIEW_LABEL, message: INSUFFICIENT_MESSAGE, basedOn: [] };
  }

  const basedOn = ['name', 'shortDescription'];
  let sentence = withoutFinalStop(firstSentence(description));
  const department = cleanText(record.department);
  // "Income Tax Department (CBDT)" is already named by "...issued by the Income Tax Department".
  const departmentName = department.replace(/\s*\([^)]*\)/g, '').trim();
  if (department && !sentence.toLowerCase().includes(departmentName.toLowerCase())) {
    sentence += `, handled by ${department}`;
    basedOn.push('department');
  }
  return { status: 'ready', label: OVERVIEW_LABEL, sentence: `${sentence}.`, basedOn };
}

const cache = new Map();

// A record that cannot be read has no key, so it is never kept and fails into an error result below.
const cacheKey = (service) => {
  if (!service || typeof service !== 'object' || typeof service.id !== 'string') return null;
  try {
    return `${service.id}|${JSON.stringify([service.name, service.shortDescription, service.department])}`;
  } catch {
    return null;
  }
};

export const clearOverviewCache = () => cache.clear();

const wait = (ms, signal) =>
  new Promise((resolve) => {
    if (!(ms > 0)) return resolve();
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(id); resolve(); }, { once: true });
  });

/**
 * Same shape as askCivicAssistant: it can take a timeout, and a failure comes back as a result with a
 * status instead of a throw, so a card can always show its fallback. A result is kept for the next call.
 *
 * @param {object} service
 * @param {{ timeoutMs?: number, latencyMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>} status 'ready', 'insufficient', 'error' or 'cancelled'
 */
export async function fetchServiceOverview(service, options = {}) {
  const { timeoutMs = OVERVIEW_TIMEOUT_MS, latencyMs = OVERVIEW_LATENCY_MS, signal } = options;
  const key = cacheKey(service);
  if (key && cache.has(key)) return cache.get(key);

  const work = (async () => {
    await wait(latencyMs, signal);
    if (signal?.aborted) return { status: 'cancelled' };
    return buildServiceOverview(service);
  })();
  let timer;
  const timeout = timeoutMs > 0
    ? new Promise((resolve) => { timer = setTimeout(() => resolve({ status: 'error', reason: 'timeout' }), timeoutMs); })
    : null;
  try {
    const result = await (timeout ? Promise.race([work, timeout]) : work);
    if (key && (result.status === 'ready' || result.status === 'insufficient')) {
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
      cache.set(key, result);
    }
    return result;
  } catch {
    return { status: 'error', reason: 'failed' };
  } finally {
    clearTimeout(timer);
  }
}
