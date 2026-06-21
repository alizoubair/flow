locals {
  resource_prefix   = "${var.project_name}-${var.environment}-${var.component_name}"
  runtime_name_safe = replace("${var.project_name}_${var.environment}_${var.component_name}", "-", "_")

  source_path_exclude = "(^venv/|^\\.venv/|__pycache__|\\.git|\\.pytest_cache|\\.pyc$|\\.pyo$|\\.egg-info)"

  # Calculate source hash from agent directory and any bundled shared paths
  source_files = var.agent_source_path != "" ? fileset(var.agent_source_path, "**") : []
  extra_source_files = flatten([
    for path in var.additional_source_paths :
    [for f in fileset(path, "**") : "${path}/${f}"]
    if path != ""
  ])
  source_hash = (var.agent_source_path != "" && length(local.source_files) > 0) || length(local.extra_source_files) > 0 ? sha256(join("", concat(
    [
      for f in local.source_files : filemd5("${var.agent_source_path}/${f}")
      if !can(regex(local.source_path_exclude, f))
    ],
    [
      for f in local.extra_source_files : filemd5(f)
      if !can(regex(local.source_path_exclude, f))
    ],
  ))) : "no-source"

  agent_archive_files = {
    for f in local.source_files :
    f => "${var.agent_source_path}/${f}"
    if !can(regex(local.source_path_exclude, f))
  }

  additional_archive_files = merge([
    for base_path in var.additional_source_paths : {
      for f in fileset(base_path, "**") :
      "${basename(base_path)}/${f}" => "${base_path}/${f}"
      if base_path != "" && !can(regex(local.source_path_exclude, f))
    }
  ]...)

  # Hash-tagged images force Terraform to update the runtime when agent source changes.
  image_tag = var.container_uri != "" ? var.image_tag : local.source_hash

  final_container_uri = var.container_uri != "" ? var.container_uri : "${aws_ecr_repository.container_repo[0].repository_url}:${local.image_tag}"
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
      value = local.image_tag
    }

    environment_variable {
      name  = "SOURCE_HASH"
      value = local.source_hash
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

# Package agent source (plus optional shared paths) and upload to S3 for CodeBuild.
data "archive_file" "agent_source" {
  count = var.enable_codebuild && var.agent_source_path != "" ? 1 : 0

  type        = "zip"
  output_path = "${path.module}/.build/${var.component_name}-${local.source_hash}.zip"

  dynamic "source" {
    for_each = local.agent_archive_files
    content {
      content  = file(source.value)
      filename = source.key
    }
  }

  dynamic "source" {
    for_each = local.additional_archive_files
    content {
      content  = file(source.value)
      filename = source.key
    }
  }
}

resource "aws_s3_object" "agent_source" {
  count = var.enable_codebuild && var.agent_source_path != "" ? 1 : 0

  bucket = var.source_s3_bucket
  key    = var.source_s3_key
  source = data.archive_file.agent_source[0].output_path
  etag   = data.archive_file.agent_source[0].output_md5

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
      AWS_PROFILE    = var.aws_profile
      PROJECT_NAME   = "${local.resource_prefix}-build"
      AWS_REGION_VAR = var.aws_region
      COMPONENT_NAME = var.component_name
      ECR_REPO_NAME  = aws_ecr_repository.container_repo[0].name
      SOURCE_HASH    = local.source_hash
    }
    interpreter = ["bash", "-c"]
    command     = "if aws ecr describe-images --repository-name \"$ECR_REPO_NAME\" --image-ids imageTag=\"$SOURCE_HASH\" --region \"$AWS_REGION_VAR\" >/dev/null 2>&1; then echo \"Image $ECR_REPO_NAME:$SOURCE_HASH exists, skipping CodeBuild.\"; exit 0; fi; echo \"Starting CodeBuild for $COMPONENT_NAME...\"; BUILD_ID=$(aws codebuild start-build --project-name \"$PROJECT_NAME\" --region \"$AWS_REGION_VAR\" --query 'build.id' --output text); echo \"Build ID: $BUILD_ID\"; for i in $(seq 1 90); do STATUS=$(aws codebuild batch-get-builds --ids \"$BUILD_ID\" --region \"$AWS_REGION_VAR\" --query 'builds[0].buildStatus' --output text); echo \"  build status: $STATUS\"; case \"$STATUS\" in SUCCEEDED) exit 0;; FAILED|FAULT|STOPPED|TIMED_OUT) echo \"build failed: $STATUS\"; exit 1;; esac; sleep 10; done; echo \"build timeout\"; exit 1"
  }

  depends_on = [
    aws_codebuild_project.container_build,
    aws_ecr_repository.container_repo,
    aws_iam_role_policy.codebuild_policy,
    aws_s3_object.agent_source
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
      # Forces a runtime update when agent source changes (matches AWS sample).
      SOURCE_HASH = local.source_hash
    },
    var.enable_observability ? {
      AGENT_OBSERVABILITY_ENABLED             = "true"
      OTEL_PYTHON_DISTRO                      = "aws_distro"
      OTEL_PYTHON_CONFIGURATOR                = "aws_configurator"
      OTEL_EXPORTER_OTLP_PROTOCOL             = "http/protobuf"
      OTEL_LOGS_EXPORTER                      = "otlp"
      OTEL_TRACES_EXPORTER                    = "otlp"
      OTEL_SEMCONV_STABILITY_OPT_IN           = "gen_ai_latest_experimental,gen_ai_use_latest_invocation_tokens"
      OTEL_PYTHON_DISABLED_INSTRUMENTATIONS    = var.otel_disabled_instrumentations
      OTEL_RESOURCE_ATTRIBUTES                = "service.name=${local.runtime_name_safe}"
    } : {
      AGENT_OBSERVABILITY_ENABLED = "false"
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
