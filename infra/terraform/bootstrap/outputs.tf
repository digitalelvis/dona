output "tfstate_bucket_name" {
  value       = aws_s3_bucket.tfstate.bucket
  description = "S3 bucket used for Terraform remote state."
}

output "tf_locks_table_name" {
  value       = aws_dynamodb_table.tf_locks.name
  description = "DynamoDB table used for Terraform state locking."
}
