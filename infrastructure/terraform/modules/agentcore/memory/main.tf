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
