data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${var.function_name}-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = merge(var.tags, {
    project     = "donaoferta"
    environment = var.environment
  })
}

resource "aws_iam_role_policy_attachment" "basic_execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "this" {
  depends_on = [aws_iam_role_policy_attachment.basic_execution]

  function_name = var.function_name
  role          = aws_iam_role.execution.arn
  handler       = var.handler
  runtime       = var.runtime

  filename         = var.filename
  source_code_hash = var.source_code_hash

  memory_size = var.memory_size
  timeout     = var.timeout

  layers = var.layers

  dynamic "environment" {
    for_each = length(var.environment_variables) > 0 ? [1] : []
    content {
      variables = var.environment_variables
    }
  }

  tags = merge(var.tags, {
    project     = "donaoferta"
    environment = var.environment
  })
}
