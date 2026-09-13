# Module: lambda

Creates Lambda functions, shared layers, IAM roles, and the CI runner MicroVM image pipeline for the Flow platform.

## Resources

- `aws_lambda_function` — one per handler (WebSocket, Pipeline, CI orchestrator, MicroVM setup)
- `aws_lambda_layer_version` — shared layers for common dependencies and the durable execution SDK
- `aws_iam_role` + policies — least-privilege IAM per function group and per standalone function
- `aws_cloudwatch_log_group` — log group per function
- `aws_lambda_invocation` — synchronous invocation that builds and registers the MicroVM runner image at `terraform apply` time

## Function Groups

### WebSocket (`ws`)

| Function | Description |
|---|---|
| `ws-connect` | Stores connectionId and JWT token in DynamoDB |
| `ws-disconnect` | Removes connection record |
| `ws-default` | Handles unrecognized messages (ping/echo) |
| `ws-orchestrator` | Invokes AgentCore runtime for pipeline generation |

### Pipeline (`pipeline`)

| Function | Description |
|---|---|
| `pipeline-create` | Create a new pipeline |
| `pipeline-get` | Get a pipeline by ID |
| `pipeline-list` | List all pipelines for a user |
| `pipeline-update` | Update pipeline nodes/edges, runner_stages and repo_url |
| `pipeline-delete` | Delete a pipeline |
| `pipeline-run` | Trigger a CI pipeline run — generates `run_id` and invokes the CI orchestrator |

### Conversation (`conversation`)

| Function | Description |
|---|---|
| `conversation-list` | List conversation history for a user |

## Standalone Lambda Resources

### CI Orchestrator (`ci_orchestrator.tf`)

Durable execution Lambda (`flow-ci-orchestrator`) that coordinates a full pipeline run:
- Launches one Lambda MicroVM per run
- Dispatches all stages at once via `POST /run`
- Suspends via `callback.result()` — zero idle compute while the MicroVM runs
- Resumes when the MicroVM calls `SendDurableExecutionCallbackSuccess`
- Requires `durable_config { execution_timeout = 28800; retention_period = 14 }`

### MicroVM Runner Image (`runner.tf`)

Manages the Lambda MicroVM runner image lifecycle as a first-class Terraform resource:

- Packages `runner.py + Dockerfile` from `lambda/ci-runner/runner/` and uploads to S3
- Deploys `flow-mvm-setup` Lambda (uses the durable SDK layer for `lambda-microvms` client access)
- `aws_lambda_invocation.create_microvm_image` — synchronous; Terraform blocks until the image reaches `CREATED`
- Re-runs only when the runner source changes (`source_hash` in `input`)

## Shared Layers

| Layer | Contents | Used by |
|---|---|---|
| `pipeline-shared` | `db_utils`, `validators` from `lambda/shared/` | Pipeline group |
| `ci-orchestrator-deps` | `aws_durable_execution_sdk_python`, `boto3` (with `lambda-microvms` support) | CI orchestrator, `mvm-setup`, pipeline-run |

WebSocket handlers use **no layer** — they only need boto3 + botocore, which the python3.12 runtime provides.

## Inputs

| Name | Type | Description |
|---|---|---|
| `app_name` | string | Resource name prefix |
| `project_name` | string | Project name for tagging |
| `environment` | string | Deployment environment |
| `aws_region` | string | AWS region |
| `account_id` | string | AWS account ID — used to compute MicroVM image ARN |
| `aws_profile` | string | AWS CLI profile for local-exec provisioners |
| `ws_connections_table_name` | string | DynamoDB connections table name |
| `ws_connections_table_arn` | string | DynamoDB connections table ARN |
| `pipelines_table_name` | string | DynamoDB pipelines table name |
| `pipelines_table_arn` | string | DynamoDB pipelines table ARN |
| `conversations_table_name` | string | DynamoDB conversations table name |
| `conversations_table_arn` | string | DynamoDB conversations table ARN |
| `ci_runs_table_name` | string | DynamoDB CI runs table name |
| `ci_runs_table_arn` | string | DynamoDB CI runs table ARN |
| `ci_artifacts_bucket_name` | string | S3 bucket for CI inter-stage artifacts |
| `ci_artifacts_bucket_arn` | string | S3 bucket ARN for CI artifacts |
| `source_s3_bucket` | string | S3 bucket for CodeBuild/MicroVM source zips |
| `git_secret_arn` | string | Secrets Manager ARN for GitHub token |
| `lambda_src_path` | string | Path to the `lambda/` source directory |
| `ws_api_id` | string | WebSocket API ID |
| `ws_api_execution_arn` | string | WebSocket API execution ARN |
| `orchestrator_runtime_id` | string | AgentCore runtime ID |
| `orchestrator_runtime_arn` | string | AgentCore runtime ARN |
| `log_retention_days` | number | CloudWatch log retention (default: 14) |

## Outputs

| Name | Description |
|---|---|
| `ws_invoke_arns` | Map of WebSocket Lambda invoke ARNs |
| `ws_function_names` | Map of WebSocket Lambda function names |
| `pipeline_function_arns` | Map of Pipeline Lambda invoke ARNs |
| `pipeline_function_names` | Map of Pipeline Lambda function names |
| `conversation_function_arns` | Map of Conversation Lambda invoke ARNs |
| `conversation_function_names` | Map of Conversation Lambda function names |
| `ci_orchestrator_function_name` | CI orchestrator Lambda function name |
| `ci_orchestrator_invoke_arn` | CI orchestrator Lambda invoke ARN |
| `ci_runner_image_arn` | Lambda MicroVM image ARN — passed as `imageIdentifier` to `run_microvm()` |
| `ci_runner_execution_role_arn` | IAM role ARN passed as `executionRoleArn` to `run_microvm()` |
