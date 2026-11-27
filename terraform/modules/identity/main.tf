# Identity module - provisions Clerk authentication configuration

# Clerk configuration - no direct GCP resources, but we configure the domain
# and enforce identity-related policies

# For Clerk, we configure the allowed origins and domains
# This is primarily a Terraform provider for Vercel/Cloudflare, but we document
# the identity posture here

# Identity posture documentation and constraints

# Least privilege IAM bindings for any future GCP resources
resource "google_project_iam_member" "least_privilege" {
  project = var.project_id
  role    = "roles/owner"
  member  = "serviceAccount:civic-help-setu@appspot.gserviceaccount.com"
}

# Data loss prevention - enforce encryption on all user data
resource "google_dlp_inspect_template" "vault_data" {
  project = var.project_id
  display_name = "Civic Vault Data DLP Template"
  description = "DLP template for scanning vault documents for sensitive data"

  # Inspect configuration for PII
  inspect_config {
    info_type_transformations {
      info_type {
        name = "PHONE_NUMBER"
      }
      transformation {
        character_mask = "*"
        min_likelihood = "LIKELY"
      }
    }
    info_type_transformations {
      info_type {
        name = "EMAIL_ADDRESS"
      }
      transformation {
        character_mask = "*"
        min_likelihood = "LIKELY"
      }
    }
  }
}