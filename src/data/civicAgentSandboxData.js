/**
 * src/data/civicAgentSandboxData.js
 *
 * Versioned, privacy-safe synthetic dataset for the Secure Agent Sandbox
 * (#1179). The sandbox runs untrusted civic document parsers / agent tools in
 * isolated workers with CPU, memory and time limits, network disabled by
 * default, restricted filesystem access, output validation and dependency
 * scanning.
 *
 * All records are synthetic fixtures with zero production PII. No credentials,
 * raw documents, Aadhaar/PAN numbers, phone numbers or sensitive prompts are
 * stored here.
 *
 * Schema version: civic-agent-sandbox-v1
 */

export const CIVIC_AGENT_SANDBOX_SCHEMA_VERSION = 'civic-agent-sandbox-v1';
export const CIVIC_AGENT_SANDBOX_REVIEW_DATE = '2026-11-21';
export const CIVIC_AGENT_SANDBOX_STALE_AFTER_DAYS = 180;
export const CIVIC_AGENT_SANDBOX_DISCLAIMER =
  'Sandbox output is illustrative and untrusted. Parser results must be validated '
  + 'and reviewed by a human before any civic action. The sandbox never executes '
  + 'embedded scripts, never accesses the network by default, and never reveals '
  + 'citizen records or credentials.';

/**
 * Sandbox policies define the resource boundary under which an agent tool runs.
 * Limits are deterministic planning figures, enforced by the sandbox engine.
 */
export const SANDBOX_POLICIES = [
  {
    id: 'policy-strict-default',
    name: 'Strict Default',
    description: 'No network, no filesystem beyond /tmp, tight CPU/memory/time limits. For untrusted third-party parsers.',
    version: '1.0.0',
    cpuLimitMs: 5000,
    memoryLimitMB: 64,
    timeLimitMs: 10000,
    networkAllowed: false,
    filesystemPaths: ['/tmp'],
    allowlistedModules: [],
    blockedPatterns: [
      /require\s*\(\s*['"]fs['"]\s*\)/,
      /require\s*\(\s*['"]child_process['"]\s*\)/,
      /require\s*\(\s*['"]net['"]\s*\)/,
      /require\s*\(\s*['"]http['"]\s*\)/,
      /require\s*\(\s*['"]https['"]\s*\)/,
      /require\s*\(\s*['"]dns['"]\s*\)/,
      /eval\s*\(/,
      /new\s+Function\s*\(/,
      /setTimeout\s*\(/,
      /setInterval\s*\(/
    ],
    outputSchema: { type: 'object', required: ['result'], additionalProperties: false },
    maxOutputSizeKB: 64,
    riskLevel: 'high',
    isDefault: true,
    isSynthetic: true
  },
  {
    id: 'policy-moderate-reviewed',
    name: 'Moderate Reviewed',
    description: 'No network, read-only access to /tmp and /var/lib/civic/sandbox. For internally reviewed parsers.',
    version: '1.0.0',
    cpuLimitMs: 15000,
    memoryLimitMB: 128,
    timeLimitMs: 30000,
    networkAllowed: false,
    filesystemPaths: ['/tmp', '/var/lib/civic/sandbox'],
    allowlistedModules: ['pdf-parse', 'mammoth'],
    blockedPatterns: [
      /require\s*\(\s*['"]child_process['"]\s*\)/,
      /require\s*\(\s*['"]net['"]\s*\)/,
      /require\s*\(\s*['"]http['"]\s*\)/,
      /require\s*\(\s*['"]https['"]\s*\)/,
      /eval\s*\(/,
      /new\s+Function\s*\(/
    ],
    outputSchema: { type: 'object', required: ['result'], additionalProperties: false },
    maxOutputSizeKB: 256,
    riskLevel: 'medium',
    isDefault: false,
    isSynthetic: true
  },
  {
    id: 'policy-permissive-admin',
    name: 'Permissive Admin',
    description: 'Network allowed only to approved civic endpoints; broader filesystem. Admin tools only. Requires explicit human approval.',
    version: '1.0.0',
    cpuLimitMs: 60000,
    memoryLimitMB: 512,
    timeLimitMs: 120000,
    networkAllowed: true,
    filesystemPaths: ['/tmp', '/var/lib/civic/sandbox', '/opt/civic/tools'],
    allowlistedModules: ['pdf-parse', 'mammoth', 'xlsx', 'cheerio'],
    blockedPatterns: [
      /require\s*\(\s*['"]child_process['"]\s*\)/,
      /eval\s*\(/,
      /new\s+Function\s*\(/
    ],
    outputSchema: { type: 'object', required: ['result'], additionalProperties: false },
    maxOutputSizeKB: 1024,
    riskLevel: 'low',
    isDefault: false,
    isSynthetic: true
  }
];

/**
 * Agent tool manifests describe each parser/tool that can run inside the
 * sandbox. The manifest is the contract; the sandbox enforces it.
 */
export const SANDBOX_TOOLS = [
  {
    id: 'tool-pdf-text-extractor',
    name: 'Civic PDF Text Extractor',
    documentType: 'pdf',
    entryPoint: 'extractText',
    allowedOperations: ['read_file', 'parse_pdf', 'extract_text'],
    resourceRequirements: { cpu: 'low', memory: 'low', time: 'short' },
    networkRequired: false,
    filesystemRequired: ['/tmp'],
    defaultPolicyId: 'policy-strict-default',
    provenance: 'Civic Help Setu reviewed module v1.0.0',
    riskNote: 'PDF parsers can embed JavaScript; execution is blocked by default.',
    isSynthetic: true
  },
  {
    id: 'tool-docx-converter',
    name: 'DOCX to Text Converter',
    documentType: 'docx',
    entryPoint: 'convertDocx',
    allowedOperations: ['read_file', 'parse_docx', 'extract_text'],
    resourceRequirements: { cpu: 'low', memory: 'low', time: 'short' },
    networkRequired: false,
    filesystemRequired: ['/tmp'],
    defaultPolicyId: 'policy-moderate-reviewed',
    provenance: 'Civic Help Setu reviewed module v1.2.0',
    riskNote: 'OOXML external entity references are stripped before parsing.',
    isSynthetic: true
  },
  {
    id: 'tool-image-ocr',
    name: 'Document OCR Reader',
    documentType: 'image',
    entryPoint: 'ocrImage',
    allowedOperations: ['read_file', 'ocr_image', 'redact_pii'],
    resourceRequirements: { cpu: 'high', memory: 'medium', time: 'medium' },
    networkRequired: false,
    filesystemRequired: ['/tmp'],
    defaultPolicyId: 'policy-moderate-reviewed',
    provenance: 'Civic Help Setu reviewed module v2.0.1',
    riskNote: 'OCR output may contain PII; results are redacted before return.',
    isSynthetic: true
  },
  {
    id: 'tool-civic-form-parser',
    name: 'Civic Form Field Parser',
    documentType: 'form',
    entryPoint: 'parseForm',
    allowedOperations: ['read_file', 'parse_form', 'validate_fields'],
    resourceRequirements: { cpu: 'medium', memory: 'low', time: 'short' },
    networkRequired: false,
    filesystemRequired: ['/tmp'],
    defaultPolicyId: 'policy-strict-default',
    provenance: 'Civic Help Setu reviewed module v1.1.0',
    riskNote: 'Deterministic rule-based parser; no embedded script execution.',
    isSynthetic: true
  },
  {
    id: 'tool-govt-endpoint-fetcher',
    name: 'Government Endpoint Fetcher',
    documentType: 'url',
    entryPoint: 'fetchEndpoint',
    allowedOperations: ['http_get', 'validate_response'],
    resourceRequirements: { cpu: 'low', memory: 'low', time: 'long' },
    networkRequired: true,
    filesystemRequired: [],
    defaultPolicyId: 'policy-permissive-admin',
    provenance: 'Civic Help Setu reviewed module v1.0.0 (admin-approved)',
    riskNote: 'Network access requires the permissive admin policy and explicit human approval.',
    isSynthetic: true
  }
];

/**
 * Threat signatures the sandbox scans for in tool code and outputs.
 */
export const SANDBOX_THREATS = [
  {
    id: 'threat-embedded-script',
    name: 'Embedded Script Execution',
    pattern: /<script\b[^>]*>[\s\S]*?<\/script>/i,
    severity: 'critical',
    action: 'block',
    description: 'Tool output or input contains an embedded script tag; execution is blocked.'
  },
  {
    id: 'threat-eval-call',
    name: 'Dynamic Code Evaluation',
    pattern: /\beval\s*\(/,
    severity: 'critical',
    action: 'block',
    description: 'Tool attempts dynamic code evaluation; blocked by sandbox policy.'
  },
  {
    id: 'threat-archive-bomb',
    name: 'Archive Bomb (Zip Bomb)',
    pattern: /zip|gzip|tar/i,
    severity: 'high',
    action: 'block',
    description: 'Compressed archive with suspiciously high compression ratio; may exhaust memory.'
  },
  {
    id: 'threat-path-traversal',
    name: 'Path Traversal',
    pattern: /\.\.\/|\\\.\\\/|%2e%2e/i,
    severity: 'high',
    action: 'block',
    description: 'Input references paths outside the allowed filesystem root.'
  },
  {
    id: 'threat-pii-leak',
    name: 'Potential PII Leak in Output',
    pattern: /\b\d{4}\s?\d{4}\s?\d{4}\b|\b[A-Z]{5}[0-9]{4}[A-Z]\b/i,
    severity: 'high',
    action: 'redact',
    description: 'Output may contain Aadhaar-like or PAN-like numbers; redacted before return.'
  },
  {
    id: 'threat-network-call',
    name: 'Unauthorized Network Access',
    pattern: /fetch\s*\(|XMLHttpRequest|\.open\s*\(/i,
    severity: 'high',
    action: 'block',
    description: 'Tool attempts network access when network is disabled by policy.'
  },
  {
    id: 'threat-denial-of-service',
    name: 'Resource Exhaustion Loop',
    pattern: /while\s*\(.*true\)|for\s*\(;;\)|\.repeat\s*\(\s*\d{6,}\s*\)/,
    severity: 'medium',
    action: 'warn',
    description: 'Tool contains a construct that may exhaust CPU or memory.'
  }
];

/**
 * Synthetic document fixtures used as safe test inputs. Zero PII.
 */
export const SANDBOX_DOCUMENTS = [
  {
    id: 'doc-synthetic-income-cert',
    name: 'Synthetic Income Certificate',
    type: 'pdf',
    mime: 'application/pdf',
    sizeBytes: 45000,
    contentHash: 'sha256:abcdef0123456789',
    isSynthetic: true,
    notes: 'No citizen data; used only for sandbox boundary tests.'
  },
  {
    id: 'doc-synthetic-caste-cert',
    name: 'Synthetic Caste Certificate',
    type: 'docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sizeBytes: 32000,
    contentHash: 'sha256:fedcba9876543210',
    isSynthetic: true,
    notes: 'No citizen data; used only for sandbox boundary tests.'
  },
  {
    id: 'doc-synthetic-ration-card',
    name: 'Synthetic Ration Card Scan',
    type: 'image',
    mime: 'image/png',
    sizeBytes: 180000,
    contentHash: 'sha256:1122334455667788',
    isSynthetic: true,
    notes: 'No citizen data; used only for sandbox boundary tests.'
  },
  {
    id: 'doc-synthetic-malformed-pdf',
    name: 'Malformed PDF Fixture',
    type: 'pdf',
    mime: 'application/pdf',
    sizeBytes: 1200,
    contentHash: 'sha256:deadbeefcafebabe',
    isSynthetic: true,
    malformed: true,
    notes: 'Truncated PDF header; tests malformed-file handling.'
  },
  {
    id: 'doc-synthetic-zip-bomb',
    name: 'Archive Bomb Fixture',
    type: 'zip',
    mime: 'application/zip',
    sizeBytes: 42,
    contentHash: 'sha256:zipbomb0000000000',
    isSynthetic: true,
    archiveBomb: true,
    notes: 'Tiny zip claiming huge uncompressed size; tests archive-bomb detection.'
  }
];

/**
 * Approved civic network endpoints (only reachable under permissive admin policy).
 */
export const APPROVED_NETWORK_ENDPOINTS = [
  {
    id: 'endpoint-civic-directory',
    url: 'https://civic.example.gov/directory/v1',
    method: 'GET',
    purpose: 'Read-only civic service directory lookup',
    approvedAt: '2026-11-20',
    isSynthetic: true
  },
  {
    id: 'endpoint-fee-schedule',
    url: 'https://civic.example.gov/fees/v1/schedule',
    method: 'GET',
    purpose: 'Read-only verified fee schedule lookup',
    approvedAt: '2026-11-20',
    isSynthetic: true
  }
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getPolicy(id) {
  return SANDBOX_POLICIES.find((p) => p.id === id) || null;
}

export function getTool(id) {
  return SANDBOX_TOOLS.find((t) => t.id === id) || null;
}

export function getDocument(id) {
  return SANDBOX_DOCUMENTS.find((d) => d.id === id) || null;
}

export function getThreat(id) {
  return SANDBOX_THREATS.find((t) => t.id === id) || null;
}

export function listPolicies() {
  return SANDBOX_POLICIES;
}

export function listTools() {
  return SANDBOX_TOOLS;
}

export function listDocuments() {
  return SANDBOX_DOCUMENTS;
}

export function listThreats() {
  return SANDBOX_THREATS;
}

export function listApprovedEndpoints() {
  return APPROVED_NETWORK_ENDPOINTS;
}

export const SANDBOX_TESTABLES = {
  getPolicy,
  getTool,
  getDocument,
  getThreat,
  listPolicies,
  listTools,
  listDocuments,
  listThreats,
  listApprovedEndpoints
};
