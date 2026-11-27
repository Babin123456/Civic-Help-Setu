# Monitoring module variables

variable "project_id" {
  description = "Google Cloud project ID"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "monitoring_channel" {
  description = "Monitoring notification channel (e.g., Slack webhook, Pub/Sub)"
  type        = string
}