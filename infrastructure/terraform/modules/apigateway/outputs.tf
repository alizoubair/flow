output "ws_endpoint" {
  description = "WebSocket API endpoint (wss://)"
  value       = "wss://${aws_apigatewayv2_api.websocket.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
}

output "ws_api_id" {
  description = "WebSocket API ID — passed to the lambda module to build WS_ENDPOINT env var"
  value       = aws_apigatewayv2_api.websocket.id
}

output "ws_api_execution_arn" {
  description = "WebSocket API execution ARN — passed to the lambda module for IAM ManageConnections"
  value       = aws_apigatewayv2_api.websocket.execution_arn
}

output "http_api_endpoint" {
  description = "HTTP API endpoint for pipeline operations"
  value       = aws_apigatewayv2_stage.http.invoke_url
}

output "http_api_id" {
  description = "HTTP API ID"
  value       = aws_apigatewayv2_api.http.id
}
