variable "app_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "google_client_id" {
  type      = string
  sensitive = true
  default   = ""
}

variable "google_client_secret" {
  type      = string
  sensitive = true
  default   = ""
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

variable "amplify_default_domain" {
  description = "Amplify app default domain (for callback URLs)"
  type        = string
  default     = ""
}

variable "amplify_branch_name" {
  description = "Amplify branch name used in callback/logout URLs"
  type        = string
  default     = "main"
}
