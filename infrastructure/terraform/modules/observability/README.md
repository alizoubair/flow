# Module: observability

Enables AgentCore observability for a single Bedrock AgentCore resource (Gateway, Memory, Runtime artifact, etc.) by wiring CloudWatch log delivery for **APPLICATION_LOGS** and **TRACES**.

## Resources

| Resource | Purpose |
|---|---|
| `aws_cloudwatch_log_group` | Vended log destination for application logs |
| `aws_cloudwatch_log_delivery_source` | APPLICATION_LOGS and TRACES sources on the AgentCore resource |
| `aws_cloudwatch_log_delivery_destination` | Log group (logs) and X-Ray (traces) destinations |
| `aws_cloudwatch_log_delivery` | Connects each source to its destination |
s
## Default log group path

```
/aws/vendedlogs/bedrock-agentcore/{resource_name}/{project_name}-{environment}
```

Override with `log_group_name` when a resource requires a different path (e.g. Memory uses `.../memory/APPLICATION_LOGS/{memory_id}`).

## Trace delivery note

TRACES are sent to X-Ray via `delivery_destination_type = "XRAY"`. Span ingestion in CloudWatch GenAI Observability additionally requires **CloudWatch Transaction Search** at the account level (see step 2 in platform docs — not part of this module).

## Usage

```hcl
module "observability_gateway" {
  source = "../../modules/observability"

  project_name  = local.app_name
  environment   = local.environment
  aws_region    = var.aws_region
  resource_name = "gateway"
  resource_arn  = module.gateway.gateway_arn

  tags = {
    Project     = local.app_name
    Environment = local.environment
    ManagedBy   = "terraform"
  }
}
```

Memory with a custom log group path:

```hcl
module "observability_memory" {
  source = "../../modules/observability"

  project_name  = local.app_name
  environment   = local.environment
  aws_region    = var.aws_region
  resource_name = "memory"
  resource_arn  = module.agentcore_memory.memory_arn

  log_group_name = "/aws/vendedlogs/bedrock-agentcore/memory/APPLICATION_LOGS/${module.agentcore_memory.memory_id}"

  tags = var.tags
}
```

## Inputs

| Name | Type | Default | Description |
|---|---|---|---|
| `project_name` | string | — | Project prefix |
| `environment` | string | — | Environment name |
| `resource_name` | string | — | Resource id in log path (gateway, memory, …) |
| `resource_arn` | string | — | AgentCore resource ARN |
| `aws_region` | string | — | AWS region |
| `log_group_name` | string | `null` | Optional log group name override |
| `log_retention_days` | number | `30` | Log retention |
| `enable_application_logs` | bool | `true` | Toggle APPLICATION_LOGS delivery |
| `enable_traces` | bool | `true` | Toggle TRACES → X-Ray delivery |
| `tags` | map(string) | `{}` | Resource tags |

## Outputs

| Name | Description |
|---|---|
| `log_group_name` | Application log group name |
| `log_group_arn` | Application log group ARN |
| `logs_delivery_source_name` | APPLICATION_LOGS delivery source |
| `traces_delivery_source_name` | TRACES delivery source |
