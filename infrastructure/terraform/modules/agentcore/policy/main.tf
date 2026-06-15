locals {
  gateway_name       = "${var.project_name}-${var.environment}-gateway"
  policy_engine_name = coalesce(var.policy_engine_name, "${var.project_name}_${var.environment}_gateway")
  gateway_arn        = var.gateway_arn

  # Cedar actions use {target}___{tool} (see agentcore/gateway/schemas/*.yaml).
  source_control_read_actions = [
    for tool in ["get_repo_info", "get_file_tree", "check_files_exist"] :
    "${var.source_control_target_name}___${tool}"
  ]
  source_control_read_file_action = "${var.source_control_target_name}___read_file_content"

  # Optional starter policies for the source-control Gateway target.
  # Use conditional permit (not forbid) — AgentCore Cedar validation rejects forbid rules
  # that static analysis treats as denying every call for an action/principal pair.
  default_policies = var.enable_default_source_control_policies ? {
    permit_source_control_tools = <<-CEDAR
      permit(
        principal is AgentCore::OAuthUser,
        action in [
          ${join(",\n          ", [for action in local.source_control_read_actions : "AgentCore::Action::\"${action}\""])}
        ],
        resource == AgentCore::Gateway::"${local.gateway_arn}"
      );
    CEDAR

    permit_safe_file_reads = <<-CEDAR
      permit(
        principal is AgentCore::OAuthUser,
        action == AgentCore::Action::"${local.source_control_read_file_action}",
        resource == AgentCore::Gateway::"${local.gateway_arn}"
      )
      when {
        !(context.input.file_path like "*.env*") &&
        !(context.input.file_path like "*secret*") &&
        !(context.input.file_path like "*credentials*") &&
        !(context.input.file_path like "*/.git/*")
      };
    CEDAR
  } : {}

  all_policies = merge(local.default_policies, var.policies)

  policy_engine_id = var.create_policy_engine ? aws_bedrockagentcore_policy_engine.gateway[0].policy_engine_id : var.policy_engine_id
}

# AgentCore policy engine — attach ARN to Gateway policy_engine_configuration

resource "aws_bedrockagentcore_policy_engine" "gateway" {
  count = var.create_policy_engine ? 1 : 0

  name        = local.policy_engine_name
  description = var.description

  tags = var.tags
}

# Cedar policies evaluated on MCP Gateway tool calls (one resource per policy name)

resource "aws_bedrockagentcore_policy" "gateway_cedar" {
  for_each = var.create_cedar_policies ? local.all_policies : {}

  name             = each.key
  policy_engine_id = local.policy_engine_id
  validation_mode  = var.validation_mode

  description = "AgentCore Gateway policy: ${each.key}"

  definition {
    cedar {
      statement = trimspace(each.value)
    }
  }
}
