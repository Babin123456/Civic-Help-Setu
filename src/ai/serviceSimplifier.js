/**
 * Plain-language summary of a service guide (#382)
 *
 * Like the rest of src/ai, this runs in the browser on the guide that is already loaded: nothing is
 * sent anywhere and no model is called (see docs/INTEGRATIONS.md). It reads three fields of the
 * record and nothing else:
 *
 *   purpose    the first sentence of `shortDescription`
 *   audience   the first line of `eligibility`
 *   next step  the first of `steps`, or else the first official source
 *
 * Formal wording is swapped for everyday words, a long sentence is split, and jargon that the
 * reviewed glossary knows is explained next to the summary. Nothing is added: a part the record
 * does not have is left out and listed in `missing`, and a record without a description gets an
 * explanation that nothing could be made, not a guess.
 *
 * The guide is never changed. The result is plain text, to be shown as React children.
 */
import { findJargonTerms } from '../data/civicGlossary';
import { sanitizePlainText } from '../utils/safeContent';

export const SIMPLIFIER_LABEL = 'AI-generated explanation';
export const SIMPLIFIER_NOTICE =
  "Made from this guide's own text only. It is not official and may leave details out. Check the official source before you apply.";

// The other src/ai helpers wait a moment as a model call would; the same short wait keeps the loading
// state real here, and callers and tests can set it to 0.
export const SIMPLIFY_LATENCY_MS = 350;
export const SIMPLIFY_TIMEOUT_MS = 4000;

const MAX_TERMS = 3;
const LONG_SENTENCE_WORDS = 24;

// Formal wording to everyday wording. Whole words only, and the meaning stays the same.
const PLAIN_WORDS = [
  ['in order to', 'to'],
  ['pursuant to', 'under'],
  ['prior to', 'before'],
  ['subsequent to', 'after'],
  ['thereafter', 'after that'],
  ['approximately', 'about'],
  ['requisite', 'needed'],
  ['additional', 'extra'],
  ['prescribed', 'required'],
  ['commences', 'starts'],
  ['commenced', 'started'],
  ['commence', 'start'],
  ['facilitate', 'help with'],
  ['ascertain', 'find out'],
  ['procure', 'get'],
  ['obtained', 'got'],
  ['obtains', 'gets'],
  ['obtain', 'get'],
  ['furnished', 'given'],
  ['furnish', 'give'],
  ['submitted', 'sent in'],
  ['submits', 'sends in'],
  ['submit', 'send in'],
  ['utilise', 'use'],
  ['utilize', 'use'],
  ['residing', 'living'],
  ['resides', 'lives'],
  ['reside', 'live'],
];

const PLAIN_PATTERNS = PLAIN_WORDS.map(([formal, plain]) => [new RegExp(`\\b${formal}\\b`, 'gi'), plain]);

const keepInitialCase = (formal, plain) => (/^[A-Z]/.test(formal) ? plain.charAt(0).toUpperCase() + plain.slice(1) : plain);

// Only real text counts: a number or object in a text field is a broken record, not something to summarise.
const cleanText = (value) => (typeof value === 'string' ? sanitizePlainText(value, { multiline: false, max: 700 }) : '');

const wordCount = (text) => (text.match(/\S+/g) || []).length;

const toEveryday = (text) =>
  PLAIN_PATTERNS.reduce((out, [pattern, plain]) => out.replace(pattern, (formal) => keepInitialCase(formal, plain)), text);

/** The first sentence, so a long paragraph is never copied across whole. */
const firstSentence = (text) => {
  const found = /^(.+?[.!?])(?=\s+[A-Z(]|$)/.exec(text);
  return (found ? found[1] : text).trim();
};

const endWithStop = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);

/** A long sentence is cut where the guide itself says ", then" or uses a semicolon. */
const splitLong = (sentence) => {
  if (wordCount(sentence) <= LONG_SENTENCE_WORDS) return sentence;
  const cut = /^(.{30,}?)(,\s+then\s+|;\s+)(.+)$/.exec(sentence);
  if (!cut) return sentence;
  const [, head, joiner, tail] = cut;
  const second = joiner.startsWith(';') ? tail.charAt(0).toUpperCase() + tail.slice(1) : `Then ${tail}`;
  return `${endWithStop(head)} ${second}`;
};

const simplifySentence = (text) => endWithStop(splitLong(toEveryday(firstSentence(cleanText(text)))));

const stepTitleAndText = (step) => {
  if (typeof step === 'string') return { title: cleanText(step), text: '' };
  if (!step || typeof step !== 'object') return { title: '', text: '' };
  return { title: cleanText(step.title), text: cleanText(step.description) };
};

const firstSource = (service) => {
  const sources = Array.isArray(service.officialSources) ? service.officialSources : [];
  const found = sources.find((s) => s && typeof s === 'object' && cleanText(s.name));
  return found ? { name: cleanText(found.name), url: typeof found.url === 'string' ? found.url : '' } : null;
};

const UNAVAILABLE_MESSAGE =
  'This guide has no description to simplify, so no summary was made and nothing has been guessed. Read the steps and the official source on this page.';

/**
 * @param {object} service A service record from the catalogue. It is only read.
 * @returns {{ status: 'ready' | 'unavailable', label: string, ... }}
 */
export function buildPlainLanguageSummary(service) {
  const record = service && typeof service === 'object' ? service : {};
  const description = cleanText(record.shortDescription);
  if (!description) {
    return { status: 'unavailable', reason: 'missing-description', label: SIMPLIFIER_LABEL, message: UNAVAILABLE_MESSAGE, missing: ['purpose', 'audience', 'nextStep'], terms: [], source: null, basedOn: [] };
  }

  const basedOn = ['shortDescription'];
  const missing = [];
  const purpose = simplifySentence(description);

  let audience = null;
  const conditions = Array.isArray(record.eligibility) ? record.eligibility.map(cleanText).filter(Boolean) : [];
  if (conditions.length > 0) {
    basedOn.push('eligibility');
    audience = simplifySentence(conditions[0]);
    if (conditions.length > 1) audience += ` The guide lists ${conditions.length - 1} more ${conditions.length === 2 ? 'condition' : 'conditions'}.`;
  } else {
    missing.push('audience');
  }

  let nextStep = null;
  const source = firstSource(record);
  const steps = Array.isArray(record.steps) ? record.steps : [];
  const first = stepTitleAndText(steps[0]);
  if (first.title) {
    basedOn.push('steps');
    nextStep = endWithStop(toEveryday(first.title));
    if (first.text) {
      const detail = simplifySentence(first.text);
      if (wordCount(detail) <= LONG_SENTENCE_WORDS) nextStep += ` ${detail}`;
    }
  } else if (source) {
    basedOn.push('officialSources');
    nextStep = `The guide does not list steps. Start from the official source: ${source.name}.`;
  } else {
    missing.push('nextStep');
  }

  const sourceText = [description, conditions[0] || '', first.title, first.text].join(' ');
  const terms = findJargonTerms(sourceText)
    .slice(0, MAX_TERMS)
    .map((item) => ({ id: item.id, term: item.term, meaning: item.simpleMeaning }));

  return { status: 'ready', label: SIMPLIFIER_LABEL, purpose, audience, nextStep, missing, terms, source, basedOn };
}

const wait = (ms, signal) =>
  new Promise((resolve) => {
    if (!(ms > 0)) return resolve();
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(id); resolve(); }, { once: true });
  });

/**
 * Same shape as askCivicAssistant: it can take a timeout, and a failure comes back as a result with a
 * status instead of a throw, so the page can always show its fallback.
 *
 * @param {object} service
 * @param {{ timeoutMs?: number, latencyMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>} status 'ready', 'unavailable', 'error' or 'cancelled'
 */
export async function simplifyService(service, options = {}) {
  const { timeoutMs = SIMPLIFY_TIMEOUT_MS, latencyMs = SIMPLIFY_LATENCY_MS, signal } = options;
  const work = (async () => {
    await wait(latencyMs, signal);
    if (signal?.aborted) return { status: 'cancelled' };
    return buildPlainLanguageSummary(service);
  })();
  let timer;
  const timeout = timeoutMs > 0
    ? new Promise((resolve) => { timer = setTimeout(() => resolve({ status: 'error', reason: 'timeout' }), timeoutMs); })
    : null;
  try {
    return await (timeout ? Promise.race([work, timeout]) : work);
  } catch {
    return { status: 'error', reason: 'failed' };
  } finally {
    clearTimeout(timer);
  }
}
