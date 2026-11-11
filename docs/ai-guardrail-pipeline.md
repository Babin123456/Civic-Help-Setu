# AI Guardrail Pipeline (Pre-Inference Redaction, Prompt-Injection Defense & Entailment Verification)

## Overview

`src/ai/aiGuardrailPipeline.js` adds a deterministic, client-side defense-in-depth guardrail pipeline across Civic-Help-Setu's consultation assistants (`askGroundedCivicAssistant`, `askCivicAssistant`, and `src/pages/Assistant.jsx`).

The pipeline enforces three ordered stages:

1. **Pre-Inference PII & Secret Scrubbing (`analyzeAndSanitizeQuery`)**
   - Reuses [`minimizeForExternal`](../src/utils/dataMinimization.js) (`redactSecrets`, `redactPersonalData`) and adds civic-financial masking for IFSC codes, bank account numbers preceded by account keywords, UPI handles, and prefixed provider tokens.
   - Replaces detected sensitive values locally with standardized placeholders (`[REDACTED_AADHAAR]`, `[REDACTED_PAN]`, `[REDACTED_PHONE]`, `[REDACTED_EMAIL]`, `[REDACTED_IFSC]`, `[REDACTED_ACCOUNT]`, `[REDACTED_UPI]`, `[REDACTED_SECRET]`, etc.).
   - Returns non-sensitive redaction metadata (`wasRedacted`, `redactedCategories`, `redactionCount`, `notice`) without retaining raw sensitive values, ensuring `chatStorage` and unsupported-query echoes never persist or echo raw PII.

2. **Deterministic Prompt-Injection Defense (`detectPromptInjection`)**
   - Screens sanitized queries before RAG retrieval, catalog matching, or fallback generation across four attack classes:
     - `instruction_override`: attempts to bypass system, grounding, safety, or official-source rules.
     - `system_prompt_extraction`: attempts to extract hidden system or developer instructions.
     - `role_manipulation`: jailbreak or unrestricted-persona switching attempts.
     - `unverified_decision_forcing`: attempts to force unconditional eligibility approvals or fabricate official fees, deadlines, or URLs.
   - Blocked inputs fail closed via `buildBlockedGuardrailResponse`, returning `status: 'blocked'`, `grounded: false`, `guardrail.decision: 'block'`, official portal links, and mandatory disclaimers without touching knowledge retrieval.

3. **Post-Synthesis Entailment Verification (`evaluateGroundedAnswerEntailment`)**
   - Normalizes retrieved evidence chunks at sentence boundaries (preventing cross-sentence negation bleed within multi-sentence catalog chunks) and invokes [`verifyAnswerEntailment`](../src/services/evidenceEntailmentVerificationService.js).
   - Attaches verification counts (`verifiedCount`, `unsupportedCount`, `contradictedCount`, `overallSupported`, `failClosedNotice`, `claims`) to grounded responses and surfaces fail-closed caution notices whenever high-risk assertions lack direct backing or contradict retrieved sources.

## Integration Points

- `src/ai/groundedCivicAssistant.js`: runs `runPreInferenceGuardrails` before retrieval, echoes only `sanitizedQuery` on unsupported queries, and runs `evaluateGroundedAnswerEntailment` on synthesized answers.
- `src/ai/civicAssistant.js`: runs `runPreInferenceGuardrails` prior to catalog/FAQ matching and `buildCivicAssistantFallback` (covering timeout paths as well).
- `src/pages/Assistant.jsx`: sanitizes outbound user messages before React state update and `saveChatHistory`, skips RAG indexing on blocked injections, and renders accessible `role="status"` / `role="note"` notices for PII redaction, blocked prompts, and entailment checks.

## Verification

Run targeted guardrail, RAG, fallback, entailment, and security tests:

```bash
npx vitest run src/ai/aiGuardrailPipeline.test.js src/ai/ragEvaluation.test.js src/ai/civicAssistantFallback.test.js src/services/evidenceEntailmentVerificationService.test.js src/pages/Assistant.test.jsx
npm run lint:security
npm run build
```
