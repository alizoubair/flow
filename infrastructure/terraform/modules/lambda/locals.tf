locals {
  # Lambda group definitions.
  # Each group shares an IAM role and a common set of env vars and DynamoDB access.
  # Add a new group here to provision a full set of lambdas without touching main.tf.
  lambda_groups = {
    ws = {
      functions   = ["connect", "disconnect", "default", "orchestrator"]
      src_subdir  = "websocket" # lambda/<src_subdir>/<function>/handler.py
      runtime     = "python3.12"
      timeout     = 60
      memory_size = 512
      # No layer: handlers only use boto3 + botocore.exceptions, both provided
      # by the python3.12 runtime. A bundled layer previously shipped a broken
      # urllib3 that shadowed the runtime's and caused import errors.
      layer_arn = null
      env_vars = {
        CONNECTIONS_TABLE        = var.ws_connections_table_name
        CONVERSATIONS_TABLE      = var.conversations_table_name
        WS_ENDPOINT              = "https://${var.ws_api_id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
        ORCHESTRATOR_RUNTIME_ID  = var.orchestrator_runtime_id
        ORCHESTRATOR_RUNTIME_ARN = var.orchestrator_runtime_arn
        FLOW_AWS_REGION          = var.aws_region
      }
      dynamodb_arns = [
        var.ws_connections_table_arn,
        "${var.ws_connections_table_arn}/index/*",
        var.conversations_table_arn,
      ]
      extra_statements = [
        {
          Effect   = "Allow"
          Action   = ["execute-api:ManageConnections"]
          Resource = "${var.ws_api_execution_arn}/*"
        },
        {
          Effect = "Allow"
          Action = [
            "bedrock-agentcore:InvokeAgentRuntime",
            "bedrock-agentcore:GetAgentRuntime",
            "bedrock-agentcore:InvokeAgentRuntimeForUser",
            "bedrock-agentcore:InvokeAgentRuntimeWithWebSocketStream"
          ]
          Resource = var.orchestrator_runtime_arn != "" ? [
            var.orchestrator_runtime_arn,
            "${var.orchestrator_runtime_arn}/*"
          ] : ["*"]
        }
      ]
    }

    pipeline = {
      functions   = ["create", "get", "list", "update", "delete"]
      src_subdir  = "pipelines"
      runtime     = "python3.12"
      timeout     = 30
      memory_size = 256
      layer_arn   = aws_lambda_layer_version.pipeline_shared.arn
      env_vars = {
        PIPELINES_TABLE = var.pipelines_table_name
        FLOW_AWS_REGION = var.aws_region
      }
      dynamodb_arns = [
        var.pipelines_table_arn,
        "${var.pipelines_table_arn}/index/*",
      ]
      extra_statements = []
    }

    conversation = {
      functions   = ["list", "get", "delete"]
      src_subdir  = "conversations"
      runtime     = "python3.12"
      timeout     = 10
      memory_size = 128
      layer_arn   = null
      env_vars = {
        CONVERSATIONS_TABLE = var.conversations_table_name
        FLOW_AWS_REGION     = var.aws_region
      }
      dynamodb_arns = [
        var.conversations_table_arn,
      ]
      extra_statements = []
    }
  }

  # Flatten groups into a single map keyed by "<group>-<function>".
  # e.g. "ws-connect", "pipeline-create"
  all_functions = merge([
    for group_name, group in local.lambda_groups : {
      for fn in group.functions :
      "${group_name}-${fn}" => merge(group, {
        function = fn
        group    = group_name
        # Merge common env vars into every function, group-specific vars take precedence.
        env_vars = merge(group.env_vars, {
          PROJECT_NAME = var.project_name
          ENVIRONMENT  = var.environment
        })
      })
    }
  ]...)
}
