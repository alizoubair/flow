# Shared layer for pipeline handlers (db_utils / validators)

data "archive_file" "pipeline_shared_layer" {
  type        = "zip"
  source_dir  = "${var.lambda_src_path}/shared"
  output_path = "${var.lambda_src_path}/.build/pipeline-shared-layer.zip"
}

resource "aws_lambda_layer_version" "pipeline_shared" {
  layer_name          = "${var.app_name}-pipeline-shared"
  filename            = data.archive_file.pipeline_shared_layer.output_path
  source_code_hash    = data.archive_file.pipeline_shared_layer.output_base64sha256
  compatible_runtimes = ["python3.12"]
}

# Shared layer for websocket handlers (websockets library)

data "archive_file" "websocket_shared_layer" {
  type        = "zip"
  source_dir  = "${var.lambda_src_path}/websocket"
  output_path = "${var.lambda_src_path}/.build/websocket-shared-layer.zip"
  excludes    = ["connect", "disconnect", "default", "orchestrator", "requirements.txt"]
}

resource "aws_lambda_layer_version" "websocket_shared" {
  layer_name          = "${var.app_name}-websocket-shared"
  filename            = data.archive_file.websocket_shared_layer.output_path
  source_code_hash    = data.archive_file.websocket_shared_layer.output_base64sha256
  compatible_runtimes = ["python3.12"]
}

# Zip archives, one per function

data "archive_file" "fn" {
  for_each    = local.all_functions
  type        = "zip"
  source_file = "${var.lambda_src_path}/${each.value.src_subdir}/${each.value.function}/handler.py"
  output_path = "${var.lambda_src_path}/.build/${each.key}.zip"
}

# CloudWatch log groups, one per function

resource "aws_cloudwatch_log_group" "fn" {
  for_each = local.all_functions

  name              = "/aws/lambda/${var.app_name}-${each.key}"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.app_name}-${each.key}"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Lambda functions

resource "aws_lambda_function" "main" {
  for_each = local.all_functions

  function_name    = "${var.app_name}-${each.key}"
  filename         = data.archive_file.fn[each.key].output_path
  source_code_hash = data.archive_file.fn[each.key].output_base64sha256
  role             = aws_iam_role.lambda[each.value.group].arn
  handler          = "handler.lambda_handler"
  runtime          = each.value.runtime
  timeout          = each.value.timeout
  memory_size      = each.value.memory_size

  layers = each.value.layer_arn != null ? [each.value.layer_arn] : []

  environment {
    variables = each.value.env_vars
  }

  depends_on = [
    aws_iam_role_policy_attachment.basic,
    aws_cloudwatch_log_group.fn,
  ]
}
