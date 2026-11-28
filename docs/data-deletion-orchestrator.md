# Data Deletion Orchestrator with Dependency-Aware Erasure Proofs

## Purpose
Coordinates multi-store erasure workflows across Postgres databases, search indexes, in-memory caches, S3 object storage, and analytics warehouses under Right-to-be-Forgotten (RTBF) and retention policies.

## Key Capabilities
- **Dependency Topology**: Traverses all datastores with idempotent retry operations.
- **Privacy-Preserving Erasure Proof**: Issues cryptographic proofs confirming record deletion without retaining any residual citizen PII.
- **Audit Compliance**: Provides verifiable evidence demonstrating regulatory compliance with personal data protection statutory mandates.
