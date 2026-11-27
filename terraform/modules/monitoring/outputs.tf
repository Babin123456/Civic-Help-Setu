# Monitoring module outputs

output "monitoring_dashboard_url" {
  description = "Cloud Monitoring dashboard URL"
  value       = "https://console.cloud.google.com/monitoring"
}

output "alert_policy_names" {
  description = "List of alert policy names created"
  value       = [
    "policy_drift_alert",
    "public_exposure_alert",
    "encryption_alert",
  ]
}

output "metric_descriptions" {
  description = "Description of custom metrics"
  value = {
    policy_drift            = "Counts policy drift events per environment"
    storage_public_access   = "Detects public access to storage buckets"
    storage_encryption     = "Status of storage encryption (1 = enabled, 0 = disabled)"
    firestore_health       = "Firestore instance health status"
    storage_health         = "Storage instance health status"
  }
}