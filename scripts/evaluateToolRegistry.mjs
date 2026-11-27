/**
 * Reproducible Security & Boundary Evaluation Script for Governed Tool Registry (#1146)
 *
 * Runs deterministic adversarial checks using synthetic fixtures only and writes
 * docs/evaluation-tool-registry-report.md with exact pass/fail evidence.
 */

import { writeFileSync } from 'node:fs';
import { createGovernedToolRegistry } from '../src/services/toolRegistry/governedToolRegistry.js';
import { ERROR_CODES, TOOL_SCOPES } from '../src/services/toolRegistry/toolContracts.js';
import {
  SYNTHETIC_ACTORS,
  SYNTHETIC_ARGS,
  SYNTHETIC_PROVENANCE,
  SYNTHETIC_SIGNING_SECRET,
} from '../src/services/toolRegistry/__fixtures__/syntheticToolFixtures.js';

async function runEvaluation() {
  let nowMs = 1_760_000_000_000;
  const registry = createGovernedToolRegistry({
    secret: SYNTHETIC_SIGNING_SECRET,
    now: () => nowMs,
  });

  const checks = [];

  async function recordCheck(id, category, fn) {
    const start = Date.now();
    const passed = await fn();
    checks.push({
      id,
      category,
      passed: Boolean(passed),
      durationMs: Date.now() - start,
    });
  }

  await recordCheck('EVAL-01: Default-deny unknown tool', 'Boundary', async () => {
    const r = await registry.invokeTool({
      capabilityToken: 'ctok_v1.a.b',
      toolName: 'unknownDangerousTool',
      args: {},
      ...SYNTHETIC_ACTORS.CITIZEN_A,
    });
    return !r.ok && r.code === ERROR_CODES.UNKNOWN_TOOL;
  });

  await recordCheck('EVAL-02: Privilege escalation blocked', 'Authorization', async () => {
    const r = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'lookupServiceDetails',
      requestedScopes: [TOOL_SCOPES.CATALOGUE_READ, TOOL_SCOPES.REGISTRY_ADMIN],
    });
    return !r.ok && r.code === ERROR_CODES.SCOPE_DENIED;
  });

  await recordCheck('EVAL-03: Replay & concurrent race blocked', 'Replay', async () => {
    const cap = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'lookupServiceDetails',
      singleUse: true,
    });
    const [a, b] = await Promise.all([
      registry.invokeTool({
        capabilityToken: cap.capabilityToken,
        toolName: 'lookupServiceDetails',
        args: SYNTHETIC_ARGS.VALID_LOOKUP,
        ...SYNTHETIC_ACTORS.CITIZEN_A,
      }),
      registry.invokeTool({
        capabilityToken: cap.capabilityToken,
        toolName: 'lookupServiceDetails',
        args: SYNTHETIC_ARGS.VALID_LOOKUP,
        ...SYNTHETIC_ACTORS.CITIZEN_A,
      }),
    ]);
    return [a, b].filter((x) => x.ok).length === 1 && [a, b].some((x) => x.code === ERROR_CODES.CAPABILITY_REPLAYED);
  });

  await recordCheck('EVAL-04: Cross-user token reuse blocked', 'Isolation', async () => {
    const cap = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'lookupServiceDetails',
    });
    const r = await registry.invokeTool({
      capabilityToken: cap.capabilityToken,
      toolName: 'lookupServiceDetails',
      args: SYNTHETIC_ARGS.VALID_LOOKUP,
      ...SYNTHETIC_ACTORS.CITIZEN_B,
    });
    return !r.ok && r.code === ERROR_CODES.CROSS_USER_DENIED;
  });

  await recordCheck('EVAL-05: Malformed JSON Schema & prototype pollution rejected', 'Validation', async () => {
    const cap = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'lookupServiceDetails',
      singleUse: false,
    });
    const badExtra = await registry.invokeTool({
      capabilityToken: cap.capabilityToken,
      toolName: 'lookupServiceDetails',
      args: SYNTHETIC_ARGS.MALFORMED_EXTRA_PROP,
      ...SYNTHETIC_ACTORS.CITIZEN_A,
    });
    const badProto = await registry.invokeTool({
      capabilityToken: cap.capabilityToken,
      toolName: 'lookupServiceDetails',
      args: JSON.parse('{"serviceId":"ration-card","__proto__":{"x":1}}'),
      ...SYNTHETIC_ACTORS.CITIZEN_A,
    });
    return badExtra.code === ERROR_CODES.INVALID_SCHEMA && badProto.code === ERROR_CODES.SENSITIVE_DATA_DENIED;
  });

  await recordCheck('EVAL-06: Expiry enforcement', 'TTL', async () => {
    const cap = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'lookupServiceDetails',
      ttlSeconds: 15,
    });
    nowMs += 20_000;
    const r = await registry.invokeTool({
      capabilityToken: cap.capabilityToken,
      toolName: 'lookupServiceDetails',
      args: SYNTHETIC_ARGS.VALID_LOOKUP,
      ...SYNTHETIC_ACTORS.CITIZEN_A,
    });
    return !r.ok && r.code === ERROR_CODES.CAPABILITY_EXPIRED;
  });

  await recordCheck('EVAL-07: Human approval & provenance gating', 'Governance', async () => {
    const cap = registry.issueCapability({
      ...SYNTHETIC_ACTORS.ADMIN_MOD,
      toolName: 'scheduleGrievanceFollowUp',
      humanApproved: true,
    });
    const missingProv = await registry.invokeTool({
      capabilityToken: cap.capabilityToken,
      toolName: 'scheduleGrievanceFollowUp',
      args: SYNTHETIC_ARGS.VALID_REMINDER,
      ...SYNTHETIC_ACTORS.ADMIN_MOD,
      humanApproved: true,
      provenance: SYNTHETIC_PROVENANCE.INVALID,
    });
    const withProv = await registry.invokeTool({
      capabilityToken: cap.capabilityToken,
      toolName: 'scheduleGrievanceFollowUp',
      args: SYNTHETIC_ARGS.VALID_REMINDER,
      ...SYNTHETIC_ACTORS.ADMIN_MOD,
      humanApproved: true,
      provenance: SYNTHETIC_PROVENANCE.VALID,
    });
    return missingProv.code === ERROR_CODES.PROVENANCE_REQUIRED && withProv.ok;
  });

  await recordCheck('EVAL-08: Admin revocation & PII-free audit trail', 'Operations', async () => {
    const cap = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'searchCivicFaq',
    });
    await registry.invokeTool({
      capabilityToken: cap.capabilityToken,
      toolName: 'searchCivicFaq',
      args: SYNTHETIC_ARGS.SENSITIVE_AADHAAR_TEXT,
      ...SYNTHETIC_ACTORS.CITIZEN_A,
    });
    registry.revokeTool('searchCivicFaq', { actorId: SYNTHETIC_ACTORS.ADMIN_MOD.actorUserId, reason: 'Eval revoke' });
    const afterRevoke = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'searchCivicFaq',
    });
    const auditJson = JSON.stringify(registry.getAuditEvents({ limit: 50 }));
    return (
      afterRevoke.code === ERROR_CODES.TOOL_REVOKED &&
      !auditJson.includes('2345 6789 0123') &&
      !auditJson.includes('ctok_v1.')
    );
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const metrics = registry.getMetrics();
  const report = [
    '# Governed Agent Tool Registry — Evaluation Report (#1146)',
    '',
    `- **Command:** \`npm run eval:tool-registry\``,
    `- **Fixtures:** Strictly synthetic (\`src/services/toolRegistry/__fixtures__/syntheticToolFixtures.js\`)`,
    `- **Score:** ${passedCount}/${checks.length} security & governance checks passed`,
    '',
    '## Check Results',
    '',
    '| Check | Category | Result |',
    '|---|---|---|',
    ...checks.map((c) => `| ${c.id} | ${c.category} | ${c.passed ? 'PASS' : 'FAIL'} |`),
    '',
    '## Aggregate Registry Telemetry Snapshot (PII-Free)',
    '',
    `- Capabilities Issued: ${metrics.issuedCapabilities}`,
    `- Allowed Invocations: ${metrics.allowedInvocations}`,
    `- Denied Invocations: ${metrics.deniedInvocations}`,
    `- Replays Blocked: ${metrics.replayBlocked}`,
    `- Cross-User Blocked: ${metrics.crossUserBlocked}`,
    `- Privilege Escalations Blocked: ${metrics.privilegeEscalationBlocked}`,
    `- Schema Violations Rejected: ${metrics.schemaRejected}`,
    `- Revocations Enforced: ${metrics.revocationBlocked}`,
    '',
  ].join('\n');

  writeFileSync(new URL('../docs/evaluation-tool-registry-report.md', import.meta.url), report, 'utf8');
  console.log(`Tool Registry Evaluation: ${passedCount}/${checks.length} checks passed.`);
  if (passedCount !== checks.length) {
    process.exitCode = 1;
  }
}

runEvaluation();
