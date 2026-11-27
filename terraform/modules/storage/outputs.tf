# Storage module outputs

output "bucket_name" {
  description = "Generated or custom bucket name"
  value       = google_storage_bucket.default.name
}

output "bucket_url" {
  description = "Full bucket URL"
  value       = "gs://${google_storage_bucket.default.name}"
}

output "iam_binding" {
  description = "Storage IAM binding"
  value       = google_storage_bucket_iam_binding.default.role
}

output "uniform_access" {
  description = "Whether uniform bucket-level access is enabled"
  value       = google_storage_bucket_iam_configuration.default.uniform_bucket_level_access
}