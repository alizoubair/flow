"""
Online evaluation management for AgentCore agent runtime.

Commands:
  create   — CreateOnlineEvaluationConfig (enableOnCreate=True → ENABLED immediately)
  status   — GetOnlineEvaluationConfig — shows both lifecycle and execution status
  pause    — UpdateOnlineEvaluationConfig → executionStatus=DISABLED
  resume   — UpdateOnlineEvaluationConfig → executionStatus=ENABLED
  delete   — DeleteOnlineEvaluationConfig (guards on lifecycle status)
  results  — Query the results log group via CloudWatch Logs Insights
  metrics  — Print latest CloudWatch metric datapoints for evaluation scores

Environment variables:
  AWS_REGION                   (default: us-west-2)
  ONLINE_EVAL_CONFIG_NAME      (default: flow-dev-orchestrator-eval)
  ONLINE_EVAL_SERVICE_ROLE_ARN (required for create — terraform output online_eval_service_role_arn)
  ONLINE_EVAL_SAMPLING_PERCENTAGE (default: 10.0 — percent of sessions, per AWS API)
  ORCHESTRATOR_SERVICE_NAME       (default: {runtime_name}.DEFAULT from terraform)
  ORCHESTRATOR_EVENT_LOG_GROUP    (default: terraform output orchestrator_runtime_log_group_name)
  ONLINE_EVAL_CONFIG_ID             (optional — skips the List call if already known)
  RESULTS_LOOKBACK_MINUTES     (default: 60)
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

import boto3

# Configuration

ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parent
TF_DIR = REPO_ROOT / "infrastructure" / "terraform" / "environments" / "dev"

AWS_REGION = os.environ.get("AWS_REGION", "us-west-2")
CONFIG_NAME = os.environ.get("ONLINE_EVAL_CONFIG_NAME", "flow_dev_orchestrator_eval")

# Minimal evaluator set per create-online-evaluations doc boto3 example.
EVALUATORS = [{"evaluatorId": "Builtin.Helpfulness"}]

# Sampling percentage (0.01–100). Default 10% matches the console default.
SAMPLING_PERCENTAGE = float(os.environ.get("ONLINE_EVAL_SAMPLING_PERCENTAGE", "10.0"))

# Lifecycle statuses that allow UpdateOnlineEvaluationConfig (pause/resume)
_UPDATE_ALLOWED_STATUSES = {"ACTIVE", "UPDATE_FAILED", "ERROR"}

# Lifecycle statuses that allow DeleteOnlineEvaluationConfig
_DELETE_ALLOWED_STATUSES = {"ACTIVE", "UPDATE_FAILED", "CREATE_FAILED", "ERROR"}

CommandHandler = Callable[..., int]


# Terraform helpers

def _terraform_output(name: str) -> str:
    if not TF_DIR.is_dir():
        raise RuntimeError(f"Terraform directory not found: {TF_DIR}")
    try:
        result = subprocess.run(
            ["terraform", "output", "-raw", name],
            cwd=TF_DIR,
            capture_output=True,
            text=True,
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        detail = exc.stderr.strip() or exc.stdout.strip() or str(exc)
        raise RuntimeError(f"terraform output -raw {name} failed: {detail}") from exc
    value = result.stdout.strip()
    if not value:
        raise RuntimeError(f"terraform output -raw {name} returned empty")
    return value


def _resolve_service_name() -> str:
    explicit = os.environ.get("ORCHESTRATOR_SERVICE_NAME")
    if explicit:
        return explicit
    try:
        runtime_name = _terraform_output("orchestrator_runtime_name")
    except RuntimeError:
        runtime_name = "flow_dev_orchestrator"
    return f"{runtime_name}.DEFAULT"


def _resolve_event_log_group() -> str:
    explicit = os.environ.get("ORCHESTRATOR_EVENT_LOG_GROUP")
    if explicit:
        return explicit
    return _terraform_output("orchestrator_runtime_log_group_name")


def _build_data_source_config() -> dict:
    # CloudWatch log group data source — matches create-online-evaluations doc.
    return {
        "cloudWatchLogs": {
            "logGroupNames": [_resolve_event_log_group()],
            "serviceNames": [_resolve_service_name()],
        }
    }


def _env_or_terraform(env_name: str, tf_output: str) -> str:
    value = os.environ.get(env_name)
    if value:
        return value
    return _terraform_output(tf_output)


# AWS clients

def _control_client():
    return boto3.client("bedrock-agentcore-control", region_name=AWS_REGION)


def _logs_client():
    return boto3.client("logs", region_name=AWS_REGION)


def _cw_client():
    return boto3.client("cloudwatch", region_name=AWS_REGION)


# Config lookup helpers

def _find_config_id(control_client, name: str) -> str | None:
    # Return the config ID for a named online evaluation, or None.
    env_id = os.environ.get("ONLINE_EVAL_CONFIG_ID")
    if env_id:
        return env_id
    try:
        response = control_client.list_online_evaluation_configs()
        for item in response.get("onlineEvaluationConfigs", []):
            if item.get("onlineEvaluationConfigName") == name:
                return item["onlineEvaluationConfigId"]
    except Exception as exc:
        print(f"WARNING: could not list online eval configs: {exc}")
    return None


def _require_config_id(control_client) -> str:
    config_id = _find_config_id(control_client, CONFIG_NAME)
    if not config_id:
        raise RuntimeError(
            f'Online evaluation config "{CONFIG_NAME}" not found. '
            f'Run: python online_eval.py create'
        )
    return config_id


def _get_config(control_client, config_id: str) -> dict:
    """Fetch the full online evaluation config."""
    return control_client.get_online_evaluation_config(
        onlineEvaluationConfigId=config_id,
    )


def _lifecycle_status(control_client, config_id: str) -> str:
    """Return the current lifecycle status string (ACTIVE, CREATING, ERROR, …)."""
    cfg = _get_config(control_client, config_id)
    return cfg.get("status", "UNKNOWN")


# CLI command handlers

def create_online_evaluation(control_client) -> int:
    """
    Create the online evaluation config and start it immediately.

    Per the doc, ``enableOnCreate=True`` sets executionStatus to ENABLED on
    creation so traces start being evaluated straight away. Setting it to False
    leaves the config DISABLED until explicitly resumed.
    """
    existing = _find_config_id(control_client, CONFIG_NAME)
    if existing:
        print(
            f'Config "{CONFIG_NAME}" already exists (id={existing}).\n'
            f'Use "status" to inspect it or "resume" to enable it.'
        )
        return 0

    service_role_arn = _env_or_terraform(
        "ONLINE_EVAL_SERVICE_ROLE_ARN",
        "online_eval_service_role_arn",
    )
    data_source = _build_data_source_config()

    print(f"Creating online evaluation config: {CONFIG_NAME}")
    print(f"  Service role ARN: {service_role_arn}")
    print(f"  Data source:      {json.dumps(data_source)}")
    print(f"  Evaluators:       {[e['evaluatorId'] for e in EVALUATORS]}")
    print(f"  Sampling:         {SAMPLING_PERCENTAGE}%")
    print(f"  enableOnCreate:   True → executionStatus ENABLED immediately")

    response = control_client.create_online_evaluation_config(
        onlineEvaluationConfigName=CONFIG_NAME,
        description="Continuous evaluation of the Flow orchestrator runtime",
        rule={
            "samplingConfig": {
                "samplingPercentage": SAMPLING_PERCENTAGE,
            }
        },
        dataSourceConfig=data_source,
        evaluators=EVALUATORS,
        evaluationExecutionRoleArn=service_role_arn,
        enableOnCreate=True,
    )

    config_id = response.get("onlineEvaluationConfigId", "")
    # executionStatus reflects the job state; lifecycle status starts as CREATING
    exec_status = response.get("executionStatus", "UNKNOWN")
    lifecycle = response.get("status", "CREATING")

    print(f"\nCreated successfully.")
    print(f"  Config ID:        {config_id}")
    print(f"  Lifecycle status: {lifecycle}")
    print(f"  Execution status: {exec_status}")
    print(
        f"\nResults log group (available once ACTIVE):\n"
        f"  /aws/bedrock-agentcore/evaluations/results/{config_id}"
    )
    print(
        "\nView in CloudWatch Observability dashboard:\n"
        "  CloudWatch → GenAI Observability → Bedrock AgentCore → Evaluations"
    )
    return 0


def get_online_evaluation_status(control_client) -> int:
    """
    Get the current config status.

    Surfaces both fields the doc defines:
      - ``status``          lifecycle state (ACTIVE, CREATING, ERROR, …)
      - ``executionStatus`` job state (ENABLED or DISABLED)
    Also prints ``failureReason`` when status is ERROR.
    """
    config_id = _require_config_id(control_client)
    cfg = _get_config(control_client, config_id)

    lifecycle = cfg.get("status", "UNKNOWN")
    exec_status = cfg.get("executionStatus", "UNKNOWN")
    failure = cfg.get("failureReason", "")

    print(f"Config name:      {cfg.get('onlineEvaluationConfigName', CONFIG_NAME)}")
    print(f"Config ID:        {config_id}")
    print(f"Lifecycle status: {lifecycle}")
    print(f"Execution status: {exec_status}")
    if failure:
        print(f"Failure reason:   {failure}")

    # Guidance based on lifecycle state
    if lifecycle == "CREATING":
        print("\nConfig is still being provisioned. Wait for ACTIVE before updating or deleting.")
    elif lifecycle == "CREATE_FAILED":
        print("\nCreation failed. Run 'delete' to remove it, then 'create' to try again.")
    elif lifecycle == "UPDATING":
        print("\nUpdate in progress. Wait for ACTIVE before making more changes.")
    elif lifecycle == "UPDATE_FAILED":
        print("\nLast update failed. You can retry 'pause'/'resume' or run 'delete'.")
    elif lifecycle == "ERROR":
        print(f"\nConfig is in ERROR state. Fix the issue above, then retry 'pause'/'resume'.")
    elif lifecycle == "ACTIVE" and exec_status == "DISABLED":
        print("\nConfig is ACTIVE but evaluation is paused. Run 'resume' to start processing traces.")

    print()
    print("Full config (JSON):")
    print(json.dumps(cfg, indent=2, default=str))
    return 0


def pause_online_evaluation(control_client) -> int:
    """
    Pause the online evaluation — sets executionStatus to DISABLED.

    Per the doc, this is only allowed when lifecycle status is
    ACTIVE, UPDATE_FAILED, or ERROR.
    """
    config_id = _require_config_id(control_client)
    lifecycle = _lifecycle_status(control_client, config_id)

    if lifecycle not in _UPDATE_ALLOWED_STATUSES:
        print(
            f'Cannot pause: lifecycle status is "{lifecycle}".\n'
            f'Allowed statuses for update: {sorted(_UPDATE_ALLOWED_STATUSES)}.\n'
            f'Wait for the config to reach ACTIVE.'
        )
        return 1

    control_client.update_online_evaluation_config(
        onlineEvaluationConfigId=config_id,
        executionStatus="DISABLED",
    )
    print(f'Config "{CONFIG_NAME}" paused — executionStatus=DISABLED.')
    print("No new traces will be processed until you run 'resume'.")
    return 0


def resume_online_evaluation(control_client) -> int:
    """
    Resume the online evaluation — sets executionStatus to ENABLED.

    Per the doc, this is only allowed when lifecycle status is
    ACTIVE, UPDATE_FAILED, or ERROR.
    Note: enabling evaluation locks any custom evaluators in the config.
    """
    config_id = _require_config_id(control_client)
    lifecycle = _lifecycle_status(control_client, config_id)

    if lifecycle not in _UPDATE_ALLOWED_STATUSES:
        print(
            f'Cannot resume: lifecycle status is "{lifecycle}".\n'
            f'Allowed statuses for update: {sorted(_UPDATE_ALLOWED_STATUSES)}.\n'
            f'Wait for the config to reach ACTIVE.'
        )
        return 1

    control_client.update_online_evaluation_config(
        onlineEvaluationConfigId=config_id,
        executionStatus="ENABLED",
    )
    print(f'Config "{CONFIG_NAME}" resumed — executionStatus=ENABLED.')
    print("Note: any custom evaluators in this config are now locked.")
    return 0


def delete_online_evaluation(control_client) -> int:
    """
    Delete the online evaluation config.

    Per the doc, deletion is only allowed when lifecycle status is
    ACTIVE, UPDATE_FAILED, CREATE_FAILED, or ERROR.
    Configs in CREATING, UPDATING, or DELETING must complete first.
    """
    config_id = _require_config_id(control_client)
    lifecycle = _lifecycle_status(control_client, config_id)

    if lifecycle not in _DELETE_ALLOWED_STATUSES:
        print(
            f'Cannot delete: lifecycle status is "{lifecycle}".\n'
            f'Allowed statuses for delete: {sorted(_DELETE_ALLOWED_STATUSES)}.\n'
            f'Wait for the current operation to complete.'
        )
        return 1

    confirm = input(f'Delete online eval config "{CONFIG_NAME}" ({config_id})? [y/N] ')
    if confirm.strip().lower() != "y":
        print("Aborted.")
        return 1

    control_client.delete_online_evaluation_config(
        onlineEvaluationConfigId=config_id,
    )
    print(f'Config "{CONFIG_NAME}" deletion initiated (asynchronous — status will move to DELETING).')
    return 0


def query_online_evaluation_results(control_client) -> int:
    """
    Query the most recent evaluation results from CloudWatch Logs Insights.

    Results are stored at:
      /aws/bedrock-agentcore/evaluations/results/<config-id>
    in OpenTelemetry semantic convention format.
    """
    config_id = _require_config_id(control_client)

    # Verify config is ACTIVE before querying (results log group won't exist otherwise)
    cfg = _get_config(control_client, config_id)
    lifecycle = cfg.get("status", "UNKNOWN")
    exec_status = cfg.get("executionStatus", "UNKNOWN")

    if lifecycle != "ACTIVE":
        print(
            f'Config lifecycle status is "{lifecycle}" (expected ACTIVE).\n'
            f'Results are only available once the config is fully provisioned.'
        )
        return 1
    if exec_status == "DISABLED":
        print("WARNING: evaluation is currently DISABLED — results may be stale.")

    log_group = f"/aws/bedrock-agentcore/evaluations/results/{config_id}"
    logs = _logs_client()

    lookback_minutes = int(os.environ.get("RESULTS_LOOKBACK_MINUTES", "60"))
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(minutes=lookback_minutes)

    print(f"Querying results from: {log_group}")
    print(f"Time range: last {lookback_minutes} minutes")

    query = (
        "fields @timestamp, evaluatorId, value, label, explanation, "
        "context.spanContext.sessionId, context.spanContext.traceId\n"
        "| sort @timestamp desc\n"
        "| limit 50"
    )

    try:
        response = logs.start_query(
            logGroupName=log_group,
            startTime=int(start_time.timestamp()),
            endTime=int(end_time.timestamp()),
            queryString=query,
        )
        query_id = response["queryId"]
    except logs.exceptions.ResourceNotFoundException:
        print(
            f"\nResults log group not found: {log_group}\n"
            "The config is ACTIVE but no evaluations have run yet.\n"
            "Ensure live traffic is reaching the orchestrator."
        )
        return 1

    # Poll for completion
    for _ in range(30):
        result = logs.get_query_results(queryId=query_id)
        if result["status"] in ("Complete", "Failed"):
            break
        time.sleep(2)

    rows = result.get("results", [])
    if not rows:
        print(
            f"\nNo evaluation results in the last {lookback_minutes} minutes.\n"
            "Ensure live traffic is reaching the orchestrator and the config is ENABLED."
        )
        return 0

    print(f"\n{'='*80}")
    print(f"{'Timestamp':<26} {'Evaluator':<32} {'Score':<8} {'Label'}")
    print(f"{'='*80}")
    for row in rows:
        fields = {f["field"]: f["value"] for f in row}
        ts = fields.get("@timestamp", "")
        evaluator = fields.get("evaluatorId", "")
        value = fields.get("value", "")
        label = fields.get("label", "")
        session = fields.get("context.spanContext.sessionId", "")
        explanation = (fields.get("explanation") or "")[:100]
        print(f"{ts:<26} {evaluator:<32} {value:<8} {label}")
        if session:
            print(f"  session={session}")
        if explanation:
            print(f"  explanation: {explanation}{'...' if len(explanation) == 100 else ''}")
    print(f"{'='*80}")
    return 0


def show_online_evaluation_metrics(control_client) -> int:
    """Print latest CloudWatch metric datapoints for evaluation scores."""
    cw = _cw_client()
    config_id = _find_config_id(control_client, CONFIG_NAME) or "unknown"

    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(hours=24)

    print(f"Evaluation score metrics (last 24h) — config: {CONFIG_NAME}")
    print()

    for evaluator in EVALUATORS:
        evaluator_id = evaluator["evaluatorId"]
        try:
            response = cw.get_metric_statistics(
                Namespace="Bedrock-AgentCore/Evaluations",
                MetricName="EvaluationScore",
                Dimensions=[
                    {"Name": "EvaluatorId", "Value": evaluator_id},
                    {"Name": "OnlineEvaluationConfigId", "Value": config_id},
                ],
                StartTime=start_time,
                EndTime=end_time,
                Period=3600,
                Statistics=["Average", "SampleCount"],
            )
            points = sorted(response.get("Datapoints", []), key=lambda p: p["Timestamp"])
            if not points:
                print(f"  {evaluator_id}: no datapoints yet")
                continue
            latest = points[-1]
            avg = latest.get("Average", 0)
            n = int(latest.get("SampleCount", 0))
            ts = latest["Timestamp"].strftime("%Y-%m-%d %H:%M UTC")
            print(f"  {evaluator_id}: avg={avg:.3f}  n={n}  (as of {ts})")
        except Exception as exc:
            print(f"  {evaluator_id}: error — {exc}")

    print()
    print("Full dashboard: CloudWatch → Metrics → All Metrics → Bedrock-AgentCore/Evaluations")
    return 0


# Entry point

COMMAND_HANDLERS: dict[str, CommandHandler] = {
    "create":  create_online_evaluation,
    "status":  get_online_evaluation_status,
    "pause":   pause_online_evaluation,
    "resume":  resume_online_evaluation,
    "delete":  delete_online_evaluation,
    "results": query_online_evaluation_results,
    "metrics": show_online_evaluation_metrics,
}


def _print_usage() -> None:
    commands = " | ".join(COMMAND_HANDLERS)
    print(f"Usage: python online_eval.py <command>\nCommands: {commands}")


def run_command(command: str, control_client) -> int:
    # Dispatch a CLI command to its handler.
    handler = COMMAND_HANDLERS.get(command)
    if handler is None:
        _print_usage()
        return 1
    return handler(control_client)


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] not in COMMAND_HANDLERS:
        _print_usage()
        return 1

    command = sys.argv[1]

    sts = boto3.client("sts", region_name=AWS_REGION)
    identity = sts.get_caller_identity()
    print(f"Running as: {identity.get('Arn', identity.get('UserId', 'unknown'))}")
    print(f"Region:     {AWS_REGION}")
    print(f"Config:     {CONFIG_NAME}")
    print()

    control_client = _control_client()
    return run_command(command, control_client)


if __name__ == "__main__":
    sys.exit(main())
