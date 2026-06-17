variable "name" {
  type        = string
  description = "API Gateway HTTP API name."
}

variable "lambda_invoke_arn" {
  type        = string
  description = "Lambda invoke ARN (aws_lambda_function.invoke_arn)."
}

variable "lambda_function_name" {
  type        = string
  description = "Lambda function name (for aws_lambda_permission)."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Additional resource tags."
}
