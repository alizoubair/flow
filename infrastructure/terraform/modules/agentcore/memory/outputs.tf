# AgentCore Memory Outputs

output "memory_id" {
  description = "ID of the AgentCore memory"
  value       = aws_bedrockagentcore_memory.memory.id
}

output "memory_arn" {
  description = "ARN of the AgentCore memory"
  value       = aws_bedrockagentcore_memory.memory.arn
}

output "memory_name" {
  description = "Name of the memory"
  value       = aws_bedrockagentcore_memory.memory.name
}

output "execution_role_arn" {
  description = "ARN of the memory execution IAM role"
  value       = aws_iam_role.memory_execution.arn
}

output "semantic_strategy_id" {
  description = "ID of the semantic memory strategy"
  value       = aws_bedrockagentcore_memory_strategy.semantic.memory_strategy_id
}

output "ssm_parameter_name" {
  description = "SSM parameter name for memory ID"
  value       = aws_ssm_parameter.memory_id.name
}

output "application_log_group_name" {
  description = "CloudWatch log group receiving memory APPLICATION_LOGS (extraction/consolidation)"
  value       = var.enable_log_delivery ? aws_cloudwatch_log_group.memory_app_logs[0].name : null
}
