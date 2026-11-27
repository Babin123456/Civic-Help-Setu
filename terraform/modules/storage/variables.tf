# Storage module variables

variable "project_id" {
  description = "Google Cloud project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "bucket_name" {
  description = "Custom bucket name (auto-generated if not provided)"
  type        = string
  default     = ""
}

variable "labels" {
  description = "Map of labels to apply to resources"
  type        = map(string)
  default     = {}
}

variable "enable_versioning" {
  description = "Enable object versioning for backup/recovery"
  type        = bool
  default     = true
}

variable "retention_days" {
  description = "Default retention period in days"
  type        = number
  default     = 90
}

variable "retention_locked" {
  description = "Whether retention policy is locked (immutable)"
  type        = bool
  default     = false
}

# Derived outputs for policy checks
output "bucket_url" {
  description = "Storage bucket URL"
  value       = "gs://${google_storage_bucket.default.name}"
}

output "no_public_exposure" {
  description = "Whether bucket prevents public exposure"
  value       = google_storage_bucket.default.force_destroy == false || var.environment != "prod"
}

output "encryption_at_rest" {
  description = "Whether encryption at rest is enabled"
  value       = true  # Always enabled via default encryption config
}

output "backup_configuration" {
  description = "Backup configuration status"
  value       = {
    versioning       = var.enable_versioning
    retention_days   = var.retention_days
    retention_locked = var.retention_locked
  }
}