# Architecture Decision Record: Infrastructure-as-Code Baseline and Policy Drift Enforcement

## Status
Proposed

## Date
2026-11-27

## Context
Civic Help Setu currently lacks a formal Infrastructure-as-Code (IaC) baseline. Resources are manually configured through the Firebase console and environment variables. This creates risks around:
- Inconsistent configurations across environments (dev/staging/prod)
- Inability to recreate environments from scratch
- No drift detection between declared infrastructure and actual state
- Manual processes for policy enforcement (encryption, least privilege, backup config)
- No rollback guidance for destructive changes

The project uses Firebase/Firestore, Clerk authentication, and Vercel hosting. We need to codify these resources with reusable modules and environment overlays while adding policy drift enforcement.

## Decision Drivers
1. **Reproducibility**: A clean environment should be recreatable from code alone
2. **Drift Detection**: Infrastructure drift from the declared state must be automatically detected
3. **Policy Compliance**: Checks for public exposure, encryption, least privilege, and backup configuration
4. **Destructive Change Safety**: Destructive changes require explicit review and rollback guidance
5. **Team Velocity**: New engineers can provision environments without tribal knowledge
6. **Auditability**: All changes are tracked through version control

## Considered Options

### Option A: Terraform with GCP Provider (Chosen)
- **Pros**:
  - De facto standard for GCP/Firebase infrastructure
  - Native support for Firestore, Storage, IAM
  - OPA/Sentinel policy as code integration
  - State management with versioning
  - Environment via workspaces/backend configuration
  - Drift detection via `terraform plan`
  - Existing Gravitas contract integration possible
- **Cons**:
  - Additional tooling dependency
  - Terraform state management overhead
  - GCP provider may lag behind Firebase feature releases

### Option B: Terraform with Firebase Provider
- **Pros**:
  - Native Firebase resource support
  - Direct Firebase API integration
- **Cons**:
  - Firebase provider is less mature than GCP provider
  - Limited IAM and policy resources
  - Less flexible for non-Firebase GCP resources

### Option C: Pulumi with Node.js
- **Pros**:
  - Use familiar JavaScript/TypeScript
  - Dynamic provisioning possible
- **Cons**:
  - State management less mature
  - Policy as code less integrated
  - Smaller GCP resource support

### Option D: No IaC (Maintain manual configuration)
- **Pros**:
  - No learning curve
  - No state management
- **Cons**:
  - All existing risks remain
  - Fails acceptance criteria

## Chosen Option: Terraform with GCP Provider

Terraform is chosen because:
1. **Broad GCP/Firebase support** - Covers Firestore, Storage, IAM, Monitoring
2. **Policy as code integration** - OPA/Sentinel for drift enforcement
3. **State management** - Versioned state enables drift detection and recovery
4. **Environment overlays** - Workspace per environment (dev/staging/prod)
5. **Existing ecosystem** - Team familiarity, tooling, community resources
6. **Rollback capability** - `terraform apply` with prior state recovery
7. **Integration with existing Gravitas contracts** - Can validate against AC requirements

## ADRs and Sub-decisions

### 1. Terraform State Backend
- **Decision**: Local state with remote backend (S3/GCS) configured per environment
- **Rationale**: Local state for development; remote backend for collaboration and history
- **Rollback**: State file versions stored in backend; `terraform state pull` for recovery

### 2. Firestore Native Mode
- **Decision**: Use FIRESTORE_NATIVE type with point-in-time recovery
- **Rationale**: Native mode offers stronger consistency and simpler billing; PITR aids drift detection and recovery
- **Capacity**: Default throughput sufficient for civic workload; batch for high-write scenarios

### 3. Storage Bucket Policies
- **Decision**: Uniform bucket-level access + default AES256 encryption
- **Rationale**: Least privilege access model; encryption at rest meets compliance requirements
- **Backup**: Versioning + retention policy (configurable per environment)

### 4. IAM Least Privilege
- **Decision**: Service account-scoped permissions; no `roles/owner` on production buckets
- **Rationale**: Principle of least privilege; service accounts limit blast radius
- **Review**: Quarterly IAM audit via `terraform plan` and custom Drift Detection

### 5. Monitoring and Alerting
- **Decision**: Custom Cloud Monitoring metrics + alert policies for drift detection
- **Rationale**: Proactive detection of configuration drift; immediate notification on violations
- **Metrics**:
  - `policy_drift`: Count of policy violations per environment
  - `storage_public_access`: Detects public bucket access attempts
  - `storage_encryption`: Encryption status gauge

### 6. Policy Drift Enforcement
- **Decision**: Two-layer enforcement:
  1. **Terraform plan** - Detects drift before application
  2. **Scheduled drift detection script** - `scripts/detect-drift.mjs` runs hourly/day
- **Rationale**: Catch drift from manual console changes or API modifications
- **Action**: Automated remediation for non-destructive drift; manual review for destructive changes

### 7. Environment Overlays
- **Decision**: Terraform workspaces with environment-specific variable files
- **Rationale**: Shared module code; environment-specific values (bucket names, retention, keys)
- **Workspaces**: dev, staging, prod each with dedicated tfstate

### 8. Destructive Change Guardrails
- **Decision**: 
  - `force_destroy` only allowed on non-prod environments
  - `terraform plan` required before any `apply`
  - Pre-apply hook runs `detect-drift.mjs` to ensure no drift
  - Rollback: `terraform apply -target` or state file restoration
- **Review**: All changes require `terraform plan` review; destructive changes need explicit `reviewers` approval in pull request

## Data Flow

```
+---------------------+     +----------------------+     +---------------------+
|  Terraform Code     |     |  Terraform State     |     |  GCP/Firebase       |
|  (modules/overlay)  | --> | (tfstate per env)    | --> |  Resources (Firestore,|
|                     |     |                     |     |  Storage, IAM, Monit) |
+---------------------+     +----------------------+     +---------------------+
         ^                           ^                           ^
         |                           |                           |
         |                           |                           |
         |                           |                           |
         |                           |                           |
+----------+--------------------+-----------+-----------------------+-----------+
|  Drift Detection Script                          Operator Runbook   |
|  (scripts/detect-drift.mjs)                     +----------+----------+
|  - Compares actual vs. desired state             |  Manual review   |
|  - Reports violations                            |  of drift        |
|  - Exits non-zero on drift                        |  and remediation |
+-----------------------------------------------------+
```

## Threat Model

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| Unauthorized Terraform apply | Low | High | VCS-protected apply; `terraform plan` gate; Signed commits |
| Drift from manual console changes | Medium | Medium | Scheduled drift detection script; `terraform plan` on every PR |
| State file corruption/tampering | Low | High | Remote backend with versioning; state file integrity checks |
| Policy drift undetected | Medium | High | Dual-layer enforcement (plan + scheduled script); alert policies |
| Destructive change without review | Low | High | `force_destroy` blocked on prod; require `plan` approval; mandatory reviewers |
| IAM over-privilege escalation | Medium | High | Least privilege module; quarterly IAM audit; Sentinel policies |
| Secrets exposure in Terraform | Medium | High | `sensitive` variables; `.gitignore` protects `.env`; no real keys in repo |

## Component Ownership

| Component | Owner | Responsibilities |
|-----------|-------|------------------|
| Terraform Modules | Core Infrastructure | Module maintenance, security reviews, version upgrades |
| Policy Drift Script | SRE Team | Script maintenance, alert channel configuration, remediation playbooks |
| Environment Overlays | Environment Owners | Environment-specific variable configuration, resource tagging |
| IAM & Security | Security Team | Least privilege review, Sentinel policy authorizations, compliance validation |
| Monitoring & Alerting | SRE Team | Metric configuration, notification channel management, runbook updates |

## Failure Handling

1. **Terraform apply failure**: 
   - `terraform apply` is idempotent; failed resources are left unchanged
   - State file remains valid; `terraform apply` can retry
   - `terraform apply -target` to recover specific resource

2. **Drift detection failure**:
   - Script exits non-zero; CI/CD pipeline blocks merge
   - Manual review required via operator runbook
   - Drift is documented and prioritized for remediation

3. **State file loss**:
   - Remote backend with versioning preserves history
   - `terraform state pull` from previous version
   - `terraform import` to re-add resources

4. **Monitoring/alert failure**:
   - Alert on alert configuration failure
   - Fallback to log-based monitoring
   - Manual checks via `terraform plan` until restored

## Rollback Plan

1. **Identify drift**: Run `scripts/detect-drift.mjs` for target environment
2. **Review changes**: `terraform plan` shows what would change
3. **Apply with target**: `terraform apply -target=resource.address` to fix specific drift
4. **Full rollback**: 
   - `terraform apply` with prior state: `terraform apply -state=old.tfstate`
   - Or `terraform destroy` followed by `terraform apply` with original config
5. **Post-rollback verification**: Re-run drift detection; confirm all metrics green

## Migration Guide

### From Manual to IaC
1. **Inventory**: Run `scripts/detect-drift.mjs` to catalog current state
2. **Baseline**: `terraform init && terraform plan` generates execution plan
3. **Gradual migration**: Apply resources one module at a time
4. **Cutover**: Once all resources managed, disable manual console access
5. **Verification**: Run drift detection; confirm 100% compliance

### Adding New Environment
1. Copy existing environment directory: `cp -r environments/dev environments/new-env`
2. Adjust variables in `terraform/environments/new-env/variables.tfvars`
3. Update workspace: `terraform init -reconfigure -backend-config="path=environments/new-env"`
4. Run `terraform plan` and verify
5. Add drift detection configuration for new environment

## Capacity Assumptions

- **Firestore throughput**: Expected < 100 writes/sec per collection; batch for higher volume
- **Storage bucket size**: < 10 TB per environment; lifecycle policies manage cost
- **Monitoring metrics**: < 100 custom metrics per environment; no performance impact
- **Alert frequency**: < 10 alerts/day per environment; noise thresholds configured
- **Terraform apply time**: < 5 minutes for full environment; incremental applies < 1 minute

## Evaluation Criteria (Post-Implementation)

- **Reproducibility**: `terraform apply` can recreate dev environment from scratch in < 10 minutes
- **Drift Detection**: `scripts/detect-drift.mjs` detects 100% of known misconfigurations
- **Policy Compliance**: All environments pass Sentinel/OPA policy checks
- **Rollback Time**: Destructive change rollback < 15 minutes
- **Test Coverage**: >80% line coverage on drift detection script and module tests
- **Security**: No public bucket exposure; encryption at rest enabled on all storage; least privilege IAM enforced
- **Observability**: All policy violations generate alerts; dashboard shows compliance status