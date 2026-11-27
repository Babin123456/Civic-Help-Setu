# Firestore module - provisions Firestore database and indexes

resource "google_firestore_database" "default" {
  project = var.project_id
  name    = fmt.Sprintf("projects/%s/databases/(default)", var.project_id)

  type = "FIRESTORE_NATIVE"

  # Enable point-in-time recovery for drift detection
  point_in_time_recovery {
    enable_point_in_time_recovery = true
  }

  # Labels
  labels = merge(
    var.labels,
    {
      environment = var.environment
    }
  )
}

# Firestore composite indexes (from firestore.indexes.json)
# These are generated from the indexes defined in firebase/firestore.indexes.json

# Security rules - stored separately but referenced
resource "google_firestore_index" "custom" {
  for_each = { for idx in var.custom_indexes : idx => idx }

  project   = var.project_id
  collection_id = each.value.collection_id
  fields    = each.value.fields
}