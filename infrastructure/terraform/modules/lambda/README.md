# Module: lambda

Creates Lambda functions, shared layers, and IAM roles for the Flow platform.

## Resources

- `aws_lambda_function` — one per handler (WebSocket + Pipeline)
- `aws_lambda_layer_version` — shared layers for common dependencies
- `aws_iam_role` + policies — least-privilege IAM per function group
- `aws_cloudwatch_log_group` — log group per function

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
| `pipeline-update` | Update pipeline nodes/edges |
| `pipeline-delete` | Delete a pipeline |

### Conversation (`conversation`)

| Function | Description |
|---|---|
| `conversation-list` | List conversation history for a user |

## Shared Layers

- `pipeline-shared` — db_utils, validators (from `lambda/shared/`)
- `websocket-shared` — boto3, httpx, websockets (from `lambda/websocket/python/`)

## Inputs

| Name | Type | Description |
|---|---|---|
| `app_name` | string | Resource name prefix |
| `project_name` | string | Project name for tagging |
| `environment` | string | Deployment environment |
| `aws_region` | string | AWS region |
| `ws_connections_table_name` | string | DynamoDB connections table name |
| `ws_connections_table_arn` | string | DynamoDB connections table ARN |
| `pipelines_table_name` | string | DynamoDB pipelines table name |
| `pipelines_table_arn` | string | DynamoDB pipelines table ARN |
| `lambda_src_path` | string | Path to the `lambda/` source directory |
| `ws_api_id` | string | WebSocket API ID |
| `ws_api_execution_arn` | string | WebSocket API execution ARN |
| `orchestrator_runtime_id` | string | AgentCore runtime ID |
| `orchestrator_runtime_arn` | string | AgentCore runtime ARN |

| `conversations_table_name` | string | DynamoDB conversations table name |
| `conversations_table_arn` | string | DynamoDB conversations table ARN |

## Outputs

| Name | Description |
|---|---|
| `ws_invoke_arns` | Map of WebSocket Lambda invoke ARNs |
| `ws_function_names` | Map of WebSocket Lambda function names |
| `pipeline_function_arns` | Map of Pipeline Lambda invoke ARNs |
| `pipeline_function_names` | Map of Pipeline Lambda function names |
| `conversation_function_arns` | Map of Conversation Lambda invoke ARNs |
| `conversation_function_names` | Map of Conversation Lambda function names |
