import { describe, it, expect } from 'vitest';
import {
  encryptPayload,
  decryptPayload,
} from './caseCryptoService';

describe('caseCryptoService', () => {
  const tenantId = 'test-tenant';
  const caseId = 'case-alpha-123';
  const sampleData = {
    title: 'Income Certificate Query',
    text: 'Citizen reported annual income under 1.5 lakhs with BPL card.',
    category: 'ELIGIBILITY_CRITERIA',
  };

  it('encrypts and decrypts payload successfully (round trip)', async () => {
    const envelope = await encryptPayload(sampleData, tenantId, caseId);

    expect(envelope.algorithm).toBe('AES-GCM-256');
    expect(envelope.ciphertext).toBeTypeOf('string');
    expect(envelope.iv).toBeTypeOf('string');
    expect(envelope.salt).toBeTypeOf('string');
    // Ensure ciphertext does not contain plaintext strings
    expect(envelope.ciphertext).not.toContain('Income Certificate');

    const decrypted = await decryptPayload(envelope, tenantId, caseId);
    expect(decrypted).toEqual(sampleData);
  });

  it('fails decryption if attempted with wrong caseId (cryptographic boundary)', async () => {
    const envelope = await encryptPayload(sampleData, tenantId, caseId);

    await expect(
      decryptPayload(envelope, tenantId, 'wrong-case-id')
    ).rejects.toThrow(/Decryption failed/);
  });

  it('fails decryption if attempted with wrong tenantId', async () => {
    const envelope = await encryptPayload(sampleData, tenantId, caseId);

    await expect(
      decryptPayload(envelope, 'other-tenant', caseId)
    ).rejects.toThrow(/Decryption failed/);
  });

  it('fails decryption if ciphertext has been tampered with', async () => {
    const envelope = await encryptPayload(sampleData, tenantId, caseId);
    // Tamper with ciphertext by altering base64 characters
    const tampered = {
      ...envelope,
      ciphertext: envelope.ciphertext.substring(0, envelope.ciphertext.length - 4) + 'AAAA',
    };

    await expect(
      decryptPayload(tampered, tenantId, caseId)
    ).rejects.toThrow(/Decryption failed/);
  });

  it('rejects invalid or missing envelope metadata', async () => {
    await expect(decryptPayload(null, tenantId, caseId)).rejects.toThrow(/Invalid or unsupported/);
    await expect(decryptPayload({}, tenantId, caseId)).rejects.toThrow(/Invalid or unsupported/);
  });
});
