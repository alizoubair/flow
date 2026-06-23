# Flow — AgentCore Evaluations

Online evaluation continuously samples live sessions from the orchestrator runtime,
scores them with built-in LLM-as-a-Judge evaluators, and writes results to a
dedicated CloudWatch log group.

## How it works

1. The service reads traces from the orchestrator runtime CloudWatch log group (see [Create online evaluation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/create-online-evaluations.html)).
2. A configurable sampling percentage (default 10%) controls what fraction of sessions are evaluated.
3. `Builtin.Helpfulness` scores each trace (minimal config from the AWS boto3 example).
4. Results land in `/aws/bedrock-agentcore/evaluations/results/<config-id>` and as CloudWatch metrics under `Bedrock-AgentCore/Evaluations`.

## IAM setup

Two IAM resources are provisioned by Terraform in `main.tf` (evaluation module):

| Resource | Purpose |
|----------|---------|
| `flow-dev-online-eval` role | Service role assumed by `bedrock-agentcore.amazonaws.com` to read spans, invoke models, write results |
| `flow-dev-online-eval-developer` policy | Attach to your IAM user/CI role to manage the config and read results |

```bash
cd infrastructure/terraform/environments/dev
terraform apply
terraform output online_eval_service_role_arn
terraform output online_eval_developer_policy_arn
```

Attach `online_eval_developer_policy_arn` to your developer IAM user (e.g. `alizoubair`).

## Commands

```bash
export AWS_PROFILE=alizoubair

# Create and start the online evaluation config
bash scripts/manage-online-eval.sh create

# Check status
bash scripts/manage-online-eval.sh status

# Pause / resume
bash scripts/manage-online-eval.sh pause
bash scripts/manage-online-eval.sh resume

# Query recent results (last 60 min by default)
bash scripts/manage-online-eval.sh results

# Print latest CloudWatch metric datapoints
bash scripts/manage-online-eval.sh metrics

# Delete the config
bash scripts/manage-online-eval.sh delete
```

PowerShell:
```powershell
$env:AWS_PROFILE = "alizoubair"
.\scripts\manage-online-eval.sh create
.\scripts\manage-online-eval.sh results
```

## Evaluators configured

Minimal setup matching the [Create online evaluation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/create-online-evaluations.html) boto3 example:

| Evaluator | Level | What it measures |
|-----------|-------|-----------------|
| `Builtin.Helpfulness` | Trace | Whether each response advances the user's goal |

Add more in the `EVALUATORS` list in `online_eval.py` (maximum 10 per config).

## Viewing results

**CloudWatch Observability dashboard** (recommended):
1. CloudWatch → GenAI Observability → Bedrock AgentCore
2. Select the orchestrator agent and DEFAULT endpoint
3. Navigate to the **Evaluations** tab

**CloudWatch Metrics**: Metrics → All Metrics → `Bedrock-AgentCore/Evaluations`

**Logs Insights** (raw JSON): `/aws/bedrock-agentcore/evaluations/results/<config-id>`

## Optional environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ONLINE_EVAL_CONFIG_NAME` | `flow_dev_orchestrator_eval` | Name of the evaluation config |
| `ONLINE_EVAL_SERVICE_ROLE_ARN` | from `terraform output` | IAM role for the service |
| `ONLINE_EVAL_SAMPLING_PERCENTAGE` | `10.0` | Percent of sessions evaluated (0.01–100) |
| `ORCHESTRATOR_SERVICE_NAME` | `{runtime_name}.DEFAULT` | OTEL service name filter |
| `ORCHESTRATOR_EVENT_LOG_GROUP` | from `terraform output` | Runtime event log group |
| `ONLINE_EVAL_CONFIG_ID` | auto-discovered | Skip the List API call if already known |
| `RESULTS_LOOKBACK_MINUTES` | `60` | Lookback window for the `results` command |

## Layout

```
evaluations/
├── online_eval.py       # Online evaluation management script
└── requirements.txt

scripts/
├── manage-online-eval.sh    # bash

infrastructure/terraform/environments/dev/
└── main.tf                  # evaluation module + rest of dev stack
```
