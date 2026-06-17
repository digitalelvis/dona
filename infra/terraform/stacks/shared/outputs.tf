output "role_arns" {
  value = {
    dev     = aws_iam_role.gha_dev.arn
    staging = aws_iam_role.gha_staging.arn
    prod    = aws_iam_role.gha_prod.arn
  }
}

output "oidc_provider_arn" {
  value = local.oidc_provider_arn
}
