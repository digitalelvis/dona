output "invoke_url" {
  value       = module.http_api.invoke_url
  description = "Public base URL for the HTTP API stage."
}

output "environment" {
  value       = var.environment
  description = "Environment this stack was applied for."
}
