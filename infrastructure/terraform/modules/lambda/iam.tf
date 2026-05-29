# Shared assume-role policy

data "aws_iam_policy_document" "assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# One IAM role per lambda group

resource "aws_iam_role" "lambda" {
  for_each           = local.lambda_groups
  name               = "${var.app_name}-${each.key}-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

resource "aws_iam_role_policy_attachment" "basic" {
  for_each   = local.lambda_groups
  role       = aws_iam_role.lambda[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Inline policy per group: CloudWatch logs + DynamoDB access + any extra statements

resource "aws_iam_role_policy" "lambda" {
  for_each = local.lambda_groups
  name     = "${var.app_name}-${each.key}-lambda-policy"
  role     = aws_iam_role.lambda[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Effect = "Allow"
          Action = [
            "logs:CreateLogStream",
            "logs:PutLogEvents",
          ]
          Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/lambda/${var.app_name}-${each.key}-*:*"
        },
        {
          Effect = "Allow"
          Action = [
            "dynamodb:PutItem",
            "dynamodb:GetItem",
            "dynamodb:DeleteItem",
            "dynamodb:UpdateItem",
            "dynamodb:Query",
            "dynamodb:Scan",
          ]
          Resource = each.value.dynamodb_arns
        }
      ],
      each.value.extra_statements
    )
  })
}
