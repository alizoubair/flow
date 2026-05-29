output "state_bucket_name" {
  description = "S3 bucket for Terraform remote state"
  value       = module.s3.state_bucket_name
}

output "cognito_user_pool_id" {
  value = module.cognito.user_pool_id
}

output "cognito_client_id" {
  value = module.cognito.client_id
}

output "cognito_domain" {
  value = module.cognito.hosted_ui_url
}

output "http_api_endpoint" {
  description = "HTTP API endpoint for pipeline operations"
  value       = module.apigateway.http_api_endpoint
}

output "ws_api_endpoint" {
  description = "WebSocket API endpoint"
  value       = module.apigateway.ws_endpoint
}

output "agentcore_memory_id" {
  description = "AgentCore memory ID"
  value       = module.agentcore_memory.memory_id
}

output "orchestrator_runtime_arn" {
  description = "Orchestrator agent runtime ARN"
  value       = module.orchestrator_runtime.agent_runtime_arn
}

output "orchestrator_runtime_id" {
  description = "Orchestrator agent runtime ID"
  value       = module.orchestrator_runtime.agent_runtime_id
}

output "artifacts_bucket_name" {
  description = "S3 bucket for pipeline artifacts"
  value       = module.s3.artifacts_bucket_name
}

output "ecr_repository_url" {
  description = "ECR repository URL for orchestrator container"
  value       = module.orchestrator_runtime.ecr_repository_url
}

output "codebuild_project_name" {
  description = "CodeBuild project name for building orchestrator container"
  value       = module.orchestrator_runtime.codebuild_project_name
}
