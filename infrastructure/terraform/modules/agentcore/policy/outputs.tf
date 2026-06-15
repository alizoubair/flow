output "policy_engine_id" {
  description = "AgentCore policy engine ID"
  value       = local.policy_engine_id
}

output "policy_engine_arn" {
  description = "AgentCore policy engine ARN (attach to Gateway policy_engine_configuration)"
  value       = var.create_policy_engine ? aws_bedrockagentcore_policy_engine.gateway[0].policy_engine_arn : null
}

output "policy_engine_name" {
  description = "AgentCore policy engine name"
  value       = var.create_policy_engine ? aws_bedrockagentcore_policy_engine.gateway[0].name : null
}

output "policy_ids" {
  description = "Map of policy name to policy ID"
  value       = { for name, policy in aws_bedrockagentcore_policy.gateway_cedar : name => policy.policy_id }
}

output "policy_arns" {
  description = "Map of policy name to policy ARN"
  value       = { for name, policy in aws_bedrockagentcore_policy.gateway_cedar : name => policy.policy_arn }
}
