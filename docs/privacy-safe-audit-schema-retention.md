# Privacy-Safe Centralized Audit Event Schema and Retention Pipeline

## Purpose
Establishes an immutable, tamper-evident audit logging schema across security events, administrative policy actions, data lifecycle transitions, and citizen consent approvals.

## Key Features
- **Tamper Evidence**: Cryptographic SHA-256 signatures tying event IDs, actor contexts, actions, and timestamps.
- **Actor Pseudonymization**: Hashes actor identifiers to prevent persistent user profiling across log analytics stores.
- **Retention Class Policies**: Automates lifecycle pruning across 30-day transient, 1-year compliance, and 7-year statutory tiers while guaranteeing preservation of legal hold records.
