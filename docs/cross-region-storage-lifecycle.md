# Cross-Region Object Storage Lifecycle and Integrity Verification Service

## Architecture & Problem Overview
Civic Help Setu handles critical citizen identity records, RTI uploads, and public municipal gazette archives. This service provides a resilient, cross-region storage lifecycle and cryptographic verification framework.

## Key Capabilities
1. **Envelope Encryption & Strict Hashing**:
   - AES-256-GCM authenticated encryption at rest with unique per-object initialization vectors (IVs).
   - SHA-256 integrity checksums computed on plaintext and verified on every read operation.
2. **Cross-Region Placement & Replication**:
   - Primary data residency in `in-mumbai-1` with automatic synchronous replication state tracking to `in-hyderabad-1` and `in-delhi-1`.
3. **Lifecycle Tiers & Legal Holds**:
   - Automated transitions across `HOT`, `WARM`, `COLD`, and `ARCHIVE`.
   - Immutable legal holds preventing deletion or archival of documents tagged in active ombudsman or judicial proceedings.
4. **Short-Lived Signed URLs & Auditing**:
   - HMAC-SHA256 authenticated URLs with strict expiry timestamps and comprehensive audit trails.
