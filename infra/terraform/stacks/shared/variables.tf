# Intentionally minimal: shared stack is account-scoped and uses data sources.

variable "existing_github_oidc_provider_arn" {
  type        = string
  description = <<-EOT
    IAM OIDC provider ARN for https://token.actions.githubusercontent.com.
    Leave empty to create and manage aws_iam_openid_connect_provider.github in this stack.
    Set when the provider already exists in the account (avoid duplicate / EntityAlreadyExists).
  EOT
  default     = ""

  validation {
    condition = (
      var.existing_github_oidc_provider_arn == "" ||
      can(regex("^arn:aws:iam::[0-9]{12}:oidc-provider/token\\.actions\\.githubusercontent\\.com$", var.existing_github_oidc_provider_arn))
    )
    error_message = "Must be empty or arn:aws:iam::<12-digit-account>:oidc-provider/token.actions.githubusercontent.com"
  }
}
