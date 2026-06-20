output "app_id" {
  description = "Amplify app ID"
  value       = var.enabled ? aws_amplify_app.frontend[0].id : null
}

output "app_arn" {
  description = "Amplify app ARN"
  value       = var.enabled ? aws_amplify_app.frontend[0].arn : null
}

output "default_domain" {
  description = "Amplify default domain suffix (e.g. d1234.amplifyapp.com). Branch URL is https://{branch}.{default_domain}"
  value       = var.enabled ? aws_amplify_app.frontend[0].default_domain : null
}

output "branch_name" {
  description = "Primary branch name used for hosting"
  value       = var.enabled ? var.branch_name : null
}

output "app_url" {
  description = "HTTPS URL for the primary branch"
  value = var.enabled ? "https://${var.branch_name}.${aws_amplify_app.frontend[0].default_domain}" : null
}
