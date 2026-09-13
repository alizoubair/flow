output "pipeline_function_arns" {
  value = { for k, v in aws_lambda_function.main : k => v.arn if startswith(k, "pipeline-") }
}

output "pipeline_function_names" {
  value = { for k, v in aws_lambda_function.main : k => v.function_name if startswith(k, "pipeline-") }
}

output "ws_invoke_arns" {
  value = { for k, v in aws_lambda_function.main : k => v.invoke_arn if startswith(k, "ws-") }
}

output "ws_function_names" {
  value = { for k, v in aws_lambda_function.main : k => v.function_name if startswith(k, "ws-") }
}

output "conversation_function_arns" {
  value = { for k, v in aws_lambda_function.main : k => v.arn if startswith(k, "conversation-") }
}

output "conversation_function_names" {
  value = { for k, v in aws_lambda_function.main : k => v.function_name if startswith(k, "conversation-") }
}

output "ci_orchestrator_function_name" {
  description = "CI orchestrator Lambda function name"
  value       = aws_lambda_function.ci_orchestrator.function_name
}

output "ci_orchestrator_invoke_arn" {
  description = "CI orchestrator Lambda invoke ARN"
  value       = aws_lambda_function.ci_orchestrator.invoke_arn
}

output "ci_runner_image_arn" {
  description = "Lambda MicroVM image ARN — passed as imageIdentifier to run_microvm()"
  value       = local.mvm_image_arn
}

output "ci_runner_execution_role_arn" {
  description = "IAM role ARN passed as executionRoleArn to run_microvm()"
  value       = aws_iam_role.ci_runner.arn
}
