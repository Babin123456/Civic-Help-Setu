# Terraform outputs for Civic Help Setu infrastructure

output "project_id" {
  description = "Google Cloud project ID"
  value       = var.project_id
}

output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "firestore_database_name" {
  description = "Firestore database name"
  value       = module.firestore.database_name
}

output "storage_bucket_url" {
  description = "Storage bucket URL"
  value       = module.storage.bucket_url
}

output "clerk_publishable_key" {
  description = "Clerk publishable key (redacted in logs)"
  value       = var.clerk_api_key
  sensitive   = true
}

output "monitoring_dashboard_url" {
  description = "Monitoring dashboard URL"
  value       = module.monitoring.dashboard_url
}

# Policy compliance outputs
output "policy_compliance_status" {
  description = "Overall policy compliance status"
  value       = {
    no_public_exposure   = module.storage.no_public_exposure
    encryption_at_rest   = module.storage.encryption_at_rest
    least_privilege      = module.identity.least_privilege
    backup_configuration = module.storage.backup_configuration
  }
}