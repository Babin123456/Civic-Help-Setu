# Identity module variables

variable "project_id" {
  description = "Google Cloud project ID"
  type        = string
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

variable "clerk_api_key" {
  description = "Clerk publishable API key"
  type        = string
  sensitive   = true
}

# Identity posture configuration
variable "enforce_least_privilege" {
  description = "Whether to enforce least privilege IAM boundaries"
  type        = bool
  default     = true
}

variable "enable_dlp_inspection" {
  description = "Whether to enable DLP inspection for PII scanning"
  type        = bool
  default     = true
}