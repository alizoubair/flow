output "user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  value = aws_cognito_user_pool.main.arn
}

output "client_id" {
  value = aws_cognito_user_pool_client.app.id
}

output "domain" {
  value = "${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "hosted_ui_url" {
  value = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "gateway_m2m_client_id" {
  value = aws_cognito_user_pool_client.gateway_m2m.id
}

output "gateway_m2m_client_secret" {
  value     = aws_cognito_user_pool_client.gateway_m2m.client_secret
  sensitive = true
}

output "gateway_m2m_scope" {
  value = "${aws_cognito_resource_server.gateway.identifier}/invoke"
}
