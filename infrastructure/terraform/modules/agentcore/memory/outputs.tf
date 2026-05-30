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
