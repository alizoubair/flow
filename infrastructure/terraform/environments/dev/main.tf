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

  cognito_user_pool_id = module.cognito.user_pool_id
  cognito_client_id    = module.cognito.client_id
}

# Lambda Functions

module "lambda" {
  source      = "../../modules/lambda"
  app_name    = local.app_name
  project_name = local.app_name
  environment = local.environment
  aws_region  = var.aws_region

  ws_connections_table_name = module.dynamodb.ws_connections_table_name
  ws_connections_table_arn  = module.dynamodb.ws_connections_table_arn
  pipelines_table_name      = module.dynamodb.pipelines_table_name
  pipelines_table_arn       = module.dynamodb.pipelines_table_arn
  lambda_src_path           = local.lambda_src_path

  ws_api_id            = module.apigateway.ws_api_id
  ws_api_execution_arn = module.apigateway.ws_api_execution_arn

  orchestrator_runtime_id  = module.orchestrator_runtime.agent_runtime_id
  orchestrator_runtime_arn = module.orchestrator_runtime.agent_runtime_arn

  depends_on = [module.orchestrator_runtime]
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
  artifact_bucket_arn    = module.s3.artifacts_bucket_arn
  dynamodb_table_arns    = [module.dynamodb.pipelines_table_arn]
  secrets_manager_arns   = []
  ws_api_execution_arn   = module.apigateway.ws_api_execution_arn

  # Environment variables
  extra_env_vars = {
    PIPELINES_TABLE_NAME    = module.dynamodb.pipelines_table_name
    BEDROCK_MODEL_ID        = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
    REPO_ANALYSIS_AGENT_URL = module.repo_analysis_runtime.agent_runtime_arn
  }

  depends_on = [
    module.s3,
    module.dynamodb,
    module.cognito,
    module.repo_analysis_runtime
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
  enable_codebuild       = true
  agent_source_path      = abspath("${path.root}/../../../../agentcore/agents/repo-analysis")
  source_s3_bucket       = module.s3.artifacts_bucket_name
  source_s3_key          = "agent-source/repo-analysis.zip"
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
    GITHUB_TOKEN     = ""
  }

  depends_on = [module.s3]
}