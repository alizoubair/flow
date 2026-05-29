variable "aws_region" {
  type    = string
  default = "us-west-2"
}

variable "aws_profile" {
  type    = string
  default = "alizoubair"
}

variable "google_client_id" {
  type      = string
  sensitive = true
}

variable "google_client_secret" {
  type      = string
  sensitive = true
}

variable "github_client_id" {
  type      = string
  sensitive = true
  default   = ""
}

variable "github_client_secret" {
  type      = string
  sensitive = true
  default   = ""
}

variable "github_repo" {
  type    = string
  default = "alizoubair/flow"
}

variable "github_access_token" {
  type      = string
  sensitive = true
}
