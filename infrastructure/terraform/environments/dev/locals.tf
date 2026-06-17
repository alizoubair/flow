locals {
  app_name        = "flow"
  environment     = "dev"
  lambda_src_path = "${path.root}/../../../../lambda"

  gateway_name = "${local.app_name}-${local.environment}-gateway"
  gateway_arn  = "arn:aws:bedrock-agentcore:${var.aws_region}:${data.aws_caller_identity.current.account_id}:gateway/${local.gateway_name}"
}
