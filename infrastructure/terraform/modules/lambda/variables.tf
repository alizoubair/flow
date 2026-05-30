variable "app_name" {
  type = string
}

variable "project_name" {
  description = "Project name injected into all lambda functions as PROJECT_NAME env var"
  type        = string
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "ws_connections_table_name" {
  type = string
}

variable "ws_connections_table_arn" {
  type = string
}

variable "pipelines_table_name" {
  description = "Name of the DynamoDB pipelines table"
  type        = string
}

variable "pipelines_table_arn" {
  description = "ARN of the DynamoDB pipelines table"
  type        = string
}

variable "lambda_src_path" {
  description = "Absolute path to the lambda/ source directory"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days for all lambda functions"
  type        = number
  default     = 14
}

variable "ws_api_id" {
  description = "ID of the WebSocket API Gateway (used to build WS_ENDPOINT env var)"
  type        = string
}

variable "ws_api_execution_arn" {
  description = "Execution ARN of the WebSocket API Gateway (used for IAM and lambda permissions)"
  type        = string
}

variable "orchestrator_runtime_id" {
  description = "ID of the orchestrator agent runtime"
  type        = string
  default     = ""
}

variable "orchestrator_runtime_arn" {
  description = "ARN of the orchestrator agent runtime"
  type        = string
  default     = ""
}

variable "conversations_table_name" {
  description = "Name of the DynamoDB conversations table"
  type        = string
}

variable "conversations_table_arn" {
  description = "ARN of the DynamoDB conversations table"
  type        = string
}
