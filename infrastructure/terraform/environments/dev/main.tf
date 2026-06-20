# Data Sources

data "aws_caller_identity" "current" {}

# S3 (Terraform remote state bucket)
# Run once with local state, then uncomment backend.tf and run terraform init -migrate-state

module "s3" {
  source     = "../../modules/s3"
  app_name   = local.app_name
  aws_region = var.aws_region
  account_id = data.aws_caller_identity.current.account_id
}

# DynamoDB

module "dynamodb" {
  source      = "../../modules/dynamodb"
  app_name    = local.app_name
  environment = local.environment
}

# Amplify Hosting — app only; branch is wired after API Gateway (avoids Cognito cycle)

module "amplify_app" {
  source = "../../modules/amplify"

  app_name    = local.app_name
  environment = local.environment
  enabled     = var.enable_amplify_hosting

  repository   = var.enable_amplify_hosting && var.github_repo != "" ? "https://github.com/${var.github_repo}" : ""
  access_token = var.github_access_token
  branch_name  = var.amplify_branch_name

  tags = {
    Project     = local.app_name
    Environment = local.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_amplify_branch" "frontend_main" {
  count = var.enable_amplify_hosting ? 1 : 0

  app_id      = module.amplify_app.app_id
  branch_name = var.amplify_branch_name
  stage       = "PRODUCTION"
  framework   = "React"

  enable_auto_build = var.github_repo != ""

  environment_variables = {
    REACT_APP_API_URL              = module.apigateway.http_api_endpoint
    REACT_APP_WS_API_URL           = module.apigateway.ws_endpoint
    REACT_APP_COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    REACT_APP_COGNITO_CLIENT_ID    = module.cognito.client_id
    REACT_APP_COGNITO_DOMAIN       = module.cognito.hosted_ui_url
    REACT_APP_COGNITO_REDIRECT_URI = "https://${var.amplify_branch_name}.${module.amplify_app.default_domain}/auth/callback"
    REACT_APP_AWS_REGION           = var.aws_region
  }

  depends_on = [
    module.amplify_app,
    module.cognito,
    module.apigateway,
  ]
}

# Cognito

module "cognito" {
  source      = "../../modules/cognito"
  app_name    = local.app_name
  environment = local.environment
  aws_region  = var.aws_region

  google_client_id     = var.google_client_id
  google_client_secret = var.google_client_secret
  github_client_id     = var.github_client_id
  github_client_secret = var.github_client_secret

  amplify_default_domain = var.enable_amplify_hosting ? module.amplify_app.default_domain : ""
  amplify_branch_name    = var.amplify_branch_name
}

# API Gateway

module "apigateway" {
  source      = "../../modules/apigateway"
  app_name    = local.app_name
  environment = local.environment
  aws_region  = var.aws_region

  ws_invoke_arns    = module.lambda.ws_invoke_arns
  ws_function_names = module.lambda.ws_function_names

  pipeline_function_arns  = module.lambda.pipeline_function_arns
  pipeline_function_names = module.lambda.pipeline_function_names

  conversation_function_arns  = module.lambda.conversation_function_arns
  conversation_function_names = module.lambda.conversation_function_names

  cognito_user_pool_id = module.cognito.user_pool_id
  cognito_client_id    = module.cognito.client_id
}

# Lambda Functions

module "lambda" {
  source       = "../../modules/lambda"
  app_name     = local.app_name
  project_name = local.app_name
  environment  = local.environment
  aws_region   = var.aws_region

  ws_connections_table_name = module.dynamodb.ws_connections_table_name
  ws_connections_table_arn  = module.dynamodb.ws_connections_table_arn
  pipelines_table_name      = module.dynamodb.pipelines_table_name
  pipelines_table_arn       = module.dynamodb.pipelines_table_arn
  conversations_table_name  = module.dynamodb.conversations_table_name
  conversations_table_arn   = module.dynamodb.conversations_table_arn
  lambda_src_path           = local.lambda_src_path

  ws_api_id            = module.apigateway.ws_api_id
  ws_api_execution_arn = module.apigateway.ws_api_execution_arn

  orchestrator_runtime_id  = module.orchestrator_runtime.agent_runtime_id
  orchestrator_runtime_arn = module.orchestrator_runtime.agent_runtime_arn

  depends_on = [module.orchestrator_runtime]
}

# Git provider tokens

resource "aws_secretsmanager_secret" "git_provider_tokens" {
  name        = "${local.app_name}-${local.environment}-git-provider-tokens"
  description = "GitHub token used by the source-control MCP tool Lambda."
}

resource "aws_secretsmanager_secret_version" "git_provider_tokens" {
  secret_id = aws_secretsmanager_secret.git_provider_tokens.id
  secret_string = jsonencode({
    github_token = var.github_access_token
  })
}

# Source-control Gateway tool Lambda

module "source_control_tool" {
  source = "../../modules/gateway-lambda-tool"

  project_name = local.app_name
  environment  = local.environment
  aws_region   = var.aws_region
  account_id   = data.aws_caller_identity.current.account_id

  tool_name   = "source-control"
  source_root = abspath("${path.root}/../../../../agentcore/gateway-tools/lambda-functions")

  secret_arns = [aws_secretsmanager_secret.git_provider_tokens.arn]
  env_vars = {
    GIT_PROVIDER_SECRET_ARN = aws_secretsmanager_secret.git_provider_tokens.arn
  }
}

# AgentCore Policy — Cedar authorization for MCP Gateway tool calls

module "gateway_policy_engine" {
  source = "../../modules/agentcore/policy"

  project_name = local.app_name
  environment  = local.environment
  aws_region   = var.aws_region
  account_id   = data.aws_caller_identity.current.account_id
  gateway_arn  = local.gateway_arn

  create_cedar_policies = false

  # Alternate name avoids ConflictException if flow_dev_gateway was reserved by a partial create.
  policy_engine_name = "flow_dev_gw_policy"

  tags = {
    Project     = local.app_name
    Environment = local.environment
    ManagedBy   = "terraform"
  }
}

# AgentCore MCP Gateway

module "gateway" {
  source = "../../modules/agentcore/gateway"

  project_name = local.app_name
  environment  = local.environment
  aws_region   = var.aws_region
  account_id   = data.aws_caller_identity.current.account_id

  cognito_issuer_url = "https://cognito-idp.${var.aws_region}.amazonaws.com/${module.cognito.user_pool_id}"
  cognito_allowed_clients = [
    module.cognito.client_id,
    module.cognito.gateway_m2m_client_id,
  ]

  lambda_tool_arns = {
    "source-control" = module.source_control_tool.function_arn
  }

  policy_engine_arn  = module.gateway_policy_engine.policy_engine_arn
  policy_engine_mode = "LOG_ONLY"

  tags = {
    Project     = local.app_name
    Environment = local.environment
    ManagedBy   = "terraform"
  }

  depends_on = [module.gateway_policy_engine]
}

module "gateway_cedar_policies" {
  source = "../../modules/agentcore/policy"

  project_name = local.app_name
  environment  = local.environment
  aws_region   = var.aws_region
  account_id   = data.aws_caller_identity.current.account_id
  gateway_arn  = module.gateway.gateway_arn

  create_policy_engine = false
  policy_engine_id     = module.gateway_policy_engine.policy_engine_id

  tags = {
    Project     = local.app_name
    Environment = local.environment
    ManagedBy   = "terraform"
  }

  depends_on = [module.gateway]
}

# Gateway M2M credentials (agent runtimes → MCP Gateway)

resource "aws_secretsmanager_secret" "gateway_m2m_auth" {
  name        = "${local.app_name}-${local.environment}-gateway-m2m-auth"
  description = "Cognito client credentials for agent runtimes calling the MCP Gateway."
}

resource "aws_secretsmanager_secret_version" "gateway_m2m_auth" {
  secret_id = aws_secretsmanager_secret.gateway_m2m_auth.id
  secret_string = jsonencode({
    client_id     = module.cognito.gateway_m2m_client_id
    client_secret = module.cognito.gateway_m2m_client_secret
    scope         = module.cognito.gateway_m2m_scope
  })
}

# AgentCore Memory

module "agentcore_memory" {
  source = "../../modules/agentcore/memory"

  project_name      = local.app_name
  environment       = local.environment
  event_expiry_days = 90

  tags = {
    Project     = local.app_name
    Environment = local.environment
    ManagedBy   = "terraform"
  }
}

# Orchestrator Runtime

module "orchestrator_runtime" {
  source = "../../modules/agentcore/runtime"

  project_name   = local.app_name
  environment    = local.environment
  component_name = "orchestrator"
  aws_region     = var.aws_region
  account_id     = data.aws_caller_identity.current.account_id
  aws_profile    = var.aws_profile

  # Runtime configuration
  protocol     = "HTTP"
  runtime_mode = "orchestrator"
  network_mode = "PUBLIC"

  # Container configuration - ECR repository will be created
  container_uri = ""
  image_tag     = "latest"

  # CodeBuild configuration
  enable_codebuild       = true
  agent_source_path      = abspath("${path.root}/../../../../agentcore/agents/orchestrator")
  source_s3_bucket       = module.s3.artifacts_bucket_name
  source_s3_key          = "agent-source/orchestrator.zip"
  buildspec_path         = "buildspec.yml"
  codebuild_compute_type = "BUILD_GENERAL1_SMALL"
  codebuild_image        = "aws/codebuild/standard:7.0"

  # Authentication
  cognito_issuer_url      = "https://cognito-idp.${var.aws_region}.amazonaws.com/${module.cognito.user_pool_id}"
  cognito_allowed_clients = [module.cognito.client_id]

  # Orchestrator permissions
  artifact_bucket_arn  = module.s3.artifacts_bucket_arn
  dynamodb_table_arns  = [module.dynamodb.pipelines_table_arn]
  secrets_manager_arns = []
  ws_api_execution_arn = module.apigateway.ws_api_execution_arn

  # Environment variables
  extra_env_vars = {
    PIPELINES_TABLE_NAME    = module.dynamodb.pipelines_table_name
    BEDROCK_MODEL_ID        = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
    MEMORY_ID               = module.agentcore_memory.memory_id
    REPO_ANALYSIS_AGENT_URL = module.repo_analysis_runtime.agent_runtime_arn
    PIPELINE_GEN_AGENT_URL  = module.pipeline_gen_runtime.agent_runtime_arn
    VALIDATION_AGENT_URL    = module.validation_runtime.agent_runtime_arn
    EXPORT_AGENT_URL        = module.export_runtime.agent_runtime_arn
  }

  depends_on = [
    module.s3,
    module.dynamodb,
    module.cognito,
    module.agentcore_memory,
    module.repo_analysis_runtime,
    module.pipeline_gen_runtime,
    module.validation_runtime,
    module.export_runtime
  ]
}

# Repo Analysis Runtime

module "repo_analysis_runtime" {
  source = "../../modules/agentcore/runtime"

  project_name   = local.app_name
  environment    = local.environment
  component_name = "repo-analysis"
  aws_region     = var.aws_region
  account_id     = data.aws_caller_identity.current.account_id
  aws_profile    = var.aws_profile

  # Runtime configuration
  protocol     = "HTTP"
  runtime_mode = "standard"
  network_mode = "PUBLIC"

  # Container configuration
  container_uri = ""
  image_tag     = "latest"

  # CodeBuild configuration
  enable_codebuild        = true
  agent_source_path       = abspath("${path.root}/../../../../agentcore/agents/repo-analysis")
  additional_source_paths = [abspath("${path.root}/../../../../agentcore/shared")]
  source_s3_bucket        = module.s3.artifacts_bucket_name
  source_s3_key           = "agent-source/repo-analysis.zip"
  buildspec_path          = "buildspec.yml"
  codebuild_compute_type  = "BUILD_GENERAL1_SMALL"
  codebuild_image         = "aws/codebuild/standard:7.0"

  # No auth — called via InvokeAgentRuntime from orchestrator (SigV4)
  cognito_issuer_url      = ""
  cognito_allowed_clients = []

  # Permissions
  artifact_bucket_arn  = ""
  dynamodb_table_arns  = []
  secrets_manager_arns = [aws_secretsmanager_secret.gateway_m2m_auth.arn]

  # Environment variables
  extra_env_vars = {
    BEDROCK_MODEL_ID        = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
    GATEWAY_MCP_URL         = module.gateway.gateway_url
    GATEWAY_AUTH_SECRET_ARN = aws_secretsmanager_secret.gateway_m2m_auth.arn
    COGNITO_TOKEN_URL       = "${module.cognito.hosted_ui_url}/oauth2/token"
  }

  depends_on = [module.s3, module.gateway]
}

# Pipeline Generation Runtime

module "pipeline_gen_runtime" {
  source = "../../modules/agentcore/runtime"

  project_name   = local.app_name
  environment    = local.environment
  component_name = "pipeline-gen"
  aws_region     = var.aws_region
  account_id     = data.aws_caller_identity.current.account_id
  aws_profile    = var.aws_profile

  # Runtime configuration
  protocol     = "HTTP"
  runtime_mode = "standard"
  network_mode = "PUBLIC"

  # Container configuration
  container_uri = ""
  image_tag     = "latest"

  # CodeBuild configuration
  enable_codebuild       = true
  agent_source_path      = abspath("${path.root}/../../../../agentcore/agents/pipeline-gen")
  source_s3_bucket       = module.s3.artifacts_bucket_name
  source_s3_key          = "agent-source/pipeline-gen.zip"
  buildspec_path         = "buildspec.yml"
  codebuild_compute_type = "BUILD_GENERAL1_SMALL"
  codebuild_image        = "aws/codebuild/standard:7.0"

  # No auth — called via InvokeAgentRuntime from orchestrator (SigV4)
  cognito_issuer_url      = ""
  cognito_allowed_clients = []

  # Permissions
  artifact_bucket_arn  = ""
  dynamodb_table_arns  = []
  secrets_manager_arns = []

  # Environment variables
  extra_env_vars = {
    BEDROCK_MODEL_ID = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
  }

  depends_on = [module.s3]
}

# Validation Runtime

module "validation_runtime" {
  source = "../../modules/agentcore/runtime"

  project_name   = local.app_name
  environment    = local.environment
  component_name = "validation"
  aws_region     = var.aws_region
  account_id     = data.aws_caller_identity.current.account_id
  aws_profile    = var.aws_profile

  # Runtime configuration
  protocol     = "HTTP"
  runtime_mode = "standard"
  network_mode = "PUBLIC"

  # Container configuration
  container_uri = ""
  image_tag     = "latest"

  # CodeBuild configuration
  enable_codebuild       = true
  agent_source_path      = abspath("${path.root}/../../../../agentcore/agents/validation")
  source_s3_bucket       = module.s3.artifacts_bucket_name
  source_s3_key          = "agent-source/validation.zip"
  buildspec_path         = "buildspec.yml"
  codebuild_compute_type = "BUILD_GENERAL1_SMALL"
  codebuild_image        = "aws/codebuild/standard:7.0"

  # No auth — called via InvokeAgentRuntime from orchestrator (SigV4)
  cognito_issuer_url      = ""
  cognito_allowed_clients = []

  # Permissions
  artifact_bucket_arn  = ""
  dynamodb_table_arns  = []
  secrets_manager_arns = []

  # Environment variables
  extra_env_vars = {
    BEDROCK_MODEL_ID = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
  }

  depends_on = [module.s3]
}

# Export Runtime

module "export_runtime" {
  source = "../../modules/agentcore/runtime"

  project_name   = local.app_name
  environment    = local.environment
  component_name = "export"
  aws_region     = var.aws_region
  account_id     = data.aws_caller_identity.current.account_id
  aws_profile    = var.aws_profile

  # Runtime configuration
  protocol     = "HTTP"
  runtime_mode = "standard"
  network_mode = "PUBLIC"

  # Container configuration
  container_uri = ""
  image_tag     = "latest"

  # CodeBuild configuration
  enable_codebuild       = true
  agent_source_path      = abspath("${path.root}/../../../../agentcore/agents/export")
  source_s3_bucket       = module.s3.artifacts_bucket_name
  source_s3_key          = "agent-source/export.zip"
  buildspec_path         = "buildspec.yml"
  codebuild_compute_type = "BUILD_GENERAL1_SMALL"
  codebuild_image        = "aws/codebuild/standard:7.0"

  # No auth — called via InvokeAgentRuntime from orchestrator (SigV4)
  cognito_issuer_url      = ""
  cognito_allowed_clients = []

  # Permissions
  artifact_bucket_arn  = ""
  dynamodb_table_arns  = []
  secrets_manager_arns = []

  # Environment variables
  extra_env_vars = {
    BEDROCK_MODEL_ID = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
  }

  depends_on = [module.s3]
}

# AgentCore Observability — CloudWatch vended logs + X-Ray traces

data "aws_iam_policy_document" "xray_transaction_search" {
  statement {
    sid    = "TransactionSearchXRayAccess"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["xray.amazonaws.com"]
    }

    actions = ["logs:PutLogEvents"]

    resources = [
      "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:aws/spans:*",
      "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/application-signals/data:*",
    ]

    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = ["arn:aws:xray:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_cloudwatch_log_resource_policy" "xray_transaction_search" {
  policy_name     = "${local.app_name}-${local.environment}-xray-transaction-search"
  policy_document = data.aws_iam_policy_document.xray_transaction_search.json
}

resource "time_sleep" "xray_log_policy_propagation" {
  depends_on      = [aws_cloudwatch_log_resource_policy.xray_transaction_search]
  create_duration = "10s"
}

resource "aws_xray_trace_segment_destination" "transaction_search" {
  destination = "CloudWatchLogs"

  depends_on = [time_sleep.xray_log_policy_propagation]
}

resource "aws_xray_indexing_rule" "default" {
  name = "Default"

  rule {
    probabilistic {
      desired_sampling_percentage = 100
    }
  }

  depends_on = [time_sleep.xray_log_policy_propagation]
}

module "observability_memory" {
  source = "../../modules/observability"

  project_name  = local.app_name
  environment   = local.environment
  aws_region    = var.aws_region
  resource_name = "memory"
  resource_arn  = module.agentcore_memory.memory_arn

  log_group_name = "/aws/vendedlogs/bedrock-agentcore/memory/APPLICATION_LOGS/${module.agentcore_memory.memory_id}"

  tags = {
    Project     = local.app_name
    Environment = local.environment
    ManagedBy   = "terraform"
  }

  depends_on = [
    module.agentcore_memory,
    aws_xray_trace_segment_destination.transaction_search,
    aws_xray_indexing_rule.default,
  ]
}

module "observability_orchestrator" {
  source = "../../modules/observability"

  project_name  = local.app_name
  environment   = local.environment
  aws_region    = var.aws_region
  resource_name = "orchestrator"
  resource_arn  = module.orchestrator_runtime.agent_runtime_arn

  log_group_name = "/aws/vendedlogs/bedrock-agentcore/runtime/APPLICATION_LOGS/${module.orchestrator_runtime.agent_runtime_id}"

  tags = {
    Project     = local.app_name
    Environment = local.environment
    ManagedBy   = "terraform"
  }

  depends_on = [
    module.orchestrator_runtime,
    aws_xray_trace_segment_destination.transaction_search,
    aws_xray_indexing_rule.default,
  ]
}

# AgentCore Online Evaluation — IAM for CreateOnlineEvaluationConfig

module "evaluation" {
  source = "../../modules/agentcore/evaluation"

  project_name = local.app_name
  environment  = local.environment
  aws_region   = var.aws_region
  account_id   = data.aws_caller_identity.current.account_id

  tags = {
    Project     = local.app_name
    Environment = local.environment
    ManagedBy   = "terraform"
  }
}
