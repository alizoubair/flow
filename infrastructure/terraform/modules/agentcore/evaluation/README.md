# Module: agentcore/evaluation

Provisions IAM for [AgentCore Evaluations](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/online-evaluations.html) online evaluation. This module does **not** create the online evaluation configuration itself — that is done via `CreateOnlineEvaluationConfig` (see [`evaluations/online_eval.py`](../../../../evaluations/online_eval.py) or the [create online evaluation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/create-online-evaluations.html) guide).

## What it creates

| Resource | Purpose |
|----------|---------|
| `aws_iam_role.service` | Service role assumed by `bedrock-agentcore.amazonaws.com` to read traces, invoke Bedrock models, and write evaluation results |
| `aws_iam_policy.developer` | IAM policy to attach to a developer or CI identity that manages evaluation configs and reads results |

Role name pattern: `AgentCoreEvaluationRole-{project_name}-{environment}` (matches the `PassRole` condition in the developer policy).

## Service role permissions

The service role can:

- Read CloudWatch log groups (trace input)
- Write to `/aws/bedrock-agentcore/evaluations/*`
- Index `aws/spans` for span ingestion
- Invoke Bedrock foundation models and inference profiles (LLM-as-a-Judge evaluators)

## Developer policy permissions

Attach `developer_policy_arn` to the IAM user or role that runs evaluation tooling. It grants:

- `bedrock-agentcore:*OnlineEvaluationConfig*` and evaluator management APIs
- `iam:PassRole` for `AgentCoreEvaluationRole*` (passed to `bedrock-agentcore.amazonaws.com`)
- Bedrock invoke/converse for on-demand evaluation if needed
- CloudWatch Logs read access on evaluation result log groups
- CloudWatch metrics read access (`Bedrock-AgentCore/Evaluations`)

## Usage

Dev environment (`environments/dev/online_evaluation.tf`):

```hcl
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
```

After `terraform apply`:

```bash
terraform output online_eval_service_role_arn
terraform output online_eval_developer_policy_arn
```

Attach `online_eval_developer_policy_arn` to your developer IAM user, then create the online evaluation config:

```bash
./scripts/manage-online-eval.sh create
```

## Inputs

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `project_name` | string | — | Project prefix (e.g. `flow`) |
| `environment` | string | — | Environment name (e.g. `dev`) |
| `aws_region` | string | — | AWS region |
| `account_id` | string | — | AWS account ID |
| `tags` | map(string) | `{}` | Tags applied to IAM resources |

## Outputs

| Name | Description |
|------|-------------|
| `service_role_arn` | Pass to `evaluationExecutionRoleArn` in `CreateOnlineEvaluationConfig` |
| `service_role_name` | IAM role name |
| `developer_policy_arn` | Attach to developer/CI IAM identity |

## Related

- [`evaluations/README.md`](../../../../evaluations/README.md) — CLI commands and environment variables
- [`modules/observability`](../observability/README.md) — trace and log delivery for AgentCore resources
- Dev outputs: `orchestrator_runtime_name`, `orchestrator_runtime_log_group_name` (online eval data source)
