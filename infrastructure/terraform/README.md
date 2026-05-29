# Flow — Terraform Infrastructure

Terraform configuration for the Flow Platform.

## Structure

```
terraform/
├── environments/
│   └── dev/                       # Dev environment entry point
│       ├── main.tf                # Wires all modules together
│       ├── variables.tf           # Input variables
│       ├── outputs.tf             # Outputs
│       ├── versions.tf            # Provider constraints (aws ~> 6.32)
│       ├── provider.tf            # AWS provider config
│       ├── backend.tf             # S3 remote state backend
│       ├── locals.tf              # Shared locals
│       └── terraform.tfvars.example
└── modules/
    ├── s3/                        # S3 state bucket + artifacts bucket
    ├── dynamodb/                  # Pipelines and WebSocket connections tables
    ├── cognito/                   # User Pool, OAuth providers
    ├── apigateway/                # HTTP API + WebSocket API
    ├── lambda/                    # All Lambda functions and layers
    └── agentcore/
        └── runtime/               # Bedrock AgentCore Runtime (ECR, CodeBuild, IAM)
```

## Modules

| Module | Description |
|---|---|
| `s3` | Terraform state bucket, artifacts bucket, DynamoDB lock table |
| `dynamodb` | Pipelines and WebSocket connections tables |
| `cognito` | User Pool, Hosted UI, Google and GitHub OAuth |
| `apigateway` | HTTP API (pipeline CRUD) + WebSocket API (agent communication) |
| `lambda` | WebSocket handlers + pipeline CRUD handlers + shared layers |
| `agentcore/runtime` | Bedrock AgentCore Runtime with ECR, CodeBuild, IAM |

## Usage

```bash
cd environments/dev
cp terraform.tfvars.example terraform.tfvars
# Fill in your values (AWS profile, OAuth secrets, etc.)

terraform init
terraform plan
terraform apply
```

## Outputs

After `apply`, Terraform prints:

| Output | Description |
|---|---|
| `http_api_endpoint` | HTTP API base URL for pipeline operations |
| `ws_api_endpoint` | WebSocket endpoint (`wss://...`) |
| `cognito_user_pool_id` | Cognito User Pool ID |
| `cognito_client_id` | Cognito App Client ID |
| `cognito_domain` | Cognito Hosted UI URL |
| `orchestrator_runtime_arn` | AgentCore Runtime ARN |
| `agentcore_memory_id` | AgentCore Memory resource ID |
| `ecr_repository_url` | ECR repository for orchestrator container |

Copy Cognito and API values into `amplify/.env.local`.

## Required Variables

| Variable | Description |
|---|---|
| `aws_region` | AWS region (default: `us-west-2`) |
| `aws_profile` | AWS CLI profile |
| `google_client_id` | Google OAuth client ID (optional) |
| `google_client_secret` | Google OAuth client secret (optional) |
| `github_client_id` | GitHub OAuth client ID (optional) |
| `github_client_secret` | GitHub OAuth client secret (optional) |

See `terraform.tfvars.example` for the full list.
