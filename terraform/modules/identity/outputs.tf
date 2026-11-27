# Identity module outputs

output "least_privilege_status" {
  description = "Whether least privilege IAM is enforced"
  value       = google_project_iam_member.least_privilege != null
}

output "dlp_inspection_enabled" {
  description = "Whether DLP inspection is enabled"
  value       = google_dlp_inspect_template.vault_data != null
}

output "clerk_configuration" {
  description = "Clerk config summary (key redacted)"
  value       = var.clerk_api_key != "" ? "Configured" : "Not configured"
  sensitive   = true
}