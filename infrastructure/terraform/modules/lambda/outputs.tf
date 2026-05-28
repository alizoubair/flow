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
