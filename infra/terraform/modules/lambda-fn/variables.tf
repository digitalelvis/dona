variable "architecture" {
  type        = string
  default     = "arm64"
  description = "Lambda CPU architecture, e.g. arm64 or x86_64."
}

variable "function_name" {
  type        = string
  description = "Lambda function name."
}

variable "handler" {
  type        = string
  description = "Lambda handler, e.g. handler.handler"
}

variable "runtime" {
  type        = string
  description = "Lambda runtime, e.g. nodejs22.x"
}

variable "filename" {
  type        = string
  description = "Path to deployment package (zip)."
}

variable "source_code_hash" {
  type        = string
  description = "Base64-encoded SHA256 of deployment package (forces code updates)."
}

variable "memory_size" {
  type        = number
  default     = 128
  description = "Memory size in MB."
}

variable "timeout" {
  type        = number
  default     = 10
  description = "Function timeout in seconds."
}

variable "environment" {
  type        = string
  description = "Deployment environment label used in default tags."
}

variable "environment_variables" {
  type        = map(string)
  default     = {}
  description = "Environment variables injected into the Lambda function."
}

variable "layers" {
  type        = list(string)
  default     = []
  description = "Lambda layer ARNs."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Additional resource tags."
}
