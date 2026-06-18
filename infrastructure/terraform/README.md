# Flow — Terraform Infrastructure

Terraform configuration for the [Flow Platform](../../README.md).

## Structure

```
terraform/
├── environments/
│   └── dev/                       # Dev environment entry point
│       ├── main.tf                # Wires all modules together
│       ├── variables.tf           # Input variables
│       ├── outputs.tf             # Outputs
│       ├── versions.tf            # Provider constraints (aws, archive, time)
│       ├── provider.tf            # AWS provider config
│       ├── backend.tf             # S3 remote state backend
│       ├── locals.tf              # Shared locals
│       └── terraform.tfvars.example
└── modules/
    ├── s3/                        # S3 state bucket + artifacts bucket
    ├── dynamodb/                  # Pipelines, conversations, WebSocket tables
    ├── cognito/                   # User Pool, OAuth, Gateway M2M client
    ├── apigateway/                # HTTP API + WebSocket API
    ├── lambda/                    # Lambda functions and shared layers
    ├── gateway-lambda-tool/       # Reusable Gateway tool Lambda packager
    ├── observability/             # AgentCore log + trace delivery (vended logs, X-Ray)
    └── agentcore/
        ├── runtime/               # AgentCore Runtime (ECR, CodeBuild, IAM)
        ├── memory/                # AgentCore Memory
        ├── gateway/               # AgentCore MCP Gateway + tool targets
        ├── policy/                # Cedar policy engine + policies for Gateway
        └── evaluation/            # IAM for AgentCore online evaluation
```

Agent source code and Gateway tool Lambdas live under [`../../agentcore/`](../../agentcore/README.md).

## Modules

| Module | Description |
|---|---|
| `s3` | Terraform state bucket, artifacts bucket, DynamoDB lock table |
| `dynamodb` | Pipelines, WebSocket connections, and conversations tables |
| `cognito` | User Pool, Hosted UI, Google/GitHub OAuth, **Gateway M2M client** |
| `apigateway` | HTTP API (pipeline + conversation CRUD) + WebSocket API |
| `lambda` | WebSocket handlers, pipeline CRUD, conversation handlers, shared layer |
| `gateway-lambda-tool` | Package and deploy one MCP tool Lambda (one module instance per domain) |
| `observability` | APPLICATION_LOGS + TRACES delivery for AgentCore resources |
| `agentcore/runtime` | Bedrock AgentCore Runtime with ECR, CodeBuild, IAM, ADOT env |
| `agentcore/memory` | AgentCore Memory with semantic strategy |
| `agentcore/gateway` | MCP Gateway (CUSTOM_JWT), Lambda targets, SSM parameters |
| `agentcore/policy` | Cedar policy engine and Gateway authorization policies |
| `agentcore/evaluation` | IAM service role and developer policy for online evaluation |

See module READMEs: [`agentcore/gateway`](modules/agentcore/gateway/README.md), [`agentcore/policy`](modules/agentcore/policy/README.md), [`agentcore/evaluation`](modules/agentcore/evaluation/README.md).

## AgentCore runtimes

Dev `main.tf` deploys five agent runtimes via `agentcore/runtime`:

| Module | Agent | Auth | Notes |
|---|---|---|---|
| `orchestrator_runtime` | orchestrator | Cognito JWT (browser) | Invokes sub-agents; WebSocket + DynamoDB |
| `repo_analysis_runtime` | repo-analysis | SigV4 only (orchestrator) | Uses MCP Gateway + `agentcore/shared` |
| `pipeline_gen_runtime` | pipeline-gen | SigV4 only | |
| `validation_runtime` | validation | SigV4 only | |
| `export_runtime` | export | SigV4 only | |

## Usage

Run Terraform from **one environment only** (WSL Ubuntu or Windows — not both without re-init). Provider binaries are platform-specific.

```bash
cd environments/dev
cp terraform.tfvars.example terraform.tfvars
# Fill in aws_profile, github_access_token, OAuth secrets, etc.

terraform init
terraform plan
terraform apply
```

### WSL path example

```bash
cd /mnt/c/Users/HP/Downloads/flow/infrastructure/terraform/environments/dev
terraform init
```

If you see **"Required plugins are not installed"**, run `terraform init` again in the same shell/OS where you plan to apply. Switching between Windows and WSL requires a fresh `terraform init` in that environment.

### Remote state bootstrap

The S3 backend in `backend.tf` expects the state bucket to exist. On a fresh account, apply once with a local backend (or comment out `backend.tf`), then uncomment the S3 backend and run `terraform init -migrate-state`. See [`modules/s3/README.md`](modules/s3/README.md).

## AgentCore MCP Gateway

Gateway exposes Lambda tools to agent runtimes over MCP. Dev wiring in `main.tf`:

| Resource / module | Purpose |
|---|---|
| `module.source_control_tool` | GitHub repo inspection Lambda (`gateway-lambda-tool`) |
| `module.gateway` | MCP Gateway + `source-control` target from YAML schema |
| `aws_secretsmanager_secret.git_provider_tokens` | GitHub PAT for the tool Lambda |
| `aws_secretsmanager_secret.gateway_m2m_auth` | Cognito client credentials for agents → Gateway |
| `module.repo_analysis_runtime` | Agent runtime; bundles `agentcore/shared`, Gateway env vars |

**Source-control tools** (schema: `modules/agentcore/gateway/schemas/source-control.yaml`):

- `get_repo_info` — repository metadata
- `get_file_tree` — directory listing
- `read_file_content` — read a file (truncated)
- `check_files_exist` — batch path existence check

Tool Lambda code: `agentcore/gateway-tools/lambda-functions/source-control/`

### Targeted apply (Gateway + repo-analysis)

```bash
terraform apply \
  -target=module.cognito \
  -target=aws_secretsmanager_secret.git_provider_tokens \
  -target=aws_secretsmanager_secret_version.git_provider_tokens \
  -target=aws_secretsmanager_secret.gateway_m2m_auth \
  -target=aws_secretsmanager_secret_version.gateway_m2m_auth \
  -target=module.source_control_tool \
  -target=module.gateway \
  -target=module.repo_analysis_runtime
```

Or step by step: Cognito + secrets → `source_control_tool` + `gateway` → `repo_analysis_runtime`.

`-target` is for incremental deploys; run a full `terraform apply` periodically to avoid drift.

## Adding a Gateway tool

1. Add Lambda under `agentcore/gateway-tools/lambda-functions/<tool-id>/`
2. Add schema `modules/agentcore/gateway/schemas/<tool-id>.yaml`
3. Instantiate `module "<tool_id>_tool"` using `gateway-lambda-tool`
4. Register ARN in `module.gateway.lambda_tool_arns`
5. `terraform apply -target=module.<tool_id>_tool -target=module.gateway`

See [`agentcore/README.md`](../../agentcore/README.md) for agent-side MCP usage.

## AgentCore Evaluations

Online evaluation IAM is provisioned by `module.evaluation` in dev `main.tf`. The module creates:

| Resource | Purpose |
|---|---|
| `AgentCoreEvaluationRole-{project}-{env}` | Service role for `bedrock-agentcore.amazonaws.com` (trace read, Bedrock invoke, results write) |
| `{project}-{env}-online-eval-developer` | IAM policy to attach to developers/CI managing evaluation configs |

The online evaluation **configuration** is created outside Terraform via `CreateOnlineEvaluationConfig`. See [`../../evaluations/README.md`](../../evaluations/README.md) and [`modules/agentcore/evaluation/README.md`](modules/agentcore/evaluation/README.md).

```bash
terraform output online_eval_service_role_arn
terraform output online_eval_developer_policy_arn
terraform output orchestrator_runtime_log_group_name
terraform output orchestrator_runtime_name

# After attaching online_eval_developer_policy_arn to your IAM user:
../../scripts/manage-online-eval.sh create
```

## Outputs

After `apply`, useful outputs include:

| Output | Description |
|---|---|
| `state_bucket_name` | S3 bucket for Terraform remote state |
| `http_api_endpoint` | HTTP API base URL |
| `ws_api_endpoint` | WebSocket endpoint (`wss://...`) |
| `cognito_user_pool_id` | Cognito User Pool ID |
| `cognito_client_id` | Cognito App Client ID |
| `cognito_domain` | Cognito Hosted UI URL |
| `orchestrator_runtime_arn` | Orchestrator AgentCore Runtime ARN |
| `orchestrator_runtime_id` | Orchestrator runtime ID |
| `repo_analysis_runtime_arn` | Repo-analysis runtime ARN |
| `repo_analysis_runtime_id` | Repo-analysis runtime ID |
| `agentcore_memory_id` | AgentCore Memory ID |
| `memory_application_log_group_name` | CloudWatch log group for memory APPLICATION_LOGS |
| `orchestrator_application_log_group_name` | CloudWatch log group for orchestrator APPLICATION_LOGS |
| `orchestrator_runtime_name` | Orchestrator runtime name (OTEL `service.name` prefix) |
| `orchestrator_runtime_log_group_name` | Orchestrator runtime event log group (online eval data source) |
| `online_eval_service_role_arn` | IAM role for `CreateOnlineEvaluationConfig` |
| `online_eval_developer_policy_arn` | IAM policy for managing online evaluations |
| `gateway_policy_engine_arn` | Cedar policy engine ARN on the MCP Gateway |
| `gateway_policy_engine_id` | Cedar policy engine ID |
| `mcp_gateway_url` | AgentCore MCP Gateway URL |
| `mcp_gateway_id` | AgentCore MCP Gateway ID |
| `artifacts_bucket_name` | S3 bucket for agent source zips and artifacts |
| `ecr_repository_url` | ECR repository for orchestrator container |
| `codebuild_project_name` | CodeBuild project for orchestrator image builds |

Copy Cognito and API values into `amplify/.env.local`.

## Required variables

| Variable | Description |
|---|---|
| `aws_region` | AWS region (default: `us-west-2`) |
| `aws_profile` | AWS CLI profile |
| `github_access_token` | GitHub PAT for source-control MCP tool (Secrets Manager) |
| `github_repo` | Default GitHub repo for tooling (default: `alizoubair/flow`) |
| `google_client_id` | Google OAuth client ID (optional) |
| `google_client_secret` | Google OAuth client secret (optional) |
| `github_client_id` | GitHub OAuth client ID (optional) |
| `github_client_secret` | GitHub OAuth client secret (optional) |

See `terraform.tfvars.example` for the full list.
