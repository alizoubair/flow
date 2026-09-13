"""
CI Orchestrator Lambda — durable pipeline run coordinator.

ONE MicroVM per pipeline run. All stages execute sequentially inside
the same MicroVM, sharing a workspace. No S3 artifact transfer needed.

Durable steps:
  1. launch_microvm        — RunMicroVM, returns microvm_id + endpoint
  2. wait_for_condition    — polls GetMicroVM until RUNNING
  3. create_auth_token     — CreateMicroVMAuthToken
  4. dispatch_pipeline     — POST /run with all stages (202 fire-and-forget)
  5. callback.result()     — suspends until runner signals completion
  6. terminate_microvm     — TerminateMicroVM
"""
import json
import os
import logging
import urllib.request
import uuid
import boto3

from aws_durable_execution_sdk_python import (
    DurableContext,
    StepContext,
    durable_execution,
    durable_step,
)
from aws_durable_execution_sdk_python.config import Duration
from aws_durable_execution_sdk_python.waits import (
    WaitForConditionConfig,
    WaitForConditionDecision,
)

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

REGION              = os.environ["MVM_REGION"]
IMAGE_URI           = os.environ["MVM_IMAGE_URI"]
EXECUTION_ROLE_ARN  = os.environ["MVM_EXECUTION_ROLE_ARN"]
PIPELINES_TABLE     = os.environ["PIPELINES_TABLE"]
CI_RUNS_TABLE       = os.environ["CI_RUNS_TABLE"]
WS_ENDPOINT         = os.environ["WS_ENDPOINT"]
GIT_SECRET_ARN      = os.environ.get("GIT_PROVIDER_SECRET_ARN", "")
CI_ARTIFACTS_BUCKET = os.environ.get("CI_ARTIFACTS_BUCKET", "")

dynamodb = boto3.resource("dynamodb", region_name=REGION)


def _ws_send(connection_id: str, message: dict) -> None:
    if not connection_id:
        return
    try:
        boto3.client(
            "apigatewaymanagementapi",
            endpoint_url=WS_ENDPOINT,
            region_name=REGION,
        ).post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(message).encode(),
        )
    except Exception as e:
        print("[WARN] WebSocket send failed:", e)


def _load_pipeline(pipeline_id: str, user_id: str) -> dict:
    resp = dynamodb.Table(PIPELINES_TABLE).get_item(
        Key={"PK": f"USER#{user_id}", "SK": f"PIPELINE#{pipeline_id}"}
    )
    return resp.get("Item", {})


def _write_run_record(run_id: str, pipeline_id: str, user_id: str, status: str) -> None:
    import time
    dynamodb.Table(CI_RUNS_TABLE).put_item(Item={
        "runId":      run_id,
        "pipelineId": pipeline_id,
        "userId":     user_id,
        "status":     status,
        "createdAt":  str(int(time.time())),
        "ttl":        int(time.time()) + 7 * 24 * 3600,
    })


def _update_run_status(run_id: str, status: str) -> None:
    dynamodb.Table(CI_RUNS_TABLE).update_item(
        Key={"runId": run_id},
        UpdateExpression="SET #s = :s",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": status},
    )


def _microvms():
    return boto3.client("lambda-microvms", region_name=REGION)


def poll_microvm_state(state: dict, ctx) -> dict:
    resp = _microvms().get_microvm(microvmIdentifier=state["microvm_id"])
    return {**state, "state": resp["state"]}


def microvm_running_strategy(state: dict, iteration: int) -> WaitForConditionDecision:
    if state.get("state") == "RUNNING":
        return WaitForConditionDecision.stop_polling()
    if iteration >= 150:
        raise TimeoutError(f"MicroVM {state['microvm_id']} did not reach RUNNING after 5 min")
    return WaitForConditionDecision.continue_waiting(Duration.from_seconds(2))


@durable_step
def launch_microvm(ctx: StepContext, run_id: str) -> dict:
    log_group = f"/aws/lambda-microvms/{os.environ.get('PROJECT_NAME', 'flow')}-ci-runner"
    resp = _microvms().run_microvm(
        imageIdentifier=IMAGE_URI,
        ingressNetworkConnectors=[
            f"arn:aws:lambda:{REGION}:aws:network-connector:"
            "aws-network-connector:HTTP_INGRESS"
        ],
        egressNetworkConnectors=[
            f"arn:aws:lambda:{REGION}:aws:network-connector:"
            "aws-network-connector:INTERNET_EGRESS"
        ],
        executionRoleArn=EXECUTION_ROLE_ARN,
        logging={
            "cloudWatch": {
                "logGroup":  log_group,
                "logStream": f"runs/{run_id}/",
            }
        },
        idlePolicy={
            "maxIdleDurationSeconds":   300,
            "suspendedDurationSeconds": 60,
            "autoResumeEnabled":        False,
        },
    )
    return {"microvm_id": resp["microvmId"], "endpoint": resp["endpoint"]}


@durable_step
def create_auth_token(ctx: StepContext, microvm_id: str) -> str:
    resp = _microvms().create_microvm_auth_token(
        microvmIdentifier=microvm_id,
        expirationInMinutes=60,
        allowedPorts=[{"port": 9000}],
    )
    return resp["authToken"]["X-aws-proxy-auth"]


@durable_step
def dispatch_pipeline(ctx: StepContext, endpoint: str, auth_token: str, payload: dict) -> None:
    """POST /run with all stages — MicroVM runs them sequentially and signals when done."""
    req = urllib.request.Request(
        f"https://{endpoint}/run",
        method="POST",
        headers={
            "X-aws-proxy-auth": auth_token,
            "X-aws-proxy-port": "9000",
            "Content-Type":     "application/json",
        },
        data=json.dumps(payload).encode(),
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        if r.status != 202:
            raise RuntimeError(f"MicroVM rejected pipeline dispatch: HTTP {r.status}")


@durable_step
def terminate_microvm(ctx: StepContext, microvm_id: str) -> None:
    _microvms().terminate_microvm(microvmIdentifier=microvm_id)


@durable_execution
def lambda_handler(event: dict, context: DurableContext) -> dict:
    pipeline_id   = event["pipeline_id"]
    user_id       = event.get("user_id", "anonymous")
    connection_id = event.get("connection_id", "")
    run_id        = event.get("run_id") or str(uuid.uuid4())

    pipeline = _load_pipeline(pipeline_id, user_id)
    if not pipeline:
        _ws_send(connection_id, {"type": "error", "message": "Pipeline not found"})
        return {"status": "error"}

    # Write record immediately so _update_run_status always has a parent record
    _write_run_record(run_id, pipeline_id, user_id, "running")

    runner_stages = pipeline.get("runner_stages") or []
    if not runner_stages:
        _ws_send(connection_id, {
            "type": "error",
            "message": "Pipeline has no runner stages. Re-generate the pipeline with a GitHub URL.",
            "run_id": run_id,
        })
        _update_run_status(run_id, "failed")
        return {"status": "error"}

    vm = None
    try:
        # Launch ONE MicroVM for the entire pipeline
        vm = context.step(launch_microvm(run_id))

        context.wait_for_condition(
            check=poll_microvm_state,
            config=WaitForConditionConfig(
                wait_strategy=microvm_running_strategy,
                initial_state={"microvm_id": vm["microvm_id"], "state": "unknown"},
            ),
        )

        token    = context.step(create_auth_token(vm["microvm_id"]))
        callback = context.create_callback(name="pipeline-complete")

        _ws_send(connection_id, {
            "type":   "pipeline_start",
            "run_id": run_id,
            "stages": [s["name"] for s in runner_stages],
        })

        # Dispatch ALL stages to the MicroVM — it runs them sequentially
        context.step(dispatch_pipeline(
            vm["endpoint"],
            token,
            {
                "run_id":              run_id,
                "stages":              runner_stages,
                "repo_url":            pipeline.get("repo_url", ""),
                "connection_id":       connection_id,
                "ws_endpoint":         WS_ENDPOINT,
                "callback_id":         callback.callback_id,
                "git_secret_arn":      GIT_SECRET_ARN,
                "ci_artifacts_bucket": CI_ARTIFACTS_BUCKET,
                "aws_region":          REGION,
            },
        ))

        # Suspend — Lambda exits, zero idle compute
        result = callback.result()

        context.step(terminate_microvm(vm["microvm_id"]))

        _update_run_status(run_id, "completed")
        _ws_send(connection_id, {"type": "pipeline_complete", "run_id": run_id})
        print("Pipeline complete run=%s", run_id)
        return {"status": "completed"}

    except Exception as e:
        if vm:
            context.step(terminate_microvm(vm["microvm_id"]))
        _update_run_status(run_id, "failed")
        _ws_send(connection_id, {
            "type":    "pipeline_failed",
            "run_id":  run_id,
            "message": str(e),
        })
        print("[ERROR] Pipeline failed run=%s: %s", run_id, e)
        return {"status": "failed"}
