import crypto from 'crypto';

/**
 * @file chainAgnosticProofAdapterService.js
 * @description Provides a chain-agnostic adapter interface for creating and verifying
 * cryptographic proof commitments (anchors) across diverse target ledgers (in-memory, mock testnet, etc.).
 * Strictly enforces that raw documents and PII are never accepted—only cryptographic hashes (SHA-256).
 */

export class ProofAdapterError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ProofAdapterError';
    this.code = code;
  }
}

/**
 * Base Abstract Proof Adapter
 */
export class BaseProofAdapter {
  constructor(adapterName, chainId) {
    this.adapterName = adapterName;
    this.chainId = chainId;
  }

  async anchor(commitmentHash, metadata = {}) {
    throw new Error('anchor() must be implemented by adapter subclass');
  }

  async verify(anchorReceipt) {
    throw new Error('verify() must be implemented by adapter subclass');
  }

  async getStatus(anchorId) {
    throw new Error('getStatus() must be implemented by adapter subclass');
  }
}

/**
 * Local In-Memory Proof Adapter for testing and air-gapped environments
 */
export class InMemoryProofAdapter extends BaseProofAdapter {
  constructor() {
    super('in-memory', 'local-sim-0');
    this.store = new Map();
  }

  async anchor(commitmentHash, metadata = {}) {
    const anchorId = `anc_${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();
    const blockNumber = this.store.size + 1;
    const blockHash = crypto.createHash('sha256').update(`${blockNumber}:${commitmentHash}:${timestamp}`).digest('hex');

    const receipt = {
      anchorId,
      adapterName: this.adapterName,
      chainId: this.chainId,
      commitmentHash,
      blockNumber,
      blockHash,
      timestamp,
      metadata: {
        domain: metadata.domain || 'civic-registry',
        authorityId: metadata.authorityId || 'urn:civic:authority:default'
      },
      status: 'CONFIRMED'
    };

    this.store.set(anchorId, receipt);
    return receipt;
  }

  async verify(anchorReceipt) {
    if (!anchorReceipt || !anchorReceipt.anchorId) {
      return { isValid: false, reason: 'Missing anchor identifier' };
    }

    const recorded = this.store.get(anchorReceipt.anchorId);
    if (!recorded) {
      return { isValid: false, reason: 'Anchor record not found in ledger' };
    }

    if (recorded.commitmentHash !== anchorReceipt.commitmentHash) {
      return { isValid: false, reason: 'Commitment hash mismatch against ledger record' };
    }

    if (recorded.blockHash !== anchorReceipt.blockHash) {
      return { isValid: false, reason: 'Block hash tampering detected' };
    }

    return {
      isValid: true,
      chainId: this.chainId,
      blockNumber: recorded.blockNumber,
      confirmedAt: recorded.timestamp,
      status: recorded.status
    };
  }

  async getStatus(anchorId) {
    const recorded = this.store.get(anchorId);
    if (!recorded) {
      return null;
    }
    return { ...recorded };
  }
}

/**
 * Mock EVM / L2 Proof Adapter for EVM testnets
 */
export class MockEvmTestnetAdapter extends BaseProofAdapter {
  constructor(chainId = 'eip155:11155111') {
    super('evm-testnet', chainId);
    this.receipts = new Map();
  }

  async anchor(commitmentHash, metadata = {}) {
    const anchorId = `0x${crypto.randomBytes(32).toString('hex')}`;
    const timestamp = new Date().toISOString();
    const blockNumber = 5000000 + this.receipts.size;
    const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;

    const receipt = {
      anchorId,
      txHash,
      adapterName: this.adapterName,
      chainId: this.chainId,
      commitmentHash,
      blockNumber,
      timestamp,
      contractAddress: '0x1234567890123456789012345678901234567890',
      metadata,
      status: 'CONFIRMED'
    };

    this.receipts.set(anchorId, receipt);
    return receipt;
  }

  async verify(anchorReceipt) {
    if (!anchorReceipt || !anchorReceipt.anchorId) {
      return { isValid: false, reason: 'Invalid receipt identifier' };
    }

    const stored = this.receipts.get(anchorReceipt.anchorId);
    if (!stored) {
      return { isValid: false, reason: 'Transaction not found on target testnet' };
    }

    if (stored.commitmentHash.toLowerCase() !== anchorReceipt.commitmentHash.toLowerCase()) {
      return { isValid: false, reason: 'On-chain hash mismatch' };
    }

    return {
      isValid: true,
      chainId: this.chainId,
      txHash: stored.txHash,
      blockNumber: stored.blockNumber,
      confirmedAt: stored.timestamp,
      status: stored.status
    };
  }

  async getStatus(anchorId) {
    return this.receipts.get(anchorId) || null;
  }
}

/**
 * Verification Sandbox and Proof Hub
 */
export class ChainAgnosticProofService {
  constructor(options = {}) {
    this.enabled = options.enabled !== undefined ? options.enabled : true;
    this.adapters = new Map();

    // Register built-in default adapters
    this.registerAdapter(new InMemoryProofAdapter());
    this.registerAdapter(new MockEvmTestnetAdapter());
    this.defaultAdapterName = options.defaultAdapter || 'in-memory';
  }

  isFeatureEnabled() {
    return this.enabled;
  }

  setFeatureEnabled(status) {
    this.enabled = Boolean(status);
  }

  registerAdapter(adapter) {
    if (!adapter || !adapter.adapterName) {
      throw new ProofAdapterError('Invalid adapter instance supplied', 'INVALID_ADAPTER');
    }
    this.adapters.set(adapter.adapterName, adapter);
  }

  getAdapter(adapterName) {
    const name = adapterName || this.defaultAdapterName;
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new ProofAdapterError(`Proof adapter '${name}' is not registered`, 'ADAPTER_NOT_FOUND');
    }
    return adapter;
  }

  listRegisteredAdapters() {
    return Array.from(this.adapters.values()).map(a => ({
      name: a.adapterName,
      chainId: a.chainId
    }));
  }

  /**
   * Validates that an input is strictly a 64-character hex hash, preventing raw text or PII upload.
   */
  validateHashStrict(hash) {
    if (!hash || typeof hash !== 'string') {
      throw new ProofAdapterError('Commitment hash must be a valid hex string', 'INVALID_HASH_TYPE');
    }

    const cleanHash = hash.startsWith('0x') ? hash.slice(2) : hash;
    if (!/^[a-fA-F0-9]{64}$/.test(cleanHash)) {
      throw new ProofAdapterError(
        'Commitment rejected: only 64-character SHA-256 hex hashes are permitted. Raw documents and PII are prohibited.',
        'PROHIBITED_RAW_PAYLOAD'
      );
    }
    return cleanHash.toLowerCase();
  }

  /**
   * Anchors a SHA-256 commitment hash to the specified or default ledger adapter.
   */
  async createAnchor(commitmentHash, options = {}) {
    if (!this.enabled) {
      throw new ProofAdapterError('Proof anchoring is currently disabled via feature flag', 'FEATURE_DISABLED');
    }

    const normalizedHash = this.validateHashStrict(commitmentHash);
    const adapter = this.getAdapter(options.adapterName);

    const metadata = {
      domain: options.domain || 'civic-proof',
      authorityId: options.authorityId || 'urn:civic:authority:general',
      purpose: options.purpose || 'registry-attestation'
    };

    return adapter.anchor(normalizedHash, metadata);
  }

  /**
   * Verifies an anchor receipt against the designated adapter sandbox.
   */
  async verifyAnchor(anchorReceipt) {
    if (!anchorReceipt) {
      return { isValid: false, reason: 'Empty receipt provided' };
    }

    const adapterName = anchorReceipt.adapterName || this.defaultAdapterName;
    const adapter = this.getAdapter(adapterName);

    return adapter.verify(anchorReceipt);
  }
}

export const defaultProofService = new ChainAgnosticProofService();
