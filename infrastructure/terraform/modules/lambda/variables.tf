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

variable "ci_runs_table_name" {
  description = "Name of the DynamoDB CI runs table"
  type        = string
}

variable "ci_runs_table_arn" {
  description = "ARN of the DynamoDB CI runs table"
  type        = string
}

variable "ci_artifacts_bucket_name" {
  description = "S3 bucket name for CI runner inter-stage artifact transit"
  type        = string
}

variable "ci_artifacts_bucket_arn" {
  description = "S3 bucket ARN for CI runner inter-stage artifact transit"
  type        = string
}

variable "source_s3_bucket" {
  description = "S3 bucket name used to store CodeBuild source zips"
  type        = string
}

variable "account_id" {
  description = "AWS account ID — used to compute MicroVM image ARN"
  type        = string
}

variable "aws_profile" {
  description = "AWS CLI profile used in local-exec provisioners"
  type        = string
  default     = ""
}

variable "git_secret_arn" {
  description = "Secrets Manager ARN for GitHub token — injected into runner MicroVM env"
  type        = string
}
