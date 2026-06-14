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

variable "tool_name" {
  description = "Tool id; must match the directory name under source_root."
  type        = string
}

variable "source_root" {
  description = "Absolute path to the directory containing <tool_name>/lambda_function.py."
  type        = string
}

variable "secret_arns" {
  description = "Secrets Manager ARNs this Lambda may read (secretsmanager:GetSecretValue)."
  type        = list(string)
  default     = []
}

variable "env_vars" {
  description = "Extra environment variables for the tool Lambda."
  type        = map(string)
  default     = {}
}

variable "runtime" {
  type    = string
  default = "python3.12"
}

variable "timeout" {
  type    = number
  default = 30
}

variable "memory_size" {
  type    = number
  default = 256
}

variable "log_retention_days" {
  type    = number
  default = 14
}
