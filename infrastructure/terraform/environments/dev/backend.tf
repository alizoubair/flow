# Step 1: Apply with this file commented out (local state)
#         The s3 module in main.tf will create the bucket and lock table.
#
# Step 2: Uncomment the block below, then run:
#         terraform init -migrate-state
#         This moves local state into the S3 bucket.

# terraform {
#   backend "s3" {
#     bucket         = "flow-terraform-state"
#     key            = "dev/terraform.tfstate"
#     region         = "us-east-1"
#     dynamodb_table = "flow-terraform-locks"
#     encrypt        = true
#     profile        = "alizoubair"
#   }
# }
