locals {
  prefix = "${var.project_name}-${var.environment}-${var.resource_name}"

  log_group_name = coalesce(
    var.log_group_name,
    "/aws/vendedlogs/bedrock-agentcore/${var.resource_name}/${var.project_name}-${var.environment}"
  )
}

# CloudWatch log group (destination for APPLICATION_LOGS)

resource "aws_cloudwatch_log_group" "logs" {
  count = var.enable_application_logs ? 1 : 0

  name              = local.log_group_name
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# Delivery sources

resource "aws_cloudwatch_log_delivery_source" "logs" {
  count = var.enable_application_logs ? 1 : 0

  name         = "${local.prefix}-logs"
  log_type     = "APPLICATION_LOGS"
  resource_arn = var.resource_arn

  tags = var.tags
}

resource "aws_cloudwatch_log_delivery_source" "traces" {
  count = var.enable_traces ? 1 : 0

  name         = "${local.prefix}-traces"
  log_type     = "TRACES"
  resource_arn = var.resource_arn

  tags = var.tags
}

# Delivery destinations

resource "aws_cloudwatch_log_delivery_destination" "logs" {
  count = var.enable_application_logs ? 1 : 0

  name = "${local.prefix}-logs-dest"

  delivery_destination_configuration {
    destination_resource_arn = aws_cloudwatch_log_group.logs[0].arn
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_delivery_destination" "traces" {
  count = var.enable_traces ? 1 : 0

  name                      = "${local.prefix}-traces-dest"
  delivery_destination_type = "XRAY"

  tags = var.tags
}

# Deliveries (source -> destination)

resource "aws_cloudwatch_log_delivery" "logs" {
  count = var.enable_application_logs ? 1 : 0

  delivery_source_name     = aws_cloudwatch_log_delivery_source.logs[0].name
  delivery_destination_arn = aws_cloudwatch_log_delivery_destination.logs[0].arn

  tags = var.tags
}

resource "aws_cloudwatch_log_delivery" "traces" {
  count = var.enable_traces ? 1 : 0

  delivery_source_name     = aws_cloudwatch_log_delivery_source.traces[0].name
  delivery_destination_arn = aws_cloudwatch_log_delivery_destination.traces[0].arn

  tags = var.tags
}
