output "gateway_id" {
  value = aws_bedrockagentcore_gateway.mcp.gateway_id
}

output "gateway_arn" {
  value = aws_bedrockagentcore_gateway.mcp.gateway_arn
}

output "gateway_url" {
  value = aws_bedrockagentcore_gateway.mcp.gateway_url
}

output "gateway_url_ssm_parameter" {
  value = aws_ssm_parameter.gateway_url.name
}
