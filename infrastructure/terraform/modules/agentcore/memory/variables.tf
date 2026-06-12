# Required Variables

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

# Memory Configuration

variable "event_expiry_days" {
  description = "Number of days before events expire"
  type        = number
  default     = 90
}

variable "enable_log_delivery" {
  description = "Deliver AgentCore memory APPLICATION_LOGS (extraction/consolidation) to CloudWatch Logs."
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Retention for the memory application log group"
  type        = number
  default     = 30
}

# Tags

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
