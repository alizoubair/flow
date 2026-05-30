# Module: agentcore/memory

Creates an AgentCore Memory resource with extraction strategies for the Flow platform.

## Resources

- `aws_bedrockagentcore_memory` — the managed memory store
- `aws_bedrockagentcore_memory_strategy` — semantic, user preference, and summarization strategies
- `aws_iam_role` — execution role with Bedrock model inference permissions
- `aws_ssm_parameter` — stores memory ID for runtime discovery

## Memory Strategies

| Strategy | Type | Purpose |
|---|---|---|
| `semantic_fact_extraction` | SEMANTIC | Extracts facts (tech stack, deploy targets, configs) |
| `user_preference_extraction` | USER_PREFERENCE | Extracts preferences (preferred CI platform, cloud provider) |
| `conversation_summary` | SUMMARIZATION | Summarizes sessions to reduce context size |

## Inputs

| Name | Type | Description |
|---|---|---|
| `project_name` | string | Resource name prefix |
| `environment` | string | Deployment environment |
| `event_expiry_days` | number | Days before events expire (default: 90) |
| `tags` | map(string) | Tags for all resources |

## Outputs

| Name | Description |
|---|---|
| `memory_id` | AgentCore Memory ID |
| `memory_arn` | AgentCore Memory ARN |
| `execution_role_arn` | Memory execution role ARN |
