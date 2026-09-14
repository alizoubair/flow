# ─── CI Orchestrator — durable execution Lambda ───────────────────────────────
#
# Standalone resource outside the for_each group pattern — requires
# durable_config which is a Lambda resource-level setting enabling the
# @durable_execution SDK decorator at runtime.

resource "aws_cloudwatch_log_group" "ci_orchestrator" {
  name              = "/aws/lambda/${var.app_name}-ci-orchestrator"
  retention_in_days = var.log_retention_days
}

data "archive_file" "ci_orchestrator" {
  type        = "zip"
  source_file = "${var.lambda_src_path}/ci-runner/orchestrator/handler.py"
  output_path = "${var.lambda_src_path}/.build/ci-orchestrator.zip"
}

resource "aws_iam_role" "ci_orchestrator" {
  name               = "${var.app_name}-ci-orchestrator-role"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

resource "aws_iam_role_policy_attachment" "ci_orchestrator_basic" {
  role       = aws_iam_role.ci_orchestrator.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "ci_orchestrator" {
  name = "${var.app_name}-ci-orchestrator-policy"
  role = aws_iam_role.ci_orchestrator.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "Logs"
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/lambda/${var.app_name}-ci-orchestrator:*"
      },
      {
        Sid      = "CiRunsTable"
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"]
        Resource = [var.ci_runs_table_arn, "${var.ci_runs_table_arn}/index/*"]
      },
      {
        Sid      = "PipelinesRead"
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem"]
        Resource = var.pipelines_table_arn
      },
      {
        Sid      = "WebSocketPush"
        Effect   = "Allow"
        Action   = ["execute-api:ManageConnections"]
        Resource = "${var.ws_api_execution_arn}/*"
      },
      {
        Sid    = "DurableExecution"
        Effect = "Allow"
        Action = [
          "lambda:CheckpointDurableExecution",
          "lambda:GetDurableExecution",
          "lambda:GetDurableExecutionHistory",
          "lambda:StopDurableExecution",
          "lambda:SendDurableExecutionCallbackSuccess",
          "lambda:SendDurableExecutionCallbackFailure",
        ]
        Resource = "arn:aws:lambda:${var.aws_region}:*:function:${var.app_name}-ci-orchestrator:*"
      },
      {
        Sid    = "MicroVMOrchestration"
        Effect = "Allow"
        Action = [
          "lambda:RunMicrovm",
          "lambda:GetMicrovm",
          "lambda:CreateMicrovmAuthToken",
          "lambda:TerminateMicrovm",
          "lambda:CreateMicrovmImage",
          "lambda:UpdateMicrovmImage",
          "lambda:GetMicrovmImage",
          "lambda:ListMicrovmImages",
          "lambda:ListMicrovmImageVersions",
          "lambda:GetMicrovmImageVersion",
          "lambda:ListManagedMicrovmImages",
          "lambda:ListManagedMicrovmImageVersions",
          "lambda:GetManagedMicrovmImage",
          "lambda:PassNetworkConnector",
        ]
        Resource = "*"
      },
      {
        Sid      = "PassMvmExecutionRole"
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = aws_iam_role.ci_runner.arn
      },
      {
        Sid    = "SsmRunnerHash"
        Effect = "Allow"
        Action = ["ssm:GetParameter", "ssm:PutParameter"]
        Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/flow/ci-runner/*"
      },
    ]
  })
}

resource "aws_lambda_function" "ci_orchestrator" {
  function_name    = "${var.app_name}-ci-orchestrator"
  role             = aws_iam_role.ci_orchestrator.arn
  runtime          = "python3.12"
  handler          = "handler.lambda_handler"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.ci_orchestrator.output_path
  source_code_hash = data.archive_file.ci_orchestrator.output_base64sha256

  layers = [aws_lambda_layer_version.ci_orchestrator_deps.arn]

  durable_config {
    execution_timeout = 28800 # 8 hours max
    retention_period  = 14    # days
  }

  environment {
    variables = {
      PROJECT_NAME            = var.app_name
      ENVIRONMENT             = var.environment
      CI_RUNS_TABLE           = var.ci_runs_table_name
      CI_ARTIFACTS_BUCKET     = var.ci_artifacts_bucket_name
      PIPELINES_TABLE         = var.pipelines_table_name
      MVM_IMAGE_URI           = local.mvm_image_arn
      MVM_EXECUTION_ROLE_ARN  = aws_iam_role.ci_runner.arn
      MVM_REGION              = var.aws_region
      GIT_PROVIDER_SECRET_ARN = var.git_secret_arn
      WS_ENDPOINT             = "https://${var.ws_api_id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
      FLOW_AWS_REGION         = var.aws_region
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.ci_orchestrator,
    aws_iam_role_policy.ci_orchestrator,
    aws_lambda_layer_version.ci_orchestrator_deps,
  ]
}
