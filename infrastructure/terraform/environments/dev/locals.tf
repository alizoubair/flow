locals {
  app_name        = "flow"
  environment     = "dev"
  lambda_src_path = "${path.root}/../../../../lambda"
  agentcore_shared_path = abspath("${path.root}/../../../../agentcore/shared")

  gateway_name = "${local.app_name}-${local.environment}-gateway"
  gateway_arn  = "arn:aws:bedrock-agentcore:${var.aws_region}:${data.aws_caller_identity.current.account_id}:gateway/${local.gateway_name}"

  observability_tags = {
    Project     = local.app_name
    Environment = local.environment
    ManagedBy   = "terraform"
  }

  # AgentCore resources that receive APPLICATION_LOGS + TRACES delivery.
  observability_targets = {
    memory = {
      resource_name  = "memory"
      resource_arn   = module.agentcore_memory.memory_arn
      log_group_name = "/aws/vendedlogs/bedrock-agentcore/memory/APPLICATION_LOGS/${module.agentcore_memory.memory_id}"
    }
    orchestrator = {
      resource_name  = "orchestrator"
      resource_arn   = module.orchestrator_runtime.agent_runtime_arn
      log_group_name = "/aws/vendedlogs/bedrock-agentcore/runtime/APPLICATION_LOGS/${module.orchestrator_runtime.agent_runtime_id}"
    }
    repo-analysis = {
      resource_name  = "repo-analysis"
      resource_arn   = module.repo_analysis_runtime.agent_runtime_arn
      log_group_name = "/aws/vendedlogs/bedrock-agentcore/runtime/APPLICATION_LOGS/${module.repo_analysis_runtime.agent_runtime_id}"
    }
    pipeline-gen = {
      resource_name  = "pipeline-gen"
      resource_arn   = module.pipeline_gen_runtime.agent_runtime_arn
      log_group_name = "/aws/vendedlogs/bedrock-agentcore/runtime/APPLICATION_LOGS/${module.pipeline_gen_runtime.agent_runtime_id}"
    }
    validation = {
      resource_name  = "validation"
      resource_arn   = module.validation_runtime.agent_runtime_arn
      log_group_name = "/aws/vendedlogs/bedrock-agentcore/runtime/APPLICATION_LOGS/${module.validation_runtime.agent_runtime_id}"
    }
    export = {
      resource_name  = "export"
      resource_arn   = module.export_runtime.agent_runtime_arn
      log_group_name = "/aws/vendedlogs/bedrock-agentcore/runtime/APPLICATION_LOGS/${module.export_runtime.agent_runtime_id}"
    }
  }
}
