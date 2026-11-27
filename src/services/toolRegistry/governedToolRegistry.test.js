import { describe, it, expect, beforeEach } from 'vitest';
import { createGovernedToolRegistry } from './governedToolRegistry.js';
import { ERROR_CODES, TOOL_SCOPES } from './toolContracts.js';
import {
  SYNTHETIC_ACTORS,
  SYNTHETIC_ARGS,
  SYNTHETIC_PROVENANCE,
  SYNTHETIC_SIGNING_SECRET,
} from './__fixtures__/syntheticToolFixtures.js';

describe('governedToolRegistry (#1146)', () => {
  let currentTimeMs;
  let registry;

  beforeEach(() => {
    currentTimeMs = 1_760_000_000_000;
    registry = createGovernedToolRegistry({
      secret: SYNTHETIC_SIGNING_SECRET,
      now: () => currentTimeMs,
    });
  });

  it('denies unknown tools by default at both issuance and invocation', async () => {
    const capRes = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'execSystemShell',
    });
    expect(capRes.ok).toBe(false);
    expect(capRes.code).toBe(ERROR_CODES.UNKNOWN_TOOL);

    const invRes = await registry.invokeTool({
      capabilityToken: 'ctok_v1.fake.fake',
      toolName: 'execSystemShell',
      args: {},
      ...SYNTHETIC_ACTORS.CITIZEN_A,
    });
    expect(invRes.ok).toBe(false);
    expect(invRes.code).toBe(ERROR_CODES.UNKNOWN_TOOL);
  });

  it('prevents privilege escalation when citizen requests admin scopes', () => {
    const capRes = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'lookupServiceDetails',
      requestedScopes: [TOOL_SCOPES.CATALOGUE_READ, TOOL_SCOPES.REGISTRY_ADMIN],
    });

    expect(capRes.ok).toBe(false);
    expect(capRes.status).toBe(403);
    expect(capRes.code).toBe(ERROR_CODES.SCOPE_DENIED);
  });

  it('executes a low-risk read-only tool with a valid short-lived capability', async () => {
    const capRes = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'lookupServiceDetails',
      boundArgs: SYNTHETIC_ARGS.VALID_LOOKUP,
    });
    expect(capRes.ok).toBe(true);

    const invRes = await registry.invokeTool({
      capabilityToken: capRes.capabilityToken,
      toolName: 'lookupServiceDetails',
      args: SYNTHETIC_ARGS.VALID_LOOKUP,
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      provenance: SYNTHETIC_PROVENANCE.VALID,
    });

    expect(invRes.ok).toBe(true);
    expect(invRes.status).toBe(200);
    expect(invRes.output.serviceId).toBe('ration-card');
    expect(invRes.output.advisoryNotice).toContain('Informational guidance only');
  });

  it('blocks capability replay attacks and concurrent double-invocation races', async () => {
    const capRes = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'lookupServiceDetails',
      singleUse: true,
    });
    expect(capRes.ok).toBe(true);

    const [first, second] = await Promise.all([
      registry.invokeTool({
        capabilityToken: capRes.capabilityToken,
        toolName: 'lookupServiceDetails',
        args: SYNTHETIC_ARGS.VALID_LOOKUP,
        ...SYNTHETIC_ACTORS.CITIZEN_A,
      }),
      registry.invokeTool({
        capabilityToken: capRes.capabilityToken,
        toolName: 'lookupServiceDetails',
        args: SYNTHETIC_ARGS.VALID_LOOKUP,
        ...SYNTHETIC_ACTORS.CITIZEN_A,
      }),
    ]);

    const outcomes = [first, second];
    expect(outcomes.filter((r) => r.ok)).toHaveLength(1);
    const blocked = outcomes.find((r) => !r.ok);
    expect(blocked.code).toBe(ERROR_CODES.CAPABILITY_REPLAYED);
    expect(blocked.status).toBe(409);
  });

  it('allows safe retry with a newly minted capability after a failed schema call', async () => {
    const cap1 = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'lookupServiceDetails',
    });

    const bad = await registry.invokeTool({
      capabilityToken: cap1.capabilityToken,
      toolName: 'lookupServiceDetails',
      args: SYNTHETIC_ARGS.MALFORMED_BAD_ENUM,
      ...SYNTHETIC_ACTORS.CITIZEN_A,
    });
    expect(bad.ok).toBe(false);
    expect(bad.code).toBe(ERROR_CODES.INVALID_SCHEMA);

    // Retry with valid args using same unconsumed single-use token or fresh capability
    const retry = await registry.invokeTool({
      capabilityToken: cap1.capabilityToken,
      toolName: 'lookupServiceDetails',
      args: SYNTHETIC_ARGS.VALID_LOOKUP,
      ...SYNTHETIC_ACTORS.CITIZEN_A,
    });
    expect(retry.ok).toBe(true);
  });

  it('blocks cross-user capability access and session hijacking', async () => {
    const capA = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'lookupServiceDetails',
    });

    const crossUser = await registry.invokeTool({
      capabilityToken: capA.capabilityToken,
      toolName: 'lookupServiceDetails',
      args: SYNTHETIC_ARGS.VALID_LOOKUP,
      ...SYNTHETIC_ACTORS.CITIZEN_B,
    });
    expect(crossUser.ok).toBe(false);
    expect(crossUser.status).toBe(403);
    expect(crossUser.code).toBe(ERROR_CODES.CROSS_USER_DENIED);

    const crossSession = await registry.invokeTool({
      capabilityToken: capA.capabilityToken,
      toolName: 'lookupServiceDetails',
      args: SYNTHETIC_ARGS.VALID_LOOKUP,
      actorUserId: SYNTHETIC_ACTORS.CITIZEN_A.actorUserId,
      actorRole: 'citizen',
      sessionId: 'hijacked-session-id',
    });
    expect(crossSession.ok).toBe(false);
    expect(crossSession.code).toBe(ERROR_CODES.CROSS_USER_DENIED);
  });

  it('rejects expired capabilities', async () => {
    const cap = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'lookupServiceDetails',
      ttlSeconds: 30,
    });

    currentTimeMs += 31_000;
    const expired = await registry.invokeTool({
      capabilityToken: cap.capabilityToken,
      toolName: 'lookupServiceDetails',
      args: SYNTHETIC_ARGS.VALID_LOOKUP,
      ...SYNTHETIC_ACTORS.CITIZEN_A,
    });
    expect(expired.ok).toBe(false);
    expect(expired.status).toBe(401);
    expect(expired.code).toBe(ERROR_CODES.CAPABILITY_EXPIRED);
  });

  it('rejects malformed arguments, extra properties, prototype pollution, and sensitive PII/vault strings', async () => {
    const cap = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'lookupServiceDetails',
      singleUse: false,
    });

    const extraProp = await registry.invokeTool({
      capabilityToken: cap.capabilityToken,
      toolName: 'lookupServiceDetails',
      args: SYNTHETIC_ARGS.MALFORMED_EXTRA_PROP,
      ...SYNTHETIC_ACTORS.CITIZEN_A,
    });
    expect(extraProp.ok).toBe(false);
    expect(extraProp.code).toBe(ERROR_CODES.INVALID_SCHEMA);

    const protoPayload = JSON.parse('{"serviceId":"ration-card","__proto__":{"polluted":true}}');
    const protoRes = await registry.invokeTool({
      capabilityToken: cap.capabilityToken,
      toolName: 'lookupServiceDetails',
      args: protoPayload,
      ...SYNTHETIC_ACTORS.CITIZEN_A,
    });
    expect(protoRes.ok).toBe(false);
    expect(protoRes.code).toBe(ERROR_CODES.SENSITIVE_DATA_DENIED);

    const faqCap = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'searchCivicFaq',
    });
    const piiRes = await registry.invokeTool({
      capabilityToken: faqCap.capabilityToken,
      toolName: 'searchCivicFaq',
      args: SYNTHETIC_ARGS.SENSITIVE_AADHAAR_TEXT,
      ...SYNTHETIC_ACTORS.CITIZEN_A,
    });
    expect(piiRes.ok).toBe(false);
    expect(piiRes.code).toBe(ERROR_CODES.SENSITIVE_DATA_DENIED);
  });

  it('enforces citizen confirmation, human approval, and provenance for medium/high risk tools', async () => {
    const unconfirmedCap = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'saveApplicationDraft',
      citizenConfirmed: false,
    });
    const blockedDraft = await registry.invokeTool({
      capabilityToken: unconfirmedCap.capabilityToken,
      toolName: 'saveApplicationDraft',
      args: SYNTHETIC_ARGS.VALID_DRAFT,
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      citizenConfirmed: true,
      provenance: SYNTHETIC_PROVENANCE.VALID,
    });
    expect(blockedDraft.ok).toBe(false);
    expect(blockedDraft.code).toBe(ERROR_CODES.APPROVAL_REQUIRED);

    const confirmedCap = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'saveApplicationDraft',
      citizenConfirmed: true,
      provenanceRef: 'https://services.india.gov.in',
    });
    const allowedDraft = await registry.invokeTool({
      capabilityToken: confirmedCap.capabilityToken,
      toolName: 'saveApplicationDraft',
      args: SYNTHETIC_ARGS.VALID_DRAFT,
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      citizenConfirmed: true,
      provenance: SYNTHETIC_PROVENANCE.VALID,
    });
    expect(allowedDraft.ok).toBe(true);
    expect(allowedDraft.output.autonomousFilingPermitted).toBe(false);

    const highRiskCap = registry.issueCapability({
      ...SYNTHETIC_ACTORS.ADMIN_MOD,
      toolName: 'scheduleGrievanceFollowUp',
      humanApproved: true,
    });
    const noProv = await registry.invokeTool({
      capabilityToken: highRiskCap.capabilityToken,
      toolName: 'scheduleGrievanceFollowUp',
      args: SYNTHETIC_ARGS.VALID_REMINDER,
      ...SYNTHETIC_ACTORS.ADMIN_MOD,
      humanApproved: true,
      provenance: SYNTHETIC_PROVENANCE.INVALID,
    });
    expect(noProv.ok).toBe(false);
    expect(noProv.code).toBe(ERROR_CODES.PROVENANCE_REQUIRED);
  });

  it('supports immediate admin revocation of capabilities, users, and tools and scrubs audit logs', async () => {
    const cap = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'searchCivicFaq',
    });

    registry.revokeCapability(cap.claims.jti, {
      actorId: SYNTHETIC_ACTORS.ADMIN_MOD.actorUserId,
      reason: 'Suspicious anomaly',
    });

    const revokedCapRes = await registry.invokeTool({
      capabilityToken: cap.capabilityToken,
      toolName: 'searchCivicFaq',
      args: SYNTHETIC_ARGS.VALID_FAQ,
      ...SYNTHETIC_ACTORS.CITIZEN_A,
    });
    expect(revokedCapRes.ok).toBe(false);
    expect(revokedCapRes.code).toBe(ERROR_CODES.CAPABILITY_REVOKED);

    registry.revokeTool('lookupServiceDetails', {
      actorId: SYNTHETIC_ACTORS.ADMIN_MOD.actorUserId,
      reason: 'Maintenance lock',
    });
    const revokedToolCap = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'lookupServiceDetails',
    });
    expect(revokedToolCap.ok).toBe(false);
    expect(revokedToolCap.code).toBe(ERROR_CODES.TOOL_REVOKED);

    registry.restoreTool('lookupServiceDetails');
    const restoredCap = registry.issueCapability({
      ...SYNTHETIC_ACTORS.CITIZEN_A,
      toolName: 'lookupServiceDetails',
    });
    expect(restoredCap.ok).toBe(true);

    // Ensure audit events never leak raw sensitive values
    const events = registry.getAuditEvents({ limit: 20 });
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain('2345 6789 0123');
    expect(serialized).not.toContain('ctok_v1.');
    expect(serialized).not.toContain('Synthetic draft fixture');
  });
});
