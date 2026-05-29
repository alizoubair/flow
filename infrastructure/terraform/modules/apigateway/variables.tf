variable "app_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

# Passed in from the lambda module after ws functions are created
variable "ws_invoke_arns" {
  description = "Map of ws-<function> => invoke ARN for WebSocket lambda functions"
  type        = map(string)
}

variable "ws_function_names" {
  description = "Map of ws-<function> => function name, used to grant API Gateway invoke permission"
  type        = map(string)
}

# Pipeline Lambda functions for HTTP API
variable "pipeline_function_arns" {
  description = "Map of pipeline-<function> => ARN for pipeline lambda functions"
  type        = map(string)
}

variable "pipeline_function_names" {
  description = "Map of pipeline-<function> => function name for pipeline lambda functions"
  type        = map(string)
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID for JWT authorizer"
  type        = string
}

variable "cognito_client_id" {
  description = "Cognito App Client ID for JWT authorizer"
  type        = string
}
