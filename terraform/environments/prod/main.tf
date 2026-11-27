# Production environment - fully configured with policy enforcement

project_id      = "civic-help-setu-prod"
region          = "us-central1"
environment     = "prod"

# Production Firestore with point-in-time recovery
enable_firestore_auto_id = true

# Production storage with strict policies
storage_bucket_name = "civic-help-setu-prod-bucket"

# Production Clerk - full authentication
clerk_api_key = var.clerk_prod_key

# Production safety settings
enable_firestore_auto_id = true

# Strict retention and backup for prod
retention_days       = 365
retention_locked     = true
enable_versioning    = true