variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "account_id" {
  type = string
}

variable "cognito_issuer_url" {
  description = "Cognito issuer URL, e.g. https://cognito-idp.<region>.amazonaws.com/<user_pool_id>"
  type        = string
}

variable "cognito_allowed_clients" {
  description = "Cognito app client IDs allowed to invoke the Gateway."
  type        = list(string)
}

variable "lambda_tool_arns" {
  description = "Map of tool id (schemas/<tool>.yaml) to Lambda function ARN."
  type        = map(string)
  default     = {}
}

variable "policy_engine_arn" {
  description = "ARN of an AgentCore policy engine to attach for Gateway tool authorization"
  type        = string
  default     = ""
}

variable "policy_engine_mode" {
  description = "Policy engine enforcement mode: LOG_ONLY (monitor) or ENFORCE"
  type        = string
  default     = "LOG_ONLY"

  validation {
    condition     = contains(["LOG_ONLY", "ENFORCE"], var.policy_engine_mode)
    error_message = "policy_engine_mode must be LOG_ONLY or ENFORCE."
  }
}

variable "tags" {
  type    = map(string)
  default = {}
}
