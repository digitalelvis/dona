variable "policy_name" {
  type        = string
  description = "Name of the inline IAM policy."
}

variable "role_name" {
  type        = string
  description = "IAM role name to attach the inline policy to."
}

variable "effect" {
  type        = string
  default     = "Allow"
  description = "Effect for the single-statement mode (Allow or Deny)."
}

variable "actions" {
  type        = list(string)
  default     = []
  description = "IAM actions for the single-statement mode."
}

variable "resources" {
  type        = list(string)
  default     = []
  description = "IAM resources for the single-statement mode."
}

variable "statements" {
  type = list(object({
    effect    = string
    actions   = list(string)
    resources = list(string)
  }))
  default     = null
  description = "Optional multi-statement mode. When set, overrides effect/actions/resources."
}
