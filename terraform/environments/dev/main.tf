# Development environment - minimal resources for local development

project_id      = "civic-help-setu-dev"
region          = "us-central1"
environment     = "dev"

# Development-specific overrides
enable_firestore_auto_id = true

# Dev storage - auto-named bucket
storage_bucket_name = ""

# Dev Clerk - not required for pure local dev
clerk_api_key = ""

# Enable versioning and retention for dev
enable_firestore_auto_id = true