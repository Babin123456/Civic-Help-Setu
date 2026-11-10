# Anchor Document Integrity Proofs Without Storing Documents on Blockchain

This document details the cryptographic design, privacy-first off-chain architecture, Merkle tree batching, and independent auditability for Civic Help Setu.

## Ethical & Security Imperative
Under Indian data protection frameworks (such as the Digital Personal Data Protection Act, 2023) and general privacy principles:
- **Never upload raw identity documents (Aadhaar, Voter ID, PAN, Property Deeds) to a public blockchain.**
- Blockchains are immutable; placing citizen personal identifiable information (PII) on a public ledger constitutes an irreversible privacy violation.

Instead, Civic Help Setu anchors **only cryptographic commitments (Merkle Roots)** of hashed documents. The original files remain strictly on the citizen's device or in private, encrypted local vault storage.

## Cryptographic Architecture

```
  [ Local Document File ] (PDF / JPG / Text)
              │
              ▼ (Local Client-Side)
  [ Cryptographic Hash: SHA-256 ]
              │
              ├── Leaf Hash 1: H(doc1)
              ├── Leaf Hash 2: H(doc2)
              └── Leaf Hash N: H(docN)
                      │
                      ▼
        +----------------------------+
        |   Batch Merkle Tree        |
        |   H(H(1)+H(2)) ...         |
        +-------------+--------------+
                      │
                      ▼
        [ Merkle Root Commitment ] (32 bytes)
                      │
                      ▼
        +-----------------------------------------------+
        |  On-Chain Anchor Transaction                  |
        |  - Payload: ONLY 0x<MerkleRoot>               |
        |  - ZERO PII / ZERO file contents on-chain     |
        +-----------------------------------------------+
                      │
                      ▼
        +-----------------------------------------------+
        |  Portable Audit Certificate                   |
        |  - Document Hash (SHA-256)                    |
        |  - Merkle Inclusion Proof Path                |
        |  - Transaction ID & Timestamp                 |
        |  - Independent Verification Instructions      |
        +-----------------------------------------------+
```

## Integrity vs. Authenticity Disclaimer
- **Integrity**: Proves byte-level consistency. The document has not been altered by a single byte since the timestamp anchor.
- **Not Issuer Authenticity**: An integrity proof does *not* prove that the document was issued by a genuine government authority or that its legal statements are valid. It only proves non-tampering since creation.
