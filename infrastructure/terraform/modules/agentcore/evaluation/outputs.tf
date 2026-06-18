output "service_role_arn" {
  value = aws_iam_role.service.arn
}

output "service_role_name" {
  value = aws_iam_role.service.name
}

output "developer_policy_arn" {
  value = aws_iam_policy.developer.arn
}
