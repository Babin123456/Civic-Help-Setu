# Tenant Isolation for Multi-Authority Civic Administration Workspaces (#779)

## Overview & Statutory Problem Statement

Civic Help Setu provides a dedicated, multi-authority administration workspace with sovereign tenant isolation.
In real-world civic governance across Indian states, districts, and urban local bodies (ULBs):
1. **Sovereign Boundaries:** Municipal corporations (e.g. BMC Mumbai, BBMP Bengaluru, PMC Pune) operate separate statutory mandates, personnel hierarchies, ward complaints, and municipal datasets.
2. **Data Partitioning & Anti-IDOR:** Staff members assigned to Authority A must never be able to read, mutate, or enumerate internal operational records or private staff notes of Authority B.
3. **Controlled Public Catalogue Exchange:** Public procedural guides can be shared across authorities only through an audited, sanitizing publication pipeline that redacts internal notes, officer names, and contact details.
4. **Bounded Local Intelligence:** Automated recommendations (SLA breach warnings, bottleneck detections) evaluate only within the active authority's boundary with zero cross-tenant data leakage.
5. **Tamper-Evident Non-Repudiation:** Append-only SHA-256 chained audit logs preserve administrative accountability for all mutations, overrides, and publication decisions.

---

## Architecture & Data Flow

```
[ Staff Browser / Client ]
      │
      ├──> [ TenantAdministrationWorkspace ]
      │          │
      │          ├──> Authority Switcher & Active Context (`civicbridge_active_tenant_context_v1`)
      │          └──> Scoped Role & Jurisdiction Badge
      │
[ Context & Security Boundary: assertTenantScope() ]
      │
      ├── 1. Verify User Membership in Target Authority
      ├── 2. Verify Granular Role Permission (`ROLE_PERMISSIONS[role]`)
      ├── 3. Enforce Compound Key Lookups: `WHERE tenantId == activeTenantId AND id == recordId`
      │
      ▼
[ Partitioned Persistence Stores ]
      ├── `civicbridge_tenants_v1`: Authority profiles & jurisdiction codes
      ├── `civicbridge_tenant_memberships_v1`: Staff memberships & ward scopes
      ├── `civicbridge_tenant_roles_v1`: Granular RBAC definitions
      ├── `civicbridge_tenant_settings_v1`: Statutory SLA rules & emergency broadcast banners
      ├── `civicbridge_tenant_datasets_v1`: Sovereign operational dataset records
      ├── `civicbridge_shared_catalogue_v1`: Public procedural guides with PII redacted
      └── `civicbridge_tenant_audit_events_v1`: SHA-256 hash-chained audit trail
```

---

## Role-Based Access Control (RBAC) Matrix

| Granular Permission | Tenant Admin | Tenant Operator | Tenant Reviewer | Tenant Auditor | Unauthorized / Public |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `tenant:read` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `tenant:manage` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `staff:read` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `staff:manage` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `dataset:read` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `dataset:write` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `dataset:delete` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `settings:read` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `settings:manage` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `catalogue:submit`| ✓ | ✓ | ✓ | ✗ | ✗ |
| `catalogue:approve`| ✓ | ✗ | ✓ | ✗ | ✗ |
| `catalogue:retract`| ✓ | ✗ | ✓ | ✗ | ✗ |
| `recommendations:view` | ✓ | ✓ | ✓ | ✗ | ✗ |
| `recommendations:action` | ✓ | ✗ | ✓ | ✗ | ✗ |
| `audit:read` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `audit:verify` | ✓ | ✗ | ✗ | ✓ | ✗ |

---

## Controlled Cross-Tenant Public Catalogue Exchange

When an authority submits an operational record to the public catalogue:
1. **Automated PII & Private Notes Redaction:**
   - Strips `privateNotes`, `assignedOfficer`, and internal contact numbers.
   - Rejects submissions containing 12-digit Aadhaar, 10-character PAN, or phone numbers.
2. **Review & Approval Gate:**
   - Staged in `pending_approval` status.
   - Requires explicit sign-off by a `tenant_reviewer` or `tenant_admin`.
3. **Public Visibility:**
   - Only records with `published` status are visible in `listSharedPublicCatalogue()`.
   - Retraction immediately removes the record from public view and writes a timestamped justification to the audit trail.

---

## Cryptographic Tamper-Evident Audit Trail

All administrative actions generate an append-only entry chained via SHA-256:
- **Genesis Block:** Hash seed initialized with `GENESIS_AUDIT_HASH` (`0000...0000`).
- **Entry Hash:** Computed from `${tenantId}|${actorId}|${action}|${targetId}|${timestamp}|${previousHash}|${details}`.
- **Integrity Verification:** `verifyAuditChainIntegrity(tenantId)` validates that no previous hash is broken and no entry payload has been altered.

---

## Testing & Verification

Run the targeted test suites:
```bash
# Service isolation, RBAC, anti-IDOR, and audit hash-chain tests
npm test -- --run src/services/tenantIsolationService.test.js

# Multi-Authority Workspace UI and state transition tests
npm test -- --run src/pages/TenantAdministrationWorkspace.test.jsx

# Serverless administration API endpoint tests
npm test -- --run tests/tenant-administration.test.js
```
