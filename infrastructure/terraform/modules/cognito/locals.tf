locals {
  user_attributes = [
    { name = "email",   required = true,  min_length = 1,  max_length = 256  },
    { name = "name",    required = true,  min_length = 1,  max_length = 256  },
    { name = "picture", required = false, min_length = 0,  max_length = 2048 },
  ]

  amplify_callback = var.amplify_default_domain != "" ? [
    "https://main.${var.amplify_default_domain}/auth/callback"
  ] : []

  amplify_logout = var.amplify_default_domain != "" ? [
    "https://main.${var.amplify_default_domain}"
  ] : []
}
