# Staging environment - near-production configuration

project_id      = "civic-help-setu-staging"
region          = "us-central1"
environment     = "staging"

# Staging Firestore
enable_firestore_auto_id = true

# Staging storage with custom bucket
storage_bucket_name = "civic-help-setu-staging-bucket"

# Staging Clerk - configured but limited scope
clerk_api_key = var.clerk_staging_key

# Enable versioning and retention
enable_firestore_auto_id = true