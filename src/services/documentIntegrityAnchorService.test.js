import { describe, it, expect } from 'vitest';
import {
  computeSha256Hex,
  buildMerkleTree,
  generateMerkleAuditProof,
  verifyMerkleProof,
  prepareBlockchainAnchorPayload,
  exportDocumentIntegrityProofCertificate,
  INTEGRITY_DISCLAIMER,
} from './documentIntegrityAnchorService.js';

describe('Anchor Document Integrity Proofs Service', () => {
  it('computes deterministic SHA-256 hash for document content', async () => {
    const text = 'Govt Certificate Content: Name=Citizen, Status=Approved';
    const hash = await computeSha256Hex(text);
    expect(hash.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);

    const hashAgain = await computeSha256Hex(text);
    expect(hashAgain).toBe(hash);
  });

  it('builds a cryptographic Merkle tree from batch document leaf hashes', async () => {
    const leaves = [
      await computeSha256Hex('doc-1'),
      await computeSha256Hex('doc-2'),
      await computeSha256Hex('doc-3'),
      await computeSha256Hex('doc-4'),
    ];

    const tree = await buildMerkleTree(leaves);
    expect(tree.root.length).toBe(64);
    expect(tree.leaves.length).toBe(4);
    expect(tree.layers.length).toBe(3); // Leaf layer (4) -> intermediate (2) -> root (1)
  });

  it('generates and independently verifies a valid Merkle audit proof path', async () => {
    const targetContent = 'My Important Property Tax Receipt 2025';
    const targetHash = await computeSha256Hex(targetContent);

    const leaves = [
      targetHash,
      await computeSha256Hex('doc-other-1'),
      await computeSha256Hex('doc-other-2'),
    ];

    const tree = await buildMerkleTree(leaves);
    const proof = generateMerkleAuditProof(tree, targetHash);
    expect(proof.length).toBeGreaterThan(0);

    const isValid = await verifyMerkleProof(targetHash, proof, tree.root);
    expect(isValid).toBe(true);

    // Tampered leaf hash must fail verification
    const tamperedHash = await computeSha256Hex('Tampered Receipt');
    const isTamperedValid = await verifyMerkleProof(tamperedHash, proof, tree.root);
    expect(isTamperedValid).toBe(false);
  });

  it('prepares on-chain payload strictly free of PII or file bytes', async () => {
    const tree = await buildMerkleTree([await computeSha256Hex('doc-a'), await computeSha256Hex('doc-b')]);
    const payload = prepareBlockchainAnchorPayload(tree);

    expect(payload.containsPii).toBe(false);
    expect(payload.onChainDataHex).toBe(`0x${tree.root}`);
    expect(payload.leafCount).toBe(2);
    expect(payload.disclaimer).toBe(INTEGRITY_DISCLAIMER);
  });

  it('exports a self-contained integrity certificate with verification instructions', async () => {
    const cert = exportDocumentIntegrityProofCertificate({
      documentId: 'vault-item-88',
      documentHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      merkleRoot: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      proofPath: [{ position: 'right', hash: 'abc123hash' }],
      anchorTxId: 'tx-0x998877',
    });

    expect(cert.certificateType).toBe('CIVIC_DOCUMENT_INTEGRITY_PROOF_V1');
    expect(cert.verificationAlgorithm).toBe('SHA-256-MERKLE-INCLUSION');
    expect(cert.verificationInstructions).toContain('fold proofPath hashes');
    expect(cert.disclaimer).toContain('does NOT establish issuer authenticity');
  });
});
