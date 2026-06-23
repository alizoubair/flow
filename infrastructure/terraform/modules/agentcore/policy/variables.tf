variable "project_name" {
  description = "Project name prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "account_id" {
  description = "AWS account ID"
  type        = string
}

variable "gateway_arn" {
  description = "ARN of the MCP Gateway these policies apply to. Pass module.gateway.gateway_arn after the Gateway exists."
  type        = string
}

variable "create_policy_engine" {
  description = "Create the AgentCore policy engine resource"
  type        = bool
  default     = true
}

variable "create_cedar_policies" {
  description = "Create Cedar policy documents on the policy engine"
  type        = bool
  default     = true
}

variable "policy_engine_id" {
  description = "Existing policy engine ID when create_policy_engine is false"
  type        = string
  default     = ""

  validation {
    condition     = var.create_policy_engine || var.policy_engine_id != ""
    error_message = "policy_engine_id is required when create_policy_engine is false."
  }
}

variable "policy_engine_name" {
  description = "Override for the policy engine name (letters, numbers, underscores only). Defaults to {project}_{environment}_gateway."
  type        = string
  default     = null
}

variable "description" {
  description = "Description for the policy engine"
  type        = string
  default     = "Cedar policy engine for AgentCore MCP Gateway tool authorization"
}

variable "validation_mode" {
  description = "Cedar analyzer validation mode for policies (FAIL_ON_ANY_FINDINGS or IGNORE_ALL_FINDINGS)"
  type        = string
  default     = "FAIL_ON_ANY_FINDINGS"

  validation {
    condition     = contains(["FAIL_ON_ANY_FINDINGS", "IGNORE_ALL_FINDINGS"], var.validation_mode)
    error_message = "validation_mode must be FAIL_ON_ANY_FINDINGS or IGNORE_ALL_FINDINGS."
  }
}

variable "enable_default_source_control_policies" {
  description = "Create default permit/forbid Cedar policies for the source-control Gateway target"
  type        = bool
  default     = true
}

variable "source_control_target_name" {
  description = "Gateway target name used in Cedar action identifiers (TargetName___toolName)"
  type        = string
  default     = "source-control"
}

variable "policies" {
  description = "Additional Cedar policies keyed by policy name. Each value is a Cedar statement string referencing the Gateway ARN."
  type        = map(string)
  default     = {}
}

variable "tags" {
  description = "Tags applied to the policy engine"
  type        = map(string)
  default     = {}
}
