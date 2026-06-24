locals {
  name = "${var.app_name}-${var.environment}-frontend"

  build_spec = var.build_spec != "" ? var.build_spec : <<-EOT
    version: 1
    applications:
      - appRoot: amplify
        frontend:
          phases:
            preBuild:
              commands:
                - nvm install 20
                - nvm use 20
                - node -v && npm -v
                - npm install
            build:
              commands:
                - npm run build
          artifacts:
            baseDirectory: build
            files:
              - '**/*'
          cache:
            paths:
              - node_modules/**/*
  EOT
}

# Amplify app (static CRA hosting). Branch and env vars are wired in the environment
# stack to avoid a Terraform dependency cycle with Cognito callback URLs.

resource "aws_amplify_app" "frontend" {
  count = var.enabled ? 1 : 0

  name       = local.name
  platform   = "WEB"
  repository = var.repository != "" ? var.repository : null

  access_token = var.repository != "" ? var.access_token : null

  build_spec = local.build_spec

  enable_branch_auto_build = var.repository != ""

  # SPA rewrite — client-side routes (React Router) serve index.html
  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>"
    status = "200"
    target = "/index.html"
  }

  tags = merge(var.tags, { Name = local.name })
}
