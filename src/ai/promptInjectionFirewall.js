/**
 * Prompt-Injection Firewall for Retrieved Civic Documents & Web Content (#1151)
 *
 * Treats all retrieved external documents (uploaded PDFs, external web pages) as
 * untrusted data:
 *  1. Validates untrusted inputs at service boundaries (versioned v1.0.0 contract).
 *  2. Normalizes obfuscated text (zero-width/bidi chars, HTML comments, hidden CSS)
 *     and inspects decoded Base64 / URL-encoded segments.
 *  3. Scans and labels suspicious passages (indirect prompt injection, encoded
 *     instructions, malicious/exfiltration links, tool hijack attempts).
 *  4. Scrubs secrets and citizen PII before any text enters model context or telemetry.
 *  5. Isolates clean passages inside non-executable provenance-tagged envelopes.
 *  6. Enforces deterministic tool allowlists and human-approval gates outside prompts.
 */

import { minimizeForExternal } from '../utils/dataMinimization.js';

export const FIREWALL_CONTRACT_VERSION = '1.0.0';

export const FIREWALL_LIMITS = Object.freeze({
  MAX_DOCUMENT_CHARS: 100_000,
  MAX_PASSAGES: 50,
  MAX_PASSAGE_CHARS: 4_000,
  MAX_DECODE_CHARS: 2_048,
});

export const SOURCE_TYPE = Object.freeze({
  TRUSTED_CATALOG: 'trusted_catalog',
  UPLOADED_PDF: 'uploaded_pdf',
  EXTERNAL_WEB: 'external_web',
});

export const PASSAGE_VERDICT = Object.freeze({
  CLEAN: 'clean',
  SUSPICIOUS: 'suspicious',
  QUARANTINED: 'quarantined',
});

export const FIREWALL_DECISION = Object.freeze({
  ALLOW: 'allow',
  PARTIAL_QUARANTINE: 'partial_quarantine',
  BLOCK: 'block',
});

export const FIREWALL_THREAT_CLASS = Object.freeze({
  INDIRECT_INJECTION: 'indirect_instruction_override',
  ENCODED_INSTRUCTION: 'encoded_instruction',
  MALICIOUS_LINK: 'malicious_link',
  TOOL_HIJACK: 'tool_hijack_attempt',
  SECRET_OR_PII: 'secret_or_pii_exposure',
  HIDDEN_MARKUP: 'hidden_markup_directive',
});

export const ALLOWED_TOOLS = Object.freeze([
  'search_civic_catalog',
  'cite_official_source',
  'request_human_review',
]);

export const HIGH_IMPACT_TOOLS = Object.freeze([
  'submit_application',
  'deny_benefit',
  'issue_official_status',
  'export_citizen_record',
  'external_webhook',
]);

const ZERO_WIDTH_AND_BIDI_REGEX = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const HTML_COMMENT_REGEX = /<!--([\s\S]*?)-->/g;
const HIDDEN_STYLE_REGEX =
  /<([a-z0-9]+)[^>]*style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|font-size\s*:\s*0)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi;

const INDIRECT_INJECTION_RULES = [
  {
    id: 'FW_INJ_OVERRIDE',
    threatClass: FIREWALL_THREAT_CLASS.INDIRECT_INJECTION,
    severity: 'high',
    reason: 'Retrieved passage contains instruction-override directive.',
    pattern:
      /\b(?:ignore|disregard|forget|bypass|override)\s+(?:all\s+)?(?:(?:previous|prior|above|system|developer|grounding|safety|verification)\s+){1,2}(?:instructions?|rules?|prompts?|guidelines?|policies|checks?)\b/i,
  },
  {
    id: 'FW_INJ_ROLE_DELIMITER',
    threatClass: FIREWALL_THREAT_CLASS.INDIRECT_INJECTION,
    severity: 'high',
    reason: 'Retrieved passage contains prompt role delimiter or system impersonation.',
    pattern: /(?:<\|im_start\|>|<\|system\|>|\[INST\]|<<SYS>>|^(?:system|developer)\s*:\s*(?:you\s+must|override|ignore|always))/im,
  },
  {
    id: 'FW_INJ_EXFIL_PROMPT',
    threatClass: FIREWALL_THREAT_CLASS.INDIRECT_INJECTION,
    severity: 'high',
    reason: 'Retrieved passage attempts to exfiltrate system prompt or internal context.',
    pattern:
      /\b(?:reveal|print|dump|leak|exfiltrate|send|post)\s+(?:the\s+|your\s+)?(?:system\s+prompt|hidden\s+instructions?|api\s+keys?|secrets?|citizen\s+records?)\b/i,
  },
  {
    id: 'FW_TOOL_HIJACK',
    threatClass: FIREWALL_THREAT_CLASS.TOOL_HIJACK,
    severity: 'high',
    reason: 'Retrieved passage attempts to trigger autonomous filing, benefit denial, or official-status claims.',
    pattern:
      /\b(?:auto[- ]?submit|execute\s+tool|call\s+function|invoke\s+webhook|approve\s+unconditionally|deny\s+benefit|declare\s+official\s+approval|grant\s+eligibility\s+without\s+verification)\b/i,
  },
];

const EXTRA_SECRET_PATTERNS = [
  {
    category: 'AADHAAR',
    pattern: /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: '[REDACTED_AADHAAR]',
  },
  {
    category: 'PAN',
    pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/gi,
    replacement: '[REDACTED_PAN]',
  },
  {
    category: 'BEARER_OR_KEY',
    pattern: /\b(?:Bearer\s+[A-Za-z0-9\-._~+/]+=*|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,})\b/g,
    replacement: '[REDACTED_SECRET]',
  },
];

const MALICIOUS_LINK_PATTERNS = [
  {
    id: 'FW_LINK_DANGEROUS_SCHEME',
    reason: 'Dangerous URI scheme (javascript:, vbscript:, or data:text/html) detected.',
    pattern: /\b(?:javascript|vbscript):|data:text\/html/i,
  },
  {
    id: 'FW_LINK_MARKDOWN_EXFIL',
    reason: 'Markdown image/link beacon with query-string exfiltration pattern detected.',
    pattern: /!\[[^\]]*\]\(https?:\/\/[^)\s]+\?(?:[^)\s]*(?:leak|exfil|token|secret|prompt|data|q)=)/i,
  },
  {
    id: 'FW_LINK_CREDENTIALED_URL',
    reason: 'Credential-bearing URL (user:pass@host) detected.',
    pattern: /https?:\/\/[^\s/@]+:[^\s/@]+@[^\s/]+/i,
  },
  {
    id: 'FW_LINK_IP_LITERAL',
    reason: 'Direct IP-literal URL detected in untrusted document.',
    pattern: /https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/|\b)/i,
  },
];

function safeDecodeBase64(token) {
  if (!token || token.length < 16 || token.length > FIREWALL_LIMITS.MAX_DECODE_CHARS) return '';
  try {
    const decoded =
      typeof atob === 'function'
        ? atob(token)
        : (globalThis.Buffer?.from(token, 'base64').toString('utf8') ?? '');
    // Only treat as text if mostly printable ASCII
    const printableRatio =
      (decoded.match(/[\x20-\x7E\s]/g) || []).length / Math.max(1, decoded.length);
    return printableRatio > 0.85 ? decoded : '';
  } catch {
    return '';
  }
}

function safeDecodeUrlSegments(text) {
  if (!/%[0-9A-Fa-f]{2}/.test(text)) return '';
  try {
    return decodeURIComponent(text.slice(0, FIREWALL_LIMITS.MAX_DECODE_CHARS));
  } catch {
    return '';
  }
}

function scrubPiiAndSecrets(text) {
  let scrubbed = minimizeForExternal(String(text || ''), {
    redactPersonal: true,
    redactSecrets: true,
  });
  const categories = new Set();

  if (scrubbed !== text) {
    categories.add('MINIMIZED_PII_OR_SECRET');
  }

  for (const detector of EXTRA_SECRET_PATTERNS) {
    const regex = new RegExp(detector.pattern.source, detector.pattern.flags);
    if (regex.test(scrubbed)) {
      categories.add(detector.category);
      scrubbed = scrubbed.replace(regex, detector.replacement);
    }
  }

  return {
    scrubbedText: scrubbed,
    redactedCategories: Array.from(categories),
  };
}

/**
 * Validates untrusted firewall scan input at service boundaries.
 */
export function validateFirewallInput(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, errors: ['Input payload must be a JSON object.'] };
  }

  if (input.contractVersion !== undefined && input.contractVersion !== FIREWALL_CONTRACT_VERSION) {
    errors.push(`Unsupported contractVersion "${String(input.contractVersion)}". Expected "${FIREWALL_CONTRACT_VERSION}".`);
  }

  const validSourceTypes = Object.values(SOURCE_TYPE);
  if (!validSourceTypes.includes(input.sourceType)) {
    errors.push(`Invalid sourceType. Expected one of: ${validSourceTypes.join(', ')}.`);
  }

  if (!input.sourceId || typeof input.sourceId !== 'string' || !input.sourceId.trim()) {
    errors.push('sourceId is required and must be a non-empty string.');
  }

  const hasContent = typeof input.content === 'string' && input.content.trim().length > 0;
  const hasPassages = Array.isArray(input.passages) && input.passages.length > 0;

  if (!hasContent && !hasPassages) {
    errors.push('Either non-empty content or a non-empty passages array is required.');
  }

  if (typeof input.content === 'string' && input.content.length > FIREWALL_LIMITS.MAX_DOCUMENT_CHARS) {
    errors.push(`content exceeds maximum length of ${FIREWALL_LIMITS.MAX_DOCUMENT_CHARS} characters.`);
  }

  if (Array.isArray(input.passages)) {
    if (input.passages.length > FIREWALL_LIMITS.MAX_PASSAGES) {
      errors.push(`passages exceeds maximum count of ${FIREWALL_LIMITS.MAX_PASSAGES}.`);
    }
    for (let i = 0; i < input.passages.length; i += 1) {
      if (typeof input.passages[i] !== 'string') {
        errors.push(`passages[${i}] must be a string.`);
        break;
      }
      if (input.passages[i].length > FIREWALL_LIMITS.MAX_PASSAGE_CHARS) {
        errors.push(`passages[${i}] exceeds maximum length of ${FIREWALL_LIMITS.MAX_PASSAGE_CHARS} characters.`);
        break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Scans a single retrieved passage for indirect injection, obfuscation,
 * malicious links, tool hijacks, and PII/secrets.
 */
export function scanRetrievedPassage(rawPassage, options = {}) {
  const passageIndex = Number.isInteger(options.index) ? options.index : 0;
  const sourceId = options.sourceId || 'unknown-source';
  const sourceType = options.sourceType || SOURCE_TYPE.EXTERNAL_WEB;
  const original = String(rawPassage || '');

  const findings = [];

  // 1. Detect zero-width / bidirectional override obfuscation
  if (ZERO_WIDTH_AND_BIDI_REGEX.test(original)) {
    findings.push({
      ruleId: 'FW_OBFUSCATION_ZW_BIDI',
      threatClass: FIREWALL_THREAT_CLASS.ENCODED_INSTRUCTION,
      severity: 'high',
      reason: 'Hidden zero-width or bidirectional Unicode control characters detected.',
    });
  }
  let normalized = original.replace(ZERO_WIDTH_AND_BIDI_REGEX, '');

  // 2. Detect & extract HTML comments and hidden CSS elements
  const hiddenFragments = [];
  normalized = normalized.replace(HTML_COMMENT_REGEX, (_, inner) => {
    hiddenFragments.push(inner);
    return ' ';
  });
  normalized = normalized.replace(HIDDEN_STYLE_REGEX, (_, _tag, inner) => {
    hiddenFragments.push(inner);
    return ' ';
  });

  if (hiddenFragments.length > 0) {
    findings.push({
      ruleId: 'FW_HIDDEN_MARKUP',
      threatClass: FIREWALL_THREAT_CLASS.HIDDEN_MARKUP,
      severity: 'medium',
      reason: 'Hidden HTML comments or invisible CSS elements stripped from retrieved content.',
    });
  }

  // 3. Scan visible normalized text + any hidden markup fragments
  const inspectionCorpus = [normalized, ...hiddenFragments];

  // Decode Base64 & URL-encoded payloads for secondary inspection
  const base64Matches = normalized.match(/\b[A-Za-z0-9+/]{20,}={0,2}\b/g) || [];
  for (const token of base64Matches.slice(0, 10)) {
    const decoded = safeDecodeBase64(token);
    if (decoded) {
      inspectionCorpus.push(decoded);
      for (const rule of INDIRECT_INJECTION_RULES) {
        if (rule.pattern.test(decoded)) {
          findings.push({
            ruleId: `${rule.id}_BASE64`,
            threatClass: FIREWALL_THREAT_CLASS.ENCODED_INSTRUCTION,
            severity: 'high',
            reason: `Base64-encoded instruction detected: ${rule.reason}`,
          });
        }
      }
    }
  }

  const urlDecoded = safeDecodeUrlSegments(normalized);
  if (urlDecoded && urlDecoded !== normalized) {
    inspectionCorpus.push(urlDecoded);
    for (const rule of INDIRECT_INJECTION_RULES) {
      if (rule.pattern.test(urlDecoded)) {
        findings.push({
          ruleId: `${rule.id}_URLENC`,
          threatClass: FIREWALL_THREAT_CLASS.ENCODED_INSTRUCTION,
          severity: 'high',
          reason: `URL-encoded instruction detected: ${rule.reason}`,
        });
      }
    }
  }

  // 4. Run direct/indirect injection & tool-hijack rules across corpus
  for (const segment of inspectionCorpus) {
    for (const rule of INDIRECT_INJECTION_RULES) {
      if (rule.pattern.test(segment) && !findings.some((f) => f.ruleId === rule.id)) {
        findings.push({
          ruleId: rule.id,
          threatClass: rule.threatClass,
          severity: rule.severity,
          reason: rule.reason,
        });
      }
    }
  }

  // 5. Scan for malicious or exfiltration links
  for (const linkRule of MALICIOUS_LINK_PATTERNS) {
    if (linkRule.pattern.test(original) || linkRule.pattern.test(normalized)) {
      findings.push({
        ruleId: linkRule.id,
        threatClass: FIREWALL_THREAT_CLASS.MALICIOUS_LINK,
        severity: 'high',
        reason: linkRule.reason,
      });
    }
  }

  // 6. Scrub secrets & citizen PII before any evidence leaves the firewall
  const { scrubbedText, redactedCategories } = scrubPiiAndSecrets(normalized.replace(/\s+/g, ' ').trim());
  if (redactedCategories.length > 0) {
    findings.push({
      ruleId: 'FW_PII_OR_SECRET_SCRUBBED',
      threatClass: FIREWALL_THREAT_CLASS.SECRET_OR_PII,
      severity: 'medium',
      reason: `Redacted sensitive categories (${redactedCategories.join(', ')}) from retrieved passage.`,
    });
  }

  const hasHighSeverity = findings.some((f) => f.severity === 'high');
  const hasAnyThreat = findings.some(
    (f) => f.threatClass !== FIREWALL_THREAT_CLASS.SECRET_OR_PII
  );

  let verdict = PASSAGE_VERDICT.CLEAN;
  if (hasHighSeverity) {
    verdict = PASSAGE_VERDICT.QUARANTINED;
  } else if (hasAnyThreat) {
    verdict = PASSAGE_VERDICT.SUSPICIOUS;
  }

  const safeEvidence = verdict === PASSAGE_VERDICT.QUARANTINED ? '' : scrubbedText;
  const isolatedBlock =
    verdict === PASSAGE_VERDICT.CLEAN
      ? `<untrusted_evidence source="${sourceId}" trust="${sourceType}" passage="${passageIndex}">\n${safeEvidence}\n</untrusted_evidence>`
      : '';

  return {
    passageIndex,
    verdict,
    findings,
    redactedCategories,
    sanitizedEvidence: safeEvidence,
    isolatedBlock,
  };
}

/**
 * Splits raw document content into bounded passages and scans the entire document.
 */
export function scanRetrievedDocument(input) {
  const startedAt = Date.now();
  const validation = validateFirewallInput(input);
  if (!validation.valid) {
    return {
      contractVersion: FIREWALL_CONTRACT_VERSION,
      valid: false,
      errors: validation.errors,
      decision: FIREWALL_DECISION.BLOCK,
      cleanPassages: [],
      quarantinedPassages: [],
      suspiciousPassages: [],
      isolatedEvidenceEnvelope: '',
      telemetryEvent: {
        contractVersion: FIREWALL_CONTRACT_VERSION,
        eventType: 'firewall_scan_rejected',
        sourceType: input?.sourceType || 'unknown',
        decision: FIREWALL_DECISION.BLOCK,
        latencyMs: Math.max(0, Date.now() - startedAt),
      },
    };
  }

  const rawPassages = Array.isArray(input.passages)
    ? input.passages
    : String(input.content)
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(0, FIREWALL_LIMITS.MAX_PASSAGES);

  const scanned = rawPassages.map((passage, index) =>
    scanRetrievedPassage(passage.slice(0, FIREWALL_LIMITS.MAX_PASSAGE_CHARS), {
      index,
      sourceId: input.sourceId,
      sourceType: input.sourceType,
    })
  );

  const cleanPassages = scanned.filter((p) => p.verdict === PASSAGE_VERDICT.CLEAN);
  const suspiciousPassages = scanned.filter((p) => p.verdict === PASSAGE_VERDICT.SUSPICIOUS);
  const quarantinedPassages = scanned.filter((p) => p.verdict === PASSAGE_VERDICT.QUARANTINED);

  let decision = FIREWALL_DECISION.ALLOW;
  if (cleanPassages.length === 0 && quarantinedPassages.length > 0) {
    decision = FIREWALL_DECISION.BLOCK;
  } else if (quarantinedPassages.length > 0 || suspiciousPassages.length > 0) {
    decision = FIREWALL_DECISION.PARTIAL_QUARANTINE;
  }

  const threatClasses = Array.from(
    new Set(scanned.flatMap((p) => p.findings.map((f) => f.threatClass)))
  );
  const redactedCategories = Array.from(
    new Set(scanned.flatMap((p) => p.redactedCategories))
  );

  const isolatedEvidenceEnvelope = buildUntrustedEvidenceEnvelope({
    sourceId: input.sourceId,
    sourceType: input.sourceType,
    cleanPassages,
  });

  return {
    contractVersion: FIREWALL_CONTRACT_VERSION,
    valid: true,
    errors: [],
    sourceId: input.sourceId,
    sourceType: input.sourceType,
    decision,
    counts: {
      total: scanned.length,
      clean: cleanPassages.length,
      suspicious: suspiciousPassages.length,
      quarantined: quarantinedPassages.length,
    },
    threatClasses,
    redactedCategories,
    cleanPassages,
    suspiciousPassages,
    quarantinedPassages,
    isolatedEvidenceEnvelope,
    telemetryEvent: {
      contractVersion: FIREWALL_CONTRACT_VERSION,
      eventType: 'firewall_scan_completed',
      sourceType: input.sourceType,
      decision,
      verdictCounts: {
        clean: cleanPassages.length,
        suspicious: suspiciousPassages.length,
        quarantined: quarantinedPassages.length,
      },
      threatClasses,
      redactedCategories,
      latencyMs: Math.max(0, Date.now() - startedAt),
    },
  };
}

/**
 * Builds an isolated, non-executable evidence envelope from clean passages only.
 */
export function buildUntrustedEvidenceEnvelope({ sourceId, sourceType, cleanPassages = [] }) {
  if (!cleanPassages.length) return '';
  const body = cleanPassages.map((p) => p.isolatedBlock).join('\n');
  return [
    `<!-- BEGIN UNTRUSTED EVIDENCE (source=${sourceId}, type=${sourceType}) -->`,
    body,
    `<!-- END UNTRUSTED EVIDENCE -->`,
  ].join('\n');
}

/**
 * Deterministic tool allowlist enforced outside model prompts.
 * High-impact actions require explicit human approval.
 */
export function enforceToolAllowlist({ toolName, humanApproved = false, approverId = null } = {}) {
  if (!toolName || typeof toolName !== 'string') {
    return {
      allowed: false,
      requiresHumanApproval: false,
      reason: 'Missing or invalid toolName.',
    };
  }

  if (ALLOWED_TOOLS.includes(toolName)) {
    return {
      allowed: true,
      requiresHumanApproval: false,
      reason: `Tool "${toolName}" is on the deterministic read-only allowlist.`,
    };
  }

  if (HIGH_IMPACT_TOOLS.includes(toolName)) {
    if (humanApproved === true && typeof approverId === 'string' && approverId.trim().length > 0) {
      return {
        allowed: true,
        requiresHumanApproval: true,
        approvedBy: approverId.trim(),
        reason: `High-impact tool "${toolName}" permitted with explicit human approval.`,
      };
    }
    return {
      allowed: false,
      requiresHumanApproval: true,
      reason: `High-impact tool "${toolName}" is blocked without explicit human approval.`,
    };
  }

  return {
    allowed: false,
    requiresHumanApproval: false,
    reason: `Tool "${toolName}" is not in the allowlist.`,
  };
}

/**
 * Treats AI/agent output as an untrusted proposal: requires citations/provenance
 * and blocks autonomous filing, benefit denial, or official-status claims.
 */
export function evaluateAssistantProposal(proposal = {}) {
  const issues = [];
  const citations = Array.isArray(proposal.citations) ? proposal.citations : [];
  if (citations.length === 0) {
    issues.push('Proposal lacks verifiable citations or provenance metadata.');
  }

  const text = String(proposal.summary || '');
  if (
    /\b(?:application\s+(?:has\s+been|is)\s+(?:submitted|filed|approved)|benefit\s+(?:is\s+)?denied|official\s+government\s+determination)\b/i.test(
      text
    ) &&
    proposal.humanApproved !== true
  ) {
    issues.push('Autonomous filing, benefit denial, or official-status claim requires human approval.');
  }

  return {
    contractVersion: FIREWALL_CONTRACT_VERSION,
    trustedProposal: issues.length === 0,
    requiresHumanApproval: issues.length > 0,
    issues,
  };
}
