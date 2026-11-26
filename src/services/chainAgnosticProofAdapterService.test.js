import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  ChainAgnosticProofService,
  InMemoryProofAdapter,
  MockEvmTestnetAdapter,
  ProofAdapterError
} from './chainAgnosticProofAdapterService.js';

describe('ChainAgnosticProofAdapterService', () => {
  let service;

  beforeEach(() => {
    service = new ChainAgnosticProofService();
  });

  it('lists registered adapters including in-memory and evm testnet', () => {
    const adapters = service.listRegisteredAdapters();
    expect(adapters).toHaveLength(2);
    expect(adapters.map(a => a.name)).toContain('in-memory');
    expect(adapters.map(a => a.name)).toContain('evm-testnet');
  });

  it('prohibits raw documents, text, or non-hex payloads', async () => {
    const rawDocument = 'John Doe, Ward 44, Aadhaar 1234-5678-9012';
    await expect(service.createAnchor(rawDocument)).rejects.toThrow(ProofAdapterError);
    await expect(service.createAnchor(rawDocument)).rejects.toThrow('prohibited');

    await expect(service.createAnchor('12345')).rejects.toThrow('only 64-character SHA-256 hex hashes are permitted');
  });

  it('anchors a valid SHA-256 hash using the in-memory adapter and verifies successfully', async () => {
    const validHash = crypto.createHash('sha256').update('civic-document-payload-test').digest('hex');

    const receipt = await service.createAnchor(validHash, {
      adapterName: 'in-memory',
      domain: 'birth-records',
      authorityId: 'urn:civic:bbmp'
    });

    expect(receipt).toBeDefined();
    expect(receipt.anchorId).toMatch(/^anc_/);
    expect(receipt.commitmentHash).toBe(validHash);
    expect(receipt.status).toBe('CONFIRMED');

    const verification = await service.verifyAnchor(receipt);
    expect(verification.isValid).toBe(true);
    expect(verification.chainId).toBe('local-sim-0');
  });

  it('detects tampering of commitment hash during receipt verification', async () => {
    const validHash = crypto.createHash('sha256').update('authentic-dataset').digest('hex');
    const receipt = await service.createAnchor(validHash, { adapterName: 'in-memory' });

    // Tamper with receipt
    const tamperedReceipt = {
      ...receipt,
      commitmentHash: crypto.createHash('sha256').update('fraudulent-dataset').digest('hex')
    };

    const verification = await service.verifyAnchor(tamperedReceipt);
    expect(verification.isValid).toBe(false);
    expect(verification.reason).toContain('mismatch');
  });

  it('anchors and verifies via mock EVM testnet adapter', async () => {
    const validHash = '0x' + crypto.createHash('sha256').update('council-resolution-2026').digest('hex');
    const receipt = await service.createAnchor(validHash, {
      adapterName: 'evm-testnet',
      purpose: 'ward-resolution'
    });

    expect(receipt.adapterName).toBe('evm-testnet');
    expect(receipt.txHash).toMatch(/^0x/);

    const verification = await service.verifyAnchor(receipt);
    expect(verification.isValid).toBe(true);
    expect(verification.txHash).toBe(receipt.txHash);
  });

  it('enforces feature flag toggle to disable anchoring operations', async () => {
    service.setFeatureEnabled(false);
    expect(service.isFeatureEnabled()).toBe(false);

    const validHash = crypto.createHash('sha256').update('test-data').digest('hex');
    await expect(service.createAnchor(validHash)).rejects.toThrow('feature flag');
  });
});
