locals {
  memory_name = replace("${var.project_name}_${var.environment}_memory", "-", "_")
}

# Memory Execution Role
resource "aws_iam_role" "memory_execution" {
  name = "${var.project_name}-${var.environment}-memory-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "bedrock-agentcore.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

# Attach managed policy for Bedrock model inference
resource "aws_iam_role_policy_attachment" "memory_bedrock" {
  role       = aws_iam_role.memory_execution.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonBedrockAgentCoreMemoryBedrockModelInferenceExecutionRolePolicy"
}

# AgentCore Memory
resource "aws_bedrockagentcore_memory" "memory" {
  name                      = local.memory_name
  description               = "Agent memory for ${var.project_name} ${var.environment}"
  event_expiry_duration     = var.event_expiry_days
  memory_execution_role_arn = aws_iam_role.memory_execution.arn

  tags = merge(
    var.tags,
    {
      Component = "memory"
    }
  )

  depends_on = [aws_iam_role.memory_execution]
}

# Memory Strategy: Semantic
resource "aws_bedrockagentcore_memory_strategy" "semantic" {
  name       = "semantic_fact_extraction"
  memory_id  = aws_bedrockagentcore_memory.memory.id
  type       = "SEMANTIC"
  namespaces = ["/strategies/{memoryStrategyId}/actors/{actorId}"]
}

# SSM Parameter for Memory ID
resource "aws_ssm_parameter" "memory_id" {
  name  = "/${var.project_name}/${var.environment}/memory/memory-id"
  type  = "String"
  value = aws_bedrockagentcore_memory.memory.id

  tags = var.tags
}

# --- Memory observability: deliver APPLICATION_LOGS to CloudWatch Logs ---
# Without this, the memory resource emits default metrics only; the
# extraction/consolidation application logs are never delivered anywhere.
# This is the IaC equivalent of the console "Enable observability" toggle.
# (Trace/span ingestion additionally requires CloudWatch Transaction Search,
# which is a one-time account-level setting.)

# Vended-log destination group. CloudWatch requires the /aws/vendedlogs/ prefix.
resource "aws_cloudwatch_log_group" "memory_app_logs" {
  count             = var.enable_log_delivery ? 1 : 0
  name              = "/aws/vendedlogs/bedrock-agentcore/memory/APPLICATION_LOGS/${aws_bedrockagentcore_memory.memory.id}"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

resource "aws_cloudwatch_log_delivery_source" "memory_app_logs" {
  count        = var.enable_log_delivery ? 1 : 0
  name         = "${local.memory_name}-app-logs"
  log_type     = "APPLICATION_LOGS"
  resource_arn = aws_bedrockagentcore_memory.memory.arn

  tags = var.tags
}

resource "aws_cloudwatch_log_delivery_destination" "memory_app_logs" {
  count = var.enable_log_delivery ? 1 : 0
  name  = "${local.memory_name}-app-logs-dest"

  delivery_destination_configuration {
    destination_resource_arn = aws_cloudwatch_log_group.memory_app_logs[0].arn
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_delivery" "memory_app_logs" {
  count                    = var.enable_log_delivery ? 1 : 0
  delivery_source_name     = aws_cloudwatch_log_delivery_source.memory_app_logs[0].name
  delivery_destination_arn = aws_cloudwatch_log_delivery_destination.memory_app_logs[0].arn

  tags = var.tags
}
