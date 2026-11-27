# Firestore module variables

variable "project_id" {
  description = "Google Cloud project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "labels" {
  description = "Map of labels to apply to resources"
  type        = map(string)
  default     = {}
}

variable "custom_indexes" {
  description = "Custom Firestore composite indexes"
  type = list(object({
    collection_id = string
    fields = list(object({
      field       = string
      order       = string  # "ASCENDING" or "DESCENDING"
      value_type  = string  # "string", "number", "boolean"
    }))
  }))
  default = []
}

variable "enable_auto_id" {
  description = "Enable auto-id generation"
  type        = bool
  default     = true
}