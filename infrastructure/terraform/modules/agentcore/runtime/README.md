# Module: agentcore/runtime

Creates a Bedrock AgentCore Runtime for hosting AI agents in the Flow platform.

## Resources

- `aws_bedrockagentcore_agent_runtime` — the managed agent runtime
- `aws_ecr_repository` — container image registry (optional, created if no `container_uri` provided)
- `aws_codebuild_project` — builds and pushes container images (optional)
- `aws_iam_role` — execution role for the runtime + CodeBuild service role
- `aws_cloudwatch_log_group` — runtime and CodeBuild logs
- `aws_ssm_parameter` — stores runtime ARN and ID for discovery
- `archive_file` + `aws_s3_object` — packages and uploads source to S3 for CodeBuild
- `null_resource` — triggers CodeBuild and waits for the image build

## Runtime Modes

| Mode | Description |
|---|---|
| `standard` | Base permissions (Bedrock, CloudWatch, X-Ray, SSM) |
| `orchestrator` | Extended permissions for AgentCore registry, memory, events, sessions, agent invocation |

## Protocols

| Protocol | Use Case |
|---|---|
| `HTTP` | Standard request/response agents (default) |
| `MCP` | Model Context Protocol servers |
| `A2A` | Agent-to-Agent protocol |

## Container Management

Two modes:
1. **Bring your own** — provide `container_uri` pointing to an existing ECR image
2. **Managed build** — leave `container_uri` empty, set `enable_codebuild = true`. Module creates ECR repo, uploads source to S3, and runs CodeBuild

## Inputs

| Name | Type | Description |
|---|---|---|
| `project_name` | string | Resource name prefix |
| `environment` | string | Deployment environment |
| `component_name` | string | Name of the agent (e.g. orchestrator, repo-analysis) |
| `aws_region` | string | AWS region |
| `account_id` | string | AWS account ID |
| `aws_profile` | string | AWS CLI profile for local-exec provisioners |
| `container_uri` | string | ECR image URI (optional if using CodeBuild) |
| `image_tag` | string | Docker image tag (default: latest) |
| `protocol` | string | HTTP, MCP, or A2A |
| `runtime_mode` | string | standard or orchestrator |
| `network_mode` | string | PUBLIC or VPC |
| `enable_codebuild` | bool | Enable managed container builds |
| `agent_source_path` | string | Path to agent source code directory |
| `source_s3_bucket` | string | S3 bucket for CodeBuild source |
| `source_s3_key` | string | S3 key for source zip |
| `artifact_bucket_arn` | string | S3 bucket ARN for agent artifacts |
| `dynamodb_table_arns` | list(string) | DynamoDB tables to grant access |
| `secrets_manager_arns` | list(string) | Secrets Manager ARNs to grant access |
| `extra_env_vars` | map(string) | Environment variables for the runtime |
| `tags` | map(string) | Tags for all resources |

## Outputs

| Name | Description |
|---|---|
| `agent_runtime_arn` | Runtime ARN |
| `agent_runtime_id` | Runtime ID |
| `execution_role_arn` | Execution role ARN |
| `ecr_repository_url` | ECR repository URL |
| `codebuild_project_name` | CodeBuild project name |
