# Monitoring module - provisions Cloud Monitoring and alerting

# Metrics pipeline for infrastructure health
# Cloud Monitoring metrics for drift detection

# Custom metric for policy drift
metric "policy_drift" {
  counter {
    metric_kind = "DELTA"
    value_type  = "DOUBLE"
    labels = {
      environment = var.environment
      resource    = "all"
    }
  }
}

# Alert policy for policy drift detection
alert_policy "policy_drift_alert" {
  display_name = "Policy Drift Detection - ${var.environment}"
  conditions {
    condition {
      filter = "metric.type=\"custom.googleapis.com/policy_drift\" AND resource.label.environment=\"${var.environment}\""
      duration = "300s"
      threshold = 1
      comparison = "COMPARISON_GT"
    }
  }
  notification_channels = [var.monitoring_channel]
  severity = "ERROR"
}

# Alert for public exposure detection
alert_policy "public_exposure_alert" {
  display_name = "Public Exposure Detection - ${var.environment}"
  conditions {
    condition {
      filter = "metric.type=\"custom.googleapis.com/storage_public_access\" AND resource.label.environment=\"${var.environment}\""
      duration = "300s"
      threshold = 0
      comparison = "COMPARISON_GT"
    }
  }
  notification_channels = [var.monitoring_channel]
  severity = "CRITICAL"
}

# Alert for encryption status
alert_policy "encryption_alert" {
  display_name = "Encryption Status Monitoring - ${var.environment}"
  conditions {
    condition {
      filter = "metric.type=\"custom.googleapis.com/storage_encryption\" AND resource.label.environment=\"${var.environment}\""
      duration = "600s"
      threshold = 0
      comparison = "COMPARISON_LT"
    }
  }
  notification_channels = [var.monitoring_channel]
  severity = "WARNING"
}

# Health check for Firestore
metric "firestore_health" {
  counter {
    metric_kind = "GAUGE"
    value_type  = "INT64"
    labels = {
      environment = var.environment
      resource    = "firestore"
    }
  }
}

# Health check for Storage
metric "storage_health" {
  counter {
    metric_kind = "GAUGE"
    value_type  = "INT64"
    labels = {
      environment = var.environment
      resource    = "storage"
    }
  }
}