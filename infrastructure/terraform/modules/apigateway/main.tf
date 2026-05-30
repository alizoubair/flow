# WebSocket API

resource "aws_apigatewayv2_api" "websocket" {
  name                       = "${var.app_name}-ws-api"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
  tags                       = { Name = "${var.app_name}-ws-api" }
}

# WebSocket routes and integrations

locals {
  ws_routes = {
    "$connect"      = var.ws_invoke_arns["ws-connect"]
    "$disconnect"   = var.ws_invoke_arns["ws-disconnect"]
    "$default"      = var.ws_invoke_arns["ws-default"]
    "orchestrator"  = var.ws_invoke_arns["ws-orchestrator"]
  }
}

resource "aws_apigatewayv2_integration" "ws" {
  for_each                  = local.ws_routes
  api_id                    = aws_apigatewayv2_api.websocket.id
  integration_type          = "AWS_PROXY"
  integration_uri           = each.value
  content_handling_strategy = "CONVERT_TO_TEXT"
}

resource "aws_apigatewayv2_route" "ws" {
  for_each  = local.ws_routes
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.ws[each.key].id}"
}

resource "aws_lambda_permission" "ws_api" {
  for_each = var.ws_function_names

  statement_id  = "AllowWSAPIInvoke-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = each.value
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*"
}

resource "aws_apigatewayv2_stage" "websocket" {
  api_id      = aws_apigatewayv2_api.websocket.id
  name        = var.environment
  auto_deploy = true

  tags = { Name = "${var.app_name}-ws-${var.environment}" }

  default_route_settings {
    data_trace_enabled       = false
    detailed_metrics_enabled = false
    logging_level            = "OFF"
    throttling_burst_limit   = 100
    throttling_rate_limit    = 50
  }
}

# HTTP API

resource "aws_apigatewayv2_api" "http" {
  name          = "${var.app_name}-http-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["http://localhost:3000", "https://*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 300
  }

  tags = { Name = "${var.app_name}-http-api" }
}

# Cognito JWT authorizer

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.http.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.app_name}-cognito-authorizer"

  jwt_configuration {
    audience = [var.cognito_client_id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${var.cognito_user_pool_id}"
  }
}

# Pipeline routes and integrations

locals {
  pipeline_routes = {
    "POST /pipelines"        = var.pipeline_function_arns["pipeline-create"]
    "GET /pipelines"         = var.pipeline_function_arns["pipeline-list"]
    "GET /pipelines/{id}"    = var.pipeline_function_arns["pipeline-get"]
    "PUT /pipelines/{id}"    = var.pipeline_function_arns["pipeline-update"]
    "DELETE /pipelines/{id}" = var.pipeline_function_arns["pipeline-delete"]
  }
}

resource "aws_apigatewayv2_integration" "pipeline" {
  for_each = local.pipeline_routes

  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = each.value
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "pipeline" {
  for_each = local.pipeline_routes

  api_id             = aws_apigatewayv2_api.http.id
  route_key          = each.key
  target             = "integrations/${aws_apigatewayv2_integration.pipeline[each.key].id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "http_api" {
  for_each = merge(var.pipeline_function_names, var.conversation_function_names)

  statement_id  = "AllowHTTPAPIInvoke-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = each.value
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# Conversation routes

locals {
  conversation_routes = {
    "GET /conversations" = var.conversation_function_arns["conversation-list"]
  }
}

resource "aws_apigatewayv2_integration" "conversation" {
  for_each = local.conversation_routes

  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = each.value
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "conversation" {
  for_each = local.conversation_routes

  api_id             = aws_apigatewayv2_api.http.id
  route_key          = each.key
  target             = "integrations/${aws_apigatewayv2_integration.conversation[each.key].id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_stage" "http" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = var.environment
  auto_deploy = true

  tags = { Name = "${var.app_name}-http-${var.environment}" }
}
