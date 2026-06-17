locals {
  policy_statements = var.statements != null ? var.statements : [
    {
      effect    = var.effect
      actions   = var.actions
      resources = var.resources
    }
  ]
}

data "aws_iam_policy_document" "this" {
  dynamic "statement" {
    for_each = local.policy_statements
    content {
      effect    = statement.value.effect
      actions   = statement.value.actions
      resources = statement.value.resources
    }
  }
}

resource "aws_iam_role_policy" "this" {
  name   = var.policy_name
  role   = var.role_name
  policy = data.aws_iam_policy_document.this.json
}
