locals {
  src_dir = "${var.source_root}/${var.tool_name}"
  fn_name = "${var.project_name}-${var.environment}-tool-${var.tool_name}"
}

# Zip archive for the tool Lambda (stdlib-only; no pip build step)

data "archive_file" "tool" {
  type        = "zip"
  source_dir  = local.src_dir
  output_path = "${path.module}/.build/${var.tool_name}.zip"
}

# Gateway tool Lambda execution role

resource "aws_iam_role" "gateway_tool" {
  name = "${local.fn_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "gateway_tool_logs" {
  name = "logs"
  role = aws_iam_role.gateway_tool.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "arn:aws:logs:${var.aws_region}:${var.account_id}:*"
    }]
  })
}

resource "aws_iam_role_policy" "gateway_tool_secrets" {
  count = length(var.secret_arns) > 0 ? 1 : 0
  name  = "secrets"
  role  = aws_iam_role.gateway_tool.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = var.secret_arns
    }]
  })
}

# CloudWatch log group

resource "aws_cloudwatch_log_group" "gateway_tool" {
  name              = "/aws/lambda/${local.fn_name}"
  retention_in_days = var.log_retention_days
}

# Gateway tool Lambda

resource "aws_lambda_function" "gateway_tool" {
  function_name    = local.fn_name
  role             = aws_iam_role.gateway_tool.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = var.runtime
  timeout          = var.timeout
  memory_size      = var.memory_size
  filename         = data.archive_file.tool.output_path
  source_code_hash = data.archive_file.tool.output_base64sha256

  environment {
    variables = merge(
      {
        PROJECT_NAME = var.project_name
        ENVIRONMENT  = var.environment
      },
      var.env_vars,
    )
  }

  depends_on = [
    aws_cloudwatch_log_group.gateway_tool,
    aws_iam_role_policy.gateway_tool_logs,
  ]
}
