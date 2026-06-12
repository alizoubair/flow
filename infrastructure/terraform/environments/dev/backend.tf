terraform {
  backend "s3" {
    bucket         = "flow-terraform-state"
    key            = "dev/terraform.tfstate"
    region         = "us-west-2"
    dynamodb_table = "flow-terraform-locks"
    encrypt        = true
    profile        = "alizoubair"
  }
}
