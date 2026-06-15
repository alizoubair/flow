# Module: agentcore/policy

Creates an [AgentCore Policy engine](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy.html) and Cedar policies for MCP Gateway tool authorization.

Uses Terraform resources:

- [`aws_bedrockagentcore_policy_engine`](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/bedrockagentcore_policy_engine)
- [`aws_bedrockagentcore_policy`](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/bedrockagentcore_policy)

## Default policies

When `enable_default_source_control_policies = true` (default):

| Policy | Effect | Purpose |
|--------|--------|---------|
| `permit_source_control_tools` | permit | Allow OAuth callers to invoke metadata/tree/existence tools |
| `permit_safe_file_reads` | permit | Allow `read_file_content` only when `file_path` is not sensitive |

The Gateway execution role requires `GetPolicyEngine`, `AuthorizeAction`, and `PartiallyAuthorizeActions` when a policy engine is attached. See [AgentCore Gateway and Policy IAM Permissions](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy-permissions.html).

Attach the policy engine to the Gateway via `policy_engine_configuration` on `aws_bedrockagentcore_gateway` (see `agentcore/gateway` module).

## Usage

Create the policy engine first, attach it to the Gateway, then create Cedar policies (AWS validates the Gateway exists when policies are created):

```hcl
module "gateway_policy_engine" {
  source = "../../modules/agentcore/policy"

  project_name = local.app_name
  environment  = local.environment
  aws_region   = var.aws_region
  account_id   = data.aws_caller_identity.current.account_id
  gateway_arn  = local.gateway_arn

  create_cedar_policies = false
}

module "gateway" {
  source = "../../modules/agentcore/gateway"
  # ...
  policy_engine_arn  = module.gateway_policy_engine.policy_engine_arn
  policy_engine_mode = "LOG_ONLY"
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

## Terraform IAM permissions

The principal running `terraform apply` needs AgentCore control-plane permissions including:

- `bedrock-agentcore:CreatePolicyEngine`, `bedrock-agentcore:CreatePolicy`
- `bedrock-agentcore:GetGateway` (required when Cedar policies reference a Gateway ARN)

## Enforcement modes

| Mode | Behavior |
|------|----------|
| `LOG_ONLY` | Evaluate and trace decisions without blocking (recommended initially) |
| `ENFORCE` | Block tool calls that fail policy checks |

Start with `LOG_ONLY`, validate CloudWatch traces, then switch to `ENFORCE`.
