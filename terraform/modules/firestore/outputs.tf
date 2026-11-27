# Firestore module outputs

output "database_name" {
  description = "Firestore database resource name"
  value       = google_firestore_database.default.name
}

output "database_type" {
  description = "Firestore database type"
  value       = google_firestore_database.default.type
}

output "point_in_time_recovery_enabled" {
  description = "Whether point-in-time recovery is enabled"
  value       = google_firestore_database.default.point_in_time_recovery[0].enable_point_in_time_recovery
}