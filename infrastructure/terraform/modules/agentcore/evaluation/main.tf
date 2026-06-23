# Service execution role (assumed by bedrock-agentcore.amazonaws.com)

data "aws_iam_policy_document" "service_assume" {
  statement {
    sid     = "TrustPolicyStatement"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["bedrock-agentcore.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.account_id]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceAccount"
      values   = [var.account_id]
    }

    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values = [
        "arn:aws:bedrock-agentcore:${var.aws_region}:${var.account_id}:online-evaluation-config/*",
      ]
    }
  }
}

data "aws_iam_policy_document" "service_permissions" {
  statement {
    sid    = "CloudWatchLogReadStatement"
    effect = "Allow"
    actions = [
      "logs:DescribeLogGroups",
      "logs:GetQueryResults",
      "logs:StartQuery",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "CloudWatchLogWriteStatement"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = [
      "arn:aws:logs:${var.aws_region}:${var.account_id}:log-group:/aws/bedrock-agentcore/evaluations/*",
    ]
  }

  statement {
    sid    = "CloudWatchIndexPolicyStatement"
    effect = "Allow"
    actions = [
      "logs:DescribeIndexPolicies",
      "logs:PutIndexPolicy",
    ]
    resources = [
      "arn:aws:logs:${var.aws_region}:${var.account_id}:log-group:aws/spans",
      "arn:aws:logs:${var.aws_region}:${var.account_id}:log-group:aws/spans:*",
    ]
  }

  statement {
    sid    = "BedrockInvokeStatement"
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
    ]
    resources = [
      "arn:aws:bedrock:${var.aws_region}::foundation-model/*",
      "arn:aws:bedrock:${var.aws_region}:${var.account_id}:inference-profile/*",
    ]
  }
}

# Role name follows the AgentCoreEvaluationRole* pattern so the developer
# PassRole condition matches it automatically

resource "aws_iam_role" "service" {
  name               = "AgentCoreEvaluationRole-${var.project_name}-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.service_assume.json
  description        = "Service role for AgentCore online evaluation (${var.project_name}-${var.environment})"
  tags               = var.tags
}

resource "aws_iam_role_policy" "service_permissions" {
  name   = "online-eval-permissions"
  role   = aws_iam_role.service.id
  policy = data.aws_iam_policy_document.service_permissions.json
}

# Developer / CI policy — attach to the IAM user or role that manages evaluations

data "aws_iam_policy_document" "developer" {
  statement {
    sid    = "EvaluationManagement"
    effect = "Allow"
    actions = [
      "bedrock-agentcore:CreateEvaluator",
      "bedrock-agentcore:GetEvaluator",
      "bedrock-agentcore:ListEvaluators",
      "bedrock-agentcore:UpdateEvaluator",
      "bedrock-agentcore:DeleteEvaluator",
      "bedrock-agentcore:CreateOnlineEvaluationConfig",
      "bedrock-agentcore:GetOnlineEvaluationConfig",
      "bedrock-agentcore:ListOnlineEvaluationConfigs",
      "bedrock-agentcore:UpdateOnlineEvaluationConfig",
      "bedrock-agentcore:DeleteOnlineEvaluationConfig",
      "bedrock-agentcore:Evaluate",
    ]
    resources = ["*"]
  }

  statement {
    sid     = "PassOnlineEvalRole"
    effect  = "Allow"
    actions = ["iam:PassRole"]
    resources = [
      "arn:aws:iam::${var.account_id}:role/AgentCoreEvaluationRole*",
    ]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["bedrock-agentcore.amazonaws.com"]
    }
  }

  statement {
    sid    = "BedrockInvokeForEvaluation"
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:Converse",
      "bedrock:InvokeModelWithResponseStream",
      "bedrock:ConverseStream",
    ]
    resources = [
      "arn:aws:bedrock:*::foundation-model/*",
      "arn:aws:bedrock:*:${var.account_id}:inference-profile/*",
    ]
  }

  statement {
    sid    = "CloudWatchLogIndexing"
    effect = "Allow"
    actions = [
      "logs:DescribeIndexPolicies",
      "logs:PutIndexPolicy",
      "logs:CreateLogGroup",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "ReadEvaluationResults"
    effect = "Allow"
    actions = [
      "logs:StartQuery",
      "logs:GetQueryResults",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams",
      "logs:FilterLogEvents",
      "logs:GetLogEvents",
    ]
    resources = [
      "arn:aws:logs:${var.aws_region}:${var.account_id}:log-group:/aws/bedrock-agentcore/evaluations/*",
    ]
  }

  statement {
    sid    = "ReadEvaluationMetrics"
    effect = "Allow"
    actions = [
      "cloudwatch:GetMetricStatistics",
      "cloudwatch:ListMetrics",
      "cloudwatch:GetMetricData",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "developer" {
  name        = "${var.project_name}-${var.environment}-online-eval-developer"
  description = "Permissions for developers/CI to manage AgentCore online evaluations"
  policy      = data.aws_iam_policy_document.developer.json
  tags        = var.tags
}
