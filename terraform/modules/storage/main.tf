# Storage module - provisions Cloud Storage bucket with policy enforcement

resource "google_storage_bucket" "default" {
  name          = var.bucket_name != "" ? var.bucket_name : format("%s-%s", var.project_id, var.environment)
  location      = var.region
  storage_class = "STANDARD"
  force_destroy = var.environment != "prod"  # Safe destroy only for non-prod

  # Labels
  labels = merge(
    var.labels,
    {
      environment = var.environment
    }
  )

  # Default encryption (AES256)
  encryption_configuration {
    default encryption = "AES256"
  }

  # Lifecycle configuration for cost optimization
  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 365  # Delete objects after 1 year
    }
  }

  # CORS configuration for web access
  cors = [
    {
      origin      = ["*"]
      method      = ["GET", "PUT", "POST", "DELETE"]
      response_header = ["Content-Type"]
      max_age_seconds = 3600
    }
  ]
}

# Storage bucket IAM - least privilege
resource "google_storage_bucket_iam_binding" "default" {
  bucket = google_storage_bucket.default.name
  role   = "roles/storage.objectAdmin"
  members = [
    "serviceAccount:${var.project_id}@appspot.gserviceaccount.com",
  ]
}

# Storage bucket IAM member for authenticated users (least privilege)
resource "google_storage_bucket_iam_member" "authenticated" {
  bucket = google_storage_bucket.default.name
  role   = "roles/storage.objectViewer"
  member = "googleCloudAuthenticatedUsers"
}

# Enable uniform bucket-level access (least privilege)
resource "google_storage_bucket_iam_configuration" "default" {
  bucket = google_storage_bucket.default.name
  uniform_bucket_level_access = true
}

# Backup policy configuration
resource "google_storage_bucket_versioning" "default" {
  bucket = google_storage_bucket.default.name
  enabled = var.enable_versioning
}

# Retention configuration
resource "google_storage_bucket_retention_policy" "default" {
  bucket = google_storage_bucket.default.name
  retention_period = var.retention_days
  locked         = var.retention_locked
}