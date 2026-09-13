# Lambda layer for CI orchestrator dependencies
#
# Builds aws_durable_execution_sdk_python locally and packages it as a layer.
# pip is called with --platform to target Lambda's Amazon Linux x86_64 runtime.

locals {
  ci_layer_dir = "${abspath(path.module)}/.build/ci-layer"
  ci_layer_zip = "${abspath(path.module)}/.build/ci-orchestrator-deps.zip"
}

resource "null_resource" "build_ci_layer" {
  triggers = {
    requirements = sha256("aws_durable_execution_sdk_python boto3 botocore")
  }

  provisioner "local-exec" {
    interpreter = ["bash", "-c"]
    command     = <<-EOT
      rm -rf '${local.ci_layer_dir}'
      mkdir -p '${local.ci_layer_dir}/python'
      pip3 install \
        aws_durable_execution_sdk_python \
        boto3 \
        botocore \
        -t '${local.ci_layer_dir}/python' \
        --quiet --upgrade
      cd '${local.ci_layer_dir}' && zip -r '${local.ci_layer_zip}' python/ -x '*.pyc' -x '__pycache__/*'
    EOT
  }
}

resource "aws_lambda_layer_version" "ci_orchestrator_deps" {
  filename         = local.ci_layer_zip
  layer_name       = "${var.app_name}-ci-orchestrator-deps"
  compatible_runtimes = ["python3.12"]

  depends_on = [null_resource.build_ci_layer]

  lifecycle {
    replace_triggered_by = [null_resource.build_ci_layer]
  }
}
