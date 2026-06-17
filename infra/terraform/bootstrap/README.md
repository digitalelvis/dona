# Terraform bootstrap (remote state)

One-time stack: S3 bucket + DynamoDB lock table. Uses **local** Terraform state (no remote backend).

## Prereqs

- AWS credentials for the target account
- Terraform `~> 1.10`

## Apply (full)

```bash
cd infra/terraform/bootstrap
terraform init
terraform apply
```

## Apply with explicit targets (order-safe)

```bash
terraform apply \
  -target=aws_s3_bucket.tfstate \
  -target=aws_s3_bucket_versioning.tfstate \
  -target=aws_s3_bucket_server_side_encryption_configuration.tfstate \
  -target=aws_s3_bucket_public_access_block.tfstate \
  -target=aws_dynamodb_table.tf_locks
```

After apply, copy `tfstate_bucket_name` into `infra/terraform/stacks/*/backends/*.hcl` and `backend.hcl.example` (replace `<account_id>` in bucket name if you templated it manually).
