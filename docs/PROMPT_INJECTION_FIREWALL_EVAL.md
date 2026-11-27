# Prompt-Injection Firewall Evaluation & Operations Guide

- **Contract Version:** `1.0.0`
- **Issue:** [#1151](https://github.com/GoldRay19/Civic-Help-Setu/issues/1151)

## 1. Reproducible Evaluation Command

Run the full firewall unit, red-team fixture, API integration, and UI accessibility test suite:

```bash
npx vitest run src/ai/promptInjectionFirewall.test.js tests/firewall-scan.test.js src/components/assistant/FirewallInspectionPanel.test.jsx
```

Run repository security lint and production build verification:

```bash
npm run lint:security && npm run build
```

## 2. Measurable Evaluation Criteria

| Metric | Target | Enforcement |
|---|---|---|
| **Indirect Injection Detection Rate** (red-team fixtures) | `100%` quarantined/blocked | Verified in `promptInjectionFirewall.test.js` |
| **Encoded / Obfuscated Payload Detection** (Base64, URL, zero-width/bidi) | `100%` detected | Verified in `promptInjectionFirewall.test.js` |
| **Malicious / Exfiltration Link Detection** | `100%` flagged/quarantined | Verified in `promptInjectionFirewall.test.js` |
| **Benign Civic Document False-Positive Rate** | `0%` false quarantines | Verified against synthetic benign civic PDF/web fixtures |
| **Secret & Citizen PII Leakage in Context / Telemetry** | `0` raw leaks | Asserted on `isolatedEvidence`, `telemetryEvent`, and API responses |
| **Unauthorized Tool / High-Impact Action Bypass** | `0%` (hard-denied without human approval) | Verified via `enforceToolAllowlist` & `evaluateAssistantProposal` |

## 3. Maintainer Operations

- **Adding New Threat Patterns:** Update `THREAT_RULES` in `src/ai/promptInjectionFirewall.js`, add a corresponding synthetic fixture in `src/ai/fixtures/promptInjectionRedTeamFixtures.js`, and run the evaluation command above.
- **Monitoring:** Inspect `/api/firewall-scan` `429` rates and `telemetryEvent.threatClasses` counts in server logs (no PII or raw document text is logged).
- **Incident Response:** If a new injection bypass is reported, add a regression fixture first, update the deterministic rule or decoder, verify `0%` false positives on benign fixtures, and deploy.
