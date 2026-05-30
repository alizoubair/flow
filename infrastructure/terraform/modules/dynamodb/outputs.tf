output "ws_connections_table_name" {
  value = aws_dynamodb_table.ws_connections.name
}

output "ws_connections_table_arn" {
  value = aws_dynamodb_table.ws_connections.arn
}

output "pipelines_table_name" {
  value = aws_dynamodb_table.pipelines.name
}

output "pipelines_table_arn" {
  value = aws_dynamodb_table.pipelines.arn
}

output "conversations_table_name" {
  value = aws_dynamodb_table.conversations.name
}

output "conversations_table_arn" {
  value = aws_dynamodb_table.conversations.arn
}
