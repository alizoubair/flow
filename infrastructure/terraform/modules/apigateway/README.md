# Module: apigateway

Creates the HTTP and WebSocket API Gateway resources for the Flow platform.

## APIs

### WebSocket API
Real-time communication between the frontend and backend agents.

| Route | Lambda | Purpose |
|---|---|---|
| `$connect` | ws-connect | Store connection, extract JWT |
| `$disconnect` | ws-disconnect | Remove connection from table |
| `$default` | ws-default | Handle unrecognized messages |
| `orchestrator` | ws-orchestrator | Invoke AgentCore runtime |

Route selection expression: `$request.body.action`

### HTTP API
RESTful endpoints for pipeline CRUD and conversation history, protected by Cognito JWT authorizer.

| Route | Lambda | Purpose |
|---|---|---|
| `POST /pipelines` | pipeline-create | Create a new pipeline |
| `GET /pipelines` | pipeline-list | List user pipelines |
| `GET /pipelines/{id}` | pipeline-get | Get a specific pipeline |
| `PUT /pipelines/{id}` | pipeline-update | Update a pipeline |
| `DELETE /pipelines/{id}` | pipeline-delete | Delete a pipeline |
| `GET /conversations` | conversation-list | List conversation history |

## Inputs

| Name | Type | Description |
|---|---|---|
| `app_name` | string | Resource name prefix |
| `environment` | string | Deployment environment |
| `aws_region` | string | AWS region |
| `ws_invoke_arns` | map(string) | WebSocket Lambda invoke ARNs |
| `ws_function_names` | map(string) | WebSocket Lambda function names |
| `pipeline_function_arns` | map(string) | Pipeline Lambda invoke ARNs |
| `pipeline_function_names` | map(string) | Pipeline Lambda function names |
| `conversation_function_arns` | map(string) | Conversation Lambda invoke ARNs |
| `conversation_function_names` | map(string) | Conversation Lambda function names |
| `cognito_user_pool_id` | string | Cognito User Pool ID for JWT authorizer |
| `cognito_client_id` | string | Cognito App Client ID for JWT audience |

## Outputs

| Name | Description |
|---|---|
| `ws_api_id` | WebSocket API ID |
| `ws_endpoint` | WebSocket API endpoint URL |
| `ws_api_execution_arn` | WebSocket API execution ARN |
| `http_api_endpoint` | HTTP API endpoint URL |
