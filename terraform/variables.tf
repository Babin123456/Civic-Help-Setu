# Terraform variables for Civic Help Setu infrastructure

# Project configuration
variable "project_id" {
  description = "Google Cloud project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod"
  }
}

# Firebase/Firestore configuration
variable "enable_firestore_auto_id" {
  description = "Enable auto-id generation for Firestore collections"
  type        = bool
  default     = true
}

variable "storage_bucket_name" {
  description = "Custom storage bucket name (optional)"
  type        = string
  default     = ""
}

# Clerk configuration
variable "clerk_api_key" {
  description = "Clerk publishable API key"
  type        = string
  sensitive   = true
}

# =============================================================================
# Derived variables and defaults
# =============================================================================

variable "labels" {
  description = "Common labels for all resources"
  type        = map(string)
  default = {
    project = "civic-help-setu"
    environment = var.environment
  }
}

variable "network_cidr" {
  description = "VPC CIDR block for any future VPC resources"
  type        = string
  default     = "10.0.0.0/16"
}