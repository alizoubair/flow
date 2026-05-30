# WebSocket connections table
# Stores connectionId to userId mappings
# TTL auto-expires stale connections after 2 hours

resource "aws_dynamodb_table" "ws_connections" {
  name         = "${var.app_name}-ws-connections"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connectionId"

  attribute {
    name = "connectionId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name            = "UserIdIndex"
    hash_key        = "userId"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = { Name = "${var.app_name}-ws-connections" }
}

# Pipelines table
# Stores user pipeline configurations with nodes, edges, and metadata
# Uses PK/SK pattern: PK = USER#userId, SK = PIPELINE#pipelineId

resource "aws_dynamodb_table" "pipelines" {
  name         = "${var.app_name}-pipelines"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "updatedAt"
    type = "S"
  }

  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "status"
    range_key       = "updatedAt"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = { Name = "${var.app_name}-pipelines" }
}

# Conversations table
# Stores chat history for the frontend (prompt, response, timestamps)
# PK = userId, SK = createdAt (ISO timestamp) for chronological queries

resource "aws_dynamodb_table" "conversations" {
  name         = "${var.app_name}-conversations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "createdAt"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = { Name = "${var.app_name}-conversations" }
}
