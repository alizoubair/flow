variable "aws_region" {
  type    = string
  default = "us-west-2"
}

variable "aws_profile" {
  type    = string
  default = "alizoubair"
}

variable "google_client_id" {
  type      = string
  sensitive = true
}

variable "google_client_secret" {
  type      = string
  sensitive = true
}

variable "github_client_id" {
  type      = string
  sensitive = true
  default   = ""
}

variable "github_client_secret" {
  type      = string
  sensitive = true
  default   = ""
}

variable "github_repo" {
  type    = string
  default = "alizoubair/flow"
}

variable "github_access_token" {
  type      = string
  sensitive = true
}

variable "enable_amplify_hosting" {
  description = "Deploy the React frontend to AWS Amplify Hosting"
  type        = bool
  default     = true
}

variable "amplify_branch_name" {
  description = "Git branch Amplify builds and hosts (also used in Cognito callback URLs)"
  type        = string
  default     = "main"
}

variable "orchestrator_model_id" {
  description = "Bedrock model ID for the Orchestrator agent"
  type        = string
  default     = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
}

variable "repo_analysis_model_id" {
  description = "Bedrock model ID for the Repo Analysis agent"
  type        = string
  default     = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
}

variable "pipeline_gen_model_id" {
  description = "Bedrock model ID for the Pipeline Generation agent"
  type        = string
  default     = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
}

variable "validation_model_id" {
  description = "Bedrock model ID for the Validation agent"
  type        = string
  default     = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
}

variable "export_model_id" {
  description = "Bedrock model ID for the Export agent"
  type        = string
  default     = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
}
