# AgentCore Runtime Outputs

output "agent_runtime_arn" {
  description = "ARN of the Bedrock AgentCore agent runtime"
  value       = aws_bedrockagentcore_agent_runtime.agent_runtime.agent_runtime_arn
}

output "agent_runtime_id" {
  description = "ID of the Bedrock AgentCore agent runtime"
  value       = aws_bedrockagentcore_agent_runtime.agent_runtime.agent_runtime_id
}

output "agent_runtime_name" {
  description = "Name of the agent runtime"
  value       = aws_bedrockagentcore_agent_runtime.agent_runtime.agent_runtime_name
}

output "execution_role_arn" {
  description = "ARN of the execution IAM role"
  value       = aws_iam_role.runtime_execution_role.arn
}

output "execution_role_name" {
  description = "Name of the execution IAM role"
  value       = aws_iam_role.runtime_execution_role.name
}

output "log_group_name" {
  description = "Name of the CloudWatch log group (auto-created by AgentCore)"
  value       = "/aws/bedrock-agentcore/runtimes/${aws_bedrockagentcore_agent_runtime.agent_runtime.agent_runtime_id}-DEFAULT"
}

output "ssm_parameter_arn" {
  description = "SSM parameter ARN for runtime ARN"
  value       = aws_ssm_parameter.runtime_arn.name
}

output "ssm_parameter_id" {
  description = "SSM parameter name for runtime ID"
  value       = aws_ssm_parameter.runtime_id.name
}

output "ecr_repository_url" {
  description = "ECR repository URL for the runtime container"
  value       = var.container_uri == "" ? aws_ecr_repository.container_repo[0].repository_url : null
}

output "ecr_repository_arn" {
  description = "ECR repository ARN"
  value       = var.container_uri == "" ? aws_ecr_repository.container_repo[0].arn : null
}

output "codebuild_project_name" {
  description = "Name of the CodeBuild project"
  value       = var.enable_codebuild ? aws_codebuild_project.container_build[0].name : null
}

output "codebuild_project_arn" {
  description = "ARN of the CodeBuild project"
  value       = var.enable_codebuild ? aws_codebuild_project.container_build[0].arn : null
}

output "codebuild_role_arn" {
  description = "ARN of the CodeBuild service role"
  value       = var.enable_codebuild ? aws_iam_role.codebuild_role[0].arn : null
}
