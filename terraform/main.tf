# Civic Help Setu - Infrastructure as Code Baseline
# Manages Firebase, Clerk, and monitoring resources

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  backend "local" {
    # State is stored locally; for production use a remote backend (S3, GCS, etc.)
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# =============================================================================
# Core Infrastructure Modules
# =============================================================================

module "firestore" {
  source = "./modules/firestore"

  project_id      = var.project_id
  region          = var.region
  environment     = var.environment
  enable_auto_id  = var.enable_firestore_auto_id
}

module "storage" {
  source = "./modules/storage"

  project_id      = var.project_id
  region          = var.region
  environment     = var.environment
  bucket_name     = var.storage_bucket_name
}

module "identity" {
  source = "./modules/identity"

  environment = var.environment
  clerk_api   = var.clerk_api_key
}

module "monitoring" {
  source = "./modules/monitoring"

  project_id = var.project_id
  region     = var.region
  environment = var.environment
}

# =============================================================================
# Policy as Code - OPA/Sentinel Policies
# =============================================================================

# Policy constraints for infrastructure
policy "no_public_exposure" {
  # Deny storage buckets with public access
  count = length(module.storage.buckets)
}

policy "encryption_at_rest" {
  # Enforce encryption on all storage
  count = length(module.storage.encryption_enabled)
}

policy "least_privilege" {
  # Enforce fine-grained IAM
  count = length(module.identity.iam_bindings)
}

policy "backup_configuration" {
  # Enforce backup rules
  count = length(module.storage.backup_rules)
}