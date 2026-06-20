variable "app_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "enabled" {
  description = "Create Amplify Hosting resources"
  type        = bool
  default     = true
}

variable "repository" {
  description = "Git repository URL (e.g. https://github.com/org/flow). Leave empty to connect repo manually in the Amplify console."
  type        = string
  default     = ""
}

variable "access_token" {
  description = "Source provider personal access token (required when repository is set)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "build_spec" {
  description = "Optional custom amplify.yml build spec. Defaults to CRA build in amplify/."
  type        = string
  default     = ""
}

variable "branch_name" {
  description = "Primary Git branch for production hosting"
  type        = string
  default     = "main"
}

variable "tags" {
  type    = map(string)
  default = {}
}
