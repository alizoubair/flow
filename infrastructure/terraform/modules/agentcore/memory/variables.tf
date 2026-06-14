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

# Tags

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
