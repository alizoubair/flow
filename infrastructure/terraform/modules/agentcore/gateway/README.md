# Module: agentcore/gateway

Creates an [AgentCore MCP Gateway](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway.html) with Cognito JWT auth, Lambda-backed tool targets, and optional Cedar policy enforcement.

Uses Terraform resources:

- [`aws_bedrockagentcore_gateway`](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/bedrockagentcore_gateway)
- [`aws_bedrockagentcore_gateway_target`](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/bedrockagentcore_gateway_target)

## What it creates

| Resource | Purpose |
|----------|---------|
| `aws_bedrockagentcore_gateway.mcp` | MCP Gateway with `CUSTOM_JWT` auth and semantic tool search |
| `aws_bedrockagentcore_gateway_target.lambda_tool` | One target per tool schema, backed by a Lambda function |
| `aws_iam_role.gateway` | IAM role the Gateway uses to invoke tool Lambdas |
| `aws_ssm_parameter.gateway_url` | SSM parameter for Gateway URL discovery |
| `aws_ssm_parameter.gateway_id` | SSM parameter for Gateway ID discovery |

## Tool schemas

Tool definitions live in `schemas/<tool_id>.yaml`. Each file describes the MCP tools exposed by a Lambda target.

Only schemas whose key appears in `lambda_tool_arns` are registered as Gateway targets. For example, `schemas/source-control.yaml` maps to:

```hcl
lambda_tool_arns = {
  "source-control" = module.source_control_tool.function_arn
}
```

To add a new tool:

1. Add `schemas/<tool_id>.yaml` with tool names, descriptions, and input properties.
2. Deploy the tool Lambda with the `gateway-lambda-tool` module.
3. Pass the Lambda ARN in `lambda_tool_arns`.

## Policy engine

When `policy_engine_arn` is set, the Gateway execution role also needs `GetPolicyEngine`, `AuthorizeAction`, and `PartiallyAuthorizeActions` per [AWS policy permissions](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy-permissions.html).

| Mode | Behavior |
|------|----------|
| `LOG_ONLY` | Evaluate and trace decisions without blocking (recommended initially) |
| `ENFORCE` | Block tool calls that fail policy checks |

## Usage

```hcl
locals {
  gateway_name = "${local.app_name}-${local.environment}-gateway"
  gateway_arn  = "arn:aws:bedrock-agentcore:${var.aws_region}:${data.aws_caller_identity.current.account_id}:gateway/${local.gateway_name}"
}

module "gateway_policy_engine" {
  source = "../../modules/agentcore/policy"

  project_name = local.app_name
  environment  = local.environment
  aws_region   = var.aws_region
  account_id   = data.aws_caller_identity.current.account_id
  gateway_arn  = local.gateway_arn

  create_cedar_policies = false
}

module "source_control_tool" {
  source = "../../modules/gateway-lambda-tool"

  project_name = local.app_name
  environment  = local.environment
  aws_region   = var.aws_region
  account_id   = data.aws_caller_identity.current.account_id

  tool_name   = "source-control"
  source_root = abspath("${path.root}/../../../../agentcore/gateway-tools/lambda-functions")
}

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

  depends_on = [module.gateway]
}
```

## Outputs

| Output | Description |
|--------|-------------|
| `gateway_id` | AgentCore Gateway ID |
| `gateway_arn` | Full Gateway ARN |
| `gateway_url` | MCP Gateway endpoint URL |
| `gateway_url_ssm_parameter` | SSM parameter name storing the Gateway URL |

## SSM parameters

| Parameter | Value |
|-----------|-------|
| `/{project}/{environment}/mcp/gateway-url` | Gateway MCP URL |
| `/{project}/{environment}/mcp/gateway-id` | Gateway ID |
