locals {
  resource_prefix   = "${var.project_name}-${var.environment}-${var.component_name}"
  runtime_name_safe = replace("${var.project_name}_${var.environment}_${var.component_name}", "-", "_")

  # Calculate source hash from agent directory
  source_files = var.agent_source_path != "" ? fileset(var.agent_source_path, "**") : []
  source_hash = var.agent_source_path != "" && length(local.source_files) > 0 ? sha256(join("", [
    for f in local.source_files : filemd5("${var.agent_source_path}/${f}")
    if !can(regex("(__pycache__|.git|.pytest_cache|.pyc|.pyo|.egg-info)", f))
  ])) : "no-source"

  # Use provided container_uri or construct from ECR repository
  final_container_uri = var.container_uri != "" ? var.container_uri : "${aws_ecr_repository.container_repo[0].repository_url}:${var.image_tag}"
}

# ECR Repository
resource "aws_ecr_repository" "container_repo" {
  count = var.container_uri == "" ? 1 : 0
  name  = "${local.resource_prefix}-runtime"

  image_scanning_configuration {
    scan_on_push = true
  }

  image_tag_mutability = "MUTABLE"
  force_delete         = true

  tags = var.tags
}

# ECR Lifecycle Policy
resource "aws_ecr_lifecycle_policy" "container_lifecycle" {
  count      = var.container_uri == "" ? 1 : 0
  repository = aws_ecr_repository.container_repo[0].name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = {
        type = "expire"
      }
    }]
  })
}

# CodeBuild Project
resource "aws_codebuild_project" "container_build" {
  count        = var.enable_codebuild ? 1 : 0
  name         = "${local.resource_prefix}-build"
  description  = "Build container image for ${var.component_name} agent runtime"
  service_role = aws_iam_role.codebuild_role[0].arn

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type                = var.codebuild_compute_type
    image                       = var.codebuild_image
    type                        = "LINUX_CONTAINER"
    privileged_mode             = true
    image_pull_credentials_type = "CODEBUILD"

    environment_variable {
      name  = "AWS_REGION"
      value = var.aws_region
    }

    environment_variable {
      name  = "ECR_REPOSITORY_URI"
      value = local.final_container_uri
    }

    environment_variable {
      name  = "IMAGE_TAG"
      value = var.image_tag
    }
  }

  source {
    type      = "S3"
    location  = "${var.source_s3_bucket}/${var.source_s3_key}"
    buildspec = var.buildspec_path
  }

  logs_config {
    cloudwatch_logs {
      group_name = aws_cloudwatch_log_group.codebuild_logs[0].name
    }
  }

  tags = var.tags
}

# CodeBuild CloudWatch Log Group
resource "aws_cloudwatch_log_group" "codebuild_logs" {
  count             = var.enable_codebuild ? 1 : 0
  name              = "/aws/codebuild/${local.resource_prefix}"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# Upload Source Code to S3
resource "null_resource" "upload_source" {
  count = var.enable_codebuild && var.agent_source_path != "" ? 1 : 0

  triggers = {
    source_hash = local.source_hash
  }

  provisioner "local-exec" {
    working_dir = var.agent_source_path
    environment = {
      AWS_PROFILE = var.aws_profile
    }
    command     = <<-EOT
      set -e
      rm -f /tmp/${var.component_name}-source.zip
      zip -r /tmp/${var.component_name}-source.zip . \
        -x 'venv/*' '.venv/*' '__pycache__/*' '*.pyc' '.git/*' '*.egg-info/*' '.pytest_cache/*'
      aws s3 cp /tmp/${var.component_name}-source.zip \
        s3://${var.source_s3_bucket}/${var.source_s3_key} \
        --region ${var.aws_region}
    EOT
  }

  depends_on = [
    aws_codebuild_project.container_build
  ]
}

# Build and Wait for Container Image
resource "null_resource" "build_and_wait" {
  count = var.enable_codebuild ? 1 : 0

  triggers = {
    source_hash = local.source_hash
  }

  provisioner "local-exec" {
    environment = {
      AWS_PROFILE = var.aws_profile
    }
    command = <<-EOT
      set -e
      echo "Starting CodeBuild for ${var.component_name}..."
      BUILD_ID=$(aws codebuild start-build \
        --project-name "${local.resource_prefix}-build" \
        --region ${var.aws_region} \
        --query 'build.id' --output text)
      for i in $(seq 1 90); do
        STATUS=$(aws codebuild batch-get-builds --ids "$BUILD_ID" --region ${var.aws_region} \
          --query 'builds[0].buildStatus' --output text)
        echo "  build status: $STATUS"

        case "$STATUS" in
          SUCCEEDED) exit 0 ;;
          FAILED|FAULT|STOPPED|TIMED_OUT) echo "build failed: $STATUS"; exit 1 ;;
        esac
        sleep 10
      done
      echo "build timeout"
      exit 1
    EOT
  }

  depends_on = [
    aws_codebuild_project.container_build,
    aws_ecr_repository.container_repo,
    aws_iam_role_policy.codebuild_policy,
    null_resource.upload_source
  ]
}

# AgentCore Runtime
resource "aws_bedrockagentcore_agent_runtime" "agent_runtime" {
  agent_runtime_name = local.runtime_name_safe
  description        = var.runtime_description
  role_arn           = aws_iam_role.runtime_execution_role.arn

  network_configuration {
    network_mode = var.network_mode

    dynamic "network_mode_config" {
      for_each = var.network_mode == "VPC" ? [1] : []
      content {
        subnets         = var.subnet_ids
        security_groups = var.security_group_ids
      }
    }
  }

  protocol_configuration {
    server_protocol = var.protocol
  }

  agent_runtime_artifact {
    container_configuration {
      container_uri = local.final_container_uri
    }
  }

  environment_variables = merge(
    {
      AWS_REGION   = var.aws_region
      PROJECT_NAME = var.project_name
      ENVIRONMENT  = var.environment
    },
    var.extra_env_vars
  )

  tags = merge(
    var.tags,
    {
      Component   = var.component_name
      Environment = var.environment
    }
  )

  depends_on = [
    aws_iam_role.runtime_execution_role,
    null_resource.build_and_wait
  ]
}

# SSM Parameters for Runtime
resource "aws_ssm_parameter" "runtime_arn" {
  name  = "/${var.project_name}/${var.environment}/runtimes/${var.component_name}/arn"
  type  = "String"
  value = aws_bedrockagentcore_agent_runtime.agent_runtime.agent_runtime_arn

  tags = var.tags
}

resource "aws_ssm_parameter" "runtime_id" {
  name  = "/${var.project_name}/${var.environment}/runtimes/${var.component_name}/id"
  type  = "String"
  value = aws_bedrockagentcore_agent_runtime.agent_runtime.agent_runtime_id

  tags = var.tags
}
