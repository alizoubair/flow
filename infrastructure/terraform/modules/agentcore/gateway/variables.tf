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

variable "tags" {
  type    = map(string)
  default = {}
}
