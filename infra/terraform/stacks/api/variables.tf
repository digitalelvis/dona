variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region for this stack."
}

variable "environment" {
  type        = string
  description = "Deployment environment name (dev, staging, prod)."
}

variable "memory_size" {
  type        = number
  description = "Lambda memory size (MB)."
}

variable "timeout" {
  type        = number
  description = "Lambda timeout (seconds)."
}

variable "log_level" {
  type        = string
  description = "LOG_LEVEL injected into the Lambda function."
}
