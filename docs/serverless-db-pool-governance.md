# Database Connection Pool Governance Layer for Serverless Bursts

## Context & Objectives
Under bursty serverless workloads (e.g. during disaster alert broadcasts or sudden admissions cutoffs), dozens of concurrent lambda functions spin up and attempt to connect directly to the relational database. Without strict pool governance, this results in connection exhaustion (`FATAL: remaining connection slots are reserved for non-replication superuser connections`), thread starvation, and cascading outages.

## Architecture
1. **Bounded Pool & Queue Admission**:
   - Strictly limits connections to provisioned limits (e.g. 10 per container replica).
   - Manages an admission wait queue with bounded depth to fast-fail excess requests instead of choking the database.
2. **Connection Reuse**:
   - Reclaims idle connections immediately and matches pending async waiters.
3. **Leaked Connection Reaper**:
   - Actively detects unreleased connections held past timeouts and reclaims them safely.
