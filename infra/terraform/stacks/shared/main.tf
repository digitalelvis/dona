data "aws_caller_identity" "current" {}

data "aws_dynamodb_table" "tf_locks" {
  name = "donaoferta-tf-locks"
}

data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com"
}

locals {
  account_id = data.aws_caller_identity.current.account_id

  state_bucket     = "donaoferta-tfstate-${local.account_id}"
  state_bucket_arn = "arn:aws:s3:::${local.state_bucket}"

  # aws_iam_openid_connect_providers (plural) is not available in AWS provider ~> 5.x.
  # Greenfield: leave existing_github_oidc_provider_arn empty so we create the provider.
  # If the account already has GitHub OIDC: set the variable to that ARN (or import the resource).
  create_github_oidc = var.existing_github_oidc_provider_arn == ""

  oidc_provider_arn = local.create_github_oidc ? aws_iam_openid_connect_provider.github[0].arn : var.existing_github_oidc_provider_arn

  lambda_actions = [
    "lambda:UpdateFunctionCode",
    "lambda:UpdateFunctionConfiguration",
    "lambda:GetFunction",
    "lambda:PublishVersion",
    "lambda:CreateFunction",
    "lambda:DeleteFunction",
    "lambda:TagResource",
    "lambda:AddPermission",
    "lambda:RemovePermission",
  ]

  apigw_actions = [
    "apigateway:GET",
    "apigateway:POST",
    "apigateway:PUT",
    "apigateway:DELETE",
    "apigateway:PATCH",
  ]

  iam_read_actions = [
    "iam:GetRole",
    "iam:GetRolePolicy",
    "iam:ListRolePolicies",
    "iam:ListAttachedRolePolicies",
  ]

  iam_write_actions = [
    "iam:CreateRole",
    "iam:DeleteRole",
    "iam:PutRolePolicy",
    "iam:DeleteRolePolicy",
    "iam:AttachRolePolicy",
    "iam:DetachRolePolicy",
    "iam:TagRole",
    "iam:UntagRole",
    "iam:PassRole",
  ]

  lambda_exec_role_arn = {
    dev     = "arn:aws:iam::${local.account_id}:role/donaoferta-api-dev-exec"
    staging = "arn:aws:iam::${local.account_id}:role/donaoferta-api-staging-exec"
    prod    = "arn:aws:iam::${local.account_id}:role/donaoferta-api-prod-exec"
  }

  lambda_fn_arn = {
    dev     = "arn:aws:lambda:us-east-1:${local.account_id}:function:donaoferta-api-dev"
    staging = "arn:aws:lambda:us-east-1:${local.account_id}:function:donaoferta-api-staging"
    prod    = "arn:aws:lambda:us-east-1:${local.account_id}:function:donaoferta-api-prod"
  }

  execute_api_arn = "arn:aws:execute-api:us-east-1:${local.account_id}:*/*/*"

  state_prefix_arn = {
    dev     = "${local.state_bucket_arn}/api/dev/*"
    staging = "${local.state_bucket_arn}/api/staging/*"
    prod    = "${local.state_bucket_arn}/api/prod/*"
  }

  gha_policy_statements = {
    dev = [
      {
        effect    = "Allow"
        actions   = ["sts:GetCallerIdentity"]
        resources = ["*"]
      },
      {
        effect    = "Allow"
        actions   = ["s3:ListBucket"]
        resources = [local.state_bucket_arn]
      },
      {
        effect    = "Allow"
        actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        resources = [local.state_prefix_arn.dev]
      },
      {
        effect    = "Allow"
        actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"]
        resources = [data.aws_dynamodb_table.tf_locks.arn]
      },
      {
        effect    = "Allow"
        actions   = local.lambda_actions
        resources = [local.lambda_fn_arn.dev]
      },
      {
        effect    = "Allow"
        actions   = local.apigw_actions
        resources = [local.execute_api_arn]
      },
      {
        effect    = "Allow"
        actions   = local.iam_read_actions
        resources = [local.lambda_exec_role_arn.dev]
      },
      {
        effect    = "Allow"
        actions   = local.iam_write_actions
        resources = [local.lambda_exec_role_arn.dev]
      },
      {
        effect    = "Allow"
        actions   = ["iam:GetOpenIDConnectProvider"]
        resources = [local.oidc_provider_arn]
      },
    ]

    staging = [
      {
        effect    = "Allow"
        actions   = ["sts:GetCallerIdentity"]
        resources = ["*"]
      },
      {
        effect    = "Allow"
        actions   = ["s3:ListBucket"]
        resources = [local.state_bucket_arn]
      },
      {
        effect    = "Allow"
        actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        resources = [local.state_prefix_arn.staging]
      },
      {
        effect    = "Allow"
        actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"]
        resources = [data.aws_dynamodb_table.tf_locks.arn]
      },
      {
        effect    = "Allow"
        actions   = local.lambda_actions
        resources = [local.lambda_fn_arn.staging]
      },
      {
        effect    = "Allow"
        actions   = local.apigw_actions
        resources = [local.execute_api_arn]
      },
      {
        effect    = "Allow"
        actions   = local.iam_read_actions
        resources = [local.lambda_exec_role_arn.staging]
      },
      {
        effect    = "Allow"
        actions   = local.iam_write_actions
        resources = [local.lambda_exec_role_arn.staging]
      },
      {
        effect    = "Allow"
        actions   = ["iam:GetOpenIDConnectProvider"]
        resources = [local.oidc_provider_arn]
      },
    ]

    prod = [
      {
        effect    = "Allow"
        actions   = ["sts:GetCallerIdentity"]
        resources = ["*"]
      },
      {
        effect    = "Allow"
        actions   = ["s3:ListBucket"]
        resources = [local.state_bucket_arn]
      },
      {
        effect    = "Allow"
        actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        resources = [local.state_prefix_arn.prod]
      },
      {
        effect    = "Allow"
        actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"]
        resources = [data.aws_dynamodb_table.tf_locks.arn]
      },
      {
        effect    = "Allow"
        actions   = local.lambda_actions
        resources = [local.lambda_fn_arn.prod]
      },
      {
        effect    = "Allow"
        actions   = local.apigw_actions
        resources = [local.execute_api_arn]
      },
      {
        effect    = "Allow"
        actions   = local.iam_read_actions
        resources = [local.lambda_exec_role_arn.prod]
      },
      {
        effect    = "Allow"
        actions   = local.iam_write_actions
        resources = [local.lambda_exec_role_arn.prod]
      },
      {
        effect    = "Allow"
        actions   = ["iam:GetOpenIDConnectProvider"]
        resources = [local.oidc_provider_arn]
      },
    ]
  }
}

resource "aws_iam_openid_connect_provider" "github" {
  count = local.create_github_oidc ? 1 : 0

  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]

  tags = {
    project    = "donaoferta"
    managed_by = "terraform"
  }
}

data "aws_iam_policy_document" "gha_dev_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:digitalelvis/dona:*"]
    }
  }
}

data "aws_iam_policy_document" "gha_staging_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:digitalelvis/dona:ref:refs/heads/v*"]
    }
  }

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:digitalelvis/dona:pull_request"]
    }
  }
}

data "aws_iam_policy_document" "gha_prod_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:digitalelvis/dona:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "gha_dev" {
  name               = "donaoferta-gha-dev"
  assume_role_policy = data.aws_iam_policy_document.gha_dev_trust.json

  tags = {
    project    = "donaoferta"
    managed_by = "terraform"
  }
}

resource "aws_iam_role" "gha_staging" {
  name               = "donaoferta-gha-staging"
  assume_role_policy = data.aws_iam_policy_document.gha_staging_trust.json

  tags = {
    project    = "donaoferta"
    managed_by = "terraform"
  }
}

resource "aws_iam_role" "gha_prod" {
  name               = "donaoferta-gha-prod"
  assume_role_policy = data.aws_iam_policy_document.gha_prod_trust.json

  tags = {
    project    = "donaoferta"
    managed_by = "terraform"
  }
}

module "gha_policy_dev" {
  source = "../../modules/iam-policy"

  policy_name = "gha-dev-terraform-api"
  role_name   = aws_iam_role.gha_dev.name

  statements = local.gha_policy_statements.dev
}

module "gha_policy_staging" {
  source = "../../modules/iam-policy"

  policy_name = "gha-staging-terraform-api"
  role_name   = aws_iam_role.gha_staging.name

  statements = local.gha_policy_statements.staging
}

module "gha_policy_prod" {
  source = "../../modules/iam-policy"

  policy_name = "gha-prod-terraform-api"
  role_name   = aws_iam_role.gha_prod.name

  statements = local.gha_policy_statements.prod
}
