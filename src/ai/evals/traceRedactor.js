/**
 * Civic Agent Evaluation Harness — Trace Redactor
 *
 * Ensures zero raw citizen records, PII, or credentials ever reach stored
 * evaluation traces, exports, or diagnostics. Uses the pre-inference guardrail
 * pipeline plus deep recursive key sanitization.
 */

import { analyzeAndSanitizeQuery } from '../aiGuardrailPipeline.js';
import { FORBIDDEN_PII_KEYS } from '../contracts/messageContract.js';
import { EVAL_LIMITS } from './evalContracts.js';

const SENSITIVE_KEY_PATTERN = new RegExp(
  `(${FORBIDDEN_PII_KEYS.join('|')}|phone|email|aadhaar|pan|passport|voter|address|complaintText|authorization|cookie)`,
  'i'
);

/**
 * Redacts PII and secrets from a string using deterministic guardrail rules.
 * @param {string} value
 * @returns {{ redacted: string, wasRedacted: boolean, categories: string[] }}
 */
export function redactEvaluationText(value) {
  if (typeof value !== 'string') {
    return { redacted: '', wasRedacted: false, categories: [] };
  }
  const trimmed = value.slice(0, EVAL_LIMITS.MAX_PROMPT_LENGTH);
  const res = analyzeAndSanitizeQuery(trimmed);
  return {
    redacted: res.sanitizedQuery,
    wasRedacted: res.wasRedacted,
    categories: res.redactedCategories,
  };
}

/**
 * Deeply redacts an arbitrary metadata object, dropping forbidden keys and
 * scrubbing string values.
 * @param {unknown} input
 * @param {number} depth
 * @returns {unknown}
 */
export function sanitizeTraceMetadata(input, depth = 0) {
  if (depth > 4) return '[TRUNCATED]';
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') return redactEvaluationText(input).redacted;
  if (typeof input === 'number' || typeof input === 'boolean') return input;
  if (Array.isArray(input)) {
    return input.slice(0, 20).map((item) => sanitizeTraceMetadata(item, depth + 1));
  }
  if (typeof input === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        out[k] = '[REDACTED_FIELD]';
      } else {
        out[k] = sanitizeTraceMetadata(v, depth + 1);
      }
    }
    return out;
  }
  return String(input);
}

/**
 * Builds a privacy-safe redacted execution trace for a single scenario run.
 * @param {Object} params
 * @returns {Object} Redacted trace record
 */
export function redactExecutionTrace({
  scenarioId,
  correlationId,
  rawQuery,
  rawOutput,
  hops = [],
  latencyMs = 0,
  attempts = 1,
  adapterMeta = {},
}) {
  const queryRedaction = redactEvaluationText(String(rawQuery || ''));
  const summaryText = String(rawOutput?.data?.summary || rawOutput?.summary || '');
  const titleText = String(rawOutput?.data?.title || rawOutput?.title || '');
  const summaryRedaction = redactEvaluationText(summaryText);
  const titleRedaction = redactEvaluationText(titleText);

  const safeHops = (Array.isArray(hops) ? hops : [])
    .slice(0, EVAL_LIMITS.MAX_TRACE_STEPS)
    .map((hop, idx) => ({
      step: idx + 1,
      agent: String(hop?.agent || 'unknown'),
      ok: Boolean(hop?.ok),
      schemaVersion: String(hop?.schemaVersion || '2.0'),
      attempts: Number(hop?.attempts || 1),
    }));

  const rawSources = Array.isArray(rawOutput?.data?.officialSources)
    ? rawOutput.data.officialSources
    : Array.isArray(rawOutput?.officialSources)
      ? rawOutput.officialSources
      : [];

  const citedUrls = rawSources
    .map((s) => (typeof s?.url === 'string' ? s.url : null))
    .filter(Boolean)
    .slice(0, 20);

  const redactionCategories = Array.from(
    new Set([
      ...queryRedaction.categories,
      ...summaryRedaction.categories,
      ...titleRedaction.categories,
    ])
  );

  return {
    traceId: `trace-${scenarioId}-${correlationId}`,
    scenarioId,
    correlationId,
    redactedQuery: queryRedaction.redacted,
    redactedTitle: titleRedaction.redacted,
    redactedSummary: summaryRedaction.redacted,
    redactionApplied:
      queryRedaction.wasRedacted || summaryRedaction.wasRedacted || titleRedaction.wasRedacted,
    redactedCategories: redactionCategories,
    status: String(rawOutput?.status || 'unknown'),
    grounded: Boolean(rawOutput?.grounded),
    requiresHumanApproval: Boolean(
      rawOutput?.contractMeta?.requiresHumanApproval ??
        rawOutput?.requiresHumanApproval ??
        rawOutput?.status === 'unsupported'
    ),
    citedUrls,
    hops: safeHops,
    attempts,
    latencyMs: Math.max(0, Math.round(Number(latencyMs) || 0)),
    adapterMeta: sanitizeTraceMetadata(adapterMeta),
    recordedAt: new Date().toISOString(),
  };
}
