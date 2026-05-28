# Module: s3

Creates the S3 bucket and DynamoDB table used for Terraform remote state.

## Important

This module must be applied **once before** running the main infrastructure, since the backend bucket needs to exist before `terraform init` can use it.

## Bootstrap steps

```bash
cd infrastructure/terraform/environments/dev
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply
```

After apply, uncomment the `backend "s3"` block in `environments/dev/backend.tf` and run `terraform init` again to migrate state.

## Resources

- `aws_s3_bucket` — versioned, encrypted, private bucket for state files
- `aws_s3_bucket_versioning` — enables versioning for state history and recovery
- `aws_s3_bucket_server_side_encryption_configuration` — AES256 encryption at rest
- `aws_s3_bucket_public_access_block` — blocks all public access
- `aws_dynamodb_table` — lock table to prevent concurrent state writes

## Inputs

| Name | Type | Description |
|---|---|---|
| `app_name` | string | Resource name prefix |
| `aws_region` | string | AWS region |

## Outputs

| Name | Description |
|---|---|
| `state_bucket_name` | S3 bucket name |
| `state_bucket_arn` | S3 bucket ARN |
| `lock_table_name` | DynamoDB lock table name |
