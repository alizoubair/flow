output "log_group_name" {
  description = "CloudWatch log group receiving APPLICATION_LOGS"
  value       = var.enable_application_logs ? aws_cloudwatch_log_group.logs[0].name : null
}

output "log_group_arn" {
  description = "CloudWatch log group ARN"
  value       = var.enable_application_logs ? aws_cloudwatch_log_group.logs[0].arn : null
}

output "logs_delivery_source_name" {
  description = "CloudWatch log delivery source name for APPLICATION_LOGS"
  value       = var.enable_application_logs ? aws_cloudwatch_log_delivery_source.logs[0].name : null
}

output "traces_delivery_source_name" {
  description = "CloudWatch log delivery source name for TRACES"
  value       = var.enable_traces ? aws_cloudwatch_log_delivery_source.traces[0].name : null
}
