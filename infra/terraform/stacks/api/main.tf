data "archive_file" "handler" {
  type        = "zip"
  source_file = abspath("${path.module}/../../../../apps/api/dist/handler.mjs")
  output_path = "${path.module}/.build/handler.zip"
}

module "lambda" {
  source = "../../modules/lambda-fn"

  function_name    = "donaoferta-api-${var.environment}"
  environment      = var.environment
  handler          = "handler.handler"
  runtime          = "nodejs22.x"
  filename         = data.archive_file.handler.output_path
  source_code_hash = data.archive_file.handler.output_base64sha256
  memory_size      = var.memory_size
  timeout          = var.timeout

  environment_variables = {
    LOG_LEVEL = var.log_level
  }

  tags = {
    managed_by = "terraform"
  }
}

module "http_api" {
  source = "../../modules/http-api"

  name                 = "donaoferta-http-api-${var.environment}"
  lambda_invoke_arn    = module.lambda.invoke_arn
  lambda_function_name = module.lambda.function_name

  tags = {
    project     = "donaoferta"
    environment = var.environment
    managed_by  = "terraform"
  }
}
