# Module: dynamodb

Creates the DynamoDB tables used by the Flow platform.

## Tables

| Table | Key | Purpose |
|---|---|---|
| `flow-pipelines` | PK (HASH) + SK (RANGE) | Single-table design for pipeline data |
| `flow-ws-connections` | `connectionId` (HASH) | Active WebSocket connections with TTL |

### Pipelines table access patterns
- `PK = "USER#<sub>"` + `SK begins_with "PIPELINE#"` — list all pipelines for a user
- `PK = "USER#<sub>"` + `SK = "PIPELINE#<id>"` — get/update/delete a specific pipeline
- `StatusIndex` GSI — query pipelines by status, sorted by updatedAt

### WebSocket connections table
- `UserIdIndex` GSI — find all connections for a user (for fan-out notifications)
- TTL on `ttl` attribute — auto-expires stale connections after 2 hours

## Inputs

| Name | Type | Description |
|---|---|---|
| `app_name` | string | Resource name prefix |
| `environment` | string | Deployment environment |

## Outputs

| Name | Description |
|---|---|
| `pipelines_table_name` | Pipelines table name |
| `pipelines_table_arn` | Pipelines table ARN |
| `ws_connections_table_name` | WebSocket connections table name |
| `ws_connections_table_arn` | WebSocket connections table ARN |
