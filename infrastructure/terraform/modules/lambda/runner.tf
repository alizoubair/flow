# CI Runner MicroVM image
#
# Lambda MicroVMs use S3-based code artifacts, not Docker/ECR images.
# runner.py + requirements.txt are packaged and uploaded to S3.
# create_microvm_image builds the image from the AL2023 base + this code.
# The image ARN is deterministic: arn:aws:lambda:{region}:{account}:microvm-image:{name}
#
# The mvm_setup Lambda is invoked by aws_lambda_invocation — Terraform waits
# for it to complete, making image creation a first-class Terraform resource.

locals {
  runner_src_path = abspath("${path.root}/../../../../lambda/ci-runner/runner")
  runner_s3_key   = "${var.app_name}/ci-runner/runner-code.zip"
  mvm_image_name  = "${var.app_name}-ci-runner"
  mvm_image_arn   = "arn:aws:lambda:${var.aws_region}:${var.account_id}:microvm-image:${local.mvm_image_name}"
  mvm_base_image  = "arn:aws:lambda:${var.aws_region}:aws:microvm-image:al2023-1"
}

# CloudWatch log group for MicroVM runner logs

resource "aws_cloudwatch_log_group" "ci_runner" {
  name              = "/aws/lambda-microvms/${var.app_name}-ci-runner"
  retention_in_days = var.log_retention_days
}

# Runner source: runner.py + requirements.txt → S3

data "archive_file" "ci_runner_source" {
  type        = "zip"
  source_dir  = local.runner_src_path
  output_path = "${path.module}/.build/ci-runner-source.zip"

  excludes = ["buildspec.yml"]
}

resource "aws_s3_object" "ci_runner_source" {
  bucket = var.source_s3_bucket
  key    = local.runner_s3_key
  source = data.archive_file.ci_runner_source.output_path
  etag   = data.archive_file.ci_runner_source.output_md5
}

# MicroVM setup Lambda
#
# Creates and waits for the MicroVM image. Invoked synchronously by
# aws_lambda_invocation — Terraform blocks until the image is ACTIVE.
# Timeout = 900s (15 min) to cover the full image build time.

data "archive_file" "mvm_setup" {
  type        = "zip"
  output_path = "${path.module}/.build/mvm-setup.zip"

  source {
    content  = <<-PYTHON
import boto3, json, os, time
from datetime import datetime

def _s(obj):
    if isinstance(obj, datetime): return obj.isoformat()
    raise TypeError(type(obj))

def handler(event, context):
    region = os.environ['AWS_REGION']
    client = boto3.client('lambda-microvms', region_name=region)
    action = event.get('action')

    if action == 'create_and_wait':
        image_arn  = event['image_arn']
        max_wait_s = event.get('max_wait_s', 840)

        # Determine whether to create or update
        try:
            client.get_microvm_image(imageIdentifier=image_arn)
            exists = True
        except Exception as e:
            if 'not found' not in str(e).lower() and 'ResourceNotFoundException' not in type(e).__name__:
                raise
            exists = False

        if exists:
            print(f"Updating MicroVM image (new version): {event['name']}")
            client.update_microvm_image(
                imageIdentifier=image_arn,
                baseImageArn=event['base_image_arn'],
                buildRoleArn=event['build_role_arn'],
                codeArtifact={'uri': event['code_uri']},
            )
        else:
            print(f"Creating MicroVM image: {event['name']}")
            client.create_microvm_image(
                name=event['name'],
                baseImageArn=event['base_image_arn'],
                buildRoleArn=event['build_role_arn'],
                codeArtifact={'uri': event['code_uri']},
            )

        # Poll the latest image version state (not overall image state)
        deadline = time.time() + max_wait_s
        while time.time() < deadline:
            time.sleep(20)
            versions = client.list_microvm_image_versions(imageIdentifier=image_arn)
            items = versions.get('items', [])
            if items:
                latest = sorted(items, key=lambda v: v.get('createdAt', ''), reverse=True)[0]
                state = latest.get('state', 'UNKNOWN')
                version = latest.get('imageVersion', '?')
                print(f"  latest version={version} state={state}")
                if state in ('ACTIVE', 'CREATED'):
                    print(f"Image {image_arn} v{version} is ready.")
                    return json.loads(json.dumps({'imageArn': image_arn, 'state': state, 'version': version}, default=_s))
                if state in ('FAILED', 'CREATE_FAILED'):
                    raise Exception(f"Image version {version} build FAILED: {json.dumps(latest, default=_s)}")
            else:
                print("  no versions found yet, waiting...")

        raise Exception(f"Timeout waiting for image {image_arn} to become ACTIVE.")

    raise ValueError(f"Unknown action: {action}")
    PYTHON
    filename = "mvm_setup.py"
  }
}

resource "aws_lambda_function" "mvm_setup" {
  function_name    = "${var.app_name}-mvm-setup"
  role             = aws_iam_role.ci_orchestrator.arn
  runtime          = "python3.12"
  handler          = "mvm_setup.handler"
  timeout          = 900 # 15 min — covers full image build time
  memory_size      = 256
  filename         = data.archive_file.mvm_setup.output_path
  source_code_hash = data.archive_file.mvm_setup.output_base64sha256
  layers           = [aws_lambda_layer_version.ci_orchestrator_deps.arn]

  depends_on = [aws_lambda_layer_version.ci_orchestrator_deps]
}

# Create / update the MicroVM image — Terraform waits for ACTIVE
#
# aws_lambda_invocation is synchronous: Terraform blocks until mvm_setup
# returns, making image creation a managed Terraform resource.
# Re-runs when runner source changes (source_hash in input).

resource "aws_lambda_invocation" "create_microvm_image" {
  function_name = aws_lambda_function.mvm_setup.function_name

  input = jsonencode({
    action         = "create_and_wait"
    name           = local.mvm_image_name
    image_arn      = local.mvm_image_arn
    base_image_arn = local.mvm_base_image
    build_role_arn = aws_iam_role.ci_runner.arn
    code_uri       = "s3://${var.source_s3_bucket}/${local.runner_s3_key}"
    source_hash    = data.archive_file.ci_runner_source.output_md5
    max_wait_s     = 840
  })

  depends_on = [
    aws_lambda_function.mvm_setup,
    aws_s3_object.ci_runner_source,
    aws_iam_role_policy.ci_orchestrator,
  ]
}
