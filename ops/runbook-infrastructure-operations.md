# Infrastructure Operations Runbook

## Overview
This runbook covers the operational procedures for the Civic Help Setu Infrastructure-as-Code baseline, including deployment, drift detection, remediation, and rollback.

## Prerequisites
- Terraform CLI v1.5+
- Access to GCP project with appropriate IAM roles
- Node.js v20+ (for drift detection script)
- Clerk API key for environment configuration

## Directory Structure
```
terraform/
  main.tf          # Root module
  variables.tf     # Input variables
  outputs.tf       # Output values
  environments/
    dev/           # Development environment
    staging/       # Staging environment  
    prod/          # Production environment
  modules/
    firestore/     # Firestore module
    storage/        # Storage module
    identity/       # Identity (Clerk) module
    monitoring/     # Monitoring module
scripts/
  detect-drift.mjs  # Drift detection script
adr/
  002-infrastructure-baseline-and-policy-drift-enforcement.md  # Architecture decision record
```

## Daily Operations

### 1. Check Infrastructure Health
```bash
# Run drift detection for all environments
node scripts/detect-drift.mjs

# Expected output:
# - No drift: "All resources are compliant with policy baseline."
# - Drift detected: List of violations with exit code 1
```

### 2. Review Terraform Plan
Before applying any changes, always run `terraform plan`:

```bash
# From the terraform root directory
cd terraform

# Plan changes for an environment
terraform plan -var-file=environments/<env>/terraform.tfvars

# Review the plan output for:
# - Resources to be created/modified/deleted
# - Any unexpected changes (drift)
# - Destructive changes (force_destroy)
```

### 3. Apply Changes
```bash
# Apply approved changes
terraform apply -var-file=environments/<env>/terraform.tfvars

# Approve the plan when prompted (type "yes")

# Or apply auto-approved (use with caution):
terraform apply -auto-approve -var-file=environments/<env>/terraform.tfvars
```

## Drift Detection & Remediation

### Running the Drift Detection Script
```bash
# From the project root
node scripts/detect-drift.mjs
```

### Interpreting Results
The script checks for three categories of drift:

1. **Storage Drift**:
   - `PUBLIC_ACCESS_DETECTED` - Bucket has public access enabled
   - `compliant` - Bucket meets policy requirements

2. **Firestore Drift**:
   - `POINT_IN_TIME_RECOVERY_NOT_ENABLED` - PITR is disabled
   - `compliant` - PITR is enabled

3. **IAM Drift**:
   - `LEAST_PRIVILEGE_NOT_ENFORCED` - IAM bindings not least privilege
   - `compliant` - Least privilege IAM enforced

### Remediation Steps

#### Non-Destructive Drift (can auto-remediate)
```bash
# Re-apply Terraform to fix drift
terraform apply -var-file=environments/<env>/terraform.tfvars
```

#### Destructive Drift (requires review)
1. Run `terraform plan` to see what would change
2. Review the plan in pull request
3. If changes are acceptable: `terraform apply`
4. If changes are NOT acceptable: 
   - Document the drift cause
   - Manually reconfigure to match policy
   - Create follow-up task to prevent recurrence

## Deployment Procedures

### Adding a New Environment
```bash
# 1. Copy existing environment template
cp -r terraform/environments/dev terraform/environments/<new-env>

# 2. Adjust variables
# Edit terraform/environments/<new-env>/main.tf
# Adjust terraform/environments/<new-env>/terraform.tfvars if needed

# 3. Initialize backend
terraform init -reconfigure \
  -backend-config="path=terraform/environments/<new-env>"

# 4. Verify plan
terraform plan -var-file=terraform/environments/<new-env>/terraform.tfvars

# 5. Apply if plan is acceptable
terraform apply -var-file=terraform/environments/<new-env>/terraform.tfvars
```

### Promoting Environment (dev -> staging -> prod)
```bash
# 1. Ensure dev is stable and tested
node scripts/detect-drift.mjs  # Should show "COMPLIANT"

# 2. Copy config to next environment
cp -r terraform/environments/dev terraform/environments/staging
# Adjust staging-specific variables (longer retention, etc.)

# 3. Run drift detection on staging
node scripts/detect-drift.mjs  # For staging environment

# 4. After staging validated, promote to prod
# Adjust prod-specific variables (365-day retention, locked, etc.)

# 5. Full prod validation
node scripts/detect-drift.mjs  # For prod environment
terraform plan -var-file=terraform/environments/prod/terraform.tfvars
# Review plan thoroughly
terraform apply -var-file=terraform/environments/prod/terraform.tfvars
```

## Rollback Procedures

### Rollback a Terraform Apply
```bash
# If recent apply failed or caused issues:
# Option 1: Apply with prior state
terraform apply -state=terraform/environments/<env>/terraform_old.tfstate

# Option 2: Targeted fix
terraform apply -target=google_firestore_database.default \
  -var-file=terraform/environments/<env>/terraform.tfvars

# Option 3: Destroy and re-apply (last resort)
# WARNING: This may destroy resources
terraform destroy -var-file=terraform/environments/<env>/terraform.tfvars
# Then: terraform apply -var-file=terraform/environments/<env>/terraform.tfvars
```

### Rollback Drift Detection Script
If the drift detection script itself is broken:
```bash
# 1. Check the script logs
node scripts/detect-drift.mjs --help

# 2. Verify dependencies
npm install  # Ensure @google-cloud/monitoring is available

# 3. Restore from git if needed
git checkout HEAD~1 -- scripts/detect-drift.mjs

# 4. Re-test
node scripts/detect-drift.mjs
```

### Emergency Rollback (Production Incident)
1. **Identify the incident**: Drift detection shows critical violation
2. **Assess impact**: Determine if resources are functionally impacted
3. **Rollback options** (in order of preference):
   a. `terraform apply -target=<affected_resource>` to fix specific resource
   b. `terraform apply -state=<prior_state>.tfstate` to revert to known-good state
   c. Manual reconfiguration if IaC cannot reach the desired state
4. **Post-rollback**: Re-run drift detection; document root cause
5. **Prevention**: Update policy or module to prevent recurrence

## Security Procedures

### Rotating Clerk API Keys
```bash
# 1. Generate new Clerk key in Clerk dashboard
# 2. Update the variable in the environment
# 3. Do NOT commit real keys to version control
# 4. Use secret management (Vault, GCP Secret Manager) in production

# Example: Update via environment variable
export CLOUD_RUN_ENV_VARS="clerk_api_key=new_key_value"
terraform apply -var-file=environments/prod/terraform.tfvars
```

### Managing IAM Permissions
```bash
# Review IAM bindings quarterly
terraform show -state=terraform/environments/prod/terraform.tfstate \
  google_project_iam_bindings

# Review via Terraform plan
terraform plan -var-file=terraform/environments/prod/terraform.tfvars

# If over-privilege detected:
# 1. Identify the overly-permissive binding
# 2. Create fix branch with reduced permissions
# 3. Run terraform plan to verify
# 4. Apply after code review
```

### Secrets Management
- Never commit `.env` files or real API keys
- Use `.env.example` for documented variables only
- Real secrets injected via CI/CD secret masking
- `terraform` variables marked `sensitive` are redacted in plan output

## Capacity & Performance Monitoring

### Monitoring Dashboard
Access: `https://console.cloud.google.com/monitoring`

### Key Metrics to Watch
| Metric | Normal Range | Alert Threshold |
|--------|-------------|----------------|
| `policy_drift` | 0 | > 0 |
| `storage_public_access` | 0 | > 0 |
| `storage_encryption` | 1 (enabled) | 0 (disabled) |
| `firestore_throughput` | < 100 writes/sec | > 500 writes/sec |
| `storage_operation_count` | Variable | Sudden spike > 2x baseline |

### Alert Notification Channels
- Slack webhook: `#infra-alerts`
- Email: oncall@civic-help-setu.org
- PagerDuty for critical (CRITICAL severity alerts)

## Capacity Assumptions
- **Firestore**: < 100 writes/sec per collection, < 1 TB storage per environment
- **Storage**: < 10 TB per environment, < 1M objects per bucket
- **Monitoring**: < 50 custom metrics per environment, < 10 alerts/day
- **Terraform apply**: < 5 minutes for full environment apply

## Related Documents
- [ADR 002](adr/002-infrastructure-baseline-and-policy-drift-enforcement.md) - Architecture decision record
- [Threat Model](docs/security/threat-model.md) - Security threat model
- [Firebase Rules](firebase/firestore.rules) - Firestore security rules
- [Storage Rules](firebase/storage.rules) - Cloud Storage security rules