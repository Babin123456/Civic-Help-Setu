# Server-Side Role and Ownership Authorization

## Overview
This service provides a centralized server-side authorization and access control layer implementing attribute-based and role-based policies (RBAC/ABAC).

## Security Guardrails
1. **Deny-by-Default Architecture**: All incoming requests without explicit authorization policies are rejected.
2. **IDOR Mitigation**: Citizen requests to inspect or modify resources verify that `resource.ownerId === principal.id`.
3. **Tenant & Jurisdiction Scoping**: Ward officers and verifiers can only operate on records matching their designated jurisdictions.
4. **Audit Trail**: Every authorization success, denial, and override is immutably logged with structured contextual metadata.
