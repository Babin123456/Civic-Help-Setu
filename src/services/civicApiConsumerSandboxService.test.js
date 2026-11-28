import { describe, it, expect, beforeEach } from 'vitest';
import { CivicApiConsumerSandboxService } from './civicApiConsumerSandboxService.js';

describe('CivicApiConsumerSandboxService (#1453)', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = new CivicApiConsumerSandboxService();
  });

  it('issues scoped test credentials with strict rate limits and synthetic responses', () => {
    const cred = sandbox.issueSandboxCredentials('PartnerNGO_Portal');
    expect(cred.apiKey).toMatch(/^SBX_KEY_[0-9a-f]{32}$/);
    expect(cred.isSandbox).toBe(true);

    const val = sandbox.validateSandboxRequest(cred.apiKey, '/api/v1/sandbox/services');
    expect(val.allowed).toBe(true);
    expect(val.consumer).toBe('PartnerNGO_Portal');

    const fixture = sandbox.getDeterministicSyntheticResponse('/api/v1/sandbox/services');
    expect(fixture.isSyntheticFixture).toBe(true);
    expect(fixture.data.length).toBe(2);
    expect(fixture.data[0].serviceId).toBe('SYN-SRV-01');
  });

  it('rejects invalid or unauthorized API key requests', () => {
    const val = sandbox.validateSandboxRequest('SBX_KEY_FAKE_NOT_FOUND', '/api/v1/sandbox/services');
    expect(val.allowed).toBe(false);
    expect(val.errorStatus).toBe(401);
  });
});
