variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "component_name" {
  description = "Name of the component/agent"
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

variable "aws_profile" {
  description = "AWS CLI profile name for local-exec provisioners"
  type        = string
  default     = ""
}

variable "container_uri" {
  description = "ECR container URI for the agent runtime (optional if using CodeBuild)"
  type        = string
  default     = ""
}

variable "image_tag" {
  description = "Docker image tag for the runtime container"
  type        = string
  default     = "latest"
}

variable "protocol" {
  description = "Runtime protocol (MCP, A2A, HTTP)"
  type        = string
  default     = "HTTP"

  validation {
    condition     = contains(["MCP", "A2A", "HTTP"], var.protocol)
    error_message = "protocol must be one of: MCP, A2A, HTTP"
  }
}

variable "runtime_mode" {
  description = "Runtime mode (standard, orchestrator)"
  type        = string
  default     = "standard"

  validation {
    condition     = contains(["standard", "orchestrator"], var.runtime_mode)
    error_message = "runtime_mode must be one of: standard, orchestrator"
  }
}

variable "runtime_description" {
  description = "Description of the agent runtime"
  type        = string
  default     = "Bedrock AgentCore runtime for CI/CD pipeline orchestration"
}

variable "network_mode" {
  description = "Network mode (PUBLIC or VPC)"
  type        = string
  default     = "PUBLIC"

  validation {
    condition     = contains(["PUBLIC", "VPC"], var.network_mode)
    error_message = "network_mode must be either PUBLIC or VPC"
  }
}

variable "subnet_ids" {
  description = "List of subnet IDs for VPC mode"
  type        = list(string)
  default     = []
}

variable "security_group_ids" {
  description = "List of security group IDs for VPC mode"
  type        = list(string)
  default     = []
}

variable "cognito_issuer_url" {
  description = "Cognito issuer URL for JWT authentication"
  type        = string
  default     = ""
}

variable "cognito_allowed_clients" {
  description = "List of allowed Cognito client IDs"
  type        = list(string)
  default     = []
}

variable "enable_codebuild" {
  description = "Enable CodeBuild for building container images"
  type        = bool
  default     = false
}

variable "source_s3_bucket" {
  description = "S3 bucket containing source code for CodeBuild"
  type        = string
  default     = ""
}

variable "source_s3_key" {
  description = "S3 key (path) to source code zip for CodeBuild"
  type        = string
  default     = ""
}

variable "buildspec_path" {
  description = "Path to buildspec.yml file for CodeBuild"
  type        = string
  default     = "buildspec.yml"
}

variable "codebuild_compute_type" {
  description = "CodeBuild compute type"
  type        = string
  default     = "BUILD_GENERAL1_SMALL"
}

variable "codebuild_image" {
  description = "CodeBuild Docker image"
  type        = string
  default     = "aws/codebuild/standard:7.0"
}

variable "artifact_bucket_arn" {
  description = "S3 bucket ARN for artifacts (required for orchestrator mode)"
  type        = string
  default     = ""
}

variable "dynamodb_table_arns" {
  description = "List of DynamoDB table ARNs to grant access"
  type        = list(string)
  default     = []
}

variable "secrets_manager_arns" {
  description = "List of Secrets Manager ARNs to grant access"
  type        = list(string)
  default     = []
}

variable "extra_env_vars" {
  description = "Additional environment variables for the runtime"
  type        = map(string)
  default     = {}
}

variable "enable_observability" {
  description = "Enable ADOT observability (span/log export to CloudWatch). Requires aws-opentelemetry-distro in the agent image and launch via opentelemetry-instrument."
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "agent_source_path" {
  description = "Path to the agent source code directory (relative to terraform root)"
  type        = string
  default     = ""
}

variable "ws_api_execution_arn" {
  description = "WebSocket API execution ARN for ManageConnections permission (orchestrator only)"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
