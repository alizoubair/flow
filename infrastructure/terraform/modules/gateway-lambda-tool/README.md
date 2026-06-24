# Module: gateway-lambda-tool

Packages and deploys a Lambda function that backs an AgentCore MCP Gateway tool target. Each tool is a self-contained directory with a `lambda_function.py` handler.

Uses Terraform resources:

- [`aws_lambda_function`](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_function)
- [`data.archive_file`](https://registry.terraform.io/providers/hashicorp/archive/latest/docs/data-sources/archive_file)

## What it creates

| Resource | Purpose |
|----------|---------|
| `aws_lambda_function.gateway_tool` | Tool Lambda invoked by the MCP Gateway |
| `aws_iam_role.gateway_tool` | Execution role for the Lambda |
| `aws_iam_role_policy.gateway_tool_logs` | CloudWatch Logs write access |
| `aws_iam_role_policy.gateway_tool_secrets` | Optional Secrets Manager read access |
| `aws_cloudwatch_log_group.gateway_tool` | Log group for the tool Lambda |

## Source layout

The module zips `source_root/<tool_name>/` and deploys it as `{project}-{environment}-tool-{tool_name}`.

Expected layout:

```
agentcore/gateway-tools/lambda-functions/
  source-control/
    lambda_function.py
    requirements.txt   # optional; use stdlib-only for zero-build deploys
```

The `tool_name` must match:

- The directory name under `source_root`
- The schema file key in `agentcore/gateway/schemas/<tool_name>.yaml`

## Usage

```hcl
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

module "gateway" {
  source = "../../modules/agentcore/gateway"
  # ...
  lambda_tool_arns = {
    "source-control" = module.source_control_tool.function_arn
  }
}
```

## Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `tool_name` | — | Tool id; directory name under `source_root` |
| `source_root` | — | Path to the parent of `<tool_name>/` |
| `secret_arns` | `[]` | Secrets Manager ARNs the Lambda may read |
| `env_vars` | `{}` | Extra environment variables |
| `runtime` | `python3.12` | Lambda runtime |
| `timeout` | `30` | Lambda timeout (seconds) |
| `memory_size` | `256` | Lambda memory (MB) |
| `log_retention_days` | `14` | CloudWatch log retention |

`PROJECT_NAME` and `ENVIRONMENT` are set automatically on the Lambda.

## Outputs

| Output | Description |
|--------|-------------|
| `function_arn` | Lambda ARN — pass to `agentcore/gateway` `lambda_tool_arns` |
| `function_name` | Deployed Lambda function name |

## Adding a new tool

1. Create `agentcore/gateway-tools/lambda-functions/<tool_name>/lambda_function.py`.
2. Add `agentcore/gateway/schemas/<tool_name>.yaml` with MCP tool definitions.
3. Instantiate this module with matching `tool_name`.
4. Register the Lambda ARN in the Gateway module's `lambda_tool_arns`.
5. Optionally add Cedar policies in `agentcore/policy` for the new tool actions.
