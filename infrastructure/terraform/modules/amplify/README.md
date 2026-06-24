# Module: Amplify Hosting

Deploys the Flow React frontend (CRA in `amplify/`) to **AWS Amplify Hosting**.

## Resources

| Resource | Description |
|----------|-------------|
| `aws_amplify_app` | Amplify app with SPA rewrite rules and embedded build spec |
| `aws_amplify_branch` | Created in `environments/dev/main.tf` with API/Cognito env vars |

The branch is intentionally **not** created inside this module. Cognito Hosted UI callback URLs need the Amplify default domain, while the branch needs Cognito client IDs — splitting app vs. branch avoids a Terraform dependency cycle.

## Build

- **appRoot:** `amplify`
- **Output:** `amplify/build/`
- **Commands:** `npm ci` → `npm run build`

A copy of the build spec lives at [`../../../amplify/amplify.yml`](../../../amplify/amplify.yml) for reference; Terraform embeds the same spec on the app resource.

## Git connection

Set `github_repo` (e.g. `org/flow`) and `github_access_token` in `terraform.tfvars`. The dev stack passes `https://github.com/{repo}` and enables auto-build on push.

Leave `repository` empty to create the app without Git and connect the repo manually in the Amplify console.

## Environment variables (branch)

| Variable | Source |
|----------|--------|
| `REACT_APP_API_URL` | API Gateway HTTP endpoint |
| `REACT_APP_WS_API_URL` | API Gateway WebSocket endpoint |
| `REACT_APP_COGNITO_*` | Cognito module |
| `REACT_APP_AWS_REGION` | `var.aws_region` |

## Usage

```hcl
module "amplify_app" {
  source = "../../modules/amplify"

  app_name    = "flow"
  environment = "dev"
  repository  = "https://github.com/org/flow"
  access_token = var.github_access_token
}
```

See [`environments/dev/main.tf`](../environments/dev/main.tf) for the full wiring with Cognito and API Gateway.
