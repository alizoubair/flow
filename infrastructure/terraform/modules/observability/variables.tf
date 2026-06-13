variable "project_name" {
  description = "Project name prefix for delivery resource names"
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
}

variable "resource_name" {
  description = "AgentCore resource identifier used in log group path (e.g. gateway, memory)"
  type        = string
}

variable "resource_arn" {
  description = "ARN of the AgentCore resource to enable observability for"
  type        = string
}

variable "aws_region" {
  description = "AWS region (reserved for future use; delivery resources are regional via provider)"
  type        = string
}

variable "log_group_name" {
  description = "Optional override for the vended log group name. Defaults to /aws/vendedlogs/bedrock-agentcore/{resource_name}/{project_name}-{environment}"
  type        = string
  default     = null
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "enable_application_logs" {
  description = "Deliver APPLICATION_LOGS from the AgentCore resource to CloudWatch Logs"
  type        = bool
  default     = true
}

variable "enable_traces" {
  description = "Deliver TRACES from the AgentCore resource to X-Ray. Requires CloudWatch Transaction Search (account-level) for span ingestion."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags applied to all resources created by this module"
  type        = map(string)
  default     = {}
}
