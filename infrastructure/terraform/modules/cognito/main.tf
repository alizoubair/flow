# User Pool

resource "aws_cognito_user_pool" "main" {
  name                     = "${var.app_name}-user-pool"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  dynamic "schema" {
    for_each = local.user_attributes
    content {
      name                = schema.value.name
      attribute_data_type = "String"
      required            = schema.value.required
      mutable             = true
      string_attribute_constraints {
        min_length = tostring(schema.value.min_length)
        max_length = tostring(schema.value.max_length)
      }
    }
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Your Flow verification code"
    email_message        = "Your verification code is {####}"
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  tags = { Name = "${var.app_name}-user-pool" }
}

# Hosted UI domain

resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${var.app_name}-auth-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id
}

# Google identity provider

resource "aws_cognito_identity_provider" "google" {
  count = var.google_client_id != "" ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
    authorize_scopes = "openid email profile"
  }

  attribute_mapping = {
    email    = "email"
    name     = "name"
    picture  = "picture"
    username = "sub"
  }
}

# GitHub identity provider (OIDC)
# GitHub is not a native Cognito provider, added as custom OIDC

resource "aws_cognito_identity_provider" "github" {
  count = var.github_client_id != "" ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "GitHub"
  provider_type = "OIDC"

  provider_details = {
    client_id                 = var.github_client_id
    client_secret             = var.github_client_secret
    attributes_request_method = "GET"
    oidc_issuer               = "https://token.actions.githubusercontent.com"
    authorize_scopes          = "openid user:email read:user"
    authorize_url             = "https://github.com/login/oauth/authorize"
    token_url                 = "https://github.com/login/oauth/access_token"
    attributes_url            = "https://api.github.com/user"
    jwks_uri                  = "https://token.actions.githubusercontent.com/.well-known/jwks"
  }

  attribute_mapping = {
    email    = "email"
    name     = "name"
    picture  = "avatar_url"
    username = "id"
  }
}

# App Client

resource "aws_cognito_user_pool_client" "app" {
  name         = "${var.app_name}-app-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  allowed_oauth_flows_user_pool_client = true

  callback_urls = concat(
    ["http://localhost:3000/auth/callback"],
    local.amplify_callback
  )

  logout_urls = concat(
    ["http://localhost:3000"],
    local.amplify_logout
  )

  supported_identity_providers = concat(
    ["COGNITO"],
    var.google_client_id != "" ? ["Google"] : [],
    var.github_client_id != "" ? ["GitHub"] : []
  )

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 7

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  prevent_user_existence_errors = "ENABLED"

  depends_on = [
    aws_cognito_identity_provider.google,
    aws_cognito_identity_provider.github,
  ]
}

# Resource server for AgentCore Gateway M2M access

resource "aws_cognito_resource_server" "gateway" {
  identifier   = "${var.app_name}-gateway"
  name         = "${var.app_name} Gateway"
  user_pool_id = aws_cognito_user_pool.main.id

  scope {
    scope_name        = "invoke"
    scope_description = "Invoke the AgentCore MCP Gateway"
  }
}

# M2M client used by agent runtimes to call the MCP Gateway

resource "aws_cognito_user_pool_client" "gateway_m2m" {
  name         = "${var.app_name}-gateway-m2m"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = true

  allowed_oauth_flows                  = ["client_credentials"]
  allowed_oauth_scopes                 = ["${aws_cognito_resource_server.gateway.identifier}/invoke"]
  supported_identity_providers         = ["COGNITO"]
  allowed_oauth_flows_user_pool_client = true
}
