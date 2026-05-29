# Module: cognito

Creates the Cognito User Pool with Google and GitHub OAuth providers and a Hosted UI domain.

## Resources

- `aws_cognito_user_pool` — User Pool with email sign-in, password policy, and dynamic schema attributes
- `aws_cognito_user_pool_domain` — Hosted UI domain (`<app_name>-auth-<env>.auth.<region>.amazoncognito.com`)
- `aws_cognito_identity_provider` (Google) — Google OAuth via native Cognito provider
- `aws_cognito_identity_provider` (GitHub) — GitHub OAuth via custom OIDC provider (optional)
- `aws_cognito_user_pool_client` — Public app client (no secret) for SPA use

## User Attributes

Defined dynamically via `locals.tf`:

| Attribute | Required | Max Length |
|---|---|---|
| `email` | yes | 256 |
| `name` | yes | 256 |
| `picture` | no | 2048 |

## Inputs

| Name | Type | Description |
|---|---|---|
| `app_name` | string | Resource name prefix |
| `environment` | string | Deployment environment |
| `aws_region` | string | AWS region |
| `google_client_id` | string (sensitive) | Google OAuth client ID |
| `google_client_secret` | string (sensitive) | Google OAuth client secret |
| `github_client_id` | string (sensitive) | GitHub OAuth client ID (optional) |
| `github_client_secret` | string (sensitive) | GitHub OAuth client secret (optional) |
| `amplify_default_domain` | string | Amplify domain for callback URL registration |

## Outputs

| Name | Description |
|---|---|
| `user_pool_id` | Cognito User Pool ID |
| `user_pool_arn` | Cognito User Pool ARN |
| `client_id` | App Client ID |
| `domain` | Hosted UI domain (without https://) |
| `hosted_ui_url` | Full Hosted UI URL |
