/**
 * src/services/civicAgentSandboxService.js
 *
 * Secure Agent Sandbox engine for untrusted civic document processing (#1179).
 *
 * Design rules:
 * - Parsing runs in isolated workers with CPU, memory and time limits.
 * - Network disabled by default; filesystem access restricted to allowlisted paths.
 * - Tool code and outputs are scanned for threat signatures; blocked or redacted.
 * - Outputs are validated against the policy output schema.
 * - Deterministic rules outside LLM prompts; AI outputs are untrusted suggestions
 *   carrying full provenance.
 * - Aggregate-only results. No citizen records, credentials, raw documents or
 *   sensitive prompts are logged or returned.
 * - Explicit human approval required for high-impact actions (network access,
 *   permissive policy). Never autonomously files applications or denies benefits.
 */

import {
  CIVIC_AGENT_SANDBOX_SCHEMA_VERSION,
  CIVIC_AGENT_SANDBOX_REVIEW_DATE,
  CIVIC_AGENT_SANDBOX_STALE_AFTER_DAYS,
  CIVIC_AGENT_SANDBOX_DISCLAIMER,
  SANDBOX_THREATS,
  getPolicy,
  getTool,
  getDocument
} from '../data/civicAgentSandboxData.js';

export const AGENT_SANDBOX_STORAGE_KEY = 'civicbridge_agent_sandbox_run_v1';

export const SANDBOX_STATUS = Object.freeze({
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  BLOCKED: 'blocked',
  FAILED: 'failed',
  REVOKED: 'revoked'
});

export const SANDBOX_ERRORS = Object.freeze({
  INVALID_REQUEST: 'AS_INVALID_REQUEST',
  INVALID_TYPE: 'AS_INVALID_TYPE',
  POLICY_NOT_FOUND: 'AS_POLICY_NOT_FOUND',
  TOOL_NOT_FOUND: 'AS_TOOL_NOT_FOUND',
  DOCUMENT_NOT_FOUND: 'AS_DOCUMENT_NOT_FOUND',
  THREAT_DETECTED: 'AS_THREAT_DETECTED',
  VALIDATION_FAILED: 'AS_VALIDATION_FAILED',
  SENSITIVE_FIELD: 'AS_SENSITIVE_FIELD',
  SENSITIVE_VALUE: 'AS_SENSITIVE_VALUE',
  PERMISSION_DENIED: 'AS_PERMISSION_DENIED',
  RESOURCE_LIMIT_EXCEEDED: 'AS_RESOURCE_LIMIT_EXCEEDED',
  STALE_DATA: 'AS_STALE_DATA',
  STORAGE_UNAVAILABLE: 'AS_STORAGE_UNAVAILABLE',
  CONCURRENT_WRITE: 'AS_CONCURRENT_WRITE'
});

const MAX_INPUT_BYTES = 64 * 1024;
const MAX_CONCURRENT_RUNS = 10;

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|otp|one.?time|token|secret|credential|api.?key|private.?key|aadhaar.?number|aadhaar.?no|pan.?number|document.?content|file.?content|file.?data|base64|biometric|passphrase|authorization|salary|income.?amount|mobile.?number|phone.?number)/i;

const AADHAAR_NUMBER_PATTERN = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_NUMBER_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;
const OTP_PATTERN = /\b(?:otp|one[- ]time password)\b\s*[:#-]?\s*\d{4,8}\b/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isSlug = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 120 && SLUG_PATTERN.test(value);

const unique = (items) => Array.from(new Set(items));

function findSensitiveKeys(value, path = '', depth = 0, found = []) {
  if (depth > 8) return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => findSensitiveKeys(item, `${path}[${index}]`, depth + 1, found));
    return found;
  }
  if (!isObject(value)) return found;
  for (const [key, child] of Object.entries(value)) {
    const where = path ? `${path}.${key}` : key;
    if (SENSITIVE_KEY_PATTERN.test(key)) found.push(where);
    findSensitiveKeys(child, where, depth + 1, found);
  }
  return found;
}

function collectSensitiveText(value, path = '', depth = 0, found = []) {
  if (depth > 8) return found;
  if (typeof value === 'string') {
    if (AADHAAR_NUMBER_PATTERN.test(value)) found.push(`${path}: Aadhaar-like number`);
    else if (PAN_NUMBER_PATTERN.test(value)) found.push(`${path}: PAN-like number`);
    else if (OTP_PATTERN.test(value)) found.push(`${path}: OTP-like value`);
    return found;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectSensitiveText(item, `${path}[${index}]`, depth + 1, found));
    return found;
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      collectSensitiveText(child, path ? `${path}.${key}` : key, depth + 1, found);
    }
  }
  return found;
}

/**
 * Validate a sandbox request at the trust boundary. Both client and server call
 * this so malformed or unsafe requests fail identically.
 */
export function validateSandboxRequest(input = {}, { requirePolicy = true } = {}) {
  const errors = [];
  const fail = (field, code, message) => errors.push({ field, code, message });

  if (!isObject(input)) {
    return {
      valid: false,
      errors: [{ field: '(request)', code: SANDBOX_ERRORS.INVALID_TYPE, message: 'Request must be a JSON object.' }]
    };
  }

  const sensitiveKeys = findSensitiveKeys(input);
  for (const where of sensitiveKeys) {
    fail(where, SANDBOX_ERRORS.SENSITIVE_FIELD, 'Do not send passwords, OTPs, document numbers, income amounts or phone numbers.');
  }
  const sensitiveText = collectSensitiveText(input);
  for (const where of sensitiveText) {
    fail(where, SANDBOX_ERRORS.SENSITIVE_VALUE, 'Remove identity numbers, OTPs, income amounts and phone numbers from the request.');
  }

  if (input.toolId !== undefined && !isSlug(input.toolId)) {
    fail('toolId', SANDBOX_ERRORS.INVALID_TYPE, 'toolId must be a lowercase slug.');
  }
  if (requirePolicy && input.toolId) {
    const tool = getTool(input.toolId);
    if (!tool) {
      fail('toolId', SANDBOX_ERRORS.TOOL_NOT_FOUND, `Unknown tool id "${input.toolId}".`);
    }
  }

  if (input.policyId !== undefined && !isSlug(input.policyId)) {
    fail('policyId', SANDBOX_ERRORS.INVALID_TYPE, 'policyId must be a lowercase slug.');
  }
  if (input.policyId && !getPolicy(input.policyId)) {
    fail('policyId', SANDBOX_ERRORS.POLICY_NOT_FOUND, `Unknown policy id "${input.policyId}".`);
  }

  if (input.documentId !== undefined && !isSlug(input.documentId)) {
    fail('documentId', SANDBOX_ERRORS.INVALID_TYPE, 'documentId must be a lowercase slug.');
  }
  if (input.documentId && !getDocument(input.documentId)) {
    fail('documentId', SANDBOX_ERRORS.DOCUMENT_NOT_FOUND, `Unknown document id "${input.documentId}".`);
  }

  if (input.inputData !== undefined) {
    if (typeof input.inputData !== 'string' || input.inputData.length > MAX_INPUT_BYTES) {
      fail('inputData', SANDBOX_ERRORS.INVALID_TYPE, `inputData must be a string up to ${MAX_INPUT_BYTES} bytes.`);
    } else {
      const sensitiveText = collectSensitiveText(input.inputData);
      for (const where of sensitiveText) {
        fail(`inputData.${where}`, SANDBOX_ERRORS.SENSITIVE_VALUE, 'Remove identity numbers and OTPs from input data.');
      }
    }
  }

  if (input.networkAllowed !== undefined && typeof input.networkAllowed !== 'boolean') {
    fail('networkAllowed', SANDBOX_ERRORS.INVALID_TYPE, 'networkAllowed must be a boolean.');
  }

  if (input.humanApproved !== undefined && typeof input.humanApproved !== 'boolean') {
    fail('humanApproved', SANDBOX_ERRORS.INVALID_TYPE, 'humanApproved must be a boolean.');
  }

  if (input.concurrentRuns !== undefined) {
    if (!Number.isInteger(input.concurrentRuns) || input.concurrentRuns < 1 || input.concurrentRuns > MAX_CONCURRENT_RUNS) {
      fail('concurrentRuns', SANDBOX_ERRORS.INVALID_TYPE, `concurrentRuns must be an integer between 1 and ${MAX_CONCURRENT_RUNS}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Scan tool code / manifest and inputs for threat signatures.
 * Returns { threats, blocked, redacted, safe }.
 */
export function scanForThreats({ toolId, inputData, output, policy } = {}) {
  const threats = [];
  let blocked = false;
  let redacted = false;

  const scanTarget = (label, text) => {
    if (typeof text !== 'string') return;
    for (const threat of SANDBOX_THREATS) {
      if (threat.pattern.test(text)) {
        threats.push({
          threatId: threat.id,
          threatName: threat.name,
          severity: threat.severity,
          action: threat.action,
          detectedIn: label,
          description: threat.description
        });
        if (threat.action === 'block') blocked = true;
        if (threat.action === 'redact') redacted = true;
      }
    }
  };

  if (toolId) {
    const tool = getTool(toolId);
    if (tool) scanTarget('tool.manifest', JSON.stringify(tool));
  }
  if (inputData) scanTarget('input.data', inputData);
  if (output) scanTarget('output.data', JSON.stringify(output));

  // Policy-level network gating: if network disabled and a network call pattern
  // appears in input/tool, treat as blocked threat.
  if (policy && policy.networkAllowed === false) {
    const networkPattern = /fetch\s*\(|XMLHttpRequest|\.open\s*\(/i;
    if (inputData && networkPattern.test(inputData)) {
      threats.push({
        threatId: 'threat-network-call',
        threatName: 'Unauthorized Network Access',
        severity: 'high',
        action: 'block',
        detectedIn: 'input.data',
        description: 'Tool attempts network access when network is disabled by policy.'
      });
      blocked = true;
    }
    if (toolId) {
      const tool = getTool(toolId);
      if (tool && tool.networkRequired && !policy.networkAllowed) {
        threats.push({
          threatId: 'threat-network-call',
          threatName: 'Unauthorized Network Access',
          severity: 'high',
          action: 'block',
          detectedIn: 'tool.manifest',
          description: 'Tool requires network but the selected policy disables network access.'
        });
        blocked = true;
      }
    }
  }

  return { threats, blocked, redacted, safe: threats.length === 0 };
}

/**
 * Validate output against the policy output schema and size limit.
 */
export function validateSandboxOutput(output, policy) {
  const errors = [];
  if (!isObject(output)) {
    errors.push({ field: 'output', code: SANDBOX_ERRORS.VALIDATION_FAILED, message: 'Sandbox output must be a JSON object.' });
    return { valid: false, errors };
  }
  const schema = policy.outputSchema;
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in output)) {
        errors.push({ field, code: SANDBOX_ERRORS.VALIDATION_FAILED, message: `Output missing required field "${field}".` });
      }
    }
  }
  const serialized = JSON.stringify(output);
  const outputBytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(serialized).byteLength : serialized.length;
  if (outputBytes > (policy.maxOutputSizeKB || 64) * 1024) {
    errors.push({ field: 'output', code: SANDBOX_ERRORS.RESOURCE_LIMIT_EXCEEDED, message: 'Sandbox output exceeds the policy size limit.' });
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Redact potential PII from output values.
 */
function redactPii(value) {
  if (typeof value === 'string') {
    return value
      .replace(AADHAAR_NUMBER_PATTERN, '[REDACTED_AADHAAR]')
      .replace(PAN_NUMBER_PATTERN, '[REDACTED_PAN]')
      .replace(OTP_PATTERN, '[REDACTED_OTP]');
  }
  if (Array.isArray(value)) return value.map(redactPii);
  if (isObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactPii(v);
    return out;
  }
  return value;
}

/**
 * Enforce resource limits deterministically. Returns { ok, limited, reason }.
 */
export function enforceResourceLimits({ policy, cpuEstimateMs, memoryEstimateMB, timeEstimateMs } = {}) {
  const limited = [];
  if (cpuEstimateMs != null && cpuEstimateMs > policy.cpuLimitMs) {
    limited.push({ resource: 'cpu', limit: policy.cpuLimitMs, requested: cpuEstimateMs });
  }
  if (memoryEstimateMB != null && memoryEstimateMB > policy.memoryLimitMB) {
    limited.push({ resource: 'memory', limit: policy.memoryLimitMB, requested: memoryEstimateMB });
  }
  if (timeEstimateMs != null && timeEstimateMs > policy.timeLimitMs) {
    limited.push({ resource: 'time', limit: policy.timeLimitMs, requested: timeEstimateMs });
  }
  return {
    ok: limited.length === 0,
    limited,
    reason: limited.length > 0 ? `Requested resources exceed policy ${policy.id} limits.` : null
  };
}

/**
 * Run a tool inside the sandbox. This is the deterministic orchestration layer.
 * It never executes raw tool code; it simulates the worker boundary and applies
 * policy, threat scanning, output validation and redaction.
 */
export function runSandboxTool({
  runId,
  toolId,
  policyId,
  documentId,
  inputData = '',
  networkAllowed = false,
  humanApproved = false,
  today = new Date()
} = {}) {
  const validation = validateSandboxRequest(
    { toolId, policyId, documentId, inputData, networkAllowed, humanApproved },
    { requirePolicy: true }
  );
  if (!validation.valid) {
    // Preserve specific not-found codes from validation.
    const notFound = validation.errors.find(
      (e) => e.code === SANDBOX_ERRORS.TOOL_NOT_FOUND || e.code === SANDBOX_ERRORS.POLICY_NOT_FOUND || e.code === SANDBOX_ERRORS.DOCUMENT_NOT_FOUND
    );
    if (notFound) {
      return { ok: false, error: { code: notFound.code, message: notFound.message }, errors: validation.errors };
    }
    return { ok: false, error: { code: SANDBOX_ERRORS.VALIDATION_FAILED, message: 'The sandbox request is not valid.' }, errors: validation.errors };
  }

  const tool = getTool(toolId);
  if (!tool) {
    return { ok: false, error: { code: SANDBOX_ERRORS.TOOL_NOT_FOUND, message: 'Unknown tool id.' }, errors: [{ field: 'toolId', code: SANDBOX_ERRORS.TOOL_NOT_FOUND, message: 'Unknown tool id.' }] };
  }

  const policy = getPolicy(policyId || tool.defaultPolicyId);
  if (!policy) {
    return { ok: false, error: { code: SANDBOX_ERRORS.POLICY_NOT_FOUND, message: 'Unknown policy id.' }, errors: [{ field: 'policyId', code: SANDBOX_ERRORS.POLICY_NOT_FOUND, message: 'Unknown policy id.' }] };
  }

  // High-impact actions require explicit human approval.
  if (policy.networkAllowed || tool.networkRequired || policy.riskLevel === 'low') {
    if (!humanApproved) {
      return {
        ok: false,
        error: { code: SANDBOX_ERRORS.PERMISSION_DENIED, message: 'This policy requires explicit human approval before execution.' },
        errors: [{ field: 'humanApproved', code: SANDBOX_ERRORS.PERMISSION_DENIED, message: 'Explicit human approval required for this policy.' }]
      };
    }
  }

  // Network gating: network allowed only under approved policy + approved endpoints.
  if (networkAllowed && (!policy.networkAllowed || !humanApproved)) {
    return {
      ok: false,
      error: { code: SANDBOX_ERRORS.PERMISSION_DENIED, message: 'Network access is disabled by policy and requires human approval.' },
      errors: [{ field: 'networkAllowed', code: SANDBOX_ERRORS.PERMISSION_DENIED, message: 'Network access requires an approved policy and human approval.' }]
    };
  }

  // Threat scan on tool manifest + input.
  const preScan = scanForThreats({ toolId, inputData, policy });
  if (preScan.blocked) {
    return {
      ok: false,
      error: { code: SANDBOX_ERRORS.THREAT_DETECTED, message: 'A threat was detected and the run is blocked.' },
      threats: preScan.threats,
      blocked: true
    };
  }

  // Resource limit enforcement (deterministic estimates from tool manifest).
  const resourceEstimates = {
    'tool-pdf-text-extractor': { cpuEstimateMs: 2000, memoryEstimateMB: 40, timeEstimateMs: 4000 },
    'tool-docx-converter': { cpuEstimateMs: 3000, memoryEstimateMB: 60, timeEstimateMs: 6000 },
    'tool-image-ocr': { cpuEstimateMs: 8000, memoryEstimateMB: 90, timeEstimateMs: 12000 },
    'tool-civic-form-parser': { cpuEstimateMs: 1500, memoryEstimateMB: 30, timeEstimateMs: 3000 },
    'tool-govt-endpoint-fetcher': { cpuEstimateMs: 5000, memoryEstimateMB: 50, timeEstimateMs: 20000 }
  };
  const estimate = resourceEstimates[toolId] || { cpuEstimateMs: 1000, memoryEstimateMB: 30, timeEstimateMs: 5000 };
  const resources = enforceResourceLimits({ policy, ...estimate });
  if (!resources.ok) {
    return {
      ok: false,
      error: { code: SANDBOX_ERRORS.RESOURCE_LIMIT_EXCEEDED, message: resources.reason },
      limited: resources.limited
    };
  }

  // Deterministic simulated output (no real parser execution; illustrative only).
  const rawOutput = {
    toolId,
    policyId,
    documentId: documentId || null,
    result: `Processed ${toolId} for ${documentId || 'unknown document'} under ${policy.id}.`,
    executedAt: today.toISOString(),
    schemaVersion: CIVIC_AGENT_SANDBOX_SCHEMA_VERSION,
    illustrative: true,
    noCitizenData: true,
    resourcesUsed: {
      cpuMs: estimate.cpuEstimateMs,
      memoryMB: estimate.memoryEstimateMB,
      timeMs: estimate.timeEstimateMs
    },
    networkUsed: Boolean(networkAllowed && policy.networkAllowed)
  };

  // Post-run threat scan on output.
  const postScan = scanForThreats({ toolId, output: rawOutput, policy });
  let finalOutput = rawOutput;
  if (postScan.redacted) {
    finalOutput = redactPii(rawOutput);
  }
  if (postScan.blocked) {
    return {
      ok: false,
      error: { code: SANDBOX_ERRORS.THREAT_DETECTED, message: 'A threat was detected in the sandbox output.' },
      threats: postScan.threats,
      blocked: true
    };
  }

  // Output validation against policy schema.
  const outputValidation = validateSandboxOutput(finalOutput, policy);
  if (!outputValidation.valid) {
    return { ok: false, error: { code: SANDBOX_ERRORS.VALIDATION_FAILED, message: 'Sandbox output failed validation.' }, errors: outputValidation.errors };
  }

  const isStale = isSandboxDataStale(today);

  return {
    ok: true,
    run: {
      runId: runId || `sandbox-${Date.now()}`,
      toolId,
      toolName: tool.name,
      policyId: policy.id,
      policyName: policy.name,
      documentId: documentId || null,
      status: SANDBOX_STATUS.COMPLETED,
      output: finalOutput,
      threats: unique([...preScan.threats, ...postScan.threats].map((t) => t.threatId)),
      threatCount: unique([...preScan.threats, ...postScan.threats].map((t) => t.threatId)).length,
      redacted: postScan.redacted,
      humanApproved,
      networkUsed: Boolean(networkAllowed && policy.networkAllowed),
      provenance: tool.provenance,
      policyVersion: policy.version,
      schemaVersion: CIVIC_AGENT_SANDBOX_SCHEMA_VERSION,
      dataVersion: CIVIC_AGENT_SANDBOX_REVIEW_DATE,
      reviewedAt: CIVIC_AGENT_SANDBOX_REVIEW_DATE,
      isStale,
      resourcesUsed: finalOutput.resourcesUsed,
      disclaimer: CIVIC_AGENT_SANDBOX_DISCLAIMER,
  illustrative: true,
  noIndividualPrediction: true,
  noCitizenData: true,
  untrusted: true,
  requiresHumanReview: true
    },
    scan: {
      pre: preScan.threats,
      post: postScan.threats,
      blocked: preScan.blocked || postScan.blocked,
      redacted: postScan.redacted
    }
  };
}

/**
 * Save a named sandbox run record (non-sensitive metadata only) to browser
 * storage. Returns { ok } or { ok: false, errors }.
 */
export function saveSandboxRun({ runId, toolId, policyId, status, summary } = {}) {
  const validation = validateSandboxRequest({ toolId, policyId });
  if (!validation.valid) return { ok: false, errors: validation.errors };
  if (typeof localStorage === 'undefined') {
    return { ok: false, errors: [{ code: SANDBOX_ERRORS.STORAGE_UNAVAILABLE, message: 'Browser storage is unavailable.' }] };
  }
  try {
    const stored = readSandboxRuns();
    stored[runId] = {
      runId,
      toolId,
      policyId,
      status: status || SANDBOX_STATUS.COMPLETED,
      summary: summary || '',
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(AGENT_SANDBOX_STORAGE_KEY, JSON.stringify(stored));
    return { ok: true };
  } catch {
    return { ok: false, errors: [{ code: SANDBOX_ERRORS.STORAGE_UNAVAILABLE, message: 'Run record could not be saved.' }] };
  }
}

function readSandboxRuns() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(AGENT_SANDBOX_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function loadSandboxRun(runId) {
  if (!isSlug(runId)) return null;
  return readSandboxRuns()[runId] || null;
}

export function listSandboxRuns() {
  return Object.values(readSandboxRuns());
}

function isSandboxDataStale(today = new Date()) {
  const age = daysBetween(CIVIC_AGENT_SANDBOX_REVIEW_DATE, todayIso(today));
  return age !== null && age > CIVIC_AGENT_SANDBOX_STALE_AFTER_DAYS;
}

function daysBetween(fromIso, toIsoValue) {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIsoValue}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.floor((to - from) / 86400000);
}

function todayIso(today) {
  if (today instanceof Date && !Number.isNaN(today.getTime())) return today.toISOString().slice(0, 10);
  if (typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today)) return today;
  return new Date().toISOString().slice(0, 10);
}

export function buildSandboxReport(result) {
  if (!result || result.ok !== true) return 'No sandbox run result to report.';
  const { run, scan } = result;
  const lines = [];
  lines.push('SECURE AGENT SANDBOX RUN REPORT (illustrative, untrusted)');
  lines.push(`Tool: ${run.toolName} (${run.toolId})`);
  lines.push(`Policy: ${run.policyName} (${run.policyId})`);
  lines.push(`Status: ${run.status} | Version: ${run.schemaVersion} | Reproducibility: ${run.runId}`);
  lines.push('');
  lines.push('OUTPUT');
  lines.push(JSON.stringify(run.output, null, 2));
  lines.push('');
  lines.push('THREAT SCAN');
  lines.push(`- Pre-run threats: ${scan.pre.length}`);
  lines.push(`- Post-run threats: ${scan.post.length}`);
  lines.push(`- Blocked: ${scan.blocked} | Redacted: ${scan.redacted}`);
  lines.push(`- Human approved: ${run.humanApproved} | Network used: ${run.networkUsed}`);
  lines.push('');
  lines.push(run.disclaimer);
  return lines.join('\n');
}

export const __testables = {
  validateSandboxRequest,
  scanForThreats,
  validateSandboxOutput,
  redactPii,
  enforceResourceLimits,
  runSandboxTool,
  isSandboxDataStale,
  computeDigest: (inputs) => {
    let hash = 0;
    const canonical = JSON.stringify(inputs);
    for (let i = 0; i < canonical.length; i++) {
      hash = (hash << 5) - hash + canonical.charCodeAt(i);
      hash = hash & hash;
    }
    return `as-${Math.abs(hash).toString(16).padStart(8, '0')}`;
  },
  SANDBOX_ERRORS,
  SANDBOX_STATUS
};
